import { useCallback, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type Dispatch, type PointerEvent as ReactPointerEvent, type SetStateAction } from "react";
import { AlertTriangle, Lock, Move, ScanSearch, Sparkles } from "lucide-react";
import type { SignatureSettingsConfig, SignatureSigner } from "@/hooks/useSignatureSettings";
import {
  type ExportColumn,
  type ExportConfig,
  type HeaderGroup,
} from "@/lib/reportExportLayout";
import {
  buildReportLayoutPlanV2,
  getColumnBodyAlignment,
  getColumnHeaderAlignment,
  getColumnTypography,
  resolveSignaturePlacementFromBounds,
  type ReportDocumentStyle,
  type SignaturePlacement,
} from "@/lib/reportExportLayoutV2";
import { getExportMetaGroups, getExportTitle } from "@/lib/exportEngine/shared";
import {
  PX_PER_MM,
  CELL_PADDING,
  FOOTER,
  TABLE_COLORS,
  TABLE_LINE,
  pdfEffectiveFontSize,
  pdfBodyRowHeightMm,
  pdfHeaderRowHeightMm,
  mmToPx,
  paddingMmToCss,
  rgbToCss,
} from "@/lib/exportEngine/sharedMetrics";

const COLORS = {
  page: "#ffffff",
  ink: "#0f172a",
  muted: "#64748b",
  border: rgbToCss(TABLE_LINE.color),
  borderStrong: "#c4d2e2",
  panel: rgbToCss(TABLE_COLORS.alternateRow),
  panelStrong: "#eef4fb",
  header: rgbToCss(TABLE_COLORS.headerDefault),
  headerStrong: "#1d4ed8",
  warningBg: "#fef3c7",
  warningFg: "#92400e",
  successBg: "#ecfdf5",
  successFg: "#166534",
  safeZone: "rgba(37, 99, 235, 0.08)",
  safeZoneBorder: "rgba(37, 99, 235, 0.35)",
  signatureBg: "rgba(239, 246, 255, 0.94)",
  signatureBorder: "rgba(59, 130, 246, 0.55)",
  debug: "rgba(234, 88, 12, 0.32)",
};

export type SignaturePreviewData = ExportConfig;
export type ExportPreviewHighlightTarget =
  | { kind: "table"; label?: string }
  | { kind: "header-row"; label?: string }
  | { kind: "body-row"; label?: string }
  | { kind: "column"; key: string; label?: string };

interface SignaturePreviewCanvasProps {
  previewFormat: "pdf" | "png";
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  previewDate: string;
  previewData?: SignaturePreviewData;
  liveEditMode?: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetChange?: (target: ExportPreviewHighlightTarget | null) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getVisibleSigners(signers: SignatureSigner[]) {
  const active = signers.filter((signer) => signer.name.trim() || signer.title.trim());
  return active.length > 0 ? active : signers.slice(0, 1);
}

function getHeaderFillCss(group: HeaderGroup) {
  if (group.semester === 1) return rgbToCss(TABLE_COLORS.headerSemester1);
  if (group.semester === 2) return rgbToCss(TABLE_COLORS.headerSemester2);
  if (group.label === "Rekap Akhir" || group.label === "Nilai Akhir") return rgbToCss(TABLE_COLORS.headerFinal);
  if (group.isChapter) return rgbToCss(TABLE_COLORS.headerChapter);
  return "#94a3b8";
}

function getColBgCss(col: ExportColumn) {
  if (col.semester === 1) return rgbToCss(TABLE_COLORS.headerSemester1);
  if (col.semester === 2) return rgbToCss(TABLE_COLORS.headerSemester2);
  if (["chapterAvg", "grandAvg", "avgRapor", "rapor"].includes(col.type)) return rgbToCss(TABLE_COLORS.headerSummary);
  return COLORS.header;
}

function useSignatureDrag(
  draft: SignatureSettingsConfig,
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>,
  placement: SignaturePlacement | null,
) {
  const dragging = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startPosition = useRef({ xMm: 0, yMm: 0 });
  // Effective px-per-mm at the moment dragging started — derived from the
  // signature element's actual rendered bounding rect so the conversion stays
  // accurate even when the preview wrapper is CSS-scaled (zoom).
  const effectivePxPerMm = useRef(PX_PER_MM);

  const endDrag = useCallback(() => {
    dragging.current = false;
  }, []);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!placement || draft.lockSignaturePosition) return;
    dragging.current = true;
    startPoint.current = { x: event.clientX, y: event.clientY };
    startPosition.current = { xMm: placement.xMm, yMm: placement.yMm };
    // Measure the rendered width of the signature box (which we know is
    // placement.widthMm in mm) to derive the live px-per-mm — automatically
    // compensates for any parent transform: scale().
    const rect = event.currentTarget.getBoundingClientRect();
    const measuredPxPerMm = placement.widthMm > 0 ? rect.width / placement.widthMm : PX_PER_MM;
    effectivePxPerMm.current = Math.max(0.5, Number.isFinite(measuredPxPerMm) ? measuredPxPerMm : PX_PER_MM);
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [draft.lockSignaturePosition, placement]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !placement) return;

    const pxPerMm = effectivePxPerMm.current;
    const deltaMmX = (event.clientX - startPoint.current.x) / pxPerMm;
    const deltaMmY = (event.clientY - startPoint.current.y) / pxPerMm;
    const grid = draft.snapToGrid ? Math.max(1, draft.gridSizeMm || 5) : 0;

    let nextXMm = startPosition.current.xMm + deltaMmX;
    let nextYMm = startPosition.current.yMm + deltaMmY;

    if (grid > 0) {
      nextXMm = Math.round((nextXMm - placement.movementBounds.safeXMm) / grid) * grid + placement.movementBounds.safeXMm;
      nextYMm = Math.round((nextYMm - placement.movementBounds.safeYMm) / grid) * grid + placement.movementBounds.safeYMm;
    }

    nextXMm = clamp(nextXMm, placement.movementBounds.safeXMm, placement.movementBounds.safeXMm + Math.max(0, placement.movementBounds.safeWidthMm - placement.widthMm));
    nextYMm = clamp(nextYMm, placement.movementBounds.safeYMm, placement.movementBounds.safeYMm + Math.max(0, placement.movementBounds.safeHeightMm - placement.heightMm));

    const xDenominator = Math.max(1, placement.movementBounds.safeWidthMm - placement.widthMm);
    const yDenominator = Math.max(1, placement.movementBounds.safeHeightMm - placement.heightMm);
    const manualXPercent = ((nextXMm - placement.movementBounds.safeXMm) / xDenominator) * 100;
    const manualYPercent = ((nextYMm - placement.movementBounds.safeYMm) / yDenominator) * 100;

    setDraft((prev) => ({
      ...prev,
      placementMode: "fixed",
      manualXPercent,
      manualYPercent,
    }));
  }, [draft.gridSizeMm, draft.snapToGrid, placement, setDraft]);

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
  };
}

function GenericPreview() {
  return (
    <div
      style={{
        width: 780,
        background: COLORS.page,
        border: `1px solid ${COLORS.border}`,
        borderRadius: 18,
        padding: 24,
        boxShadow: "0 18px 40px -30px rgba(15, 23, 42, 0.8)",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: COLORS.ink }}>Preview ekspor siap WYSIWYG</div>
      <p style={{ marginTop: 8, fontSize: 12, color: COLORS.muted, lineHeight: 1.55 }}>
      Preview akan aktif saat data laporan tersedia. Setelah aktif, ukuran kertas, pagination, safe zone, dan posisi signature akan memakai layout engine yang sama dengan proses ekspor PDF.
      </p>
    </div>
  );
}

function PreviewHeader({ data }: { data: SignaturePreviewData }) {
  const metaGroups = getExportMetaGroups(data);
  return (
    <>
      <div
        style={{
          textAlign: "center",
          fontSize: data.documentStyle?.titleFontSize ?? 16,
          fontWeight: 800,
          color: COLORS.ink,
        }}
      >
        {getExportTitle(data)}
      </div>
      <div
        style={{
          marginTop: mmToPx(2.5),
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: mmToPx(2.5),
          fontSize: data.documentStyle?.metaFontSize ?? 10,
          color: COLORS.muted,
        }}
      >
        {metaGroups.map((group, index) => (
          <div
            key={`${group.align ?? "left"}-${index}`}
            style={{ display: "grid", gap: 3, textAlign: group.align ?? "left" }}
          >
            {group.items.map((item) => (
              <span key={`${item.label}-${String(item.value)}`}>
                {item.label}: <strong style={{ color: COLORS.ink }}>{item.value}</strong>
              </span>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function SignatureBlock({
  draft,
  previewDate,
  placement,
  setDraft,
}: {
  draft: SignatureSettingsConfig;
  previewDate: string;
  placement: SignaturePlacement;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
}) {
  const signers = useMemo(() => getVisibleSigners(draft.signers), [draft.signers]);
  const drag = useSignatureDrag(draft, setDraft, placement);
  const justifyContent = draft.signatureAlignment === "left"
    ? "flex-start"
    : draft.signatureAlignment === "center"
      ? "center"
      : "flex-end";
  const textAlign = draft.signatureAlignment === "left"
    ? "left"
    : draft.signatureAlignment === "center"
      ? "center"
      : "right";
  const signerBlockWidthPx = Math.max(54, draft.signatureLineWidth + 10) * PX_PER_MM;
  const signerSpacingPx = Math.max(10, draft.signatureSpacing) * PX_PER_MM;
  const contentWidthPx = Math.min(
    placement.widthMm * PX_PER_MM,
    signers.length * signerBlockWidthPx + Math.max(0, signers.length - 1) * signerSpacingPx,
  );
  const signatureLineWidthPx = Math.max(42, draft.signatureLineWidth) * PX_PER_MM;
  const spacerHeightPx = 17 * PX_PER_MM;

  return (
    <div
      {...drag}
      style={{
        position: "absolute",
        left: mmToPx(placement.xMm),
        top: mmToPx(placement.yMm),
        width: mmToPx(placement.widthMm),
        minHeight: mmToPx(placement.heightMm),
        borderRadius: 16,
        border: `1px dashed ${COLORS.signatureBorder}`,
        background: COLORS.signatureBg,
        boxShadow: "0 14px 28px -24px rgba(15, 23, 42, 0.75)",
        padding: "12px 14px",
        cursor: draft.lockSignaturePosition ? "default" : "grab",
        touchAction: "none",
      }}
      title={draft.lockSignaturePosition ? "Posisi signature dikunci" : "Seret untuk memindahkan signature"}
    >
      <div style={{ display: "flex", justifyContent }}>
        <div style={{ width: contentWidthPx }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                borderRadius: 999,
                background: COLORS.header,
                color: "#fff",
                padding: "3px 8px",
                fontSize: 10,
                fontWeight: 700,
              }}
            >
              {draft.lockSignaturePosition ? <Lock size={12} /> : <Move size={12} />}
              {draft.lockSignaturePosition ? "Terkunci" : "Drag-and-drop"}
            </div>
            <div style={{ fontSize: 9, color: COLORS.muted }}>
              {draft.snapToGrid ? `Snap ${draft.gridSizeMm}mm` : "Free"}
            </div>
          </div>
          <div
            style={{
              textAlign,
              color: COLORS.ink,
              fontSize: Math.max(10, draft.fontSize + 1),
              marginBottom: 5,
              lineHeight: 1.3,
            }}
          >
            {draft.city || "[Kota]"}, {previewDate}
          </div>
          <div style={{ display: "flex", justifyContent, gap: signerSpacingPx, flexWrap: "wrap" }}>
            {signers.map((signer, index) => (
              <div
                key={signer.id || `${signer.name}-${index}`}
                style={{
                  width: signerBlockWidthPx,
                  textAlign: "center",
                  color: COLORS.ink,
                  fontSize: draft.fontSize,
                }}
              >
                <div style={{ lineHeight: 1.3 }}>{signer.title || "Guru Mata Pelajaran"}</div>
                {index === 0 && signer.school_name ? (
                  <div style={{ fontSize: Math.max(9, draft.fontSize - 1), color: COLORS.muted, marginTop: 2, lineHeight: 1.3 }}>{signer.school_name}</div>
                ) : null}
                <div style={{ height: spacerHeightPx }} />
                {draft.showSignatureLine && (draft.signatureLinePosition ?? "above-name") === "above-name" ? (
                  <div
                    style={{
                      width: signatureLineWidthPx,
                      borderBottom: `1px solid ${COLORS.ink}`,
                      margin: "0 auto 6px",
                    }}
                  />
                ) : null}
          <div style={{ fontWeight: 700, lineHeight: (draft.signatureLinePosition ?? "above-name") === "between-name-and-nip" ? 1 : 1.3, marginBottom: (draft.signatureLinePosition ?? "above-name") === "between-name-and-nip" ? -2 : 0 }}>{signer.name || "[Nama Signer]"}</div>
                {draft.showSignatureLine && (draft.signatureLinePosition ?? "above-name") === "between-name-and-nip" ? (
                  <div
                    style={{
                      width: signatureLineWidthPx,
                      borderBottom: `1px solid ${COLORS.ink}`,
                      margin: signer.nip ? "2px auto 0" : "2px auto 0",
                    }}
                  />
                ) : null}
                {signer.nip ? (
                  <div style={{ fontSize: Math.max(9, draft.fontSize - 1), color: COLORS.muted, marginTop: 2, lineHeight: 1.3 }}>NIP. {signer.nip}</div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function TablePreview({
  headerGroups,
  columns,
  widths,
  rows,
  documentStyle,
  liveEditMode,
  highlightTarget,
  onHighlightTargetChange,
}: {
  headerGroups: HeaderGroup[];
  columns: ExportColumn[];
  widths: number[];
  rows: Record<string, string | number>[];
  documentStyle: ReportDocumentStyle;
  liveEditMode?: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetChange?: (target: ExportPreviewHighlightTarget | null) => void;
}) {
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) * PX_PER_MM;

  // Use SAME formulas as PDF engine for row heights
  const headerRowHeightPx = mmToPx(
    pdfHeaderRowHeightMm(documentStyle.tableHeaderFontSize, documentStyle.tableSizing.headerRowHeightMm)
  );
  const bodyRowHeightPx = mmToPx(
    pdfBodyRowHeightMm(documentStyle.tableBodyFontSize, documentStyle.tableSizing.bodyRowHeightMm)
  );

  // Use SAME effective font sizes as PDF engine
  const effectiveHeaderFontSize = pdfEffectiveFontSize(documentStyle.tableHeaderFontSize);
  const effectiveBodyFontSize = pdfEffectiveFontSize(documentStyle.tableBodyFontSize);

  const hasMultiLevel = headerGroups.length > 1;
  const fixedTypes = new Set(["index", "name", "nisn"]);

  const fixedColumnIndexes = new Set<number>();
  if (hasMultiLevel) {
    let cursor = 0;
    headerGroups.forEach((group) => {
      const groupCols = columns.slice(cursor, cursor + group.colSpan);
      if (groupCols.every(c => fixedTypes.has(c.type))) {
        for (let i = cursor; i < cursor + group.colSpan; i++) fixedColumnIndexes.add(i);
      }
      cursor += group.colSpan;
    });
  }

  // Header cell style — matches PDF exactly
  const thStyle = (bg: string, colFontSize: number, textAlign: "left" | "center" | "right" = "center", extra?: CSSProperties): CSSProperties => ({
    border: `${TABLE_LINE.width}mm solid ${rgbToCss(TABLE_LINE.color)}`,
    background: bg,
    color: "#fff",
    padding: paddingMmToCss(CELL_PADDING.header),
    textAlign,
    verticalAlign: "middle",
    fontSize: pdfEffectiveFontSize(colFontSize),
    fontWeight: 700,
    wordBreak: "break-word",
    overflowWrap: "break-word",
    whiteSpace: "pre-line",
    lineHeight: 1.2,
    ...extra,
  });

  const resolveHighlight = (columnKey?: string, kind?: ExportPreviewHighlightTarget["kind"]) => {
    if (!highlightTarget) return null;
    if (kind === "table" && highlightTarget.kind === "table") return { outline: "2px solid rgba(37, 99, 235, 0.72)", outlineOffset: -2 };
    if (kind === "header-row" && highlightTarget.kind === "header-row") return { boxShadow: "inset 0 0 0 2px rgba(37, 99, 235, 0.72)" };
    if (kind === "body-row" && highlightTarget.kind === "body-row") return { boxShadow: "inset 0 0 0 2px rgba(14, 165, 233, 0.72)" };
    if (columnKey && highlightTarget.kind === "column" && highlightTarget.key === columnKey) {
      return { boxShadow: "inset 0 0 0 2px rgba(249, 115, 22, 0.8)" };
    }
    return null;
  };

  const interactiveProps = (target: ExportPreviewHighlightTarget) => liveEditMode
    ? {
        onClick: () => onHighlightTargetChange?.(target),
        onMouseEnter: () => onHighlightTargetChange?.(target),
        style: { cursor: "pointer" as const },
      }
    : {};

  return (
    <table
      style={{
        width: totalWidth,
        minWidth: "100%",
        borderCollapse: "collapse",
        tableLayout: "fixed",
        ...resolveHighlight(undefined, "table"),
      }}
      {...interactiveProps({ kind: "table", label: "Seluruh tabel" })}
    >
      <colgroup>
        {widths.map((w, i) => (
          <col key={i} style={{ width: mmToPx(w) }} />
        ))}
      </colgroup>
      <thead>
        {hasMultiLevel ? (
          <>
            <tr
              style={{ height: headerRowHeightPx, ...resolveHighlight(undefined, "header-row") }}
              {...interactiveProps({ kind: "header-row", label: "Baris header tabel" })}
            >
              {(() => {
                const cells: React.ReactNode[] = [];
                let cursor = 0;
                headerGroups.forEach((group, gIdx) => {
                  const groupCols = columns.slice(cursor, cursor + group.colSpan);
                  const allFixed = groupCols.every(c => fixedTypes.has(c.type));
                  if (allFixed) {
                    groupCols.forEach((col) => {
                      const typography = getColumnTypography(documentStyle, col.key);
                      cells.push(
                        <th
                          key={`fixed-${col.key}`}
                          rowSpan={2}
                          style={{
                            ...thStyle(COLORS.header, typography.headerFontSize, getColumnHeaderAlignment(documentStyle, col), { height: headerRowHeightPx * 2 }),
                            padding: paddingMmToCss(CELL_PADDING.headerFixed),
                            ...resolveHighlight(col.key),
                          }}
                          {...interactiveProps({ kind: "column", key: col.key, label: col.label })}
                        >
                          {col.label}
                        </th>
                      );
                    });
                  } else {
                    const groupFontSize = Math.max(...groupCols.map((col) => getColumnTypography(documentStyle, col.key).headerFontSize));
                    cells.push(
                      <th
                        key={`group-${gIdx}`}
                        colSpan={group.colSpan}
                        style={{
                          ...thStyle(group.label ? getHeaderFillCss(group) : COLORS.panelStrong, groupFontSize, "center", { color: group.label ? "#fff" : COLORS.ink }),
                          padding: paddingMmToCss(CELL_PADDING.headerGroup),
                        }}
                      >
                        {group.label}
                      </th>
                    );
                  }
                  cursor += group.colSpan;
                });
                return cells;
              })()}
            </tr>
            <tr
              style={{ height: headerRowHeightPx, ...resolveHighlight(undefined, "header-row") }}
              {...interactiveProps({ kind: "header-row", label: "Baris header tabel" })}
            >
              {columns.map((col, idx) => {
                if (fixedColumnIndexes.has(idx)) return null;
                const typography = getColumnTypography(documentStyle, col.key);
                return (
                  <th
                    key={col.key}
                    style={{
                      ...thStyle(getColBgCss(col), typography.headerFontSize, getColumnHeaderAlignment(documentStyle, col)),
                      ...resolveHighlight(col.key),
                    }}
                    {...interactiveProps({ kind: "column", key: col.key, label: col.label })}
                  >
                    {col.label}
                  </th>
                );
              })}
            </tr>
          </>
        ) : (
          <tr
            style={{ height: headerRowHeightPx, ...resolveHighlight(undefined, "header-row") }}
            {...interactiveProps({ kind: "header-row", label: "Baris header tabel" })}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  ...thStyle(getColBgCss(col), getColumnTypography(documentStyle, col.key).headerFontSize, getColumnHeaderAlignment(documentStyle, col)),
                  ...resolveHighlight(col.key),
                }}
                {...interactiveProps({ kind: "column", key: col.key, label: col.label })}
              >
                {col.label}
              </th>
            ))}
          </tr>
        )}
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr
            key={`row-${rowIndex}`}
            style={{ height: bodyRowHeightPx, ...resolveHighlight(undefined, "body-row") }}
            {...interactiveProps({ kind: "body-row", label: "Baris data tabel" })}
          >
            {columns.map((column) => {
              const typography = getColumnTypography(documentStyle, column.key);
              const isName = column.type === "name";
              return (
                <td
                  key={`${rowIndex}-${column.key}`}
                  style={{
                    border: `${TABLE_LINE.width}mm solid ${rgbToCss(TABLE_LINE.color)}`,
                    padding: paddingMmToCss(isName ? CELL_PADDING.bodyName : CELL_PADDING.bodyDefault),
                    textAlign: getColumnBodyAlignment(documentStyle, column),
                    verticalAlign: "middle",
                    background: rowIndex % 2 === 0 ? COLORS.page : COLORS.panel,
                    color: COLORS.ink,
                    fontSize: pdfEffectiveFontSize(typography.bodyFontSize),
                    fontWeight: ["chapterAvg", "grandAvg", "avgRapor", "rapor"].includes(column.type) ? 700 : 500,
                    overflow: "hidden",
                    ...resolveHighlight(column.key),
                    ...(isName
                      ? { wordBreak: "break-word", overflowWrap: "break-word", lineHeight: 1.2 }
                      : { whiteSpace: "nowrap", textOverflow: "ellipsis" }),
                  }}
                  {...interactiveProps({ kind: "column", key: column.key, label: column.label })}
                >
                  {row[column.key] ?? "-"}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SignaturePreviewCanvas({
  previewFormat,
  draft,
  setDraft,
  previewDate,
  previewData,
  liveEditMode,
  highlightTarget,
  onHighlightTargetChange,
}: SignaturePreviewCanvasProps) {
  const mergedPreview = useMemo<SignaturePreviewData | undefined>(() => {
    if (!previewData) return undefined;
    return {
      ...previewData,
      signature: {
        ...(previewData.signature || {}),
        city: draft.city,
        signers: draft.signers,
        useCustomDate: draft.useCustomDate,
        customDate: draft.customDate,
        fontSize: draft.fontSize,
        showSignatureLine: draft.showSignatureLine,
        signatureLinePosition: draft.signatureLinePosition,
        signatureLineWidth: draft.signatureLineWidth,
        signatureSpacing: draft.signatureSpacing,
        signatureAlignment: draft.signatureAlignment,
        signatureOffsetX: draft.signatureOffsetX,
        signatureOffsetY: draft.signatureOffsetY,
        placementMode: draft.placementMode,
        signaturePreset: draft.signaturePreset,
        manualXPercent: draft.manualXPercent,
        manualYPercent: draft.manualYPercent,
        snapToGrid: draft.snapToGrid,
        gridSizeMm: draft.gridSizeMm,
        lockSignaturePosition: draft.lockSignaturePosition,
        showDebugGuides: draft.showDebugGuides,
      },
      includeSignature: previewData.includeSignature,
    };
  }, [draft, previewData]);

  const layoutPlan = useMemo(() => (mergedPreview ? buildReportLayoutPlanV2(mergedPreview) : null), [mergedPreview]);
  const pageSurfaceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const tableRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [measuredSafeZoneTopMm, setMeasuredSafeZoneTopMm] = useState<Record<number, number>>({});

  useLayoutEffect(() => {
    if (!layoutPlan?.signaturePlacement) {
      setMeasuredSafeZoneTopMm({});
      return;
    }

    const signaturePage = layoutPlan.pages[layoutPlan.signaturePlacement.pageIndex];
    if (!signaturePage) return;

    if (signaturePage.pageType !== "table") {
      setMeasuredSafeZoneTopMm((prev) => {
        const nextTop = signaturePage.tableStartY;
        if (Math.abs((prev[signaturePage.index] ?? -999) - nextTop) < 0.1) return prev;
        return { ...prev, [signaturePage.index]: nextTop };
      });
      return;
    }

    const pageNode = pageSurfaceRefs.current[signaturePage.index];
    const tableNode = tableRefs.current[signaturePage.index];
    if (!pageNode || !tableNode) return;

    let frameId = 0;
    const measure = () => {
      const pageRect = pageNode.getBoundingClientRect();
      const tableRect = tableNode.getBoundingClientRect();
      const nextTop = clamp(
        (tableRect.bottom - pageRect.top) / PX_PER_MM + layoutPlan.metrics.signatureGapMm,
        layoutPlan.metrics.marginTopMm,
        layoutPlan.metrics.pageHeightMm - layoutPlan.metrics.marginBottomMm - layoutPlan.metrics.footerHeightMm,
      );
      setMeasuredSafeZoneTopMm((prev) => {
        if (Math.abs((prev[signaturePage.index] ?? -999) - nextTop) < 0.1) return prev;
        return { ...prev, [signaturePage.index]: nextTop };
      });
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };

    scheduleMeasure();
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(scheduleMeasure) : null;
    resizeObserver?.observe(pageNode);
    resizeObserver?.observe(tableNode);
    window.addEventListener("resize", scheduleMeasure);

    return () => {
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
    };
  }, [layoutPlan]);

  const resolvedSignaturePlacement = useMemo(() => {
    if (!layoutPlan?.signaturePlacement || !mergedPreview?.signature) return layoutPlan?.signaturePlacement ?? null;
    const measuredTop = measuredSafeZoneTopMm[layoutPlan.signaturePlacement.pageIndex];
    if (typeof measuredTop !== "number") return layoutPlan.signaturePlacement;
    return resolveSignaturePlacementFromBounds({
      pageIndex: layoutPlan.signaturePlacement.pageIndex,
      signature: mergedPreview.signature,
      signatureMetrics: {
        widthMm: layoutPlan.signaturePlacement.widthMm,
        heightMm: layoutPlan.signaturePlacement.heightMm,
        safeXMm: 0,
        safeYMm: 0,
        safeWidthMm: 0,
        safeHeightMm: 0,
      },
      pageWidthMm: layoutPlan.metrics.pageWidthMm,
      pageHeightMm: layoutPlan.metrics.pageHeightMm,
      marginLeftMm: layoutPlan.metrics.marginLeftMm,
      marginRightMm: layoutPlan.metrics.marginRightMm,
      marginTopMm: layoutPlan.metrics.marginTopMm,
      marginBottomMm: layoutPlan.metrics.marginBottomMm,
      footerHeightMm: layoutPlan.metrics.footerHeightMm,
      safeZoneTopMm: measuredTop,
    });
  }, [layoutPlan, measuredSafeZoneTopMm, mergedPreview]);

  if (!mergedPreview || !layoutPlan) {
    return <GenericPreview />;
  }

  const pageWidthPx = mmToPx(layoutPlan.metrics.pageWidthMm);
  const pageHeightPx = mmToPx(layoutPlan.metrics.pageHeightMm);

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 12px",
          borderRadius: 14,
          border: `1px solid ${COLORS.border}`,
          background: COLORS.panel,
          color: COLORS.muted,
          fontSize: 11,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span><strong style={{ color: COLORS.ink }}>{layoutPlan.pageLabel}</strong></span>
          <span>{layoutPlan.pages.length} halaman</span>
          <span>{mergedPreview.studentCount} siswa</span>
          <span>{previewFormat.toUpperCase()} mode</span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <span>Mode: <strong style={{ color: COLORS.ink }}>{draft.placementMode === "fixed" ? "Fixed" : draft.placementMode === "flow" ? "Flow" : "Adaptive"}</strong></span>
          <span>Preset: <strong style={{ color: COLORS.ink }}>{(draft.signaturePreset || "bottom-right").replace("bottom-", "bawah ").replace("follow-content", "ikut konten")}</strong></span>
        </div>
      </div>

      {layoutPlan.warnings.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 14,
            border: `1px solid ${COLORS.warningFg}33`,
            background: COLORS.warningBg,
            color: COLORS.warningFg,
            fontSize: 11,
          }}
        >
          {layoutPlan.warnings.map((warning, index) => (
            <div key={`${warning}-${index}`} style={{ display: "flex", alignItems: "flex-start", gap: 6 }}>
              <AlertTriangle size={14} style={{ marginTop: 1, flexShrink: 0 }} />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 12px",
            borderRadius: 14,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.successBg,
            color: COLORS.successFg,
            fontSize: 11,
          }}
        >
          <Sparkles size={14} />
          Preview menggunakan shared metrics identik dengan PDF engine — ukuran font, padding, dan row height presisi 1:1.
        </div>
      )}

      <div style={{ display: "grid", gap: 18 }}>
        {layoutPlan.pages.map((page) => {
          const hasSignature = resolvedSignaturePlacement?.pageIndex === page.index;
          const isTablePage = page.pageType === "table";
          return (
            <section key={`page-${page.index}`} style={{ display: "grid", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", color: COLORS.muted, fontSize: 11 }}>
                <span>Halaman {page.number} / {layoutPlan.pages.length}</span>
                <span>
                  {isTablePage ? (
                    <>
                      Baris {page.bodyStartIndex + 1}-{page.bodyEndIndex + 1}
                      {page.totalSegments > 1 ? ` • Bagian ${page.segmentNumber}/${page.totalSegments}` : ""}
                    </>
                  ) : (
                        "Halaman signature"
                  )}
                </span>
              </div>

              <div
                data-report-export-surface="true"
                ref={(node) => {
                  pageSurfaceRefs.current[page.index] = node;
                }}
                style={{
                  position: "relative",
                  width: pageWidthPx,
                  minHeight: pageHeightPx,
                  background: COLORS.page,
                  borderRadius: 4,
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 22px 38px -32px rgba(15, 23, 42, 0.82)",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: `${mmToPx(layoutPlan.metrics.marginTopMm)}px ${mmToPx(layoutPlan.metrics.marginRightMm)}px ${mmToPx(layoutPlan.metrics.marginBottomMm)}px ${mmToPx(layoutPlan.metrics.marginLeftMm)}px` }}>
                  {page.index === 0 && isTablePage ? (
                    <PreviewHeader data={mergedPreview} />
                  ) : isTablePage ? (
                    <div
                      style={{
                        fontSize: layoutPlan.documentStyle.metaFontSize + 1,
                        fontWeight: 700,
                        color: COLORS.ink,
                        marginBottom: 8,
                      }}
                    >
                      Lanjutan Laporan Nilai Siswa
                      {page.totalSegments > 1 ? ` • Bagian ${page.segmentNumber}/${page.totalSegments}` : ""}
                    </div>
                  ) : null}
                  {isTablePage ? (
                    <div
                      ref={(node) => {
                        tableRefs.current[page.index] = node;
                      }}
                      style={{ marginTop: page.index === 0 ? mmToPx(3.5) : mmToPx(2.5) }}
                    >
                      <TablePreview
                        headerGroups={page.headerGroups}
                        columns={page.columns}
                        widths={page.columnWidthsMm}
                        rows={page.rows}
                        documentStyle={layoutPlan.documentStyle}
                        liveEditMode={liveEditMode}
                        highlightTarget={highlightTarget}
                        onHighlightTargetChange={onHighlightTargetChange}
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        minHeight: mmToPx(layoutPlan.metrics.pageHeightMm - 70),
                      }}
                    />
                  )}
                </div>

                {hasSignature && resolvedSignaturePlacement ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: mmToPx(resolvedSignaturePlacement.safeZone.safeXMm),
                        top: mmToPx(resolvedSignaturePlacement.safeZone.safeYMm),
                        width: mmToPx(resolvedSignaturePlacement.safeZone.safeWidthMm),
                        height: mmToPx(resolvedSignaturePlacement.safeZone.safeHeightMm),
                        border: `1px dashed ${COLORS.safeZoneBorder}`,
                        background: COLORS.safeZone,
                        borderRadius: 16,
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: mmToPx(resolvedSignaturePlacement.safeZone.safeXMm) + 10,
                        top: mmToPx(resolvedSignaturePlacement.safeZone.safeYMm) + 8,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 5,
                        borderRadius: 999,
                        padding: "4px 9px",
                        background: "#dbeafe",
                        color: COLORS.headerStrong,
                        fontSize: 10,
                        fontWeight: 700,
                      }}
                    >
                      <ScanSearch size={12} />
                      {resolvedSignaturePlacement.isOutsideSafeZone ? "Di luar safe zone" : "Safe zone halaman akhir"}
                    </div>
                    {draft.showDebugGuides ? (
                      <div
                        style={{
                          position: "absolute",
                          left: mmToPx(resolvedSignaturePlacement.safeZone.safeXMm),
                          top: mmToPx(resolvedSignaturePlacement.safeZone.safeYMm),
                          width: mmToPx(resolvedSignaturePlacement.safeZone.safeWidthMm),
                          height: mmToPx(resolvedSignaturePlacement.safeZone.safeHeightMm),
                          border: `1px solid ${COLORS.debug}`,
                          pointerEvents: "none",
                        }}
                      />
                    ) : null}
                    <SignatureBlock
                      draft={draft}
                      previewDate={previewDate}
                      placement={resolvedSignaturePlacement}
                      setDraft={setDraft}
                    />
                  </>
                ) : null}

                {/* Footer — matches PDF exactly */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    height: mmToPx(FOOTER.yFromBottom + 4),
                    display: "flex",
                    alignItems: "flex-end",
                    justifyContent: "center",
                    paddingBottom: mmToPx(FOOTER.yFromBottom - 5),
                  }}
                >
                  <div style={{ position: "absolute", left: mmToPx(FOOTER.leftX), bottom: mmToPx(FOOTER.yFromBottom - 5), fontSize: FOOTER.fontSize, color: COLORS.muted }}>
                    {FOOTER.leftText}
                  </div>
                  <div style={{ fontSize: FOOTER.fontSize, color: COLORS.muted }}>
                    Halaman {page.number}/{layoutPlan.pages.length}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

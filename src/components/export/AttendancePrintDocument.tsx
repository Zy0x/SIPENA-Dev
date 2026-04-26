/**
 * AttendancePrintDocument — the SINGLE renderer used by:
 *   • Live preview  (mode="preview")
 *   • Browser print / Save as PDF (mode="print")
 *   • Rasterized capture for one-click PDF/PNG (mode="capture")
 *
 * All sizing derives from `AttendancePrintLayoutPlan`.
 * This component NEVER recomputes layout — it only maps mm → px and renders.
 *
 * Day-column width is DYNAMIC (computed in layout engine to fill the page),
 * so all columns always fit without horizontal scrolling or clipping.
 */

import {
  CSSProperties,
  useCallback,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
import { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";
import { resolveFixedSignaturePositionState } from "@/lib/attendancePdfPreview";
import type {
  AttendancePrintDataset,
  AttendancePrintInfoItem,
  AttendancePrintLayoutPlan,
  AttendancePrintPage,
  AttendancePrintRow,
} from "@/lib/attendancePrintLayout";
import {
  getAttendanceRekapLabel,
  getAttendanceInlineAnnotationStackedSegments,
  resolveAttendanceInlineAnnotationLayout,
} from "@/lib/attendancePrintLayout";
import {
  getSignatureLineSpacing,
  resolveSignatureLinePositionLike,
  resolveSignatureLineWidthMm,
  resolveSignatureSignerBlockWidthMm,
} from "@/lib/signatureLayout";

// ─── Color palette ─────────────────────────────────────────────────────────
const COLORS = {
  page: "#ffffff",
  ink: "#0f172a",
  muted: "#475569",
  border: "#dbe4f0",
  panel: "#f8fafc",
  header: "#2563eb",
  headerDark: "#1d4ed8",
  holiday: "#f59e0b",
  event: "#7c3aed",
};

// Distinct hue per status — Sakit (S) is amber, Libur (L) is slate so they
// can never visually blend together in the rekap row. Synced with the legend
// definition in attendancePrintLayout.ts → DEFAULT_LEGEND.
const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  H: { bg: "#dcfce7", color: "#166534" },
  I: { bg: "#dbeafe", color: "#1d4ed8" },
  S: { bg: "#fef9c3", color: "#854d0e" },
  A: { bg: "#fee2e2", color: "#b91c1c" },
  D: { bg: "#ede9fe", color: "#6d28d9" },
  L: { bg: "#e2e8f0", color: "#475569" },
};

export type AttendancePrintMode = "preview" | "print" | "capture";

export interface AttendancePrintDocumentProps {
  data: AttendancePrintDataset;
  plan: AttendancePrintLayoutPlan;
  signature: SignatureSettingsConfig;
  setSignature?: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  includeSignature: boolean;
  previewDate: string;
  mode: AttendancePrintMode;
}

function getSignatureLinePosition(signature: SignatureSettingsConfig) {
  return resolveSignatureLinePositionLike(signature.signatureLinePosition);
}

function getSignatureLineWidth(signature: SignatureSettingsConfig, signer: SignatureSettingsConfig["signers"][number]) {
  return resolveSignatureLineWidthMm({
    lineLengthMode: signature.signatureLineLengthMode,
    fixedWidthMm: signature.signatureLineWidth,
    name: signer.name,
    nip: signer.nip,
    fontSizePt: signature.fontSize,
  });
}

function getSignatureSignerBlockWidth(signature: SignatureSettingsConfig, signer: SignatureSettingsConfig["signers"][number]) {
  return resolveSignatureSignerBlockWidthMm({
    lineLengthMode: signature.signatureLineLengthMode,
    fixedWidthMm: signature.signatureLineWidth,
    name: signer.name,
    nip: signer.nip,
    fontSizePt: signature.fontSize,
  });
}

// ─── Drag hook ─────────────────────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function useSignatureDrag(
  setSignature: Dispatch<SetStateAction<SignatureSettingsConfig>> | undefined,
  enabled: boolean,
  placement: AttendancePrintLayoutPlan["signaturePlacement"] | null,
) {
  const [isDragging, setIsDragging] = useState(false);
  const dragging = useRef(false);
  const startPt = useRef({ x: 0, y: 0 });
  const startPosition = useRef({ xMm: 0, yMm: 0 });
  const previewScale = useRef(1);

  const endDrag = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!enabled || !setSignature) return;
    dragging.current = true;
    setIsDragging(true);
    startPt.current = { x: e.clientX, y: e.clientY };
    const rect = e.currentTarget.getBoundingClientRect();
    const renderedWidthPx = Math.max(1, rect.width);
    const logicalWidthPx = Math.max(1, e.currentTarget.offsetWidth);
    previewScale.current = renderedWidthPx / logicalWidthPx;
    startPosition.current = {
      xMm: placement?.xMm ?? 0,
      yMm: placement?.yMm ?? 0,
    };
    e.currentTarget.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  }, [enabled, placement, setSignature]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging.current || !setSignature || !placement) return;
    const scale = Math.max(0.01, previewScale.current);
    const dxMm = (e.clientX - startPt.current.x) / (PX_PER_MM * scale);
    const dyMm = (e.clientY - startPt.current.y) / (PX_PER_MM * scale);
    const nextX = startPosition.current.xMm + dxMm;
    const nextY = startPosition.current.yMm + dyMm;
    setSignature((prev) => ({
      ...prev,
      ...resolveFixedSignaturePositionState({
        placement,
        xMm: nextX,
        yMm: nextY,
        snapToGrid: prev.snapToGrid,
        gridSizeMm: prev.gridSizeMm,
      }),
    }));
  }, [placement, setSignature]);

  return enabled
    ? { isDragging, onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onLostPointerCapture: endDrag }
    : { isDragging };
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function mm(v: number) { return v * PX_PER_MM; }

function justify(a: SignatureSettingsConfig["signatureAlignment"]): CSSProperties["justifyContent"] {
  return a === "left" ? "flex-start" : a === "center" ? "center" : "flex-end";
}
function textAlign(a: SignatureSettingsConfig["signatureAlignment"]): CSSProperties["textAlign"] {
  return a === "left" ? "left" : a === "center" ? "center" : "right";
}

function resolveCompactFontPx(widthMm: number, baseFontPx: number, thresholds: { soft: number; hard: number }) {
  if (widthMm <= thresholds.hard) return Math.max(baseFontPx - 2.2, baseFontPx * 0.74);
  if (widthMm <= thresholds.soft) return Math.max(baseFontPx - 1.1, baseFontPx * 0.86);
  return baseFontPx;
}

// ─── Main component ────────────────────────────────────────────────────────
export function AttendancePrintDocument({
  data,
  plan,
  signature,
  setSignature,
  includeSignature,
  previewDate,
  mode,
}: AttendancePrintDocumentProps) {
  const isPreview = mode === "preview";
  const dragEnabled = isPreview && !!setSignature && !signature.lockSignaturePosition;
  const dragState = useSignatureDrag(setSignature, dragEnabled, plan.signaturePlacement);
  const { isDragging, ...dragHandlers } = dragState;

  const visibleSigners = useMemo(() => {
    const f = signature.signers.filter((s) => s.name.trim() || s.title.trim());
    return f.length > 0 ? f : signature.signers.slice(0, 1);
  }, [signature.signers]);

  const justifyContent = justify(signature.signatureAlignment);
  const tAlign = textAlign(signature.signatureAlignment);

  // ── Layout metrics → px ─────────────────────────────────────────────────
  const pageW   = mm(plan.paper.pageWidthMm);
  const pageH   = mm(plan.paper.pageHeightMm);
  const mLeft   = mm(plan.paper.marginLeftMm);
  const mRight  = mm(plan.paper.marginRightMm);
  const mTop    = mm(plan.paper.marginTopMm);
  const mBottom = mm(plan.paper.marginBottomMm);

  // pt → px: 1pt = 1.333px  (96dpi / 72pt)
  const PT = 1.333;
  const headerFontPx = plan.table.headerFontPt * PT;
  const dayHeaderFontPx = plan.table.dayHeaderFontPt * PT;
  const dayDateFontPx = plan.table.dayDateFontPt * PT;
  const bodyFontPx   = plan.table.bodyFontPt   * PT;
  const metaFontPx   = plan.table.metaFontPt   * PT;
  const titleFontPx  = plan.table.titleFontPt  * PT;
  const bannerHeight = mm(plan.shell.topBanner - 2);
  const bannerBottomGap = mm(plan.shell.contentPaddingY + 2);

  const headerRowH = mm(plan.table.headerRowHeightMm);
  const bodyRowH   = mm(plan.table.bodyRowHeightMm);
  const summaryRowH = mm(plan.table.summaryRowHeightMm);
  const padPx      = mm(plan.table.bodyCellPaddingMm);

  const noW    = plan.table.noWidthMm    > 0 ? mm(plan.table.noWidthMm)    : undefined;
  const nameW  = plan.table.nameWidthMm  > 0 ? mm(plan.table.nameWidthMm)  : undefined;
  const nisnW  = plan.table.nisnWidthMm  > 0 ? mm(plan.table.nisnWidthMm)  : undefined;
  const dayW   = mm(plan.table.dayWidthMm);
  const rekapW = mm(plan.table.rekapWidthMm);
  const tableW = mm(plan.table.tableWidthMm);
  const rekapHeaderFontPx = resolveCompactFontPx(plan.table.rekapWidthMm, headerFontPx, { soft: 6.1, hard: 5.3 });
  const rekapBodyFontPx = resolveCompactFontPx(plan.table.rekapWidthMm, bodyFontPx, { soft: 6.1, hard: 5.3 });
  const nisnBodyFontPx = resolveCompactFontPx(plan.table.nisnWidthMm, bodyFontPx, { soft: 14.2, hard: 12.6 });

  // Page rendering
  const sheetShadow  = isPreview ? "0 18px 40px -30px rgba(15,23,42,0.8)" : "none";
  const sheetBorder  = isPreview ? `1px solid ${COLORS.border}` : "none";
  const sheetRadius  = isPreview ? 18 : 0;
  const sheetOverflow: CSSProperties["overflow"] = "hidden";

  const visSet = plan.visibleColumnKeys;
  const inlineAnnotationColumns = useMemo(() => new Set(
    plan.inlineAnnotations.flatMap((annotation) => {
      const keys: string[] = [];
      for (let index = annotation.startColumnIndex; index <= annotation.endColumnIndex; index += 1) {
        const day = plan.visibleDays[index];
        if (day) keys.push(day.key);
      }
      return keys;
    }),
  ), [plan.inlineAnnotations, plan.visibleDays]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="attendance-print-root"
      data-attendance-print-root="true"
      data-fit-mode={plan.fit.mode}
      style={{ display: "grid", gap: isPreview ? 18 : 0, width: pageW }}
    >
      {plan.pages.map((page) => {
        const segmentRows = plan.rows.slice(page.rowStart, page.rowEnd);
        const segmentRowHeights = page.rowHeightsMm.map((height) => mm(height));
        const summaryContent = page.summaryContent;

        return (
          <div
            key={page.key}
            data-attendance-print-page="true"
            data-page-number={page.pageNumber}
            data-page-width-mm={plan.paper.pageWidthMm}
            data-page-height-mm={plan.paper.pageHeightMm}
            className="attendance-print-sheet"
            style={{
              width: pageW,
              minHeight: pageH,
              maxWidth: pageW,
              boxSizing: "border-box",
              background: COLORS.page,
              border: sheetBorder,
              borderRadius: sheetRadius,
              boxShadow: sheetShadow,
              overflow: sheetOverflow,
              fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              position: "relative",
              breakInside: "avoid",
              pageBreakInside: "avoid",
              breakAfter: page.isLastPage ? "auto" : "page",
              pageBreakAfter: page.isLastPage ? "auto" : "always",
              padding: `${mTop}px ${mRight}px ${mBottom}px ${mLeft}px`,
              display: "flex",
              flexDirection: "column",
              color: COLORS.ink,
            }}
          >
            {/* ── Unified Banner (single clean header) ───────────────────
                 Berisi: Judul, Kelas, Bulan, dan info ringkas (siswa | hari efektif | format hari).
                 Timestamp ekspor & nomor halaman pindah ke footer.
                 Sinkron 1:1 dengan drawPageHeader() di attendancePdfExport.ts. */}
            <div
              className="attendance-print-banner"
              style={{
                position: "relative",
                height: bannerHeight,
                background: `linear-gradient(135deg, ${COLORS.header}, ${COLORS.headerDark})`,
                color: "#fff",
                borderRadius: mm(2.2),
                flexShrink: 0,
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                marginBottom: bannerBottomGap,
                overflow: "hidden",
              }}
            >
              <div style={{
                position: "absolute",
                left: mm(3.5),
                top: mm(3.2),
                fontSize: titleFontPx,
                fontWeight: 800,
                lineHeight: 1.1,
                letterSpacing: 0.2,
              }}>
                  REKAP PRESENSI BULANAN
              </div>
              <div style={{
                position: "absolute",
                right: mm(3),
                top: mm(3),
                fontSize: metaFontPx + 1.2,
                fontWeight: 700,
                lineHeight: 1.1,
                textAlign: "right",
                padding: `${mm(0.6)}px ${mm(1.6)}px`,
                background: "rgba(255,255,255,0.18)",
                borderRadius: mm(1.2),
                whiteSpace: "nowrap",
              }}>
                Kelas {data.className}
              </div>

              <div style={{
                position: "absolute",
                left: mm(3.5),
                bottom: mm(2.8),
                fontSize: metaFontPx + 1.2,
                fontWeight: 600,
                opacity: 0.96,
                lineHeight: 1.1,
              }}>
                {data.monthLabel}
              </div>

              <div style={{
                position: "absolute",
                right: mm(3),
                bottom: mm(2.2),
                display: "flex",
                alignItems: "center",
                gap: mm(1.2),
                flexWrap: "nowrap",
              }}>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: metaFontPx, fontWeight: 600,
                  padding: `${mm(0.5)}px ${mm(1.4)}px`,
                  background: "rgba(255,255,255,0.16)", borderRadius: 999,
                  whiteSpace: "nowrap",
                }}>
                  <strong style={{ fontWeight: 800 }}>{plan.rows.length}</strong>&nbsp;siswa
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: metaFontPx, fontWeight: 600,
                  padding: `${mm(0.5)}px ${mm(1.4)}px`,
                  background: "rgba(255,255,255,0.16)", borderRadius: 999,
                  whiteSpace: "nowrap",
                }}>
                  <strong style={{ fontWeight: 800 }}>{data.effectiveDays}</strong>&nbsp;hari efektif
                </span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: metaFontPx, fontWeight: 600,
                  padding: `${mm(0.5)}px ${mm(1.4)}px`,
                  background: "rgba(255,255,255,0.16)", borderRadius: 999,
                  whiteSpace: "nowrap",
                }}>
                  {data.workDayFormatLabel}
                </span>
              </div>
            </div>

            {/* ── Table ──────────────────────────────────────────────────── */}
            {/* 
              tableLayout: fixed + explicit width on every <col> ensures
              columns never overflow or collapse — all day columns fit in 1 page. 
            */}
            {page.kind === "table" ? (
            <div
              style={{
                width: "100%",
                overflow: "hidden",
                flexShrink: 0,
                borderRadius: mm(1.6),
                border: `1px solid ${COLORS.border}`,
                background: COLORS.page,
                position: "relative",
              }}
            >
              <table
                className="attendance-print-table"
                style={{
                  width: tableW,
                  minWidth: tableW,
                  maxWidth: tableW,
                  borderCollapse: "collapse",
                  tableLayout: "fixed",
                  fontSize: bodyFontPx,
                  color: COLORS.ink,
                }}
              >
                <colgroup>
                  {visSet.has("no")   && noW   ? <col style={{ width: noW }}   /> : null}
                  {visSet.has("name") && nameW  ? <col style={{ width: nameW }} /> : null}
                  {visSet.has("nisn") && nisnW  ? <col style={{ width: nisnW }} /> : null}
                  {plan.visibleDays.map((day) => (
                    <col key={`col-${day.key}`} style={{ width: dayW }} />
                  ))}
                  {plan.visibleRekapKeys.map((k) => (
                    <col key={`col-rekap-${k}`} style={{ width: rekapW }} />
                  ))}
                </colgroup>

                <thead>
                  {/* Row 1: fixed col headers (rowSpan=2) + day abbreviations */}
                  <tr>
                    {visSet.has("no") && noW ? (
                      <th rowSpan={2} style={thStyle(noW, headerFontPx, headerRowH * 2, padPx)}>No</th>
                    ) : null}
                    {visSet.has("name") && nameW ? (
                      <th rowSpan={2} style={{ ...thStyle(nameW, headerFontPx, headerRowH * 2, padPx), textAlign: "left", paddingLeft: padPx + 2 }}>Nama</th>
                    ) : null}
                    {visSet.has("nisn") && nisnW ? (
                      <th rowSpan={2} style={{ ...thStyle(nisnW, headerFontPx, headerRowH * 2, padPx), whiteSpace: "nowrap" }}>NISN</th>
                    ) : null}

                    {plan.visibleDays.map((day) => {
                      const bg = day.isHoliday ? COLORS.holiday : day.hasEvent ? COLORS.event : COLORS.header;
                      const abbr = day.dayName.slice(0, 3);
                      return (
                        <th
                          key={`h1-${day.key}`}
                          style={{
                            ...thStyle(dayW, dayHeaderFontPx, headerRowH, padPx * 0.35),
                            background: bg,
                            padding: "1px 0.4px",
                          }}
                          title={day.dayName}
                        >
                          <span style={{ display: "block", lineHeight: 1 }}>{abbr}</span>
                        </th>
                      );
                    })}

                    {plan.visibleRekapKeys.map((k) => (
                      <th
                        key={`h1-rekap-${k}`}
                        rowSpan={2}
                        style={thStyle(rekapW, rekapHeaderFontPx, headerRowH * 2, padPx * 0.62)}
                      >
                        {getAttendanceRekapLabel(k)}
                      </th>
                    ))}
                  </tr>

                  {/* Row 2: date numbers */}
                  <tr>
                    {plan.visibleDays.map((day) => {
                      const bg = day.isHoliday ? "#fbbf24" : day.hasEvent ? "#8b5cf6" : "#3b82f6";
                      return (
                        <th
                          key={`h2-${day.key}`}
                          style={{
                            ...thStyle(dayW, dayDateFontPx, headerRowH, padPx * 0.35),
                            background: bg,
                            padding: "1px 0.4px",
                          }}
                        >
                          {day.dateLabel}
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody>
                  {segmentRows.map((row, ri) => renderRow(
                    row,
                    ri,
                    bodyFontPx,
                    nisnBodyFontPx,
                    rekapBodyFontPx,
                    segmentRowHeights[ri] ?? bodyRowH,
                    padPx,
                    plan,
                    visSet,
                    inlineAnnotationColumns,
                  ))}
                  {page.hasSummaryRows ? renderTotalRow(plan, bodyFontPx, rekapBodyFontPx, summaryRowH, padPx, visSet) : null}
                  {page.hasSummaryRows ? renderPercentRow(plan, data, bodyFontPx, rekapBodyFontPx, summaryRowH, padPx, visSet) : null}
                </tbody>
              </table>
              {plan.annotationDisplayMode === "inline-vertical" ? (
                <InlineAnnotationOverlay
                  page={page}
                  plan={plan}
                  headerHeightMm={plan.table.headerRowHeightMm * 2}
                />
              ) : null}
            </div>
            ) : null}

            {/* ── Summary / Signature (last page only) ───────────────────── */}
            {page.showSummary ? (
              <div
                className="attendance-print-summary"
                style={{ marginTop: mm(plan.shell.summaryGap), display: "grid", gap: mm(plan.shell.infoBlockGap), flexShrink: 0 }}
              >
                {summaryContent?.showLegend ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: mm(1.5), fontSize: metaFontPx }}>
                    {plan.summary.legend.map((item) => (
                      <span
                        key={item.label}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          width: "fit-content",
                          maxWidth: "100%",
                          gap: 3,
                          padding: `${mm(0.5)}px ${mm(1.2)}px`,
                          borderRadius: 999,
                          background: item.bg, color: item.color,
                          border: `1px solid ${COLORS.border}`, fontWeight: 600,
                          boxSizing: "border-box",
                        }}
                      >
                        {item.label} = {item.description}
                      </span>
                    ))}
                  </div>
                ) : null}

                {summaryContent?.keteranganItems.length ? (
                  <InfoBlock
                    title={summaryContent.keteranganTitle ?? "Keterangan"}
                    items={summaryContent.keteranganItems}
                    fontSize={summaryContent.keteranganFontPt * PT}
                    accentColor="#0369a1"
                    accentBg="#f0f9ff"
                  />
                ) : null}
                {summaryContent?.notesItems.length ? (
                  <InfoBlock
                    title={summaryContent.notesTitle ?? "Catatan Siswa"}
                    items={summaryContent.notesItems}
                    fontSize={summaryContent.notesFontPt * PT}
                  />
                ) : null}

                {includeSignature && page.drawSignatureHere && (summaryContent?.reservedSignatureHeightMm ?? plan.summaryLayout.signatureZoneHeightMm) > 0 ? (
                  <div style={{ minHeight: mm(summaryContent?.reservedSignatureHeightMm ?? plan.summaryLayout.signatureZoneHeightMm) }} />
                ) : null}
              </div>
            ) : !page.isSignatureOnlyPage && page.kind === "table" ? (
              <div style={{
                marginTop: mm(1.5), fontSize: metaFontPx, color: COLORS.muted,
                textAlign: "center", flexShrink: 0,
              }}>
                Lanjutan tabel presensi — ringkasan ditampilkan pada halaman terakhir.
              </div>
            ) : (
              <div style={{ flex: 1 }} />
            )}

            {/* ── Footer ─────────────────────────────────────────────────── */}
            {includeSignature && page.drawSignatureHere && plan.signaturePlacement ? (
              <>
                {isPreview && dragEnabled && isDragging ? (
                  <>
                    <div
                      style={{
                        position: "absolute",
                        left: mm(plan.signaturePlacement.movementBounds.safeXMm),
                        top: mm(plan.signaturePlacement.movementBounds.safeYMm),
                        width: mm(plan.signaturePlacement.movementBounds.safeWidthMm),
                        height: mm(plan.signaturePlacement.movementBounds.safeHeightMm),
                        border: "1px dashed rgba(37,99,235,0.22)",
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: mm(plan.signaturePlacement.safeZone.safeXMm),
                        top: mm(plan.signaturePlacement.safeZone.safeYMm),
                        width: mm(plan.signaturePlacement.safeZone.safeWidthMm),
                        height: mm(plan.signaturePlacement.safeZone.safeHeightMm),
                        border: "1px dashed rgba(22,163,74,0.55)",
                        background: "rgba(220,252,231,0.18)",
                        borderRadius: mm(2),
                        zIndex: 1,
                        pointerEvents: "none",
                      }}
                    />
                    <div
                      style={{
                        position: "absolute",
                        left: mm(plan.signaturePlacement.safeZone.safeXMm),
                        top: Math.max(mm(plan.signaturePlacement.safeZone.safeYMm) - 18, mm(plan.paper.marginTopMm)),
                        padding: "2px 8px",
                        borderRadius: 999,
                        background: "rgba(22,163,74,0.92)",
                        color: "#fff",
                        fontSize: metaFontPx * 0.82,
                        fontWeight: 700,
                        zIndex: 2,
                        pointerEvents: "none",
                      }}
                    >
                      Zona aman TTD
                    </div>
                  </>
                ) : null}

                <div
                  {...dragHandlers}
                  className="attendance-print-signature"
                  style={{
                    position: "absolute",
                    left: mm(plan.signaturePlacement.xMm),
                    top: mm(plan.signaturePlacement.yMm),
                    width: mm(plan.signaturePlacement.widthMm),
                    cursor: dragEnabled ? (isDragging ? "grabbing" : "grab") : "default",
                    touchAction: dragEnabled ? "none" : "auto",
                    padding: 0,
                    borderRadius: mm(3),
                    border: dragEnabled ? `1px dashed ${COLORS.header}` : "none",
                    background: isDragging ? "rgba(239,246,255,0.72)" : "transparent",
                    userSelect: "none",
                    boxSizing: "border-box",
                    zIndex: 2,
                  }}
        title={dragEnabled ? "Seret untuk memindahkan signature di dalam batas margin kertas" : undefined}
                >
                  <div style={{ textAlign: tAlign, color: COLORS.ink, fontSize: (signature.fontSize ?? 10) + 1 }}>
                    {signature.city || "[Kota]"}, {previewDate}
                  </div>
                  <div style={{
                    display: "flex", justifyContent,
                    gap: Math.max(mm(6), (signature.signatureSpacing ?? 15) * PX_PER_MM),
                    flexWrap: "wrap", marginTop: mm(1.5),
                  }}>
                    {visibleSigners.map((signer, idx) => {
                      const signerBlockWidthPx = Math.max(mm(24), mm(getSignatureSignerBlockWidth(signature, signer)));
                      const signerLineWidthPx = mm(getSignatureLineWidth(signature, signer));
                      return (
                      <div
                        key={signer.id || `${signer.name}-${idx}`}
                        style={{
                          width: signerBlockWidthPx,
                          textAlign: "center", color: COLORS.ink,
                          fontSize: signature.fontSize ?? 10,
                        }}
                      >
                        <div>{signer.title || "Guru Mata Pelajaran"}</div>
                        <div style={{ height: mm(14) }} />
                        {signature.showSignatureLine && getSignatureLinePosition(signature) === "above-name" && (
                          <div style={{
                            width: signerLineWidthPx,
                            borderBottom: `1px solid ${COLORS.ink}`,
                            margin: `0 auto ${mm(getSignatureLineSpacing(getSignatureLinePosition(signature)).aboveNameLineGapMm)}px`,
                          }} />
                        )}
                        <div style={{ fontWeight: 700, lineHeight: 1.05 }}>{signer.name || "[Nama Signer]"}</div>
                        {signature.showSignatureLine && getSignatureLinePosition(signature) === "between-name-and-nip" && signer.nip ? (
                          <div style={{ position: "relative", width: signerLineWidthPx, height: mm(getSignatureLineSpacing(getSignatureLinePosition(signature)).nameToLineGapMm + getSignatureLineSpacing(getSignatureLinePosition(signature)).lineToNipGapMm), margin: "0 auto" }}>
                            <div style={{ position: "absolute", left: 0, right: 0, top: mm(getSignatureLineSpacing(getSignatureLinePosition(signature)).nameToLineGapMm), borderBottom: `1px solid ${COLORS.ink}` }} />
                          </div>
                        ) : null}
                        {signature.showSignatureLine && getSignatureLinePosition(signature) === "between-name-and-nip" && !signer.nip ? (
                          <div style={{
                            width: signerLineWidthPx,
                            borderBottom: `1px solid ${COLORS.ink}`,
                            margin: `${mm(getSignatureLineSpacing(getSignatureLinePosition(signature)).aboveNameLineGapMm)}px auto 0`,
                          }} />
                        ) : null}
                        {signer.nip ? (
                          <div style={{ color: COLORS.muted, fontSize: Math.max(9, (signature.fontSize ?? 10) - 1), lineHeight: 1.05, marginTop: mm(signature.showSignatureLine && getSignatureLinePosition(signature) === "between-name-and-nip" ? 0 : getSignatureLineSpacing(getSignatureLinePosition(signature)).nameToNipGapMm) }}>
                            NIP. {signer.nip}
                          </div>
                        ) : null}
                      </div>
                      );
                    })}
                  </div>
                </div>
                {dragEnabled ? (
                  <div
                    style={{
                      position: "absolute",
                      left: mm(plan.signaturePlacement.xMm),
                      top: Math.max(mm(plan.signaturePlacement.yMm) - mm(3.2), mm(plan.paper.marginTopMm)),
                      width: mm(plan.signaturePlacement.widthMm),
                      display: "flex",
                      justifyContent: "flex-end",
                      zIndex: 3,
                    }}
                  >
                    <button
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSignature?.((prev) => ({
                          ...prev,
                          placementMode: "adaptive",
                          signatureOffsetX: 0,
                          signatureOffsetY: 0,
                          manualXPercent: null,
                          manualYPercent: null,
                          signaturePageIndex: null,
                        }));
                      }}
                      style={{
                        borderRadius: 999,
                        background: "rgba(255,255,255,0.96)",
                        border: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        padding: "2px 8px",
                        fontSize: metaFontPx * 0.78,
                        fontWeight: 600,
                        cursor: "pointer",
                        boxShadow: "0 2px 8px rgba(15,23,42,0.08)",
                      }}
        title="Kembalikan signature ke posisi default tepat di bawah legend"
                    >
                      Reset posisi
                    </button>
                  </div>
                ) : null}
              </>
            ) : null}

            <div
              className="attendance-print-footer"
              style={{
                marginTop: "auto",
                paddingTop: mm(1.2),
                borderTop: `1px solid ${COLORS.border}`,
                fontSize: metaFontPx - 0.8,
                color: COLORS.muted,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: mm(2),
                fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
              }}
            >
              <span>SIPENA — Dokumen Presensi · {data.exportTimeLabel}</span>
              <span style={{ fontWeight: 600, color: COLORS.ink }}>Halaman {page.pageNumber}/{plan.pages.length}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Row renderers ─────────────────────────────────────────────────────────
function InlineAnnotationOverlay({
  page,
  plan,
  headerHeightMm,
}: {
  page: AttendancePrintPage;
  plan: AttendancePrintLayoutPlan;
  headerHeightMm: number;
}) {
  if (plan.annotationDisplayMode !== "inline-vertical" || page.kind !== "table" || plan.inlineAnnotations.length === 0) {
    return null;
  }

  const paletteByTone = {
    national: { color: "#1d4ed8", bg: "rgba(219,234,254,0.28)", border: "rgba(29,78,216,0.38)" },
    custom: { color: "#b45309", bg: "rgba(254,243,199,0.34)", border: "rgba(180,83,9,0.32)" },
    event: { color: "#6d28d9", bg: "rgba(237,233,254,0.36)", border: "rgba(109,40,217,0.32)" },
  } as const;
  const fixedColumnsWidthMm = (
    (plan.visibleColumnKeys.has("no") ? plan.table.noWidthMm : 0)
    + (plan.visibleColumnKeys.has("name") ? plan.table.nameWidthMm : 0)
    + (plan.visibleColumnKeys.has("nisn") ? plan.table.nisnWidthMm : 0)
  );
  const bodyHeightMm = page.rowHeightsMm.reduce((sum, value) => sum + value, 0) + (page.hasSummaryRows ? plan.table.summaryRowHeightMm * 2 : 0);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {plan.inlineAnnotations.map((annotation) => {
        const palette = paletteByTone[annotation.tone];
        const leftMm = fixedColumnsWidthMm + (annotation.startColumnIndex * plan.table.dayWidthMm);
        const widthMm = (annotation.endColumnIndex - annotation.startColumnIndex + 1) * plan.table.dayWidthMm;
        const labelLayout = resolveAttendanceInlineAnnotationLayout({
          text: annotation.text,
          labelStyle: plan.inlineLabelStyle,
          widthMm,
          heightMm: bodyHeightMm,
        });

        return (
          <div
            key={`${page.key}-${annotation.key}`}
            style={{
              position: "absolute",
              left: mm(leftMm),
              top: mm(headerHeightMm),
              width: mm(widthMm),
              height: mm(bodyHeightMm),
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: mm(1.2),
              border: `1px dashed ${palette.border}`,
              background: palette.bg,
              overflow: "hidden",
            }}
          >
            {plan.inlineLabelStyle === "rotate-90" ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    color: palette.color,
                    fontSize: labelLayout.fontPx,
                    fontWeight: 700,
                    lineHeight: 1,
                    display: "inline-block",
                    whiteSpace: "nowrap",
                    textAlign: "center",
                    letterSpacing: 0.2,
                    transform: "rotate(-90deg)",
                    transformOrigin: "center center",
                  }}
                >
                  {labelLayout.text}
                </div>
              </div>
            ) : (
              <div
                style={{
                  color: palette.color,
                  fontSize: labelLayout.fontPx,
                  fontWeight: 700,
                  textAlign: "center",
                  letterSpacing: 0,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {getAttendanceInlineAnnotationStackedSegments(annotation.text).map((segment, index) => (
                  <div
                    key={`${annotation.key}-stacked-${index}`}
                    style={{
                      minHeight: segment.kind === "gap"
                        ? `${labelLayout.gapLineHeightPx ?? labelLayout.lineHeightPx * 0.5}px`
                        : `${labelLayout.lineHeightPx}px`,
                      lineHeight: `${segment.kind === "gap"
                        ? (labelLayout.gapLineHeightPx ?? labelLayout.lineHeightPx * 0.5)
                        : labelLayout.lineHeightPx}px`,
                    }}
                  >
                    {segment.text}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderRow(
  row: AttendancePrintRow,
  ri: number,
  bodyFontPx: number,
  nisnFontPx: number,
  rekapFontPx: number,
  bodyRowH: number,
  padPx: number,
  plan: AttendancePrintLayoutPlan,
  visSet: Set<string>,
  inlineAnnotationColumns: Set<string>,
) {
  const altBg = ri % 2 === 0 ? COLORS.page : COLORS.panel;
  return (
    <tr key={row.id} style={{ breakInside: "avoid", pageBreakInside: "avoid" }}>
      {visSet.has("no") && plan.table.noWidthMm > 0 && (
        <td style={tdStyle("center", bodyFontPx, bodyRowH, padPx, altBg)}>{row.number}</td>
      )}
      {visSet.has("name") && plan.table.nameWidthMm > 0 && (
        <td style={{
          ...tdStyle("left", bodyFontPx, bodyRowH, padPx, altBg),
          whiteSpace: "normal", wordBreak: "break-word", overflowWrap: "anywhere",
          paddingLeft: padPx + 2, lineHeight: 1.2,
        }}>
          {row.name}
        </td>
      )}
      {visSet.has("nisn") && plan.table.nisnWidthMm > 0 && (
        <td style={{
          ...tdStyle("center", nisnFontPx, bodyRowH, padPx, altBg),
          whiteSpace: "nowrap",
          wordBreak: "normal",
          overflowWrap: "normal",
        }}>{row.nisn}</td>
      )}
      {row.cells.map((cell, ci) => {
        const day = plan.visibleDays[ci];
        if (!day) return null;
        const status = STATUS_COLORS[cell.value];
        const hideCellValue = plan.annotationDisplayMode === "inline-vertical" && inlineAnnotationColumns.has(day.key);
        return (
          <td
            key={`${row.id}-${day.key}`}
            style={{
              ...tdStyle("center", bodyFontPx, bodyRowH, padPx, altBg),
              background: status?.bg ?? (cell.isHoliday ? "#fff7ed" : altBg),
              color: status?.color ?? COLORS.ink,
              fontWeight: cell.value !== "-" ? 700 : 400,
              padding: "1px 0.6px",
            }}
          >
            {!hideCellValue && cell.value !== "-" ? cell.value : ""}
          </td>
        );
      })}
      {plan.visibleRekapKeys.map((k) => {
        const status = STATUS_COLORS[k === "total" ? "" : k];
        return (
          <td
            key={`${row.id}-rekap-${k}`}
            style={{
              ...tdStyle("center", bodyFontPx, bodyRowH, padPx, altBg),
              fontSize: rekapFontPx,
              background: status?.bg ?? altBg,
              color: status?.color ?? COLORS.ink,
              fontWeight: k === "total" ? 700 : 600,
              padding: "1px 0.8px",
            }}
          >
            {row.totals[k]}
          </td>
        );
      })}
    </tr>
  );
}

function renderTotalRow(
  plan: AttendancePrintLayoutPlan,
  labelFontPx: number,
  rekapFontPx: number,
  bodyRowH: number,
  padPx: number,
  visSet: Set<string>,
) {
  const fixedCols
    = (visSet.has("no")   && plan.table.noWidthMm   > 0 ? 1 : 0)
    + (visSet.has("name") && plan.table.nameWidthMm  > 0 ? 1 : 0)
    + (visSet.has("nisn") && plan.table.nisnWidthMm  > 0 ? 1 : 0);
  const dayCols = plan.visibleDays.length;
  // Use a tighter font for very narrow rekap columns to prevent overflow
  const rekapCellFont = Math.min(rekapFontPx, plan.table.rekapWidthMm * 1.05);
  return (
    <tr>
      {fixedCols > 0 && (
        <td colSpan={fixedCols} style={{ ...tdStyle("center", labelFontPx, bodyRowH, padPx, "#e2e8f0"), fontWeight: 800, color: "#1e293b", letterSpacing: 0.4 }}>
          {plan.summaryRows.totalLabel}
        </td>
      )}
      {dayCols > 0 && (
        <td colSpan={dayCols} style={{ ...tdStyle("center", labelFontPx, bodyRowH, padPx, "#e2e8f0"), padding: "1px 0" }} />
      )}
      {plan.visibleRekapKeys.map((k) => (
        <td key={`tot-${k}`} style={{
          ...tdStyle("center", rekapCellFont, bodyRowH, padPx, "#e2e8f0"),
          fontWeight: 800, color: "#1e293b",
          padding: "1px 0.5px",
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          {plan.totals[k]}
        </td>
      ))}
    </tr>
  );
}

function renderPercentRow(
  plan: AttendancePrintLayoutPlan,
  _data: AttendancePrintDataset,
  labelFontPx: number,
  rekapFontPx: number,
  bodyRowH: number,
  padPx: number,
  visSet: Set<string>,
) {
  const fixedCols
    = (visSet.has("no")   && plan.table.noWidthMm   > 0 ? 1 : 0)
    + (visSet.has("name") && plan.table.nameWidthMm  > 0 ? 1 : 0)
    + (visSet.has("nisn") && plan.table.nisnWidthMm  > 0 ? 1 : 0);
  const dayCols = plan.visibleDays.length;
  // Percentage strings like '98,6%' can be 5+ chars — scale font to fit column
  const rekapCellFont = Math.min(rekapFontPx, plan.table.rekapWidthMm * 1.05);
  return (
    <tr>
      {fixedCols > 0 && (
        <td colSpan={fixedCols} style={{ ...tdStyle("center", labelFontPx, bodyRowH, padPx, "#dbeafe"), fontWeight: 800, color: "#1e3a8a", letterSpacing: 0.4 }}>
          {plan.summaryRows.percentLabel}
        </td>
      )}
      {dayCols > 0 && (
        <td colSpan={dayCols} style={{ ...tdStyle("center", labelFontPx, bodyRowH, padPx, "#dbeafe"), padding: "1px 0" }} />
      )}
      {plan.visibleRekapKeys.map((k) => (
        <td key={`pct-${k}`} style={{
          ...tdStyle("center", rekapCellFont, bodyRowH, padPx, "#dbeafe"),
          fontWeight: 800, color: "#1e3a8a",
          padding: "1px 0.5px",
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          {plan.summaryRows.percentageByKey[k]}
        </td>
      ))}
    </tr>
  );
}

// ─── Cell style helpers ────────────────────────────────────────────────────
function thStyle(
  width: number,
  fontSize: number,
  height: number,
  padPx: number,
  bg?: string,
): CSSProperties {
  return {
    width, minWidth: width, maxWidth: width,
    height, minHeight: height,
    border: `1px solid ${COLORS.headerDark}`,
    background: bg ?? COLORS.header,
    color: "#fff",
    padding: `${padPx * 0.6}px ${padPx * 0.5}px`,
    fontSize, fontWeight: 700,
    textAlign: "center", verticalAlign: "middle",
    lineHeight: 1.15,
    boxSizing: "border-box",
  };
}

function tdStyle(
  align: CSSProperties["textAlign"],
  fontSize: number,
  height: number,
  padPx: number,
  background: string,
): CSSProperties {
  return {
    border: `1px solid ${COLORS.border}`,
    padding: `${padPx * 0.5}px ${padPx}px`,
    fontSize, textAlign: align,
    color: COLORS.ink, background,
    verticalAlign: "middle",
    minHeight: height,
    lineHeight: 1.2,
    boxSizing: "border-box",
  };
}

function splitInfoBlockTitle(title: string) {
  const match = title.match(/^(.*?)\s*\((.+)\)$/);
  if (!match) return { main: title, suffix: null as string | null };
  return {
    main: match[1]?.trim() || title,
    suffix: match[2]?.trim() || null,
  };
}

function splitInfoBlockText(text: string) {
  const match = text.match(/^\s*(.+?)\s+[—-]\s+(.+?)\s*$/);
  if (!match) return { lead: null as string | null, body: text };
  return {
    lead: match[1]?.trim() || null,
    body: match[2]?.trim() || text,
  };
}

// ─── Info block ────────────────────────────────────────────────────────────
/**
 * Two-column grid layout so items wrap side-by-side.
 * Falls back to single column when there are <= 2 items.
 * Handles gracefully large lists by capping at 20 items shown.
 * accentColor/accentBg allow visual distinction per block type.
 */
function InfoBlock({
  title,
  items,
  fontSize,
  accentColor = COLORS.ink,
  accentBg = COLORS.panel,
}: {
  title: string;
  items: Array<string | AttendancePrintInfoItem>;
  fontSize: number;
  accentColor?: string;
  accentBg?: string;
}) {
  const visibleItems = items;
  const useTwoCols = visibleItems.length > 2;
  const titleParts = splitInfoBlockTitle(title);
  const titleFont = Math.max(fontSize - 0.35, fontSize * 0.92);
  const contentFont = Math.max(fontSize - 1.1, fontSize * 0.84);
  return (
    <div style={{
      padding: `${mm(1.25)}px ${mm(1.8)}px`,
      borderRadius: mm(1.5), background: accentBg,
      border: `1px solid ${COLORS.border}`,
      breakInside: "avoid", pageBreakInside: "avoid",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: mm(0.8),
        flexWrap: "wrap",
        marginBottom: mm(0.9),
        lineHeight: 1.05,
      }}>
        <strong style={{
          display: "block",
          color: accentColor,
          fontSize: titleFont,
        }}>{titleParts.main}</strong>
        {titleParts.suffix ? (
          <span style={{
            display: "inline-flex",
            alignItems: "center",
            padding: `${mm(0.1)}px ${mm(0.9)}px`,
            borderRadius: 999,
            border: `1px solid ${COLORS.border}`,
            background: "rgba(255,255,255,0.7)",
            color: COLORS.muted,
            fontSize: Math.max(contentFont - 0.2, contentFont * 0.92),
            fontWeight: 700,
          }}>
            {titleParts.suffix}
          </span>
        ) : null}
      </div>
      <div style={{
        display: "grid",
        gridTemplateColumns: useTwoCols ? "1fr 1fr" : "1fr",
        gap: `${mm(0.3)}px ${mm(3)}px`,
      }}>
        {visibleItems.map((item, i) => {
          const itemColor = typeof item === "string"
            ? COLORS.muted
            : item.tone === "national"
              ? "#b91c1c"
              : item.tone === "custom"
                ? "#b45309"
                : item.tone === "event"
                  ? "#1d4ed8"
                  : COLORS.muted;
          const parsed = splitInfoBlockText(typeof item === "string" ? item : item.text);
          return (
            <div key={`${title}-${i}`} style={{
              fontSize: contentFont,
              color: COLORS.muted,
              whiteSpace: "normal",
              overflowWrap: "anywhere",
              lineHeight: 1.1,
            }}>
              {parsed.lead ? (
                <>
                  <span style={{ color: itemColor, fontWeight: 700 }}>{parsed.lead}</span>
                  <span style={{ color: itemColor, fontWeight: 700 }}> — </span>
                  <span>{parsed.body}</span>
                </>
              ) : (
                <span style={{ color: itemColor }}>{parsed.body}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

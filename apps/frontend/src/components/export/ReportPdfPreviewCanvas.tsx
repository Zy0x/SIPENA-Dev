import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { Loader2, Move } from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
import type { ExportConfig } from "@/lib/reportExportLayout";
import { buildReportLayoutPlanV2, type ReportExportLayoutPlanV2, type ReportLayoutPageV2, type SignaturePlacement } from "@/lib/reportExportLayoutV2";
import { buildReportPdfDocument } from "@/lib/exportEngine/pdfEngine";
import { pdfBodyRowHeightMm, pdfHeaderRowHeightMm, mmToPx } from "@/lib/exportEngine/sharedMetrics";
import { resolveSignatureRenderBoxMm } from "@/lib/exportSignature";
import {
  clampSignaturePlacementMm,
  convertPreviewDeltaPxToMm,
  resolveManualSignaturePercents,
} from "@/lib/attendancePdfPreview";

// Mirrors the attendance preview contract: preview === exported PDF === exported PNG capture.
GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

const PREVIEW_BG = "#f8fafc";
const PAGE_BORDER = "#dbe4f0";
const PAGE_SHADOW = "0 18px 40px -30px rgba(15, 23, 42, 0.8)";

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
  onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
  onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
  onSignaturePlacementChange?: (placement: SignaturePlacement | null) => void;
}

interface RenderedPage {
  pageNumber: number;
  src: string;
  widthPx: number;
  heightPx: number;
}

interface DragState {
  pageIndex: number;
  startClientX: number;
  startClientY: number;
  startXMm: number;
  startYMm: number;
}

interface PreviewHotspot {
  target: ExportPreviewHighlightTarget;
  leftMm: number;
  topMm: number;
  widthMm: number;
  heightMm: number;
}

function isSameHighlightTarget(
  left: ExportPreviewHighlightTarget | null | undefined,
  right: ExportPreviewHighlightTarget,
) {
  if (!left) return false;
  if (left.kind !== right.kind) return false;
  if (left.kind === "column" && right.kind === "column") {
    return left.key === right.key;
  }
  return true;
}

function buildPageHotspots(layoutPlan: ReportExportLayoutPlanV2, page: ReportLayoutPageV2): PreviewHotspot[] {
  if (page.pageType !== "table") return [];

  const resolvedStyle = layoutPlan.documentStyle;
  const headerHeightMm = pdfHeaderRowHeightMm(
    resolvedStyle.tableHeaderFontSize,
    resolvedStyle.tableSizing.headerRowHeightMm,
  ) * (page.headerGroups.length > 1 ? 2 : 1);
  const bodyHeightMm = page.rows.length * pdfBodyRowHeightMm(
    resolvedStyle.tableBodyFontSize,
    resolvedStyle.tableSizing.bodyRowHeightMm,
  );
  const tableWidthMm = page.columnWidthsMm.reduce((sum, width) => sum + width, 0);
  const tableHeightMm = Math.max(page.estimatedTableHeightMm, headerHeightMm + bodyHeightMm);
  const tableLeftMm = layoutPlan.metrics.marginLeftMm;
  const tableTopMm = page.tableStartY;

  const hotspots: PreviewHotspot[] = [
    {
      target: { kind: "table", label: "Seluruh tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm,
      widthMm: tableWidthMm,
      heightMm: tableHeightMm,
    },
    {
      target: { kind: "header-row", label: "Baris header tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm,
      widthMm: tableWidthMm,
      heightMm: headerHeightMm,
    },
    {
      target: { kind: "body-row", label: "Baris data tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm + headerHeightMm,
      widthMm: tableWidthMm,
      heightMm: Math.max(0, tableHeightMm - headerHeightMm),
    },
  ];

  let cursorLeftMm = tableLeftMm;
  page.columns.forEach((column, index) => {
    const widthMm = page.columnWidthsMm[index] ?? 0;
    hotspots.push({
      target: { kind: "column", key: column.key, label: column.label },
      leftMm: cursorLeftMm,
      topMm: tableTopMm,
      widthMm,
      heightMm: tableHeightMm,
    });
    cursorLeftMm += widthMm;
  });

  return hotspots;
}

function buildPreviewConfig(previewData: SignaturePreviewData | undefined, draft: SignatureSettingsConfig) {
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
      signatureLineLengthMode: draft.signatureLineLengthMode,
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
}

export function SignaturePreviewCanvas({
  previewFormat: _previewFormat,
  draft,
  setDraft,
  previewDate: _previewDate,
  previewData,
  liveEditMode = false,
  highlightTarget = null,
  onHighlightTargetHoverChange,
  onHighlightTargetSelect,
  onSignaturePlacementChange,
}: SignaturePreviewCanvasProps) {
  const config = useMemo(() => buildPreviewConfig(previewData, draft), [draft, previewData]);
  const layoutPlan = useMemo(() => (config ? buildReportLayoutPlanV2(config) : null), [config]);
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [isRendering, setIsRendering] = useState(false);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [liveSignaturePosition, setLiveSignaturePosition] = useState<{ xMm: number; yMm: number } | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  const pageWidthPx = useMemo(() => mmToPx(layoutPlan?.metrics.pageWidthMm ?? 297), [layoutPlan?.metrics.pageWidthMm]);
  const pageHeightPx = useMemo(() => mmToPx(layoutPlan?.metrics.pageHeightMm ?? 210), [layoutPlan?.metrics.pageHeightMm]);
  const pageHotspots = useMemo(
    () => layoutPlan ? layoutPlan.pages.map((page) => buildPageHotspots(layoutPlan, page)) : [],
    [layoutPlan],
  );

  useEffect(() => {
    onSignaturePlacementChange?.(layoutPlan?.signaturePlacement ?? null);
  }, [layoutPlan?.signaturePlacement, onSignaturePlacementChange]);

  useEffect(() => {
    if (!config || !layoutPlan) {
      setPages([]);
      return;
    }

    let cancelled = false;
    setIsRendering(true);

    const render = async () => {
      const doc = buildReportPdfDocument(config);
      const pdf = await getDocument({ data: doc.output("arraybuffer") }).promise;
      const nextPages: RenderedPage[] = [];
      const renderScaleBase = typeof window === "undefined" ? 1.5 : Math.max(1.5, Math.min(window.devicePixelRatio || 1, 2));

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const cssScale = pageWidthPx / baseViewport.width;
        const viewport = page.getViewport({ scale: cssScale * renderScaleBase });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!context) continue;
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, canvasContext: context, viewport }).promise;
        nextPages.push({
          pageNumber,
          src: canvas.toDataURL("image/png"),
          widthPx: pageWidthPx,
          heightPx: pageHeightPx,
        });
      }

      if (!cancelled) {
        setPages(nextPages);
        setIsRendering(false);
      }
    };

    void render().catch(() => {
      if (!cancelled) {
        setPages([]);
        setIsRendering(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [config, layoutPlan, pageHeightPx, pageWidthPx]);

  useEffect(() => {
    if (!dragState) {
      setLiveSignaturePosition(null);
    }
  }, [dragState]);

  const signaturePlacement = layoutPlan?.signaturePlacement ?? null;
  const signaturePageIndex = signaturePlacement?.pageIndex ?? null;
  const overlayPosition = liveSignaturePosition ?? (signaturePlacement
    ? { xMm: signaturePlacement.xMm, yMm: signaturePlacement.yMm }
    : null);
  const dragEnabled = Boolean(config?.includeSignature && config.signature && signaturePlacement && !draft.lockSignaturePosition);
  const renderBox = config?.includeSignature && config.signature && layoutPlan && signaturePlacement
    ? resolveSignatureRenderBoxMm({
        signature: config.signature,
        pageWidthMm: layoutPlan.metrics.pageWidthMm,
        placement: {
          xMm: overlayPosition?.xMm ?? signaturePlacement.xMm,
          yMm: overlayPosition?.yMm ?? signaturePlacement.yMm,
          widthMm: signaturePlacement.widthMm,
        },
      })
    : null;

  const updateHoverTarget = (target: ExportPreviewHighlightTarget | null) => {
    if (!onHighlightTargetHoverChange) return;
    if (target && isSameHighlightTarget(highlightTarget, target)) return;
    onHighlightTargetHoverChange(target);
  };
  const selectHighlightTarget = (target: ExportPreviewHighlightTarget) => {
    onHighlightTargetSelect?.(target);
  };

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragEnabled || !signaturePlacement) return;
    setDragState({
      pageIndex: signaturePlacement.pageIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXMm: signaturePlacement.xMm,
      startYMm: signaturePlacement.yMm,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [dragEnabled, signaturePlacement]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || !layoutPlan || !signaturePlacement) return;
    const pageElement = pageRefs.current[dragState.pageIndex];
    const rect = pageElement?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const dxMm = convertPreviewDeltaPxToMm(event.clientX - dragState.startClientX, rect.width, layoutPlan.metrics.pageWidthMm);
    const dyMm = convertPreviewDeltaPxToMm(event.clientY - dragState.startClientY, rect.width, layoutPlan.metrics.pageWidthMm);
    const clamped = clampSignaturePlacementMm({
      placement: signaturePlacement,
      xMm: dragState.startXMm + dxMm,
      yMm: dragState.startYMm + dyMm,
      snapToGrid: draft.snapToGrid,
      gridSizeMm: draft.gridSizeMm,
    });
    setLiveSignaturePosition({ xMm: clamped.xMm, yMm: clamped.yMm });
  }, [draft.gridSizeMm, draft.snapToGrid, dragState, layoutPlan, signaturePlacement]);

  const commitDrag = useCallback(() => {
    if (!dragState || !signaturePlacement || !liveSignaturePosition) {
      setDragState(null);
      return;
    }

    const manual = resolveManualSignaturePercents({
      placement: signaturePlacement,
      xMm: liveSignaturePosition.xMm,
      yMm: liveSignaturePosition.yMm,
    });

    setDraft((prev) => ({
      ...prev,
      placementMode: "fixed",
      signaturePageIndex: null,
      manualXPercent: manual.manualXPercent,
      manualYPercent: manual.manualYPercent,
      signatureOffsetX: 0,
      signatureOffsetY: 0,
    }));
    setDragState(null);
    setLiveSignaturePosition(null);
  }, [dragState, signaturePlacement, liveSignaturePosition, setDraft]);

  const cancelDrag = useCallback(() => {
    setDragState(null);
    setLiveSignaturePosition(null);
  }, []);

  if (!config || !layoutPlan) {
    return (
      <div style={{ width: pageWidthPx, minHeight: 160, display: "grid", placeItems: "center", color: "#64748b", fontSize: 12 }}>
        Preview belum siap.
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 18, width: pageWidthPx }}>
      {pages.map((page, index) => (
        <div
          key={page.pageNumber}
          ref={(element) => {
            pageRefs.current[index] = element;
          }}
          style={{
            position: "relative",
            width: page.widthPx,
            minHeight: page.heightPx,
            borderRadius: 18,
            border: `1px solid ${PAGE_BORDER}`,
            overflow: "hidden",
            background: "#fff",
            boxShadow: PAGE_SHADOW,
          }}
        >
          <img
            src={page.src}
            alt={`Preview halaman ${page.pageNumber}`}
            style={{
              display: "block",
              width: page.widthPx,
              height: page.heightPx,
              background: PREVIEW_BG,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />

          {pageHotspots[index]?.map((hotspot) => {
            const active = isSameHighlightTarget(highlightTarget, hotspot.target);
            return (
              <div
                key={`${page.pageNumber}-${hotspot.target.kind}-${hotspot.target.kind === "column" ? hotspot.target.key : hotspot.target.label ?? hotspot.target.kind}`}
                style={{
                  position: "absolute",
                  left: mmToPx(hotspot.leftMm),
                  top: mmToPx(hotspot.topMm),
                  width: mmToPx(hotspot.widthMm),
                  height: mmToPx(hotspot.heightMm),
                  borderRadius: hotspot.target.kind === "table" ? 12 : 8,
                  boxShadow: active
                    ? hotspot.target.kind === "column"
                      ? "inset 0 0 0 2px rgba(249, 115, 22, 0.92), 0 0 0 1px rgba(255,255,255,0.55)"
                      : hotspot.target.kind === "header-row"
                        ? "inset 0 0 0 2px rgba(37, 99, 235, 0.85)"
                        : hotspot.target.kind === "body-row"
                          ? "inset 0 0 0 2px rgba(14, 165, 233, 0.82)"
                          : "inset 0 0 0 2px rgba(37, 99, 235, 0.72)"
                    : "none",
                  background: active
                    ? hotspot.target.kind === "column"
                      ? "rgba(249, 115, 22, 0.12)"
                      : "rgba(37, 99, 235, 0.08)"
                    : "transparent",
                  pointerEvents: active || liveEditMode ? "auto" : "none",
                  cursor: liveEditMode ? "pointer" : "default",
                }}
                onClick={liveEditMode ? () => selectHighlightTarget(hotspot.target) : undefined}
                onMouseEnter={liveEditMode ? () => updateHoverTarget(hotspot.target) : undefined}
                onMouseLeave={liveEditMode ? () => updateHoverTarget(null) : undefined}
              />
            );
          })}

          {dragEnabled && signaturePlacement && signaturePageIndex === index && overlayPosition && renderBox ? (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={commitDrag}
              title="Seret tanda tangan. Posisi akan dikonversi ke koordinat PDF."
              style={{
                position: "absolute",
                left: mmToPx(renderBox.xMm),
                top: mmToPx(renderBox.yMm),
                width: mmToPx(renderBox.widthMm),
                height: mmToPx(renderBox.heightMm),
                borderRadius: 14,
                border: "1px dashed rgba(37, 99, 235, 0.88)",
                background: dragState ? "rgba(219, 234, 254, 0.42)" : "rgba(219, 234, 254, 0.18)",
                boxSizing: "border-box",
                cursor: dragState ? "grabbing" : "grab",
                touchAction: "none",
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "flex-end",
                padding: "6px 8px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  borderRadius: 999,
                  background: "rgba(37, 99, 235, 0.94)",
                  color: "#fff",
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  pointerEvents: "none",
                }}
              >
                <Move size={12} />
                TTD PDF
              </span>
            </div>
          ) : null}
        </div>
      ))}

      {isRendering ? (
        <div
          style={{
            width: pageWidthPx,
            minHeight: 160,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "#475569",
            fontSize: 12,
          }}
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          Menyusun preview PDF akurat...
        </div>
      ) : null}
    </div>
  );
}

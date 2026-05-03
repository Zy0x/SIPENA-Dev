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
import type { AttendancePrintDataset, AttendancePrintLayoutPlan, AttendancePrintPage } from "@/lib/attendancePrintLayout";
import { mmToPreviewPx } from "@/lib/attendancePrintLayout";
import { buildAttendancePdfDocument } from "@/lib/attendancePdfExport";
import { resolveSignatureRenderBoxMm } from "@/lib/exportSignature";
import {
  clampSignaturePlacementMm,
  convertPreviewDeltaPxToMm,
  resolveManualSignaturePercents,
} from "@/lib/attendancePdfPreview";
import type { ExportPreviewHighlightTarget } from "@/components/export/SignaturePreviewCanvas";

GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();

const PREVIEW_BG = "#f8fafc";
const PAGE_BORDER = "#dbe4f0";
const PAGE_SHADOW = "0 18px 40px -30px rgba(15, 23, 42, 0.8)";

interface AttendancePdfCanvasPreviewProps {
  data: AttendancePrintDataset;
  plan: AttendancePrintLayoutPlan;
  signature: SignatureSettingsConfig;
  setSignature: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  includeSignature: boolean;
  liveEditMode?: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
  onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
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

function buildPageHotspots(plan: AttendancePrintLayoutPlan, page: AttendancePrintPage): PreviewHotspot[] {
  if (page.kind !== "table") return [];

  const tableLeftMm = plan.paper.marginLeftMm;
  const tableTopMm = page.tableStartYMm;
  const headerHeightMm = plan.table.headerRowHeightMm * 2;
  const bodyHeightMm = page.rowHeightsMm.reduce((sum, height) => sum + height, 0) + (page.hasSummaryRows ? plan.table.summaryRowHeightMm * 2 : 0);
  const tableHeightMm = headerHeightMm + bodyHeightMm;

  const hotspots: PreviewHotspot[] = [
    {
      target: { kind: "table", label: "Seluruh tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm,
      widthMm: plan.table.tableWidthMm,
      heightMm: tableHeightMm,
    },
    {
      target: { kind: "header-row", label: "Baris header tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm,
      widthMm: plan.table.tableWidthMm,
      heightMm: headerHeightMm,
    },
    {
      target: { kind: "body-row", label: "Baris data tabel" },
      leftMm: tableLeftMm,
      topMm: tableTopMm + headerHeightMm,
      widthMm: plan.table.tableWidthMm,
      heightMm: bodyHeightMm,
    },
  ];

  const orderedColumns: Array<{ key: string; label: string; widthMm: number }> = [];
  if (plan.visibleColumnKeys.has("no") && plan.table.noWidthMm > 0) {
    orderedColumns.push({ key: "no", label: "No", widthMm: plan.table.noWidthMm });
  }
  if (plan.visibleColumnKeys.has("name") && plan.table.nameWidthMm > 0) {
    orderedColumns.push({ key: "name", label: "Nama", widthMm: plan.table.nameWidthMm });
  }
  if (plan.visibleColumnKeys.has("nisn") && plan.table.nisnWidthMm > 0) {
    orderedColumns.push({ key: "nisn", label: "NISN", widthMm: plan.table.nisnWidthMm });
  }
  plan.visibleDays.forEach((day) => {
    orderedColumns.push({ key: day.key, label: `${day.dayName} ${day.dateLabel}`, widthMm: plan.table.dayWidthMm });
  });
  plan.visibleRekapKeys.forEach((key) => {
    orderedColumns.push({ key, label: key === "total" ? "Jumlah Total" : key, widthMm: plan.table.rekapWidthMm });
  });

  let cursorLeftMm = tableLeftMm;
  orderedColumns.forEach((column) => {
    hotspots.push({
      target: { kind: "column", key: column.key, label: column.label },
      leftMm: cursorLeftMm,
      topMm: tableTopMm,
      widthMm: column.widthMm,
      heightMm: tableHeightMm,
    });
    cursorLeftMm += column.widthMm;
  });

  return hotspots;
}

export function AttendancePdfCanvasPreview({
  data,
  plan,
  signature,
  setSignature,
  includeSignature,
  liveEditMode = false,
  highlightTarget = null,
  onHighlightTargetHoverChange,
  onHighlightTargetSelect,
}: AttendancePdfCanvasPreviewProps) {
  const [pages, setPages] = useState<RenderedPage[]>([]);
  const [isRendering, setIsRendering] = useState(true);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [liveSignaturePosition, setLiveSignaturePosition] = useState<{ xMm: number; yMm: number } | null>(null);
  const pageRefs = useRef<Array<HTMLDivElement | null>>([]);

  const pageWidthPx = useMemo(() => mmToPreviewPx(plan.paper.pageWidthMm), [plan.paper.pageWidthMm]);
  const pageHeightPx = useMemo(() => mmToPreviewPx(plan.paper.pageHeightMm), [plan.paper.pageHeightMm]);
  const dragEnabled = includeSignature && !!plan.signaturePlacement && !signature.lockSignaturePosition;
  const pageHotspots = useMemo(
    () => plan.pages.map((page) => buildPageHotspots(plan, page)),
    [plan],
  );

  useEffect(() => {
    let cancelled = false;
    setIsRendering(true);

    const render = async () => {
      const built = buildAttendancePdfDocument({
        data,
        plan,
        signature,
        includeSignature,
      });
      const pdf = await getDocument({ data: built.arrayBuffer() }).promise;
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
  }, [data, includeSignature, pageHeightPx, pageWidthPx, plan, signature]);

  useEffect(() => {
    if (!dragState) {
      setLiveSignaturePosition(null);
    }
  }, [dragState]);

  const signaturePageIndex = plan.signaturePlacement?.pageIndex ?? null;
  const overlayPosition = liveSignaturePosition ?? (plan.signaturePlacement
    ? { xMm: plan.signaturePlacement.xMm, yMm: plan.signaturePlacement.yMm }
    : null);
  const renderBox = useMemo(() => {
    if (!includeSignature || !plan.signaturePlacement) return null;
    const box = resolveSignatureRenderBoxMm({
      signature,
      pageWidthMm: plan.paper.pageWidthMm,
      placement: {
        xMm: overlayPosition?.xMm ?? plan.signaturePlacement.xMm,
        yMm: overlayPosition?.yMm ?? plan.signaturePlacement.yMm,
        widthMm: plan.signaturePlacement.widthMm,
      },
    });
    return {
      xMm: box.xMm,
      yMm: box.yMm,
      widthMm: box.widthMm,
      heightMm: box.heightMm,
    };
  }, [includeSignature, overlayPosition?.xMm, overlayPosition?.yMm, plan.paper.pageWidthMm, plan.signaturePlacement, signature]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragEnabled || !plan.signaturePlacement) return;
    setDragState({
      pageIndex: plan.signaturePlacement.pageIndex,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startXMm: plan.signaturePlacement.xMm,
      startYMm: plan.signaturePlacement.yMm,
    });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  }, [dragEnabled, plan.signaturePlacement]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || !plan.signaturePlacement) return;
    const pageElement = pageRefs.current[dragState.pageIndex];
    const rect = pageElement?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const dxMm = convertPreviewDeltaPxToMm(event.clientX - dragState.startClientX, rect.width, plan.paper.pageWidthMm);
    const dyMm = convertPreviewDeltaPxToMm(event.clientY - dragState.startClientY, rect.width, plan.paper.pageWidthMm);
    const clamped = clampSignaturePlacementMm({
      placement: plan.signaturePlacement,
      xMm: dragState.startXMm + dxMm,
      yMm: dragState.startYMm + dyMm,
      snapToGrid: signature.snapToGrid,
      gridSizeMm: signature.gridSizeMm,
    });
    setLiveSignaturePosition({ xMm: clamped.xMm, yMm: clamped.yMm });
  }, [dragState, plan.paper.pageWidthMm, plan.signaturePlacement, signature.gridSizeMm, signature.snapToGrid]);

  const commitDrag = useCallback(() => {
    if (!dragState || !plan.signaturePlacement || !liveSignaturePosition) {
      setDragState(null);
      return;
    }

    const manual = resolveManualSignaturePercents({
      placement: plan.signaturePlacement,
      xMm: liveSignaturePosition.xMm,
      yMm: liveSignaturePosition.yMm,
    });

    setSignature((prev) => ({
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
  }, [dragState, liveSignaturePosition, plan.signaturePlacement, setSignature]);

  const cancelDrag = useCallback(() => {
    setDragState(null);
    setLiveSignaturePosition(null);
  }, []);
  const updateHoverTarget = useCallback((target: ExportPreviewHighlightTarget | null) => {
    if (!onHighlightTargetHoverChange) return;
    if (target && isSameHighlightTarget(highlightTarget, target)) return;
    onHighlightTargetHoverChange(target);
  }, [highlightTarget, onHighlightTargetHoverChange]);

  const selectHighlightTarget = useCallback((target: ExportPreviewHighlightTarget) => {
    onHighlightTargetSelect?.(target);
  }, [onHighlightTargetSelect]);

  return (
    <div
      style={{
        display: "grid",
        gap: 18,
        width: pageWidthPx,
      }}
    >
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
                  left: mmToPreviewPx(hotspot.leftMm),
                  top: mmToPreviewPx(hotspot.topMm),
                  width: mmToPreviewPx(hotspot.widthMm),
                  height: mmToPreviewPx(hotspot.heightMm),
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

          {dragEnabled && plan.signaturePlacement && signaturePageIndex === index && overlayPosition && renderBox ? (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={commitDrag}
              onPointerCancel={cancelDrag}
              onLostPointerCapture={commitDrag}
              title="Seret tanda tangan. Posisi akan dikonversi ke koordinat PDF."
              style={{
                position: "absolute",
                left: mmToPreviewPx(renderBox.xMm),
                top: mmToPreviewPx(renderBox.yMm),
                width: mmToPreviewPx(renderBox.widthMm),
                height: mmToPreviewPx(renderBox.heightMm),
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

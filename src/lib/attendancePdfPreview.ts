import type { SignaturePlacement } from "@/lib/reportExportLayoutV2";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToGrid(value: number, gridSize: number) {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function convertPreviewDeltaPxToMm(deltaPx: number, pageRenderedWidthPx: number, pageWidthMm: number) {
  if (!Number.isFinite(deltaPx) || !Number.isFinite(pageRenderedWidthPx) || pageRenderedWidthPx <= 0 || pageWidthMm <= 0) {
    return 0;
  }
  return deltaPx * (pageWidthMm / pageRenderedWidthPx);
}

export function clampSignaturePlacementMm(args: {
  placement: SignaturePlacement;
  xMm: number;
  yMm: number;
  snapToGrid: boolean;
  gridSizeMm: number;
}) {
  const { placement, snapToGrid, gridSizeMm } = args;
  const grid = snapToGrid ? Math.max(1, gridSizeMm) : 0;
  const minX = placement.movementBounds.safeXMm;
  const minY = placement.movementBounds.safeYMm;
  const maxX = minX + Math.max(0, placement.movementBounds.safeWidthMm - placement.widthMm);
  const maxY = minY + Math.max(0, placement.movementBounds.safeHeightMm - placement.heightMm);
  const normalizedX = grid > 0 ? roundToGrid(args.xMm - minX, grid) + minX : args.xMm;
  const normalizedY = grid > 0 ? roundToGrid(args.yMm - minY, grid) + minY : args.yMm;

  return {
    xMm: clamp(normalizedX, minX, maxX),
    yMm: clamp(normalizedY, minY, maxY),
    minX,
    minY,
    maxX,
    maxY,
  };
}

export function resolveManualSignaturePercents(args: {
  placement: SignaturePlacement;
  xMm: number;
  yMm: number;
}) {
  const { placement, xMm, yMm } = args;
  const minX = placement.movementBounds.safeXMm;
  const minY = placement.movementBounds.safeYMm;
  const availableX = Math.max(1, placement.movementBounds.safeWidthMm - placement.widthMm);
  const availableY = Math.max(1, placement.movementBounds.safeHeightMm - placement.heightMm);

  return {
    manualXPercent: Number((((xMm - minX) / availableX) * 100).toFixed(2)),
    manualYPercent: Number((((yMm - minY) / availableY) * 100).toFixed(2)),
  };
}

export const OCR_IMAGE_MIN_ZOOM = 0.5;
export const OCR_IMAGE_MAX_ZOOM = 4;
export const OCR_IMAGE_DOUBLE_TAP_ZOOM = 2;

export interface ViewerPoint {
  x: number;
  y: number;
}

export function clampOcrImageZoom(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(OCR_IMAGE_MAX_ZOOM, Math.max(OCR_IMAGE_MIN_ZOOM, value));
}

export function getOcrImageDistance(first: ViewerPoint, second: ViewerPoint) {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

export function getOcrImageMidpoint(first: ViewerPoint, second: ViewerPoint): ViewerPoint {
  return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function getOcrImageDoubleTapZoom(currentZoom: number) {
  return currentZoom > 1.05 ? 1 : OCR_IMAGE_DOUBLE_TAP_ZOOM;
}

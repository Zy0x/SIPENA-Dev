import { describe, expect, it } from "vitest";

import {
  clampOcrImageZoom,
  getOcrImageDistance,
  getOcrImageDoubleTapZoom,
  getOcrImageMidpoint,
} from "./imageViewerMath";

describe("OCR image viewer gestures", () => {
  it("clamps zoom to the supported 50-400 percent range", () => {
    expect(clampOcrImageZoom(0.1)).toBe(0.5);
    expect(clampOcrImageZoom(2.5)).toBe(2.5);
    expect(clampOcrImageZoom(8)).toBe(4);
  });

  it("toggles double tap between fit and 200 percent", () => {
    expect(getOcrImageDoubleTapZoom(1)).toBe(2);
    expect(getOcrImageDoubleTapZoom(2)).toBe(1);
  });

  it("calculates pinch distance and midpoint", () => {
    expect(getOcrImageDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
    expect(getOcrImageMidpoint({ x: 10, y: 20 }, { x: 30, y: 40 })).toEqual({ x: 20, y: 30 });
  });
});

import { describe, expect, it, vi } from "vitest";

import { lockGradeTabsMinHeight } from "./gradeTabViewportStability";

describe("grade tab viewport stability", () => {
  it("locks the tab container to its current rendered height", () => {
    const element = document.createElement("div");
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      width: 900,
      height: 712.4,
      top: 100,
      right: 900,
      bottom: 812.4,
      left: 0,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    expect(lockGradeTabsMinHeight(element)).toBe(713);
    expect(element.style.minHeight).toBe("713px");
  });

  it("never reduces a previously locked height", () => {
    const element = document.createElement("div");
    element.style.minHeight = "840px";
    vi.spyOn(element, "getBoundingClientRect").mockReturnValue({
      width: 900,
      height: 420,
      top: 100,
      right: 900,
      bottom: 520,
      left: 0,
      x: 0,
      y: 100,
      toJSON: () => ({}),
    });

    expect(lockGradeTabsMinHeight(element)).toBe(840);
    expect(element.style.minHeight).toBe("840px");
  });

  it("does nothing when the tab container is unavailable", () => {
    expect(lockGradeTabsMinHeight(null)).toBe(0);
  });
});

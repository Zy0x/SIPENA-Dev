import { describe, expect, it, vi } from "vitest";

import { isVerticalScrollBoundary, scrollPageBy } from "./scrollChaining";

function createScroller({
  scrollTop,
  clientHeight,
  scrollHeight,
}: {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;
}) {
  const element = document.createElement("div");
  Object.defineProperties(element, {
    scrollTop: { configurable: true, writable: true, value: scrollTop },
    clientHeight: { configurable: true, value: clientHeight },
    scrollHeight: { configurable: true, value: scrollHeight },
  });
  return element;
}

describe("scroll chaining", () => {
  it("detects only the boundary matching the scroll direction", () => {
    const top = createScroller({ scrollTop: 0, clientHeight: 100, scrollHeight: 400 });
    const middle = createScroller({ scrollTop: 120, clientHeight: 100, scrollHeight: 400 });
    const bottom = createScroller({ scrollTop: 300, clientHeight: 100, scrollHeight: 400 });

    expect(isVerticalScrollBoundary(top, -20)).toBe(true);
    expect(isVerticalScrollBoundary(top, 20)).toBe(false);
    expect(isVerticalScrollBoundary(middle, -20)).toBe(false);
    expect(isVerticalScrollBoundary(middle, 20)).toBe(false);
    expect(isVerticalScrollBoundary(bottom, 20)).toBe(true);
    expect(isVerticalScrollBoundary(bottom, -20)).toBe(false);
  });

  it("forwards scrolling to the app page container when available", () => {
    const pageScroller = createScroller({
      scrollTop: 0,
      clientHeight: 300,
      scrollHeight: 900,
    });
    pageScroller.dataset.appScrollContainer = "";
    pageScroller.scrollBy = vi.fn();
    document.body.appendChild(pageScroller);

    const windowScrollBy = vi.fn();
    const ownerWindow = { scrollBy: windowScrollBy } as unknown as Window;

    expect(scrollPageBy(80, document, ownerWindow)).toBe(true);
    expect(pageScroller.scrollBy).toHaveBeenCalledWith({ top: 80, behavior: "auto" });
    expect(windowScrollBy).not.toHaveBeenCalled();

    pageScroller.remove();
  });

  it("falls back to the window when the app container cannot scroll", () => {
    const windowScrollBy = vi.fn();
    const ownerWindow = { scrollBy: windowScrollBy } as unknown as Window;

    expect(scrollPageBy(-40, document, ownerWindow)).toBe(true);
    expect(windowScrollBy).toHaveBeenCalledWith({ top: -40, behavior: "auto" });
  });
});

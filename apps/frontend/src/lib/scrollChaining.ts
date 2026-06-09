const DEFAULT_SCROLL_TOLERANCE = 1;

export function isVerticalScrollBoundary(
  element: HTMLElement,
  deltaY: number,
  tolerance = DEFAULT_SCROLL_TOLERANCE,
): boolean {
  if (deltaY === 0) return false;

  const atTop = element.scrollTop <= tolerance;
  const atBottom =
    element.scrollTop + element.clientHeight >= element.scrollHeight - tolerance;

  return (deltaY < 0 && atTop) || (deltaY > 0 && atBottom);
}

export function scrollPageBy(
  deltaY: number,
  ownerDocument: Document = document,
  ownerWindow: Window = window,
): boolean {
  if (deltaY === 0) return false;

  const pageScroller = ownerDocument.querySelector<HTMLElement>(
    "[data-app-scroll-container]",
  );

  if (pageScroller && pageScroller.scrollHeight > pageScroller.clientHeight) {
    pageScroller.scrollBy({ top: deltaY, behavior: "auto" });
    return true;
  }

  ownerWindow.scrollBy({ top: deltaY, behavior: "auto" });
  return true;
}

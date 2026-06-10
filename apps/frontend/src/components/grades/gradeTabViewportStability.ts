export function lockGradeTabsMinHeight(element: HTMLElement | null): number {
  if (!element) return 0;

  const measuredHeight = Math.ceil(element.getBoundingClientRect().height);
  const currentMinHeight = Number.parseFloat(element.style.minHeight) || 0;
  const stableHeight = Math.max(measuredHeight, currentMinHeight);

  if (stableHeight > 0) {
    element.style.minHeight = `${stableHeight}px`;
  }

  return stableHeight;
}

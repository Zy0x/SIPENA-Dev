import { useEffect } from "react";

const TOUCH_SCROLL_CLICK_THRESHOLD_PX = 8;
const TOUCH_SCROLL_CLICK_SUPPRESS_MS = 450;

const INTERACTIVE_SELECTOR = [
  "button",
  "a[href]",
  "input[type='button']",
  "input[type='submit']",
  "input[type='reset']",
  "[role='button']",
  "[role='combobox']",
  "[role='menuitem']",
  "[role='option']",
  "[role='tab']",
  "[role='switch']",
  "[aria-haspopup='menu']",
  "[aria-haspopup='listbox']",
  "[data-radix-collection-item]",
  "[data-touch-scroll-click-target='true']",
].join(",");

function isTouchPointer(event: PointerEvent) {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

function isInteractiveTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
}

export function useTouchScrollClickGuard() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    let activePointerId: number | null = null;
    let startX = 0;
    let startY = 0;
    let movedBeyondThreshold = false;
    let suppressClicksUntil = 0;

    const markTouchScroll = () => {
      suppressClicksUntil = Date.now() + TOUCH_SCROLL_CLICK_SUPPRESS_MS;
    };

    const clearPointer = () => {
      activePointerId = null;
      startX = 0;
      startY = 0;
      movedBeyondThreshold = false;
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (!isTouchPointer(event)) return;

      activePointerId = event.pointerId;
      startX = event.clientX;
      startY = event.clientY;
      movedBeyondThreshold = false;
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (!isTouchPointer(event) || event.pointerId !== activePointerId) return;

      const deltaX = Math.abs(event.clientX - startX);
      const deltaY = Math.abs(event.clientY - startY);
      if (deltaX > TOUCH_SCROLL_CLICK_THRESHOLD_PX || deltaY > TOUCH_SCROLL_CLICK_THRESHOLD_PX) {
        movedBeyondThreshold = true;
        markTouchScroll();
      }
    };

    const handlePointerEnd = (event: PointerEvent) => {
      if (isTouchPointer(event) && event.pointerId === activePointerId) {
        if (movedBeyondThreshold) {
          markTouchScroll();
        }
        clearPointer();
      }
    };

    const handlePointerCancel = (event: PointerEvent) => {
      if (!isTouchPointer(event) || event.pointerId !== activePointerId) return;

      markTouchScroll();
      clearPointer();
    };

    const handleClick = (event: MouseEvent) => {
      if (Date.now() > suppressClicksUntil || !isInteractiveTarget(event.target)) return;

      suppressClicksUntil = 0;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("pointermove", handlePointerMove, true);
    document.addEventListener("pointerup", handlePointerEnd, true);
    document.addEventListener("pointercancel", handlePointerCancel, true);
    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("pointermove", handlePointerMove, true);
      document.removeEventListener("pointerup", handlePointerEnd, true);
      document.removeEventListener("pointercancel", handlePointerCancel, true);
      document.removeEventListener("click", handleClick, true);
    };
  }, []);
}

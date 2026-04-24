import { useRef, useCallback, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SmartScrollTableProps {
  children: ReactNode;
  className?: string;
}

/**
 * Unified scroll container for tables.
 * - Mouse wheel: prioritizes horizontal scroll while table has room, then releases to page.
 * - Touch: same logic via touch events.
 * - Uses capture phase + passive:false to intercept before Radix/browser listeners.
 */
export function SmartScrollTable({ children, className }: SmartScrollTableProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const horizontalIntentRef = useRef(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const tolerance = 2.5;

    const handleWheel = (e: WheelEvent) => {
      const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;

      const canH = scrollWidth > clientWidth + tolerance;
      const canV = scrollHeight > clientHeight + tolerance;

      const atLeft = scrollLeft <= tolerance;
      const atRight = scrollLeft + clientWidth >= scrollWidth - tolerance;
      const atTop = scrollTop <= tolerance;
      const atBottom = scrollTop + clientHeight >= scrollHeight - tolerance;

      let deltaX = e.deltaX;
      let deltaY = e.deltaY;
      if (e.shiftKey) { deltaX = deltaY; deltaY = 0; }

      // Trackpad horizontal intent detection
      const isTrackpad = e.deltaMode === 0;
      if (isTrackpad && Math.abs(deltaX) > 0.05) {
        horizontalIntentRef.current = Math.min(horizontalIntentRef.current + 4, 15);
      } else {
        horizontalIntentRef.current = Math.max(horizontalIntentRef.current - 2, 0);
      }

      const isHorizontalGesture =
        Math.abs(deltaX) > 0.08 ||
        horizontalIntentRef.current >= 6 ||
        (isTrackpad && Math.abs(deltaX) > Math.abs(deltaY) * 0.3);

      // 1. Horizontal priority
      if (canH && isHorizontalGesture) {
        if ((deltaX > 0 && !atRight) || (deltaX < 0 && !atLeft)) {
          el.scrollBy({ left: deltaX, top: 0, behavior: "instant" });
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      }

      // 2. Vertical
      const isMostlyVertical =
        Math.abs(deltaY) > Math.abs(deltaX) * 0.75 ||
        (Math.abs(deltaX) < 5 && Math.abs(deltaY) > 8);

      if (canV && isMostlyVertical) {
        if ((deltaY > 0 && !atBottom) || (deltaY < 0 && !atTop)) {
          el.scrollBy({ left: 0, top: deltaY, behavior: "instant" });
          e.preventDefault();
          e.stopImmediatePropagation();
          return;
        }
      }

      // At edges → let event bubble to page scroll
    };

    el.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => {
      el.removeEventListener("wheel", handleWheel, { capture: true } as EventListenerOptions);
    };
  }, []);

  // ── Touch handling (mobile) ──
  const touchStartRef = useRef({ x: 0, y: 0 });
  const isScrollingRef = useRef(false);

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 0) return;
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    isScrollingRef.current = false;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el || e.touches.length === 0) return;

    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = touchStartRef.current.x - touchX;
    const deltaY = touchStartRef.current.y - touchY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (!isScrollingRef.current && (absX > 7 || absY > 7)) isScrollingRef.current = true;
    if (!isScrollingRef.current) {
      touchStartRef.current = { x: touchX, y: touchY };
      return;
    }

    const tol = 3;
    const { scrollLeft, scrollTop, scrollWidth, scrollHeight, clientWidth, clientHeight } = el;
    const atLeft = scrollLeft <= tol;
    const atRight = scrollLeft + clientWidth >= scrollWidth - tol;
    const atTop = scrollTop <= tol;
    const atBottom = scrollTop + clientHeight >= scrollHeight - tol;
    const canH = scrollWidth > clientWidth + tol;
    const canV = scrollHeight > clientHeight + tol;

    if (canH && absX > absY * 0.85 && absX > 8) {
      if ((deltaX > 0 && !atRight) || (deltaX < 0 && !atLeft)) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        touchStartRef.current = { x: touchX, y: touchY };
        return;
      }
    }

    if (canV && absY > absX * 0.9 && absY > 8) {
      if ((deltaY > 0 && !atBottom) || (deltaY < 0 && !atTop)) {
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();
        touchStartRef.current = { x: touchX, y: touchY };
        return;
      }
    }

    touchStartRef.current = { x: touchX, y: touchY };
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn("table-responsive overflow-auto overscroll-auto relative", className)}
      style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
    >
      {children}
    </div>
  );
}

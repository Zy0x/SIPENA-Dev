import { useCallback, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";

type CoarsePointerTapGuardOptions<T extends HTMLElement> = {
  moveThresholdX?: number;
  moveThresholdY?: number;
  suppressMs?: number;
  isSuppressed?: () => boolean;
  onValidTap?: (event: ReactPointerEvent<T>) => void;
};

type GuardedPointerState = {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  cancelled: boolean;
};

const DEFAULT_MOVE_THRESHOLD_X = 6;
const DEFAULT_MOVE_THRESHOLD_Y = 10;
const DEFAULT_SUPPRESS_MS = 650;

function isCoarsePointer<T extends HTMLElement>(event: ReactPointerEvent<T>): boolean {
  return event.pointerType === "touch" || event.pointerType === "pen";
}

export function useCoarsePointerTapGuard<T extends HTMLElement>({
  moveThresholdX = DEFAULT_MOVE_THRESHOLD_X,
  moveThresholdY = DEFAULT_MOVE_THRESHOLD_Y,
  suppressMs = DEFAULT_SUPPRESS_MS,
  isSuppressed,
  onValidTap,
}: CoarsePointerTapGuardOptions<T> = {}) {
  const pointerStateRef = useRef<GuardedPointerState | null>(null);
  const suppressClickUntilRef = useRef(0);

  const suppressSyntheticClick = useCallback(() => {
    suppressClickUntilRef.current = Date.now() + suppressMs;
  }, [suppressMs]);

  const markMovedIfNeeded = useCallback((event: ReactPointerEvent<T>, state: GuardedPointerState) => {
    const deltaX = Math.abs(event.clientX - state.x);
    const deltaY = Math.abs(event.clientY - state.y);

    if (deltaX > moveThresholdX || deltaY > moveThresholdY) {
      state.moved = true;
    }
  }, [moveThresholdX, moveThresholdY]);

  const onPointerDown = useCallback((event: ReactPointerEvent<T>) => {
    if (!isCoarsePointer(event)) return;

    pointerStateRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      moved: false,
      cancelled: false,
    };

    event.currentTarget.focus({ preventScroll: true });
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const onPointerMove = useCallback((event: ReactPointerEvent<T>) => {
    if (!isCoarsePointer(event)) return;

    const state = pointerStateRef.current;
    if (!state || state.pointerId !== event.pointerId) return;

    markMovedIfNeeded(event, state);
  }, [markMovedIfNeeded]);

  const onPointerCancel = useCallback((event: ReactPointerEvent<T>) => {
    if (!isCoarsePointer(event)) return;

    const state = pointerStateRef.current;
    if (state && state.pointerId === event.pointerId) {
      state.cancelled = true;
      state.moved = true;
    }

    suppressSyntheticClick();
    event.preventDefault();
    event.stopPropagation();
  }, [suppressSyntheticClick]);

  const onPointerUp = useCallback((event: ReactPointerEvent<T>) => {
    if (!isCoarsePointer(event)) return;

    const state = pointerStateRef.current;
    if (state && state.pointerId === event.pointerId) {
      markMovedIfNeeded(event, state);
    }

    const shouldIgnoreTap = !state
      || state.pointerId !== event.pointerId
      || state.cancelled
      || state.moved
      || Boolean(isSuppressed?.());

    pointerStateRef.current = null;
    suppressSyntheticClick();
    event.preventDefault();
    event.stopPropagation();

    if (shouldIgnoreTap) return;
    onValidTap?.(event);
  }, [isSuppressed, markMovedIfNeeded, onValidTap, suppressSyntheticClick]);

  const onClick = useCallback((event: ReactMouseEvent<T>) => {
    if (event.detail === 0) return;
    if (Date.now() >= suppressClickUntilRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  }, []);

  return {
    onPointerDown,
    onPointerMove,
    onPointerCancel,
    onPointerUp,
    onClick,
  };
}

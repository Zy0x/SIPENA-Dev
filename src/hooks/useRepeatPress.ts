/**
 * useRepeatPress — fires a callback once on press, then repeatedly while held.
 *
 * Solves the problem where users have to click an arrow button repeatedly
 * (with delay between clicks) to nudge a value. Now: hold the button down
 * and the value updates continuously and quickly.
 *
 * Behavior:
 * 1. Initial fire on pointerdown.
 * 2. After `initialDelayMs`, repeats every `intervalMs`.
 * 3. After `accelAfterMs` of holding, switches to `fastIntervalMs` for
 *    rapid scrolling through large ranges.
 * 4. Stops on pointerup, pointerleave, pointercancel, or losing focus.
 *
 * Usage:
 *   const press = useRepeatPress(() => nudgePosition("y", -1));
 *   <Button {...press}>↑</Button>
 */

import { useCallback, useEffect, useRef } from "react";

interface RepeatPressOptions {
  /** ms before the first repeat fires (default 280) */
  initialDelayMs?: number;
  /** ms between repeats during normal phase (default 70) */
  intervalMs?: number;
  /** ms after which the repeat speeds up (default 1200) */
  accelAfterMs?: number;
  /** ms between repeats during accelerated phase (default 30) */
  fastIntervalMs?: number;
}

export function useRepeatPress(
  callback: () => void,
  options: RepeatPressOptions = {},
) {
  const {
    initialDelayMs = 280,
    intervalMs = 70,
    accelAfterMs = 1200,
    fastIntervalMs = 30,
  } = options;

  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timersRef = useRef<{
    initial: number | null;
    interval: number | null;
    accel: number | null;
    startedAt: number;
  }>({ initial: null, interval: null, accel: null, startedAt: 0 });

  const cleanup = useCallback(() => {
    const t = timersRef.current;
    if (t.initial !== null) {
      window.clearTimeout(t.initial);
      t.initial = null;
    }
    if (t.interval !== null) {
      window.clearInterval(t.interval);
      t.interval = null;
    }
    if (t.accel !== null) {
      window.clearTimeout(t.accel);
      t.accel = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const start = useCallback(() => {
    cleanup();
    // Fire once immediately
    callbackRef.current();

    timersRef.current.startedAt = Date.now();

    timersRef.current.initial = window.setTimeout(() => {
      // Phase 1: normal repeat
      timersRef.current.interval = window.setInterval(() => {
        callbackRef.current();
      }, intervalMs);

      // Phase 2: switch to fast repeat after a while
      timersRef.current.accel = window.setTimeout(() => {
        if (timersRef.current.interval !== null) {
          window.clearInterval(timersRef.current.interval);
        }
        timersRef.current.interval = window.setInterval(() => {
          callbackRef.current();
        }, fastIntervalMs);
      }, accelAfterMs);
    }, initialDelayMs);
  }, [accelAfterMs, cleanup, fastIntervalMs, initialDelayMs, intervalMs]);

  const stop = useCallback(() => cleanup(), [cleanup]);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      e.preventDefault();
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    onBlur: stop,
  };
}

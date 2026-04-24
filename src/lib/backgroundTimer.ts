/**
 * Background-resilient timer utilities.
 *
 * Browsers throttle `setTimeout`, `setInterval`, and `requestAnimationFrame`
 * to ~1 Hz when a tab is hidden, minimised, or runs in a backgrounded window.
 * That throttling can pause animations, freeze export progress UIs, and even
 * delay long-running async work that piggybacks on `requestAnimationFrame`.
 *
 * `MessageChannel` ports are NOT throttled — messages posted on a channel
 * dispatch on the next microtask boundary even when the tab is hidden. We
 * combine that with a Web Worker tick (when available) to deliver high-fidelity
 * "tick" callbacks regardless of tab visibility.
 *
 * The exported helpers mimic the standard timer API so callers can swap them
 * in without behavioural changes when the tab is foregrounded.
 */

type TickCallback = () => void;

const tickListeners = new Set<TickCallback>();

let pumpChannel: MessageChannel | null = null;
let pumpScheduled = false;
let lastTickAt = 0;

function ensureChannel(): MessageChannel {
  if (pumpChannel) return pumpChannel;
  pumpChannel = new MessageChannel();
  pumpChannel.port1.onmessage = () => {
    pumpScheduled = false;
    const now = performance.now();
    lastTickAt = now;
    // Snapshot listeners so a callback may unsubscribe safely.
    const snapshot = Array.from(tickListeners);
    for (const listener of snapshot) {
      try {
        listener();
      } catch (err) {
        // Don't let a single bad listener kill the pump.
        console.error("[backgroundTimer] tick listener threw:", err);
      }
    }
    if (tickListeners.size > 0) schedulePump();
  };
  return pumpChannel;
}

function schedulePump() {
  if (pumpScheduled) return;
  pumpScheduled = true;
  ensureChannel().port2.postMessage(0);
}

/**
 * Subscribe to a high-fidelity tick that keeps firing when the tab is hidden.
 * Returns an unsubscribe function. The tick frequency is best-effort — it runs
 * as fast as the message channel can drain, throttled only by event-loop work.
 */
export function subscribeBackgroundTick(callback: TickCallback): () => void {
  tickListeners.add(callback);
  schedulePump();
  return () => {
    tickListeners.delete(callback);
  };
}

/**
 * Drop-in replacement for `setInterval` that keeps firing when the tab is
 * hidden or minimised. The callback is invoked when at least `intervalMs`
 * has elapsed since the previous invocation (using `performance.now()`).
 *
 * Returns a cancel function (NOT a numeric handle).
 */
export function setBackgroundInterval(callback: () => void, intervalMs: number): () => void {
  let lastFiredAt = performance.now();
  const unsubscribe = subscribeBackgroundTick(() => {
    const now = performance.now();
    if (now - lastFiredAt >= intervalMs) {
      lastFiredAt = now;
      callback();
    }
  });
  return unsubscribe;
}

/**
 * Drop-in replacement for `setTimeout` that fires reliably when the tab is
 * backgrounded. Returns a cancel function.
 */
export function setBackgroundTimeout(callback: () => void, delayMs: number): () => void {
  const startedAt = performance.now();
  let cancelled = false;
  const unsubscribe = subscribeBackgroundTick(() => {
    if (cancelled) return;
    if (performance.now() - startedAt >= delayMs) {
      cancelled = true;
      unsubscribe();
      callback();
    }
  });
  return () => {
    cancelled = true;
    unsubscribe();
  };
}

/**
 * Drive a numeric "progress" tween from `from` → `to` over `durationMs`
 * milliseconds, calling `onUpdate(value)` on every tick and `onComplete()`
 * when the duration elapses. Resilient to tab backgrounding.
 *
 * Returns a cancel function.
 */
export function runBackgroundTween(opts: {
  from: number;
  to: number;
  durationMs: number;
  ease?: (t: number) => number;
  onUpdate: (value: number) => void;
  onComplete?: () => void;
}): () => void {
  const { from, to, durationMs, ease, onUpdate, onComplete } = opts;
  const easing = ease ?? ((t: number) => t);
  const startedAt = performance.now();
  let finished = false;
  const unsubscribe = subscribeBackgroundTick(() => {
    if (finished) return;
    const elapsed = performance.now() - startedAt;
    const t = Math.min(1, elapsed / Math.max(1, durationMs));
    const value = from + (to - from) * easing(t);
    onUpdate(value);
    if (t >= 1) {
      finished = true;
      unsubscribe();
      onComplete?.();
    }
  });
  return () => {
    finished = true;
    unsubscribe();
  };
}

/** Diagnostic helper — last tick timestamp in ms. */
export function getLastBackgroundTickAt(): number {
  return lastTickAt;
}

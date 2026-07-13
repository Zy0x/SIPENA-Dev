export const PWA_UPDATE_MIN_INTERVAL_MS = 5 * 60_000;
export const PWA_UPDATE_POLL_INTERVAL_MS = 15 * 60_000;

interface PwaUpdateSchedulerOptions {
  check: () => void | Promise<void>;
  now?: () => number;
}

export interface PwaUpdateScheduler {
  start: () => void;
  stop: () => void;
  requestCheck: (force?: boolean) => void;
}

export function createPwaUpdateScheduler({
  check,
  now = Date.now,
}: PwaUpdateSchedulerOptions): PwaUpdateScheduler {
  let lastCheckAt = 0;
  let running = false;
  let intervalId: number | null = null;
  let idleId: number | null = null;

  const requestCheck = (force = false) => {
    if (document.visibilityState === "hidden" || !navigator.onLine || running) return;
    if (!force && now() - lastCheckAt < PWA_UPDATE_MIN_INTERVAL_MS) return;

    running = true;
    lastCheckAt = now();
    void Promise.resolve(check()).finally(() => {
      running = false;
    });
  };

  const onVisible = () => {
    if (document.visibilityState === "visible") requestCheck();
  };
  const onForeground = () => requestCheck();

  const start = () => {
    if (intervalId !== null) return;

    const idleWindow = window as Window & {
      requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    };
    idleId = idleWindow.requestIdleCallback?.(() => requestCheck(true), { timeout: 4_000 })
      ?? window.setTimeout(() => requestCheck(true), 2_000);
    intervalId = window.setInterval(() => requestCheck(), PWA_UPDATE_POLL_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onForeground);
    window.addEventListener("focus", onForeground);
    window.addEventListener("pageshow", onForeground);
  };

  const stop = () => {
    if (idleId !== null) {
      const idleWindow = window as Window & { cancelIdleCallback?: (handle: number) => void };
      idleWindow.cancelIdleCallback?.(idleId);
      window.clearTimeout(idleId);
      idleId = null;
    }
    if (intervalId !== null) {
      window.clearInterval(intervalId);
      intervalId = null;
    }
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("online", onForeground);
    window.removeEventListener("focus", onForeground);
    window.removeEventListener("pageshow", onForeground);
  };

  return { start, stop, requestCheck };
}

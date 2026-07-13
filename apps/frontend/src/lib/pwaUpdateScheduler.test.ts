import { afterEach, describe, expect, it, vi } from "vitest";
import { createPwaUpdateScheduler, PWA_UPDATE_MIN_INTERVAL_MS } from "./pwaUpdateScheduler";

describe("PWA update scheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("throttles foreground checks and keeps one scheduler", async () => {
    vi.useFakeTimers();
    let now = 10_000;
    const check = vi.fn();
    const scheduler = createPwaUpdateScheduler({ check, now: () => now });

    scheduler.start();
    scheduler.requestCheck(true);
    await Promise.resolve();
    scheduler.requestCheck();
    expect(check).toHaveBeenCalledTimes(1);

    now += PWA_UPDATE_MIN_INTERVAL_MS;
    scheduler.requestCheck();
    await Promise.resolve();
    expect(check).toHaveBeenCalledTimes(2);
    scheduler.stop();
  });
});

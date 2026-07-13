import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const pwaMock = vi.hoisted(() => ({
  applyUpdate: vi.fn<() => Promise<void>>(),
  needsUpdate: true,
}));

vi.mock("gsap", () => ({
  default: {
    fromTo: vi.fn(),
    to: vi.fn(),
  },
}));

vi.mock("@/hooks/usePWA", () => ({
  usePWA: () => ({
    applyUpdate: pwaMock.applyUpdate,
    needsUpdate: pwaMock.needsUpdate,
    isOnline: true,
    showBanner: false,
    dismissBanner: vi.fn(),
    isIOS: false,
    hasNativePrompt: false,
    promptInstall: vi.fn(),
  }),
}));

import PWAManager from "./PWAManager";

const UPDATE_LOCK_KEY = "sipena_pwa_update_lock_v1";

describe("PWAManager update recovery", () => {
  let container: HTMLDivElement;
  let root: Root | undefined;
  let storage: Map<string, string>;

  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    pwaMock.applyUpdate.mockReset().mockResolvedValue(undefined);
    pwaMock.needsUpdate = true;
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
      clear: () => storage.clear(),
      key: (index: number) => Array.from(storage.keys())[index] ?? null,
      get length() {
        return storage.size;
      },
    });
    (globalThis as Record<string, unknown>).__APP_BUILD_VERSION__ = "current-version";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ version: "target-version" }),
    }));
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    if (root) act(() => root?.unmount());
    container.remove();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT;
  });

  it("resumes an applying lock even when the service-worker signal arrives first", async () => {
    storage.set(UPDATE_LOCK_KEY, JSON.stringify({
      targetVersion: "target-version",
      startedAt: Date.now(),
      attempt: 1,
      status: "applying",
      source: "manual",
    }));

    await act(async () => {
      root.render(<PWAManager />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Menerapkan pembaruan");

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(pwaMock.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it("converts an abandoned applying lock into a recoverable stalled state", async () => {
    pwaMock.needsUpdate = false;
    storage.set(UPDATE_LOCK_KEY, JSON.stringify({
      targetVersion: "target-version",
      startedAt: Date.now() - 31_000,
      attempt: 1,
      status: "applying",
      source: "manual",
    }));

    await act(async () => {
      root.render(<PWAManager />);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Update belum selesai");
    expect(container.textContent).toContain("Muat ulang lagi");
    expect(pwaMock.applyUpdate).not.toHaveBeenCalled();
  });
});

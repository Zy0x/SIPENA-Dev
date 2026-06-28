import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_ENGINE, resolveRuntimeConfig } from "./attendanceRuntime.config";
import { guardRuntimeConfig, IS_ATTENDANCE_V2_IMPLEMENTED } from "./attendanceRuntimeGuard";

describe("Attendance Runtime Switch", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("defaults to V1 when config is missing", () => {
    const config = resolveRuntimeConfig();
    const guard = guardRuntimeConfig(config);

    expect(config.engine).toBe(DEFAULT_ENGINE);
    expect(config.source).toBe("default");
    expect(guard.forcedEngine).toBe("v1");
    expect(guard.forcedMode).toBe("active");
    expect(guard.isSafe).toBe(true);
  });

  it("forces V1 when the runtime engine is invalid", () => {
    const config = resolveRuntimeConfig({ localStorageEngine: "broken-engine" });
    const guard = guardRuntimeConfig(config);

    expect(config.engine).toBe("v1");
    expect(config.source).toBe("localStorage");
    expect(config.isValid).toBe(false);
    expect(guard.isSafe).toBe(false);
    expect(guard.reason).toBe("invalid-config");
    expect(guard.forcedEngine).toBe("v1");
  });

  it("allows V2 when V2 is requested and implemented", () => {
    const config = resolveRuntimeConfig({ envEngine: "v2" });
    const guard = guardRuntimeConfig(config);

    expect(IS_ATTENDANCE_V2_IMPLEMENTED).toBe(true);
    expect(config.engine).toBe("v2");
    expect(config.source).toBe("env");
    expect(guard.isSafe).toBe(true);
    expect(guard.reason).toBe("safe");
    expect(guard.forcedEngine).toBe("v2");
  });

  it("rejects disabled mode for user-facing runtime execution", () => {
    const config = resolveRuntimeConfig({ remoteEngine: "v1", mode: "disabled" });
    const guard = guardRuntimeConfig(config);

    expect(config.source).toBe("remote");
    expect(config.mode).toBe("disabled");
    expect(guard.isSafe).toBe(false);
    expect(guard.reason).toBe("unsafe-mode");
    expect(guard.forcedEngine).toBe("v1");
    expect(guard.forcedMode).toBe("active");
  });

  it("keeps invalid V2-like values on the V1 fallback path", () => {
    const config = resolveRuntimeConfig({ remoteEngine: "v2-beta", mode: "shadow" });
    const guard = guardRuntimeConfig(config);

    expect(config.isValid).toBe(false);
    expect(guard.reason).toBe("invalid-config");
    expect(guard.forcedEngine).toBe("v1");
    expect(guard.forcedMode).toBe("active");
  });
});

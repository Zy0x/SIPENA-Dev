import { AttendanceRuntimeConfig, AttendanceRuntimeGuardResult } from "./attendanceRuntime.types";

// Phase 01 safety lock: V2 files may exist, but production UI must never activate V2 yet.
export const IS_ATTENDANCE_V2_IMPLEMENTED = false;

function warnInDevelopment(message: string) {
  if (import.meta.env.DEV) {
    console.warn(`[Attendance Runtime Switch] ${message}`);
  }
}

export function guardRuntimeConfig(config: AttendanceRuntimeConfig): AttendanceRuntimeGuardResult {
  if (!config.isValid) {
    return {
      isSafe: false,
      reason: "invalid-config",
      message: "Runtime config is missing, invalid, or unsafe. Falling back to V1.",
      requestedEngine: config.requestedEngine,
      forcedEngine: "v1",
      forcedMode: "active",
    };
  }

  if (config.mode === "disabled") {
    return {
      isSafe: false,
      reason: "unsafe-mode",
      message: "Runtime mode is disabled for user-facing execution. Falling back to V1.",
      requestedEngine: config.requestedEngine,
      forcedEngine: "v1",
      forcedMode: "active",
    };
  }

  if (config.engine === "v2" && !IS_ATTENDANCE_V2_IMPLEMENTED) {
    const message = "V2 engine was requested but is not implemented. Falling back to V1.";
    warnInDevelopment(message);
    return {
      isSafe: false,
      reason: "v2-not-implemented",
      message,
      requestedEngine: config.requestedEngine,
      forcedEngine: "v1",
      forcedMode: "active",
    };
  }

  return {
    isSafe: true,
    reason: "safe",
    message: "Runtime config is safe.",
    requestedEngine: config.requestedEngine,
    forcedEngine: config.engine,
    forcedMode: config.mode,
  };
}

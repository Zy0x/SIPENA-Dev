import { AttendanceRuntimeConfig, AttendanceRuntimeGuardResult } from "./attendanceRuntime.types";

// For Phase 01, V2 engine is not implemented yet.
const IS_V2_IMPLEMENTED = false;

export function guardRuntimeConfig(config: AttendanceRuntimeConfig): AttendanceRuntimeGuardResult {
  // If config is missing or corrupt
  if (!config || (config.engine !== "v1" && config.engine !== "v2")) {
    return {
      isSafe: false,
      reason: "Missing or invalid runtime engine configuration",
      forcedEngine: "v1",
    };
  }

  // If V2 is requested but not implemented yet
  if (config.engine === "v2" && !IS_V2_IMPLEMENTED) {
    if (import.meta.env.DEV) {
      console.warn(
        "[Attendance Runtime Switch] V2 engine was requested but is not implemented yet. Safely falling back to V1."
      );
    }
    return {
      isSafe: false,
      reason: "V2 Engine is not implemented",
      forcedEngine: "v1",
    };
  }

  return {
    isSafe: true,
    forcedEngine: config.engine,
  };
}

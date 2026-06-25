import { AttendanceRuntimeConfig, AttendanceRuntimeEngine, AttendanceRuntimeMode } from "./attendanceRuntime.types";

export const DEFAULT_ENGINE: AttendanceRuntimeEngine = "v1";
export const DEFAULT_MODE: AttendanceRuntimeMode = "active";

export function getRuntimeConfig(): AttendanceRuntimeConfig {
  // 1. Check LocalStorage Override
  try {
    const localOverride = localStorage.getItem("attendance_engine_override");
    if (localOverride === "v1" || localOverride === "v2") {
      return {
        engine: localOverride as AttendanceRuntimeEngine,
        mode: "active",
        source: "localStorage",
      };
    }
  } catch (e) {
    // Ignore localStorage errors (e.g. security sandbox)
  }

  // 2. Check Environment Variable
  const envEngine = import.meta.env.VITE_ATTENDANCE_ENGINE;
  if (envEngine === "v1" || envEngine === "v2") {
    return {
      engine: envEngine as AttendanceRuntimeEngine,
      mode: "active",
      source: "env",
    };
  }

  // 3. Fallback to default
  return {
    engine: DEFAULT_ENGINE,
    mode: DEFAULT_MODE,
    source: "default",
  };
}

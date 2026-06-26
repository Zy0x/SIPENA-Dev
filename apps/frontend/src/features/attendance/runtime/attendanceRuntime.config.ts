import {
  AttendanceRuntimeConfig,
  AttendanceRuntimeConfigInput,
  AttendanceRuntimeEngine,
  AttendanceRuntimeMode,
  AttendanceRuntimeSource,
} from "./attendanceRuntime.types";

export const DEFAULT_ENGINE: AttendanceRuntimeEngine = "v1";
export const DEFAULT_MODE: AttendanceRuntimeMode = "active";
export const ATTENDANCE_RUNTIME_OVERRIDE_KEY = "attendance_engine_override";

function isRuntimeEngine(value: unknown): value is AttendanceRuntimeEngine {
  return value === "v1" || value === "v2";
}

function isRuntimeMode(value: unknown): value is AttendanceRuntimeMode {
  return value === "active" || value === "shadow" || value === "disabled";
}

function createRuntimeConfig(
  requestedEngine: string | null,
  source: AttendanceRuntimeSource,
  requestedMode: string | null = DEFAULT_MODE
): AttendanceRuntimeConfig {
  const isValidEngine = isRuntimeEngine(requestedEngine);
  const isValidMode = isRuntimeMode(requestedMode);

  return {
    engine: isValidEngine ? requestedEngine : DEFAULT_ENGINE,
    mode: isValidMode ? requestedMode : DEFAULT_MODE,
    source,
    isValid: isValidEngine && isValidMode,
    requestedEngine,
    requestedMode,
  };
}

function readLocalStorageOverride(): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(ATTENDANCE_RUNTIME_OVERRIDE_KEY);
  } catch {
    return null;
  }
}

export function resolveRuntimeConfig(input: AttendanceRuntimeConfigInput = {}): AttendanceRuntimeConfig {
  if (input.remoteEngine != null) {
    return createRuntimeConfig(input.remoteEngine, "remote", input.mode);
  }

  if (input.localStorageEngine != null) {
    return createRuntimeConfig(input.localStorageEngine, "localStorage", input.mode);
  }

  if (input.envEngine != null) {
    return createRuntimeConfig(input.envEngine, "env", input.mode);
  }

  return createRuntimeConfig(DEFAULT_ENGINE, "default", DEFAULT_MODE);
}

export function getRuntimeConfig(): AttendanceRuntimeConfig {
  const localStorageEngine = readLocalStorageOverride();
  if (localStorageEngine != null) {
    return resolveRuntimeConfig({ localStorageEngine });
  }

  const envEngine = import.meta.env.VITE_ATTENDANCE_ENGINE as string | undefined;
  if (envEngine != null && envEngine !== "") {
    return resolveRuntimeConfig({ envEngine });
  }

  return resolveRuntimeConfig();
}

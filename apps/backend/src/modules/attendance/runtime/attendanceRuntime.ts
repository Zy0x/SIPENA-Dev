import type {
  AttendanceRuntimeContext,
  AttendanceRuntimeEngine,
  AttendanceRuntimeGuardResult,
  AttendanceRuntimeMode,
  AttendanceRuntimeSource,
} from "../attendance.types";
import type { IncomingMessage } from "node:http";

const DEFAULT_ENGINE: AttendanceRuntimeEngine = "v1";
const DEFAULT_MODE: AttendanceRuntimeMode = "active";

let remoteOverride: { engine: AttendanceRuntimeEngine; mode: AttendanceRuntimeMode } | null = null;

function isRuntimeEngine(value: unknown): value is AttendanceRuntimeEngine {
  return value === "v1" || value === "v2";
}

function isRuntimeMode(value: unknown): value is AttendanceRuntimeMode {
  return value === "active" || value === "shadow" || value === "disabled";
}

function normalizeBoolean(value: string | undefined): boolean {
  return value === "1" || value === "true" || value === "yes";
}

function createGuard(
  requestedEngine: string | null,
  forcedEngine: AttendanceRuntimeEngine,
  forcedMode: AttendanceRuntimeMode,
  reason: AttendanceRuntimeGuardResult["reason"],
  message: string,
  isSafe = reason === "safe"
): AttendanceRuntimeGuardResult {
  return {
    isSafe,
    reason,
    message,
    requestedEngine,
    forcedEngine,
    forcedMode,
  };
}

export function resolveAttendanceRuntime(req: IncomingMessage): AttendanceRuntimeContext {
  const envEngine = process.env.ATTENDANCE_BACKEND_ENGINE ?? null;
  const envMode = process.env.ATTENDANCE_BACKEND_MODE ?? null;
  const requestedEngine = remoteOverride?.engine ?? envEngine ?? DEFAULT_ENGINE;
  const requestedMode = remoteOverride?.mode ?? envMode ?? DEFAULT_MODE;
  const source: AttendanceRuntimeSource = remoteOverride ? "remote" : envEngine || envMode ? "env" : "default";
  const allowV2 = normalizeBoolean(process.env.ATTENDANCE_BACKEND_ALLOW_V2);
  const writesEnabled = normalizeBoolean(process.env.ATTENDANCE_BACKEND_ENABLE_WRITES);
  const debugKey = process.env.ATTENDANCE_DEBUG_KEY;
  const adminKey = process.env.ATTENDANCE_RUNTIME_ADMIN_KEY;
  const isAdmin = !!adminKey && req.headers["x-sipena-admin-key"] === adminKey;
  const isDebug =
    normalizeBoolean(process.env.ATTENDANCE_DEBUG) ||
    (!!debugKey && req.headers["x-sipena-debug-key"] === debugKey);

  if (!isRuntimeEngine(requestedEngine) || !isRuntimeMode(requestedMode)) {
    return {
      engine: DEFAULT_ENGINE,
      mode: DEFAULT_MODE,
      source,
      guardResult: createGuard(
        typeof requestedEngine === "string" ? requestedEngine : null,
        DEFAULT_ENGINE,
        DEFAULT_MODE,
        "invalid-config",
        "Attendance runtime config is invalid. Backend forced V1."
      ),
      writesEnabled: false,
      isAdmin,
      isDebug,
    };
  }

  if (requestedEngine === "v2" && !allowV2) {
    return {
      engine: DEFAULT_ENGINE,
      mode: DEFAULT_MODE,
      source,
      guardResult: createGuard(
        requestedEngine,
        DEFAULT_ENGINE,
        DEFAULT_MODE,
        "v2-disabled",
        "Attendance V2 backend runtime is not enabled. Backend forced V1."
      ),
      writesEnabled: false,
      isAdmin,
      isDebug,
    };
  }

  return {
    engine: requestedEngine,
    mode: requestedMode,
    source,
    guardResult: createGuard(requestedEngine, requestedEngine, requestedMode, "safe", "Attendance runtime is safe."),
    writesEnabled: requestedEngine === "v2" && requestedMode === "active" && writesEnabled,
    isAdmin,
    isDebug,
  };
}

export function updateAttendanceRuntimeOverride(
  engine: string | null | undefined,
  mode: string | null | undefined
): AttendanceRuntimeGuardResult {
  if (!isRuntimeEngine(engine) || !isRuntimeMode(mode)) {
    remoteOverride = null;
    return createGuard(
      typeof engine === "string" ? engine : null,
      DEFAULT_ENGINE,
      DEFAULT_MODE,
      "invalid-config",
      "Invalid runtime override was rejected and cleared."
    );
  }

  if (engine === "v2" && !normalizeBoolean(process.env.ATTENDANCE_BACKEND_ALLOW_V2)) {
    remoteOverride = null;
    return createGuard(engine, DEFAULT_ENGINE, DEFAULT_MODE, "v2-disabled", "V2 override was rejected.");
  }

  remoteOverride = { engine, mode };
  return createGuard(engine, engine, mode, "safe", "Runtime override accepted.");
}

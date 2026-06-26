export type AttendanceRuntimeEngine = "v1" | "v2";

export type AttendanceRuntimeMode = "active" | "shadow" | "disabled";

export type AttendanceRuntimeSource = "env" | "localStorage" | "remote" | "default";

export type AttendanceRuntimeGuardReason =
  | "safe"
  | "invalid-config"
  | "v2-not-implemented"
  | "unsafe-mode"
  | "fallback";

export interface AttendanceRuntimeConfig {
  engine: AttendanceRuntimeEngine;
  mode: AttendanceRuntimeMode;
  source: AttendanceRuntimeSource;
  isValid: boolean;
  requestedEngine: string | null;
  requestedMode: string | null;
}

export interface AttendanceRuntimeGuardResult {
  isSafe: boolean;
  reason: AttendanceRuntimeGuardReason;
  message: string;
  requestedEngine: string | null;
  forcedEngine: AttendanceRuntimeEngine;
  forcedMode: AttendanceRuntimeMode;
}

export interface AttendanceRuntimeContextValue {
  engine: AttendanceRuntimeEngine;
  mode: AttendanceRuntimeMode;
  source: AttendanceRuntimeSource;
  guardResult: AttendanceRuntimeGuardResult;
  config: AttendanceRuntimeConfig;
}

export interface AttendanceRuntimeConfigInput {
  remoteEngine?: string | null;
  localStorageEngine?: string | null;
  envEngine?: string | null;
  mode?: string | null;
}

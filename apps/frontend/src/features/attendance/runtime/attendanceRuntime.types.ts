export type AttendanceRuntimeEngine = "v1" | "v2";

export type AttendanceRuntimeMode = "active" | "shadow" | "disabled";

export type AttendanceRuntimeSource = "env" | "localStorage" | "remote" | "default";

export interface AttendanceRuntimeConfig {
  engine: AttendanceRuntimeEngine;
  mode: AttendanceRuntimeMode;
  source: AttendanceRuntimeSource;
}

export interface AttendanceRuntimeGuardResult {
  isSafe: boolean;
  reason?: string;
  forcedEngine: AttendanceRuntimeEngine;
}

export interface AttendanceRuntimeContextValue {
  engine: AttendanceRuntimeEngine;
  mode: AttendanceRuntimeMode;
  source: AttendanceRuntimeSource;
  guardResult: AttendanceRuntimeGuardResult;
  config: AttendanceRuntimeConfig;
}

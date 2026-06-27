import type { ReactNode } from "react";
import type {
  AttendanceDatasetCanonical,
  AttendanceExportDatasetCanonical,
  AttendanceUiModelCanonical,
  AttendanceValidationIssue,
} from "../canonical";
import type { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";

export type AttendanceCanonicalProviderStatus = "idle" | "ready" | "error";
export type AttendanceCanonicalSource = "none" | "v1-wrapper" | "backend" | "v2-shadow";

export interface AttendanceCanonicalSnapshot {
  dataset: AttendanceDatasetCanonical | null;
  uiModel: AttendanceUiModelCanonical | null;
  exportDataset: AttendanceExportDatasetCanonical | null;
  issues: AttendanceValidationIssue[];
  source: AttendanceCanonicalSource;
  status: AttendanceCanonicalProviderStatus;
}

export interface AttendanceCanonicalContextValue extends AttendanceCanonicalSnapshot {
  runtime: AttendanceRuntimeContextValue;
  isCanonicalReady: boolean;
  isDebugEnabled: boolean;
}

export interface AttendanceProviderProps {
  children: ReactNode;
  initialDataset?: AttendanceDatasetCanonical | null;
  source?: AttendanceCanonicalSource;
  debugEnabled?: boolean;
}

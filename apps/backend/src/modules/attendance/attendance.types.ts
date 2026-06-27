export type AttendanceRuntimeEngine = "v1" | "v2";
export type AttendanceRuntimeMode = "active" | "shadow" | "disabled";
export type AttendanceRuntimeSource = "env" | "remote" | "default";
export type AttendanceStatusCode = "H" | "I" | "S" | "A" | "D" | "L" | "-" | (string & {});
export type AttendanceValidationSeverity = "info" | "warning" | "error" | "blocker";

export interface AttendanceRuntimeGuardResult {
  isSafe: boolean;
  reason: "safe" | "invalid-config" | "v2-disabled" | "write-disabled" | "fallback";
  message: string;
  requestedEngine: string | null;
  forcedEngine: AttendanceRuntimeEngine;
  forcedMode: AttendanceRuntimeMode;
}

export interface AttendanceRuntimeContext {
  engine: AttendanceRuntimeEngine;
  mode: AttendanceRuntimeMode;
  source: AttendanceRuntimeSource;
  guardResult: AttendanceRuntimeGuardResult;
  writesEnabled: boolean;
  isAdmin: boolean;
  isDebug: boolean;
}

export interface AttendanceValidationIssue {
  severity: AttendanceValidationSeverity;
  code: string;
  message: string;
  field?: string;
  recordId?: string;
}

export interface AttendanceRecordCanonical {
  id: string;
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatusCode;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface AttendanceRecordPatch {
  studentId: string;
  classId: string;
  date: string;
  status: AttendanceStatusCode | null;
  note?: string | null;
}

export interface AttendanceStudentCanonical {
  id: string;
  name: string;
  nisn: string;
}

export interface AttendanceClassCanonical {
  id: string;
  name: string;
  classKkm: number | null;
}

export interface AttendanceDayCanonical {
  date: string;
  isEffective: boolean;
  dayOfWeek: number;
  isWeekend?: boolean;
  holidayName?: string;
  eventName?: string;
}

export interface AttendanceHolidayCanonical {
  id: string;
  date: string;
  description: string;
  isNational: boolean;
}

export interface AttendanceCalendarEventCanonical {
  id: string;
  date: string;
  label: string;
  description: string | null;
  color: string;
}

export interface AttendanceLockCanonical {
  classId: string;
  month: string;
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
}

export interface AttendanceDailySummaryCanonical {
  date: string;
  presentCount: number;
  sickCount: number;
  permissionCount: number;
  absentCount: number;
  dispensationCount: number;
  leaveCount: number;
  totalCount: number;
}

export interface AttendanceMonthlySummaryCanonical {
  studentId: string;
  presentCount: number;
  sickCount: number;
  permissionCount: number;
  absentCount: number;
  dispensationCount: number;
  leaveCount: number;
  totalDays: number;
}

export interface AttendanceDatasetCanonical {
  classId: string;
  month: string;
  students: AttendanceStudentCanonical[];
  records: AttendanceRecordCanonical[];
  days: AttendanceDayCanonical[];
  holidays: AttendanceHolidayCanonical[];
  dayEvents: AttendanceCalendarEventCanonical[];
  locks: AttendanceLockCanonical[];
  monthlySummary?: AttendanceMonthlySummaryCanonical[];
  dailySummary?: AttendanceDailySummaryCanonical[];
}

export interface AttendanceExportDatasetCanonical {
  className: string;
  monthLabel: string;
  students: {
    number: number;
    name: string;
    nisn: string;
    records: { date: string; status: AttendanceStatusCode }[];
    totals: { H: number; S: number; I: number; A: number; D: number; total: number };
  }[];
  notes: string[];
}

export interface AttendanceApiSuccess<T> {
  data: T;
  issues?: AttendanceValidationIssue[];
}

export interface AttendanceApiError {
  error: {
    code: string;
    message: string;
    details?: AttendanceValidationIssue[];
  };
}

export interface AttendanceDatasetQuery {
  classId: string;
  month: string;
}

export interface AttendanceDailySummaryQuery extends AttendanceDatasetQuery {
  date: string;
}

export interface AttendanceBulkPatchBody {
  patches: AttendanceRecordPatch[];
}

export interface AttendanceNotePatchBody {
  studentId: string;
  classId: string;
  date: string;
  note: string | null;
}

export interface AttendanceShadowReport {
  enabled: boolean;
  mismatchCount: number;
  reports: unknown[];
}

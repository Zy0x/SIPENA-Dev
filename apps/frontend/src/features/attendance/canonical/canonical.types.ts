export type AttendanceCoreStatusCode = "H" | "I" | "S" | "A" | "D";
export type AttendanceDerivedStatusCode = "L" | "-";
export type AttendanceKnownStatusCode = AttendanceCoreStatusCode | AttendanceDerivedStatusCode;

// Keep V1 statuses stable while allowing future custom statuses through validation rules.
export type AttendanceStatusCode = AttendanceKnownStatusCode | (string & {});

export type AttendanceEngineSource = "v1" | "v2" | "import" | "ocr" | "shadow";
export type AttendanceValidationSeverity = "info" | "warning" | "error" | "blocker";

export interface AttendanceDebugMetadata {
  sourceEngine?: AttendanceEngineSource;
  sourceTable?: string;
  rawId?: string;
  eventContext?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface AttendanceStatusDefinition {
  code: AttendanceStatusCode;
  label: string;
  color: string;
  isPresence: boolean;
  isWritable: boolean;
  isDerived?: boolean;
  isCustom?: boolean;
}

export interface AttendanceRecordCanonical {
  id: string;
  studentId: string;
  classId: string;
  date: string; // ISO format: YYYY-MM-DD
  status: AttendanceStatusCode;
  note: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  debug?: AttendanceDebugMetadata; // Hidden from UI/export, allowed only for validation/shadow diagnostics.
}

export interface AttendanceRecordPatch {
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
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
  date: string; // YYYY-MM-DD
  isEffective: boolean;
  dayOfWeek: number; // 0-6
  isWeekend?: boolean;
  holidayName?: string;
  eventName?: string;
  lock?: AttendanceLockCanonical | null;
}

export interface AttendanceCalendarEventCanonical {
  id: string;
  date: string; // YYYY-MM-DD
  label: string;
  description: string | null;
  color: string;
}

export interface AttendanceHolidayCanonical {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  isNational: boolean;
}

export interface AttendanceLockCanonical {
  classId: string;
  month: string; // YYYY-MM
  isLocked: boolean;
  lockedAt: string | null;
  lockedBy: string | null;
}

export interface AttendanceNoteCanonical {
  id: string;
  recordId: string;
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  note: string;
}

export interface AttendanceDailySummaryCanonical {
  date: string; // YYYY-MM-DD
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

export interface AttendanceYearlySummaryCanonical {
  studentId: string;
  byMonth: Record<string, { presentCount: number; totalDays: number }>;
  yearlyPresentCount: number;
  yearlyTotalDays: number;
  percentage: number;
}

export interface AttendanceDatasetCanonical {
  classId: string;
  month: string; // YYYY-MM
  students: AttendanceStudentCanonical[];
  records: AttendanceRecordCanonical[];
  days: AttendanceDayCanonical[];
  holidays: AttendanceHolidayCanonical[];
  dayEvents: AttendanceCalendarEventCanonical[];
  locks: AttendanceLockCanonical[];
  notes?: AttendanceNoteCanonical[];
  monthlySummary?: AttendanceMonthlySummaryCanonical[];
  dailySummary?: AttendanceDailySummaryCanonical[];
  yearlySummary?: AttendanceYearlySummaryCanonical[];
  debug?: AttendanceDebugMetadata; // Never export.
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

export interface AttendanceUiModelCanonical {
  classId: string;
  month: string;
  students: AttendanceStudentCanonical[];
  rows: {
    studentId: string;
    studentName: string;
    nisn: string;
    cells: { date: string; status: AttendanceStatusCode; note: string | null; isEffective: boolean }[];
  }[];
  days: AttendanceDayCanonical[];
  holidays: AttendanceHolidayCanonical[];
  dayEvents: AttendanceCalendarEventCanonical[];
  locks: AttendanceLockCanonical[];
}

export interface AttendanceValidationIssue {
  severity: AttendanceValidationSeverity;
  code: string;
  message: string;
  field?: string;
  recordId?: string;
}

export interface AttendanceShadowComparisonResult {
  match: boolean;
  v1Record: unknown;
  v2Record: unknown;
  mismatchFields: string[];
}

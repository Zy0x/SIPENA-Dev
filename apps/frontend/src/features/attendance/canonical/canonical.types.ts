export type AttendanceStatusCode = "H" | "S" | "I" | "A" | "D" | "L" | "-";

export interface AttendanceStatusDefinition {
  code: AttendanceStatusCode;
  label: string;
  color: string;
  isPresence: boolean;
}

export interface AttendanceRecordCanonical {
  id: string;
  studentId: string;
  classId: string;
  date: string; // ISO format: YYYY-MM-DD
  status: AttendanceStatusCode;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>; // Hidden from export, allowed in debug
}

export interface AttendanceRecordPatch {
  studentId: string;
  classId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatusCode;
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
  holidayName?: string;
  eventName?: string;
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
  studentId: string;
  date: string;
  note: string;
}

export interface AttendanceDailySummaryCanonical {
  date: string;
  presentCount: number;
  absentCount: number;
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
  holidays: AttendanceHolidayCanonical[];
  dayEvents: AttendanceCalendarEventCanonical[];
  locks: AttendanceLockCanonical[];
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

export interface AttendanceValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface AttendanceShadowComparisonResult {
  match: boolean;
  v1Record: any;
  v2Record: any;
  mismatchFields: string[];
}

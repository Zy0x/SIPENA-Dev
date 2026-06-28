import type {
  AttendanceCalendarEventCanonical,
  AttendanceDatasetCanonical,
  AttendanceDailySummaryCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
  AttendanceMonthlySummaryCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceStudentCanonical,
  AttendanceValidationIssue,
  AttendanceYearlySummaryCanonical,
} from "../canonical/canonical.types";
import type { RuleEvaluationOutput } from "./rules/ruleEngine.types";
import type {
  CalendarOverride,
  CalendarSchoolScope,
  WorkDayFormat,
} from "./calendar/calendarEngine.types";

export type AttendanceV2AuditAction = "CREATE" | "UPDATE" | "DELETE" | "BULK_UPDATE" | "NOTE_UPDATE" | "VALIDATE";
export type AttendanceV2RuntimeMode = "disabled" | "shadow" | "active";
export type AttendanceV2OperationSource = "manual" | "import" | "ocr" | "sync" | "shadow";

export interface AttendanceAuditEventCanonical {
  id: string;
  timestamp: string;
  actor: string;
  action: AttendanceV2AuditAction;
  classId: string;
  studentId?: string;
  date?: string;
  beforeState: AttendanceRecordCanonical | AttendanceRecordCanonical[] | null;
  afterState: AttendanceRecordCanonical | AttendanceRecordCanonical[] | null;
  reasonCode: string;
  metadata?: Record<string, unknown>;
}

export interface ShadowComparisonReport {
  match: boolean;
  dateChecked: string;
  mismatchCount: number;
  mismatches: {
    studentId: string;
    date: string;
    v1Status: AttendanceStatusCode | null;
    v2Status: AttendanceStatusCode | null;
    mismatchFields: string[];
  }[];
}

export interface MutationValidationResult {
  valid: boolean;
  reasonCode: string;
  issues: string[];
  validationIssues: AttendanceValidationIssue[];
}

export interface AttendanceV2PatchResult {
  success: boolean;
  reasonCode: string;
  appliedRuleIds: string[];
  dataset: AttendanceDatasetCanonical;
  updatedRecord: AttendanceRecordCanonical | null;
  auditEvent: AttendanceAuditEventCanonical | null;
  auditEvents: AttendanceAuditEventCanonical[];
  validationIssues: string[];
  canonicalValidationIssues: AttendanceValidationIssue[];
  ruleExplanation: RuleEvaluationOutput | null;
  shadowComparison: ShadowComparisonReport | null;
}

export interface AttendanceV2BuildDatasetInput {
  classId: string;
  month: string;
  students: AttendanceStudentCanonical[];
  records?: AttendanceRecordCanonical[];
  holidays?: AttendanceHolidayCanonical[];
  dayEvents?: AttendanceCalendarEventCanonical[];
  locks?: AttendanceLockCanonical[];
  startDate?: string;
  endDate?: string;
  workDayFormat?: WorkDayFormat;
  overrides?: CalendarOverride[];
  schoolScope?: CalendarSchoolScope;
}

export interface AttendanceV2MutationOptions {
  actor: string;
  source?: AttendanceV2OperationSource;
  isRetroactiveEdit?: boolean;
  v1CanonicalRecords?: AttendanceRecordCanonical[];
}

export interface AttendanceV2SummaryBundle {
  daily: AttendanceDailySummaryCanonical[];
  monthly: AttendanceMonthlySummaryCanonical[];
  yearly?: AttendanceYearlySummaryCanonical[];
  classRecap: {
    presentCount: number;
    sickCount: number;
    permissionCount: number;
    absentCount: number;
    dispensationCount: number;
    leaveCount: number;
    totalCount: number;
  };
}

export interface AttendanceLockPatch {
  classId: string;
  month: string;
  isLocked: boolean;
}

export interface AttendanceHolidayPatch {
  date: string;
  description?: string;
}

export interface AttendanceDayEventPatch {
  date: string;
  label?: string;
  description?: string | null;
  color?: string | null;
  action: "upsert" | "delete";
}

export interface AttendanceNotePatchBody {
  studentId: string;
  classId: string;
  date: string;
  note: string | null;
}


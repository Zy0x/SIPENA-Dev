import {
  AttendanceStudentCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode
} from "../../canonical/canonical.types";
import { V2CalendarDay } from "../calendar/calendarEngine.types";

export interface AttendanceStatusDefinitionV2 {
  code: string;
  label: string;
  weight: number; // e.g., 1.0 = Hadir, 0.0 = Absent
  countsAsPresent: boolean;
  countsAsAbsence: boolean;
  exportCode: string;
  colorToken: string;
  behaviorFlags: string[]; // e.g. ['REQUIRES_NOTE', 'RETROACTIVE_ONLY']
}

export interface RuleEvaluationContext {
  student: AttendanceStudentCanonical;
  classId: string;
  date: string; // YYYY-MM-DD
  proposedStatus: AttendanceStatusCode | null;
  proposedNote: string | null;
  calendarDay: V2CalendarDay;
  locks: AttendanceLockCanonical[];
  existingRecord: AttendanceRecordCanonical | null;
  additionalContext?: Record<string, any>;
}

export enum RulePriority {
  HARD_BLOCK = 1,
  LOCK = 2,
  MANUAL_OVERRIDE = 3,
  SPECIFIC_POLICY = 4,
  EVENT = 5,
  DEFAULT = 6
}

export interface RuleEffect {
  selectedStatus?: AttendanceStatusCode | null;
  writeAllowed: boolean;
  reasonCode: string;
  validationIssues?: string[];
}

export interface AttendanceRule {
  id: string;
  name: string;
  scope: "school" | "class" | "student" | "date" | "status";
  priority: RulePriority;
  enabled: boolean;
  condition: (context: RuleEvaluationContext) => boolean;
  effect: (context: RuleEvaluationContext) => RuleEffect;
}

export interface RuleEvaluationOutput {
  selectedStatus: AttendanceStatusCode | null;
  writeAllowed: boolean;
  reasonCode: string;
  appliedRuleIds: string[];
  conflictNotes: string[];
  auditMetadata?: Record<string, any>;
}

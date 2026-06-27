import type {
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceStudentCanonical,
} from "../../canonical/canonical.types";
import type { V2CalendarDay } from "../calendar/calendarEngine.types";

export type AttendanceStatusBehaviorFlag =
  | "REQUIRES_NOTE"
  | "READ_ONLY"
  | "RETROACTIVE_ONLY"
  | "COUNTS_AS_PRESENT"
  | "COUNTS_AS_ABSENCE"
  | (string & {});

export interface AttendanceStatusDefinitionV2 {
  code: AttendanceStatusCode;
  label: string;
  weight: number;
  countsAsPresent: boolean;
  countsAsAbsence: boolean;
  exportCode: string;
  colorToken: string;
  behaviorFlags: AttendanceStatusBehaviorFlag[];
}

export interface RuleAdditionalContext {
  isRetroactiveEdit?: boolean;
  actorId?: string;
  source?: "manual" | "import" | "ocr" | "sync" | "shadow";
  [key: string]: unknown;
}

export interface RuleEvaluationContext {
  student: AttendanceStudentCanonical;
  classId: string;
  date: string; // YYYY-MM-DD
  proposedStatus: AttendanceStatusCode | null;
  proposedNote: string | null;
  calendarDay: V2CalendarDay | null;
  locks: AttendanceLockCanonical[];
  existingRecord: AttendanceRecordCanonical | null;
  additionalContext?: RuleAdditionalContext;
}

export enum RulePriority {
  HARD_BLOCK = 1,
  LOCK = 2,
  MANUAL_OVERRIDE = 3,
  SPECIFIC_POLICY = 4,
  EVENT = 5,
  DEFAULT = 6,
}

export type RuleScope = "school" | "class" | "student" | "date" | "status";
export type RuleConflictBehavior = "priority" | "merge" | "block";

export interface RuleEffect {
  selectedStatus?: AttendanceStatusCode | null;
  writeAllowed: boolean;
  reasonCode: string;
  validationIssues?: string[];
  auditMetadata?: Record<string, unknown>;
}

export interface AttendanceRule {
  id: string;
  name: string;
  scope: RuleScope;
  priority: RulePriority;
  enabled: boolean;
  conflictBehavior?: RuleConflictBehavior;
  condition: (context: RuleEvaluationContext) => boolean;
  effect: (context: RuleEvaluationContext) => RuleEffect;
}

export interface RuleConditionError {
  ruleId: string;
  message: string;
}

export interface RuleEvaluationAuditMetadata {
  totalMatchingRules: number;
  matchingRuleIds: string[];
  conditionErrors: RuleConditionError[];
  validationIssues: string[];
  resolvedPriority: RulePriority | null;
  appliedRuleScopes: RuleScope[];
  source?: RuleAdditionalContext["source"];
  isRetroactiveEdit?: boolean;
  [key: string]: unknown;
}

export interface RuleEvaluationOutput {
  selectedStatus: AttendanceStatusCode | null;
  writeAllowed: boolean;
  reasonCode: string;
  appliedRuleIds: string[];
  conflictNotes: string[];
  auditMetadata: RuleEvaluationAuditMetadata;
}

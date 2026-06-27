import type { AttendanceRule } from "./ruleEngine.types";
import { RulePriority } from "./ruleEngine.types";
import { getStatusDefinition, requiresNote } from "./statusEngine";

export const missingCalendarContextRule: AttendanceRule = {
  id: "rule-missing-calendar-context",
  name: "Missing Calendar Context Block",
  scope: "date",
  priority: RulePriority.HARD_BLOCK,
  enabled: true,
  conflictBehavior: "block",
  condition: (context) => context.calendarDay === null,
  effect: () => ({
    writeAllowed: false,
    selectedStatus: null,
    reasonCode: "MISSING_CALENDAR_CONTEXT",
    validationIssues: ["Calendar context is required before attendance rules can be evaluated."],
  }),
};

export const invalidStatusRule: AttendanceRule = {
  id: "rule-invalid-status",
  name: "Invalid Status Rejection",
  scope: "status",
  priority: RulePriority.HARD_BLOCK,
  enabled: true,
  conflictBehavior: "block",
  condition: (context) => {
    if (context.proposedStatus === null) return false;
    return getStatusDefinition(context.proposedStatus) === undefined;
  },
  effect: (context) => ({
    writeAllowed: false,
    selectedStatus: context.existingRecord?.status ?? null,
    reasonCode: "INVALID_STATUS_CODE",
    validationIssues: [`Status code '${context.proposedStatus}' is not registered in the system.`],
  }),
};

export const requiredNoteRule: AttendanceRule = {
  id: "rule-status-requires-note",
  name: "Required Note for Status",
  scope: "status",
  priority: RulePriority.HARD_BLOCK,
  enabled: true,
  conflictBehavior: "block",
  condition: (context) => {
    if (context.proposedStatus === null) return false;
    if (!requiresNote(context.proposedStatus)) return false;
    return !context.proposedNote?.trim();
  },
  effect: (context) => ({
    writeAllowed: false,
    selectedStatus: context.existingRecord?.status ?? null,
    reasonCode: "STATUS_REQUIRES_NOTE",
    validationIssues: [`Status '${context.proposedStatus}' requires a note.`],
  }),
};

export const lockPeriodRule: AttendanceRule = {
  id: "rule-lock-period",
  name: "Lock Period Verification",
  scope: "date",
  priority: RulePriority.LOCK,
  enabled: true,
  conflictBehavior: "block",
  condition: (context) => !!context.calendarDay?.blockedWriteState,
  effect: (context) => ({
    writeAllowed: false,
    selectedStatus: context.existingRecord ? context.existingRecord.status : null,
    reasonCode: context.calendarDay?.reasonCodes.includes("ADMINISTRATIVE_CLOSURE")
      ? "ADMINISTRATIVE_CLOSURE"
      : "LOCKED_PERIOD",
    auditMetadata: {
      calendarReasonCodes: context.calendarDay?.reasonCodes ?? [],
    },
  }),
};

export const nonEffectiveDayRule: AttendanceRule = {
  id: "rule-non-effective-day",
  name: "Non-Effective Day Block",
  scope: "date",
  priority: RulePriority.LOCK,
  enabled: true,
  conflictBehavior: "block",
  condition: (context) => context.calendarDay !== null && !context.calendarDay.isEffective,
  effect: (context) => ({
    writeAllowed: false,
    reasonCode: "NON_EFFECTIVE_DAY",
    selectedStatus: context.existingRecord ? context.existingRecord.status : "L",
    auditMetadata: {
      calendarReasonCodes: context.calendarDay?.reasonCodes ?? [],
    },
  }),
};

export const manualStatusRule: AttendanceRule = {
  id: "rule-manual-status-assignment",
  name: "Manual Status Assignment",
  scope: "status",
  priority: RulePriority.MANUAL_OVERRIDE,
  enabled: true,
  condition: (context) => context.calendarDay?.isEffective === true && context.proposedStatus !== null,
  effect: (context) => ({
    selectedStatus: context.proposedStatus,
    writeAllowed: true,
    reasonCode: "MANUAL_STATUS_ASSIGNMENT",
  }),
};

export const retroactiveUpdateRule: AttendanceRule = {
  id: "rule-retroactive-update",
  name: "Retroactive Attendance Update",
  scope: "student",
  priority: RulePriority.MANUAL_OVERRIDE,
  enabled: true,
  condition: (context) => {
    return (
      context.additionalContext?.isRetroactiveEdit === true &&
      context.calendarDay?.isEffective === true &&
      context.existingRecord !== null &&
      (context.proposedStatus !== null || context.proposedNote !== null)
    );
  },
  effect: (context) => ({
    selectedStatus: context.proposedStatus ?? context.existingRecord?.status ?? null,
    writeAllowed: true,
    reasonCode: "RETROACTIVE_UPDATE_ALLOWED",
    auditMetadata: {
      retroactive: true,
      existingRecordId: context.existingRecord?.id ?? null,
    },
  }),
};

export const eventEffectiveDayRule: AttendanceRule = {
  id: "rule-event-effective-day",
  name: "Event Effective Day Default",
  scope: "date",
  priority: RulePriority.EVENT,
  enabled: true,
  condition: (context) => {
    return (
      context.calendarDay?.isEffective === true &&
      context.proposedStatus === null &&
      ((context.calendarDay.metadata.appliedEventIds.length > 0) ||
        context.calendarDay.reasonCodes.includes("FORCED_EFFECTIVE_OVERRIDE"))
    );
  },
  effect: (context) => ({
    selectedStatus: context.existingRecord ? context.existingRecord.status : "H",
    writeAllowed: true,
    reasonCode: "EVENT_DAY_DEFAULT_HADIR",
    auditMetadata: {
      eventName: context.calendarDay?.eventName ?? null,
      calendarReasonCodes: context.calendarDay?.reasonCodes ?? [],
    },
  }),
};

export const defaultSchoolDayRule: AttendanceRule = {
  id: "rule-default-school-day",
  name: "Default School Day Behavior",
  scope: "school",
  priority: RulePriority.DEFAULT,
  enabled: true,
  condition: (context) => context.calendarDay?.isEffective === true && context.proposedStatus === null,
  effect: (context) => ({
    selectedStatus: context.existingRecord ? context.existingRecord.status : "H",
    writeAllowed: true,
    reasonCode: "DEFAULT_WEEKDAY_HADIR",
  }),
};

export const defaultRulesList: AttendanceRule[] = [
  missingCalendarContextRule,
  invalidStatusRule,
  requiredNoteRule,
  lockPeriodRule,
  nonEffectiveDayRule,
  manualStatusRule,
  retroactiveUpdateRule,
  eventEffectiveDayRule,
  defaultSchoolDayRule,
];

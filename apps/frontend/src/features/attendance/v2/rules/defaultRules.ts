import { AttendanceRule, RulePriority } from "./ruleEngine.types";
import { getStatusDefinition } from "./statusEngine";

/**
 * invalidStatusRule
 * Rejects any write attempt containing a status code not registered in the status engine.
 */
export const invalidStatusRule: AttendanceRule = {
  id: "rule-invalid-status",
  name: "Invalid Status Rejection",
  scope: "status",
  priority: RulePriority.HARD_BLOCK,
  enabled: true,
  condition: (context) => {
    if (context.proposedStatus === null) return false;
    return getStatusDefinition(context.proposedStatus) === undefined;
  },
  effect: (context) => ({
    writeAllowed: false,
    reasonCode: "INVALID_STATUS_CODE",
    validationIssues: [`Status code '${context.proposedStatus}' is not registered in the system.`],
  }),
};

/**
 * lockPeriodRule
 * Rejects write attempts on dates falling in write-blocked lock periods.
 */
export const lockPeriodRule: AttendanceRule = {
  id: "rule-lock-period",
  name: "Lock Period Verification",
  scope: "date",
  priority: RulePriority.LOCK,
  enabled: true,
  condition: (context) => {
    return context.calendarDay.blockedWriteState;
  },
  effect: (context) => ({
    writeAllowed: false,
    reasonCode: "LOCKED_PERIOD",
    selectedStatus: context.existingRecord ? context.existingRecord.status : null,
  }),
};

/**
 * nonEffectiveDayRule
 * Blocks recording standard attendance on non-effective days (weekends, holidays).
 */
export const nonEffectiveDayRule: AttendanceRule = {
  id: "rule-non-effective-day",
  name: "Non-Effective Day Block",
  scope: "date",
  priority: RulePriority.LOCK,
  enabled: true,
  condition: (context) => {
    return !context.calendarDay.isEffective;
  },
  effect: (context) => ({
    writeAllowed: false,
    reasonCode: "NON_EFFECTIVE_DAY",
    selectedStatus: "L", // Force status to L (Libur) on non-effective days
  }),
};

/**
 * defaultSchoolDayRule
 * Resolves standard weekday behavior: defaults to H (Hadir) when loading empty,
 * or applies the manually requested proposedStatus when editing.
 */
export const defaultSchoolDayRule: AttendanceRule = {
  id: "rule-default-school-day",
  name: "Default School Day Behavior",
  scope: "school",
  priority: RulePriority.DEFAULT,
  enabled: true,
  condition: (context) => {
    return context.calendarDay.isEffective;
  },
  effect: (context) => {
    if (context.proposedStatus !== null) {
      return {
        selectedStatus: context.proposedStatus,
        writeAllowed: true,
        reasonCode: "MANUAL_STATUS_ASSIGNMENT",
      };
    }
    return {
      selectedStatus: context.existingRecord ? context.existingRecord.status : "H",
      writeAllowed: true,
      reasonCode: "DEFAULT_WEEKDAY_HADIR",
    };
  },
};

export const defaultRulesList: AttendanceRule[] = [
  invalidStatusRule,
  lockPeriodRule,
  nonEffectiveDayRule,
  defaultSchoolDayRule,
];

import { getDay, parseISO } from "date-fns";
import type { AttendanceHolidayCanonical } from "../../canonical/canonical.types";
import {
  CalendarOverride,
  CalendarSchoolScope,
  CalendarScopedEvent,
  ConflictPriority,
  ResolvedCalendarRule,
  WorkDayFormat,
} from "./calendarEngine.types";

function scopedToSchool(schoolId: string | undefined, itemSchoolId: string | null | undefined): boolean {
  return !itemSchoolId || !schoolId || itemSchoolId === schoolId;
}

function compareByPriorityThenId<T extends { priority?: number | null; id: string }>(left: T, right: T): number {
  const priorityDelta = (right.priority ?? 0) - (left.priority ?? 0);
  if (priorityDelta !== 0) return priorityDelta;
  return left.id.localeCompare(right.id);
}

function compareOverridesForClass(classId: string) {
  return (left: CalendarOverride, right: CalendarOverride): number => {
    const leftClassSpecific = left.classId === classId ? 1 : 0;
    const rightClassSpecific = right.classId === classId ? 1 : 0;
    const specificityDelta = rightClassSpecific - leftClassSpecific;
    if (specificityDelta !== 0) return specificityDelta;
    return compareByPriorityThenId(left, right);
  };
}

function resolveHoliday(dateStr: string, holidays: AttendanceHolidayCanonical[]): ResolvedCalendarRule | null {
  const matchingHolidays = holidays.filter((holiday) => holiday.date === dateStr).sort((left, right) => {
    const nationalDelta = Number(right.isNational) - Number(left.isNational);
    if (nationalDelta !== 0) return nationalDelta;
    return left.id.localeCompare(right.id);
  });

  if (matchingHolidays.length === 0) return null;

  const primaryHoliday = matchingHolidays[0];
  return {
    isEffective: false,
    isHoliday: true,
    holidayName: primaryHoliday.description,
    priority: ConflictPriority.HOLIDAY,
    reasonCodes: ["HOLIDAY_RECORD"],
    appliedOverrideIds: [],
    appliedEventIds: [],
    appliedHolidayIds: matchingHolidays.map((holiday) => holiday.id),
  };
}

export function resolveConflictForDate(
  dateStr: string,
  classId: string,
  workDayFormat: WorkDayFormat,
  events: CalendarScopedEvent[],
  holidays: AttendanceHolidayCanonical[],
  overrides: CalendarOverride[],
  schoolScope: CalendarSchoolScope = {}
): ResolvedCalendarRule {
  const dateObj = parseISO(dateStr);
  const dayOfWeek = getDay(dateObj);
  const scopedOverrides = overrides
    .filter((override) => override.date === dateStr && (!override.classId || override.classId === classId))
    .filter((override) => scopedToSchool(schoolScope.schoolId, override.schoolId));

  const closures = scopedOverrides
    .filter((override) => override.type === "ADMINISTRATIVE_CLOSURE")
    .sort(compareOverridesForClass(classId));

  if (closures.length > 0) {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: closures[0].description,
      priority: ConflictPriority.LOCK_OR_CLOSURE,
      reasonCodes: ["ADMINISTRATIVE_CLOSURE"],
      appliedOverrideIds: closures.map((override) => override.id),
      appliedEventIds: [],
      appliedHolidayIds: [],
    };
  }

  const activeOverrides = scopedOverrides
    .filter((override) => override.type === "FORCED_EFFECTIVE" || override.type === "FORCED_HOLIDAY")
    .sort(compareOverridesForClass(classId));

  if (activeOverrides.length > 0) {
    const primaryOverride = activeOverrides[0];

    if (primaryOverride.type === "FORCED_EFFECTIVE") {
      return {
        isEffective: true,
        isHoliday: false,
        eventName: primaryOverride.description,
        priority: ConflictPriority.SCHOOL_OVERRIDE,
        reasonCodes: ["FORCED_EFFECTIVE_OVERRIDE"],
        appliedOverrideIds: activeOverrides.map((override) => override.id),
        appliedEventIds: [],
        appliedHolidayIds: [],
      };
    }

    return {
      isEffective: false,
      isHoliday: true,
      holidayName: primaryOverride.description,
      priority: ConflictPriority.SCHOOL_OVERRIDE,
      reasonCodes: ["FORCED_HOLIDAY_OVERRIDE"],
      appliedOverrideIds: activeOverrides.map((override) => override.id),
      appliedEventIds: [],
      appliedHolidayIds: [],
    };
  }

  const scopedEvents = events
    .filter((event) => event.date === dateStr)
    .filter((event) => scopedToSchool(schoolScope.schoolId, event.schoolId));

  const classEvents = scopedEvents
    .filter((event) => event.classId === classId)
    .sort(compareByPriorityThenId);

  if (classEvents.length > 0) {
    return {
      isEffective: true,
      isHoliday: false,
      eventName: classEvents[0].label,
      priority: ConflictPriority.CLASS_EVENT,
      reasonCodes: ["CLASS_SPECIFIC_EVENT"],
      appliedOverrideIds: [],
      appliedEventIds: classEvents.map((event) => event.id),
      appliedHolidayIds: holidays.filter((holiday) => holiday.date === dateStr).map((holiday) => holiday.id),
    };
  }

  const schoolEvents = scopedEvents
    .filter((event) => !event.classId)
    .sort(compareByPriorityThenId);

  if (schoolEvents.length > 0) {
    return {
      isEffective: true,
      isHoliday: false,
      eventName: schoolEvents[0].label,
      priority: ConflictPriority.SCHOOL_EVENT,
      reasonCodes: ["SCHOOL_WIDE_EVENT"],
      appliedOverrideIds: [],
      appliedEventIds: schoolEvents.map((event) => event.id),
      appliedHolidayIds: holidays.filter((holiday) => holiday.date === dateStr).map((holiday) => holiday.id),
    };
  }

  const holidayRule = resolveHoliday(dateStr, holidays);
  if (holidayRule) return holidayRule;

  if (dayOfWeek === 0) {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: "Hari Minggu",
      priority: ConflictPriority.WEEKEND_RULE,
      reasonCodes: ["WEEKEND_SUNDAY"],
      appliedOverrideIds: [],
      appliedEventIds: [],
      appliedHolidayIds: [],
    };
  }

  if (dayOfWeek === 6 && workDayFormat === "5days") {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: "Hari Sabtu (Libur)",
      priority: ConflictPriority.WEEKEND_RULE,
      reasonCodes: ["WEEKEND_SATURDAY"],
      appliedOverrideIds: [],
      appliedEventIds: [],
      appliedHolidayIds: [],
    };
  }

  return {
    isEffective: true,
    isHoliday: false,
    priority: ConflictPriority.DEFAULT_WEEKDAY,
    reasonCodes: ["DEFAULT_SCHOOL_DAY"],
    appliedOverrideIds: [],
    appliedEventIds: [],
    appliedHolidayIds: [],
  };
}

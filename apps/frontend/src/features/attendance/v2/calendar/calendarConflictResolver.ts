import {
  ConflictPriority,
  CalendarOverride,
  WorkDayFormat
} from "./calendarEngine.types";
import {
  AttendanceCalendarEventCanonical,
  AttendanceHolidayCanonical
} from "../../canonical/canonical.types";
import { getDay, parseISO } from "date-fns";

export interface ResolvedRule {
  isEffective: boolean;
  isHoliday: boolean;
  holidayName?: string;
  eventName?: string;
  priority: ConflictPriority;
  reasonCodes: string[];
}

/**
 * resolveConflictForDate
 * Implements a prioritized conflict resolution system for a specific date:
 * 1. Lock / Administrative Closure
 * 2. School-Specific Override (FORCED_EFFECTIVE, FORCED_HOLIDAY)
 * 3. Class-Specific Event
 * 4. School-Wide Event
 * 5. Holiday (National / Custom)
 * 6. Work-Day Format (Weekends)
 * 7. Default School Day
 */
export function resolveConflictForDate(
  dateStr: string,
  classId: string,
  workDayFormat: WorkDayFormat,
  events: AttendanceCalendarEventCanonical[],
  holidays: AttendanceHolidayCanonical[],
  overrides: CalendarOverride[]
): ResolvedRule {
  const dateObj = parseISO(dateStr);
  const dayOfWeek = getDay(dateObj); // 0 (Sunday) to 6 (Saturday)

  // 1. Explicit LOCK or ADMINISTRATIVE_CLOSURE overrides
  const closures = overrides.filter(
    (o) => o.date === dateStr && o.type === "ADMINISTRATIVE_CLOSURE" && (!o.classId || o.classId === classId)
  );
  if (closures.length > 0) {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: closures[0].description,
      priority: ConflictPriority.LOCK_OR_CLOSURE,
      reasonCodes: ["ADMINISTRATIVE_CLOSURE"],
    };
  }

  // 2. School / Class Specific Overrides (Forced Effective / Forced Holiday)
  const activeOverrides = overrides.filter(
    (o) => o.date === dateStr && (o.type === "FORCED_EFFECTIVE" || o.type === "FORCED_HOLIDAY") && (!o.classId || o.classId === classId)
  );
  if (activeOverrides.length > 0) {
    // Sort overrides: class-scoped overrides have higher specificity than school-wide ones
    const sortedOverrides = [...activeOverrides].sort((a, b) => (a.classId ? -1 : 1) - (b.classId ? -1 : 1));
    const primaryOverride = sortedOverrides[0];
    if (primaryOverride.type === "FORCED_EFFECTIVE") {
      return {
        isEffective: true,
        isHoliday: false,
        eventName: primaryOverride.description,
        priority: ConflictPriority.SCHOOL_OVERRIDE,
        reasonCodes: ["FORCED_EFFECTIVE_OVERRIDE"],
      };
    } else {
      return {
        isEffective: false,
        isHoliday: true,
        holidayName: primaryOverride.description,
        priority: ConflictPriority.SCHOOL_OVERRIDE,
        reasonCodes: ["FORCED_HOLIDAY_OVERRIDE"],
      };
    }
  }

  // 3. Class-Specific Event
  const classEvents = events.filter(
    (e) => e.date === dateStr && (e as any).classId === classId
  );
  if (classEvents.length > 0) {
    return {
      isEffective: true,
      isHoliday: false,
      eventName: classEvents[0].label,
      priority: ConflictPriority.CLASS_EVENT,
      reasonCodes: ["CLASS_SPECIFIC_EVENT"],
    };
  }

  // 4. School-Wide Event
  const schoolEvents = events.filter(
    (e) => e.date === dateStr && !(e as any).classId
  );
  if (schoolEvents.length > 0) {
    return {
      isEffective: true,
      isHoliday: false,
      eventName: schoolEvents[0].label,
      priority: ConflictPriority.CLASS_EVENT,
      reasonCodes: ["SCHOOL_WIDE_EVENT"],
    };
  }

  // 5. National / Custom Holiday
  const matchingHolidays = holidays.filter((h) => h.date === dateStr);
  if (matchingHolidays.length > 0) {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: matchingHolidays[0].description,
      priority: ConflictPriority.HOLIDAY,
      reasonCodes: ["HOLIDAY_RECORD"],
    };
  }

  // 6. Work-Day Format (Weekend rules)
  if (dayOfWeek === 0) {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: "Hari Minggu",
      priority: ConflictPriority.WEEKEND_RULE,
      reasonCodes: ["WEEKEND_SUNDAY"],
    };
  }
  if (dayOfWeek === 6 && workDayFormat === "5days") {
    return {
      isEffective: false,
      isHoliday: true,
      holidayName: "Hari Sabtu (Libur)",
      priority: ConflictPriority.WEEKEND_RULE,
      reasonCodes: ["WEEKEND_SATURDAY"],
    };
  }

  // 7. Default School Day (Weekday)
  return {
    isEffective: true,
    isHoliday: false,
    priority: ConflictPriority.DEFAULT_WEEKDAY,
    reasonCodes: ["DEFAULT_SCHOOL_DAY"],
  };
}

import {
  CalendarOverride,
  WorkDayFormat,
  V2CalendarDay
} from "./calendarEngine.types";
import {
  AttendanceCalendarEventCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical
} from "../../canonical/canonical.types";
import { resolveConflictForDate } from "./calendarConflictResolver";
import { parseISO, getDay } from "date-fns";

/**
 * computeEffectiveDay
 * Processes a single date against events, holidays, overrides, and locks to determine
 * its effective status, priority, and write permissions.
 */
export function computeEffectiveDay(
  dateStr: string,
  classId: string,
  workDayFormat: WorkDayFormat,
  events: AttendanceCalendarEventCanonical[],
  holidays: AttendanceHolidayCanonical[],
  overrides: CalendarOverride[],
  locks: AttendanceLockCanonical[]
): V2CalendarDay {
  // Lock checking based on month boundary (YYYY-MM)
  const monthStr = dateStr.substring(0, 7); // extract YYYY-MM
  const periodLock = locks.find((l) => l.classId === classId && l.month === monthStr);
  const isLocked = !!periodLock?.isLocked;

  // Resolve conflict priority
  const resolved = resolveConflictForDate(
    dateStr,
    classId,
    workDayFormat,
    events,
    holidays,
    overrides
  );

  const dateObj = parseISO(dateStr);
  const dayOfWeek = getDay(dateObj);

  const reasonCodes = [...resolved.reasonCodes];
  if (isLocked) {
    reasonCodes.push("LOCKED_PERIOD");
  }

  // A day blocks write operations if either:
  // 1. The month/period is locked.
  // 2. An administrative closure is explicitly scheduled.
  const blockedWriteState = isLocked || resolved.reasonCodes.includes("ADMINISTRATIVE_CLOSURE");

  return {
    date: dateStr,
    dayOfWeek,
    isEffective: resolved.isEffective,
    isEffectiveDay: resolved.isEffective, // compatibility alias
    isHoliday: resolved.isHoliday,
    holidayName: resolved.holidayName,
    eventName: resolved.eventName,
    eventPriority: resolved.priority,
    blockedWriteState,
    reasonCodes,
    metadata: {
      isLocked,
      lockInfo: periodLock || null
    }
  };
}

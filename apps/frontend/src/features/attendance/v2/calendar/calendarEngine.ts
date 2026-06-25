import { parseISO, addDays, format } from "date-fns";
import { CalendarEngineInputs, V2CalendarDay } from "./calendarEngine.types";
import { computeEffectiveDay } from "./effectiveDayEngine";

/**
 * generateCalendarDays
 * Stateful-free, deterministic school calendar day generation for a range of dates (inclusive).
 */
export function generateCalendarDays(inputs: CalendarEngineInputs): V2CalendarDay[] {
  const start = parseISO(inputs.startDate);
  const end = parseISO(inputs.endDate);
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) {
    throw new Error("Invalid start or end date format. Expected YYYY-MM-DD.");
  }

  if (start > end) {
    return [];
  }

  const calendarDays: V2CalendarDay[] = [];
  let current = start;

  while (current <= end) {
    const dateStr = format(current, "yyyy-MM-dd");

    const day = computeEffectiveDay(
      dateStr,
      inputs.classId,
      inputs.workDayFormat,
      inputs.events,
      inputs.holidays,
      inputs.overrides,
      inputs.locks
    );

    calendarDays.push(day);
    current = addDays(current, 1);
  }

  return calendarDays;
}

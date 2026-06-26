import { parseISO, addDays, format } from "date-fns";
import { CalendarEngineInputs, V2CalendarDay } from "./calendarEngine.types";
import { computeEffectiveDay } from "./effectiveDayEngine";
import { isIsoDateString } from "../../canonical/canonical.validation";

/**
 * generateCalendarDays
 * Stateful-free, deterministic school calendar day generation for a range of dates (inclusive).
 */
export function generateCalendarDays(inputs: CalendarEngineInputs): V2CalendarDay[] {
  if (!isIsoDateString(inputs.startDate) || !isIsoDateString(inputs.endDate)) {
    throw new Error("Invalid start or end date format. Expected YYYY-MM-DD.");
  }

  const start = parseISO(inputs.startDate);
  const end = parseISO(inputs.endDate);

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
      inputs.locks,
      inputs.schoolScope
    );

    calendarDays.push(day);
    current = addDays(current, 1);
  }

  return calendarDays;
}

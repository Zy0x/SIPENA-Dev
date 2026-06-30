import { addDays, compareAsc, differenceInCalendarDays, eachDayOfInterval, format, getDay, parseISO } from "date-fns";
import type {
  AttendanceV2BuildCalendarInput,
  AttendanceV2CalendarBuildResult,
  AttendanceV2CalendarDay,
  AttendanceV2CalendarEventDefinition,
  AttendanceV2ExpandedEvent,
  AttendanceV2RecurrenceException,
} from "./calendarEngine.types";

const ISO_DATE_LENGTH = 10;

function toDate(value: string): Date {
  return parseISO(value.slice(0, ISO_DATE_LENGTH));
}

function toIsoDate(value: Date): string {
  return format(value, "yyyy-MM-dd");
}

function maxDate(a: string, b: string): string {
  return compareAsc(toDate(a), toDate(b)) >= 0 ? a : b;
}

function minDate(a: string, b: string): string {
  return compareAsc(toDate(a), toDate(b)) <= 0 ? a : b;
}

function isWithin(date: string, start: string, end: string): boolean {
  return compareAsc(toDate(date), toDate(start)) >= 0 && compareAsc(toDate(date), toDate(end)) <= 0;
}

function getException(exceptions: AttendanceV2RecurrenceException[], date: string) {
  return exceptions.find((item) => item.date === date);
}

function shouldIncludeRecurringDate(event: AttendanceV2CalendarEventDefinition, date: string, emittedCount: number): boolean {
  const rule = event.recurrenceRule;
  if (!rule) return true;
  if (rule.until && compareAsc(toDate(date), toDate(rule.until)) > 0) return false;
  if (rule.count && emittedCount >= rule.count) return false;

  const interval = Math.max(1, rule.interval ?? 1);
  const start = toDate(event.startDate);
  const current = toDate(date);

  if (rule.freq === "daily") {
    return differenceInCalendarDays(current, start) % interval === 0;
  }

  if (rule.freq === "weekly") {
    const weekdays = rule.byWeekday?.length ? rule.byWeekday : [getDay(start)];
    const weekDistance = Math.floor(differenceInCalendarDays(current, start) / 7);
    return weekDistance >= 0 && weekDistance % interval === 0 && weekdays.includes(getDay(current));
  }

  if (rule.freq === "monthly") {
    const monthDistance =
      (current.getFullYear() - start.getFullYear()) * 12 + current.getMonth() - start.getMonth();
    return monthDistance >= 0 && monthDistance % interval === 0 && current.getDate() === start.getDate();
  }

  return false;
}

export function expandCalendarEvents(
  events: AttendanceV2CalendarEventDefinition[],
  rangeStart: string,
  rangeEnd: string
): AttendanceV2ExpandedEvent[] {
  const expanded: AttendanceV2ExpandedEvent[] = [];

  for (const event of events) {
    const eventStart = maxDate(event.startDate, rangeStart);
    const eventEnd = minDate(event.endDate, rangeEnd);
    if (compareAsc(toDate(eventStart), toDate(eventEnd)) > 0) continue;

    let emittedCount = 0;
    for (const day of eachDayOfInterval({ start: toDate(eventStart), end: toDate(eventEnd) })) {
      const date = toIsoDate(day);
      if (!shouldIncludeRecurringDate(event, date, emittedCount)) continue;

      const exception = getException(event.recurrenceExceptions, date);
      if (exception?.action === "skip") continue;

      expanded.push({
        id: `${event.id}:${date}`,
        sourceEventId: event.id,
        date,
        title: exception?.title || event.title,
        description: event.description,
        color: event.color,
        scopeType: event.scopeType,
        eventType: event.eventType,
        effectOnAttendance: exception?.effectOnAttendance || event.effectOnAttendance,
        priority: event.priority,
        reasonCode: `${event.scopeType.toUpperCase()}_${event.effectOnAttendance.toUpperCase()}`,
      });
      emittedCount += 1;
    }
  }

  return expanded.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return b.priority - a.priority;
  });
}

function defaultEffectiveForDate(date: string, workDayFormat: "5days" | "6days"): boolean {
  const day = getDay(toDate(date));
  if (day === 0) return false;
  if (workDayFormat === "5days" && day === 6) return false;
  return true;
}

function resolveEffectiveDay(
  date: string,
  context: AttendanceV2BuildCalendarInput["context"],
  events: AttendanceV2ExpandedEvent[],
  lockedMonths: Set<string>
): AttendanceV2CalendarDay {
  const dayOfWeek = getDay(toDate(date));
  const isWeekend = dayOfWeek === 0 || (context.workDayFormat === "5days" && dayOfWeek === 6);
  const inAcademicRange = isWithin(date, context.academicStartsOn, context.academicEndsOn);
  const baseEffective = inAcademicRange && defaultEffectiveForDate(date, context.workDayFormat);
  const byPriority = [...events].sort((a, b) => b.priority - a.priority);

  let isEffective = baseEffective;
  const reasonCodes: string[] = [
    inAcademicRange ? "ACADEMIC_RANGE_ACTIVE" : "OUTSIDE_ACADEMIC_RANGE",
    baseEffective ? "DEFAULT_WORK_DAY" : "DEFAULT_NON_EFFECTIVE_DAY",
  ];

  for (const event of byPriority) {
    if (event.effectOnAttendance === "effective" || event.effectOnAttendance === "force_present") {
      isEffective = true;
      reasonCodes.push(event.reasonCode);
      break;
    }
    if (event.effectOnAttendance === "non_effective" || event.effectOnAttendance === "blocked_write") {
      isEffective = false;
      reasonCodes.push(event.reasonCode);
      break;
    }
  }

  if (lockedMonths.has(date.slice(0, 7))) {
    reasonCodes.push("MONTH_LOCKED");
  }

  return {
    date,
    dayOfWeek,
    isWeekend,
    isEffective,
    labels: byPriority.map((event) => event.title),
    appliedEvents: byPriority,
    reasonCodes,
  };
}

export function buildAttendanceV2Calendar(input: AttendanceV2BuildCalendarInput): AttendanceV2CalendarBuildResult {
  const rangeStart = maxDate(input.rangeStart, input.context.academicStartsOn);
  const rangeEnd = minDate(input.rangeEnd, input.context.academicEndsOn);
  const expanded = expandCalendarEvents(input.events, input.rangeStart, input.rangeEnd);
  const days: AttendanceV2CalendarDay[] = [];

  if (compareAsc(toDate(rangeStart), toDate(rangeEnd)) > 0) {
    let cursor = toDate(input.rangeStart);
    const end = toDate(input.rangeEnd);
    while (compareAsc(cursor, end) <= 0) {
      const date = toIsoDate(cursor);
      days.push(resolveEffectiveDay(date, input.context, expanded.filter((event) => event.date === date), input.lockedMonths ?? new Set()));
      cursor = addDays(cursor, 1);
    }
    return { days, events: expanded };
  }

  for (const day of eachDayOfInterval({ start: toDate(input.rangeStart), end: toDate(input.rangeEnd) })) {
    const date = toIsoDate(day);
    days.push(resolveEffectiveDay(date, input.context, expanded.filter((event) => event.date === date), input.lockedMonths ?? new Set()));
  }

  return { days, events: expanded };
}

export type AttendanceV2CalendarScope = "national" | "school" | "class" | "user";
export type AttendanceV2EventType =
  | "holiday"
  | "activity"
  | "closure"
  | "effective_override"
  | "exam"
  | "info";
export type AttendanceV2EventEffect =
  | "non_effective"
  | "effective"
  | "info_only"
  | "force_present"
  | "blocked_write";

export interface AttendanceV2RecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  interval?: number;
  byWeekday?: number[];
  until?: string | null;
  count?: number | null;
}

export interface AttendanceV2RecurrenceException {
  date: string;
  action?: "skip" | "override";
  title?: string;
  effectOnAttendance?: AttendanceV2EventEffect;
}

export interface AttendanceV2CalendarContext {
  classId: string;
  schoolId: string | null;
  calendarId: string | null;
  timezone: string;
  workDayFormat: "5days" | "6days";
  academicStartsOn: string;
  academicEndsOn: string;
}

export interface AttendanceV2CalendarEventDefinition {
  id: string;
  userId: string;
  calendarId: string | null;
  schoolId: string | null;
  classId: string | null;
  scopeType: AttendanceV2CalendarScope;
  eventType: AttendanceV2EventType;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string;
  timezone: string;
  recurrenceRule: AttendanceV2RecurrenceRule | null;
  recurrenceExceptions: AttendanceV2RecurrenceException[];
  priority: number;
  effectOnAttendance: AttendanceV2EventEffect;
  color: string;
  source: string;
}

export interface AttendanceV2ExpandedEvent {
  id: string;
  sourceEventId: string;
  date: string;
  title: string;
  description: string | null;
  color: string;
  scopeType: AttendanceV2CalendarScope;
  eventType: AttendanceV2EventType;
  effectOnAttendance: AttendanceV2EventEffect;
  priority: number;
  reasonCode: string;
}

export interface AttendanceV2CalendarDay {
  date: string;
  dayOfWeek: number;
  isWeekend: boolean;
  isEffective: boolean;
  labels: string[];
  appliedEvents: AttendanceV2ExpandedEvent[];
  reasonCodes: string[];
}

export interface AttendanceV2BuildCalendarInput {
  context: AttendanceV2CalendarContext;
  rangeStart: string;
  rangeEnd: string;
  events: AttendanceV2CalendarEventDefinition[];
  lockedMonths?: Set<string>;
}

export interface AttendanceV2CalendarBuildResult {
  days: AttendanceV2CalendarDay[];
  events: AttendanceV2ExpandedEvent[];
}

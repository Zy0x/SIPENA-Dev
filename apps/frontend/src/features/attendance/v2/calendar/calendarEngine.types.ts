import type {
  AttendanceCalendarEventCanonical,
  AttendanceDayCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
} from "../../canonical/canonical.types";

export type WorkDayFormat = "5days" | "6days";

export type CalendarOverrideType = "FORCED_EFFECTIVE" | "FORCED_HOLIDAY" | "ADMINISTRATIVE_CLOSURE";
export type OverrideType = CalendarOverrideType;

export interface CalendarSchoolScope {
  schoolId?: string;
  academicYearId?: string;
  semesterId?: string;
}

export interface CalendarScopedEvent extends AttendanceCalendarEventCanonical {
  classId?: string | null;
  schoolId?: string | null;
  priority?: number | null;
}

export interface CalendarOverride {
  id: string;
  date: string; // YYYY-MM-DD
  type: CalendarOverrideType;
  description: string;
  classId?: string | null;
  schoolId?: string | null;
  priority?: number | null;
}

export interface CalendarEngineInputs {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  classId: string;
  schoolScope?: CalendarSchoolScope;
  workDayFormat: WorkDayFormat;
  events: CalendarScopedEvent[];
  holidays: AttendanceHolidayCanonical[];
  overrides: CalendarOverride[];
  locks: AttendanceLockCanonical[];
}

export enum ConflictPriority {
  LOCK_OR_CLOSURE = 1,
  SCHOOL_OVERRIDE = 2,
  CLASS_EVENT = 3,
  SCHOOL_EVENT = 4,
  HOLIDAY = 5,
  WEEKEND_RULE = 6,
  DEFAULT_WEEKDAY = 7,
}

export type CalendarReasonCode =
  | "ADMINISTRATIVE_CLOSURE"
  | "FORCED_EFFECTIVE_OVERRIDE"
  | "FORCED_HOLIDAY_OVERRIDE"
  | "CLASS_SPECIFIC_EVENT"
  | "SCHOOL_WIDE_EVENT"
  | "HOLIDAY_RECORD"
  | "WEEKEND_SUNDAY"
  | "WEEKEND_SATURDAY"
  | "DEFAULT_SCHOOL_DAY"
  | "LOCKED_PERIOD";

export interface CalendarDayMetadata {
  isLocked: boolean;
  lockInfo: AttendanceLockCanonical | null;
  appliedOverrideIds: string[];
  appliedEventIds: string[];
  appliedHolidayIds: string[];
  uiHint: "effective" | "holiday" | "event" | "locked" | "closed";
}

export interface V2CalendarDay extends AttendanceDayCanonical {
  isHoliday: boolean;
  eventPriority: ConflictPriority;
  blockedWriteState: boolean;
  reasonCodes: CalendarReasonCode[];
  metadata: CalendarDayMetadata;
  isEffectiveDay: boolean; // Compatibility alias for isEffective.
}

export interface ResolvedCalendarRule {
  isEffective: boolean;
  isHoliday: boolean;
  holidayName?: string;
  eventName?: string;
  priority: ConflictPriority;
  reasonCodes: CalendarReasonCode[];
  appliedOverrideIds: string[];
  appliedEventIds: string[];
  appliedHolidayIds: string[];
}

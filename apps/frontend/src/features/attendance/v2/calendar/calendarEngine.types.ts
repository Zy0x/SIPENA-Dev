import {
  AttendanceCalendarEventCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
  AttendanceDayCanonical
} from "../../canonical/canonical.types";

export type WorkDayFormat = "5days" | "6days";

export type OverrideType = "FORCED_EFFECTIVE" | "FORCED_HOLIDAY" | "ADMINISTRATIVE_CLOSURE";

export interface CalendarOverride {
  id: string;
  date: string; // YYYY-MM-DD
  type: OverrideType;
  description: string;
  classId?: string; // If provided, only applies to this class. Otherwise school-wide.
}

export interface CalendarEngineInputs {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  classId: string;
  workDayFormat: WorkDayFormat;
  events: AttendanceCalendarEventCanonical[];
  holidays: AttendanceHolidayCanonical[];
  overrides: CalendarOverride[];
  locks: AttendanceLockCanonical[];
  schoolScope?: Record<string, any>;
}

export enum ConflictPriority {
  LOCK_OR_CLOSURE = 1,
  SCHOOL_OVERRIDE = 2,
  CLASS_EVENT = 3,
  HOLIDAY = 4,
  WEEKEND_RULE = 5,
  DEFAULT_WEEKDAY = 6
}

export interface V2CalendarDay extends AttendanceDayCanonical {
  isHoliday: boolean;
  eventPriority: ConflictPriority;
  blockedWriteState: boolean;
  reasonCodes: string[];
  metadata?: Record<string, any>;
  
  // Backwards and alias compatibility
  isEffectiveDay: boolean; // Alias for isEffective
}

import type {
  AttendanceRecord,
  HolidayRecord,
  DayEvent,
  AttendanceLock,
  WorkDayFormat,
  AttendanceStatusValue
} from "@/hooks/useAttendance";
import type {
  AttendanceClassCanonical,
  AttendanceLockCanonical,
  AttendanceStudentCanonical,
} from "../canonical/canonical.types";

export type V1Record = AttendanceRecord;
export type V1Holiday = HolidayRecord;
export type V1DayEvent = DayEvent;
export type V1Lock = AttendanceLock;
export type V1WorkDayFormat = WorkDayFormat;
export type V1Status = AttendanceStatusValue;
export type V1DisplayStatus = V1Status | "L" | "-";

export interface V1CanonicalSeamInput {
  classInfo: AttendanceClassCanonical;
  month: string;
  students: AttendanceStudentCanonical[];
  attendanceRecords: V1Record[];
  holidays: V1Holiday[];
  dayEvents: V1DayEvent[];
  locks: V1Lock[];
}

export interface V1CanonicalSeamDraft {
  classId: string;
  month: string;
  students: AttendanceStudentCanonical[];
  recordsCount: number;
  holidaysCount: number;
  dayEventsCount: number;
  locks: AttendanceLockCanonical[];
  isReadOnlyDraft: true;
}

export interface V1SafetyGuardResult {
  isSafe: boolean;
  reason: "v1-active" | "non-v1-runtime";
  message: string;
}

export interface V1AdapterResult {
  attendanceRecords: V1Record[];
  holidays: V1Holiday[];
  dayEvents: V1DayEvent[];
  isLocked: boolean;
  dbAvailable: boolean;
  isLoading: boolean;
  isSaving: boolean;
  getAttendance: (studentId: string, date: Date) => V1Status | null;
  getAttendanceNote: (studentId: string, date: Date) => string;
  getDayEvent: (date: Date) => V1DayEvent | undefined;
  isHoliday: (date: Date) => boolean;
  getHolidayDescription: (date: Date) => string | null;
  setAttendance: (args: { studentId: string; date: string; status: V1Status }) => Promise<void>;
  updateNote: (args: { studentId: string; date: string; note: string | null }) => Promise<void>;
  toggleLock: () => Promise<void>;
}

import type {
  AttendanceRecord,
  HolidayRecord,
  DayEvent,
  AttendanceLock,
  WorkDayFormat,
  AttendanceStatusValue
} from "@/hooks/useAttendanceV2";
import type {
  AttendanceClassCanonical,
  AttendanceLockCanonical,
  AttendanceStudentCanonical,
} from "../canonical/canonical.types";

export type V2Record = AttendanceRecord;
export type V2Holiday = HolidayRecord;
export type V2DayEvent = DayEvent;
export type V2Lock = AttendanceLock;
export type V2WorkDayFormat = WorkDayFormat;
export type V2Status = AttendanceStatusValue;
export type V2DisplayStatus = V2Status | "L" | "-";

export interface V2CanonicalSeamInput {
  classInfo: AttendanceClassCanonical;
  month: string;
  students: AttendanceStudentCanonical[];
  attendanceRecords: V2Record[];
  holidays: V2Holiday[];
  dayEvents: V2DayEvent[];
  locks: V2Lock[];
}

export interface V2CanonicalSeamDraft {
  classId: string;
  month: string;
  students: AttendanceStudentCanonical[];
  recordsCount: number;
  holidaysCount: number;
  dayEventsCount: number;
  locks: AttendanceLockCanonical[];
  isReadOnlyDraft: true;
}

export interface V2SafetyGuardResult {
  isSafe: boolean;
  reason: "v2-active" | "non-v2-runtime";
  message: string;
}

export interface V2AdapterResult {
  attendanceRecords: V2Record[];
  holidays: V2Holiday[];
  dayEvents: V2DayEvent[];
  isLocked: boolean;
  dbAvailable: boolean;
  isLoading: boolean;
  isSaving: boolean;
  getAttendance: (studentId: string, date: Date) => V2Status | null;
  getAttendanceNote: (studentId: string, date: Date) => string;
  getDayEvent: (date: Date) => V2DayEvent | undefined;
  isHoliday: (date: Date) => boolean;
  getHolidayDescription: (date: Date) => string | null;
  setAttendance: (args: { studentId: string; date: string; status: V2Status }) => Promise<void>;
  updateNote: (args: { studentId: string; date: string; note: string | null }) => Promise<void>;
  toggleLock: () => Promise<void>;
}

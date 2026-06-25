import {
  AttendanceRecord,
  HolidayRecord,
  DayEvent,
  AttendanceLock,
  WorkDayFormat,
  AttendanceStatusValue
} from "@/hooks/useAttendance";

export type V1Record = AttendanceRecord;
export type V1Holiday = HolidayRecord;
export type V1DayEvent = DayEvent;
export type V1Lock = AttendanceLock;
export type V1WorkDayFormat = WorkDayFormat;
export type V1Status = AttendanceStatusValue;

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

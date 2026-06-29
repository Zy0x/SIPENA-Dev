import type {
  AttendanceCalendarEventCanonical,
  AttendanceDatasetCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
} from "../canonical/canonical.types";
import type {
  V2CanonicalSeamDraft,
  V2CanonicalSeamInput,
  V2DayEvent,
  V2Holiday,
  V2Lock,
  V2Record,
  V2Status,
} from "./attendanceV2.types";

const V2_STATUS_CODES = new Set<AttendanceStatusCode>(["H", "I", "S", "A", "D"]);

export function mapV2StatusToCanonical(status: V2Status | null | undefined): AttendanceStatusCode {
  return status && V2_STATUS_CODES.has(status) ? status : "-";
}

export function normalizeV2LockMonth(month: string): string {
  return month.length >= 7 ? month.slice(0, 7) : month;
}

export function mapV2RecordToCanonical(record: V2Record): AttendanceRecordCanonical {
  return {
    id: record.id ?? `${record.class_id}:${record.student_id}:${record.date}`,
    studentId: record.student_id,
    classId: record.class_id,
    date: record.date,
    status: mapV2StatusToCanonical(record.status),
    note: record.note ?? null,
    createdAt: null,
    updatedAt: null,
    debug: {
      sourceEngine: "v2",
      sourceTable: "attendance_records",
      rawId: record.id,
    },
  };
}

export function mapV2HolidayToCanonical(holiday: V2Holiday): AttendanceHolidayCanonical {
  return {
    id: holiday.id ?? `${holiday.date}:${holiday.description}`,
    date: holiday.date,
    description: holiday.description,
    isNational: false,
  };
}

export function mapV2DayEventToCanonical(event: V2DayEvent): AttendanceCalendarEventCanonical {
  return {
    id: event.id ?? `${event.date}:${event.label}`,
    date: event.date,
    label: event.label,
    description: event.description ?? null,
    color: event.color ?? "blue",
  };
}

export function mapV2LockToCanonical(lock: V2Lock): AttendanceLockCanonical {
  return {
    classId: lock.class_id,
    month: normalizeV2LockMonth(lock.month),
    isLocked: lock.is_locked,
    lockedAt: null,
    lockedBy: lock.user_id ?? null,
  };
}

export function mapV2SeamInputToCanonicalDataset(input: V2CanonicalSeamInput): AttendanceDatasetCanonical {
  return {
    classId: input.classInfo.id,
    month: normalizeV2LockMonth(input.month),
    students: input.students,
    records: input.attendanceRecords.map(mapV2RecordToCanonical),
    days: [],
    holidays: input.holidays.map(mapV2HolidayToCanonical),
    dayEvents: input.dayEvents.map(mapV2DayEventToCanonical),
    locks: input.locks.map(mapV2LockToCanonical),
  };
}

export function createV2CanonicalSeamDraft(input: V2CanonicalSeamInput): V2CanonicalSeamDraft {
  return {
    classId: input.classInfo.id,
    month: normalizeV2LockMonth(input.month),
    students: input.students,
    recordsCount: input.attendanceRecords.length,
    holidaysCount: input.holidays.length,
    dayEventsCount: input.dayEvents.length,
    locks: input.locks.map(mapV2LockToCanonical),
    isReadOnlyDraft: true,
  };
}

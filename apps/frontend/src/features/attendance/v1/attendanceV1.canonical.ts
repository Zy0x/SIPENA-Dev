import type {
  AttendanceCalendarEventCanonical,
  AttendanceDatasetCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
} from "../canonical/canonical.types";
import type {
  V1CanonicalSeamDraft,
  V1CanonicalSeamInput,
  V1DayEvent,
  V1Holiday,
  V1Lock,
  V1Record,
  V1Status,
} from "./attendanceV1.types";

const V1_STATUS_CODES = new Set<AttendanceStatusCode>(["H", "I", "S", "A", "D"]);

export function mapV1StatusToCanonical(status: V1Status | null | undefined): AttendanceStatusCode {
  return status && V1_STATUS_CODES.has(status) ? status : "-";
}

export function normalizeV1LockMonth(month: string): string {
  return month.length >= 7 ? month.slice(0, 7) : month;
}

export function mapV1RecordToCanonical(record: V1Record): AttendanceRecordCanonical {
  return {
    id: record.id ?? `${record.class_id}:${record.student_id}:${record.date}`,
    studentId: record.student_id,
    classId: record.class_id,
    date: record.date,
    status: mapV1StatusToCanonical(record.status),
    note: record.note ?? null,
    createdAt: "",
    updatedAt: "",
    metadata: {
      source: "attendance-v1",
    },
  };
}

export function mapV1HolidayToCanonical(holiday: V1Holiday): AttendanceHolidayCanonical {
  return {
    id: holiday.id ?? `${holiday.date}:${holiday.description}`,
    date: holiday.date,
    description: holiday.description,
    isNational: false,
  };
}

export function mapV1DayEventToCanonical(event: V1DayEvent): AttendanceCalendarEventCanonical {
  return {
    id: event.id ?? `${event.date}:${event.label}`,
    date: event.date,
    label: event.label,
    description: event.description ?? null,
    color: event.color ?? "blue",
  };
}

export function mapV1LockToCanonical(lock: V1Lock): AttendanceLockCanonical {
  return {
    classId: lock.class_id,
    month: normalizeV1LockMonth(lock.month),
    isLocked: lock.is_locked,
    lockedAt: null,
    lockedBy: lock.user_id ?? null,
  };
}

export function mapV1SeamInputToCanonicalDataset(input: V1CanonicalSeamInput): AttendanceDatasetCanonical {
  return {
    classId: input.classInfo.id,
    month: normalizeV1LockMonth(input.month),
    students: input.students,
    records: input.attendanceRecords.map(mapV1RecordToCanonical),
    holidays: input.holidays.map(mapV1HolidayToCanonical),
    dayEvents: input.dayEvents.map(mapV1DayEventToCanonical),
    locks: input.locks.map(mapV1LockToCanonical),
  };
}

export function createV1CanonicalSeamDraft(input: V1CanonicalSeamInput): V1CanonicalSeamDraft {
  return {
    classId: input.classInfo.id,
    month: normalizeV1LockMonth(input.month),
    students: input.students,
    recordsCount: input.attendanceRecords.length,
    holidaysCount: input.holidays.length,
    dayEventsCount: input.dayEvents.length,
    locks: input.locks.map(mapV1LockToCanonical),
    isReadOnlyDraft: true,
  };
}

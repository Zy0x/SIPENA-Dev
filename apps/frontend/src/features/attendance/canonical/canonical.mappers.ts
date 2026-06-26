import {
  AttendanceCalendarEventCanonical,
  AttendanceDatasetCanonical,
  AttendanceExportDatasetCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceUiModelCanonical,
} from "./canonical.types";

export interface V1AttendanceRecordLike {
  id?: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatusCode;
  note?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface V1HolidayLike {
  id?: string;
  date: string;
  description?: string | null;
  is_national?: boolean | null;
}

export interface V1DayEventLike {
  id?: string;
  date: string;
  label?: string | null;
  description?: string | null;
  color?: string | null;
}

export interface V1LockLike {
  class_id: string;
  month: string;
  is_locked: boolean;
  locked_at?: string | null;
  locked_by?: string | null;
  user_id?: string | null;
}

export interface V1RecordOutput {
  id?: string;
  student_id: string;
  class_id: string;
  date: string;
  status: AttendanceStatusCode | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function normalizeCanonicalMonth(month: string): string {
  return month.length >= 7 ? month.slice(0, 7) : month;
}

export function mapV1RecordToCanonical(record: V1AttendanceRecordLike): AttendanceRecordCanonical {
  return {
    id: record.id || `${record.class_id}:${record.student_id}:${record.date}`,
    studentId: record.student_id,
    classId: record.class_id,
    date: record.date,
    status: record.status,
    note: record.note ?? null,
    createdAt: record.created_at ?? null,
    updatedAt: record.updated_at ?? null,
    debug: {
      sourceEngine: "v1",
      sourceTable: "attendance_records",
      rawId: record.id,
    },
  };
}

export function mapCanonicalToV1Record(canonical: AttendanceRecordCanonical): V1RecordOutput {
  return {
    id: canonical.id || undefined,
    student_id: canonical.studentId,
    class_id: canonical.classId,
    date: canonical.date,
    status: canonical.status === "-" || canonical.status === "L" ? null : canonical.status,
    note: canonical.note,
    created_at: canonical.createdAt,
    updated_at: canonical.updatedAt,
  };
}

export function mapV1HolidayToCanonical(holiday: V1HolidayLike): AttendanceHolidayCanonical {
  return {
    id: holiday.id || `${holiday.date}:${holiday.description ?? ""}`,
    date: holiday.date,
    description: holiday.description ?? "",
    isNational: !!holiday.is_national,
  };
}

export function mapV1DayEventToCanonical(event: V1DayEventLike): AttendanceCalendarEventCanonical {
  return {
    id: event.id || `${event.date}:${event.label ?? ""}`,
    date: event.date,
    label: event.label ?? "",
    description: event.description ?? null,
    color: event.color ?? "blue",
  };
}

export function mapV1LockToCanonical(lock: V1LockLike): AttendanceLockCanonical {
  return {
    classId: lock.class_id,
    month: normalizeCanonicalMonth(lock.month),
    isLocked: !!lock.is_locked,
    lockedAt: lock.locked_at ?? null,
    lockedBy: lock.locked_by ?? lock.user_id ?? null,
  };
}

export function mapCanonicalDatasetToExport(
  dataset: AttendanceDatasetCanonical,
  className: string,
  monthLabel: string
): AttendanceExportDatasetCanonical {
  const notesList: string[] = [];
  const recordsByStudent = new Map<string, AttendanceRecordCanonical[]>();

  for (const record of dataset.records) {
    const records = recordsByStudent.get(record.studentId) ?? [];
    records.push(record);
    recordsByStudent.set(record.studentId, records);
  }

  const studentsMapped = dataset.students.map((student, index) => {
    const studentRecords = recordsByStudent.get(student.id) ?? [];
    const totals = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };

    const records = studentRecords.map((record) => {
      if (record.status === "H" || record.status === "S" || record.status === "I" || record.status === "A" || record.status === "D") {
        totals[record.status] += 1;
        if (record.status !== "H") {
          totals.total += 1;
        }
      }

      if (record.note) {
        notesList.push(`${student.name}: ${record.note}`);
      }

      return {
        date: record.date,
        status: record.status,
      };
    });

    return {
      number: index + 1,
      name: student.name,
      nisn: student.nisn,
      records,
      totals,
    };
  });

  return {
    className,
    monthLabel,
    students: studentsMapped,
    notes: notesList,
  };
}

export function mapCanonicalDatasetToUI(dataset: AttendanceDatasetCanonical): AttendanceUiModelCanonical {
  const dayByDate = new Map(dataset.days.map((day) => [day.date, day]));

  return {
    classId: dataset.classId,
    month: dataset.month,
    students: dataset.students,
    rows: dataset.students.map((student) => {
      const studentRecords = dataset.records.filter((record) => record.studentId === student.id);

      return {
        studentId: student.id,
        studentName: student.name,
        nisn: student.nisn,
        cells: studentRecords.map((record) => ({
          date: record.date,
          status: record.status,
          note: record.note,
          isEffective: dayByDate.get(record.date)?.isEffective ?? true,
        })),
      };
    }),
    days: dataset.days,
    holidays: dataset.holidays,
    dayEvents: dataset.dayEvents,
    locks: dataset.locks,
  };
}

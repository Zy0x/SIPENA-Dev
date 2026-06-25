import {
  AttendanceRecordCanonical,
  AttendanceHolidayCanonical,
  AttendanceCalendarEventCanonical,
  AttendanceLockCanonical,
  AttendanceExportDatasetCanonical,
  AttendanceDatasetCanonical
} from "./canonical.types";

/**
 * mapV1RecordToCanonical
 * Maps legacy V1 attendance records to the Canonical Record format.
 */
export function mapV1RecordToCanonical(record: any): AttendanceRecordCanonical {
  return {
    id: record.id || "",
    studentId: record.student_id,
    classId: record.class_id,
    date: record.date,
    status: record.status,
    note: record.note || null,
    createdAt: record.created_at || new Date().toISOString(),
    updatedAt: record.updated_at || new Date().toISOString(),
  };
}

/**
 * mapCanonicalToV1Record
 * Maps Canonical Record format back to the legacy V1 record format.
 */
export function mapCanonicalToV1Record(canonical: AttendanceRecordCanonical): any {
  return {
    id: canonical.id || undefined,
    student_id: canonical.studentId,
    class_id: canonical.classId,
    date: canonical.date,
    status: canonical.status,
    note: canonical.note,
    created_at: canonical.createdAt,
    updated_at: canonical.updatedAt,
  };
}

/**
 * mapV1HolidayToCanonical
 * Maps legacy V1 holiday records to the Canonical Holiday format.
 */
export function mapV1HolidayToCanonical(holiday: any): AttendanceHolidayCanonical {
  return {
    id: holiday.id || "",
    date: holiday.date,
    description: holiday.description || "",
    isNational: !!holiday.is_national,
  };
}

/**
 * mapV1DayEventToCanonical
 * Maps legacy V1 day event records to the Canonical Calendar Event format.
 */
export function mapV1DayEventToCanonical(event: any): AttendanceCalendarEventCanonical {
  return {
    id: event.id || "",
    date: event.date,
    label: event.label || "",
    description: event.description || null,
    color: event.color || "blue",
  };
}

/**
 * mapV1LockToCanonical
 * Maps legacy V1 locks to the Canonical Lock format.
 */
export function mapV1LockToCanonical(lock: any): AttendanceLockCanonical {
  return {
    classId: lock.class_id,
    month: lock.month,
    isLocked: !!lock.is_locked,
    lockedAt: lock.locked_at || null,
    lockedBy: lock.locked_by || null,
  };
}

/**
 * mapCanonicalDatasetToExport
 * Normalizes a canonical dataset to an export-safe model with no engine leakages.
 */
export function mapCanonicalDatasetToExport(
  dataset: AttendanceDatasetCanonical,
  className: string,
  monthLabel: string
): AttendanceExportDatasetCanonical {
  const notesList: string[] = [];

  const studentsMapped = dataset.students.map((student, index) => {
    const studentRecords = dataset.records.filter(r => r.studentId === student.id);
    
    const totals = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };
    const records = studentRecords.map(r => {
      if (r.status in totals) {
        totals[r.status as keyof typeof totals] += 1;
        if (r.status !== "H") {
          totals.total += 1;
        }
      }
      
      if (r.note) {
        notesList.push(`${student.name}: ${r.note}`);
      }

      return {
        date: r.date,
        status: r.status,
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

/**
 * mapCanonicalDatasetToUI
 * Converts a canonical dataset to the structure consumed by the UI components.
 */
export function mapCanonicalDatasetToUI(dataset: AttendanceDatasetCanonical): any {
  // Gracefully maps the data to the format matching V1 components expectations
  return {
    attendance: dataset.records.map(mapCanonicalToV1Record),
    holidays: dataset.holidays,
    dayEvents: dataset.dayEvents,
    locks: dataset.locks,
  };
}

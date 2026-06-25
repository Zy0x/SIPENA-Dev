import { describe, expect, it } from "vitest";
import {
  mapV1RecordToCanonical,
  mapCanonicalToV1Record,
  mapV1HolidayToCanonical,
  mapV1DayEventToCanonical,
  mapV1LockToCanonical,
  mapCanonicalDatasetToExport,
  mapCanonicalDatasetToUI,
} from "./canonical.mappers";
import {
  validateCanonicalRecord,
  validateCanonicalDataset,
} from "./canonical.validation";
import {
  AttendanceRecordCanonical,
  AttendanceDatasetCanonical,
} from "./canonical.types";

describe("Attendance Canonical Model - Mappers", () => {
  it("should map V1 record to Canonical record correctly", () => {
    const v1Record = {
      id: "rec-1",
      student_id: "student-1",
      class_id: "class-1",
      date: "2026-06-01",
      status: "H",
      note: "Hadir tepat waktu",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: "2026-06-01T08:05:00.000Z",
    };

    const canonical = mapV1RecordToCanonical(v1Record);
    expect(canonical.id).toBe("rec-1");
    expect(canonical.studentId).toBe("student-1");
    expect(canonical.classId).toBe("class-1");
    expect(canonical.date).toBe("2026-06-01");
    expect(canonical.status).toBe("H");
    expect(canonical.note).toBe("Hadir tepat waktu");
    expect(canonical.createdAt).toBe("2026-06-01T08:00:00.000Z");
  });

  it("should map Canonical record to V1 record correctly", () => {
    const canonical: AttendanceRecordCanonical = {
      id: "rec-1",
      studentId: "student-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
      note: "Hadir tepat waktu",
      createdAt: "2026-06-01T08:00:00.000Z",
      updatedAt: "2026-06-01T08:05:00.000Z",
    };

    const v1Record = mapCanonicalToV1Record(canonical);
    expect(v1Record.id).toBe("rec-1");
    expect(v1Record.student_id).toBe("student-1");
    expect(v1Record.class_id).toBe("class-1");
    expect(v1Record.date).toBe("2026-06-01");
    expect(v1Record.status).toBe("H");
    expect(v1Record.note).toBe("Hadir tepat waktu");
  });

  it("should map V1 Holiday to Canonical", () => {
    const v1Holiday = {
      id: "hol-1",
      date: "2026-06-17",
      description: "Idul Adha",
      is_national: true,
    };
    const canonical = mapV1HolidayToCanonical(v1Holiday);
    expect(canonical.id).toBe("hol-1");
    expect(canonical.date).toBe("2026-06-17");
    expect(canonical.description).toBe("Idul Adha");
    expect(canonical.isNational).toBe(true);
  });

  it("should map V1 DayEvent to Canonical", () => {
    const v1Event = {
      id: "evt-1",
      date: "2026-06-18",
      label: "Class Meeting",
      description: "Pertemuan antar kelas",
      color: "red",
    };
    const canonical = mapV1DayEventToCanonical(v1Event);
    expect(canonical.id).toBe("evt-1");
    expect(canonical.date).toBe("2026-06-18");
    expect(canonical.label).toBe("Class Meeting");
    expect(canonical.description).toBe("Pertemuan antar kelas");
    expect(canonical.color).toBe("red");
  });

  it("should map V1 Lock to Canonical", () => {
    const v1Lock = {
      class_id: "class-1",
      month: "2026-06",
      is_locked: true,
      locked_at: "2026-06-25T12:00:00Z",
      locked_by: "user-1",
    };
    const canonical = mapV1LockToCanonical(v1Lock);
    expect(canonical.classId).toBe("class-1");
    expect(canonical.month).toBe("2026-06");
    expect(canonical.isLocked).toBe(true);
    expect(canonical.lockedAt).toBe("2026-06-25T12:00:00Z");
  });

  it("should map Canonical Dataset to Export cleanly without metadata leakages", () => {
    const dataset: AttendanceDatasetCanonical = {
      classId: "class-1",
      month: "2026-06",
      students: [
        { id: "student-1", name: "Budi", nisn: "12345" },
        { id: "student-2", name: "Ani", nisn: "67890" },
      ],
      records: [
        {
          id: "rec-1",
          studentId: "student-1",
          classId: "class-1",
          date: "2026-06-01",
          status: "H",
          note: null,
          createdAt: "",
          updatedAt: "",
          metadata: { source: "v1-engine", debug: true },
        },
        {
          id: "rec-2",
          studentId: "student-2",
          classId: "class-1",
          date: "2026-06-01",
          status: "S",
          note: "Sakit demam",
          createdAt: "",
          updatedAt: "",
        },
      ],
      holidays: [],
      dayEvents: [],
      locks: [],
    };

    const exported = mapCanonicalDatasetToExport(dataset, "Kelas 10A", "Juni 2026");
    expect(exported.className).toBe("Kelas 10A");
    expect(exported.monthLabel).toBe("Juni 2026");
    expect(exported.students).toHaveLength(2);
    
    // Check student 1 Budi
    const budi = exported.students[0];
    expect(budi.number).toBe(1);
    expect(budi.name).toBe("Budi");
    expect(budi.totals.H).toBe(1);
    expect(budi.totals.total).toBe(0); // Only counts non-H codes towards total absences

    // Check student 2 Ani
    const ani = exported.students[1];
    expect(ani.number).toBe(2);
    expect(ani.name).toBe("Ani");
    expect(ani.totals.S).toBe(1);
    expect(ani.totals.total).toBe(1);

    // Check notes list format
    expect(exported.notes).toEqual(["Ani: Sakit demam"]);
  });
});

describe("Attendance Canonical Model - Validations", () => {
  it("should validate a valid record with no issues", () => {
    const record: AttendanceRecordCanonical = {
      id: "rec-1",
      studentId: "student-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
      note: null,
      createdAt: "",
      updatedAt: "",
    };

    const issues = validateCanonicalRecord(record);
    expect(issues).toHaveLength(0);
  });

  it("should detect invalid date formats", () => {
    const record: AttendanceRecordCanonical = {
      id: "rec-1",
      studentId: "student-1",
      classId: "class-1",
      date: "2026/06/01", // invalid format
      status: "H",
      note: null,
      createdAt: "",
      updatedAt: "",
    };

    const issues = validateCanonicalRecord(record);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("INVALID_DATE_FORMAT");
  });

  it("should detect invalid status codes", () => {
    const record: AttendanceRecordCanonical = {
      id: "rec-1",
      studentId: "student-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "XYZ" as any, // invalid status
      note: null,
      createdAt: "",
      updatedAt: "",
    };

    const issues = validateCanonicalRecord(record);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("INVALID_STATUS_CODE");
  });

  it("should detect locked writes", () => {
    const record: AttendanceRecordCanonical = {
      id: "rec-1",
      studentId: "student-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
      note: null,
      createdAt: "",
      updatedAt: "",
    };

    const issues = validateCanonicalRecord(record, true);
    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("LOCKED_PERIOD_WRITE");
  });

  it("should detect duplicate student-date records and metadata leakages in dataset", () => {
    const dataset: AttendanceDatasetCanonical = {
      classId: "class-1",
      month: "2026-06",
      students: [],
      records: [
        {
          id: "rec-1",
          studentId: "student-1",
          classId: "class-1",
          date: "2026-06-01",
          status: "H",
          note: null,
          createdAt: "",
          updatedAt: "",
          metadata: { engine: "v2-engine" }, // leak warning
        },
        {
          id: "rec-2",
          studentId: "student-1", // duplicate student-date
          classId: "class-1",
          date: "2026-06-01",
          status: "S",
          note: null,
          createdAt: "",
          updatedAt: "",
        },
      ],
      holidays: [],
      dayEvents: [],
      locks: [],
    };

    const issues = validateCanonicalDataset(dataset);
    expect(issues.some(i => i.code === "DUPLICATE_RECORD")).toBe(true);
    expect(issues.some(i => i.code === "ENGINE_METADATA_LEAKAGE")).toBe(true);
  });
});

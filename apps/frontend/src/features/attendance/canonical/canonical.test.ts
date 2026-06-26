import { describe, expect, it } from "vitest";
import {
  mapCanonicalDatasetToExport,
  mapCanonicalDatasetToUI,
  mapCanonicalToV1Record,
  mapV1DayEventToCanonical,
  mapV1HolidayToCanonical,
  mapV1LockToCanonical,
  mapV1RecordToCanonical,
} from "./canonical.mappers";
import type {
  AttendanceDatasetCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
} from "./canonical.types";
import {
  validateCanonicalDataset,
  validateCanonicalRecord,
  validateExportPayloadHasNoEngineLeakage,
  validateRecordPatch,
  validateStatus,
} from "./canonical.validation";

function createRecord(overrides: Partial<AttendanceRecordCanonical> = {}): AttendanceRecordCanonical {
  return {
    id: "rec-1",
    studentId: "murid-1",
    classId: "class-1",
    date: "2026-06-01",
    status: "H",
    note: null,
    createdAt: null,
    updatedAt: null,
    ...overrides,
  };
}

function createDataset(overrides: Partial<AttendanceDatasetCanonical> = {}): AttendanceDatasetCanonical {
  return {
    classId: "class-1",
    month: "2026-06",
    students: [{ id: "murid-1", name: "Budi", nisn: "12345" }],
    records: [createRecord()],
    days: [
      {
        date: "2026-06-01",
        isEffective: true,
        dayOfWeek: 1,
      },
    ],
    holidays: [],
    dayEvents: [],
    locks: [],
    ...overrides,
  };
}

describe("attendance canonical mappers", () => {
  it("maps V1 record to canonical record with debug metadata isolated from export", () => {
    const canonical = mapV1RecordToCanonical({
      id: "rec-1",
      student_id: "murid-1",
      class_id: "class-1",
      date: "2026-06-01",
      status: "H",
      note: "Hadir tepat waktu",
      created_at: "2026-06-01T08:00:00.000Z",
      updated_at: "2026-06-01T08:05:00.000Z",
    });

    expect(canonical).toMatchObject({
      id: "rec-1",
      studentId: "murid-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
      note: "Hadir tepat waktu",
      createdAt: "2026-06-01T08:00:00.000Z",
      debug: {
        sourceEngine: "v1",
        sourceTable: "attendance_records",
      },
    });
  });

  it("maps canonical record back to V1 and keeps derived display states out of writes", () => {
    expect(mapCanonicalToV1Record(createRecord({ status: "H" })).status).toBe("H");
    expect(mapCanonicalToV1Record(createRecord({ status: "-" })).status).toBeNull();
    expect(mapCanonicalToV1Record(createRecord({ status: "L" })).status).toBeNull();
  });

  it("maps V1 calendar metadata to canonical entities", () => {
    expect(
      mapV1HolidayToCanonical({
        id: "holiday-1",
        date: "2026-06-17",
        description: "Libur nasional",
        is_national: true,
      })
    ).toMatchObject({
      id: "holiday-1",
      date: "2026-06-17",
      description: "Libur nasional",
      isNational: true,
    });

    expect(
      mapV1DayEventToCanonical({
        id: "event-1",
        date: "2026-06-18",
        label: "Kegiatan kelas",
        description: "Agenda khusus",
        color: "red",
      })
    ).toMatchObject({
      id: "event-1",
      label: "Kegiatan kelas",
      description: "Agenda khusus",
      color: "red",
    });

    expect(
      mapV1LockToCanonical({
        class_id: "class-1",
        month: "2026-06-01",
        is_locked: true,
        locked_at: "2026-06-25T12:00:00Z",
        user_id: "teacher-1",
      })
    ).toEqual({
      classId: "class-1",
      month: "2026-06",
      isLocked: true,
      lockedAt: "2026-06-25T12:00:00Z",
      lockedBy: "teacher-1",
    });
  });

  it("projects canonical dataset to export without engine leakage", () => {
    const dataset = createDataset({
      students: [
        { id: "murid-1", name: "Budi", nisn: "12345" },
        { id: "murid-2", name: "Ani", nisn: "67890" },
      ],
      records: [
        createRecord({
          id: "rec-1",
          studentId: "murid-1",
          status: "H",
          debug: { sourceEngine: "v1", sourceTable: "attendance_records" },
        }),
        createRecord({
          id: "rec-2",
          studentId: "murid-2",
          status: "S",
          note: "Sakit",
        }),
      ],
      debug: { sourceEngine: "shadow" },
    });

    const exported = mapCanonicalDatasetToExport(dataset, "Kelas 10A", "Juni 2026");

    expect(exported.className).toBe("Kelas 10A");
    expect(exported.students).toHaveLength(2);
    expect(exported.students[0].totals).toMatchObject({ H: 1, total: 0 });
    expect(exported.students[1].totals).toMatchObject({ S: 1, total: 1 });
    expect(exported.notes).toEqual(["Ani: Sakit"]);
    expect(validateExportPayloadHasNoEngineLeakage(exported)).toHaveLength(0);
  });

  it("projects canonical dataset to UI rows with effective-day metadata", () => {
    const ui = mapCanonicalDatasetToUI(createDataset());

    expect(ui.rows).toEqual([
      {
        studentId: "murid-1",
        studentName: "Budi",
        nisn: "12345",
        cells: [
          {
            date: "2026-06-01",
            status: "H",
            note: null,
            isEffective: true,
          },
        ],
      },
    ]);
  });
});

describe("attendance canonical validation", () => {
  it("accepts a valid canonical record", () => {
    expect(validateCanonicalRecord(createRecord())).toHaveLength(0);
  });

  it("detects non-ISO dates", () => {
    const issues = validateCanonicalRecord(createRecord({ date: "2026/06/01" }));

    expect(issues).toHaveLength(1);
    expect(issues[0].code).toBe("NON_ISO_DATE");
  });

  it("detects invalid statuses unless they are explicitly configured as custom", () => {
    expect(validateStatus("XYZ")).toEqual([
      expect.objectContaining({
        code: "INVALID_STATUS_CODE",
        field: "status",
      }),
    ]);

    expect(validateStatus("XYZ", ["XYZ"])).toHaveLength(0);
  });

  it("detects locked write attempts on records and patches", () => {
    expect(validateCanonicalRecord(createRecord(), true)).toEqual([
      expect.objectContaining({ code: "LOCKED_WRITE_ATTEMPT" }),
    ]);

    const patch: AttendanceRecordPatch = {
      studentId: "murid-1",
      classId: "class-1",
      date: "2026-06-01",
      status: "H",
    };

    expect(validateRecordPatch(patch, { lockedMonths: new Set(["2026-06"]) })).toEqual([
      expect.objectContaining({ code: "LOCKED_WRITE_ATTEMPT" }),
    ]);
  });

  it("detects missing references and record writes on non-effective days", () => {
    const dataset = createDataset({
      students: [{ id: "murid-2", name: "Ani", nisn: "67890" }],
      days: [{ date: "2026-06-01", isEffective: false, dayOfWeek: 1 }],
    });

    const issues = validateCanonicalDataset(dataset);

    expect(issues.some((item) => item.code === "MISSING_STUDENT_REFERENCE")).toBe(true);
    expect(issues.some((item) => item.code === "RECORD_ON_NON_EFFECTIVE_DAY")).toBe(true);
  });

  it("detects duplicate student-date records and keeps debug metadata as info only", () => {
    const dataset = createDataset({
      records: [
        createRecord({
          id: "rec-1",
          debug: { sourceEngine: "v1" },
        }),
        createRecord({
          id: "rec-2",
          status: "S",
        }),
      ],
      debug: { sourceEngine: "shadow" },
    });

    const issues = validateCanonicalDataset(dataset);

    expect(issues.some((item) => item.code === "DUPLICATE_STUDENT_DATE_RECORD")).toBe(true);
    expect(issues.some((item) => item.code === "DEBUG_METADATA_PRESENT" && item.severity === "info")).toBe(true);
  });

  it("blocks engine or debug fields from export payloads", () => {
    const issues = validateExportPayloadHasNoEngineLeakage({
      className: "VIIA",
      students: [{ name: "Budi", debug: { sourceEngine: "v1" } }],
    });

    expect(issues).toEqual([
      expect.objectContaining({
        code: "ENGINE_LEAKAGE_IN_EXPORT_PAYLOAD",
        field: "students[0].debug",
      }),
      expect.objectContaining({
        code: "ENGINE_LEAKAGE_IN_EXPORT_PAYLOAD",
        field: "students[0].debug.sourceEngine",
      }),
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  createV1CanonicalSeamDraft,
  mapV1DayEventToCanonical,
  mapV1HolidayToCanonical,
  mapV1LockToCanonical,
  mapV1RecordToCanonical,
  mapV1SeamInputToCanonicalDataset,
  mapV1StatusToCanonical,
  normalizeV1LockMonth,
} from "./attendanceV1.canonical";

describe("attendance V1 canonical seam", () => {
  it("maps saved V1 statuses directly and empty display state to dash", () => {
    expect(mapV1StatusToCanonical("H")).toBe("H");
    expect(mapV1StatusToCanonical("I")).toBe("I");
    expect(mapV1StatusToCanonical("S")).toBe("S");
    expect(mapV1StatusToCanonical("A")).toBe("A");
    expect(mapV1StatusToCanonical("D")).toBe("D");
    expect(mapV1StatusToCanonical(null)).toBe("-");
  });

  it("normalizes V1 lock month from month-start date to YYYY-MM", () => {
    expect(normalizeV1LockMonth("2026-06-01")).toBe("2026-06");
    expect(normalizeV1LockMonth("2026-06")).toBe("2026-06");
  });

  it("maps V1 records, holidays, day events, and locks without mutation semantics", () => {
    expect(
      mapV1RecordToCanonical({
        class_id: "class-1",
        student_id: "murid-1",
        date: "2026-06-26",
        status: "D",
      })
    ).toMatchObject({
      id: "class-1:murid-1:2026-06-26",
      classId: "class-1",
      studentId: "murid-1",
      date: "2026-06-26",
      status: "D",
      note: null,
    });

    expect(mapV1HolidayToCanonical({ date: "2026-06-01", description: "Libur" })).toMatchObject({
      date: "2026-06-01",
      description: "Libur",
      isNational: false,
    });

    expect(mapV1DayEventToCanonical({ date: "2026-06-02", label: "Upacara" })).toMatchObject({
      date: "2026-06-02",
      label: "Upacara",
      description: null,
      color: "blue",
    });

    expect(
      mapV1LockToCanonical({
        class_id: "class-1",
        month: "2026-06-01",
        is_locked: true,
        user_id: "teacher-1",
      })
    ).toEqual({
      classId: "class-1",
      month: "2026-06",
      isLocked: true,
      lockedAt: null,
      lockedBy: "teacher-1",
    });
  });

  it("creates a read-only canonical dataset and seam draft from V1 input", () => {
    const input = {
      classInfo: { id: "class-1", name: "VIIA", classKkm: 70 },
      month: "2026-06-01",
      students: [{ id: "murid-1", name: "Ali", nisn: "001" }],
      attendanceRecords: [{ class_id: "class-1", student_id: "murid-1", date: "2026-06-26", status: "H" as const }],
      holidays: [{ date: "2026-06-01", description: "Libur" }],
      dayEvents: [{ date: "2026-06-02", label: "Kegiatan" }],
      locks: [{ class_id: "class-1", month: "2026-06-01", is_locked: false }],
    };

    expect(mapV1SeamInputToCanonicalDataset(input)).toMatchObject({
      classId: "class-1",
      month: "2026-06",
      students: input.students,
      records: [{ status: "H" }],
      holidays: [{ description: "Libur" }],
      dayEvents: [{ label: "Kegiatan" }],
      locks: [{ isLocked: false }],
    });

    expect(createV1CanonicalSeamDraft(input)).toEqual({
      classId: "class-1",
      month: "2026-06",
      students: input.students,
      recordsCount: 1,
      holidaysCount: 1,
      dayEventsCount: 1,
      locks: [{ classId: "class-1", month: "2026-06", isLocked: false, lockedAt: null, lockedBy: null }],
      isReadOnlyDraft: true,
    });
  });
});

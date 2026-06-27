import { describe, expect, it } from "vitest";
import type { AttendanceDatasetCanonical } from "../canonical";
import { createAttendanceCanonicalSnapshot } from "./AttendanceProvider";

function createDataset(): AttendanceDatasetCanonical {
  return {
    classId: "class-1",
    month: "2026-06",
    students: [{ id: "student-1", name: "Ali", nisn: "001" }],
    records: [
      {
        id: "record-1",
        studentId: "student-1",
        classId: "class-1",
        date: "2026-06-01",
        status: "H",
        note: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    days: [{ date: "2026-06-01", dayOfWeek: 1, isEffective: true }],
    holidays: [],
    dayEvents: [],
    locks: [],
  };
}

describe("Attendance canonical provider snapshot", () => {
  it("returns a stable idle shape when no canonical dataset is mounted yet", () => {
    const snapshot = createAttendanceCanonicalSnapshot(null);

    expect(snapshot.status).toBe("idle");
    expect(snapshot.dataset).toBeNull();
    expect(snapshot.uiModel).toBeNull();
    expect(snapshot.exportDataset).toBeNull();
    expect(snapshot.issues).toEqual([]);
  });

  it("projects a canonical dataset into UI and export-safe shapes", () => {
    const snapshot = createAttendanceCanonicalSnapshot(createDataset(), "v1-wrapper");

    expect(snapshot.status).toBe("ready");
    expect(snapshot.source).toBe("v1-wrapper");
    expect(snapshot.uiModel?.rows[0].studentName).toBe("Ali");
    expect(snapshot.exportDataset?.students[0].totals.H).toBe(1);
    expect(snapshot.issues).toEqual([]);
  });

  it("marks invalid canonical datasets without throwing during render setup", () => {
    const dataset = createDataset();
    dataset.month = "Juni 2026";

    const snapshot = createAttendanceCanonicalSnapshot(dataset, "backend");

    expect(snapshot.status).toBe("error");
    expect(snapshot.issues.some((issue) => issue.code === "NON_ISO_MONTH")).toBe(true);
  });
});

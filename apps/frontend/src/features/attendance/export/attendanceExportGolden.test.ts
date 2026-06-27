import { describe, expect, it } from "vitest";
import type { AttendanceDatasetCanonical } from "../canonical";
import { validateAttendanceCanonicalExportBridge } from "./attendanceExport.validation";
import { buildAttendanceExportBridgeFromCanonical } from "./attendanceExportLegacyBridge";
import { createAttendanceExportLegacyBridge } from "./attendanceExport.adapter";

function createCanonicalDataset(): AttendanceDatasetCanonical {
  return {
    classId: "class-vi-a",
    month: "2026-06",
    students: [
      { id: "murid-1", name: "Budi Santoso", nisn: "001" },
      { id: "murid-2", name: "Dewi Lestari", nisn: "002" },
    ],
    days: [
      { date: "2026-06-01", dayOfWeek: 1, isEffective: true },
      { date: "2026-06-02", dayOfWeek: 2, isEffective: true, eventName: "Upacara" },
      { date: "2026-06-03", dayOfWeek: 3, isEffective: false, holidayName: "Libur Sekolah" },
    ],
    records: [
      {
        id: "rec-1",
        studentId: "murid-1",
        classId: "class-vi-a",
        date: "2026-06-01",
        status: "H",
        note: "Tepat waktu",
        createdAt: null,
        updatedAt: null,
        debug: { sourceEngine: "v1", sourceTable: "attendance_records" },
      },
      {
        id: "rec-2",
        studentId: "murid-1",
        classId: "class-vi-a",
        date: "2026-06-02",
        status: "S",
        note: null,
        createdAt: null,
        updatedAt: null,
      },
      {
        id: "rec-3",
        studentId: "murid-2",
        classId: "class-vi-a",
        date: "2026-06-01",
        status: "A",
        note: "Tanpa kabar",
        createdAt: null,
        updatedAt: null,
      },
      {
        id: "rec-4",
        studentId: "murid-2",
        classId: "class-vi-a",
        date: "2026-06-02",
        status: "D",
        note: null,
        createdAt: null,
        updatedAt: null,
      },
    ],
    holidays: [
      {
        id: "holiday-1",
        date: "2026-06-03",
        description: "Libur Sekolah",
        isNational: false,
      },
    ],
    dayEvents: [
      {
        id: "event-1",
        date: "2026-06-02",
        label: "Upacara",
        description: "Lapangan sekolah",
        color: "blue",
      },
    ],
    locks: [],
    debug: { sourceEngine: "shadow" },
  };
}

describe("attendance canonical export bridge", () => {
  it("creates the legacy preview and print dataset shape without engine leakage", () => {
    const bridge = buildAttendanceExportBridgeFromCanonical(createCanonicalDataset(), {
      className: "VI-A",
      monthLabel: "Juni 2026",
      exportTimeLabel: "13 Jun 2026 08:00",
      workDayFormatLabel: "6 Hari (Senin-Sabtu)",
    });

    expect(bridge.previewData.className).toBe("VI-A");
    expect(bridge.previewData.monthLabel).toBe("Juni 2026");
    expect(bridge.previewData.days).toHaveLength(3);
    expect(bridge.previewData.rows).toHaveLength(2);
    expect(bridge.previewData.rows[0].cells.map((cell) => cell.value)).toEqual(["H", "S", "L"]);
    expect(bridge.previewData.rows[1].cells.map((cell) => cell.value)).toEqual(["A", "D", "L"]);
    expect(bridge.previewData.rows[0].totals).toEqual({ H: 1, S: 1, I: 0, A: 0, D: 0, total: 1 });
    expect(bridge.previewData.rows[1].totals).toEqual({ H: 0, S: 0, I: 0, A: 1, D: 1, total: 2 });
    expect(bridge.previewData.notes).toEqual([
      "Budi Santoso (1 Jun): Tepat waktu",
      "Dewi Lestari (1 Jun): Tanpa kabar",
    ]);
    expect(bridge.previewData.holidayItems).toEqual([
      { date: "2026-06-03", dayNumber: 3, description: "Libur Sekolah", source: "custom" },
    ]);
    expect(bridge.previewData.eventItems).toEqual([
      { date: "2026-06-02", dayNumber: 2, description: "Upacara \u2014 Lapangan sekolah", source: "event" },
    ]);
    expect(bridge.printDataset.rows).toBe(bridge.previewData.rows);
    expect(bridge.printDataset.days).toBe(bridge.previewData.days);
    expect(validateAttendanceCanonicalExportBridge(bridge)).toHaveLength(0);
  });

  it("keeps the Jumlah total configurable like the legacy V1 export", () => {
    const bridge = buildAttendanceExportBridgeFromCanonical(createCanonicalDataset(), {
      jumlahStatusCodes: ["A"],
    });

    expect(bridge.previewData.rows[0].totals.total).toBe(0);
    expect(bridge.previewData.rows[1].totals.total).toBe(1);
  });

  it("throws before export when bridge validation detects a blocking issue", () => {
    const bridge = buildAttendanceExportBridgeFromCanonical(createCanonicalDataset());
    bridge.previewData.rows[0].cells.pop();

    expect(validateAttendanceCanonicalExportBridge(bridge)).toEqual([
      expect.objectContaining({ code: "EXPORT_ROW_DAY_COUNT_MISMATCH" }),
    ]);
  });

  it("provides a safe public adapter that returns the validated bridge", () => {
    const bridge = createAttendanceExportLegacyBridge(createCanonicalDataset(), {
      className: "VI-A",
      monthLabel: "Juni 2026",
    });

    expect(bridge.previewData.className).toBe("VI-A");
    expect(bridge.printDataset.monthLabel).toBe("Juni 2026");
  });
});

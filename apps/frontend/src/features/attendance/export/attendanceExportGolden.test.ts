import { describe, expect, it } from "vitest";
import type { AttendanceDatasetCanonical } from "../canonical";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
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

function createSignatureSettings(): SignatureSettingsConfig {
  return {
    city: "Banjarmasin",
    signers: [
      {
        id: "signer-1",
        name: "Ali Ridho",
        title: "Guru Kelas",
        nip: "2210118210013",
        school_name: "SIPENA",
      },
    ],
    useCustomDate: false,
    customDate: null,
    fontSize: 10,
    showSignatureLine: true,
    signatureLinePosition: "above-name",
    signatureLineLengthMode: "fixed",
    signatureLineWidth: 50,
    signatureSpacing: 20,
    signatureAlignment: "right",
    signatureOffsetX: 0,
    signatureOffsetY: 0,
    placementMode: "adaptive",
    signaturePreset: "bottom-right",
    manualXPercent: null,
    manualYPercent: null,
    snapToGrid: true,
    gridSizeMm: 5,
    lockSignaturePosition: false,
    showDebugGuides: false,
    signaturePageIndex: null,
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

  it("carries signature settings as an explicit export-side contract", () => {
    const signature = createSignatureSettings();
    const bridge = buildAttendanceExportBridgeFromCanonical(createCanonicalDataset(), {
      includeSignature: true,
      signature,
    });

    expect(bridge.includeSignature).toBe(true);
    expect(bridge.signature?.signers[0].name).toBe("Ali Ridho");
    expect(validateAttendanceCanonicalExportBridge(bridge)).toHaveLength(0);
  });

  it("blocks signature export when settings are missing", () => {
    const bridge = buildAttendanceExportBridgeFromCanonical(createCanonicalDataset(), {
      includeSignature: true,
    });

    expect(validateAttendanceCanonicalExportBridge(bridge)).toEqual([
      expect.objectContaining({ code: "EXPORT_SIGNATURE_SETTINGS_MISSING" }),
    ]);
    expect(() => createAttendanceExportLegacyBridge(createCanonicalDataset(), { includeSignature: true })).toThrow(
      "EXPORT_SIGNATURE_SETTINGS_MISSING"
    );
  });

  it("blocks unmapped custom statuses before legacy export rendering", () => {
    const dataset = createCanonicalDataset();
    dataset.records[0] = { ...dataset.records[0], status: "K" };
    const bridge = buildAttendanceExportBridgeFromCanonical(dataset);

    expect(validateAttendanceCanonicalExportBridge(bridge)).toEqual([
      expect.objectContaining({ code: "EXPORT_UNMAPPED_STATUS_CODE" }),
    ]);
    expect(() => createAttendanceExportLegacyBridge(dataset)).toThrow("EXPORT_UNMAPPED_STATUS_CODE");
  });
  it("[BUG-11] weekend days (isEffective=false, no holidayName) must NOT be flagged as isHoliday in export", () => {
    const dataset = createCanonicalDataset();
    // Add a plain weekend day — no holidayName, no entry in holidays array
    dataset.days.push({ date: "2026-06-07", dayOfWeek: 0, isEffective: false }); // Sunday
    const bridge = buildAttendanceExportBridgeFromCanonical(dataset);

    // previewData.days items use 'key' field (= date string)
    const sundayDayHeader = bridge.previewData.days.find((day) => day.key === "2026-06-07");
    expect(sundayDayHeader).toBeDefined();
    expect(sundayDayHeader!.isHoliday).toBe(false);
  });

  it("[BUG-10] existing record on a holiday day is preserved in the cell value, not overwritten with L", () => {
    const dataset = createCanonicalDataset();
    // June 03 is in holidays array; add a makeup-class record for murid-1 on that holiday
    dataset.records.push({
      id: "rec-holiday",
      studentId: "murid-1",
      classId: "class-vi-a",
      date: "2026-06-03",
      status: "H",
      note: "Pengganti kelas",
      createdAt: null,
      updatedAt: null,
    });
    const bridge = buildAttendanceExportBridgeFromCanonical(dataset);
    // previewData.days items use 'key' field (= date string)
    const holidayDayIndex = bridge.previewData.days.findIndex((day) => day.key === "2026-06-03");
    expect(holidayDayIndex).toBeGreaterThanOrEqual(0);
    const cellForMurid1 = bridge.previewData.rows[0].cells[holidayDayIndex];

    // The explicit record must be preserved; the day header is still flagged as holiday in legend
    expect(cellForMurid1.value).toBe("H");
    expect(bridge.previewData.days[holidayDayIndex].isHoliday).toBe(true);
  });
});

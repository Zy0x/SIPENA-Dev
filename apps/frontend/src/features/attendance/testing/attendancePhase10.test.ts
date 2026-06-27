import { describe, expect, it, vi } from "vitest";
import type {
  AttendanceDatasetCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
  AttendanceStudentCanonical,
} from "../canonical";
import {
  validateCanonicalDataset,
  validateExportPayloadHasNoEngineLeakage,
  validateRecordPatch,
} from "../canonical";
import { createAttendanceExportLegacyBridge } from "../export";
import { validateAttendanceCanonicalExportBridge } from "../export/attendanceExport.validation";
import { resolveRuntimeConfig } from "../runtime/attendanceRuntime.config";
import { guardRuntimeConfig } from "../runtime/attendanceRuntimeGuard";
import { mapV1SeamInputToCanonicalDataset } from "../v1/attendanceV1.canonical";
import { AttendanceV2Service } from "../v2/attendanceV2.service";

const CLASS_ID = "class-phase-10";
const MONTH = "2026-06";

const students: AttendanceStudentCanonical[] = [
  { id: "murid-1", name: "Budi Santoso", nisn: "001" },
  { id: "murid-2", name: "Dewi Lestari", nisn: "002" },
  { id: "murid-3", name: "Rahma Putri", nisn: "003" },
];

function record(overrides: Partial<AttendanceRecordCanonical>): AttendanceRecordCanonical {
  return {
    id: "record-phase-10",
    studentId: "murid-1",
    classId: CLASS_ID,
    date: "2026-06-01",
    status: "H",
    note: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function lock(overrides: Partial<AttendanceLockCanonical> = {}): AttendanceLockCanonical {
  return {
    classId: CLASS_ID,
    month: MONTH,
    isLocked: true,
    lockedAt: "2026-06-01T00:00:00.000Z",
    lockedBy: "admin-phase-10",
    ...overrides,
  };
}

function buildDataset(
  overrides: Partial<Parameters<AttendanceV2Service["buildDataset"]>[0]> = {}
): AttendanceDatasetCanonical {
  return new AttendanceV2Service({ enableWrite: true }).buildDataset({
    classId: CLASS_ID,
    month: MONTH,
    students,
    records: [],
    holidays: [],
    dayEvents: [],
    locks: [],
    workDayFormat: "6days",
    ...overrides,
  });
}

describe("Attendance Phase 10 migration safety matrix", () => {
  it("validates canonical corruption cases without touching V1 storage", () => {
    const dataset = buildDataset({
      records: [
        record({ id: "valid", studentId: "murid-1", date: "2026-06-01", status: "H" }),
        record({ id: "duplicate", studentId: "murid-1", date: "2026-06-01", status: "S" }),
        record({ id: "invalid-status", studentId: "murid-2", date: "2026-06-02", status: "XYZ" }),
        record({ id: "missing-reference", studentId: "missing-murid", date: "2026-06-03", status: "A" }),
        record({ id: "non-iso", studentId: "murid-3", date: "2026/06/04", status: "D" }),
      ],
    });

    const issueCodes = validateCanonicalDataset(dataset).map((issue) => issue.code);

    expect(issueCodes).toEqual(
      expect.arrayContaining([
        "DUPLICATE_STUDENT_DATE_RECORD",
        "INVALID_STATUS_CODE",
        "MISSING_STUDENT_REFERENCE",
        "NON_ISO_DATE",
      ])
    );
  });

  it("covers 5-day, 6-day, holiday, event, and lock calendar datasets", () => {
    const fiveDayDataset = buildDataset({ workDayFormat: "5days" });
    const sixDayDataset = buildDataset({ workDayFormat: "6days" });
    const holidayEventLockDataset = buildDataset({
      workDayFormat: "6days",
      holidays: [{ id: "holiday-1", date: "2026-06-03", description: "Libur sekolah", isNational: false }],
      dayEvents: [{ id: "event-1", date: "2026-06-04", label: "Kegiatan kelas", description: null, color: "blue" }],
      locks: [lock()],
    });

    expect(fiveDayDataset.days.filter((day) => day.isEffective)).toHaveLength(22);
    expect(sixDayDataset.days.filter((day) => day.isEffective)).toHaveLength(26);
    expect(holidayEventLockDataset.days.find((day) => day.date === "2026-06-03")).toMatchObject({
      isEffective: false,
      holidayName: "Libur sekolah",
    });
    expect(holidayEventLockDataset.days.find((day) => day.date === "2026-06-04")).toMatchObject({
      isEffective: true,
      eventName: "Kegiatan kelas",
    });
    expect(holidayEventLockDataset.days.every((day) => day.lock?.isLocked === true)).toBe(true);
  });

  it("keeps runtime fallback locked to V1 when V2 is requested during migration", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const requested = resolveRuntimeConfig({ envEngine: "v2", mode: "active" });

    const guard = guardRuntimeConfig(requested);

    expect(requested.engine).toBe("v2");
    expect(guard).toMatchObject({
      isSafe: false,
      reason: "v2-not-implemented",
      forcedEngine: "v1",
      forcedMode: "active",
    });

    warnSpy.mockRestore();
  });

  it("blocks unsafe V2 mutations and reports shadow drift without user-facing writes", () => {
    const activeService = new AttendanceV2Service({ enableWrite: true });
    const lockedDataset = buildDataset({ locks: [lock()] });
    const patch: AttendanceRecordPatch = {
      studentId: "murid-1",
      classId: CLASS_ID,
      date: "2026-06-01",
      status: "H",
    };

    const lockedResult = activeService.applyPatch(lockedDataset, patch, "phase-10-operator");
    expect(lockedResult.success).toBe(false);
    expect(lockedResult.reasonCode).toBe("LOCKED_WRITE_ATTEMPT");
    expect(activeService.getAuditLogs()).toHaveLength(0);

    const disabledResult = new AttendanceV2Service({ enableWrite: false }).applyPatch(buildDataset(), patch, "phase-10-operator");
    expect(disabledResult.reasonCode).toBe("WRITE_DISALLOWED_STORAGE");

    const shadowService = new AttendanceV2Service({ enableShadow: true });
    const v1Records = [record({ id: "v1-status", status: "A" })];
    const v2Dataset = buildDataset({ records: [record({ id: "v2-status", status: "H" })] });
    const shadowReport = shadowService.compareWithV1CanonicalResult(v1Records, v2Dataset);

    expect(shadowReport).toMatchObject({
      match: false,
      mismatchCount: 1,
      mismatches: [expect.objectContaining({ mismatchFields: ["status"], v1Status: "A", v2Status: "H" })],
    });
  });

  it("maps V1 seam data to canonical shape and preserves read-only migration boundaries", () => {
    const v1Dataset = mapV1SeamInputToCanonicalDataset({
      classInfo: { id: CLASS_ID, name: "VI-A", classKkm: 70 },
      month: "2026-06-01",
      students,
      attendanceRecords: [
        { id: "v1-rec-1", class_id: CLASS_ID, student_id: "murid-1", date: "2026-06-01", status: "H", note: "Pagi" },
      ],
      holidays: [{ id: "v1-holiday-1", date: "2026-06-03", description: "Libur" }],
      dayEvents: [{ id: "v1-event-1", date: "2026-06-04", label: "Upacara", description: "Lapangan", color: "blue" }],
      locks: [{ id: "v1-lock-1", class_id: CLASS_ID, user_id: "admin", month: "2026-06-01", is_locked: true }],
    });

    expect(v1Dataset.month).toBe(MONTH);
    expect(v1Dataset.records[0]).toMatchObject({
      id: "v1-rec-1",
      studentId: "murid-1",
      classId: CLASS_ID,
      status: "H",
      note: "Pagi",
      debug: { sourceEngine: "v1", sourceTable: "attendance_records" },
    });
    expect(v1Dataset.locks[0]).toMatchObject({ month: MONTH, isLocked: true });
  });

  it("keeps canonical export payloads engine-agnostic across required dataset shapes", () => {
    const emptyClassBridge = createAttendanceExportLegacyBridge(buildDataset({ students: [] }), {
      className: "Kelas Kosong",
      monthLabel: "Juni 2026",
      exportTimeLabel: "13 Jun 2026 08:00",
    });
    expect(emptyClassBridge.previewData.rows).toHaveLength(0);
    expect(validateAttendanceCanonicalExportBridge(emptyClassBridge)).toHaveLength(0);

    const populatedDataset = buildDataset({
      records: [
        record({ id: "h", studentId: "murid-1", date: "2026-06-01", status: "H", note: "Tepat waktu" }),
        record({ id: "s", studentId: "murid-1", date: "2026-06-02", status: "S", note: "Demam" }),
        record({ id: "i", studentId: "murid-2", date: "2026-06-01", status: "I", note: "Izin keluarga" }),
        record({ id: "a", studentId: "murid-2", date: "2026-06-02", status: "A" }),
        record({ id: "d", studentId: "murid-3", date: "2026-06-01", status: "D", note: "Lomba" }),
      ],
      holidays: [{ id: "holiday-export", date: "2026-06-03", description: "Libur sekolah", isNational: false }],
      dayEvents: [{ id: "event-export", date: "2026-06-04", label: "Kegiatan kelas", description: "Piket", color: "blue" }],
    });
    populatedDataset.debug = { sourceEngine: "shadow" };
    populatedDataset.records[0].debug = { sourceEngine: "v1", sourceTable: "attendance_records" };

    const bridge = createAttendanceExportLegacyBridge(populatedDataset, {
      className: "VI-A",
      monthLabel: "Juni 2026",
      workDayFormatLabel: "6 Hari (Senin-Sabtu)",
    });

    expect(bridge.previewData.rows).toHaveLength(3);
    expect(bridge.previewData.days).toHaveLength(30);
    expect(bridge.previewData.rows[0].totals).toMatchObject({ H: 1, S: 1, I: 0, A: 0, D: 0, total: 1 });
    expect(bridge.previewData.rows[1].totals).toMatchObject({ H: 0, S: 0, I: 1, A: 1, D: 0, total: 2 });
    expect(bridge.previewData.rows[2].totals).toMatchObject({ H: 0, S: 0, I: 0, A: 0, D: 1, total: 1 });
    expect(bridge.previewData.notes).toEqual(
      expect.arrayContaining([
        "Budi Santoso (1 Jun): Tepat waktu",
        "Budi Santoso (2 Jun): Demam",
        "Dewi Lestari (1 Jun): Izin keluarga",
        "Rahma Putri (1 Jun): Lomba",
      ])
    );
    expect(validateAttendanceCanonicalExportBridge(bridge)).toHaveLength(0);
    expect(validateExportPayloadHasNoEngineLeakage(bridge.previewData)).toHaveLength(0);
    expect(validateExportPayloadHasNoEngineLeakage(bridge.printDataset)).toHaveLength(0);
  });

  it("documents mutation guards for moved murid and invalid date/status patches", () => {
    const dataset = buildDataset();
    const invalidPatchIssues = validateRecordPatch(
      {
        studentId: "murid-pindah-kelas",
        classId: CLASS_ID,
        date: "2026-06-31",
        status: "Z",
      },
      {
        validStudentIds: new Set(students.map((student) => student.id)),
        validClassIds: new Set([CLASS_ID]),
        lockedMonths: new Set([MONTH]),
      }
    );
    const serviceResult = new AttendanceV2Service({ enableWrite: true }).applyPatch(
      dataset,
      { studentId: "murid-pindah-kelas", classId: CLASS_ID, date: "2026-06-01", status: "H" },
      "phase-10-operator"
    );

    expect(invalidPatchIssues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["NON_ISO_DATE", "INVALID_STATUS_CODE", "MISSING_STUDENT_REFERENCE", "LOCKED_WRITE_ATTEMPT"])
    );
    expect(serviceResult.success).toBe(false);
    expect(serviceResult.reasonCode).toBe("MISSING_STUDENT_REFERENCE");
  });
});

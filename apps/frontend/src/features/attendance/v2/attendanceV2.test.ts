import { describe, expect, it } from "vitest";
import type {
  AttendanceDatasetCanonical,
  AttendanceLockCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
} from "../canonical/canonical.types";
import { AttendanceV2Service } from "./attendanceV2.service";
import {
  computeDailySummary,
  computeMonthlyClassRecap,
  computeMonthlySummary,
  computeYearlySummary,
} from "./attendanceV2.engine";
import { compareWithV1CanonicalResult } from "./attendanceV2.shadow";

describe("Attendance V2 Core Orchestrator - Integration & Validation", () => {
  const classId = "class-1";
  const student1 = { id: "student-1", name: "Budi", nisn: "12345" };
  const student2 = { id: "student-2", name: "Ani", nisn: "67890" };

  function createRecord(overrides: Partial<AttendanceRecordCanonical>): AttendanceRecordCanonical {
    return {
      id: "record-1",
      studentId: student1.id,
      classId,
      date: "2026-06-01",
      status: "H",
      note: null,
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T00:00:00.000Z",
      ...overrides,
    };
  }

  function createDataset(records: AttendanceRecordCanonical[] = [], locks: AttendanceLockCanonical[] = []): AttendanceDatasetCanonical {
    return new AttendanceV2Service({ enableWrite: true }).buildDataset({
      classId,
      month: "2026-06",
      students: [student1, student2],
      records,
      holidays: [],
      dayEvents: [],
      locks,
      workDayFormat: "6days",
    });
  }

  it("builds a canonical dataset with deterministic calendar days", () => {
    const service = new AttendanceV2Service();
    const dataset = service.buildDataset({
      classId,
      month: "2026-06",
      students: [student1, student2],
      workDayFormat: "6days",
    });

    expect(dataset.classId).toBe(classId);
    expect(dataset.days).toHaveLength(30);
    expect(dataset.days[0].date).toBe("2026-06-01");
    expect(dataset.days[0].isEffective).toBe(true);
  });

  it("fails patch updates if write permission is disabled", () => {
    const service = new AttendanceV2Service({ enableWrite: false });
    const dataset = createDataset();
    const patch: AttendanceRecordPatch = {
      studentId: student1.id,
      classId,
      date: "2026-06-01",
      status: "H",
    };

    const result = service.applyPatch(dataset, patch, "operator-1");

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("WRITE_DISALLOWED_STORAGE");
    expect(result.dataset.records).toHaveLength(0);
    expect(dataset.records).toHaveLength(0);
  });

  it("applies a patch immutably, returns canonical output, and logs audit details when enabled", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset();
    const patch: AttendanceRecordPatch = {
      studentId: student1.id,
      classId,
      date: "2026-06-01",
      status: "H",
      note: "Hadir pagi",
    };

    const result = service.applyPatch(dataset, patch, "operator-1");

    expect(result.success).toBe(true);
    expect(result.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
    expect(result.dataset.records).toHaveLength(1);
    expect(result.dataset.records[0].status).toBe("H");
    expect(result.dataset.records[0].note).toBe("Hadir pagi");
    expect(dataset.records).toHaveLength(0);
    expect(result.ruleExplanation?.appliedRuleIds).toContain("rule-manual-status-assignment");
    expect(result.auditEvent?.actor).toBe("operator-1");
    expect(service.getAuditLogs()).toHaveLength(1);
  });

  it("blocks non-effective dates through calendar and rule validation", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset();

    const result = service.applyPatch(
      dataset,
      {
        studentId: student1.id,
        classId,
        date: "2026-06-07",
        status: "H",
      },
      "operator-1"
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("NON_EFFECTIVE_DAY");
    expect(result.canonicalValidationIssues.some((issue) => issue.code === "NON_EFFECTIVE_DAY")).toBe(true);
  });

  it("blocks locked month mutations before creating an audit event", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset([], [
      { classId, month: "2026-06", isLocked: true, lockedAt: "2026-06-01T00:00:00.000Z", lockedBy: "admin-1" },
    ]);

    const result = service.applyPatch(
      dataset,
      {
        studentId: student1.id,
        classId,
        date: "2026-06-01",
        status: "H",
      },
      "operator-1"
    );

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("LOCKED_WRITE_ATTEMPT");
    expect(result.auditEvent).toBeNull();
    expect(service.getAuditLogs()).toHaveLength(0);
  });

  it("bulk applies patches using the previously returned dataset for later operations", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset();

    const results = service.bulkApplyPatch(dataset, [
      { studentId: student1.id, classId, date: "2026-06-01", status: "H" },
      { studentId: student2.id, classId, date: "2026-06-01", status: "D", note: "Lomba" },
    ], "operator-1");

    expect(results).toHaveLength(2);
    expect(results.every((result) => result.success)).toBe(true);
    expect(results[1].dataset.records).toHaveLength(2);
    expect(service.getAuditLogs()).toHaveLength(2);
  });

  it("updates notes through the same rule and audit path", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset([
      createRecord({ id: "record-note", studentId: student1.id, date: "2026-06-01", status: "H", note: null }),
    ]);

    const result = service.updateNote(dataset, student1.id, "2026-06-01", "Catatan pulang cepat", {
      actor: "operator-1",
      isRetroactiveEdit: true,
    });

    expect(result.success).toBe(true);
    expect(result.updatedRecord?.note).toBe("Catatan pulang cepat");
    expect(result.reasonCode).toBe("RETROACTIVE_UPDATE_ALLOWED");
  });

  it("returns daily, monthly, yearly, and class summary data from canonical records", () => {
    const dataset = createDataset([
      createRecord({ id: "1", studentId: student1.id, date: "2026-06-01", status: "H" }),
      createRecord({ id: "2", studentId: student1.id, date: "2026-06-02", status: "S", note: "Sakit" }),
      createRecord({ id: "3", studentId: student2.id, date: "2026-06-01", status: "D", note: "Dispen" }),
    ]);

    expect(computeDailySummary(dataset, "2026-06-01").presentCount).toBe(2);
    expect(computeMonthlySummary(dataset, student1.id).sickCount).toBe(1);
    expect(computeMonthlyClassRecap(dataset).dispensationCount).toBe(1);
    expect(computeYearlySummary([dataset], student1.id).percentage).toBe(50);
    expect(new AttendanceV2Service().computeSummary(dataset).monthly).toHaveLength(2);
  });

  it("exposes daily, monthly, and yearly read operations without mutating source data", () => {
    const service = new AttendanceV2Service();
    const dataset = createDataset([
      createRecord({ id: "1", studentId: student1.id, date: "2026-06-01", status: "H" }),
      createRecord({ id: "2", studentId: student2.id, date: "2026-06-01", status: "A" }),
    ]);

    expect(service.getDailyAttendance(dataset, "2026-06-01")).toHaveLength(2);
    expect(service.getMonthlyAttendance(dataset, student1.id)).toHaveLength(1);
    expect(service.getYearlyAttendance([dataset], student1.id).yearlyTotalDays).toBe(1);
  });

  it("compares V2 canonical results with V1 canonical records in shadow mode without writes", () => {
    const service = new AttendanceV2Service({ enableShadow: true });
    const dataset = createDataset([
      createRecord({ id: "v2-1", studentId: student1.id, date: "2026-06-01", status: "H" }),
    ]);
    const v1Records = [
      createRecord({ id: "v1-1", studentId: student1.id, date: "2026-06-01", status: "A" }),
    ];

    const shadowReport = service.compareWithV1CanonicalResult(v1Records, dataset);

    expect(shadowReport.match).toBe(false);
    expect(shadowReport.mismatchCount).toBe(1);
    expect(shadowReport.mismatches[0].v1Status).toBe("A");
    expect(shadowReport.mismatches[0].v2Status).toBe("H");
  });

  it("keeps standalone shadow comparison deterministic", () => {
    const v1 = [createRecord({ id: "1", status: "A" })];
    const v2 = [createRecord({ id: "2", status: "H" })];

    const shadowReport = compareWithV1CanonicalResult(v1, v2);

    expect(shadowReport.match).toBe(false);
    expect(shadowReport.mismatchCount).toBe(1);
    expect(shadowReport.mismatches[0].mismatchFields).toEqual(["status"]);
  });

  it("reports record ordering drift for export-shadow parity", () => {
    const v1 = [
      createRecord({ id: "v1-1", studentId: student1.id, date: "2026-06-01", status: "H" }),
      createRecord({ id: "v1-2", studentId: student2.id, date: "2026-06-01", status: "S" }),
    ];
    const v2 = [
      createRecord({ id: "v2-2", studentId: student2.id, date: "2026-06-01", status: "S" }),
      createRecord({ id: "v2-1", studentId: student1.id, date: "2026-06-01", status: "H" }),
    ];

    const shadowReport = compareWithV1CanonicalResult(v1, v2);

    expect(shadowReport.match).toBe(false);
    expect(shadowReport.mismatchCount).toBe(2);
    expect(shadowReport.mismatches.map((mismatch) => mismatch.mismatchFields)).toEqual([
      ["record_order"],
      ["record_order"],
    ]);
  });
  it("[P11-004] returns RECORD_NOT_FOUND_FOR_NOTE_UPDATE when updateNote targets a missing record", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = createDataset();

    const result = service.updateNote(dataset, student1.id, "2026-06-01", "Catatan baru", "operator-1");

    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("RECORD_NOT_FOUND_FOR_NOTE_UPDATE");
    expect(result.auditEvent).toBeNull();
    expect(service.getAuditLogs()).toHaveLength(0);
  });

  it("[P11-005] computeSummaryBundle handles dataset with no records without crashing", () => {
    const service = new AttendanceV2Service();
    const emptyDataset = createDataset([]);

    const bundle = service.computeSummary(emptyDataset);

    expect(bundle.daily).toHaveLength(30); // June has 30 days
    expect(bundle.monthly).toHaveLength(2); // 2 students
    expect(bundle.monthly.every((summary) => summary.presentCount === 0)).toBe(true);
    expect(bundle.classRecap.totalCount).toBe(0);
  });

  it("[P11-005b] computeSummaryBundle class recap counts D as dispensation, not double-H", () => {
    const dataset = createDataset([
      createRecord({ id: "h", studentId: student1.id, date: "2026-06-01", status: "H" }),
      createRecord({ id: "d", studentId: student2.id, date: "2026-06-01", status: "D" }),
      createRecord({ id: "a", studentId: student1.id, date: "2026-06-02", status: "A" }),
    ]);

    const recap = computeMonthlyClassRecap(dataset);

    expect(recap.presentCount).toBe(2); // H + D both count as present
    expect(recap.dispensationCount).toBe(1); // D counted separately
    expect(recap.absentCount).toBe(1); // A counted
    expect(recap.totalCount).toBe(3); // total raw records
  });
});

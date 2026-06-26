import { describe, expect, it } from "vitest";
import { AttendanceV2Service } from "./attendanceV2.service";
import { computeDailySummary, computeMonthlySummary, computeYearlySummary } from "./attendanceV2.engine";
import { compareWithV1CanonicalResult } from "./attendanceV2.shadow";
import { AttendanceDatasetCanonical, AttendanceRecordPatch } from "../canonical/canonical.types";

describe("Attendance V2 Core Orchestrator - Integration & Validation", () => {
  const dummyClassId = "class-1";
  const dummyStudent1 = { id: "student-1", name: "Budi", nisn: "12345" };
  const dummyStudent2 = { id: "student-2", name: "Ani", nisn: "67890" };

  const getBaseDataset = (): AttendanceDatasetCanonical => ({
    classId: dummyClassId,
    month: "2026-06",
    students: [dummyStudent1, dummyStudent2],
    records: [],
    days: [],
    holidays: [],
    dayEvents: [],
    locks: []
  });

  it("should fail patch updates if write permission is disabled", () => {
    const service = new AttendanceV2Service({ enableWrite: false });
    const dataset = getBaseDataset();
    const patch: AttendanceRecordPatch = {
      studentId: "student-1",
      classId: dummyClassId,
      date: "2026-06-01",
      status: "H"
    };

    const result = service.applyPatch(dataset, patch, "operator-1");
    expect(result.success).toBe(false);
    expect(result.reasonCode).toBe("WRITE_DISALLOWED_STORAGE");
  });

  it("should successfully apply patch, mutate dataset, and log audit details when enabled", () => {
    const service = new AttendanceV2Service({ enableWrite: true });
    const dataset = getBaseDataset();
    const patch: AttendanceRecordPatch = {
      studentId: "student-1",
      classId: dummyClassId,
      date: "2026-06-01",
      status: "H",
      note: "Hadir pagi"
    };

    const result = service.applyPatch(dataset, patch, "operator-1");
    expect(result.success).toBe(true);
    expect(result.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
    expect(dataset.records).toHaveLength(1);
    expect(dataset.records[0].status).toBe("H");
    expect(dataset.records[0].note).toBe("Hadir pagi");

    const auditLogs = service.getAuditLogs();
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].actor).toBe("operator-1");
    expect(auditLogs[0].action).toBe("CREATE");
  });

  it("should calculate correct daily, monthly, and yearly summaries", () => {
    const dataset = getBaseDataset();
    dataset.records = [
      { id: "1", studentId: "student-1", classId: dummyClassId, date: "2026-06-01", status: "H", note: null, createdAt: "", updatedAt: "" },
      { id: "2", studentId: "student-1", classId: dummyClassId, date: "2026-06-02", status: "S", note: "Sakit", createdAt: "", updatedAt: "" },
      { id: "3", studentId: "student-2", classId: dummyClassId, date: "2026-06-01", status: "D", note: "Dispen", createdAt: "", updatedAt: "" }
    ];

    // Daily summary for 2026-06-01
    const daily = computeDailySummary(dataset, "2026-06-01");
    expect(daily.presentCount).toBe(2); // H and D count as present
    expect(daily.absentCount).toBe(0);

    // Monthly summary for student-1
    const monthly = computeMonthlySummary(dataset, "student-1");
    expect(monthly.presentCount).toBe(1); // Only H
    expect(monthly.sickCount).toBe(1); // S
    expect(monthly.totalDays).toBe(2);

    // Yearly summary
    const yearly = computeYearlySummary([dataset], "student-1");
    expect(yearly.yearlyPresentCount).toBe(1);
    expect(yearly.yearlyTotalDays).toBe(2);
    expect(yearly.percentage).toBe(50);
  });

  it("should audit shadow comparison drift report accurately", () => {
    const dataset = getBaseDataset();
    dataset.records = [
      { id: "1", studentId: "student-1", classId: dummyClassId, date: "2026-06-01", status: "H", note: null, createdAt: "", updatedAt: "" }
    ];

    // V1 record has status "A" for the same student/date
    const v1Equivalent = [
      { id: "1", student_id: "student-1", class_id: dummyClassId, date: "2026-06-01", status: "A" }
    ];

    const shadowReport = compareWithV1CanonicalResult(
      v1Equivalent.map(r => ({
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status as any,
        note: null,
        createdAt: "",
        updatedAt: ""
      })),
      dataset.records
    );

    expect(shadowReport.match).toBe(false);
    expect(shadowReport.mismatchCount).toBe(1);
    expect(shadowReport.mismatches[0].v1Status).toBe("A");
    expect(shadowReport.mismatches[0].v2Status).toBe("H");
  });
});

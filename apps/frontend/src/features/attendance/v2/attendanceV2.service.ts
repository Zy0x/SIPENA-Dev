import {
  AttendanceDatasetCanonical,
  AttendanceRecordPatch,
  AttendanceRecordCanonical
} from "../canonical/canonical.types";
import {
  AttendanceV2PatchResult,
  AttendanceAuditEventCanonical
} from "./attendanceV2.types";
import { validatePatchMutation } from "./attendanceV2.validation";
import { evaluateAttendanceRules } from "./rules/ruleEngine";
import { createAuditEvent } from "./attendanceV2.audit";
import { compareWithV1CanonicalResult } from "./attendanceV2.shadow";
import { computeEffectiveDay } from "./calendar/effectiveDayEngine";

/**
 * AttendanceV2Service
 * Stateful-safe orchestration client for Attendance V2.
 * Couples Calendar and Rule engines with Mutation Guards, Audit logs, and Shadow mode checks.
 */
export class AttendanceV2Service {
  private isWriteEnabled: boolean = false;
  private shadowModeActive: boolean = false;
  private auditLogs: AttendanceAuditEventCanonical[] = [];

  constructor(options?: { enableWrite?: boolean; enableShadow?: boolean }) {
    this.isWriteEnabled = !!options?.enableWrite;
    this.shadowModeActive = !!options?.enableShadow;
  }

  setWriteEnabled(enabled: boolean): void {
    this.isWriteEnabled = enabled;
  }

  setShadowModeActive(active: boolean): void {
    this.shadowModeActive = active;
  }

  getAuditLogs(): AttendanceAuditEventCanonical[] {
    return this.auditLogs;
  }

  /**
   * applyPatch
   * Applies an attendance record patch update under safety validation and rule constraints.
   */
  applyPatch(
    dataset: AttendanceDatasetCanonical,
    patch: AttendanceRecordPatch,
    actor: string,
    v1EquivalentRecords?: any[] // Optional V1 source for shadow matching comparisons
  ): AttendanceV2PatchResult {
    // 1. Run Pre-mutation validation checks
    const valResult = validatePatchMutation(dataset, patch, this.isWriteEnabled);
    if (!valResult.valid) {
      return {
        success: false,
        reasonCode: valResult.reasonCode,
        appliedRuleIds: [],
        updatedRecord: null,
        auditEvent: null,
        validationIssues: valResult.issues
      };
    }

    // Check if a record already exists for this student + date
    const existing = dataset.records.find(
      (r) => r.studentId === patch.studentId && r.date === patch.date
    ) || null;

    // Get Calendar Context Day details
    const calendarDay = computeEffectiveDay(
      patch.date,
      dataset.classId,
      "6days",
      [],
      dataset.holidays,
      [],
      dataset.locks
    );

    // 2. Evaluate Rule Engine outcome
    const ruleContext = {
      student: dataset.students.find((s) => s.id === patch.studentId)!,
      classId: dataset.classId,
      date: patch.date,
      proposedStatus: patch.status,
      proposedNote: patch.note || null,
      calendarDay,
      locks: dataset.locks,
      existingRecord: existing
    };

    const ruleOutput = evaluateAttendanceRules(ruleContext);

    // Rejection if rule engine disallows writing
    if (!ruleOutput.writeAllowed) {
      return {
        success: false,
        reasonCode: ruleOutput.reasonCode,
        appliedRuleIds: ruleOutput.appliedRuleIds,
        updatedRecord: null,
        auditEvent: null,
        validationIssues: [
          `Rule Rejection: Write disallowed by rule engine. Reason: ${ruleOutput.reasonCode}`
        ]
      };
    }

    // 3. Create updated canonical record
    const nowStr = new Date().toISOString();
    const updatedRecord: AttendanceRecordCanonical = {
      id: existing?.id || `rec-${Math.random().toString(36).substring(2, 11)}`,
      studentId: patch.studentId,
      classId: dataset.classId,
      date: patch.date,
      status: ruleOutput.selectedStatus || "H",
      note: patch.note !== undefined ? patch.note : (existing?.note || null),
      createdAt: existing?.createdAt || nowStr,
      updatedAt: nowStr
    };

    // Commit change locally in dataset records array
    const updatedRecords = dataset.records.filter(
      (r) => !(r.studentId === patch.studentId && r.date === patch.date)
    );
    updatedRecords.push(updatedRecord);
    dataset.records = updatedRecords;

    // 4. Instantiate and log structured Audit Event
    const auditEvent = createAuditEvent(
      actor,
      existing ? "UPDATE" : "CREATE",
      dataset.classId,
      patch.studentId,
      patch.date,
      existing,
      updatedRecord,
      ruleOutput.reasonCode
    );
    this.auditLogs.push(auditEvent);

    // 5. Shadow Mode check
    if (this.shadowModeActive && v1EquivalentRecords) {
      // Map V1 records to canonicals
      const v1Mapped: AttendanceRecordCanonical[] = v1EquivalentRecords.map((r: any) => ({
        id: r.id || "",
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status,
        note: r.note || null,
        createdAt: r.created_at || "",
        updatedAt: r.updated_at || ""
      }));

      const shadowResult = compareWithV1CanonicalResult(v1Mapped, dataset.records);
      if (!shadowResult.match) {
        auditEvent.metadata = {
          ...auditEvent.metadata,
          shadowClash: shadowResult.mismatches
        };
      }
    }

    return {
      success: true,
      reasonCode: ruleOutput.reasonCode,
      appliedRuleIds: ruleOutput.appliedRuleIds,
      updatedRecord,
      auditEvent,
      validationIssues: []
    };
  }

  /**
   * bulkApplyPatch
   * Atomically iterates patches to apply updates to multiple students.
   */
  bulkApplyPatch(
    dataset: AttendanceDatasetCanonical,
    patches: AttendanceRecordPatch[],
    actor: string
  ): AttendanceV2PatchResult[] {
    return patches.map((patch) => this.applyPatch(dataset, patch, actor));
  }
}

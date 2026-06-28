import type {
  AttendanceDatasetCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
  AttendanceStudentCanonical,
} from "../canonical/canonical.types";
import { createAuditEvent } from "./attendanceV2.audit";
import {
  computeMonthlySummary,
  computeSummaryBundle,
  computeYearlySummary,
  getDailyRecords,
  getMonthlyRecords,
} from "./attendanceV2.engine";
import type {
  AttendanceAuditEventCanonical,
  AttendanceV2BuildDatasetInput,
  AttendanceV2MutationOptions,
  AttendanceV2PatchResult,
  AttendanceV2RuntimeMode,
  AttendanceV2SummaryBundle,
  MutationValidationResult,
  ShadowComparisonReport,
} from "./attendanceV2.types";
import { validatePatchMutation } from "./attendanceV2.validation";
import { generateCalendarDays } from "./calendar/calendarEngine";
import type { CalendarScopedEvent, V2CalendarDay } from "./calendar/calendarEngine.types";
import { computeEffectiveDay } from "./calendar/effectiveDayEngine";
import { compareWithV1CanonicalResult } from "./attendanceV2.shadow";
import { evaluateAttendanceRules } from "./rules/ruleEngine";
import type { RuleEvaluationOutput } from "./rules/ruleEngine.types";

function monthRange(month: string): { startDate: string; endDate: string } {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return {
    startDate: `${month}-01`,
    endDate: `${month}-${String(lastDay).padStart(2, "0")}`,
  };
}

function cloneRecord(record: AttendanceRecordCanonical): AttendanceRecordCanonical {
  return {
    ...record,
    debug: record.debug ? { ...record.debug } : undefined,
  };
}

function cloneDataset(dataset: AttendanceDatasetCanonical): AttendanceDatasetCanonical {
  return {
    ...dataset,
    students: dataset.students.map((student) => ({ ...student })),
    records: dataset.records.map(cloneRecord),
    days: dataset.days.map((day) => ({ ...day })),
    holidays: dataset.holidays.map((holiday) => ({ ...holiday })),
    dayEvents: dataset.dayEvents.map((event) => ({ ...event })),
    locks: dataset.locks.map((lock) => ({ ...lock })),
    notes: dataset.notes?.map((note) => ({ ...note })),
    monthlySummary: dataset.monthlySummary?.map((summary) => ({ ...summary })),
    dailySummary: dataset.dailySummary?.map((summary) => ({ ...summary })),
    yearlySummary: dataset.yearlySummary?.map((summary) => ({ ...summary, byMonth: { ...summary.byMonth } })),
    debug: dataset.debug ? { ...dataset.debug } : undefined,
  };
}

function isV2CalendarDay(day: AttendanceDatasetCanonical["days"][number] | undefined): day is V2CalendarDay {
  return !!day && "blockedWriteState" in day && "metadata" in day && "reasonCodes" in day;
}

function buildFailureResult(
  dataset: AttendanceDatasetCanonical,
  reasonCode: string,
  validation: MutationValidationResult | null,
  ruleExplanation: RuleEvaluationOutput | null = null
): AttendanceV2PatchResult {
  return {
    success: false,
    reasonCode,
    appliedRuleIds: ruleExplanation?.appliedRuleIds ?? [],
    dataset: cloneDataset(dataset),
    updatedRecord: null,
    auditEvent: null,
    auditEvents: [],
    validationIssues: validation?.issues ?? [],
    canonicalValidationIssues: validation?.validationIssues ?? [],
    ruleExplanation,
    shadowComparison: null,
  };
}

function normalizeOptions(
  actorOrOptions: string | AttendanceV2MutationOptions,
  v1CanonicalRecords?: AttendanceRecordCanonical[]
): AttendanceV2MutationOptions {
  if (typeof actorOrOptions === "string") {
    return { actor: actorOrOptions, v1CanonicalRecords };
  }
  return {
    ...actorOrOptions,
    v1CanonicalRecords: actorOrOptions.v1CanonicalRecords ?? v1CanonicalRecords,
  };
}

export class AttendanceV2Service {
  private writeEnabled: boolean;
  private runtimeMode: AttendanceV2RuntimeMode;
  private auditLogs: AttendanceAuditEventCanonical[] = [];

  constructor(options?: { enableWrite?: boolean; enableShadow?: boolean; runtimeMode?: AttendanceV2RuntimeMode }) {
    this.writeEnabled = !!options?.enableWrite;
    this.runtimeMode = options?.runtimeMode ?? (options?.enableShadow ? "shadow" : this.writeEnabled ? "active" : "disabled");
  }

  setWriteEnabled(enabled: boolean): void {
    this.writeEnabled = enabled;
  }

  setShadowModeActive(active: boolean): void {
    this.runtimeMode = active ? "shadow" : this.writeEnabled ? "active" : "disabled";
  }

  setRuntimeMode(mode: AttendanceV2RuntimeMode): void {
    this.runtimeMode = mode;
  }

  getAuditLogs(): AttendanceAuditEventCanonical[] {
    return this.auditLogs.map((event) => ({ ...event, metadata: event.metadata ? { ...event.metadata } : undefined }));
  }

  buildDataset(input: AttendanceV2BuildDatasetInput): AttendanceDatasetCanonical {
    const { startDate, endDate } = input.startDate && input.endDate ? input : monthRange(input.month);
    const days = generateCalendarDays({
      startDate,
      endDate,
      classId: input.classId,
      workDayFormat: input.workDayFormat ?? "6days",
      events: input.dayEvents ?? [],
      holidays: input.holidays ?? [],
      overrides: input.overrides ?? [],
      locks: input.locks ?? [],
      schoolScope: input.schoolScope,
    });

    return {
      classId: input.classId,
      month: input.month,
      students: input.students.map((student) => ({ ...student })),
      records: (input.records ?? []).map(cloneRecord),
      days,
      holidays: (input.holidays ?? []).map((holiday) => ({ ...holiday })),
      dayEvents: (input.dayEvents ?? []).map((event) => ({ ...event })),
      locks: (input.locks ?? []).map((lock) => ({ ...lock })),
      workDayFormat: input.workDayFormat ?? "6days",
    };
  }

  getDailyAttendance(dataset: AttendanceDatasetCanonical, date: string): AttendanceRecordCanonical[] {
    return getDailyRecords(dataset, date).map(cloneRecord);
  }

  getMonthlyAttendance(dataset: AttendanceDatasetCanonical, studentId?: string): AttendanceRecordCanonical[] {
    return getMonthlyRecords(dataset, studentId).map(cloneRecord);
  }

  getYearlyAttendance(monthlyDatasets: AttendanceDatasetCanonical[], studentId: string) {
    return computeYearlySummary(monthlyDatasets, studentId);
  }

  computeSummary(dataset: AttendanceDatasetCanonical, yearlyDatasets: AttendanceDatasetCanonical[] = []): AttendanceV2SummaryBundle {
    return computeSummaryBundle(dataset, yearlyDatasets);
  }

  private resolveCalendarDay(dataset: AttendanceDatasetCanonical, date: string): V2CalendarDay | null {
    const existingDay = dataset.days.find((day) => day.date === date);
    if (isV2CalendarDay(existingDay)) return existingDay;

    // Use the dataset's own workDayFormat so 5-day schools don't treat Saturday as effective.
    return computeEffectiveDay(
      date,
      dataset.classId,
      dataset.workDayFormat ?? "6days",
      dataset.dayEvents as CalendarScopedEvent[],
      dataset.holidays,
      [],
      dataset.locks
    );
  }

  validateMutation(dataset: AttendanceDatasetCanonical, patch: AttendanceRecordPatch): MutationValidationResult {
    return validatePatchMutation(dataset, patch, this.writeEnabled && this.runtimeMode === "active", this.resolveCalendarDay(dataset, patch.date));
  }

  compareWithV1CanonicalResult(
    v1CanonicalRecords: AttendanceRecordCanonical[],
    v2DatasetOrRecords: AttendanceDatasetCanonical | AttendanceRecordCanonical[]
  ): ShadowComparisonReport {
    const v2Records = Array.isArray(v2DatasetOrRecords) ? v2DatasetOrRecords : v2DatasetOrRecords.records;
    return compareWithV1CanonicalResult(v1CanonicalRecords, v2Records);
  }

  applyPatch(
    dataset: AttendanceDatasetCanonical,
    patch: AttendanceRecordPatch,
    actorOrOptions: string | AttendanceV2MutationOptions,
    v1CanonicalRecords?: AttendanceRecordCanonical[]
  ): AttendanceV2PatchResult {
    const options = normalizeOptions(actorOrOptions, v1CanonicalRecords);
    const workingDataset = cloneDataset(dataset);
    const calendarDay = this.resolveCalendarDay(workingDataset, patch.date);
    const validation = validatePatchMutation(
      workingDataset,
      patch,
      this.writeEnabled && this.runtimeMode === "active",
      calendarDay
    );

    if (!validation.valid) {
      return buildFailureResult(workingDataset, validation.reasonCode, validation);
    }

    const student = workingDataset.students.find((item: AttendanceStudentCanonical) => item.id === patch.studentId);
    if (!student) {
      return buildFailureResult(workingDataset, "MISSING_STUDENT_REFERENCE", validation);
    }

    const existingRecords = workingDataset.records.filter(
      (record) => record.studentId === patch.studentId && record.date === patch.date
    );
    const existing = existingRecords[0] ?? null;

    const ruleExplanation = evaluateAttendanceRules({
      student,
      classId: workingDataset.classId,
      date: patch.date,
      proposedStatus: patch.status,
      proposedNote: patch.note ?? null,
      calendarDay,
      locks: workingDataset.locks,
      existingRecord: existing,
      additionalContext: {
        source: options.source ?? (this.runtimeMode === "shadow" ? "shadow" : "manual"),
        isRetroactiveEdit: options.isRetroactiveEdit,
      },
    });

    if (!ruleExplanation.writeAllowed) {
      return buildFailureResult(workingDataset, ruleExplanation.reasonCode, validation, ruleExplanation);
    }

    const now = new Date().toISOString();
    const updatedRecord: AttendanceRecordCanonical = {
      id: existing?.id ?? `v2-rec-${now}-${patch.studentId}-${patch.date}`,
      studentId: patch.studentId,
      classId: workingDataset.classId,
      date: patch.date,
      status: ruleExplanation.selectedStatus ?? existing?.status ?? patch.status ?? "-",
      note: patch.note !== undefined ? patch.note ?? null : existing?.note ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };

    workingDataset.records = [
      ...workingDataset.records.filter((record) => !(record.studentId === patch.studentId && record.date === patch.date)),
      updatedRecord,
    ].sort((left, right) => `${left.date}:${left.studentId}`.localeCompare(`${right.date}:${right.studentId}`));

    let shadowComparison: ShadowComparisonReport | null = null;
    if (this.runtimeMode === "shadow" && options.v1CanonicalRecords) {
      shadowComparison = compareWithV1CanonicalResult(options.v1CanonicalRecords, workingDataset.records);
    }

    const auditEvent = createAuditEvent(
      options.actor,
      existing ? "UPDATE" : "CREATE",
      workingDataset.classId,
      patch.studentId,
      patch.date,
      existing,
      updatedRecord,
      ruleExplanation.reasonCode,
      {
        appliedRuleIds: ruleExplanation.appliedRuleIds,
        ruleAudit: ruleExplanation.auditMetadata,
        conflictNotes: ruleExplanation.conflictNotes,
        shadowComparison: shadowComparison?.match === false ? shadowComparison : undefined,
      }
    );
    this.auditLogs.push(auditEvent);

    return {
      success: true,
      reasonCode: ruleExplanation.reasonCode,
      appliedRuleIds: ruleExplanation.appliedRuleIds,
      dataset: workingDataset,
      updatedRecord,
      auditEvent,
      auditEvents: [auditEvent],
      validationIssues: [],
      canonicalValidationIssues: [],
      ruleExplanation,
      shadowComparison,
    };
  }

  bulkApplyPatch(
    dataset: AttendanceDatasetCanonical,
    patches: AttendanceRecordPatch[],
    actorOrOptions: string | AttendanceV2MutationOptions
  ): AttendanceV2PatchResult[] {
    const options = normalizeOptions(actorOrOptions);
    let workingDataset = cloneDataset(dataset);

    return patches.map((patch) => {
      const result = this.applyPatch(workingDataset, patch, options);
      if (result.success) {
        workingDataset = result.dataset;
      }
      return result;
    });
  }

  updateNote(
    dataset: AttendanceDatasetCanonical,
    studentId: string,
    date: string,
    note: string | null,
    actorOrOptions: string | AttendanceV2MutationOptions
  ): AttendanceV2PatchResult {
    const existing = dataset.records.find((record) => record.studentId === studentId && record.date === date);
    if (!existing) {
      return buildFailureResult(cloneDataset(dataset), "RECORD_NOT_FOUND_FOR_NOTE_UPDATE", null);
    }

    return this.applyPatch(
      dataset,
      {
        studentId,
        classId: dataset.classId,
        date,
        status: existing.status,
        note,
      },
      actorOrOptions
    );
  }
}

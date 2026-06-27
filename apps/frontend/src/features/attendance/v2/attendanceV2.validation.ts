import type { AttendanceDatasetCanonical, AttendanceRecordPatch, AttendanceValidationIssue } from "../canonical/canonical.types";
import { isIsoDateString, validateRecordPatch } from "../canonical/canonical.validation";
import type { V2CalendarDay } from "./calendar/calendarEngine.types";
import { getStatusDefinition } from "./rules/statusEngine";
import type { MutationValidationResult } from "./attendanceV2.types";

function validationIssue(code: string, message: string, field?: string): AttendanceValidationIssue {
  return { severity: "error", code, message, field };
}

export function validatePatchMutation(
  dataset: AttendanceDatasetCanonical,
  patch: AttendanceRecordPatch,
  isV2WriteEnabled: boolean,
  calendarDay: V2CalendarDay | null
): MutationValidationResult {
  const validationIssues: AttendanceValidationIssue[] = [];

  if (!isV2WriteEnabled) {
    validationIssues.push(
      validationIssue("WRITE_DISALLOWED_STORAGE", "V2 write path is disabled for this runtime mode.", "runtime")
    );
  }

  const validStudentIds = new Set(dataset.students.map((student) => student.id));
  validationIssues.push(
    ...validateRecordPatch(patch, {
      validStudentIds,
      validClassIds: new Set([dataset.classId]),
      effectiveDayMap: calendarDay ? new Map([[calendarDay.date, calendarDay.isEffective]]) : new Map(),
      lockedMonths: new Set(dataset.locks.filter((lock) => lock.isLocked).map((lock) => lock.month)),
    }).filter(
      (issue) =>
        issue.code !== "INVALID_STATUS_CODE" &&
        issue.code !== "RECORD_ON_NON_EFFECTIVE_DAY" &&
        issue.code !== "LOCKED_WRITE_ATTEMPT"
    )
  );

  if (!isIsoDateString(patch.date)) {
    validationIssues.push(validationIssue("NON_ISO_DATE", `Date '${patch.date}' must use YYYY-MM-DD format.`, "date"));
  }

  if (patch.classId !== dataset.classId) {
    validationIssues.push(
      validationIssue("CLASS_SCOPE_MISMATCH", `Patch class '${patch.classId}' does not match dataset class '${dataset.classId}'.`, "classId")
    );
  }

  if (!validStudentIds.has(patch.studentId)) {
    validationIssues.push(
      validationIssue("MISSING_STUDENT_REFERENCE", `Murid '${patch.studentId}' is not present in class '${dataset.classId}'.`, "studentId")
    );
  }

  if (patch.status !== null && !getStatusDefinition(patch.status)) {
    validationIssues.push(
      validationIssue("INVALID_STATUS_CODE", `Status '${patch.status}' is not registered in the V2 status engine.`, "status")
    );
  }

  if (!calendarDay) {
    validationIssues.push(
      validationIssue("MISSING_CALENDAR_CONTEXT", `No calendar context is available for '${patch.date}'.`, "date")
    );
  } else {
    if (!calendarDay.isEffective) {
      validationIssues.push(
        validationIssue("NON_EFFECTIVE_DAY", `Date '${patch.date}' is not an effective attendance day.`, "date")
      );
    }

    if (calendarDay.blockedWriteState) {
      validationIssues.push(
        validationIssue("LOCKED_WRITE_ATTEMPT", `Writes are blocked for '${patch.date}'.`, "date")
      );
    }
  }

  const duplicateCount = dataset.records.filter(
    (record) => record.classId === dataset.classId && record.studentId === patch.studentId && record.date === patch.date
  ).length;
  if (duplicateCount > 1) {
    validationIssues.push(
      validationIssue(
        "DUPLICATE_STUDENT_DATE_RECORD",
        `Multiple records already exist for murid '${patch.studentId}' on '${patch.date}'.`,
        "record"
      )
    );
  }

  if (validationIssues.length > 0) {
    const hardReason =
      validationIssues.find((issue) => issue.code === "WRITE_DISALLOWED_STORAGE")?.code ??
      validationIssues.find((issue) => issue.code === "LOCKED_WRITE_ATTEMPT")?.code ??
      validationIssues[0].code;

    return {
      valid: false,
      reasonCode: hardReason,
      issues: validationIssues.map((issue) => issue.message),
      validationIssues,
    };
  }

  return {
    valid: true,
    reasonCode: "MUTATION_VALIDATION_PASSED",
    issues: [],
    validationIssues: [],
  };
}

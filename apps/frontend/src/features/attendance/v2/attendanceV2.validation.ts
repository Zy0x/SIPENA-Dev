import { MutationValidationResult } from "./attendanceV2.types";
import { AttendanceDatasetCanonical, AttendanceRecordPatch } from "../canonical/canonical.types";
import { getStatusDefinition } from "./rules/statusEngine";
import { computeEffectiveDay } from "./calendar/effectiveDayEngine";

/**
 * validatePatchMutation
 * Guards against unsafe writes by checking lock state, effective school days,
 * registered status codes, student class membership, and storage engine permissions.
 */
export function validatePatchMutation(
  dataset: AttendanceDatasetCanonical,
  patch: AttendanceRecordPatch,
  isV2WriteEnabled: boolean
): MutationValidationResult {
  const issues: string[] = [];

  // 1. Storage write permission check
  if (!isV2WriteEnabled) {
    issues.push("Write operation rejected: V2 storage engine write permissions are disabled.");
    return { valid: false, reasonCode: "WRITE_DISALLOWED_STORAGE", issues };
  }

  // 2. Student class membership verification
  const studentExists = dataset.students.some((s) => s.id === patch.studentId);
  if (!studentExists) {
    issues.push(`Student with ID '${patch.studentId}' does not belong to class '${dataset.classId}'.`);
  }

  // 3. Status code validity
  const statusDef = getStatusDefinition(patch.status);
  if (!statusDef) {
    issues.push(`Proposed status '${patch.status}' is invalid or unregistered.`);
  }

  // 4. Effective day & Lock checks
  const calendarDay = computeEffectiveDay(
    patch.date,
    dataset.classId,
    "6days", // Default weekday format context
    [],
    dataset.holidays,
    [],
    dataset.locks
  );

  if (!calendarDay.isEffective) {
    issues.push(`Date '${patch.date}' is a non-effective day. Writes are blocked.`);
  }

  if (calendarDay.blockedWriteState) {
    issues.push(`Period lock blocks write attempts on date '${patch.date}'.`);
  }

  if (issues.length > 0) {
    return {
      valid: false,
      reasonCode: "MUTATION_VALIDATION_FAILED",
      issues
    };
  }

  return {
    valid: true,
    reasonCode: "MUTATION_VALIDATION_PASSED",
    issues: []
  };
}

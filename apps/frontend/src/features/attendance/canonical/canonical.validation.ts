import {
  AttendanceRecordCanonical,
  AttendanceDatasetCanonical,
  AttendanceValidationIssue
} from "./canonical.types";

/**
 * validateCanonicalRecord
 * Evaluates a single record against canonical validation constraints.
 */
export function validateCanonicalRecord(
  record: AttendanceRecordCanonical,
  isLocked: boolean = false
): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [];

  // 1. ISO Date validation (YYYY-MM-DD)
  const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!record.date || !isoDateRegex.test(record.date)) {
    issues.push({
      severity: "error",
      code: "INVALID_DATE_FORMAT",
      message: `Date '${record.date}' must be in YYYY-MM-DD format.`,
    });
  }

  // 2. Status check
  const allowedStatuses = new Set(["H", "S", "I", "A", "D", "L", "-"]);
  if (!record.status || !allowedStatuses.has(record.status)) {
    issues.push({
      severity: "error",
      code: "INVALID_STATUS_CODE",
      message: `Status '${record.status}' is not supported.`,
    });
  }

  // 3. Locked write verification
  if (isLocked) {
    issues.push({
      severity: "error",
      code: "LOCKED_PERIOD_WRITE",
      message: "Cannot modify records in a locked class/month period.",
    });
  }

  // 4. Reference integrity check
  if (!record.studentId) {
    issues.push({
      severity: "error",
      code: "MISSING_STUDENT_REFERENCE",
      message: "Student reference ID cannot be empty.",
    });
  }

  return issues;
}

/**
 * validateCanonicalDataset
 * Performs full dataset-level validations (e.g. duplicate checking, leaks, reference matching).
 */
export function validateCanonicalDataset(
  dataset: AttendanceDatasetCanonical
): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [];
  const uniqueKeys = new Set<string>();

  dataset.records.forEach((record) => {
    // Basic record validations
    const recordLock = dataset.locks.find(
      (l) => l.classId === record.classId && record.date.startsWith(l.month)
    );
    const recordIssues = validateCanonicalRecord(record, recordLock?.isLocked);
    issues.push(...recordIssues);

    // Duplicate detection
    const key = `${record.studentId}:${record.date}`;
    if (uniqueKeys.has(key)) {
      issues.push({
        severity: "error",
        code: "DUPLICATE_RECORD",
        message: `Duplicate attendance record found for student '${record.studentId}' on date '${record.date}'.`,
      });
    } else {
      uniqueKeys.add(key);
    }

    // Engine leakage checking
    if (record.metadata && ("engine" in record.metadata || "source" in record.metadata)) {
      issues.push({
        severity: "warning",
        code: "ENGINE_METADATA_LEAKAGE",
        message: "Record metadata contains internal engine source descriptors.",
      });
    }
  });

  return issues;
}

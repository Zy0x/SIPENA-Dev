import {
  AttendanceDatasetCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
  AttendanceStatusCode,
  AttendanceValidationIssue,
} from "./canonical.types";

export const WRITABLE_V1_STATUS_CODES = ["H", "I", "S", "A", "D"] as const;
export const DERIVED_STATUS_CODES = ["L", "-"] as const;
export const KNOWN_STATUS_CODES = [...WRITABLE_V1_STATUS_CODES, ...DERIVED_STATUS_CODES] as const;

export interface AttendanceValidationOptions {
  customStatusCodes?: readonly string[];
  validStudentIds?: ReadonlySet<string>;
  validClassIds?: ReadonlySet<string>;
  effectiveDayMap?: ReadonlyMap<string, boolean>;
  lockedMonths?: ReadonlySet<string>;
}

function issue(
  code: string,
  message: string,
  severity: AttendanceValidationIssue["severity"] = "error",
  field?: string,
  recordId?: string
): AttendanceValidationIssue {
  return { code, message, severity, field, recordId };
}

export function isIsoDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));

  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

export function isIsoMonthString(value: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(value)) return false;

  const [year, month] = value.split("-").map(Number);
  return Number.isInteger(year) && month >= 1 && month <= 12;
}

export function isKnownAttendanceStatus(status: AttendanceStatusCode | null | undefined): boolean {
  return typeof status === "string" && (KNOWN_STATUS_CODES as readonly string[]).includes(status);
}

export function isAllowedAttendanceStatus(
  status: AttendanceStatusCode | null | undefined,
  customStatusCodes: readonly string[] = []
): boolean {
  return isKnownAttendanceStatus(status) || (typeof status === "string" && customStatusCodes.includes(status));
}

export function validateStatus(
  status: AttendanceStatusCode | null | undefined,
  customStatusCodes: readonly string[] = []
): AttendanceValidationIssue[] {
  if (isAllowedAttendanceStatus(status, customStatusCodes)) return [];

  return [
    issue(
      "INVALID_STATUS_CODE",
      `Status '${String(status)}' is not supported by the canonical attendance model.`,
      "error",
      "status"
    ),
  ];
}

export function validateCanonicalRecord(
  record: AttendanceRecordCanonical,
  optionsOrIsLocked: AttendanceValidationOptions | boolean = {}
): AttendanceValidationIssue[] {
  const options: AttendanceValidationOptions =
    typeof optionsOrIsLocked === "boolean"
      ? { lockedMonths: optionsOrIsLocked ? new Set([record.date.slice(0, 7)]) : new Set() }
      : optionsOrIsLocked;

  const issues: AttendanceValidationIssue[] = [];

  if (!isIsoDateString(record.date)) {
    issues.push(issue("NON_ISO_DATE", `Date '${record.date}' must be in YYYY-MM-DD format.`, "error", "date", record.id));
  }

  issues.push(...validateStatus(record.status, options.customStatusCodes).map((statusIssue) => ({ ...statusIssue, recordId: record.id })));

  if (!record.studentId) {
    issues.push(issue("MISSING_STUDENT_REFERENCE", "Student reference ID cannot be empty.", "error", "studentId", record.id));
  } else if (options.validStudentIds && !options.validStudentIds.has(record.studentId)) {
    issues.push(issue("MISSING_STUDENT_REFERENCE", `Student '${record.studentId}' is not present in the canonical student list.`, "error", "studentId", record.id));
  }

  if (!record.classId) {
    issues.push(issue("MISSING_CLASS_REFERENCE", "Class reference ID cannot be empty.", "error", "classId", record.id));
  } else if (options.validClassIds && !options.validClassIds.has(record.classId)) {
    issues.push(issue("MISSING_CLASS_REFERENCE", `Class '${record.classId}' is not present in the canonical class context.`, "error", "classId", record.id));
  }

  const isEffective = options.effectiveDayMap?.get(record.date);
  if (isEffective === false && record.status !== "L" && record.status !== "-") {
    issues.push(issue("RECORD_ON_NON_EFFECTIVE_DAY", `Record '${record.id}' is attached to a non-effective day '${record.date}'.`, "warning", "date", record.id));
  }

  if (options.lockedMonths?.has(record.date.slice(0, 7))) {
    issues.push(issue("LOCKED_WRITE_ATTEMPT", "Cannot modify records in a locked class/month period.", "error", "date", record.id));
  }

  return issues;
}

export function validateRecordPatch(
  patch: AttendanceRecordPatch,
  options: AttendanceValidationOptions = {}
): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [];

  if (!isIsoDateString(patch.date)) {
    issues.push(issue("NON_ISO_DATE", `Date '${patch.date}' must be in YYYY-MM-DD format.`, "error", "date"));
  }

  if (patch.status !== null) {
    issues.push(...validateStatus(patch.status, options.customStatusCodes));
  }

  if (!patch.studentId || (options.validStudentIds && !options.validStudentIds.has(patch.studentId))) {
    issues.push(issue("MISSING_STUDENT_REFERENCE", `Student '${patch.studentId}' is not present in the canonical student list.`, "error", "studentId"));
  }

  if (!patch.classId || (options.validClassIds && !options.validClassIds.has(patch.classId))) {
    issues.push(issue("MISSING_CLASS_REFERENCE", `Class '${patch.classId}' is not present in the canonical class context.`, "error", "classId"));
  }

  if (options.effectiveDayMap?.get(patch.date) === false && patch.status !== null && patch.status !== "L" && patch.status !== "-") {
    issues.push(issue("RECORD_ON_NON_EFFECTIVE_DAY", `Patch targets a non-effective day '${patch.date}'.`, "warning", "date"));
  }

  if (options.lockedMonths?.has(patch.date.slice(0, 7))) {
    issues.push(issue("LOCKED_WRITE_ATTEMPT", "Cannot write to a locked class/month period.", "error", "date"));
  }

  return issues;
}

export function validateCanonicalDataset(dataset: AttendanceDatasetCanonical): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [];
  const uniqueKeys = new Set<string>();
  const validStudentIds = new Set(dataset.students.map((student) => student.id));
  const validClassIds = new Set([dataset.classId]);
  const effectiveDayMap = new Map(dataset.days.map((day) => [day.date, day.isEffective]));
  const lockedMonths = new Set(dataset.locks.filter((lock) => lock.isLocked).map((lock) => lock.month));

  if (!isIsoMonthString(dataset.month)) {
    issues.push(issue("NON_ISO_MONTH", `Month '${dataset.month}' must be in YYYY-MM format.`, "error", "month"));
  }

  for (const record of dataset.records) {
    issues.push(...validateCanonicalRecord(record, { validStudentIds, validClassIds, effectiveDayMap }));

    const key = `${record.classId}:${record.studentId}:${record.date}`;
    if (uniqueKeys.has(key)) {
      issues.push(issue("DUPLICATE_STUDENT_DATE_RECORD", `Duplicate attendance record found for student '${record.studentId}' on date '${record.date}'.`, "error", "record", record.id));
    }
    uniqueKeys.add(key);
  }

  for (const lock of dataset.locks) {
    if (!isIsoMonthString(lock.month)) {
      issues.push(issue("NON_ISO_MONTH", `Lock month '${lock.month}' must be in YYYY-MM format.`, "error", "month"));
    }
  }

  if (dataset.debug) {
    issues.push(issue("DEBUG_METADATA_PRESENT", "Canonical dataset contains debug metadata; this is allowed only before UI/export projection.", "info", "debug"));
  }

  if (lockedMonths.size > 0) {
    // Locks block writes, not reads. Dataset read validation reports only malformed records above.
  }

  return issues;
}

export function validateExportPayloadHasNoEngineLeakage(payload: unknown): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [];
  const forbiddenKeys = new Set(["engine", "sourceEngine", "source_engine", "sourceTable", "source_table", "debug", "metadata"]);

  const visit = (value: unknown, path: string) => {
    if (!value || typeof value !== "object") return;

    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const nextPath = path ? `${path}.${key}` : key;
      if (forbiddenKeys.has(key)) {
        issues.push(issue("ENGINE_LEAKAGE_IN_EXPORT_PAYLOAD", `Export payload contains internal field '${nextPath}'.`, "error", nextPath));
      }
      visit(nested, nextPath);
    }
  };

  visit(payload, "");
  return issues;
}

import type {
  AttendanceBulkPatchBody,
  AttendanceDailySummaryQuery,
  AttendanceDatasetQuery,
  AttendanceNotePatchBody,
  AttendanceRecordPatch,
  AttendanceValidationIssue,
} from "../attendance.types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_RE = /^\d{4}-\d{2}$/;
const CORE_STATUSES = new Set(["H", "I", "S", "A", "D", null]);

function issue(code: string, message: string, field?: string): AttendanceValidationIssue {
  return { severity: "error", code, message, field };
}

export function validateDatasetQuery(params: URLSearchParams): {
  valid: boolean;
  query: AttendanceDatasetQuery;
  issues: AttendanceValidationIssue[];
} {
  const classId = params.get("classId")?.trim() ?? "";
  const month = params.get("month")?.trim() ?? "";
  const issues: AttendanceValidationIssue[] = [];

  if (!classId) issues.push(issue("CLASS_ID_REQUIRED", "classId wajib dikirim.", "classId"));
  if (!ISO_MONTH_RE.test(month)) issues.push(issue("MONTH_INVALID", "month wajib berformat YYYY-MM.", "month"));

  return { valid: issues.length === 0, query: { classId, month }, issues };
}

export function validateDailySummaryQuery(params: URLSearchParams): {
  valid: boolean;
  query: AttendanceDailySummaryQuery;
  issues: AttendanceValidationIssue[];
} {
  const base = validateDatasetQuery(params);
  const date = params.get("date")?.trim() ?? "";
  const issues = [...base.issues];
  if (!ISO_DATE_RE.test(date)) issues.push(issue("DATE_INVALID", "date wajib berformat YYYY-MM-DD.", "date"));

  return { valid: issues.length === 0, query: { ...base.query, date }, issues };
}

export function validatePatchBody(body: unknown): {
  valid: boolean;
  patch: AttendanceRecordPatch | null;
  issues: AttendanceValidationIssue[];
} {
  const value = body as Partial<AttendanceRecordPatch> | null;
  const issues: AttendanceValidationIssue[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, patch: null, issues: [issue("BODY_INVALID", "Body wajib berupa objek JSON.")] };
  }

  if (!value.studentId) issues.push(issue("STUDENT_ID_REQUIRED", "studentId wajib dikirim.", "studentId"));
  if (!value.classId) issues.push(issue("CLASS_ID_REQUIRED", "classId wajib dikirim.", "classId"));
  if (!value.date || !ISO_DATE_RE.test(value.date)) {
    issues.push(issue("DATE_INVALID", "date wajib berformat YYYY-MM-DD.", "date"));
  }
  if (!CORE_STATUSES.has(value.status as string | null)) {
    issues.push(issue("STATUS_INVALID", "status wajib H/I/S/A/D atau null.", "status"));
  }

  return {
    valid: issues.length === 0,
    patch: issues.length === 0
      ? {
          studentId: String(value.studentId),
          classId: String(value.classId),
          date: String(value.date),
          status: value.status ?? null,
          note: value.note ?? null,
        }
      : null,
    issues,
  };
}

export function validateBulkPatchBody(body: unknown): {
  valid: boolean;
  bulk: AttendanceBulkPatchBody | null;
  issues: AttendanceValidationIssue[];
} {
  const value = body as Partial<AttendanceBulkPatchBody> | null;
  if (!value || !Array.isArray(value.patches)) {
    return { valid: false, bulk: null, issues: [issue("PATCHES_REQUIRED", "patches wajib berupa array.")] };
  }

  const issues: AttendanceValidationIssue[] = [];
  if (value.patches.length === 0) {
    issues.push(issue("PATCHES_EMPTY", "patches tidak boleh kosong.", "patches"));
  }

  const patches: AttendanceRecordPatch[] = [];
  value.patches.forEach((patch, index) => {
    const validation = validatePatchBody(patch);
    if (validation.patch) patches.push(validation.patch);
    issues.push(...validation.issues.map((item) => ({ ...item, field: `patches.${index}.${item.field ?? "body"}` })));
  });

  return { valid: issues.length === 0, bulk: issues.length === 0 ? { patches } : null, issues };
}

export function validateNotePatchBody(body: unknown): {
  valid: boolean;
  notePatch: AttendanceNotePatchBody | null;
  issues: AttendanceValidationIssue[];
} {
  const value = body as Partial<AttendanceNotePatchBody> | null;
  const patchValidation = validatePatchBody({ ...(value ?? {}), status: "H" });
  const issues = patchValidation.issues.filter((item) => item.field !== "status");
  if (value && value.note !== null && value.note !== undefined && typeof value.note !== "string") {
    issues.push(issue("NOTE_INVALID", "note harus string atau null.", "note"));
  }

  return {
    valid: issues.length === 0,
    notePatch: issues.length === 0 && value
      ? {
          studentId: String(value.studentId),
          classId: String(value.classId),
          date: String(value.date),
          note: value.note ?? null,
        }
      : null,
    issues,
  };
}

export function validateLockPatchBody(body: unknown): {
  valid: boolean;
  lockPatch: any;
  issues: AttendanceValidationIssue[];
} {
  const value = body as any;
  const issues: AttendanceValidationIssue[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, lockPatch: null, issues: [issue("BODY_INVALID", "Body wajib berupa objek JSON.")] };
  }

  if (!value.classId) issues.push(issue("CLASS_ID_REQUIRED", "classId wajib dikirim.", "classId"));
  if (!value.month || !ISO_MONTH_RE.test(value.month)) {
    issues.push(issue("MONTH_INVALID", "month wajib berformat YYYY-MM.", "month"));
  }
  if (typeof value.isLocked !== "boolean") {
    issues.push(issue("IS_LOCKED_REQUIRED", "isLocked wajib berupa boolean.", "isLocked"));
  }

  return {
    valid: issues.length === 0,
    lockPatch: issues.length === 0 ? {
      classId: String(value.classId),
      month: String(value.month),
      isLocked: Boolean(value.isLocked)
    } : null,
    issues
  };
}

export function validateHolidayPatchBody(body: unknown): {
  valid: boolean;
  holidayPatch: any;
  issues: AttendanceValidationIssue[];
} {
  const value = body as any;
  const issues: AttendanceValidationIssue[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, holidayPatch: null, issues: [issue("BODY_INVALID", "Body wajib berupa objek JSON.")] };
  }

  if (!value.date || !ISO_DATE_RE.test(value.date)) {
    issues.push(issue("DATE_INVALID", "date wajib berformat YYYY-MM-DD.", "date"));
  }

  return {
    valid: issues.length === 0,
    holidayPatch: issues.length === 0 ? {
      date: String(value.date),
      description: value.description ? String(value.description) : undefined
    } : null,
    issues
  };
}

export function validateDayEventPatchBody(body: unknown): {
  valid: boolean;
  dayEventPatch: any;
  issues: AttendanceValidationIssue[];
} {
  const value = body as any;
  const issues: AttendanceValidationIssue[] = [];

  if (!value || typeof value !== "object") {
    return { valid: false, dayEventPatch: null, issues: [issue("BODY_INVALID", "Body wajib berupa objek JSON.")] };
  }

  if (!value.date || !ISO_DATE_RE.test(value.date)) {
    issues.push(issue("DATE_INVALID", "date wajib berformat YYYY-MM-DD.", "date"));
  }
  if (value.action !== "upsert" && value.action !== "delete") {
    issues.push(issue("ACTION_INVALID", "action wajib bernilai 'upsert' atau 'delete'.", "action"));
  }
  if (value.action === "upsert" && !value.label) {
    issues.push(issue("LABEL_REQUIRED", "label wajib dikirim untuk aksi upsert.", "label"));
  }

  return {
    valid: issues.length === 0,
    dayEventPatch: issues.length === 0 ? {
      date: String(value.date),
      label: value.label ? String(value.label) : undefined,
      description: value.description ? String(value.description) : null,
      color: value.color ? String(value.color) : null,
      action: value.action
    } : null,
    issues
  };
}


import { getScopedGradeValue, type GradeValueRecord } from "../gradeValueSelection";
import { normalizeName, normalizeNisn, normalizeText, toCanonicalChapterName } from "./textNormalizer";
import {
  readWorkbookBuffer,
  type WorkbookCell,
  type WorkbookReadError,
  type WorkbookReadResult,
  type WorkbookSheetData,
} from "./workbookReader";

export type GradeBackupRestoreMode = "fill_empty_only" | "overwrite_selected" | "full_confirmed";
export type GradeBackupRestoreOperationStatus = "added" | "overwrite" | "unchanged" | "skipped" | "invalid";
export type GradeBackupRestoreConflictType = "context" | "student" | "structure" | "grade_value";
export type GradeBackupRestoreSeverity = "warning" | "blocked";
export type RestorableGradeType = "assignment" | "sts" | "sas";

export interface GradeBackupRestoreStudent {
  id: string;
  name: string;
  nisn?: string | null;
}

export interface GradeBackupRestoreChapter {
  id: string;
  name: string;
  order_index?: number | null;
}

export interface GradeBackupRestoreAssignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index?: number | null;
}

export interface GradeBackupRestoreGrade extends GradeValueRecord {
  id?: string;
  student_id: string;
  subject_id?: string | null;
  academic_year_id?: string | null;
}

export interface GradeBackupRestoreContext {
  classId?: string | null;
  className: string;
  subjectId?: string | null;
  subjectName: string;
  semesterId?: string | null;
  semesterName?: string | null;
  academicYearId?: string | null;
  students: GradeBackupRestoreStudent[];
  chapters: GradeBackupRestoreChapter[];
  assignments: GradeBackupRestoreAssignment[];
  grades: GradeBackupRestoreGrade[];
}

export interface GradeBackupManifest {
  app: string;
  export_type: string;
  export_version?: string;
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  semester_id?: string;
  semester_name?: string;
  academic_year_id?: string;
  generated_at?: string;
  [key: string]: string | undefined;
}

export interface GradeBackupRestoreConflict {
  code: string;
  type: GradeBackupRestoreConflictType;
  severity: GradeBackupRestoreSeverity;
  message: string;
  operationId?: string;
  field?: string;
}

export interface ParsedGradeBackupStudent {
  studentId: string;
  name: string;
  normalizedName: string;
  nisn?: string;
  normalizedNisn?: string;
}

export interface ParsedGradeBackupStructure {
  chapterId: string;
  chapterName: string;
  normalizedChapterName: string;
  assignmentId?: string;
  assignmentName?: string;
  normalizedAssignmentName?: string;
}

export interface ParsedGradeBackupValue {
  gradeId?: string;
  studentId: string;
  subjectId?: string | null;
  assignmentId?: string | null;
  gradeType: RestorableGradeType;
  value: number | null;
  semesterId?: string | null;
  academicYearId?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  rowIndex: number;
}

export interface GradeBackupReadResult {
  ok: boolean;
  fileName: string;
  manifest?: GradeBackupManifest;
  students: ParsedGradeBackupStudent[];
  structure: ParsedGradeBackupStructure[];
  grades: ParsedGradeBackupValue[];
  errors: WorkbookReadError[];
  warnings: WorkbookReadError[];
}

export interface GradeBackupRestoreOperation {
  id: string;
  status: GradeBackupRestoreOperationStatus;
  studentId: string;
  studentName?: string;
  studentNisn?: string | null;
  backupStudentName?: string;
  backupStudentNisn?: string;
  gradeType: RestorableGradeType;
  assignmentId?: string;
  assignmentName?: string;
  chapterName?: string;
  backupValue: number | null;
  currentValue: number | null;
  academicYearId?: string | null;
  semesterId?: string | null;
  rowIndex: number;
  conflicts: GradeBackupRestoreConflict[];
  warnings: string[];
}

export interface GradeBackupRestorePlan {
  source: GradeBackupReadResult;
  contextConflicts: GradeBackupRestoreConflict[];
  operations: GradeBackupRestoreOperation[];
  summary: {
    added: number;
    overwrite: number;
    unchanged: number;
    skipped: number;
    invalid: number;
    contextConflicts: number;
    studentConflicts: number;
    structureConflicts: number;
    invalidValues: number;
    restorable: number;
  };
}

export interface GradeBackupRestoreBatchItem {
  studentId: string;
  gradeType: RestorableGradeType;
  value: number | null;
  assignmentId?: string;
  academicYearId?: string | null;
  semesterId?: string | null;
}

export interface GradeBackupRestoreBatchBuildOptions {
  mode: GradeBackupRestoreMode;
  selectedOperationIds?: string[];
  allowContextMismatch?: boolean;
  allowIdentityMismatch?: boolean;
  includeNullOverwrites?: boolean;
  confirmationText?: string;
  nullOverwriteConfirmationText?: string;
}

export interface GradeBackupRestoreBatchBuildResult {
  items: GradeBackupRestoreBatchItem[];
  blockedReasons: string[];
  summary: {
    added: number;
    overwritten: number;
    cleared: number;
    unchanged: number;
    skipped: number;
    invalid: number;
  };
}

const REQUIRED_BACKUP_SHEETS = ["_manifest", "_students", "_structure", "_grades"] as const;
const RESTORABLE_GRADE_TYPES = new Set<RestorableGradeType>(["assignment", "sts", "sas"]);
const FULL_RESTORE_CONFIRMATION = "RESTORE NILAI";
const NULL_OVERWRITE_CONFIRMATION = "KOSONGKAN NILAI";
const IDENTITY_WARNING_CODES = new Set(["RESTORE_STUDENT_NAME_CHANGED", "RESTORE_STUDENT_NISN_CHANGED"]);

function readError(code: WorkbookReadError["code"], message: string, details?: string): WorkbookReadError {
  return { code, message, details };
}

function cellText(value: WorkbookCell | undefined): string {
  return String(value ?? "").trim();
}

function normalizeHeader(value: WorkbookCell | undefined): string {
  return cellText(value).toLowerCase().replace(/\s+/g, "_");
}

function getSheet(workbook: WorkbookReadResult, name: string): WorkbookSheetData | null {
  return workbook.sheets.find((sheet) => sheet.name === name) || null;
}

function headerIndex(sheet: WorkbookSheetData): Map<string, number> {
  const header = sheet.rows[0] || [];
  return new Map(header.map((cell, index) => [normalizeHeader(cell), index]));
}

function readByHeader(row: WorkbookCell[], headers: Map<string, number>, name: string): WorkbookCell | undefined {
  const index = headers.get(name);
  return typeof index === "number" ? row[index] : undefined;
}

function optionalText(value: WorkbookCell | undefined): string | undefined {
  const text = cellText(value);
  return text || undefined;
}

function parseBackupValue(value: WorkbookCell | undefined): { ok: boolean; value: number | null; message?: string } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value === "number") {
    if (Number.isFinite(value) && value >= 0 && value <= 100) return { ok: true, value };
    return { ok: false, value: null, message: "Nilai backup harus berada pada rentang 0 sampai 100." };
  }
  const text = String(value).trim();
  if (!text) return { ok: true, value: null };
  const numeric = Number(text.replace(",", "."));
  if (Number.isFinite(numeric) && numeric >= 0 && numeric <= 100) return { ok: true, value: numeric };
  return { ok: false, value: null, message: "Nilai backup harus berupa angka 0 sampai 100 atau kosong." };
}

function parseManifest(sheet: WorkbookSheetData): GradeBackupManifest | null {
  const rows = sheet.rows.slice(1);
  const manifest: GradeBackupManifest = { app: "", export_type: "" };
  rows.forEach((row) => {
    const key = cellText(row[0]);
    if (!key) return;
    manifest[key] = cellText(row[1]);
  });
  return Object.keys(manifest).length > 2 ? manifest : null;
}

function parseStudents(sheet: WorkbookSheetData): ParsedGradeBackupStudent[] {
  const headers = headerIndex(sheet);
  return sheet.rows.slice(1)
    .map((row) => {
      const studentId = cellText(readByHeader(row, headers, "student_id"));
      const name = cellText(readByHeader(row, headers, "name"));
      const nisn = optionalText(readByHeader(row, headers, "nisn"));
      const normalizedName = optionalText(readByHeader(row, headers, "normalized_name")) || normalizeName(name).normalized;
      const normalizedNisn = optionalText(readByHeader(row, headers, "normalized_nisn")) || normalizeNisn(nisn || "").normalized;
      return { studentId, name, normalizedName, nisn, normalizedNisn };
    })
    .filter((item) => item.studentId);
}

function validateBackupStudents(
  students: ParsedGradeBackupStudent[],
  errors: WorkbookReadError[],
  warnings: WorkbookReadError[],
) {
  const byId = new Map<string, ParsedGradeBackupStudent[]>();
  const byNisn = new Map<string, ParsedGradeBackupStudent[]>();

  students.forEach((student) => {
    const idEntries = byId.get(student.studentId) || [];
    idEntries.push(student);
    byId.set(student.studentId, idEntries);

    if (student.normalizedNisn) {
      const nisnEntries = byNisn.get(student.normalizedNisn) || [];
      nisnEntries.push(student);
      byNisn.set(student.normalizedNisn, nisnEntries);
    }
  });

  byId.forEach((entries, studentId) => {
    if (entries.length <= 1) return;
    errors.push(readError(
      "IMPORT_WORKBOOK_READ_FAILED",
      `Backup berisi student_id duplikat (${studentId}). Restore diblokir agar nilai tidak masuk ke siswa yang salah.`,
      "_students.student_id",
    ));
  });

  byNisn.forEach((entries, nisn) => {
    if (entries.length <= 1) return;
    warnings.push(readError(
      "IMPORT_WORKBOOK_READ_FAILED",
      `Backup memiliki NISN duplikat (${nisn}) untuk ${entries.length} siswa. Periksa identitas siswa sebelum restore.`,
      "_students.nisn",
    ));
  });
}

function parseStructure(sheet: WorkbookSheetData): ParsedGradeBackupStructure[] {
  const headers = headerIndex(sheet);
  return sheet.rows.slice(1)
    .map((row) => {
      const chapterId = cellText(readByHeader(row, headers, "chapter_id"));
      const chapterName = cellText(readByHeader(row, headers, "chapter_name"));
      const assignmentName = optionalText(readByHeader(row, headers, "assignment_name"));
      return {
        chapterId,
        chapterName,
        normalizedChapterName: optionalText(readByHeader(row, headers, "normalized_chapter_name"))
          || normalizeText(toCanonicalChapterName(chapterName)),
        assignmentId: optionalText(readByHeader(row, headers, "assignment_id")),
        assignmentName,
        normalizedAssignmentName: optionalText(readByHeader(row, headers, "normalized_assignment_name"))
          || normalizeText(assignmentName || ""),
      };
    })
    .filter((item) => item.chapterId || item.assignmentId);
}

function parseGrades(sheet: WorkbookSheetData, errors: WorkbookReadError[]): ParsedGradeBackupValue[] {
  const headers = headerIndex(sheet);
  return sheet.rows.slice(1).flatMap((row, index) => {
    const rowIndex = index + 2;
    const studentId = cellText(readByHeader(row, headers, "student_id"));
    const gradeType = cellText(readByHeader(row, headers, "grade_type")) as RestorableGradeType;
    const parsedValue = parseBackupValue(readByHeader(row, headers, "value"));
    if (!studentId && !gradeType && readByHeader(row, headers, "value") === undefined) return [];

    if (!studentId) {
      errors.push(readError("IMPORT_WORKBOOK_READ_FAILED", "Baris nilai backup tidak memiliki student_id.", `_grades:${rowIndex}`));
      return [];
    }
    if (!RESTORABLE_GRADE_TYPES.has(gradeType)) {
      errors.push(readError("IMPORT_WORKBOOK_READ_FAILED", "Backup berisi tipe nilai yang tidak didukung.", `_grades:${rowIndex}`));
      return [];
    }
    if (!parsedValue.ok) {
      errors.push(readError("IMPORT_WORKBOOK_READ_FAILED", parsedValue.message || "Nilai backup tidak valid.", `_grades:${rowIndex}`));
      return [{
        gradeId: optionalText(readByHeader(row, headers, "grade_id")),
        studentId,
        subjectId: optionalText(readByHeader(row, headers, "subject_id")) || null,
        assignmentId: optionalText(readByHeader(row, headers, "assignment_id")) || null,
        gradeType,
        value: Number.NaN,
        semesterId: optionalText(readByHeader(row, headers, "semester_id")) || null,
        academicYearId: optionalText(readByHeader(row, headers, "academic_year_id")) || null,
        createdAt: optionalText(readByHeader(row, headers, "created_at")) || null,
        updatedAt: optionalText(readByHeader(row, headers, "updated_at")) || null,
        rowIndex,
      } as ParsedGradeBackupValue];
    }

    return [{
      gradeId: optionalText(readByHeader(row, headers, "grade_id")),
      studentId,
      subjectId: optionalText(readByHeader(row, headers, "subject_id")) || null,
      assignmentId: optionalText(readByHeader(row, headers, "assignment_id")) || null,
      gradeType,
      value: parsedValue.value,
      semesterId: optionalText(readByHeader(row, headers, "semester_id")) || null,
      academicYearId: optionalText(readByHeader(row, headers, "academic_year_id")) || null,
      createdAt: optionalText(readByHeader(row, headers, "created_at")) || null,
      updatedAt: optionalText(readByHeader(row, headers, "updated_at")) || null,
      rowIndex,
    }];
  });
}

export function readGradeBackupWorkbook(input: WorkbookReadResult | ArrayBuffer, fileName = "backup-nilai.xlsx"): GradeBackupReadResult {
  const workbook = input instanceof ArrayBuffer ? readWorkbookBuffer(input, fileName) : input;
  const errors: WorkbookReadError[] = [];
  const warnings: WorkbookReadError[] = [...workbook.warnings];

  if (!workbook.ok && "error" in workbook) {
    errors.push(workbook.error);
  }

  if (workbook.fileType && workbook.fileType !== "xlsx" && workbook.fileType !== "xls") {
    errors.push(readError("IMPORT_UNSUPPORTED_FILE_TYPE", "Restore backup nilai hanya menerima file Excel .xlsx atau .xls."));
  }

  const missingSheets = REQUIRED_BACKUP_SHEETS.filter((sheetName) => !getSheet(workbook, sheetName));
  missingSheets.forEach((sheetName) => {
    errors.push(readError("IMPORT_NO_VALID_SHEET", `Sheet ${sheetName} tidak ditemukan. File ini bukan backup nilai SIPENA lengkap.`, sheetName));
  });

  const manifestSheet = getSheet(workbook, "_manifest");
  const studentsSheet = getSheet(workbook, "_students");
  const structureSheet = getSheet(workbook, "_structure");
  const gradesSheet = getSheet(workbook, "_grades");
  const manifest = manifestSheet ? parseManifest(manifestSheet) : null;

  if (!manifest) {
    errors.push(readError("IMPORT_NO_VALID_SHEET", "Manifest backup tidak ditemukan atau kosong.", "_manifest"));
  } else {
    if (normalizeText(manifest.app || "") !== "sipena") {
      errors.push(readError("IMPORT_WORKBOOK_READ_FAILED", "File ini bukan backup dari aplikasi SIPENA.", "_manifest.app"));
    }
    if ((manifest.export_type || "").trim().toLowerCase() !== "grade_backup") {
      errors.push(readError("IMPORT_WORKBOOK_READ_FAILED", "File ini bukan backup nilai SIPENA.", "_manifest.export_type"));
    }
  }

  const gradeErrors: WorkbookReadError[] = [];
  const students = studentsSheet ? parseStudents(studentsSheet) : [];
  const structure = structureSheet ? parseStructure(structureSheet) : [];
  const grades = gradesSheet ? parseGrades(gradesSheet, gradeErrors) : [];
  validateBackupStudents(students, errors, warnings);
  errors.push(...gradeErrors);

  return {
    ok: errors.length === 0,
    fileName: workbook.fileName,
    manifest: manifest || undefined,
    students,
    structure,
    grades,
    errors,
    warnings,
  };
}

function contextConflict(code: string, message: string, field: string, severity: GradeBackupRestoreSeverity = "blocked"): GradeBackupRestoreConflict {
  return { code, type: "context", severity, message, field };
}

function compareIdentity(
  conflicts: GradeBackupRestoreConflict[],
  manifestValue: string | undefined,
  currentValue: string | null | undefined,
  field: string,
  label: string,
) {
  if (!manifestValue || !currentValue) return;
  if (manifestValue !== currentValue) {
    conflicts.push(contextConflict(
      `RESTORE_${field.toUpperCase()}_MISMATCH`,
      `${label} pada backup berbeda dari halaman aktif.`,
      field,
      "blocked",
    ));
  }
}

function compareName(
  conflicts: GradeBackupRestoreConflict[],
  manifestValue: string | undefined,
  currentValue: string | null | undefined,
  field: string,
  label: string,
) {
  if (!manifestValue || !currentValue) return;
  if (normalizeText(manifestValue) !== normalizeText(currentValue)) {
    conflicts.push(contextConflict(
      `RESTORE_${field.toUpperCase()}_NAME_WARNING`,
      `${label} memiliki nama berbeda, tetapi ID masih sama.`,
      field,
      "warning",
    ));
  }
}

function buildContextConflicts(source: GradeBackupReadResult, context: GradeBackupRestoreContext): GradeBackupRestoreConflict[] {
  const manifest = source.manifest;
  if (!manifest) return [contextConflict("RESTORE_MANIFEST_MISSING", "Manifest backup tidak tersedia.", "manifest")];

  const conflicts: GradeBackupRestoreConflict[] = [];
  compareIdentity(conflicts, manifest.class_id, context.classId, "class_id", "Kelas");
  compareIdentity(conflicts, manifest.subject_id, context.subjectId, "subject_id", "Mata pelajaran");
  compareIdentity(conflicts, manifest.semester_id, context.semesterId, "semester_id", "Semester");
  compareIdentity(conflicts, manifest.academic_year_id, context.academicYearId, "academic_year_id", "Tahun ajaran");

  if (manifest.class_id && manifest.class_id === context.classId) compareName(conflicts, manifest.class_name, context.className, "class", "Kelas");
  if (manifest.subject_id && manifest.subject_id === context.subjectId) compareName(conflicts, manifest.subject_name, context.subjectName, "subject", "Mata pelajaran");
  if (manifest.semester_id && manifest.semester_id === context.semesterId) compareName(conflicts, manifest.semester_name, context.semesterName, "semester", "Semester");

  return conflicts;
}

function targetLabel(gradeType: RestorableGradeType, assignmentName?: string) {
  if (gradeType === "assignment") return assignmentName || "Tugas";
  return gradeType.toUpperCase();
}

function gradeTargetKey(grade: Pick<ParsedGradeBackupValue, "studentId" | "gradeType" | "assignmentId">) {
  return [
    grade.studentId,
    grade.gradeType,
    grade.gradeType === "assignment" ? grade.assignmentId || "" : "",
  ].join("|");
}

function scopedTimestamp(grade: ParsedGradeBackupValue): number {
  const updated = Date.parse(grade.updatedAt || "");
  if (Number.isFinite(updated)) return updated;
  const created = Date.parse(grade.createdAt || "");
  return Number.isFinite(created) ? created : 0;
}

function scopePriority(grade: ParsedGradeBackupValue, manifest?: GradeBackupManifest): number {
  const yearId = manifest?.academic_year_id || null;
  const semesterId = manifest?.semester_id || null;
  let score = 0;

  if (yearId) {
    if (grade.academicYearId === yearId) score += 40;
    else if (!grade.academicYearId) score += 20;
    else return -1;
  } else if (!grade.academicYearId) {
    score += 40;
  }

  if (semesterId) {
    if (grade.semesterId === semesterId) score += 4;
    else if (!grade.semesterId) score += 2;
    else return -1;
  } else if (!grade.semesterId) {
    score += 4;
  }

  return score;
}

function preferredBackupRowIndexes(grades: ParsedGradeBackupValue[], manifest?: GradeBackupManifest): Set<number> {
  const byTarget = new Map<string, ParsedGradeBackupValue[]>();
  grades.forEach((grade) => {
    const key = gradeTargetKey(grade);
    const entries = byTarget.get(key) || [];
    entries.push(grade);
    byTarget.set(key, entries);
  });

  const selected = new Set<number>();
  byTarget.forEach((entries) => {
    const ordered = [...entries].sort((left, right) => {
      const scoreDelta = scopePriority(right, manifest) - scopePriority(left, manifest);
      if (scoreDelta !== 0) return scoreDelta;
      const timeDelta = scopedTimestamp(right) - scopedTimestamp(left);
      if (timeDelta !== 0) return timeDelta;
      return right.rowIndex - left.rowIndex;
    });
    const best = ordered.find((entry) => scopePriority(entry, manifest) >= 0);
    if (best) selected.add(best.rowIndex);
  });

  return selected;
}

function fallbackBackupGrade(entries: ParsedGradeBackupValue[], manifest?: GradeBackupManifest): ParsedGradeBackupValue | undefined {
  return [...entries].sort((left, right) => {
    const scoreDelta = scopePriority(right, manifest) - scopePriority(left, manifest);
    if (scoreDelta !== 0) return scoreDelta;
    const timeDelta = scopedTimestamp(right) - scopedTimestamp(left);
    if (timeDelta !== 0) return timeDelta;
    return right.rowIndex - left.rowIndex;
  })[0];
}

function canonicalBackupGrades(
  grades: ParsedGradeBackupValue[],
  preferredRows: Set<number>,
  manifest?: GradeBackupManifest,
): ParsedGradeBackupValue[] {
  const byTarget = new Map<string, ParsedGradeBackupValue[]>();
  grades.forEach((grade) => {
    const key = gradeTargetKey(grade);
    const entries = byTarget.get(key) || [];
    entries.push(grade);
    byTarget.set(key, entries);
  });

  const selected: ParsedGradeBackupValue[] = [];
  byTarget.forEach((entries) => {
    const preferred = entries.find((entry) => preferredRows.has(entry.rowIndex));
    const fallback = preferred || fallbackBackupGrade(entries, manifest);
    if (fallback) selected.push(fallback);
  });

  return selected.sort((left, right) => left.rowIndex - right.rowIndex);
}

function duplicateBackupWarnings(
  grades: ParsedGradeBackupValue[],
  selectedGrades: ParsedGradeBackupValue[],
): Map<number, string[]> {
  const duplicateValueLabel = (entry: ParsedGradeBackupValue) => `${entry.value === null ? "Kosong" : entry.value} (baris ${entry.rowIndex})`;
  const selectedRowIndexes = new Set(selectedGrades.map((grade) => grade.rowIndex));
  const byTarget = new Map<string, ParsedGradeBackupValue[]>();
  grades.forEach((grade) => {
    const key = gradeTargetKey(grade);
    const entries = byTarget.get(key) || [];
    entries.push(grade);
    byTarget.set(key, entries);
  });

  const warnings = new Map<number, string[]>();
  byTarget.forEach((entries) => {
    if (entries.length <= 1) return;
    const selected = entries.find((entry) => selectedRowIndexes.has(entry.rowIndex));
    if (!selected) return;
    const valuesAreSame = entries.every((entry) => Object.is(entry.value, selected.value));
    if (valuesAreSame) return;
    const valueDetails = entries
      .map(duplicateValueLabel)
      .join(", ");
    warnings.set(selected.rowIndex, [
      `Backup memiliki ${entries.length} baris _grades untuk target yang sama dengan nilai berbeda: ${valueDetails}. Restore memilih ${duplicateValueLabel(selected)} karena konteks semester/tahun ajaran dan waktu paling sesuai. Ini bukan konflik nama atau NISN siswa.`,
    ]);
  });

  return warnings;
}

function findCurrentValue(context: GradeBackupRestoreContext, backupGrade: ParsedGradeBackupValue): number | null {
  const studentGrades = context.grades.filter((grade) => {
    if (grade.student_id !== backupGrade.studentId) return false;
    if (context.subjectId && grade.subject_id && grade.subject_id !== context.subjectId) return false;
    if (context.academicYearId) {
      if (grade.academic_year_id && grade.academic_year_id !== context.academicYearId) return false;
    }
    return true;
  });

  return getScopedGradeValue(studentGrades, {
    gradeType: backupGrade.gradeType,
    assignmentId: backupGrade.assignmentId || undefined,
    semesterId: context.semesterId || null,
  });
}

function operationSummary(operations: GradeBackupRestoreOperation[], contextConflicts: GradeBackupRestoreConflict[]) {
  const count = (status: GradeBackupRestoreOperationStatus) => operations.filter((operation) => operation.status === status).length;
  return {
    added: count("added"),
    overwrite: count("overwrite"),
    unchanged: count("unchanged"),
    skipped: count("skipped"),
    invalid: count("invalid"),
    contextConflicts: contextConflicts.length,
    studentConflicts: operations.flatMap((operation) => operation.conflicts).filter((item) => item.type === "student").length,
    structureConflicts: operations.flatMap((operation) => operation.conflicts).filter((item) => item.type === "structure").length,
    invalidValues: operations.flatMap((operation) => operation.conflicts).filter((item) => item.type === "grade_value").length,
    restorable: operations.filter((operation) => operation.status === "added" || operation.status === "overwrite").length,
  };
}

function hasIdentityWarning(operation: GradeBackupRestoreOperation): boolean {
  return operation.conflicts.some((conflict) => conflict.type === "student" && conflict.severity === "warning" && IDENTITY_WARNING_CODES.has(conflict.code));
}

export function buildGradeBackupRestorePlan(source: GradeBackupReadResult, context: GradeBackupRestoreContext): GradeBackupRestorePlan {
  const currentStudents = new Map(context.students.map((student) => [student.id, student]));
  const backupStudents = new Map(source.students.map((student) => [student.studentId, student]));
  const currentAssignments = new Map(context.assignments.map((assignment) => [assignment.id, assignment]));
  const currentChapters = new Map(context.chapters.map((chapter) => [chapter.id, chapter]));
  const backupStructure = new Map(source.structure.filter((item) => item.assignmentId).map((item) => [item.assignmentId || "", item]));
  const contextConflicts = buildContextConflicts(source, context);
  const preferredRows = preferredBackupRowIndexes(source.grades, source.manifest);
  const selectedBackupGrades = canonicalBackupGrades(source.grades, preferredRows, source.manifest);
  const duplicateWarnings = duplicateBackupWarnings(source.grades, selectedBackupGrades);

  const operations = selectedBackupGrades.map((backupGrade): GradeBackupRestoreOperation => {
    const operationId = `restore:${backupGrade.studentId}:${backupGrade.gradeType}:${backupGrade.assignmentId || "final"}:${backupGrade.rowIndex}`;
    const conflicts: GradeBackupRestoreConflict[] = [];
    const warnings: string[] = [...(duplicateWarnings.get(backupGrade.rowIndex) || [])];
    const currentStudent = currentStudents.get(backupGrade.studentId);
    const backupStudent = backupStudents.get(backupGrade.studentId);

    if (!backupStudent) {
      conflicts.push({
        code: "RESTORE_BACKUP_STUDENT_METADATA_MISSING",
        type: "student",
        severity: "blocked",
        message: "Baris nilai backup mengarah ke siswa yang tidak ada di sheet _students.",
        operationId,
      });
    }

    if (!currentStudent) {
      conflicts.push({
        code: "RESTORE_STUDENT_NOT_FOUND",
        type: "student",
        severity: "blocked",
        message: "Siswa dari backup tidak ditemukan di kelas aktif.",
        operationId,
      });
    } else if (backupStudent) {
      if (normalizeName(currentStudent.name).normalized !== backupStudent.normalizedName) {
        conflicts.push({
          code: "RESTORE_STUDENT_NAME_CHANGED",
          type: "student",
          severity: "warning",
          message: "Nama siswa aktif berbeda dari backup, walau student_id sama.",
          operationId,
        });
      }
      const currentNisn = normalizeNisn(currentStudent.nisn || "").normalized;
      if (backupStudent.normalizedNisn && currentNisn && currentNisn !== backupStudent.normalizedNisn) {
        conflicts.push({
          code: "RESTORE_STUDENT_NISN_CHANGED",
          type: "student",
          severity: "warning",
          message: "NISN siswa aktif berbeda dari backup, walau student_id sama.",
          operationId,
        });
      }
    }

    let assignmentName: string | undefined;
    let chapterName: string | undefined;
    if (backupGrade.gradeType === "assignment") {
      if (!backupGrade.assignmentId) {
        conflicts.push({
          code: "RESTORE_ASSIGNMENT_ID_MISSING",
          type: "structure",
          severity: "blocked",
          message: "Nilai tugas di backup tidak memiliki assignment_id.",
          operationId,
        });
      } else {
        const assignment = currentAssignments.get(backupGrade.assignmentId);
        const backupAssignment = backupStructure.get(backupGrade.assignmentId);
        if (!assignment) {
          conflicts.push({
            code: "RESTORE_ASSIGNMENT_NOT_FOUND",
            type: "structure",
            severity: "blocked",
            message: "Tugas dari backup tidak ditemukan di struktur aktif.",
            operationId,
          });
        } else {
          assignmentName = assignment.name;
          const chapter = currentChapters.get(assignment.chapter_id);
          chapterName = chapter?.name;
          if (backupAssignment?.normalizedAssignmentName && normalizeText(assignment.name) !== backupAssignment.normalizedAssignmentName) {
            warnings.push("Nama tugas berbeda dari backup, tetapi assignment_id cocok.");
          }
          if (backupAssignment?.chapterId && backupAssignment.chapterId !== assignment.chapter_id) {
            warnings.push("BAB tugas berbeda dari backup, tetapi assignment_id masih cocok.");
          }
        }
      }
    }

    if (!Number.isNaN(backupGrade.value) && backupGrade.value !== null && (backupGrade.value < 0 || backupGrade.value > 100)) {
      conflicts.push({
        code: "RESTORE_VALUE_INVALID",
        type: "grade_value",
        severity: "blocked",
        message: "Nilai backup tidak valid.",
        operationId,
      });
    }

    if (backupGrade.subjectId && context.subjectId && backupGrade.subjectId !== context.subjectId) {
      conflicts.push({
        code: "RESTORE_GRADE_SUBJECT_MISMATCH",
        type: "context",
        severity: "blocked",
        message: "Baris nilai backup berasal dari mata pelajaran lain.",
        operationId,
      });
    }

    if (
      source.manifest?.academic_year_id
      && backupGrade.academicYearId
      && backupGrade.academicYearId !== source.manifest.academic_year_id
    ) {
      conflicts.push({
        code: "RESTORE_ROW_ACADEMIC_YEAR_MISMATCH",
        type: "context",
        severity: "blocked",
        message: "Baris nilai backup berasal dari tahun ajaran lain.",
        operationId,
      });
    }

    if (
      source.manifest?.semester_id
      && backupGrade.semesterId
      && backupGrade.semesterId !== source.manifest.semester_id
    ) {
      conflicts.push({
        code: "RESTORE_ROW_SEMESTER_MISMATCH",
        type: "context",
        severity: "blocked",
        message: "Baris nilai backup berasal dari semester lain.",
        operationId,
      });
    }

    const currentValue = currentStudent ? findCurrentValue(context, backupGrade) : null;
    let status: GradeBackupRestoreOperationStatus = "skipped";
    if (conflicts.some((item) => item.severity === "blocked")) {
      status = "invalid";
    } else if (backupGrade.value === null) {
      status = currentValue === null ? "unchanged" : "skipped";
    } else if (currentValue === null) {
      status = "added";
    } else if (currentValue === backupGrade.value) {
      status = "unchanged";
    } else {
      status = "overwrite";
    }

    return {
      id: operationId,
      status,
      studentId: backupGrade.studentId,
      studentName: currentStudent?.name,
      studentNisn: currentStudent?.nisn,
      backupStudentName: backupStudent?.name,
      backupStudentNisn: backupStudent?.nisn,
      gradeType: backupGrade.gradeType,
      assignmentId: backupGrade.gradeType === "assignment" ? backupGrade.assignmentId || undefined : undefined,
      assignmentName,
      chapterName,
      backupValue: Number.isNaN(backupGrade.value) ? null : backupGrade.value,
      currentValue,
      academicYearId: context.academicYearId || null,
      semesterId: context.semesterId || null,
      rowIndex: backupGrade.rowIndex,
      conflicts,
      warnings,
    };
  });

  return {
    source,
    contextConflicts,
    operations,
    summary: operationSummary(operations, contextConflicts),
  };
}

function canUsePlan(plan: GradeBackupRestorePlan, options: GradeBackupRestoreBatchBuildOptions): string[] {
  const blockedReasons: string[] = [];
  const hasBlockingContext = plan.contextConflicts.some((conflictItem) => conflictItem.severity === "blocked");
  if (hasBlockingContext && !options.allowContextMismatch) {
    blockedReasons.push("Konteks backup berbeda dari halaman aktif. Pilih mode paksa restore lintas konteks jika benar-benar yakin.");
  }
  const hasStudentIdentityWarnings = plan.operations.some(hasIdentityWarning);
  if (hasStudentIdentityWarnings && !options.allowIdentityMismatch) {
    blockedReasons.push("Ada nama atau NISN siswa yang berbeda dari backup. Aktifkan izin restore untuk siswa dengan identitas berubah jika sudah diverifikasi.");
  }
  if (options.mode === "full_confirmed" && options.confirmationText !== FULL_RESTORE_CONFIRMATION) {
    blockedReasons.push(`Ketik ${FULL_RESTORE_CONFIRMATION} untuk menjalankan restore penuh.`);
  }
  if (
    options.includeNullOverwrites
    && options.mode === "full_confirmed"
    && options.nullOverwriteConfirmationText !== NULL_OVERWRITE_CONFIRMATION
  ) {
    blockedReasons.push(`Ketik ${NULL_OVERWRITE_CONFIRMATION} untuk mengosongkan nilai web sesuai backup.`);
  }
  return blockedReasons;
}

export function buildGradeBackupRestoreBatchItems(
  plan: GradeBackupRestorePlan,
  options: GradeBackupRestoreBatchBuildOptions,
): GradeBackupRestoreBatchBuildResult {
  const selectedIds = new Set(options.selectedOperationIds || []);
  const blockedReasons = canUsePlan(plan, options);
  const summary = {
    added: 0,
    overwritten: 0,
    cleared: 0,
    unchanged: plan.summary.unchanged,
    skipped: plan.summary.skipped,
    invalid: plan.summary.invalid,
  };

  if (blockedReasons.length > 0) {
    return { items: [], blockedReasons, summary };
  }

  const items = plan.operations.flatMap((operation): GradeBackupRestoreBatchItem[] => {
    if (operation.conflicts.some((conflictItem) => conflictItem.severity === "blocked")) return [];
    if (hasIdentityWarning(operation) && !options.allowIdentityMismatch) return [];
    const isAdded = operation.status === "added";
    const isOverwrite = operation.status === "overwrite";
    const isClear = operation.status === "skipped" && operation.backupValue === null && operation.currentValue !== null;

    const include = (() => {
      if (options.mode === "fill_empty_only") return isAdded;
      if (options.mode === "overwrite_selected") return isAdded || (isOverwrite && selectedIds.has(operation.id));
      if (options.mode === "full_confirmed") return isAdded || isOverwrite || (isClear && options.includeNullOverwrites);
      return false;
    })();

    if (!include) return [];
    if (operation.gradeType === "assignment" && !operation.assignmentId) return [];
    if (operation.backupValue === null && !options.includeNullOverwrites) return [];

    if (isAdded) summary.added += 1;
    else if (operation.backupValue === null) summary.cleared += 1;
    else summary.overwritten += 1;

    return [{
      studentId: operation.studentId,
      gradeType: operation.gradeType,
      assignmentId: operation.gradeType === "assignment" ? operation.assignmentId : undefined,
      academicYearId: operation.academicYearId,
      semesterId: operation.semesterId,
      value: operation.backupValue,
    }];
  });

  if (items.length === 0) {
    blockedReasons.push("Tidak ada nilai yang memenuhi mode restore saat ini.");
  }

  return { items, blockedReasons, summary };
}

export function gradeBackupOperationLabel(operation: Pick<GradeBackupRestoreOperation, "gradeType" | "assignmentName">): string {
  return targetLabel(operation.gradeType, operation.assignmentName);
}

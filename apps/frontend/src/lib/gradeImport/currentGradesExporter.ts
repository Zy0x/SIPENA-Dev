import * as XLSX from "xlsx";

import type { GradeValueRecord } from "../gradeValueSelection";
import { normalizeName, normalizeNisn, normalizeText, toCanonicalChapterName } from "./textNormalizer";

export interface GradeExportStudent {
  id: string;
  name: string;
  nisn?: string | null;
}

export interface GradeExportChapter {
  id: string;
  name: string;
  order_index?: number | null;
}

export interface GradeExportAssignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index?: number | null;
}

export interface GradeExportGrade extends GradeValueRecord {
  id?: string;
  student_id: string;
  subject_id?: string | null;
  academic_year_id?: string | null;
}

export interface GradeExportContext {
  classId?: string | null;
  className: string;
  subjectId?: string | null;
  subjectName: string;
  semesterId?: string | null;
  semesterName?: string | null;
  academicYearId?: string | null;
  students: GradeExportStudent[];
  chapters: GradeExportChapter[];
  assignments: GradeExportAssignment[];
  grades: GradeExportGrade[];
  generatedAt?: string;
}

export interface GradeBackupWorkbookOptions {
  protectMetadata?: boolean;
}

type SheetVisibility = 0 | 1 | 2;

interface WorkbookWithVisibility extends XLSX.WorkBook {
  Workbook?: {
    Sheets?: Array<{ name: string; Hidden?: SheetVisibility }>;
  };
}

interface StyledCell extends XLSX.CellObject {
  s?: unknown;
}

interface ExportColumn {
  visibleHeader: string;
  gradeType: "assignment" | "sts" | "sas";
  chapterId?: string;
  assignmentId?: string;
  targetKey: string;
}

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeFileSegment(value: string): string {
  const cleaned = safeText(value)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "Data";
}

function formatExportDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function hashPayload(value: unknown): string {
  const payload = stableStringify(value);
  let hash = 0x811c9dc5;

  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function setFreezePane(ws: XLSX.WorkSheet, xSplit: number, ySplit: number) {
  (ws as XLSX.WorkSheet & { "!freeze"?: { xSplit: number; ySplit: number } })["!freeze"] = {
    xSplit,
    ySplit,
  };
}

function styleHeaderRow(ws: XLSX.WorkSheet, rowIndex: number, columnCount: number) {
  for (let col = 0; col < columnCount; col += 1) {
    const ref = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    const cell = ws[ref] as StyledCell | undefined;
    if (cell) {
      cell.s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "EAF3FF" } },
        alignment: { vertical: "center", wrapText: true },
      };
    }
  }
}

function forceTextColumn(ws: XLSX.WorkSheet, columnIndex: number, firstRow: number, lastRow: number) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    const ref = XLSX.utils.encode_cell({ r: row, c: columnIndex });
    const cell = ws[ref] as StyledCell | undefined;
    if (cell) {
      cell.t = "s";
      cell.z = "@";
    }
  }
}

function alignColumnCenter(ws: XLSX.WorkSheet, columnIndex: number, firstRow: number, lastRow: number) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    const ref = XLSX.utils.encode_cell({ r: row, c: columnIndex });
    const cell = ws[ref] as StyledCell | undefined;
    if (cell) {
      const previousStyle = (cell.s || {}) as Record<string, unknown>;
      cell.s = {
        ...previousStyle,
        alignment: {
          ...((previousStyle.alignment || {}) as Record<string, unknown>),
          horizontal: "center",
          vertical: "center",
        },
      };
    }
  }
}

function appendSheet(wb: WorkbookWithVisibility, ws: XLSX.WorkSheet, name: string, hidden: SheetVisibility = 0) {
  XLSX.utils.book_append_sheet(wb, ws, name);
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.Workbook.Sheets || [];
  const existing = wb.Workbook.Sheets.find((sheet) => sheet.name === name);
  if (existing) {
    existing.Hidden = hidden;
  } else {
    wb.Workbook.Sheets.push({ name, Hidden: hidden });
  }
}

function getOrderedStructure(context: Pick<GradeExportContext, "chapters" | "assignments">) {
  const chapters = [...context.chapters].sort((left, right) => {
    const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });

  const chapterOrder = new Map(chapters.map((chapter, index) => [chapter.id, index]));
  const assignments = [...context.assignments].sort((left, right) => {
    const leftChapter = chapterOrder.get(left.chapter_id) ?? Number.MAX_SAFE_INTEGER;
    const rightChapter = chapterOrder.get(right.chapter_id) ?? Number.MAX_SAFE_INTEGER;
    const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER;
    return leftChapter - rightChapter || leftOrder - rightOrder || left.name.localeCompare(right.name);
  });

  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return { chapters, assignments, chapterById };
}

function buildExportColumns(context: GradeExportContext): ExportColumn[] {
  const { assignments, chapterById } = getOrderedStructure(context);
  return [
    ...assignments.map((assignment) => {
      const chapter = chapterById.get(assignment.chapter_id);
      const chapterName = chapter ? toCanonicalChapterName(chapter.name) : "BAB";
      return {
        visibleHeader: `${chapterName} - ${safeText(assignment.name)}`,
        gradeType: "assignment" as const,
        chapterId: assignment.chapter_id,
        assignmentId: assignment.id,
        targetKey: `assignment:${assignment.id}`,
      };
    }),
    { visibleHeader: "STS", gradeType: "sts" as const, targetKey: "special:sts" },
    { visibleHeader: "SAS", gradeType: "sas" as const, targetKey: "special:sas" },
  ];
}

function matchesExportColumn(grade: GradeExportGrade, column: ExportColumn): boolean {
  return grade.grade_type === column.gradeType
    && (column.assignmentId ? grade.assignment_id === column.assignmentId : !grade.assignment_id);
}

function sortByNewest(left: GradeExportGrade, right: GradeExportGrade) {
  const leftTime = Date.parse(left.updated_at || left.created_at || "");
  const rightTime = Date.parse(right.updated_at || right.created_at || "");
  return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
}

function pickScopedGrade(grades: GradeExportGrade[], column: ExportColumn, semesterId?: string | null): GradeExportGrade | null {
  const candidates = grades.filter((grade) => matchesExportColumn(grade, column));
  if (candidates.length === 0) return null;

  if (semesterId) {
    const exactSemester = candidates.filter((grade) => grade.semester_id === semesterId);
    if (exactSemester.length > 0) return [...exactSemester].sort(sortByNewest)[0];

    const legacySemester = candidates.filter((grade) => !grade.semester_id);
    if (legacySemester.length > 0) return [...legacySemester].sort(sortByNewest)[0];

    return null;
  }

  return [...candidates].sort(sortByNewest)[0];
}

function getStudentGradeValue(context: GradeExportContext, studentId: string, column: ExportColumn): number | "" {
  const studentGrades = context.grades.filter((grade) => grade.student_id === studentId);
  if (context.academicYearId) {
    const exactYear = pickScopedGrade(
      studentGrades.filter((grade) => grade.academic_year_id === context.academicYearId),
      column,
      context.semesterId || null,
    );
    if (exactYear) return exactYear.value ?? "";

    const legacyYear = pickScopedGrade(
      studentGrades.filter((grade) => !grade.academic_year_id),
      column,
      context.semesterId || null,
    );
    return legacyYear?.value ?? "";
  }

  const value = pickScopedGrade(studentGrades, column, context.semesterId || null);
  return value?.value ?? "";
}

function createGuideSheet(type: "current" | "backup", options: GradeBackupWorkbookOptions = {}) {
  const protectedMode = Boolean(options.protectMetadata);
  const rows = type === "current"
    ? [
        ["SIPENA - Export Nilai Saat Ini"],
        [""],
        ["Isi workbook"],
        ["1. Sheet Nilai berisi siswa, BAB/tugas, STS, SAS, dan nilai yang sedang tersimpan."],
        ["2. Nilai kosong tetap dikosongkan dan tidak diubah menjadi 0."],
        ["3. Workbook ini untuk cek atau melengkapi nilai saat ini, bukan template validasi lengkap."],
        ["4. Jika ingin import paling terarah, download Template Resmi SIPENA dari halaman yang sama."],
      ]
    : [
        ["SIPENA - Backup Lengkap Nilai"],
        [""],
        ["Isi workbook"],
        ["1. Sheet Nilai berisi tampilan nilai aktif agar mudah diperiksa di Excel."],
        ["2. Sheet metadata tersembunyi (_manifest, _students, _structure, _grades) menyimpan identitas siswa, struktur BAB/tugas, konteks kelas-mapel-semester-tahun, dan nilai mentah dari web."],
        ["3. Backup ini dibuat dari data yang tersedia di browser saat export. Simpan file ini sebagai arsip sebelum import/restore massal."],
        [protectedMode
          ? "4. Mode perlindungan metadata AKTIF: saat restore, SIPENA memakai nilai dari _grades. Perubahan manual di sheet Nilai hanya untuk catatan Excel dan tidak akan menimpa metadata."
          : "4. Mode edit sheet Nilai AKTIF: metadata tetap melindungi siswa dan struktur, tetapi perubahan nilai manual di sheet Nilai akan dipakai sebagai override saat restore."],
        ["5. Jangan mengubah student_id, assignment_id, atau sheet metadata kecuali benar-benar memahami risikonya."],
        ["6. Restore tetap meminta preview, pilihan mode, dan konfirmasi sebelum menyimpan ke web."],
      ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [110]);
  styleHeaderRow(ws, 0, 1);
  return ws;
}

function createGradesSheet(context: GradeExportContext, columns: ExportColumn[]) {
  const header = ["No", "NISN", "Nama Siswa", ...columns.map((column) => column.visibleHeader)];
  const rows = context.students.map((student, index) => [
    index + 1,
    safeText(student.nisn),
    safeText(student.name),
    ...columns.map((column) => getStudentGradeValue(context, student.id, column)),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  setColumnWidths(ws, [8, 18, 32, ...columns.map((column) => Math.max(14, Math.min(30, column.visibleHeader.length + 2)))]);
  setFreezePane(ws, 3, 1);
  styleHeaderRow(ws, 0, header.length);
  forceTextColumn(ws, 1, 1, rows.length);
  alignColumnCenter(ws, 1, 0, rows.length);
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }),
  };
  return ws;
}

function createManifestSheet(context: GradeExportContext, columns: ExportColumn[], options: GradeBackupWorkbookOptions = {}) {
  const protectedMode = Boolean(options.protectMetadata);
  const rows = [
    ["key", "value"],
    ["app", "SIPENA"],
    ["export_type", "grade_backup"],
    ["export_version", "1.0.0"],
    ["metadata_locked", protectedMode ? "true" : "false"],
    ["restore_value_source", protectedMode ? "metadata" : "visible_sheet_override"],
    ["visible_sheet_override", protectedMode ? "disabled" : "enabled"],
    ["class_id", context.classId || ""],
    ["class_name", context.className],
    ["subject_id", context.subjectId || ""],
    ["subject_name", context.subjectName],
    ["semester_id", context.semesterId || ""],
    ["semester_name", context.semesterName || ""],
    ["academic_year_id", context.academicYearId || ""],
    ["generated_at", context.generatedAt || new Date().toISOString()],
    ["students_count", context.students.length],
    ["chapters_count", context.chapters.length],
    ["assignments_count", context.assignments.length],
    ["grades_count", context.grades.length],
    ["students_hash", hashPayload(context.students)],
    ["structure_hash", hashPayload({ chapters: context.chapters, assignments: context.assignments })],
    ["grades_hash", hashPayload(context.grades.map((grade) => ({
      student_id: grade.student_id,
      subject_id: grade.subject_id || "",
      grade_type: grade.grade_type,
      assignment_id: grade.assignment_id || "",
      value: grade.value,
      semester_id: grade.semester_id || "",
      academic_year_id: grade.academic_year_id || "",
      created_at: grade.created_at || "",
      updated_at: grade.updated_at || "",
    })))],
    ["columns_hash", hashPayload(columns)],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [28, 72]);
  styleHeaderRow(ws, 0, 2);
  return ws;
}

function createStudentsSheet(context: GradeExportContext) {
  const rows = [
    ["student_id", "name", "normalized_name", "nisn", "normalized_nisn"],
    ...context.students.map((student) => [
      student.id,
      safeText(student.name),
      normalizeName(student.name).normalized,
      safeText(student.nisn),
      normalizeNisn(student.nisn || "").normalized,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [40, 32, 32, 18, 18]);
  styleHeaderRow(ws, 0, 5);
  forceTextColumn(ws, 3, 1, rows.length - 1);
  forceTextColumn(ws, 4, 1, rows.length - 1);
  return ws;
}

function createStructureSheet(context: GradeExportContext) {
  const { chapters, assignments, chapterById } = getOrderedStructure(context);
  const rows: unknown[][] = [[
    "chapter_id",
    "chapter_name",
    "normalized_chapter_name",
    "assignment_id",
    "assignment_name",
    "normalized_assignment_name",
    "order",
  ]];

  const assignmentsByChapter = new Map<string, GradeExportAssignment[]>();
  assignments.forEach((assignment) => {
    const entries = assignmentsByChapter.get(assignment.chapter_id) || [];
    entries.push(assignment);
    assignmentsByChapter.set(assignment.chapter_id, entries);
  });

  chapters.forEach((chapter) => {
    const chapterAssignments = assignmentsByChapter.get(chapter.id) || [];
    if (chapterAssignments.length === 0) {
      rows.push([chapter.id, chapter.name, normalizeText(toCanonicalChapterName(chapter.name)), "", "", "", chapter.order_index ?? ""]);
      return;
    }
    chapterAssignments.forEach((assignment) => {
      const sourceChapter = chapterById.get(assignment.chapter_id) || chapter;
      rows.push([
        sourceChapter.id,
        sourceChapter.name,
        normalizeText(toCanonicalChapterName(sourceChapter.name)),
        assignment.id,
        assignment.name,
        normalizeText(assignment.name),
        assignment.order_index ?? sourceChapter.order_index ?? "",
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [40, 24, 28, 40, 28, 32, 12]);
  styleHeaderRow(ws, 0, 7);
  return ws;
}

function createGradesMetadataSheet(context: GradeExportContext) {
  const rows = [
    ["grade_id", "student_id", "subject_id", "assignment_id", "grade_type", "value", "semester_id", "academic_year_id", "created_at", "updated_at"],
    ...context.grades.map((grade) => [
      grade.id || "",
      grade.student_id,
      grade.subject_id || context.subjectId || "",
      grade.assignment_id || "",
      grade.grade_type,
      grade.value ?? "",
      grade.semester_id || "",
      grade.academic_year_id || "",
      grade.created_at || "",
      grade.updated_at || "",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [40, 40, 40, 40, 16, 12, 40, 40, 28, 28]);
  styleHeaderRow(ws, 0, 10);
  return ws;
}

export function buildCurrentGradesExportWorkbook(context: GradeExportContext): XLSX.WorkBook {
  const wb = XLSX.utils.book_new() as WorkbookWithVisibility;
  const columns = buildExportColumns(context);
  appendSheet(wb, createGuideSheet("current"), "Panduan");
  appendSheet(wb, createGradesSheet(context, columns), "Nilai");
  return wb;
}

export function buildFullGradeBackupWorkbook(context: GradeExportContext, options: GradeBackupWorkbookOptions = {}): XLSX.WorkBook {
  const wb = XLSX.utils.book_new() as WorkbookWithVisibility;
  const columns = buildExportColumns(context);
  appendSheet(wb, createGuideSheet("backup", options), "Panduan");
  appendSheet(wb, createGradesSheet(context, columns), "Nilai");
  appendSheet(wb, createManifestSheet(context, columns, options), "_manifest", 1);
  appendSheet(wb, createStudentsSheet(context), "_students", 1);
  appendSheet(wb, createStructureSheet(context), "_structure", 1);
  appendSheet(wb, createGradesMetadataSheet(context), "_grades", 1);
  return wb;
}

export function getCurrentGradesExportFileName(context: Pick<GradeExportContext, "className" | "subjectName">, date = new Date()) {
  return [
    "Export_Nilai_SIPENA",
    sanitizeFileSegment(context.className),
    sanitizeFileSegment(context.subjectName),
    formatExportDate(date),
  ].join("_") + ".xlsx";
}

export function getFullGradeBackupFileName(context: Pick<GradeExportContext, "className" | "subjectName">, date = new Date()) {
  return [
    "Backup_Nilai_SIPENA",
    sanitizeFileSegment(context.className),
    sanitizeFileSegment(context.subjectName),
    formatExportDate(date),
  ].join("_") + ".xlsx";
}

export function downloadCurrentGradesExport(context: GradeExportContext) {
  XLSX.writeFile(buildCurrentGradesExportWorkbook(context), getCurrentGradesExportFileName(context));
}

export function downloadFullGradeBackup(context: GradeExportContext, options: GradeBackupWorkbookOptions = {}) {
  XLSX.writeFile(buildFullGradeBackupWorkbook(context, options), getFullGradeBackupFileName(context));
}

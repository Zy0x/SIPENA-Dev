import { matchColumns, type ColumnMatcherHeaderInput, type MatchedColumn } from "./columnMatcher";
import type { FreeExcelAnalysis } from "./freeExcelAnalyzer";
import type { OfficialTemplateAnalysis } from "./officialTemplateReader";
import { extractStudentRowsFromWorkbook, matchStudents, type ImportWebStudent, type OfficialStudentRowMetadata } from "./studentMatcher";
import type {
  GradeOperation,
  GradeTarget,
  ImportConflict,
  ImportPlan,
  ImportSourceType,
  ImportWarning,
  MappingStatus,
  StudentMapping,
  UpdateMode,
} from "./types";
import { parseGradeValue } from "./valueParser";
import type { WorkbookCell, WorkbookSheetData } from "./workbookReader";

export interface ImportPlanChapter {
  id: string;
  name: string;
  order_index?: number | null;
}

export interface ImportPlanAssignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index?: number | null;
}

export interface ImportPlanExistingGrade {
  student_id: string;
  grade_type: "assignment" | "sts" | "sas";
  assignment_id?: string | null;
  value: number | null;
  semester_id?: string | null;
}

export interface ImportPlanContext {
  students: ImportWebStudent[];
  chapters: ImportPlanChapter[];
  assignments: ImportPlanAssignment[];
  existingGrades?: ImportPlanExistingGrade[];
  classId?: string | null;
  subjectId?: string | null;
  semesterId?: string | null;
  academicYearId?: string | null;
}

export interface ImportPlanBuilderOptions {
  updateMode?: UpdateMode;
  strictMode?: boolean;
  selectedColumnIndexes?: number[];
}

export type ImportPlanInputAnalysis = OfficialTemplateAnalysis | FreeExcelAnalysis;

function warning(code: string, message: string, rowIndex?: number, columnIndex?: number, field?: string): ImportWarning {
  return { code, severity: "warning", message, rowIndex, columnIndex, field };
}

function conflict(
  code: string,
  message: string,
  type: ImportConflict["type"],
  rowIndex?: number,
  columnIndex?: number,
  options?: string[],
): ImportConflict {
  return { code, severity: "blocked", message, type, rowIndex, columnIndex, options };
}

function cellText(value: WorkbookCell | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function hasOfficialShape(analysis: ImportPlanInputAnalysis): analysis is OfficialTemplateAnalysis {
  return "sheetPresence" in analysis;
}

function sourceTypeOf(analysis: ImportPlanInputAnalysis): ImportSourceType {
  return analysis.sourceType;
}

function getSheetByName(analysis: OfficialTemplateAnalysis, name: string): WorkbookSheetData | null {
  return analysis.workbook.sheets.find((sheet) => sheet.name === name) || null;
}

function readOfficialStudentMetadata(analysis: OfficialTemplateAnalysis): OfficialStudentRowMetadata[] {
  const sheet = getSheetByName(analysis, "_students");
  if (!sheet || sheet.rows.length < 2) return [];
  const headers = sheet.rows[0].map((cell) => cellText(cell).toLowerCase());
  const indexOf = (header: string) => headers.indexOf(header);
  const studentIdIndex = indexOf("student_id");
  const nameIndex = indexOf("name");
  const nisnIndex = indexOf("nisn");

  return sheet.rows.slice(1)
    .map((row, index) => ({
      rowIndex: index + 2,
      studentId: cellText(row[studentIdIndex]),
      name: cellText(row[nameIndex]),
      nisn: cellText(row[nisnIndex]),
    }))
    .filter((item) => item.studentId);
}

function getRowsAndHeaders(analysis: ImportPlanInputAnalysis): {
  rows: WorkbookCell[][];
  rowByIndex: Map<number, WorkbookCell[]>;
  studentRows: ReturnType<typeof extractStudentRowsFromWorkbook>;
  headers: ColumnMatcherHeaderInput[];
  warnings: ImportWarning[];
} {
  if (hasOfficialShape(analysis)) {
    const inputRows = analysis.inputSheet?.rows || [];
    const originalRowIndexes = analysis.inputSheet?.addressedRows.map((row) => row.originalRowIndex) || [];
    const rowByIndex = new Map<number, WorkbookCell[]>(
      (analysis.inputSheet?.addressedRows || []).map((row) => [row.originalRowIndex, row.values]),
    );
    const officialMetadata = readOfficialStudentMetadata(analysis);
    const headers = analysis.headers.map((header) => ({
      columnIndex: header.columnIndex,
      originalColumnIndex: header.originalColumnIndex,
      rawHeader: header.rawHeader,
      parsedHeader: header.parsedHeader,
      metadata: header.mappedColumn,
    }));

    return {
      rows: inputRows,
      rowByIndex,
      studentRows: extractStudentRowsFromWorkbook(inputRows, { officialMetadata, originalRowIndexes }),
      headers,
      warnings: [],
    };
  }

  const region = analysis.bestRegion;
  if (!region) {
    return { rows: [], rowByIndex: new Map(), studentRows: [], headers: [], warnings: [warning("IMPORT_NO_FREE_EXCEL_REGION", "Tidak ada region nilai yang cukup jelas untuk dibuat ImportPlan.")] };
  }

  const rows = [
    region.columns.map((column) => column.rawHeader),
    ...region.dataRows,
  ];
  const originalRowIndexes = [
    region.headerRowIndex,
    ...region.addressedDataRows.map((row) => row.originalRowIndex),
  ];
  const rowByIndex = new Map<number, WorkbookCell[]>([
    [region.headerRowIndex, region.columns.map((column) => column.rawHeader)],
    ...region.addressedDataRows.map((row): [number, WorkbookCell[]] => [row.originalRowIndex, row.values]),
  ]);
  const headers = region.columns.map((column) => ({
    columnIndex: column.columnIndex,
    originalColumnIndex: column.originalColumnIndex,
    rawHeader: column.rawHeader,
    parsedHeader: column.parsedHeader,
  }));
  const studentRows = extractStudentRowsFromWorkbook(rows, {
    dataStartRowIndex: 2,
    originalRowIndexes,
    nameColumnIndex: region.nameColumnIndex,
    nisnColumnIndex: region.nisnColumnIndex,
  });

  return { rows, rowByIndex, studentRows, headers, warnings: [] };
}

function targetKey(target: GradeTarget | undefined): string {
  if (!target) return "";
  if (target.gradeType === "assignment") return `assignment:${target.assignmentId || target.chapterName || ""}:${target.assignmentName || ""}`;
  return `special:${target.gradeType}`;
}

function findExistingGrade(existingGrades: ImportPlanExistingGrade[], studentId: string, target: GradeTarget): ImportPlanExistingGrade | undefined {
  return existingGrades.find((grade) => {
    if (grade.student_id !== studentId || grade.grade_type !== target.gradeType) return false;
    if (target.gradeType !== "assignment") return true;
    return Boolean(target.assignmentId && grade.assignment_id === target.assignmentId);
  });
}

function hasImportableStudent(mapping: StudentMapping): boolean {
  return Boolean(mapping.studentId && ["safe", "warning"].includes(mapping.status));
}

function shouldSkipStudentRow(mapping: StudentMapping | undefined): boolean {
  return mapping?.status === "missing_in_web" || mapping?.status === "missing_in_excel";
}

function hasBlockingStudentProblem(mapping: StudentMapping | undefined): boolean {
  if (!mapping) return true;
  if (shouldSkipStudentRow(mapping)) return false;
  return !hasImportableStudent(mapping);
}

function hasImportableColumn(mapping: MatchedColumn): boolean {
  return Boolean(mapping.target && ["safe", "warning"].includes(mapping.status) && ["existing_assignment", "sts", "sas"].includes(mapping.targetType));
}

function decideOperationAction(
  value: number | null,
  existingValue: number | null | undefined,
  updateMode: UpdateMode,
  selected: boolean,
): GradeOperation["action"] {
  if (value === null) return "skip_empty";
  if (updateMode === "skip_existing" && existingValue !== null && existingValue !== undefined) return "skip_existing";
  if (updateMode === "fill_empty_only" && existingValue !== null && existingValue !== undefined) return "skip_existing";
  if (updateMode === "overwrite_selected_columns" && !selected && existingValue !== null && existingValue !== undefined) return "skip_existing";
  if (existingValue !== null && existingValue !== undefined) return "overwrite";
  return "fill_empty";
}

function collectDuplicateColumnTargetConflicts(columns: MatchedColumn[]): ImportConflict[] {
  const seen = new Map<string, MatchedColumn[]>();
  columns.filter(hasImportableColumn).forEach((column) => {
    const key = targetKey(column.target);
    seen.set(key, [...(seen.get(key) || []), column]);
  });

  return Array.from(seen.entries()).flatMap(([key, entries]) => {
    if (!key || entries.length < 2) return [];
    return entries.map((entry) => conflict(
      "IMPORT_DUPLICATE_COLUMN_TARGET",
      "Dua kolom Excel menuju target nilai yang sama. Pilih salah satu sebelum import.",
      "column",
      undefined,
      entry.columnIndex,
      entries.map((item) => item.rawHeader),
    ));
  });
}

function contextConflicts(analysis: ImportPlanInputAnalysis): ImportConflict[] {
  const warnings = analysis.warnings || [];
  return warnings
    .filter((item) => ["IMPORT_CONTEXT_MISMATCH", "IMPORT_SEMESTER_MISMATCH"].includes(item.code))
    .map((item) => conflict("IMPORT_CONTEXT_MISMATCH_BLOCKED", item.message, "context", item.rowIndex, item.columnIndex));
}

export function buildImportPlan(
  analysis: ImportPlanInputAnalysis,
  context: ImportPlanContext,
  options: ImportPlanBuilderOptions = {},
): ImportPlan {
  const updateMode = options.updateMode || "fill_empty_only";
  const strictMode = options.strictMode ?? true;
  const selectedColumns = new Set(options.selectedColumnIndexes || []);
  const extracted = getRowsAndHeaders(analysis);
  const studentResult = matchStudents(extracted.studentRows, context.students);
  const columnResult = matchColumns(extracted.headers, context.chapters, context.assignments);
  const warnings: ImportWarning[] = [
    ...(analysis.warnings || []),
    ...extracted.warnings,
    ...studentResult.warnings,
    ...columnResult.warnings,
  ];
  const conflicts: ImportConflict[] = [
    ...(analysis.conflicts || []),
    ...studentResult.conflicts,
    ...columnResult.conflicts,
    ...contextConflicts(analysis),
    ...collectDuplicateColumnTargetConflicts(columnResult.mappings),
  ];

  const studentByRow = new Map(studentResult.mappings.map((mapping) => [mapping.rowIndex, mapping]));
  const importableColumns = columnResult.mappings.filter((mapping) => mapping.targetType !== "ignore");
  const rowOffset = hasOfficialShape(analysis) ? 1 : 1;
  const gradeOperations: GradeOperation[] = [];

  extracted.studentRows.forEach((studentRow) => {
    const studentMapping = studentByRow.get(studentRow.rowIndex);
    const workbookRow = extracted.rowByIndex.get(studentRow.rowIndex)
      || extracted.rows[studentRow.rowIndex - rowOffset]
      || extracted.rows[studentRow.rowIndex - 1]
      || [];

    importableColumns.forEach((column) => {
      const rawValue = workbookRow[column.columnIndex - 1];
      const parsedValue = parseGradeValue(rawValue);
      const operationWarnings = [...parsedValue.warnings];
      const operationConflicts: ImportConflict[] = [...parsedValue.conflicts];

      const skipStudentRow = shouldSkipStudentRow(studentMapping);
      if (hasBlockingStudentProblem(studentMapping)) {
        if (parsedValue.value !== null || parsedValue.status === "needs_confirmation") {
          operationConflicts.push(conflict(
            "IMPORT_STUDENT_NOT_SAFE_FOR_VALUE",
            "Baris siswa belum cocok aman tetapi memiliki nilai yang akan diimport.",
            "student",
            studentRow.rowIndex,
            column.columnIndex,
          ));
        }
      }

      if (!hasImportableColumn(column)) {
        if (parsedValue.value !== null || parsedValue.status === "needs_confirmation") {
          operationConflicts.push(conflict(
            column.targetType === "create_assignment" || column.targetType === "create_chapter_and_assignment"
              ? "IMPORT_NEW_STRUCTURE_NOT_CONFIRMED"
              : "IMPORT_COLUMN_NOT_SAFE_FOR_VALUE",
            column.targetType === "create_assignment" || column.targetType === "create_chapter_and_assignment"
              ? "BAB/tugas baru belum dikonfirmasi, sehingga nilai pada kolom ini diblokir."
              : "Kolom belum dipetakan aman, sehingga nilai pada kolom ini diblokir.",
            column.targetType === "create_assignment" || column.targetType === "create_chapter_and_assignment" ? "structure" : "column",
            studentRow.rowIndex,
            column.columnIndex,
          ));
        }
      }

      if (strictMode && parsedValue.status === "invalid") {
        operationConflicts.push(conflict("IMPORT_INVALID_VALUE_STRICT", "Nilai invalid diblokir dalam strict mode.", "grade_value", studentRow.rowIndex, column.columnIndex));
      }

      const target = column.target || { gradeType: "assignment" as const };
      const existing = studentMapping?.studentId && column.target
        ? findExistingGrade(context.existingGrades || [], studentMapping.studentId, column.target)
        : undefined;
      const selected = selectedColumns.size === 0 || selectedColumns.has(column.columnIndex);
      const baseAction = decideOperationAction(parsedValue.value, existing?.value, updateMode, selected);
      const action: GradeOperation["action"] = skipStudentRow
        ? "skip_existing"
        : operationConflicts.length
        ? "blocked"
        : parsedValue.status === "needs_confirmation" || column.status === "needs_confirmation" || studentMapping?.status === "ambiguous"
          ? "needs_confirmation"
          : baseAction;

      gradeOperations.push({
        id: `${studentRow.rowIndex}:${column.columnIndex}:${targetKey(column.target) || column.rawHeader}`,
        rowIndex: studentRow.rowIndex,
        columnIndex: column.columnIndex,
        originalRowIndex: studentRow.originalRowIndex ?? studentRow.rowIndex,
        originalColumnIndex: column.originalColumnIndex ?? column.columnIndex,
        studentId: studentMapping?.studentId,
        target,
        value: parsedValue.value,
        suggestedValue: parsedValue.suggestedValue,
        existingValue: existing?.value,
        updateMode,
        action,
        warnings: operationWarnings,
        conflicts: operationConflicts,
      });
    });
  });

  conflicts.push(...gradeOperations.flatMap((operation) => operation.conflicts));
  warnings.push(...gradeOperations.flatMap((operation) => operation.warnings));

  const readyOperations = gradeOperations.filter((operation) => ["fill_empty", "overwrite"].includes(operation.action));
  const skippedOperations = gradeOperations.filter((operation) => ["skip_empty", "skip_existing"].includes(operation.action));
  const invalidValues = gradeOperations.filter((operation) =>
    operation.conflicts.some((item) => item.code === "IMPORT_INVALID_VALUE_STRICT" || item.type === "grade_value"),
  ).length;
  const newChapterSuggestions = columnResult.structureSuggestions.filter((item) => item.type === "create_chapter" || item.type === "create_chapter_and_assignment").length;
  const newAssignmentSuggestions = columnResult.structureSuggestions.filter((item) => item.type === "create_assignment" || item.type === "create_chapter_and_assignment").length;

  return {
    sourceType: sourceTypeOf(analysis),
    updateMode,
    studentMappings: studentResult.mappings,
    columnMappings: columnResult.mappings,
    structureSuggestions: columnResult.structureSuggestions,
    gradeOperations,
    warnings,
    conflicts,
    summary: {
      totalRows: extracted.studentRows.length,
      matchedStudents: studentResult.mappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
      mappedColumns: columnResult.mappings.filter(hasImportableColumn).length,
      safeOperations: readyOperations.length,
      blockedOperations: gradeOperations.filter((operation) => operation.action === "blocked").length,
      needsConfirmation: gradeOperations.filter((operation) => operation.action === "needs_confirmation").length,
      matchedStudentCount: studentResult.mappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
      ambiguousStudentCount: studentResult.mappings.filter((mapping) => mapping.status === "ambiguous").length,
      missingStudentCount: studentResult.mappings.filter((mapping) => mapping.status === "missing_in_web" || mapping.status === "missing_in_excel").length,
      gradeColumnCount: columnResult.mappings.filter((mapping) => mapping.targetType !== "ignore").length,
      conflictCount: conflicts.length,
      newAssignmentCount: newAssignmentSuggestions,
      newChapterCount: newChapterSuggestions,
      invalidValueCount: invalidValues,
      readyImportCount: readyOperations.length,
      skippedValueCount: skippedOperations.length,
    },
  };
}

import { parseGradeHeader } from "./headerParser";
import { hashImportMetadata } from "./metadataHash";
import { normalizeText } from "./textNormalizer";
import type { ImportConflict, ImportSourceType, ImportWarning, ParsedGradeHeader } from "./types";
import { readWorkbookFile, type WorkbookCell, type WorkbookReadResult, type WorkbookSheetData } from "./workbookReader";

export interface OfficialTemplateContext {
  classId?: string | null;
  subjectId?: string | null;
  semesterId?: string | null;
  academicYearId?: string | null;
}

export interface ManifestData {
  app?: string;
  template_version?: string;
  class_id?: string;
  class_name?: string;
  subject_id?: string;
  subject_name?: string;
  semester_id?: string;
  semester_name?: string;
  academic_year_id?: string;
  generated_at?: string;
  generated_by?: string;
  students_hash?: string;
  structure_hash?: string;
  columns_hash?: string;
  signature_status?: string;
  [key: string]: string | undefined;
}

export interface OfficialTemplateColumnMap {
  columnIndex: number;
  originalColumnIndex?: number;
  visibleHeader: string;
  gradeType: string;
  chapterId?: string;
  assignmentId?: string;
  targetKey?: string;
  locked?: boolean;
}

export interface OfficialTemplateStudentMetadata {
  studentId: string;
  nisn?: string;
  name?: string;
  normalizedName?: string;
  normalizedNisn?: string;
  rowNumber?: number;
}

export interface OfficialTemplateStructureMetadata {
  chapterId?: string;
  chapterName?: string;
  chapterOrder?: number | null;
  assignmentId?: string;
  assignmentName?: string;
  assignmentOrder?: number | null;
  gradeType?: string;
}

export interface AnalyzedTemplateHeader {
  columnIndex: number;
  originalColumnIndex?: number;
  rawHeader: string;
  parsedHeader: ParsedGradeHeader;
  mappedColumn?: OfficialTemplateColumnMap;
  status: "reserved" | "mapped" | "added" | "changed" | "unknown";
}

export interface OfficialTemplateAnalysis {
  sourceType: ImportSourceType;
  workbook: WorkbookReadResult;
  sheetPresence: {
    input: boolean;
    manifest: boolean;
    students: boolean;
    structure: boolean;
    columnMap: boolean;
    rules: boolean;
    examples: boolean;
    guide: boolean;
  };
  manifest: ManifestData | null;
  inputSheet: WorkbookSheetData | null;
  headerRow: WorkbookCell[];
  dataRows: WorkbookCell[][];
  headers: AnalyzedTemplateHeader[];
  studentsMetadata: OfficialTemplateStudentMetadata[];
  structureMetadata: OfficialTemplateStructureMetadata[];
  columnMap: OfficialTemplateColumnMap[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

const REQUIRED_METADATA_SHEETS = ["_manifest", "_students", "_structure", "_column_map"] as const;
const REQUIRED_V2_SHEETS = ["Panduan", "_rules", "_examples"] as const;

function warning(code: string, message: string, field?: string, columnIndex?: number): ImportWarning {
  return { code, severity: "warning", message, field, columnIndex };
}

function conflict(code: string, message: string, type: ImportConflict["type"]): ImportConflict {
  return { code, severity: "blocked", message, type };
}

function asText(value: WorkbookCell | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function getSheet(result: WorkbookReadResult, name: string): WorkbookSheetData | null {
  const normalizedName = normalizeText(name);
  return result.sheets.find((sheet) => normalizeText(sheet.name) === normalizedName) || null;
}

function readManifest(sheet: WorkbookSheetData | null): ManifestData | null {
  if (!sheet || sheet.isEmpty) return null;

  const manifest: ManifestData = {};
  sheet.rows.forEach((row, index) => {
    if (index === 0 && normalizeText(row[0]) === "key") return;
    const key = normalizeText(row[0]).replace(/\s+/g, "_");
    if (!key) return;
    manifest[key] = asText(row[1]);
  });

  return Object.keys(manifest).length > 0 ? manifest : null;
}

function readColumnMap(sheet: WorkbookSheetData | null): OfficialTemplateColumnMap[] {
  if (!sheet || sheet.rows.length < 2) return [];

  const headerRow = sheet.rows[0].map((cell) => normalizeText(cell).replace(/\s+/g, "_"));
  const indexOf = (header: string) => headerRow.indexOf(header);
  const columnIndexIndex = indexOf("column_index");
  const visibleHeaderIndex = indexOf("visible_header");
  const gradeTypeIndex = indexOf("grade_type");
  const chapterIdIndex = indexOf("chapter_id");
  const assignmentIdIndex = indexOf("assignment_id");
  const targetKeyIndex = indexOf("target_key");
  const lockedIndex = indexOf("locked");

  return sheet.rows.slice(1).map((row) => ({
    columnIndex: Number(row[columnIndexIndex]) || 0,
    originalColumnIndex: Number(row[columnIndexIndex]) || 0,
    visibleHeader: asText(row[visibleHeaderIndex]),
    gradeType: asText(row[gradeTypeIndex]),
    chapterId: asText(row[chapterIdIndex]),
    assignmentId: asText(row[assignmentIdIndex]),
    targetKey: asText(row[targetKeyIndex]),
    locked: lockedIndex >= 0 ? normalizeText(row[lockedIndex]) !== "false" : undefined,
  })).filter((entry) => entry.columnIndex > 0 && entry.visibleHeader);
}

function rowObjectReader(sheet: WorkbookSheetData | null): Array<Record<string, string>> {
  if (!sheet || sheet.rows.length < 2) return [];
  const headers = sheet.rows[0].map((cell) => normalizeText(cell).replace(/\s+/g, "_"));
  return sheet.rows.slice(1).map((row) => {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (!header) return;
      record[header] = asText(row[index]);
    });
    return record;
  });
}

function numberOrNull(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readStudentsMetadata(sheet: WorkbookSheetData | null): OfficialTemplateStudentMetadata[] {
  return rowObjectReader(sheet)
    .map((row) => ({
      studentId: row.student_id || "",
      nisn: row.nisn || "",
      name: row.name || "",
      normalizedName: row.normalized_name || "",
      normalizedNisn: row.normalized_nisn || "",
      rowNumber: numberOrNull(row.row_number) || undefined,
    }))
    .filter((row) => row.studentId);
}

function readStructureMetadata(sheet: WorkbookSheetData | null): OfficialTemplateStructureMetadata[] {
  return rowObjectReader(sheet)
    .map((row) => ({
      chapterId: row.chapter_id || "",
      chapterName: row.chapter_name || "",
      chapterOrder: numberOrNull(row.chapter_order || row.order),
      assignmentId: row.assignment_id || "",
      assignmentName: row.assignment_name || "",
      assignmentOrder: numberOrNull(row.assignment_order || row.order),
      gradeType: row.grade_type || "assignment",
    }))
    .filter((row) => row.chapterId || row.assignmentId || row.chapterName || row.assignmentName);
}

function metadataStudentsPayload(rows: OfficialTemplateStudentMetadata[]) {
  return rows.map((student) => ({
    id: student.studentId,
    name: student.name || "",
    nisn: student.nisn || "",
  }));
}

function metadataStructurePayload(rows: OfficialTemplateStructureMetadata[]) {
  const chapters = new Map<string, {
    id: string;
    name: string;
    order_index: number | null;
    assignments: Array<{ id: string; name: string; order_index: number | null }>;
  }>();

  rows.forEach((row) => {
    const key = row.chapterId || row.chapterName || "";
    if (!key) return;
    const chapter = chapters.get(key) || {
      id: row.chapterId || "",
      name: row.chapterName || "",
      order_index: row.chapterOrder ?? null,
      assignments: [],
    };
    if (row.assignmentId) {
      chapter.assignments.push({
        id: row.assignmentId,
        name: row.assignmentName || "",
        order_index: row.assignmentOrder ?? null,
      });
    }
    chapters.set(key, chapter);
  });

  return Array.from(chapters.values()).map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    assignments: chapter.assignments.map((assignment) => ({
      id: assignment.id,
      name: assignment.name,
      order_index: assignment.order_index,
    })),
    order_index: chapter.order_index,
  }));
}

function metadataColumnsPayload(columns: OfficialTemplateColumnMap[]) {
  return columns.map((column) => ({
    column_index: column.columnIndex,
    visible_header: column.visibleHeader,
    grade_type: column.gradeType,
    target_key: column.targetKey || "",
  }));
}

function isSIPENALikeInputSheet(sheet: WorkbookSheetData | null): boolean {
  if (!sheet || sheet.rows.length === 0) return false;
  const headers = sheet.rows[0].map((cell) => normalizeText(cell));
  return headers[0] === "no"
    && headers[1] === "nisn"
    && (headers[2] === "nama siswa" || headers[2] === "nama peserta didik" || headers[2] === "nama");
}

function contextValueMismatch(manifestValue: string | undefined, contextValue: string | null | undefined): boolean {
  return Boolean(contextValue && manifestValue && manifestValue !== contextValue);
}

function compareManifestContext(manifest: ManifestData | null, context: OfficialTemplateContext | undefined): ImportWarning[] {
  if (!manifest || !context) return [];
  const warnings: ImportWarning[] = [];

  if (contextValueMismatch(manifest.class_id, context.classId)) {
    warnings.push(warning("IMPORT_CONTEXT_MISMATCH", "File ini dibuat untuk kelas lain.", "class_id"));
  }
  if (contextValueMismatch(manifest.subject_id, context.subjectId)) {
    warnings.push(warning("IMPORT_CONTEXT_MISMATCH", "File ini dibuat untuk mata pelajaran lain.", "subject_id"));
  }
  if (contextValueMismatch(manifest.semester_id, context.semesterId)) {
    warnings.push(warning("IMPORT_SEMESTER_MISMATCH", "File ini dibuat untuk semester lain.", "semester_id"));
  }
  if (contextValueMismatch(manifest.academic_year_id, context.academicYearId)) {
    warnings.push(warning("IMPORT_CONTEXT_MISMATCH", "File ini dibuat untuk tahun ajaran lain.", "academic_year_id"));
  }

  return warnings;
}

function analyzeHeaders(inputSheet: WorkbookSheetData | null, columnMap: OfficialTemplateColumnMap[]) {
  const headerRow = inputSheet?.rows[0] || [];
  const addressedHeaderRow = inputSheet?.addressedRows[0];
  const knownColumns = new Map<number, OfficialTemplateColumnMap>();
  columnMap.forEach((column) => knownColumns.set(column.columnIndex, column));

  const headers = headerRow.map((cell, zeroBasedIndex) => {
    const columnIndex = zeroBasedIndex + 1;
    const originalColumnIndex = addressedHeaderRow?.cells[zeroBasedIndex]?.originalColumnIndex ?? columnIndex;
    const rawHeader = asText(cell);
    const parsedHeader = parseGradeHeader(rawHeader);
    const mappedColumn = knownColumns.get(columnIndex);
    let status: AnalyzedTemplateHeader["status"] = parsedHeader.reserved ? "reserved" : "unknown";

    if (mappedColumn) {
      status = normalizeText(mappedColumn.visibleHeader) === normalizeText(rawHeader) ? "mapped" : "changed";
    } else if (columnIndex > 3 && ["assignment", "sts", "sas"].includes(parsedHeader.headerType)) {
      status = "added";
    }

    return {
      columnIndex,
      originalColumnIndex,
      rawHeader,
      parsedHeader,
      mappedColumn,
      status,
    };
  });

  return { headerRow, headers };
}

export function analyzeOfficialTemplateWorkbook(
  workbook: WorkbookReadResult,
  context?: OfficialTemplateContext,
): OfficialTemplateAnalysis {
  const warnings: ImportWarning[] = workbook.warnings.map((item) =>
    warning(item.code, item.message, item.details),
  );
  const conflicts: ImportConflict[] = [];

  if (!workbook.ok && "error" in workbook) {
    conflicts.push(conflict(workbook.error.code, workbook.error.message, "unsupported"));
  }

  const inputSheet = getSheet(workbook, "Isi_Nilai");
  const manifestSheet = getSheet(workbook, "_manifest");
  const studentsSheet = getSheet(workbook, "_students");
  const structureSheet = getSheet(workbook, "_structure");
  const columnMapSheet = getSheet(workbook, "_column_map");
  const rulesSheet = getSheet(workbook, "_rules");
  const examplesSheet = getSheet(workbook, "_examples");
  const guideSheet = getSheet(workbook, "Panduan");
  const manifest = readManifest(manifestSheet);
  const studentsMetadata = readStudentsMetadata(studentsSheet);
  const structureMetadata = readStructureMetadata(structureSheet);
  const columnMap = readColumnMap(columnMapSheet);
  const { headerRow, headers } = analyzeHeaders(inputSheet, columnMap);
  const hasSIPENAInputShape = isSIPENALikeInputSheet(inputSheet);

  const sheetPresence = {
    input: Boolean(inputSheet),
    manifest: Boolean(manifestSheet),
    students: Boolean(studentsSheet),
    structure: Boolean(structureSheet),
    columnMap: Boolean(columnMapSheet),
    rules: Boolean(rulesSheet),
    examples: Boolean(examplesSheet),
    guide: Boolean(guideSheet),
  };

  if (!manifestSheet || !manifest) {
    warnings.push(warning("IMPORT_MANIFEST_MISSING", "Manifest template tidak ditemukan atau kosong.", "_manifest"));
  }

  if (manifest && normalizeText(manifest.app || "") !== "sipena") {
    warnings.push(warning("IMPORT_MANIFEST_APP_INVALID", "Manifest tidak berasal dari Template Resmi SIPENA.", "app"));
  }

  REQUIRED_METADATA_SHEETS.forEach((sheetName) => {
    if (!getSheet(workbook, sheetName)) {
      warnings.push(warning("IMPORT_METADATA_SHEET_MISSING", `Sheet metadata ${sheetName} tidak ditemukan.`, sheetName));
    }
  });

  REQUIRED_V2_SHEETS.forEach((sheetName) => {
    if (!getSheet(workbook, sheetName)) {
      warnings.push(warning("IMPORT_TEMPLATE_V2_SHEET_MISSING", `Sheet ${sheetName} tidak ditemukan. File masih bisa dicek, tetapi bukan Template Resmi SIPENA v2 lengkap.`, sheetName));
    }
  });

  if (manifest?.signature_status === "unsigned_client_template") {
    warnings.push(warning(
      "IMPORT_UNSIGNED_TEMPLATE",
      "Template dibuat dari browser. SIPENA akan tetap memvalidasi terhadap data web.",
      "signature_status",
    ));
  }

  warnings.push(...compareManifestContext(manifest, context));

  headers.forEach((header) => {
    if (header.status === "changed") {
      warnings.push(warning(
        "IMPORT_HEADER_CHANGED",
        `Header ${header.mappedColumn?.visibleHeader || ""} berubah menjadi ${header.rawHeader}.`,
        "header",
        header.columnIndex,
      ));
    }
    if (header.status === "added") {
      warnings.push(warning(
        "IMPORT_ADDED_HEADER_DETECTED",
        `Header tambahan ${header.rawHeader} terdeteksi sebagai kandidat nilai.`,
        "header",
        header.columnIndex,
      ));
    }
  });

  if (manifest?.students_hash && studentsMetadata.length > 0) {
    const actualHash = hashImportMetadata(metadataStudentsPayload(studentsMetadata));
    if (actualHash !== manifest.students_hash) {
      warnings.push(warning("IMPORT_STUDENTS_HASH_MISMATCH", "Metadata siswa pada template berubah. Jalur template resmi tidak dipercaya penuh.", "students_hash"));
    }
  }

  if (manifest?.structure_hash && structureMetadata.length > 0) {
    const actualHash = hashImportMetadata(metadataStructurePayload(structureMetadata));
    if (actualHash !== manifest.structure_hash) {
      warnings.push(warning("IMPORT_STRUCTURE_HASH_MISMATCH", "Metadata BAB/tugas pada template berubah. Jalur template resmi tidak dipercaya penuh.", "structure_hash"));
    }
  }

  if (manifest?.columns_hash && columnMap.length > 0) {
    const actualHash = hashImportMetadata(metadataColumnsPayload(columnMap));
    if (actualHash !== manifest.columns_hash) {
      warnings.push(warning("IMPORT_COLUMNS_HASH_MISMATCH", "Metadata kolom pada template berubah. Jalur template resmi tidak dipercaya penuh.", "columns_hash"));
    }
  }

  let sourceType: ImportSourceType = "unsupported";
  const hasAllMetadata = Boolean(manifest && studentsSheet && structureSheet && columnMapSheet && inputSheet);
  const metadataDamaged = Boolean(manifestSheet) && (!manifest || !studentsSheet || !structureSheet || !columnMapSheet || !inputSheet);
  const hasChangedHeaders = headers.some((header) => header.status === "changed" || header.status === "added");
  const hasContextMismatch = warnings.some((item) =>
    ["IMPORT_CONTEXT_MISMATCH", "IMPORT_SEMESTER_MISMATCH"].includes(item.code),
  );
  const hasMetadataIntegrityProblem = warnings.some((item) =>
    [
      "IMPORT_MANIFEST_APP_INVALID",
      "IMPORT_STUDENTS_HASH_MISMATCH",
      "IMPORT_STRUCTURE_HASH_MISMATCH",
      "IMPORT_COLUMNS_HASH_MISMATCH",
    ].includes(item.code),
  );
  const hasMissingV2Sheet = warnings.some((item) => item.code === "IMPORT_TEMPLATE_V2_SHEET_MISSING");

  if (metadataDamaged || hasMetadataIntegrityProblem) {
    sourceType = "official_damaged";
  } else if (hasAllMetadata) {
    sourceType = hasChangedHeaders || hasContextMismatch || hasMissingV2Sheet ? "official_modified" : "official_exact";
  } else if (!manifest && hasSIPENAInputShape) {
    sourceType = "free_structured";
  }

  if (sourceType === "unsupported") {
    conflicts.push(conflict(
      "IMPORT_NO_SUPPORTED_TEMPLATE_STRUCTURE",
      "Workbook tidak dikenali sebagai Template Resmi SIPENA atau file terstruktur yang bisa dianalisis.",
      "unsupported",
    ));
  }

  return {
    sourceType,
    workbook,
    sheetPresence,
    manifest,
    inputSheet,
    headerRow,
    dataRows: inputSheet?.rows.slice(1) || [],
    headers,
    studentsMetadata,
    structureMetadata,
    columnMap,
    warnings,
    conflicts,
  };
}

export async function analyzeOfficialTemplateFile(file: File, context?: OfficialTemplateContext): Promise<OfficialTemplateAnalysis> {
  const workbook = await readWorkbookFile(file);
  return analyzeOfficialTemplateWorkbook(workbook, context);
}

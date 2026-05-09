import { parseGradeHeader } from "./headerParser";
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
  };
  manifest: ManifestData | null;
  inputSheet: WorkbookSheetData | null;
  headerRow: WorkbookCell[];
  dataRows: WorkbookCell[][];
  headers: AnalyzedTemplateHeader[];
  columnMap: OfficialTemplateColumnMap[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

const REQUIRED_METADATA_SHEETS = ["_manifest", "_students", "_structure", "_column_map"] as const;

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

  return sheet.rows.slice(1).map((row) => ({
    columnIndex: Number(row[columnIndexIndex]) || 0,
    originalColumnIndex: Number(row[columnIndexIndex]) || 0,
    visibleHeader: asText(row[visibleHeaderIndex]),
    gradeType: asText(row[gradeTypeIndex]),
    chapterId: asText(row[chapterIdIndex]),
    assignmentId: asText(row[assignmentIdIndex]),
    targetKey: asText(row[targetKeyIndex]),
  })).filter((entry) => entry.columnIndex > 0 && entry.visibleHeader);
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
  const manifest = readManifest(manifestSheet);
  const columnMap = readColumnMap(columnMapSheet);
  const { headerRow, headers } = analyzeHeaders(inputSheet, columnMap);
  const hasSIPENAInputShape = isSIPENALikeInputSheet(inputSheet);

  const sheetPresence = {
    input: Boolean(inputSheet),
    manifest: Boolean(manifestSheet),
    students: Boolean(studentsSheet),
    structure: Boolean(structureSheet),
    columnMap: Boolean(columnMapSheet),
  };

  if (!manifestSheet || !manifest) {
    warnings.push(warning("IMPORT_MANIFEST_MISSING", "Manifest template tidak ditemukan atau kosong.", "_manifest"));
  }

  REQUIRED_METADATA_SHEETS.forEach((sheetName) => {
    if (!getSheet(workbook, sheetName)) {
      warnings.push(warning("IMPORT_METADATA_SHEET_MISSING", `Sheet metadata ${sheetName} tidak ditemukan.`, sheetName));
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

  let sourceType: ImportSourceType = "unsupported";
  const hasAllMetadata = Boolean(manifest && studentsSheet && structureSheet && columnMapSheet && inputSheet);
  const metadataDamaged = Boolean(manifestSheet) && (!manifest || !studentsSheet || !structureSheet || !columnMapSheet || !inputSheet);
  const hasChangedHeaders = headers.some((header) => header.status === "changed" || header.status === "added");
  const hasContextMismatch = warnings.some((item) =>
    ["IMPORT_CONTEXT_MISMATCH", "IMPORT_SEMESTER_MISMATCH"].includes(item.code),
  );

  if (metadataDamaged) {
    sourceType = "official_damaged";
  } else if (hasAllMetadata) {
    sourceType = hasChangedHeaders || hasContextMismatch ? "official_modified" : "official_exact";
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
    columnMap,
    warnings,
    conflicts,
  };
}

export async function analyzeOfficialTemplateFile(file: File, context?: OfficialTemplateContext): Promise<OfficialTemplateAnalysis> {
  const workbook = await readWorkbookFile(file);
  return analyzeOfficialTemplateWorkbook(workbook, context);
}

import { parseGradeHeader } from "./headerParser";
import { normalizeName, normalizeNisn, normalizeText, normalizeWhitespace } from "./textNormalizer";
import type { ImportConflict, ImportSourceType, ImportWarning, ParsedGradeHeader } from "./types";
import type { WorkbookCell, WorkbookReadResult, WorkbookSheetData } from "./workbookReader";

export type FreeExcelColumnRole = "row_number" | "name" | "nisn" | "grade" | "ignored" | "unknown";

export interface FreeExcelColumnAnalysis {
  columnIndex: number;
  rawHeader: string;
  normalizedHeader: string;
  parsedHeader: ParsedGradeHeader;
  role: FreeExcelColumnRole;
  sourceRowIndexes: number[];
}

export interface FreeExcelRegionAnalysis {
  sheetName: string;
  score: number;
  baseScore: number;
  matchedStudentCount: number;
  identityMatchScore: number;
  headerRowIndex: number;
  headerRowCount: number;
  dataStartRowIndex: number;
  dataEndRowIndex: number;
  nameColumnIndex?: number;
  nisnColumnIndex?: number;
  columns: FreeExcelColumnAnalysis[];
  gradeColumns: FreeExcelColumnAnalysis[];
  dataRows: WorkbookCell[][];
  warnings: ImportWarning[];
}

export interface FreeExcelAnalysis {
  sourceType: ImportSourceType;
  workbook: WorkbookReadResult;
  bestRegion: FreeExcelRegionAnalysis | null;
  regions: FreeExcelRegionAnalysis[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
}

export interface FreeExcelAnalyzerStudentContext {
  id?: string | null;
  name?: string | null;
  nisn?: string | null;
}

export interface FreeExcelAnalyzerContext {
  students?: FreeExcelAnalyzerStudentContext[];
  preferredSheetName?: string | null;
}

const FOOTER_PATTERNS = [
  "rata rata",
  "jumlah",
  "nilai tertinggi",
  "nilai terendah",
  "mengetahui",
  "guru mapel",
  "kepala sekolah",
  "tanggal",
];

const NAME_HEADER_ALIASES = new Set([
  "nama",
  "nama siswa",
  "nama peserta didik",
  "peserta didik",
  "siswa",
  "nama murid",
  "murid",
]);

const NISN_HEADER_ALIASES = new Set([
  "nisn",
  "nis",
  "nisn nis",
  "nis nisn",
  "nisn atau nis",
  "nis atau nisn",
  "nomor induk",
  "nomor induk siswa",
  "nomor induk siswa nasional",
]);

const HEADER_GROUP_LABELS = new Set([
  "data siswa",
  "identitas",
  "ujian",
  "rekap",
  "nilai",
  "nilai siswa",
]);

function warning(code: string, message: string, field?: string, rowIndex?: number, columnIndex?: number): ImportWarning {
  return { code, severity: "warning", message, field, rowIndex, columnIndex };
}

function conflict(code: string, message: string, type: ImportConflict["type"]): ImportConflict {
  return { code, severity: "blocked", message, type };
}

function cellText(value: WorkbookCell | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function rowText(row: WorkbookCell[] | undefined): string {
  return (row || []).map(cellText).filter(Boolean).join(" ");
}

function isFooterRow(row: WorkbookCell[]): boolean {
  const normalized = normalizeText(rowText(row));
  return FOOTER_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function isEmptyRow(row: WorkbookCell[]): boolean {
  return row.every((cell) => cell === null || cellText(cell) === "");
}

function isNumericGradeLike(value: WorkbookCell | undefined): boolean {
  if (typeof value === "number") return value >= 0 && value <= 100;
  const text = cellText(value).replace(",", ".");
  if (!text) return false;
  const parsed = Number(text);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100;
}

function isNameHeader(normalized: string): boolean {
  return NAME_HEADER_ALIASES.has(normalized);
}

function isNisnHeader(normalized: string): boolean {
  return NISN_HEADER_ALIASES.has(normalized);
}

function isIdentityHeader(normalized: string): boolean {
  return ["no", "nomor"].includes(normalized) || isNameHeader(normalized) || isNisnHeader(normalized);
}

function detectColumnRole(header: string, parsed: ParsedGradeHeader, values: WorkbookCell[]): FreeExcelColumnRole {
  const normalized = normalizeText(header);
  if (["no", "nomor"].includes(normalized)) return "row_number";
  if (isNameHeader(normalized)) return "name";
  if (isNisnHeader(normalized)) return "nisn";
  if (parsed.reserved || parsed.derived) return "ignored";
  if (["assignment", "sts", "sas"].includes(parsed.headerType)) return "grade";

  const meaningfulValues = values.filter((value) => cellText(value));
  if (meaningfulValues.length > 0) {
    const numericCount = meaningfulValues.filter(isNumericGradeLike).length;
    if (numericCount >= Math.max(2, Math.ceil(meaningfulValues.length * 0.55))) return "grade";
  }

  return "unknown";
}

function expandHeaderRow(row: WorkbookCell[] | undefined, maxLength: number): string[] {
  const expanded: string[] = [];
  let active = "";
  for (let index = 0; index < maxLength; index += 1) {
    const current = normalizeWhitespace(cellText(row?.[index]));
    if (current) active = current;
    expanded[index] = current || active;
  }
  return expanded;
}

function combineHeaders(topHeaders: string[] | undefined, bottomRow: WorkbookCell[], columnIndex: number): string {
  const top = normalizeWhitespace(topHeaders?.[columnIndex] || "");
  const bottom = normalizeWhitespace(cellText(bottomRow[columnIndex]));
  if (!top) return bottom;
  if (!bottom) return top;
  const normalizedTop = normalizeText(top);
  const normalizedBottom = normalizeText(bottom);
  if (normalizedTop === normalizedBottom) return bottom;
  if (isIdentityHeader(normalizedBottom)) return bottom;

  const parsedBottom = parseGradeHeader(bottom);
  if (parsedBottom.reserved || parsedBottom.derived) return bottom;
  if (["sts", "sas"].includes(parsedBottom.headerType)) return bottom;
  if (HEADER_GROUP_LABELS.has(normalizedTop)) return bottom;

  return `${top} - ${bottom}`;
}

function createStudentLookup(students: FreeExcelAnalyzerStudentContext[] = []) {
  const normalizedNames = new Set<string>();
  const normalizedNisns = new Set<string>();

  students.forEach((student) => {
    const name = normalizeName(student.name).normalized;
    const nisn = normalizeNisn(student.nisn).normalized;
    if (name) normalizedNames.add(name);
    if (nisn) normalizedNisns.add(nisn);
  });

  return { normalizedNames, normalizedNisns };
}

function countMatchedStudents(region: FreeExcelRegionAnalysis, context: FreeExcelAnalyzerContext): number {
  if (!context.students?.length) return 0;

  const lookup = createStudentLookup(context.students);
  if (lookup.normalizedNames.size === 0 && lookup.normalizedNisns.size === 0) return 0;

  const matchedKeys = new Set<string>();
  region.dataRows.forEach((row) => {
    const nameValue = region.nameColumnIndex ? row[region.nameColumnIndex - 1] : undefined;
    const nisnValue = region.nisnColumnIndex ? row[region.nisnColumnIndex - 1] : undefined;
    const normalizedName = normalizeName(nameValue).normalized;
    const normalizedNisn = normalizeNisn(nisnValue).normalized;

    if (normalizedNisn && lookup.normalizedNisns.has(normalizedNisn)) {
      matchedKeys.add(`nisn:${normalizedNisn}`);
      return;
    }
    if (normalizedName && lookup.normalizedNames.has(normalizedName)) {
      matchedKeys.add(`name:${normalizedName}`);
    }
  });

  return matchedKeys.size;
}

function applyContextScore(region: FreeExcelRegionAnalysis, context: FreeExcelAnalyzerContext): FreeExcelRegionAnalysis {
  const matchedStudentCount = countMatchedStudents(region, context);
  const identityMatchScore = matchedStudentCount * 15;
  const sheetPreferenceScore = context.preferredSheetName
    && normalizeText(context.preferredSheetName) === normalizeText(region.sheetName)
    ? 80
    : 0;

  return {
    ...region,
    matchedStudentCount,
    identityMatchScore,
    score: region.baseScore + identityMatchScore + sheetPreferenceScore,
  };
}

function getDataEndRowIndex(rows: WorkbookCell[][], dataStartRowIndex: number): number {
  let lastDataRow = dataStartRowIndex - 1;
  for (let index = dataStartRowIndex - 1; index < rows.length; index += 1) {
    const row = rows[index] || [];
    if (isFooterRow(row)) break;
    if (!isEmptyRow(row)) lastDataRow = index + 1;
  }
  return lastDataRow;
}

function analyzeCandidate(
  sheet: WorkbookSheetData,
  headerRowIndex: number,
  headerRowCount: 1 | 2,
): FreeExcelRegionAnalysis | null {
  const headerRow = sheet.rows[headerRowIndex - 1] || [];
  const topHeaderRow = headerRowCount === 2 ? sheet.rows[headerRowIndex - 2] : undefined;
  const dataStartRowIndex = headerRowIndex + 1;
  const dataEndRowIndex = getDataEndRowIndex(sheet.rows, dataStartRowIndex);
  const dataRows = dataEndRowIndex >= dataStartRowIndex
    ? sheet.rows.slice(dataStartRowIndex - 1, dataEndRowIndex)
    : [];

  const columnCount = Math.max(headerRow.length, topHeaderRow?.length || 0, ...dataRows.map((row) => row.length));
  const expandedTopHeaders = headerRowCount === 2 ? expandHeaderRow(topHeaderRow, columnCount) : undefined;
  const columns: FreeExcelColumnAnalysis[] = [];
  for (let index = 0; index < columnCount; index += 1) {
    const rawHeader = headerRowCount === 2
      ? combineHeaders(expandedTopHeaders, headerRow, index)
      : normalizeWhitespace(cellText(headerRow[index]));
    const parsedHeader = parseGradeHeader(rawHeader);
    const values = dataRows.map((row) => row[index]);
    const role = detectColumnRole(rawHeader, parsedHeader, values);
    columns.push({
      columnIndex: index + 1,
      rawHeader,
      normalizedHeader: normalizeText(rawHeader),
      parsedHeader,
      role,
      sourceRowIndexes: headerRowCount === 2 ? [headerRowIndex - 1, headerRowIndex] : [headerRowIndex],
    });
  }

  const nameColumn = columns.find((column) => column.role === "name");
  const nisnColumn = columns.find((column) => column.role === "nisn");
  const gradeColumns = columns.filter((column) => column.role === "grade");
  const usableDataRows = dataRows.filter((row) => !isFooterRow(row) && !isEmptyRow(row));
  const identityScore = (nameColumn ? 35 : 0) + (nisnColumn ? 25 : 0);
  const baseScore = identityScore + gradeColumns.length * 12 + Math.min(usableDataRows.length, 30);

  if (baseScore < 45 || gradeColumns.length === 0 || (!nameColumn && !nisnColumn)) return null;

  const warnings: ImportWarning[] = [];
  if (headerRowCount === 2) {
    warnings.push(warning(
      "FREE_EXCEL_MULTI_ROW_HEADER_DETECTED",
      "Header multi-baris sederhana terdeteksi. Jika workbook memakai merged cells kompleks, hasil mapping perlu ditinjau.",
      "header",
      headerRowIndex,
    ));
  }
  if (headerRow.some((cell, index) => !cellText(cell) && cellText(topHeaderRow?.[index]))) {
    warnings.push(warning(
      "FREE_EXCEL_MERGED_CELLS_TODO",
      "TODO: dukungan merged cells kompleks belum sempurna. Analyzer memakai header terdekat tanpa crash.",
      "header",
      headerRowIndex,
    ));
  }

  return {
    sheetName: sheet.name,
    score: baseScore,
    baseScore,
    matchedStudentCount: 0,
    identityMatchScore: 0,
    headerRowIndex,
    headerRowCount,
    dataStartRowIndex,
    dataEndRowIndex,
    nameColumnIndex: nameColumn?.columnIndex,
    nisnColumnIndex: nisnColumn?.columnIndex,
    columns,
    gradeColumns,
    dataRows: usableDataRows,
    warnings,
  };
}

function analyzeSheet(sheet: WorkbookSheetData): FreeExcelRegionAnalysis[] {
  if (sheet.isEmpty) return [];
  const regions: FreeExcelRegionAnalysis[] = [];
  const maxHeaderRow = Math.min(sheet.rows.length, 20);

  for (let rowIndex = 1; rowIndex <= maxHeaderRow; rowIndex += 1) {
    const single = analyzeCandidate(sheet, rowIndex, 1);
    if (single) regions.push(single);

    if (rowIndex > 1) {
      const multi = analyzeCandidate(sheet, rowIndex, 2);
      if (multi) regions.push(multi);
    }
  }

  return regions
    .sort((left, right) => right.score - left.score)
    .filter((region, index, all) => index === 0 || Math.abs(region.headerRowIndex - all[0].headerRowIndex) > 2);
}

export function analyzeFreeExcelWorkbook(
  workbook: WorkbookReadResult,
  context: FreeExcelAnalyzerContext = {},
): FreeExcelAnalysis {
  const warnings: ImportWarning[] = workbook.warnings.map((item) => warning(item.code, item.message, item.details));
  const conflicts: ImportConflict[] = [];
  if (!workbook.ok && "error" in workbook) {
    conflicts.push(conflict(workbook.error.code, workbook.error.message, "unsupported"));
  }

  const regions = workbook.sheets
    .flatMap(analyzeSheet)
    .map((region) => applyContextScore(region, context))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.matchedStudentCount !== left.matchedStudentCount) {
        return right.matchedStudentCount - left.matchedStudentCount;
      }
      return right.dataRows.length - left.dataRows.length;
    });
  const bestRegion = regions[0] || null;
  if (regions.length > 1) {
    warnings.push(warning(
      "FREE_EXCEL_MULTI_REGION_DETECTED",
      "Lebih dari satu region nilai valid terdeteksi. Region dengan skor tertinggi dipilih sebagai default.",
      "sheet",
    ));
  }

  warnings.push(...regions.flatMap((region) => region.warnings));

  return {
    sourceType: bestRegion ? "free_structured" : "free_unstructured",
    workbook,
    bestRegion,
    regions,
    warnings,
    conflicts,
  };
}

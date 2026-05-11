import { normalizeName, normalizeNisn } from "./textNormalizer";
import type { ImportConflict, ImportWarning, MappingStatus, MissingInExcelStudent, StudentMapping } from "./types";
import type { WorkbookCell } from "./workbookReader";

export interface ImportWebStudent {
  id: string;
  name: string;
  nisn?: string | null;
}

export interface ImportExcelStudentRow {
  rowIndex: number;
  originalRowIndex?: number;
  name?: string | null;
  nisn?: string | null;
  studentId?: string | null;
}

export interface OfficialStudentRowMetadata {
  rowIndex?: number;
  studentId: string;
  name?: string | null;
  nisn?: string | null;
}

export interface StudentMatcherOptions {
  nameColumnIndex?: number;
  nisnColumnIndex?: number;
  studentIdColumnIndex?: number;
  dataStartRowIndex?: number;
  originalRowIndexes?: number[];
  officialMetadata?: OfficialStudentRowMetadata[];
}

export interface StudentMatcherResult {
  mappings: StudentMapping[];
  missingInExcelStudents: MissingInExcelStudent[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  summary: {
    excelRows: number;
    webStudents: number;
    safe: number;
    warning: number;
    ambiguous: number;
    missingInWeb: number;
    missingInExcel: number;
    blocked: number;
  };
}

interface StudentIndexRecord {
  student: ImportWebStudent;
  normalizedName: string;
  normalizedNisn: string;
}

function warning(code: string, message: string, rowIndex?: number, field?: string): ImportWarning {
  return { code, severity: "warning", message, rowIndex, field };
}

function conflict(code: string, message: string, rowIndex?: number, options?: string[]): ImportConflict {
  return { code, severity: "blocked", message, type: "student", rowIndex, options };
}

function cellText(value: WorkbookCell | undefined): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function groupBy<T>(items: T[], keySelector: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  items.forEach((item) => {
    const key = keySelector(item);
    if (!key) return;
    grouped.set(key, [...(grouped.get(key) || []), item]);
  });
  return grouped;
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return Math.round(82 + ratio * 14);
  }
  const distance = levenshtein(left, right);
  const maxLength = Math.max(left.length, right.length);
  return Math.round((1 - distance / maxLength) * 100);
}

function compactLength(value: string): number {
  return value.replace(/\s+/g, "").length;
}

function isShortName(value: string): boolean {
  return compactLength(value) > 0 && compactLength(value) < 6;
}

function studentNames(records: StudentIndexRecord[]): string[] {
  return records.map((item) => item.student.name);
}

export function extractStudentRowsFromWorkbook(
  rows: WorkbookCell[][],
  options: StudentMatcherOptions = {},
): ImportExcelStudentRow[] {
  const {
    nameColumnIndex = 3,
    nisnColumnIndex = 2,
    studentIdColumnIndex,
    dataStartRowIndex = 2,
    officialMetadata = [],
  } = options;
  const metadataByRow = new Map<number, OfficialStudentRowMetadata>();
  const metadataByOrder = new Map<number, OfficialStudentRowMetadata>();
  officialMetadata.forEach((item, index) => {
    if (item.rowIndex) metadataByRow.set(item.rowIndex, item);
    metadataByOrder.set(index, item);
  });

  const startIndex = Math.max(0, dataStartRowIndex - 1);
  return rows.slice(startIndex).map((row, offset) => {
    const rowIndex = options.originalRowIndexes?.[startIndex + offset] ?? dataStartRowIndex + offset;
    const metadata = metadataByRow.get(rowIndex) || metadataByOrder.get(offset);
    return {
      rowIndex,
      originalRowIndex: rowIndex,
      name: cellText(row[nameColumnIndex - 1]) || metadata?.name || "",
      nisn: cellText(row[nisnColumnIndex - 1]) || metadata?.nisn || "",
      studentId: studentIdColumnIndex ? cellText(row[studentIdColumnIndex - 1]) || metadata?.studentId : metadata?.studentId,
    };
  }).filter((row) => row.name || row.nisn || row.studentId);
}

function createMapping(
  row: ImportExcelStudentRow,
  student: ImportWebStudent | undefined,
  status: MappingStatus,
  matchedBy: StudentMapping["matchedBy"] | undefined,
  confidence: number,
  warnings: ImportWarning[] = [],
  conflicts: ImportConflict[] = [],
): StudentMapping {
  return {
    rowIndex: row.rowIndex,
    originalRowIndex: row.originalRowIndex ?? row.rowIndex,
    excelName: row.name || undefined,
    excelNisn: row.nisn || undefined,
    studentId: student?.id,
    webName: student?.name,
    webNisn: student?.nisn || undefined,
    matchedBy,
    confidence,
    status,
    warnings,
    conflicts,
  };
}

function findByUniqueIndex(
  index: Map<string, StudentIndexRecord[]>,
  key: string,
  duplicateMessage: string,
  rowIndex: number,
): { record?: StudentIndexRecord; warnings: ImportWarning[]; conflicts: ImportConflict[]; status?: MappingStatus } {
  const matches = index.get(key) || [];
  if (matches.length === 1) return { record: matches[0], warnings: [], conflicts: [] };
  if (matches.length > 1) {
    return {
      warnings: [warning("STUDENT_MATCH_DUPLICATE_WEB_CANDIDATE", duplicateMessage, rowIndex, "student")],
      conflicts: [conflict("STUDENT_MATCH_AMBIGUOUS", duplicateMessage, rowIndex, matches.map((item) => item.student.name))],
      status: "ambiguous",
    };
  }
  return { warnings: [], conflicts: [] };
}

function matchSingleStudent(
  row: ImportExcelStudentRow,
  records: StudentIndexRecord[],
  indexes: {
    id: Map<string, StudentIndexRecord>;
    nisnExact: Map<string, StudentIndexRecord[]>;
    nisnNormalized: Map<string, StudentIndexRecord[]>;
    nameExact: Map<string, StudentIndexRecord[]>;
    nameNormalized: Map<string, StudentIndexRecord[]>;
  },
): StudentMapping {
  const rowName = String(row.name || "").trim();
  const rowNisn = String(row.nisn || "").trim();
  const nameNormalization = normalizeName(rowName);
  const nisnNormalization = normalizeNisn(rowNisn);
  const normalizedName = nameNormalization.normalized;
  const normalizedNisn = nisnNormalization.normalized;

  if (row.studentId) {
    const record = indexes.id.get(row.studentId);
    if (record) {
      const warnings: ImportWarning[] = [];
      if (rowName && normalizeName(record.student.name).normalized !== normalizedName) {
        warnings.push(warning("STUDENT_ID_NAME_CHANGED", "student_id cocok, tetapi nama Excel berbeda dari data web. Data web dipakai sebagai acuan.", row.rowIndex, "name"));
      }
      if (rowNisn && normalizeNisn(record.student.nisn || "").normalized !== normalizedNisn) {
        warnings.push(warning("STUDENT_ID_NISN_CHANGED", "student_id cocok, tetapi NISN Excel berbeda dari data web. Data web dipakai sebagai acuan.", row.rowIndex, "nisn"));
      }
      return createMapping(row, record.student, warnings.length ? "warning" : "safe", "student_id", warnings.length ? 92 : 100, warnings);
    }
  }

  if (rowNisn) {
    const exact = findByUniqueIndex(
      indexes.nisnExact,
      rowNisn,
      "NISN di data web duplikat, sehingga NISN saja tidak boleh dipakai otomatis.",
      row.rowIndex,
    );
    if (exact.record) return createMapping(row, exact.record.student, "safe", "nisn_exact", 98);
    if (exact.status) return createMapping(row, undefined, exact.status, undefined, 0, exact.warnings, exact.conflicts);

    const normalized = findByUniqueIndex(
      indexes.nisnNormalized,
      normalizedNisn,
      "NISN normalized di data web duplikat, sehingga NISN saja tidak boleh dipakai otomatis.",
      row.rowIndex,
    );
    if (normalized.record) {
      const normalizedWarnings = [
        ...nisnNormalization.warnings,
        warning("STUDENT_NISN_NORMALIZED_MATCH", "NISN cocok setelah normalisasi. Perlu ditinjau bila ada leading zero atau format Excel berubah.", row.rowIndex, "nisn"),
      ];
      if (/^0+\d+/.test(rowNisn) || /^0+\d+/.test(normalized.record.student.nisn || "")) {
        normalizedWarnings.push(warning("STUDENT_NISN_LEADING_ZERO_RISK", "NISN memiliki nol di awal. Pastikan format Excel tidak menghapus angka penting.", row.rowIndex, "nisn"));
      }
      return createMapping(
        row,
        normalized.record.student,
        normalizedNisn.length < 10 ? "needs_confirmation" : "warning",
        "nisn_normalized",
        94,
        normalizedWarnings,
      );
    }
    if (normalized.status) return createMapping(row, undefined, normalized.status, undefined, 0, normalized.warnings, normalized.conflicts);
  }

  if (rowName) {
    const normalizedNameMatches = indexes.nameNormalized.get(normalizedName) || [];
    if (normalizedNameMatches.length > 1) {
      const message = "Nama normalized di data web duplikat, sehingga nama saja tidak boleh dipakai otomatis.";
      return createMapping(
        row,
        undefined,
        "ambiguous",
        undefined,
        0,
        [warning("STUDENT_MATCH_DUPLICATE_WEB_CANDIDATE", message, row.rowIndex, "student")],
        [conflict("STUDENT_MATCH_AMBIGUOUS", message, row.rowIndex, normalizedNameMatches.map((item) => item.student.name))],
      );
    }

    const exact = findByUniqueIndex(
      indexes.nameExact,
      rowName.toLowerCase(),
      "Nama exact di data web duplikat, sehingga nama saja tidak boleh dipakai otomatis.",
      row.rowIndex,
    );
    if (exact.record) return createMapping(row, exact.record.student, "safe", "name_exact", 90);
    if (exact.status) return createMapping(row, undefined, exact.status, undefined, 0, exact.warnings, exact.conflicts);

    const normalized = findByUniqueIndex(
      indexes.nameNormalized,
      normalizedName,
      "Nama normalized di data web duplikat, sehingga nama saja tidak boleh dipakai otomatis.",
      row.rowIndex,
    );
    if (normalized.record) {
      return createMapping(
        row,
        normalized.record.student,
        "warning",
        "name_normalized",
        86,
        [warning("STUDENT_NAME_NORMALIZED_MATCH", "Nama cocok setelah normalisasi. Data web tetap menjadi acuan.", row.rowIndex, "name")],
      );
    }
    if (normalized.status) return createMapping(row, undefined, normalized.status, undefined, 0, normalized.warnings, normalized.conflicts);

    const aliasCandidates = nameNormalization.candidates.filter((candidate) => candidate && candidate !== normalizedName);
    if (aliasCandidates.length > 0) {
      const aliasMatches = unique(aliasCandidates)
        .flatMap((candidate) => indexes.nameNormalized.get(candidate) || []);
      const uniqueAliasMatches = Array.from(new Map(aliasMatches.map((item) => [item.student.id, item])).values());
      if (uniqueAliasMatches.length === 1) {
        return createMapping(
          row,
          uniqueAliasMatches[0].student,
          "needs_confirmation",
          "fuzzy",
          88,
          [
            ...nameNormalization.warnings,
            warning("STUDENT_ALIAS_NEEDS_CONFIRMATION", "Variasi nama seperti Muh/Muhammad hanya menjadi saran dan perlu dikonfirmasi.", row.rowIndex, "name"),
          ],
        );
      }
      if (uniqueAliasMatches.length > 1) {
        const message = "Variasi nama cocok ke beberapa siswa web. Pilih siswa yang benar secara manual.";
        return createMapping(
          row,
          undefined,
          "ambiguous",
          "manual",
          0,
          [warning("STUDENT_ALIAS_NEEDS_CONFIRMATION", message, row.rowIndex, "name")],
          [conflict("STUDENT_MATCH_AMBIGUOUS", message, row.rowIndex, studentNames(uniqueAliasMatches))],
        );
      }
    }

    const fuzzyMatches = records
      .map((record) => ({ record, score: similarity(normalizedName, record.normalizedName) }))
      .filter((item) => item.score >= 72)
      .sort((left, right) => right.score - left.score);
    const best = fuzzyMatches[0];
    const second = fuzzyMatches[1];
    if (best && second && best.score - second.score < 10) {
      return createMapping(
        row,
        undefined,
        "ambiguous",
        "manual",
        best.score,
        [warning("STUDENT_FUZZY_AMBIGUOUS", "Beberapa siswa web mirip dengan baris Excel ini.", row.rowIndex, "name")],
        [conflict("STUDENT_MATCH_AMBIGUOUS", "Beberapa kandidat siswa ditemukan. Pilih manual sebelum import.", row.rowIndex, fuzzyMatches.slice(0, 5).map((item) => item.record.student.name))],
      );
    }
    if (best) {
      const fuzzyWarnings = [
        warning("STUDENT_FUZZY_NEEDS_CONFIRMATION", "Nama siswa mirip dan perlu dikonfirmasi sebelum import.", row.rowIndex, "name"),
      ];
      if (isShortName(normalizedName)) {
        fuzzyWarnings.push(warning("STUDENT_SHORT_NAME_RISK", "Nama terlalu pendek untuk dipastikan otomatis.", row.rowIndex, "name"));
      }
      return createMapping(
        row,
        best.record.student,
        "needs_confirmation",
        "fuzzy",
        best.score,
        fuzzyWarnings,
      );
    }
  }

  return createMapping(
    row,
    undefined,
    "missing_in_web",
    "manual",
    0,
    [warning("STUDENT_MISSING_IN_WEB", "Siswa ada di Excel tetapi tidak ditemukan di data web. Sistem tidak akan auto-create siswa.", row.rowIndex, "student")],
  );
}

export function matchStudents(
  rows: ImportExcelStudentRow[],
  students: ImportWebStudent[],
  options: Pick<StudentMatcherOptions, "officialMetadata"> = {},
): StudentMatcherResult {
  const metadataByRow = new Map<number, OfficialStudentRowMetadata>();
  options.officialMetadata?.forEach((item) => {
    if (item.rowIndex) metadataByRow.set(item.rowIndex, item);
  });
  const enrichedRows = rows.map((row) => ({
    ...row,
    studentId: row.studentId || metadataByRow.get(row.rowIndex)?.studentId,
  }));
  const records: StudentIndexRecord[] = students.map((student) => ({
    student,
    normalizedName: normalizeName(student.name).normalized,
    normalizedNisn: normalizeNisn(student.nisn || "").normalized,
  }));

  const indexes = {
    id: new Map(records.map((record) => [record.student.id, record])),
    nisnExact: groupBy(records, (record) => String(record.student.nisn || "").trim()),
    nisnNormalized: groupBy(records, (record) => record.normalizedNisn),
    nameExact: groupBy(records, (record) => record.student.name.trim().toLowerCase()),
    nameNormalized: groupBy(records, (record) => record.normalizedName),
  };

  let mappings = enrichedRows.map((row) => matchSingleStudent(row, records, indexes));
  const matchedIds = mappings.map((mapping) => mapping.studentId).filter(Boolean) as string[];
  const duplicateMatchedIds = new Set(
    unique(matchedIds.filter((id, index) => matchedIds.indexOf(id) !== index)),
  );

  if (duplicateMatchedIds.size > 0) {
    mappings = mappings.map((mapping) => {
      if (!mapping.studentId || !duplicateMatchedIds.has(mapping.studentId)) return mapping;
      return {
        ...mapping,
        status: "blocked",
        conflicts: [
          ...mapping.conflicts,
          conflict("STUDENT_DUPLICATE_EXCEL_MATCH", "Satu siswa web cocok ke lebih dari satu baris Excel. Baris ini diblokir sampai diperbaiki.", mapping.rowIndex),
        ],
      };
    });
  }

  const matchedStudentIds = new Set(mappings.filter((mapping) => mapping.studentId && mapping.status !== "blocked").map((mapping) => mapping.studentId));
  const missingInExcelStudents = students
    .filter((student) => !matchedStudentIds.has(student.id))
    .map<MissingInExcelStudent>((student) => ({
      studentId: student.id,
      webName: student.name,
      webNisn: student.nisn || undefined,
      status: "missing_in_excel",
      warnings: [warning("STUDENT_MISSING_IN_EXCEL", "Siswa ada di web tetapi tidak ada di Excel.", undefined, "student")],
    }));

  const warnings = [
    ...mappings.flatMap((mapping) => mapping.warnings),
    ...missingInExcelStudents.flatMap((student) => student.warnings),
  ];
  const conflicts = mappings.flatMap((mapping) => mapping.conflicts);
  const countStatus = (status: MappingStatus) => mappings.filter((mapping) => mapping.status === status).length;

  return {
    mappings,
    missingInExcelStudents,
    warnings,
    conflicts,
    summary: {
      excelRows: rows.length,
      webStudents: students.length,
      safe: countStatus("safe"),
      warning: countStatus("warning"),
      ambiguous: countStatus("ambiguous"),
      missingInWeb: countStatus("missing_in_web"),
      missingInExcel: missingInExcelStudents.length,
      blocked: countStatus("blocked"),
    },
  };
}

export function matchStudentsFromWorkbookRows(
  rows: WorkbookCell[][],
  students: ImportWebStudent[],
  options: StudentMatcherOptions = {},
): StudentMatcherResult {
  return matchStudents(extractStudentRowsFromWorkbook(rows, options), students, options);
}

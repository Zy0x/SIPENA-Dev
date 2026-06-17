import * as XLSX from "xlsx";

export const CLASS_STUDENT_IMPORT_TEMPLATE_VERSION = "1.0.0";
export const CLASS_IMPORT_MAX_NAME_LENGTH = 50;
export const CLASS_IMPORT_MAX_DESCRIPTION_LENGTH = 500;
export const STUDENT_IMPORT_MAX_NISN_LENGTH = 17;
export const STUDENT_IMPORT_WARN_NISN_MIN_LENGTH = 10;

const GUIDE_SHEET = "Panduan";
const SUMMARY_SHEET = "Ringkasan";
const CLASS_SHEET = "Kelas";
const STUDENT_SHEET_PREFIX = "Siswa - ";

export type ImportSeverity = "error" | "warning" | "info";

export interface ExistingClassForImport {
  id: string;
  name: string;
  class_kkm: number | null;
  description: string | null;
  students?: ExistingStudentForImport[];
}

export interface ExistingStudentForImport {
  id: string;
  name: string;
  nisn: string;
}

export interface ImportIssue {
  severity: ImportSeverity;
  sheetName: string;
  rowNumber?: number;
  message: string;
}

export type StudentImportStatus =
  | "new"
  | "skip-existing"
  | "warning-name-conflict"
  | "blocked-nisn-conflict"
  | "invalid";

export interface ParsedImportStudent {
  rowNumber: number;
  orderNumber: number | null;
  name: string;
  nisn: string;
  status: StudentImportStatus;
  issues: ImportIssue[];
}

export interface ParsedImportClass {
  rowNumber: number;
  name: string;
  normalizedName: string;
  classKkm: number;
  description: string;
  sheetName: string;
  existingClassId: string | null;
  students: ParsedImportStudent[];
  issues: ImportIssue[];
}

export interface ClassStudentImportPlan {
  classes: ParsedImportClass[];
  issues: ImportIssue[];
  totals: {
    classCount: number;
    newClassCount: number;
    existingClassCount: number;
    studentCount: number;
    newStudentCount: number;
    skippedStudentCount: number;
    warningStudentCount: number;
    blockedStudentCount: number;
    errorCount: number;
    warningCount: number;
  };
}

type SheetRows = Array<Array<string | number>>;

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizeImportText(value: unknown) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function normalizeImportIdentity(value: unknown) {
  return normalizeImportText(value).toLowerCase();
}

function issue(severity: ImportSeverity, sheetName: string, message: string, rowNumber?: number): ImportIssue {
  return { severity, sheetName, rowNumber, message };
}

function getCell(row: unknown[], headerMap: Map<string, number>, candidates: string[]) {
  for (const candidate of candidates) {
    const index = headerMap.get(normalizeKey(candidate));
    if (index !== undefined) return normalizeImportText(row[index]);
  }
  return "";
}

function buildHeaderMap(header: unknown[]) {
  const map = new Map<string, number>();
  header.forEach((cell, index) => {
    const key = normalizeKey(normalizeImportText(cell));
    if (key && !map.has(key)) map.set(key, index);
  });
  return map;
}

function sheetToRows(sheet: XLSX.WorkSheet | undefined) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
}

function sanitizeSheetNamePart(value: string) {
  return normalizeImportText(value)
    .replace(/[:\\/?*[\]]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

export function getStudentSheetName(className: string) {
  const base = `${STUDENT_SHEET_PREFIX}${sanitizeSheetNamePart(className) || "Kelas"}`;
  return base.slice(0, 31);
}

function findStudentSheet(workbook: XLSX.WorkBook, className: string, requestedSheetName: string) {
  const names = workbook.SheetNames;
  const normalizedRequested = normalizeImportIdentity(requestedSheetName);
  const exactRequested = names.find((name) => normalizeImportIdentity(name) === normalizedRequested);
  if (exactRequested) return exactRequested;

  const expected = getStudentSheetName(className);
  const normalizedExpected = normalizeImportIdentity(expected);
  const exactExpected = names.find((name) => normalizeImportIdentity(name) === normalizedExpected);
  if (exactExpected) return exactExpected;

  const normalizedClass = normalizeImportIdentity(className);
  return names.find((name) => normalizeImportIdentity(name).startsWith(normalizeImportIdentity(STUDENT_SHEET_PREFIX)) && normalizeImportIdentity(name).includes(normalizedClass));
}

function makeSheet(rows: SheetRows, widths: number[]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!cols"] = widths.map((wch) => ({ wch }));
  return sheet;
}

export function buildClassStudentImportTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet([
      ["PANDUAN IMPORT KELAS & SISWA SIPENA"],
      [""],
      ["Template ini digunakan untuk menambahkan banyak kelas dan siswa sekaligus."],
      ["Import ini hanya mencakup data dasar: kelas, KKM, deskripsi, nama siswa, dan NISN."],
      [""],
      ["Aturan utama"],
      ["1. Jangan menghapus sheet Panduan, Ringkasan, atau Kelas."],
      ["2. Isi sheet Kelas terlebih dahulu. Setiap baris kelas dapat menunjuk ke satu sheet siswa."],
      ["3. Untuk setiap kelas, gunakan sheet bernama Siswa - <Nama Kelas>. Jika nama kelas panjang, isi kolom Sheet Siswa pada sheet Kelas."],
      ["4. Nama kelas wajib, maksimal 50 karakter. Deskripsi maksimal 500 karakter. KKM harus 0 sampai 100."],
      ["5. Nama siswa dan NISN wajib. NISN maksimal 17 karakter; NISN kurang dari 10 karakter akan diberi peringatan."],
      ["6. Kelas yang sudah ada pada tahun ajaran aktif tidak dibuat ulang. Siswa duplikat akan ditandai saat preview."],
      ["7. Perbaiki semua error di preview sebelum menekan Import."],
      [""],
      ["Cara membaca hasil preview"],
      ["Error: harus diperbaiki di file sebelum import."],
      ["Warning: boleh dilanjutkan setelah dikonfirmasi, misalnya nama siswa sama tetapi NISN berbeda."],
      ["Info: data tidak akan dibuat ulang, misalnya siswa sudah ada."],
    ], [80]),
    GUIDE_SHEET,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet([
      ["Sheet Siswa", "Nama Kelas", "Jumlah Siswa", "Catatan"],
      ["Siswa - VIIA", "VIIA", 3, "Contoh sheet siswa untuk kelas VIIA"],
      ["Siswa - VIIB", "VIIB", 2, "Contoh sheet siswa untuk kelas VIIB"],
    ], [22, 24, 14, 48]),
    SUMMARY_SHEET,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet([
      ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Sheet Siswa"],
      ["VIIA", 75, "Kelas contoh untuk import data dasar.", "Siswa - VIIA"],
      ["VIIB", 70, "Kelas kedua dengan sheet siswa terpisah.", "Siswa - VIIB"],
    ], [24, 14, 52, 24]),
    CLASS_SHEET,
  );

  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Ahmad Fauzi", "0012345678"],
      [2, "Siti Rahma", "0012345679"],
      [3, "Citra Dewi", "0012345680"],
    ], [8, 36, 20]),
    "Siswa - VIIA",
  );

  XLSX.utils.book_append_sheet(
    workbook,
    makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Budi Santoso", "0012345681"],
      [2, "Dewi Lestari", "0012345682"],
    ], [8, 36, 20]),
    "Siswa - VIIB",
  );

  workbook.Props = {
    ...(workbook.Props ?? {}),
    Title: "Template Import Kelas dan Siswa SIPENA",
    Subject: `SIPENA Class Student Import ${CLASS_STUDENT_IMPORT_TEMPLATE_VERSION}`,
  };

  return workbook;
}

export function downloadClassStudentImportTemplate() {
  XLSX.writeFile(buildClassStudentImportTemplateWorkbook(), "SIPENA_Template_Import_Kelas_dan_Siswa.xlsx");
}

function parseNumber(value: string) {
  if (!value) return Number.NaN;
  return Number(value.replace(",", "."));
}

function parseStudentRows(sheetName: string, rows: unknown[][], existingStudents: ExistingStudentForImport[]) {
  const header = rows[0] ?? [];
  const headerMap = buildHeaderMap(header);
  const parsed: ParsedImportStudent[] = [];
  const seenNisn = new Map<string, number>();
  const seenName = new Map<string, { rowNumber: number; nisn: string }>();
  const existingByNisn = new Map(existingStudents.filter((student) => student.nisn).map((student) => [normalizeImportIdentity(student.nisn), student]));
  const existingByName = new Map(existingStudents.map((student) => [normalizeImportIdentity(student.name), student]));

  rows.slice(1).forEach((row, index) => {
    const rowNumber = index + 2;
    const name = getCell(row, headerMap, ["Nama Siswa", "Nama", "Siswa"]);
    const nisn = getCell(row, headerMap, ["NISN", "NIS"]);
    const no = getCell(row, headerMap, ["No", "Nomor", "No Absen", "Absen"]);
    const orderNumber = no ? Number(no) : null;
    const issues: ImportIssue[] = [];

    if (!name && !nisn) return;

    if (!name) issues.push(issue("error", sheetName, "Nama siswa wajib diisi.", rowNumber));
    if (!nisn) {
      issues.push(issue("error", sheetName, "NISN wajib diisi.", rowNumber));
    } else if (nisn.length > STUDENT_IMPORT_MAX_NISN_LENGTH) {
      issues.push(issue("error", sheetName, `NISN maksimal ${STUDENT_IMPORT_MAX_NISN_LENGTH} karakter.`, rowNumber));
    } else if (nisn.length < STUDENT_IMPORT_WARN_NISN_MIN_LENGTH) {
      issues.push(issue("warning", sheetName, `NISN kurang dari ${STUDENT_IMPORT_WARN_NISN_MIN_LENGTH} karakter. Periksa kembali jika ini bukan nomor internal.`, rowNumber));
    }

    if (orderNumber !== null && (!Number.isFinite(orderNumber) || orderNumber < 1)) {
      issues.push(issue("warning", sheetName, "Nomor urut tidak valid dan akan diabaikan.", rowNumber));
    }

    const normalizedName = normalizeImportIdentity(name);
    const normalizedNisn = normalizeImportIdentity(nisn);
    const existingSameNisn = normalizedNisn ? existingByNisn.get(normalizedNisn) : undefined;
    const existingSameName = normalizedName ? existingByName.get(normalizedName) : undefined;
    const seenNisnRow = normalizedNisn ? seenNisn.get(normalizedNisn) : undefined;
    const seenNameRow = normalizedName ? seenName.get(normalizedName) : undefined;

    let status: StudentImportStatus = issues.some((item) => item.severity === "error") ? "invalid" : "new";

    if (seenNisnRow !== undefined && status !== "invalid") {
      issues.push(issue("error", sheetName, `NISN sama dengan baris ${seenNisnRow}.`, rowNumber));
      status = "blocked-nisn-conflict";
    }

    if (seenNameRow && seenNameRow.nisn !== nisn && status !== "invalid" && status !== "blocked-nisn-conflict") {
      issues.push(issue("warning", sheetName, `Nama sama dengan baris ${seenNameRow.rowNumber}, tetapi NISN berbeda.`, rowNumber));
      status = "warning-name-conflict";
    }

    if (existingSameNisn && normalizeImportIdentity(existingSameNisn.name) !== normalizedName && status !== "invalid") {
      issues.push(issue("error", sheetName, `NISN sudah dipakai oleh "${existingSameNisn.name}" di kelas ini.`, rowNumber));
      status = "blocked-nisn-conflict";
    } else if (existingSameName && normalizeImportIdentity(existingSameName.nisn) !== normalizedNisn && status === "new") {
      issues.push(issue("warning", sheetName, `Nama sama dengan siswa existing "${existingSameName.name}", tetapi NISN berbeda.`, rowNumber));
      status = "warning-name-conflict";
    } else if (existingSameName && normalizeImportIdentity(existingSameName.nisn) === normalizedNisn && status === "new") {
      issues.push(issue("info", sheetName, "Siswa sudah ada dan akan dilewati.", rowNumber));
      status = "skip-existing";
    }

    if (normalizedNisn && seenNisnRow === undefined) seenNisn.set(normalizedNisn, rowNumber);
    if (normalizedName && !seenNameRow) seenName.set(normalizedName, { rowNumber, nisn });

    parsed.push({
      rowNumber,
      orderNumber: Number.isFinite(orderNumber) ? orderNumber : null,
      name,
      nisn,
      status,
      issues,
    });
  });

  return parsed;
}

export function buildClassStudentImportPlan(
  workbook: XLSX.WorkBook,
  existingClasses: ExistingClassForImport[],
): ClassStudentImportPlan {
  const allIssues: ImportIssue[] = [];
  const classes: ParsedImportClass[] = [];
  const classSheet = workbook.Sheets[CLASS_SHEET];
  const classRows = sheetToRows(classSheet);
  const existingClassMap = new Map(existingClasses.map((item) => [normalizeImportIdentity(item.name), item]));
  const seenClassNames = new Set<string>();

  if (!classSheet || classRows.length < 2) {
    allIssues.push(issue("error", CLASS_SHEET, "Sheet Kelas wajib ada dan minimal berisi satu kelas."));
  } else {
    const headerMap = buildHeaderMap(classRows[0]);

    classRows.slice(1).forEach((row, index) => {
      const rowNumber = index + 2;
      const classIssues: ImportIssue[] = [];
      const name = getCell(row, headerMap, ["Nama Kelas", "Kelas"]);
      const kkmRaw = getCell(row, headerMap, ["KKM Kelas", "KKM"]);
      const description = getCell(row, headerMap, ["Deskripsi", "Deskripsi Kelas", "Catatan"]);
      const requestedSheet = getCell(row, headerMap, ["Sheet Siswa", "Nama Sheet Siswa", "Sheet"]);

      if (!name && !kkmRaw && !description && !requestedSheet) return;

      const normalizedName = normalizeImportIdentity(name);
      const classKkm = parseNumber(kkmRaw);

      if (!name) classIssues.push(issue("error", CLASS_SHEET, "Nama kelas wajib diisi.", rowNumber));
      if (name.length > CLASS_IMPORT_MAX_NAME_LENGTH) classIssues.push(issue("error", CLASS_SHEET, `Nama kelas maksimal ${CLASS_IMPORT_MAX_NAME_LENGTH} karakter.`, rowNumber));
      if (!Number.isFinite(classKkm) || classKkm < 0 || classKkm > 100) classIssues.push(issue("error", CLASS_SHEET, "KKM kelas harus berupa angka 0 sampai 100.", rowNumber));
      if (description.length > CLASS_IMPORT_MAX_DESCRIPTION_LENGTH) classIssues.push(issue("error", CLASS_SHEET, `Deskripsi maksimal ${CLASS_IMPORT_MAX_DESCRIPTION_LENGTH} karakter.`, rowNumber));
      if (normalizedName && seenClassNames.has(normalizedName)) classIssues.push(issue("error", CLASS_SHEET, `Kelas "${name}" muncul lebih dari sekali di sheet Kelas.`, rowNumber));
      if (normalizedName) seenClassNames.add(normalizedName);

      const existingClass = normalizedName ? existingClassMap.get(normalizedName) : undefined;
      const expectedSheet = requestedSheet || getStudentSheetName(name);
      const resolvedSheetName = findStudentSheet(workbook, name, expectedSheet);
      const studentRows = resolvedSheetName ? sheetToRows(workbook.Sheets[resolvedSheetName]) : [];
      if (!resolvedSheetName) {
        classIssues.push(issue("warning", CLASS_SHEET, `Sheet siswa "${expectedSheet}" tidak ditemukan. Kelas tetap dapat dibuat tanpa siswa.`, rowNumber));
      }

      const students = resolvedSheetName
        ? parseStudentRows(resolvedSheetName, studentRows, existingClass?.students ?? [])
        : [];

      classes.push({
        rowNumber,
        name,
        normalizedName,
        classKkm: Number.isFinite(classKkm) ? classKkm : 0,
        description,
        sheetName: resolvedSheetName ?? expectedSheet,
        existingClassId: existingClass?.id ?? null,
        students,
        issues: classIssues,
      });
    });
  }

  classes.forEach((item) => {
    allIssues.push(...item.issues, ...item.students.flatMap((student) => student.issues));
  });

  const allStudents = classes.flatMap((item) => item.students);
  const errorCount = allIssues.filter((item) => item.severity === "error").length;
  const warningCount = allIssues.filter((item) => item.severity === "warning").length;

  return {
    classes,
    issues: allIssues,
    totals: {
      classCount: classes.length,
      newClassCount: classes.filter((item) => !item.existingClassId).length,
      existingClassCount: classes.filter((item) => item.existingClassId).length,
      studentCount: allStudents.length,
      newStudentCount: allStudents.filter((item) => item.status === "new").length,
      skippedStudentCount: allStudents.filter((item) => item.status === "skip-existing").length,
      warningStudentCount: allStudents.filter((item) => item.status === "warning-name-conflict").length,
      blockedStudentCount: allStudents.filter((item) => item.status === "blocked-nisn-conflict" || item.status === "invalid").length,
      errorCount,
      warningCount,
    },
  };
}

export function readClassStudentImportWorkbook(buffer: ArrayBuffer) {
  return XLSX.read(buffer, { type: "array", raw: true, cellDates: false });
}

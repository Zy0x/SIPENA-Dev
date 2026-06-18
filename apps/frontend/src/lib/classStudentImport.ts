import * as XLSX from "xlsx-js-style";

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
type SheetStyle = Record<string, unknown>;

const TEMPLATE_COLORS = {
  blue: "2563EB",
  blueSoft: "DBEAFE",
  skySoft: "E0F2FE",
  green: "16A34A",
  greenSoft: "DCFCE7",
  amber: "F59E0B",
  amberSoft: "FEF3C7",
  redSoft: "FEE2E2",
  slate: "0F172A",
  muted: "64748B",
  border: "CBD5E1",
  white: "FFFFFF",
};

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

function estimateWrappedRowHeight(text: unknown, charsPerLine = 78, minHeight = 22, lineHeight = 16) {
  const value = String(text ?? "");
  const explicitLines = value.split(/\n/g);
  const visualLines = explicitLines.reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  return Math.max(minHeight, Math.min(84, visualLines * lineHeight + 8));
}

function styleCell(sheet: XLSX.WorkSheet, address: string, style: SheetStyle) {
  const cell = sheet[address] ?? { t: "s", v: "" };
  cell.s = { ...(cell.s ?? {}), ...style };
  sheet[address] = cell;
}

function styleRange(sheet: XLSX.WorkSheet, rangeAddress: string, style: SheetStyle) {
  const range = XLSX.utils.decode_range(rangeAddress);
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      styleCell(sheet, XLSX.utils.encode_cell({ r: row, c: col }), style);
    }
  }
}

function mergeRange(sheet: XLSX.WorkSheet, rangeAddress: string) {
  sheet["!merges"] = [...(sheet["!merges"] ?? []), XLSX.utils.decode_range(rangeAddress)];
}

function applyGuideSheetStyle(sheet: XLSX.WorkSheet) {
  sheet["!cols"] = [{ wch: 24 }, { wch: 86 }];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:B1");
  sheet["!rows"] = Array.from({ length: range.e.r + 1 }, (_, index) => {
    if (index === 0) return { hpt: 30 };
    const label = sheet[XLSX.utils.encode_cell({ r: index, c: 0 })]?.v;
    const content = sheet[XLSX.utils.encode_cell({ r: index, c: 1 })]?.v;
    if (!label && !content) return { hpt: 8 };
    return { hpt: estimateWrappedRowHeight(content, 82, 22, 15) };
  });
  mergeRange(sheet, "A1:B1");
  styleCell(sheet, "A1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.blue } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.white }, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
  });
  styleRange(sheet, "A1:B1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.blue } },
    border: { bottom: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } } },
  });
  styleRange(sheet, `A3:B${range.e.r + 1}`, {
    alignment: { vertical: "top", wrapText: true },
    border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
  });

  ["A3", "A7", "A13", "A20", "A26"].forEach((cell) => {
    styleCell(sheet, cell, {
      fill: { fgColor: { rgb: TEMPLATE_COLORS.blueSoft } },
      font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
      alignment: { vertical: "center", wrapText: true },
    });
  });
  ["A4", "A5", "A8", "A9", "A10", "A11", "A14", "A15", "A16", "A17", "A18", "A21", "A22", "A23", "A27", "A28", "A29"].forEach((cell) => {
    styleCell(sheet, cell, {
      font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
      alignment: { vertical: "top", wrapText: true },
    });
  });
  ["B10", "B11", "B16", "B17", "B22", "B23"].forEach((cell) => {
    styleCell(sheet, cell, {
      fill: { fgColor: { rgb: TEMPLATE_COLORS.amberSoft } },
      font: { color: { rgb: TEMPLATE_COLORS.slate } },
      alignment: { vertical: "top", wrapText: true },
    });
  });
}

function applyTableSheetStyle(sheet: XLSX.WorkSheet, rangeAddress: string, requiredCols: string[] = []) {
  const range = XLSX.utils.decode_range(rangeAddress);
  sheet["!autofilter"] = { ref: rangeAddress };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  styleRange(sheet, rangeAddress, {
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      bottom: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      left: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      right: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
    },
  });
  for (let col = range.s.c; col <= range.e.c; col += 1) {
    const address = XLSX.utils.encode_cell({ r: range.s.r, c: col });
    const value = normalizeImportText(sheet[address]?.v);
    const required = requiredCols.some((item) => value.includes(item));
    styleCell(sheet, address, {
      fill: { fgColor: { rgb: required ? TEMPLATE_COLORS.blue : TEMPLATE_COLORS.skySoft } },
      font: { bold: true, color: { rgb: required ? TEMPLATE_COLORS.white : TEMPLATE_COLORS.slate } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
    });
  }
}

export function buildClassStudentImportTemplateWorkbook() {
  const workbook = XLSX.utils.book_new();
  const guideSheet = makeSheet([
    ["PANDUAN IMPORT KELAS & SISWA SIPENA", ""],
    ["", ""],
    ["Fungsi file ini", "Untuk menambahkan banyak kelas dan siswa sekaligus. Data yang dibaca: nama kelas, KKM, deskripsi, nama siswa, dan NISN."],
    ["Yang harus diisi", "Isi sheet Kelas, lalu isi sheet siswa sesuai kelasnya. Contoh: kelas VIIA memakai sheet Siswa - VIIA."],
    ["Yang jangan diubah", "Jangan menghapus sheet Panduan, Ringkasan, atau Kelas. Jangan mengganti header yang memakai tanda bintang (*)."],
    ["", ""],
    ["Cara isi cepat", ""],
    ["1", "Buka sheet Kelas. Isi satu baris untuk setiap kelas."],
    ["2", "Isi Nama Kelas, KKM Kelas, Deskripsi bila perlu, dan nama Sheet Siswa."],
    ["3", "Buka sheet siswa yang tertulis di kolom Sheet Siswa."],
    ["4", "Isi Nama Siswa dan NISN. Kolom No boleh kosong."],
    ["5", "Jika menambah kelas, duplikasi sheet siswa contoh lalu ubah namanya."],
    ["", ""],
    ["Kolom wajib", ""],
    ["Nama Kelas", "Wajib diisi dan maksimal 50 karakter."],
    ["KKM Kelas", "Wajib angka 0 sampai 100. Contoh: 70 atau 75."],
    ["Deskripsi", "Opsional, maksimal 500 karakter."],
    ["Nama Siswa", "Wajib diisi sesuai data sekolah."],
    ["NISN", "Wajib diisi, maksimal 17 karakter. Jika kurang dari 10 karakter, SIPENA akan meminta Anda mengecek ulang."],
    ["", ""],
    ["Saat Cek Data", ""],
    ["Centang Ikut", "Centang kelas yang ingin dimasukkan. Hapus centang jika kelas belum ingin diimport."],
    ["Catatan merah", "Harus diperbaiki di file Excel sebelum import."],
    ["Catatan kuning", "Boleh dilanjutkan setelah Anda cek dan konfirmasi."],
    ["", ""],
    ["Duplikat", ""],
    ["Kelas sudah ada", "Kelas tidak dibuat ulang. SIPENA memakai kelas yang sudah ada."],
    ["Siswa sudah ada", "Jika Nama dan NISN sama, siswa dilewati agar tidak dobel."],
    ["Nama sama, NISN beda", "Muncul catatan kuning. Lanjutkan hanya jika memang siswa berbeda."],
    ["NISN sama, nama beda", "Muncul catatan merah. Perbaiki NISN atau keluarkan kelas dari import."],
    ["", ""],
    ["Checklist sebelum upload", ""],
    ["1", "Nama sheet siswa sama dengan kolom Sheet Siswa."],
    ["2", "Nama Kelas, KKM Kelas, Nama Siswa, dan NISN tidak kosong."],
    ["3", "File disimpan sebagai .xlsx, lalu upload kembali ke SIPENA."],
  ], [28, 92]);
  applyGuideSheetStyle(guideSheet);

  XLSX.utils.book_append_sheet(workbook, guideSheet, GUIDE_SHEET);

  const summarySheet = makeSheet([
      ["Ringkasan Template Import Kelas & Siswa SIPENA"],
      [""],
      ["Sheet ini membantu memahami isi template. Data utama tetap diisi dari sheet Kelas dan sheet siswa per kelas."],
      [""],
      ["Sheet Siswa", "Nama Kelas", "Jumlah Siswa", "Status", "Catatan"],
      ["Siswa - VIIA", "VIIA", 3, "Contoh", "Contoh sheet siswa untuk kelas VIIA"],
      ["Siswa - VIIB", "VIIB", 2, "Contoh", "Contoh sheet siswa untuk kelas VIIB"],
      [""],
      ["Cara menambah kelas"],
      ["1. Tambahkan baris baru di sheet Kelas."],
      ["2. Buat atau duplikasi sheet siswa baru."],
      ["3. Pastikan kolom Sheet Siswa di sheet Kelas sama persis dengan nama sheet siswa."],
    ], [24, 24, 14, 16, 58]);
  mergeRange(summarySheet, "A1:E1");
  styleRange(summarySheet, "A1:E1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.green } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.white }, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
  });
  styleRange(summarySheet, "A5:E7", {
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      bottom: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      left: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      right: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
    },
  });
  styleRange(summarySheet, "A5:E5", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.greenSoft } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET);

  const classSheet = makeSheet([
      ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Sheet Siswa"],
      ["VIIA", 75, "Kelas contoh untuk import data dasar.", "Siswa - VIIA"],
      ["VIIB", 70, "Kelas kedua dengan sheet siswa terpisah.", "Siswa - VIIB"],
    ], [24, 14, 52, 24]);
  applyTableSheetStyle(classSheet, "A1:D3", ["Nama Kelas", "KKM Kelas"]);
  styleRange(classSheet, "C2:C3", { alignment: { vertical: "top", wrapText: true } });
  XLSX.utils.book_append_sheet(workbook, classSheet, CLASS_SHEET);

  const viiASheet = makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Ahmad Fauzi", "0012345678"],
      [2, "Siti Rahma", "0012345679"],
      [3, "Citra Dewi", "0012345680"],
    ], [8, 36, 20]);
  applyTableSheetStyle(viiASheet, "A1:C4", ["Nama Siswa", "NISN"]);
  XLSX.utils.book_append_sheet(workbook, viiASheet, "Siswa - VIIA");

  const viiBSheet = makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Budi Santoso", "0012345681"],
      [2, "Dewi Lestari", "0012345682"],
    ], [8, 36, 20]);
  applyTableSheetStyle(viiBSheet, "A1:C3", ["Nama Siswa", "NISN"]);
  XLSX.utils.book_append_sheet(workbook, viiBSheet, "Siswa - VIIB");

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

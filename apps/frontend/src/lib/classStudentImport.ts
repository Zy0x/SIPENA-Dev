import * as XLSX from "xlsx-js-style";

export const CLASS_STUDENT_IMPORT_TEMPLATE_VERSION = "1.1.0";
export const CLASS_IMPORT_MAX_NAME_LENGTH = 50;
export const CLASS_IMPORT_MAX_DESCRIPTION_LENGTH = 500;
export const STUDENT_IMPORT_MAX_NISN_LENGTH = 17;
export const STUDENT_IMPORT_WARN_NISN_MIN_LENGTH = 10;

const GUIDE_SHEET = "Panduan";
const SUMMARY_SHEET = "Ringkasan";
const CLASS_SHEET = "Kelas";
const STUDENT_SHEET_PREFIX = "Kelas - ";
const LEGACY_STUDENT_SHEET_PREFIX = "Siswa - ";

const CLASS_NAME_HEADERS = ["Nama Kelas", "Nama Rombel", "Kelas"];
const CLASS_KKM_HEADERS = ["KKM Kelas", "KKM", "Nilai KKM", "Kriteria Ketuntasan"];
const CLASS_DESCRIPTION_HEADERS = ["Deskripsi", "Deskripsi Kelas", "Catatan", "Keterangan"];
const CLASS_STUDENT_SHEET_HEADERS = [
  "Nama Sheet Kelas",
  "Sheet Kelas",
  "Sheet Data Murid",
  "Sheet Siswa",
  "Nama Sheet Siswa",
  "Nama Sheet",
  "Sheet",
  "Tab Kelas",
  "Nama Tab",
];
const STUDENT_NAME_HEADERS = ["Nama Siswa", "Nama Murid", "Nama Peserta Didik", "Nama", "Siswa", "Murid", "Peserta Didik"];
const STUDENT_NISN_HEADERS = ["NISN", "NIS", "Nomor Induk Siswa Nasional", "Nomor Induk"];
const STUDENT_ORDER_HEADERS = ["No", "Nomor", "Nomor Urut", "No Absen", "Absen"];

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

function normalizeSheetKey(value: unknown) {
  return normalizeKey(normalizeImportText(value));
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

function hasHeader(headerMap: Map<string, number>, candidates: string[]) {
  return candidates.some((candidate) => headerMap.has(normalizeKey(candidate)));
}

function findHeaderRowIndex(rows: unknown[][], requiredHeaderGroups: string[][], maxScanRows = 12) {
  const scanLimit = Math.min(rows.length, maxScanRows);
  for (let index = 0; index < scanLimit; index += 1) {
    const headerMap = buildHeaderMap(rows[index] ?? []);
    const matchesAll = requiredHeaderGroups.every((group) => hasHeader(headerMap, group));
    if (matchesAll) return index;
  }
  return -1;
}

function getSheetNameByIdentity(workbook: XLSX.WorkBook, sheetName: string) {
  const target = normalizeSheetKey(sheetName);
  if (!target) return undefined;
  return workbook.SheetNames.find((name) => normalizeSheetKey(name) === target);
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
  const reservedKeys = new Set([GUIDE_SHEET, SUMMARY_SHEET, CLASS_SHEET].map(normalizeSheetKey));
  const isReserved = (name: string) => reservedKeys.has(normalizeSheetKey(name));
  const exactRequested = getSheetNameByIdentity(workbook, requestedSheetName);
  if (exactRequested && !isReserved(exactRequested)) return exactRequested;

  const expected = getStudentSheetName(className);
  const exactExpected = getSheetNameByIdentity(workbook, expected);
  if (exactExpected) return exactExpected;

  const legacyExpected = `${LEGACY_STUDENT_SHEET_PREFIX}${sanitizeSheetNamePart(className) || "Kelas"}`.slice(0, 31);
  const exactLegacy = getSheetNameByIdentity(workbook, legacyExpected);
  if (exactLegacy) return exactLegacy;

  const normalizedClass = normalizeSheetKey(className);
  const studentSheetCandidates = names.filter((name) => {
    if (isReserved(name)) return false;
    const rows = sheetToRows(workbook.Sheets[name]);
    return findHeaderRowIndex(rows, [STUDENT_NAME_HEADERS, STUDENT_NISN_HEADERS]) >= 0;
  });

  const relatedByName = studentSheetCandidates.find((name) => normalizeSheetKey(name).includes(normalizedClass));
  if (relatedByName) return relatedByName;

  const prefixCandidate = studentSheetCandidates.find((name) => {
    const key = normalizeSheetKey(name);
    return key.startsWith(normalizeSheetKey(STUDENT_SHEET_PREFIX)) || key.startsWith(normalizeSheetKey(LEGACY_STUDENT_SHEET_PREFIX));
  });
  return prefixCandidate;
}

function findClassSheetName(workbook: XLSX.WorkBook) {
  const exactClassSheet = getSheetNameByIdentity(workbook, CLASS_SHEET);
  if (exactClassSheet) return exactClassSheet;

  return workbook.SheetNames.find((name) => {
    const key = normalizeSheetKey(name);
    if (key === normalizeSheetKey(GUIDE_SHEET) || key === normalizeSheetKey(SUMMARY_SHEET)) return false;
    const rows = sheetToRows(workbook.Sheets[name]);
    return findHeaderRowIndex(rows, [CLASS_NAME_HEADERS, CLASS_KKM_HEADERS]) >= 0;
  });
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
  sheet["!cols"] = [{ wch: 15 }, { wch: 25 }, { wch: 86 }];
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:C1");
  sheet["!rows"] = Array.from({ length: range.e.r + 1 }, (_, index) => {
    if (index === 0) return { hpt: 30 };
    const content = [0, 1, 2]
      .map((col) => sheet[XLSX.utils.encode_cell({ r: index, c: col })]?.v)
      .filter(Boolean)
      .join(" ");
    if (!content) return { hpt: 8 };
    return { hpt: estimateWrappedRowHeight(content, 92, 22, 15) };
  });
  mergeRange(sheet, "A1:C1");
  mergeRange(sheet, "A2:C2");
  styleCell(sheet, "A1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.blue } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.white }, sz: 16 },
    alignment: { horizontal: "center", vertical: "center" },
  });
  styleRange(sheet, "A1:C1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.blue } },
    border: { bottom: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } } },
  });
  styleCell(sheet, "A2", {
    font: { color: { rgb: TEMPLATE_COLORS.muted }, italic: true },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
  });
  styleRange(sheet, `A3:C${range.e.r + 1}`, {
    alignment: { vertical: "top", wrapText: true },
    border: { bottom: { style: "thin", color: { rgb: "E2E8F0" } } },
  });

  for (let row = 2; row <= range.e.r; row += 1) {
    const firstCell = normalizeImportText(sheet[XLSX.utils.encode_cell({ r: row, c: 0 })]?.v);
    if (/^\d+\./.test(firstCell) || firstCell === "Aturan penting" || firstCell === "Catatan saat cek data") {
      styleRange(sheet, `A${row + 1}:C${row + 1}`, {
        fill: { fgColor: { rgb: TEMPLATE_COLORS.blueSoft } },
        font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
        alignment: { vertical: "center", wrapText: true },
      });
    }
    if (["Topik", "Langkah", "Kolom", "Jenis"].includes(firstCell)) {
      styleRange(sheet, `A${row + 1}:C${row + 1}`, {
        fill: { fgColor: { rgb: TEMPLATE_COLORS.skySoft } },
        font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
        alignment: { horizontal: "center", vertical: "center", wrapText: true },
      });
    }
  }
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
    ["PANDUAN PENGGUNAAN TEMPLATE IMPORT KELAS & DATA MURID SIPENA", "", ""],
    ["Gunakan file ini untuk menambahkan banyak kelas dan banyak murid sekaligus. Isi bagian yang diperlukan, lalu upload kembali ke SIPENA.", "", ""],
    ["", "", ""],
    ["1. RINGKASAN FUNGSI FILE", "", ""],
    ["Topik", "Bagian", "Penjelasan"],
    ["Tujuan template", "Import kelas dan murid", "File ini membaca data dasar: nama kelas, KKM kelas, deskripsi kelas, nama murid, dan NISN."],
    ["Yang perlu diisi", "Sheet Kelas", "Isi satu baris untuk setiap kelas yang ingin ditambahkan atau dipakai ulang."],
    ["Yang perlu diisi", "Sheet Kelas - ...", "Isi daftar murid di sheet kelas yang sesuai. Contoh: kelas VA memakai sheet Kelas - VA."],
    ["Yang tidak perlu diubah", "Panduan dan Ringkasan", "Sheet ini hanya membantu membaca template. Jangan dihapus agar pengguna lain tetap mendapat panduan."],
    ["", "", ""],
    ["2. LANGKAH PENGISIAN CEPAT", "", ""],
    ["Langkah", "Yang dilakukan", "Keterangan"],
    ["1", "Buka sheet Kelas.", "Isi Nama Kelas, KKM Kelas, Deskripsi bila perlu, dan Nama Sheet Kelas."],
    ["2", "Buka sheet murid yang sesuai.", "Jika kolom Nama Sheet Kelas berisi Kelas - VA, isi murid di sheet Kelas - VA."],
    ["3", "Isi data murid.", "Kolom No boleh kosong. Nama Siswa dan NISN wajib diisi."],
    ["4", "Tambah kelas baru bila perlu.", "Duplikasi sheet Kelas - VA, ubah nama sheet, lalu tulis nama sheet tersebut di sheet Kelas."],
    ["5", "Upload ke SIPENA.", "Pada langkah Cek Data, centang kelas yang ingin dimasukkan dan baca catatan merah atau kuning."],
    ["", "", ""],
    ["3. ATURAN PENTING", "", ""],
    ["Kolom", "Batas", "Keterangan"],
    ["Nama Kelas", "Wajib, maksimal 50 karakter", "Contoh: VA, VI-B, Kelas VIIA - SMPN 1."],
    ["KKM Kelas", "Wajib angka 0 sampai 100", "Contoh: 70, 75, 80."],
    ["Deskripsi", "Opsional, maksimal 500 karakter", "Gunakan untuk catatan singkat tentang kelas."],
    ["Nama Sheet Kelas", "Disarankan", "SIPENA mengenali nama sheet dengan fleksibel, tetapi kolom ini membantu menghindari salah baca."],
    ["Nama Siswa", "Wajib", "Tulis nama murid sesuai data sekolah."],
    ["NISN", "Wajib, maksimal 17 karakter", "Jika kurang dari 10 karakter, SIPENA akan memberi peringatan agar dicek ulang."],
    ["", "", ""],
    ["4. CATATAN SAAT CEK DATA", "", ""],
    ["Jenis", "Arti", "Yang perlu dilakukan"],
    ["Merah", "Data belum aman disimpan.", "Perbaiki file Excel, lalu upload ulang."],
    ["Kuning", "Data bisa disimpan tetapi perlu dicek.", "Baca catatan, lalu lanjutkan hanya jika data sudah benar."],
    ["Duplikat", "SIPENA mencegah data dobel.", "Kelas existing dipakai ulang. Murid dengan nama dan NISN sama akan dilewati."],
    ["", "", ""],
    ["5. CHECKLIST SEBELUM UPLOAD", "", ""],
    ["1", "Sheet Kelas masih ada.", "Nama header boleh tanpa tanda *, tetapi jangan mengubah arti kolom."],
    ["2", "Setiap kelas punya Nama Kelas dan KKM Kelas.", "Nama kelas maksimal 50 karakter."],
    ["3", "Setiap sheet kelas punya header Nama Siswa dan NISN.", "Header boleh memakai tanda * atau tidak."],
    ["4", "Nama sheet kelas sesuai isi kolom Nama Sheet Kelas.", "Jika berbeda, SIPENA tetap mencoba mengenali dari nama kelas dan header murid."],
    ["5", "File disimpan sebagai .xlsx.", "Upload file ini kembali lewat dialog Import Kelas & Siswa."],
  ], [15, 25, 86]);
  applyGuideSheetStyle(guideSheet);

  XLSX.utils.book_append_sheet(workbook, guideSheet, GUIDE_SHEET);

  const summarySheet = makeSheet([
      ["RINGKASAN TEMPLATE IMPORT KELAS & DATA MURID SIPENA", "", "", "", ""],
      ["Sheet ini hanya ringkasan contoh. SIPENA membaca data utama dari sheet Kelas dan sheet Kelas - ...", "", "", "", ""],
      ["", "", "", "", ""],
      ["Total Kelas", 2, "", "Total Murid", 5],
      ["", "", "", "", ""],
      ["Cara membaca", "Setiap baris di bawah mewakili satu sheet kelas.", "", "", ""],
      ["Jika menambah kelas, tambahkan baris di sheet Kelas dan buat sheet kelas baru.", "", "", "", ""],
      ["", "", "", "", ""],
      ["Nama Sheet Kelas", "Nama Kelas", "Jumlah Murid", "Status", "Catatan"],
      ["Kelas - VA", "VA", 3, "Contoh", "Contoh sheet murid untuk kelas VA."],
      ["Kelas - VB", "VB", 2, "Contoh", "Contoh sheet murid untuk kelas VB."],
    ], [24, 24, 14, 16, 58]);
  mergeRange(summarySheet, "A1:E1");
  mergeRange(summarySheet, "A2:E2");
  mergeRange(summarySheet, "A6:E6");
  mergeRange(summarySheet, "A7:E7");
  styleRange(summarySheet, "A1:E1", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.green } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.white }, sz: 14 },
    alignment: { horizontal: "center", vertical: "center" },
  });
  styleRange(summarySheet, "A9:E11", {
    alignment: { vertical: "center", wrapText: true },
    border: {
      top: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      bottom: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      left: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
      right: { style: "thin", color: { rgb: TEMPLATE_COLORS.border } },
    },
  });
  styleRange(summarySheet, "A9:E9", {
    fill: { fgColor: { rgb: TEMPLATE_COLORS.greenSoft } },
    font: { bold: true, color: { rgb: TEMPLATE_COLORS.slate } },
    alignment: { horizontal: "center", vertical: "center" },
  });
  XLSX.utils.book_append_sheet(workbook, summarySheet, SUMMARY_SHEET);

  const classSheet = makeSheet([
      ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Nama Sheet Kelas"],
      ["VA", 75, "Kelas contoh untuk import data dasar.", "Kelas - VA"],
      ["VB", 70, "Kelas kedua dengan sheet kelas terpisah.", "Kelas - VB"],
    ], [24, 15, 58, 28]);
  applyTableSheetStyle(classSheet, "A1:D3", ["Nama Kelas", "KKM Kelas"]);
  styleRange(classSheet, "C2:C3", { alignment: { vertical: "top", wrapText: true } });
  XLSX.utils.book_append_sheet(workbook, classSheet, CLASS_SHEET);

  const viiASheet = makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Ahmad Fauzi", "0012345678"],
      [2, "Siti Rahma", "0012345679"],
      [3, "Citra Dewi", "0012345680"],
    ], [10, 38, 24]);
  applyTableSheetStyle(viiASheet, "A1:C4", ["Nama Siswa", "NISN"]);
  XLSX.utils.book_append_sheet(workbook, viiASheet, "Kelas - VA");

  const viiBSheet = makeSheet([
      ["No", "Nama Siswa *", "NISN *"],
      [1, "Budi Santoso", "0012345681"],
      [2, "Dewi Lestari", "0012345682"],
    ], [10, 38, 24]);
  applyTableSheetStyle(viiBSheet, "A1:C3", ["Nama Siswa", "NISN"]);
  XLSX.utils.book_append_sheet(workbook, viiBSheet, "Kelas - VB");

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
  const issues: ImportIssue[] = [];
  const headerRowIndex = findHeaderRowIndex(rows, [STUDENT_NAME_HEADERS, STUDENT_NISN_HEADERS]);
  if (headerRowIndex < 0) {
    return {
      students: [] as ParsedImportStudent[],
      issues: [issue("error", sheetName, "Header siswa wajib memuat Nama Siswa dan NISN.")],
    };
  }

  const header = rows[headerRowIndex] ?? [];
  const headerMap = buildHeaderMap(header);
  const parsed: ParsedImportStudent[] = [];
  const seenNisn = new Map<string, number>();
  const seenName = new Map<string, { rowNumber: number; nisn: string }>();
  const existingByNisn = new Map(existingStudents.filter((student) => student.nisn).map((student) => [normalizeImportIdentity(student.nisn), student]));
  const existingByName = new Map(existingStudents.map((student) => [normalizeImportIdentity(student.name), student]));

  rows.slice(headerRowIndex + 1).forEach((row, index) => {
    const rowNumber = headerRowIndex + index + 2;
    const name = getCell(row, headerMap, STUDENT_NAME_HEADERS);
    const nisn = getCell(row, headerMap, STUDENT_NISN_HEADERS);
    const no = getCell(row, headerMap, STUDENT_ORDER_HEADERS);
    const orderNumber = no ? Number(no) : null;
    const rowIssues: ImportIssue[] = [];

    if (!name && !nisn) return;

    if (!name) rowIssues.push(issue("error", sheetName, "Nama siswa wajib diisi.", rowNumber));
    if (!nisn) {
      rowIssues.push(issue("error", sheetName, "NISN wajib diisi.", rowNumber));
    } else if (nisn.length > STUDENT_IMPORT_MAX_NISN_LENGTH) {
      rowIssues.push(issue("error", sheetName, `NISN maksimal ${STUDENT_IMPORT_MAX_NISN_LENGTH} karakter.`, rowNumber));
    } else if (nisn.length < STUDENT_IMPORT_WARN_NISN_MIN_LENGTH) {
      rowIssues.push(issue("warning", sheetName, `NISN kurang dari ${STUDENT_IMPORT_WARN_NISN_MIN_LENGTH} karakter. Periksa kembali jika ini bukan nomor internal.`, rowNumber));
    }

    if (orderNumber !== null && (!Number.isFinite(orderNumber) || orderNumber < 1)) {
      rowIssues.push(issue("warning", sheetName, "Nomor urut tidak valid dan akan diabaikan.", rowNumber));
    }

    const normalizedName = normalizeImportIdentity(name);
    const normalizedNisn = normalizeImportIdentity(nisn);
    const existingSameNisn = normalizedNisn ? existingByNisn.get(normalizedNisn) : undefined;
    const existingSameName = normalizedName ? existingByName.get(normalizedName) : undefined;
    const seenNisnRow = normalizedNisn ? seenNisn.get(normalizedNisn) : undefined;
    const seenNameRow = normalizedName ? seenName.get(normalizedName) : undefined;

    let status: StudentImportStatus = rowIssues.some((item) => item.severity === "error") ? "invalid" : "new";

    if (seenNisnRow !== undefined && status !== "invalid") {
      rowIssues.push(issue("error", sheetName, `NISN sama dengan baris ${seenNisnRow}.`, rowNumber));
      status = "blocked-nisn-conflict";
    }

    if (seenNameRow && seenNameRow.nisn !== nisn && status !== "invalid" && status !== "blocked-nisn-conflict") {
      rowIssues.push(issue("warning", sheetName, `Nama sama dengan baris ${seenNameRow.rowNumber}, tetapi NISN berbeda.`, rowNumber));
      status = "warning-name-conflict";
    }

    if (existingSameNisn && normalizeImportIdentity(existingSameNisn.name) !== normalizedName && status !== "invalid") {
      rowIssues.push(issue("error", sheetName, `NISN sudah dipakai oleh "${existingSameNisn.name}" di kelas ini.`, rowNumber));
      status = "blocked-nisn-conflict";
    } else if (existingSameName && normalizeImportIdentity(existingSameName.nisn) !== normalizedNisn && status === "new") {
      rowIssues.push(issue("warning", sheetName, `Nama sama dengan siswa existing "${existingSameName.name}", tetapi NISN berbeda.`, rowNumber));
      status = "warning-name-conflict";
    } else if (existingSameName && normalizeImportIdentity(existingSameName.nisn) === normalizedNisn && status === "new") {
      rowIssues.push(issue("info", sheetName, "Siswa sudah ada dan akan dilewati.", rowNumber));
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
      issues: rowIssues,
    });
  });

  return { students: parsed, issues };
}

export function buildClassStudentImportPlan(
  workbook: XLSX.WorkBook,
  existingClasses: ExistingClassForImport[],
): ClassStudentImportPlan {
  const allIssues: ImportIssue[] = [];
  const classes: ParsedImportClass[] = [];
  const classSheetName = findClassSheetName(workbook) ?? CLASS_SHEET;
  const classSheet = workbook.Sheets[classSheetName];
  const classRows = sheetToRows(classSheet);
  const existingClassMap = new Map(existingClasses.map((item) => [normalizeImportIdentity(item.name), item]));
  const seenClassNames = new Set<string>();

  const classHeaderRowIndex = findHeaderRowIndex(classRows, [CLASS_NAME_HEADERS, CLASS_KKM_HEADERS]);

  if (!classSheet || classHeaderRowIndex < 0) {
    allIssues.push(issue("error", CLASS_SHEET, "Sheet Kelas wajib ada dan minimal berisi satu kelas."));
  } else {
    const headerMap = buildHeaderMap(classRows[classHeaderRowIndex]);

    classRows.slice(classHeaderRowIndex + 1).forEach((row, index) => {
      const rowNumber = classHeaderRowIndex + index + 2;
      const classIssues: ImportIssue[] = [];
      const name = getCell(row, headerMap, CLASS_NAME_HEADERS);
      const kkmRaw = getCell(row, headerMap, CLASS_KKM_HEADERS);
      const description = getCell(row, headerMap, CLASS_DESCRIPTION_HEADERS);
      const requestedSheet = getCell(row, headerMap, CLASS_STUDENT_SHEET_HEADERS);

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
      const resolvedSheetName = findStudentSheet(workbook, name, requestedSheet);
      const studentRows = resolvedSheetName ? sheetToRows(workbook.Sheets[resolvedSheetName]) : [];
      if (!resolvedSheetName) {
        classIssues.push(issue("warning", CLASS_SHEET, `Sheet siswa "${expectedSheet}" tidak ditemukan. Kelas tetap dapat dibuat tanpa siswa.`, rowNumber));
      }

      const parsedStudents = resolvedSheetName
        ? parseStudentRows(resolvedSheetName, studentRows, existingClass?.students ?? [])
        : { students: [] as ParsedImportStudent[], issues: [] as ImportIssue[] };
      classIssues.push(...parsedStudents.issues);

      classes.push({
        rowNumber,
        name,
        normalizedName,
        classKkm: Number.isFinite(classKkm) ? classKkm : 0,
        description,
        sheetName: resolvedSheetName ?? expectedSheet,
        existingClassId: existingClass?.id ?? null,
        students: parsedStudents.students,
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

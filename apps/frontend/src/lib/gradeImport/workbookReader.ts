import * as XLSX from "xlsx";

export type WorkbookCell = string | number | null;

export type WorkbookReadErrorCode =
  | "IMPORT_FILE_EMPTY"
  | "IMPORT_UNSUPPORTED_FILE_TYPE"
  | "IMPORT_WORKBOOK_READ_FAILED"
  | "IMPORT_NO_VALID_SHEET"
  | "IMPORT_SHEET_EMPTY";

export type WorkbookFileType = "xlsx" | "xls" | "csv";

export interface WorkbookReadError {
  code: WorkbookReadErrorCode;
  message: string;
  details?: string;
}

export interface WorkbookSheetData {
  name: string;
  rows: WorkbookCell[][];
  rowCount: number;
  columnCount: number;
  isEmpty: boolean;
}

export type WorkbookReadResult =
  | {
      ok: true;
      fileName: string;
      fileType: WorkbookFileType;
      sheetNames: string[];
      sheets: WorkbookSheetData[];
      warnings: WorkbookReadError[];
    }
  | {
      ok: false;
      fileName: string;
      fileType?: WorkbookFileType;
      sheetNames: string[];
      sheets: WorkbookSheetData[];
      warnings: WorkbookReadError[];
      error: WorkbookReadError;
    };

function error(code: WorkbookReadErrorCode, message: string, details?: string): WorkbookReadError {
  return { code, message, details };
}

function getFileType(fileName: string): WorkbookFileType | null {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".xlsx")) return "xlsx";
  if (lowerName.endsWith(".xls")) return "xls";
  if (lowerName.endsWith(".csv")) return "csv";
  return null;
}

function normalizeCell(value: unknown): WorkbookCell {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : String(value);
  if (typeof value === "string") return value;
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function normalizeRows(rows: unknown[][]): WorkbookCell[][] {
  return rows.map((row) => {
    const normalized = row.map(normalizeCell);
    let lastMeaningfulIndex = normalized.length - 1;
    while (lastMeaningfulIndex >= 0 && normalized[lastMeaningfulIndex] === null) {
      lastMeaningfulIndex -= 1;
    }
    return normalized.slice(0, lastMeaningfulIndex + 1);
  });
}

function readSheets(workbook: XLSX.WorkBook): WorkbookSheetData[] {
  return workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name];
    const rawRows = sheet
      ? XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          raw: true,
          defval: null,
          blankrows: false,
        })
      : [];
    const rows = normalizeRows(rawRows).filter((row) => row.some((cell) => cell !== null));
    const columnCount = rows.reduce((max, row) => Math.max(max, row.length), 0);

    return {
      name,
      rows,
      rowCount: rows.length,
      columnCount,
      isEmpty: rows.length === 0,
    };
  });
}

function buildReadResult(fileName: string, fileType: WorkbookFileType | undefined, workbook: XLSX.WorkBook): WorkbookReadResult {
  const sheetNames = [...workbook.SheetNames];
  const sheets = readSheets(workbook);
  const nonEmptySheets = sheets.filter((sheet) => !sheet.isEmpty);
  const warnings = sheets
    .filter((sheet) => sheet.isEmpty)
    .map((sheet) => error("IMPORT_SHEET_EMPTY", `Sheet ${sheet.name} kosong.`, sheet.name));

  if (sheetNames.length === 0) {
    return {
      ok: false,
      fileName,
      fileType,
      sheetNames,
      sheets,
      warnings,
      error: error("IMPORT_NO_VALID_SHEET", "Workbook tidak memiliki sheet yang valid."),
    };
  }

  if (nonEmptySheets.length === 0) {
    return {
      ok: false,
      fileName,
      fileType,
      sheetNames,
      sheets,
      warnings,
      error: error("IMPORT_SHEET_EMPTY", "Semua sheet di workbook kosong."),
    };
  }

  return {
    ok: true,
    fileName,
    fileType: fileType || "xlsx",
    sheetNames,
    sheets,
    warnings,
  };
}

export function readWorkbookBuffer(buffer: ArrayBuffer, fileName = "workbook.xlsx"): WorkbookReadResult {
  const fileType = getFileType(fileName);
  const sheetNames: string[] = [];
  const sheets: WorkbookSheetData[] = [];
  const warnings: WorkbookReadError[] = [];

  if (buffer.byteLength === 0) {
    return {
      ok: false,
      fileName,
      fileType: fileType || undefined,
      sheetNames,
      sheets,
      warnings,
      error: error("IMPORT_FILE_EMPTY", "File kosong dan tidak bisa dibaca."),
    };
  }

  if (!fileType) {
    return {
      ok: false,
      fileName,
      sheetNames,
      sheets,
      warnings,
      error: error("IMPORT_UNSUPPORTED_FILE_TYPE", "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv."),
    };
  }

  try {
    const workbook = fileType === "csv"
      ? XLSX.read(new TextDecoder("utf-8").decode(buffer), { type: "string", raw: true })
      : XLSX.read(buffer, { type: "array", raw: true, cellDates: false });
    return buildReadResult(fileName, fileType, workbook);
  } catch (caught) {
    const details = caught instanceof Error ? caught.message : String(caught);
    return {
      ok: false,
      fileName,
      fileType,
      sheetNames,
      sheets,
      warnings,
      error: error("IMPORT_WORKBOOK_READ_FAILED", "Workbook gagal dibaca.", details),
    };
  }
}

export async function readWorkbookFile(file: File): Promise<WorkbookReadResult> {
  if (!file || file.size === 0) {
    return {
      ok: false,
      fileName: file?.name || "",
      fileType: file?.name ? getFileType(file.name) || undefined : undefined,
      sheetNames: [],
      sheets: [],
      warnings: [],
      error: error("IMPORT_FILE_EMPTY", "File kosong dan tidak bisa dibaca."),
    };
  }

  return readWorkbookBuffer(await file.arrayBuffer(), file.name);
}

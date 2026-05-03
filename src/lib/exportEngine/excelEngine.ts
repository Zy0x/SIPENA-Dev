import * as XLSX from "xlsx-js-style";
import { getSignatureRowsExcel } from "@/lib/exportSignature";
import type { ExportConfig } from "@/lib/reportExportLayout";
import { getExportFileBaseName, getExportMetaGroups, getExportTitle } from "@/lib/exportEngine/shared";

type Sheet = XLSX.WorkSheet & {
  "!freeze"?: { xSplit?: number; ySplit?: number };
  "!autofilter"?: { ref: string };
};

const BORDER = {
  top: { style: "thin", color: { rgb: "CBD5E1" } },
  right: { style: "thin", color: { rgb: "CBD5E1" } },
  bottom: { style: "thin", color: { rgb: "CBD5E1" } },
  left: { style: "thin", color: { rgb: "CBD5E1" } },
};

const COLORS = {
  title: "1D4ED8",
  header: "2563EB",
  headerAlt: "0F766E",
  final: "7C3AED",
  subHeader: "DBEAFE",
  zebra: "F8FAFC",
  summary: "EFF6FF",
  muted: "F1F5F9",
  pass: "DCFCE7",
  warning: "FEF3C7",
  fail: "FEE2E2",
};

function cellRef(row: number, column: number) {
  return XLSX.utils.encode_cell({ r: row, c: column });
}

function ensureCell(ws: Sheet, row: number, column: number, value: string | number = "") {
  const ref = cellRef(row, column);
  if (!ws[ref]) ws[ref] = { t: typeof value === "number" ? "n" : "s", v: value };
  return ws[ref] as XLSX.CellObject & { s?: XLSX.CellStyle };
}

function applyStyle(ws: Sheet, row: number, column: number, style: XLSX.CellStyle) {
  const cell = ensureCell(ws, row, column);
  cell.s = { ...(cell.s || {}), ...style };
}

function styleRange(ws: Sheet, startRow: number, endRow: number, startCol: number, endCol: number, styleFactory: (row: number, col: number) => XLSX.CellStyle) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      applyStyle(ws, row, col, styleFactory(row, col));
    }
  }
}

function columnWidth(column: ExportConfig["columns"][number]) {
  if (column.type === "index") return { wch: 6 };
  if (column.type === "name") return { wch: 30 };
  if (column.type === "nisn") return { wch: 16 };
  if (column.type === "status") return { wch: 16 };
  if (column.type === "assignment") return { wch: 13 };
  return { wch: 12 };
}

function getHeaderFill(label: string, type?: string) {
  if (/rekap|akhir|rapor|rata/i.test(label) || type === "final" || type === "status") return COLORS.final;
  if (/semester 2/i.test(label)) return COLORS.headerAlt;
  return COLORS.header;
}

function getBodyFill(value: unknown, rowIndex: number, columnType: string) {
  const text = String(value ?? "").toLowerCase();
  if (columnType === "status") {
    if (text.includes("lulus") && !text.includes("belum")) return COLORS.pass;
    if (text.includes("cukup")) return COLORS.warning;
    if (text.includes("belum")) return COLORS.fail;
  }
  return rowIndex % 2 === 0 ? "FFFFFF" : COLORS.zebra;
}

function buildHeaderRows(config: ExportConfig) {
  const fixedColumnTypes = new Set(["index", "name", "nisn"]);
  const rows: (string | number)[][] = [];
  const merges: XLSX.Range[] = [];

  if (config.headerGroups.length > 1) {
    const level1Row: (string | number)[] = [];
    const level2Row: (string | number)[] = config.columns.map((column) => fixedColumnTypes.has(column.type) ? "" : column.label);
    let colIndex = 0;

    config.headerGroups.forEach((group) => {
      const groupColumns = config.columns.slice(colIndex, colIndex + group.colSpan);
      const allFixed = groupColumns.every((column) => fixedColumnTypes.has(column.type));
      if (allFixed) {
        groupColumns.forEach((column, offset) => {
          level1Row.push(column.label);
          merges.push({ s: { r: 0, c: colIndex + offset }, e: { r: 1, c: colIndex + offset } });
        });
      } else {
        level1Row.push(group.label);
        for (let index = 1; index < group.colSpan; index += 1) level1Row.push("");
        if (group.colSpan > 1) {
          merges.push({ s: { r: 0, c: colIndex }, e: { r: 0, c: colIndex + group.colSpan - 1 } });
        }
      }
      colIndex += group.colSpan;
    });

    rows.push(level1Row, level2Row);
  } else {
    rows.push(config.columns.map((column) => column.label));
  }

  return { rows, merges };
}

function applySummarySheetStyle(ws: Sheet, rowCount: number) {
  ws["!cols"] = [{ wch: 24 }, { wch: 44 }, { wch: 22 }, { wch: 22 }];
  ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }];
  styleRange(ws, 0, rowCount - 1, 0, 3, (row) => ({
    border: row === 1 ? undefined : BORDER,
    alignment: { vertical: "center", horizontal: row === 0 ? "center" : "left", wrapText: true },
    font: { bold: row === 0 || row === 2 || row === 10, color: { rgb: row === 0 ? "FFFFFF" : "0F172A" }, sz: row === 0 ? 16 : 11 },
    fill: row === 0
      ? { fgColor: { rgb: COLORS.title } }
      : row === 2 || row === 10
        ? { fgColor: { rgb: COLORS.summary } }
        : undefined,
  }));
}

function applyDataSheetStyle(ws: Sheet, config: ExportConfig, headerRowCount: number, dataStartRow: number, dataEndRow: number) {
  const lastCol = Math.max(0, config.columns.length - 1);
  const lastRow = dataEndRow;
  ws["!cols"] = config.columns.map(columnWidth);
  ws["!freeze"] = { xSplit: Math.min(3, config.columns.length), ySplit: headerRowCount };
  ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRowCount - 1, c: 0 }, e: { r: Math.max(headerRowCount - 1, dataEndRow), c: lastCol } }) };

  styleRange(ws, 0, headerRowCount - 1, 0, lastCol, (row, col) => {
    const column = config.columns[col];
    const value = ensureCell(ws, row, col).v;
    const fill = row === 0 && headerRowCount > 1
      ? getHeaderFill(String(value || column?.label || ""), column?.type)
      : COLORS.subHeader;
    return {
      border: BORDER,
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      font: { bold: true, color: { rgb: fill === COLORS.subHeader ? "1E3A8A" : "FFFFFF" }, sz: row === 0 ? 11 : 10 },
      fill: { fgColor: { rgb: fill } },
    };
  });

  styleRange(ws, dataStartRow, lastRow, 0, lastCol, (row, col) => {
    const column = config.columns[col];
    const cell = ensureCell(ws, row, col);
    const horizontal = column?.type === "name" ? "left" : "center";
    const value = cell.v;
    return {
      border: BORDER,
      alignment: { horizontal, vertical: "center", wrapText: column?.type === "name" },
      font: { color: { rgb: "0F172A" }, sz: 10 },
      fill: { fgColor: { rgb: getBodyFill(value, row - dataStartRow, column?.type || "") } },
    };
  });
}

export function exportToExcel(config: ExportConfig): void {
  const wb = XLSX.utils.book_new();
  const metaGroups = getExportMetaGroups(config);
  const summaryData: (string | number)[][] = [
    [getExportTitle(config), "", "", ""],
    ["", "", "", ""],
    ["Informasi Dokumen", "", "", ""],
  ];

  metaGroups.forEach((group) => {
    group.items.forEach((item) => {
      summaryData.push([`${item.label}:`, item.value, "", ""]);
    });
  });

  summaryData.push(["", "", "", ""]);
  summaryData.push(["Statistik", "", "", ""]);
  summaryData.push(["Jumlah Siswa:", config.studentCount, "Jumlah BAB:", config.chapterCount]);
  summaryData.push(["Jumlah Tugas:", config.assignmentCount, "KKM:", config.kkm]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData) as Sheet;
  applySummarySheetStyle(wsSummary, summaryData.length);
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  const { rows: headerRows, merges } = buildHeaderRows(config);
  const sheetData: (string | number)[][] = [...headerRows];
  config.data.forEach((row) => {
    sheetData.push(config.columns.map((column) => row[column.key] ?? ""));
  });

  if (config.includeSignature && config.signature) {
    sheetData.push(...getSignatureRowsExcel(config.signature, config.columns.length));
  }

  const wsData = XLSX.utils.aoa_to_sheet(sheetData) as Sheet;
  wsData["!merges"] = merges;
  const headerRowCount = headerRows.length;
  const dataStartRow = headerRowCount;
  const dataEndRow = Math.max(dataStartRow, headerRowCount + config.data.length - 1);
  applyDataSheetStyle(wsData, config, headerRowCount, dataStartRow, dataEndRow);

  XLSX.utils.book_append_sheet(wb, wsData, "Data");
  XLSX.writeFile(wb, `${getExportFileBaseName(config)}.xlsx`);
}

import * as XLSX from "xlsx";
import { getSignatureRowsExcel } from "@/lib/exportSignature";
import type { ExportConfig } from "@/lib/reportExportLayout";
import { getExportFileBaseName, getExportMetaGroups, getExportTitle } from "@/lib/exportEngine/shared";

export function exportToExcel(config: ExportConfig): void {
  const wb = XLSX.utils.book_new();
  const metaGroups = getExportMetaGroups(config);
  const summaryData: (string | number)[][] = [
    [getExportTitle(config)],
    [""],
    ["Informasi Dokumen"],
  ];

  metaGroups.forEach((group) => {
    group.items.forEach((item) => {
      summaryData.push([`${item.label}:`, item.value]);
    });
  });

  summaryData.push([""]);
  summaryData.push(["Statistik"]);
  summaryData.push(["Jumlah Siswa:", config.studentCount]);
  summaryData.push(["Jumlah BAB:", config.chapterCount]);
  summaryData.push(["Jumlah Tugas:", config.assignmentCount]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary["!cols"] = [{ wch: 22 }, { wch: 42 }];
  if (wsSummary["A1"]) {
    wsSummary["A1"].s = { font: { bold: true, sz: 16 } };
  }
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

  const sheetData: (string | number)[][] = [];
  const fixedColumnTypes = new Set(["index", "name", "nisn"]);

  if (config.headerGroups.length > 1) {
    const level1Row: (string | number)[] = [];
    let cursor = 0;
    config.headerGroups.forEach((group) => {
      const groupColumns = config.columns.slice(cursor, cursor + group.colSpan);
      const allFixed = groupColumns.every((column) => fixedColumnTypes.has(column.type));
      if (allFixed) {
        groupColumns.forEach((column) => level1Row.push(column.label));
      } else {
        level1Row.push(group.label);
        for (let index = 1; index < group.colSpan; index += 1) {
          level1Row.push("");
        }
      }
      cursor += group.colSpan;
    });
    sheetData.push(level1Row);
  }

  sheetData.push(config.columns.map((column) => column.label));
  config.data.forEach((row) => {
    sheetData.push(config.columns.map((column) => row[column.key] ?? ""));
  });

  if (config.includeSignature && config.signature) {
    const signatureRows = getSignatureRowsExcel(config.signature, config.columns.length);
    signatureRows.forEach((row) => sheetData.push(row));
  }

  const wsData = XLSX.utils.aoa_to_sheet(sheetData);
  wsData["!cols"] = config.columns.map((column) => {
    if (column.type === "name") return { wch: 26 };
    if (column.type === "nisn") return { wch: 16 };
    if (column.type === "status") return { wch: 16 };
    return { wch: 14 };
  });

  XLSX.utils.book_append_sheet(wb, wsData, "Data");
  XLSX.writeFile(wb, `${getExportFileBaseName(config)}.xlsx`);
}

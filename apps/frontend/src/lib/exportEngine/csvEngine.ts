import { getSignatureRowsCSV } from "@/lib/exportSignature";
import type { ExportConfig } from "@/lib/reportExportLayout";
import { getExportFileBaseName, getExportMetaGroups, getExportTitle } from "@/lib/exportEngine/shared";

export function exportToCSV(config: ExportConfig): void {
  const rows: string[][] = [];
  rows.push([getExportTitle(config)]);
  getExportMetaGroups(config).forEach((group) => {
    group.items.forEach((item) => rows.push([`${item.label}:`, String(item.value)]));
  });
  rows.push(["Jumlah Siswa:", String(config.studentCount), "Jumlah BAB:", String(config.chapterCount), "Jumlah Tugas:", String(config.assignmentCount)]);
  rows.push([]);

  if (config.headerGroups.length > 1) {
    const level1Row: string[] = [];
    config.headerGroups.forEach((group) => {
      level1Row.push(group.label);
      for (let index = 1; index < group.colSpan; index += 1) {
        level1Row.push("");
      }
    });
    rows.push(level1Row);
  }

  rows.push(config.columns.map((column) => column.label));

  config.data.forEach((row) => {
    rows.push(config.columns.map((column) => {
      const value = row[column.key];
      if (value === undefined || value === null) return "";
      return String(value);
    }));
  });

  if (config.includeSignature && config.signature) {
    const signatureRows = getSignatureRowsCSV(config.signature, config.columns.length);
    signatureRows.forEach((row) => rows.push(row));
  }

  const csvContent = rows
    .map((row) => row.map((cell) => {
      if (cell.includes(",") || cell.includes("\"") || cell.includes("\n")) {
        return `"${cell.replace(/"/g, "\"\"")}"`;
      }
      return cell;
    }).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${getExportFileBaseName(config)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

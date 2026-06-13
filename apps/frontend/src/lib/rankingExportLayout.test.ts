import { describe, expect, it } from "vitest";

import type { ExportColumn, ExportConfig } from "./reportExportLayout";
import { buildReportLayoutPlanV2, getColumnBodyAlignment, getColumnHeaderAlignment } from "./reportExportLayoutV2";
import { pdfEffectiveFontSize } from "./exportEngine/sharedMetrics";
import {
  buildCompactRankingDocumentStyle,
  createDefaultRankingDocumentStyle,
} from "./rankingExportLayout";

function buildRankingColumns(subjectCount: number): ExportColumn[] {
  return [
    { key: "Peringkat", label: "Peringkat", type: "index" },
    { key: "Nama", label: "Nama Siswa", type: "name" },
    { key: "NISN", label: "NISN", type: "nisn" },
    ...Array.from({ length: subjectCount }, (_, index) => ({
      key: `Mapel ${index + 1}`,
      label: `Mapel ${index + 1}`,
      type: "assignment",
    })),
    { key: "Rata-rata", label: "Rata-rata Keseluruhan", type: "grandAvg" },
    { key: "Status", label: "Status", type: "status" },
  ];
}

function buildRows(columns: ExportColumn[], names = ["Siti Aminah"]) {
  return names.map((name) => Object.fromEntries(columns.map((column) => [
    column.key,
    column.type === "name" ? name : column.type === "nisn" ? "0012345678" : column.type === "status" ? "Belum Lulus" : 88,
  ])));
}

function buildConfig(
  columns: ExportColumn[],
  documentStyle = createDefaultRankingDocumentStyle(),
  data: Record<string, string | number>[] = buildRows(columns),
): ExportConfig {
  return {
    className: "IX A",
    subjectName: "Ranking Keseluruhan",
    kkm: 75,
    periodLabel: "Ranking Tahunan / Semua Semester",
    isCombinedView: true,
    columns,
    headerGroups: [{ label: "Ranking Keseluruhan", colSpan: columns.length }],
    chapterGroups: [],
    data,
    dateStr: "13/06/2026",
    studentCount: 1,
    chapterCount: 0,
    assignmentCount: columns.length - 5,
    paperSize: "a4",
    documentStyle,
  };
}

describe("ranking export layout", () => {
  it("centers NISN body alignment by default", () => {
    const style = createDefaultRankingDocumentStyle();
    const nisnColumn: ExportColumn = { key: "NISN", label: "NISN", type: "nisn" };

    expect(getColumnBodyAlignment(style, nisnColumn)).toBe("center");
    expect(pdfEffectiveFontSize(style.tableHeaderFontSize)).toBeGreaterThanOrEqual(11);
    expect(pdfEffectiveFontSize(style.tableBodyFontSize)).toBeGreaterThanOrEqual(11);
  });

  it("keeps all overall ranking columns in one A4 segment with the compact style", () => {
    const columns = buildRankingColumns(18);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4", buildRows(columns));
    const plan = buildReportLayoutPlanV2(buildConfig(columns, documentStyle));

    expect(plan.pages[0]?.columns).toHaveLength(columns.length);
    expect(new Set(plan.pages.map((page) => page.segmentNumber))).toEqual(new Set([1]));
    expect(plan.columnWidthsMm.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(
      plan.metrics.pageWidthMm - plan.metrics.marginLeftMm - plan.metrics.marginRightMm,
    );
  });

  it("fits a small ranking table to the printable page margins", () => {
    const columns = buildRankingColumns(7);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4", buildRows(columns));
    const plan = buildReportLayoutPlanV2(buildConfig(columns, documentStyle));
    const usedWidth = plan.pages[0]?.columnWidthsMm.reduce((sum, width) => sum + width, 0) ?? 0;
    const usableWidth = plan.metrics.pageWidthMm - plan.metrics.marginLeftMm - plan.metrics.marginRightMm;

    expect(plan.documentStyle.tableSizing.mode).toBe("fixed");
    expect(usedWidth).toBeGreaterThanOrEqual(usableWidth - 0.01);
    expect(usedWidth).toBeLessThanOrEqual(usableWidth + 0.01);
  });

  it("keeps the name column compact enough to wrap long names", () => {
    const columns = buildRankingColumns(7);
    const data = buildRows(columns, [
      "Siti Aminah",
      "Nama Siswa Sangat Panjang Untuk Menguji Pembungkusan",
    ]);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4", data);
    const nameWidth = documentStyle.columnFontOverrides.Nama?.widthMm;

    expect(nameWidth).toBeLessThanOrEqual(24);
    expect(documentStyle.tableSizing.bodyRowHeightMm).toBeGreaterThanOrEqual(8.3);
    expect(documentStyle.tableSizing.bodyRowHeightMm).toBeLessThanOrEqual(9.8);
    expect(pdfEffectiveFontSize(documentStyle.tableBodyFontSize)).toBeGreaterThanOrEqual(11);
  });

  it("keeps non-name ranking cells centered in the compact layout", () => {
    const columns = buildRankingColumns(3);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4", buildRows(columns));
    const nisnColumn = columns.find((column) => column.type === "nisn");
    const statusColumn = columns.find((column) => column.type === "status");
    const gradeColumn = columns.find((column) => column.type === "assignment");

    expect(nisnColumn && getColumnBodyAlignment(documentStyle, nisnColumn)).toBe("center");
    expect(statusColumn && getColumnBodyAlignment(documentStyle, statusColumn)).toBe("center");
    expect(statusColumn && getColumnHeaderAlignment(documentStyle, statusColumn)).toBe("center");
    expect(gradeColumn && getColumnBodyAlignment(documentStyle, gradeColumn)).toBe("center");
  });
});

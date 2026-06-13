import { describe, expect, it } from "vitest";

import type { ExportColumn, ExportConfig } from "./reportExportLayout";
import { buildReportLayoutPlanV2, getColumnBodyAlignment } from "./reportExportLayoutV2";
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

function buildConfig(columns: ExportColumn[], documentStyle = createDefaultRankingDocumentStyle()): ExportConfig {
  return {
    className: "IX A",
    subjectName: "Ranking Keseluruhan",
    kkm: 75,
    periodLabel: "Ranking Tahunan / Semua Semester",
    isCombinedView: true,
    columns,
    headerGroups: [{ label: "Ranking Keseluruhan", colSpan: columns.length }],
    chapterGroups: [],
    data: [
      Object.fromEntries(columns.map((column) => [
        column.key,
        column.type === "name" ? "Siti Aminah" : column.type === "nisn" ? "0012345678" : column.type === "status" ? "Lulus" : 88,
      ])),
    ],
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
    expect(style.tableHeaderFontSize).toBeGreaterThan(9);
    expect(style.tableBodyFontSize).toBeGreaterThan(9);
  });

  it("keeps all overall ranking columns in one A4 segment with the compact style", () => {
    const columns = buildRankingColumns(18);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4");
    const plan = buildReportLayoutPlanV2(buildConfig(columns, documentStyle));

    expect(plan.pages[0]?.columns).toHaveLength(columns.length);
    expect(new Set(plan.pages.map((page) => page.segmentNumber))).toEqual(new Set([1]));
    expect(plan.columnWidthsMm.reduce((sum, width) => sum + width, 0)).toBeLessThanOrEqual(
      plan.metrics.pageWidthMm - plan.metrics.marginLeftMm - plan.metrics.marginRightMm,
    );
  });

  it("does not stretch a small ranking table to the full page width", () => {
    const columns = buildRankingColumns(7);
    const documentStyle = buildCompactRankingDocumentStyle(createDefaultRankingDocumentStyle(), columns, "a4");
    const plan = buildReportLayoutPlanV2(buildConfig(columns, documentStyle));
    const usedWidth = plan.pages[0]?.columnWidthsMm.reduce((sum, width) => sum + width, 0) ?? 0;
    const usableWidth = plan.metrics.pageWidthMm - plan.metrics.marginLeftMm - plan.metrics.marginRightMm;

    expect(plan.documentStyle.tableSizing.mode).toBe("autofit-content");
    expect(usedWidth).toBeLessThan(usableWidth * 0.75);
  });
});

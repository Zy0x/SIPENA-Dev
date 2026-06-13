import { describe, expect, it } from "vitest";

import type { ExportConfig } from "../reportExportLayout";
import { buildReportPdfDocumentResult } from "./pdfEngine";

function buildRankingConfig(rowCount = 8): ExportConfig {
  const columns = [
    { key: "Peringkat", label: "Rank", type: "index" },
    { key: "Nama", label: "Nama Siswa", type: "name" },
    { key: "NISN", label: "NISN", type: "nisn" },
    { key: "Rata-rata", label: "Rata-rata", type: "grandAvg" },
    { key: "Status", label: "Status", type: "status" },
  ];

  return {
    className: "VA",
    subjectName: "Ranking Keseluruhan",
    kkm: 75,
    periodLabel: "Semester 2",
    isCombinedView: true,
    columns,
    headerGroups: [{ label: "Ranking Keseluruhan", colSpan: columns.length }],
    chapterGroups: [],
    data: Array.from({ length: rowCount }, (_, index) => ({
      Peringkat: index + 1,
      Nama: `Siswa ${index + 1}`,
      NISN: `0012345678${index}`,
      "Rata-rata": 88,
      Status: "Lulus",
    })),
    dateStr: "13/06/2026",
    studentCount: rowCount,
    chapterCount: 0,
    assignmentCount: 0,
    includeSignature: true,
    signature: {
      city: "Banjarmasin",
      fontSize: 10,
      placementMode: "adaptive",
      signaturePreset: "bottom-right",
      signatureAlignment: "right",
      signers: [{
        name: "Ali Ridho",
        title: "Guru Kelas",
        nip: "2210118210013",
      }],
    },
    paperSize: "a4",
    documentStyle: {
      titleFontSize: 16,
      metaFontSize: 10,
      tableHeaderFontSize: 11,
      tableBodyFontSize: 11,
      layoutPreset: "compact",
      tableSizing: {
        mode: "fixed",
        bodyRowHeightMm: 8,
        headerRowHeightMm: 9,
      },
      columnFontOverrides: {
        Peringkat: { widthMm: 16, bodyAlignment: "center", headerAlignment: "center" },
        Nama: { widthMm: 45 },
        NISN: { widthMm: 35, bodyAlignment: "center", headerAlignment: "center" },
        "Rata-rata": { widthMm: 28, bodyAlignment: "center", headerAlignment: "center" },
        Status: { widthMm: 30, bodyAlignment: "center", headerAlignment: "center" },
      },
    },
  };
}

describe("report PDF engine", () => {
  it("anchors default signature directly after the rendered ranking table", () => {
    const built = buildReportPdfDocumentResult(buildRankingConfig());
    const finalY = (built.doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY;

    expect(finalY).toBeTypeOf("number");
    expect(built.signaturePlacement).not.toBeNull();
    expect(built.signaturePlacement?.pageIndex).toBe(0);
    expect(built.signaturePlacement?.safeZone.safeYMm).toBeCloseTo(
      finalY! + built.layoutPlan.metrics.signatureGapMm,
      1,
    );
    expect(built.signaturePlacement?.yMm).toBeCloseTo(
      finalY! + built.layoutPlan.metrics.signatureGapMm + 3,
      1,
    );
  });
});

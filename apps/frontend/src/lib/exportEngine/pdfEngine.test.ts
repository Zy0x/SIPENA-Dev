import { describe, expect, it } from "vitest";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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

function buildWideRankingConfig(rowCount = 29): ExportConfig {
  const columns = [
    { key: "Peringkat", label: "Rank", type: "index" },
    { key: "Nama", label: "Nama Siswa", type: "name" },
    { key: "NISN", label: "NISN", type: "nisn" },
    { key: "B. Indo", label: "B. Indo", type: "assignment" },
    { key: "IPAS", label: "IPAS", type: "assignment" },
    { key: "MTK", label: "MTK", type: "assignment" },
    { key: "PPKn", label: "PPKn", type: "assignment" },
    { key: "PJOK", label: "PJOK", type: "assignment" },
    { key: "Rata-rata", label: "Rata-rata", type: "grandAvg" },
    { key: "Status", label: "Status", type: "status" },
  ];

  return {
    ...buildRankingConfig(rowCount),
    columns,
    headerGroups: [{ label: "Ranking Keseluruhan", colSpan: columns.length }],
    data: Array.from({ length: rowCount }, (_, index) => ({
      Peringkat: index + 1,
      Nama: `Siswa Panjang ${index + 1} Tambahan`,
      NISN: `0012345678${index}`,
      "B. Indo": 89,
      IPAS: 96,
      MTK: 97,
      PPKn: 99,
      PJOK: 90,
      "Rata-rata": 88,
      Status: "Lulus",
    })),
    documentStyle: {
      ...buildRankingConfig(rowCount).documentStyle!,
      tableHeaderFontSize: 13,
      tableBodyFontSize: 13,
      tableSizing: {
        mode: "fixed",
        bodyRowHeightMm: 6.7,
        headerRowHeightMm: 10.4,
      },
      columnFontOverrides: {
        Peringkat: { widthMm: 8, bodyAlignment: "center", headerAlignment: "center" },
        Nama: { widthMm: 24, bodyAlignment: "left", headerAlignment: "center" },
        NISN: { widthMm: 18, bodyAlignment: "center", headerAlignment: "center" },
        "B. Indo": { widthMm: 10.75, bodyAlignment: "center", headerAlignment: "center" },
        IPAS: { widthMm: 10.75, bodyAlignment: "center", headerAlignment: "center" },
        MTK: { widthMm: 10.75, bodyAlignment: "center", headerAlignment: "center" },
        PPKn: { widthMm: 10.75, bodyAlignment: "center", headerAlignment: "center" },
        PJOK: { widthMm: 10.75, bodyAlignment: "center", headerAlignment: "center" },
        "Rata-rata": { widthMm: 17, bodyAlignment: "center", headerAlignment: "center" },
        Status: { widthMm: 20, bodyAlignment: "center", headerAlignment: "center" },
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

  it("starts long ranking tables on the first PDF page", async () => {
    const built = buildReportPdfDocumentResult(buildRankingConfig(60));
    const pdf = await getDocument({ data: built.doc.output("arraybuffer") }).promise;

    try {
      expect(pdf.numPages).toBeGreaterThan(1);
      const firstPage = await pdf.getPage(1);
      const textContent = await firstPage.getTextContent();
      const firstPageText = textContent.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");

      expect(firstPageText).toContain("Siswa 1");
      expect(firstPageText).toContain("Lulus");
    } finally {
      await pdf.destroy();
    }
  });

  it("avoids sparse intermediate pages for compact wide ranking tables", async () => {
    const built = buildReportPdfDocumentResult(buildWideRankingConfig(29));
    const pdf = await getDocument({ data: built.doc.output("arraybuffer") }).promise;

    try {
      const rowCounts: number[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ");
        rowCounts.push((pageText.match(/Siswa Panjang \d+/g) || []).length);
      }

      expect(rowCounts[0]).toBeGreaterThan(0);
      for (let index = 1; index < rowCounts.length - 1; index += 1) {
        expect(rowCounts[index]).toBeGreaterThanOrEqual(6);
      }
    } finally {
      await pdf.destroy();
    }
  });
});

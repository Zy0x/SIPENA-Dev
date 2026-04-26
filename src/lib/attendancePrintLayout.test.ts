import { describe, expect, it } from "vitest";
import { resolveReportPaperSize } from "@/lib/reportExportLayoutV2";
import { computeAttendanceColumnLayout } from "@/lib/attendanceExport";
import { buildAttendancePdfDocument } from "@/lib/attendancePdfExport";
import { clampSignaturePlacementMm, convertPreviewDeltaPxToMm, resolveFixedSignaturePositionState, resolveManualSignaturePercents } from "@/lib/attendancePdfPreview";
import {
  buildAttendancePrintLayoutPlan,
  formatAttendancePercent,
  getAttendanceInlineAnnotationStackedSegments,
  getAttendanceRekapLabel,
  resolveAttendanceInlineAnnotationLayout,
  type AttendancePrintDataset,
} from "@/lib/attendancePrintLayout";
import type { AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";

function createDataset(overrides?: Partial<AttendancePrintDataset>): AttendancePrintDataset {
  return {
    className: "X IPA 1",
    monthLabel: "April 2026",
    exportTimeLabel: "21 Apr 2026 10:00",
    workDayFormatLabel: "6 Hari",
    effectiveDays: 24,
    rows: [
      {
        id: "s-1",
        number: 1,
        name: "Nama Siswa Sangat Panjang Sekali Untuk Menguji Pembungkusan Baris Secara Aman Dengan Tambahan Kata Yang Sangat Banyak Agar Tinggi Baris Bertambah Dinamis",
        nisn: "123456789012345",
        cells: Array.from({ length: 30 }, () => ({ value: "H", isHoliday: false, hasEvent: false })),
        totals: { H: 24, S: 0, I: 0, A: 0, D: 0, total: 0 },
      },
      {
        id: "s-2",
        number: 2,
        name: "Nama Pendek",
        nisn: "9876543210",
        cells: Array.from({ length: 30 }, (_, index) => ({ value: index % 7 === 0 ? "S" : "H", isHoliday: false, hasEvent: false })),
        totals: { H: 20, S: 4, I: 0, A: 0, D: 0, total: 4 },
      },
    ],
    days: Array.from({ length: 30 }, (_, index) => ({
      key: `2026-04-${String(index + 1).padStart(2, "0")}`,
      dayName: ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][index % 7],
      dateLabel: String(index + 1),
      isHoliday: false,
      hasEvent: false,
    })),
    notes: [],
    holidayItems: [],
    eventItems: [],
    ...overrides,
  };
}

function createHolidayItems(count: number, wordsPerItem = 6): AttendanceHolidayInputItem[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-04-${String((index % 28) + 1).padStart(2, "0")}`,
    dayNumber: (index % 28) + 1,
    description: `Agenda ${index + 1} ${"keterangan panjang ".repeat(wordsPerItem).trim()}`,
    source: index % 3 === 0 ? "event" : index % 2 === 0 ? "national" : "custom",
  }));
}

describe("attendance print layout", () => {
  it("formats percentages with Indonesian decimal rules", () => {
    expect(formatAttendancePercent(0, 100)).toBe("0%");
    expect(formatAttendancePercent(125, 1000)).toBe("12,5%");
    expect(formatAttendancePercent(1257, 10000)).toBe("12,6%");
    expect(formatAttendancePercent(500, 1000)).toBe("50%");
  });

  it("uses the correct rekap header labels", () => {
    expect(getAttendanceRekapLabel("H")).toBe("H");
    expect(getAttendanceRekapLabel("total")).toBe("Jml");
  });

  it("expands NISN width while keeping recap columns compact", () => {
    const layout = computeAttendanceColumnLayout({
      rows: [
        { name: "Nama Siswa", nisn: "123456789012345" },
        { name: "Nama Kedua", nisn: "998877665544332" },
      ],
      visibleDayCount: 30,
      visibleRekapCount: 6,
      availableWidthMm: 283,
      includeNo: true,
      includeName: true,
      includeNisn: true,
      minNameWidthMm: 42,
      minNisnWidthMm: 14.5,
      minRekapWidthMm: 5.5,
      minDayWidthMm: 5.2,
      maxNisnWidthMm: 24,
      maxRekapWidthMm: 6.2,
    });

    expect(layout.nisnWidthMm).toBeGreaterThanOrEqual(14.5);
    expect(layout.rekapWidthMm).toBeLessThanOrEqual(6.2);
    expect(layout.dayWidthMm).toBeGreaterThan(4.5);
  });

  it("keeps table width aligned and increases row height for long names", () => {
    const dataset = createDataset();
    const plan = buildAttendancePrintLayoutPlan({
      data: dataset,
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
    });

    expect(plan.table.tableWidthMm).toBeLessThanOrEqual(plan.paper.contentWidthMm);
    expect(plan.debug.planner.tableRightSlackMm).toBeLessThanOrEqual(0.6);
    expect(plan.rowHeightsMm[0]).toBeGreaterThan(plan.rowHeightsMm[1]);
    expect(plan.pages[0]?.rowEnd).toBeGreaterThan(0);
    expect(plan.summaryRows.percentageByKey.H).toBe("91,7%");
  });

  it("uses exact A4, F4, auto A4, and dynamic full-page paper sizes", () => {
    const a4 = resolveReportPaperSize("a4", { orientation: "landscape" });
    const f4 = resolveReportPaperSize("f4", { orientation: "landscape" });
    const auto = resolveReportPaperSize("auto", { orientation: "landscape", requiredContentWidthMm: 420 });
    const fullPage = resolveReportPaperSize("full-page", {
      orientation: "landscape",
      requiredContentWidthMm: 420,
      requiredContentHeightMm: 360,
    });

    expect(a4.pageWidthMm).toBe(297);
    expect(a4.pageHeightMm).toBe(210);
    expect(f4.pageWidthMm).toBeCloseTo(330.2, 1);
    expect(f4.pageHeightMm).toBeCloseTo(215.9, 1);
    expect(auto.pageWidthMm).toBe(297);
    expect(auto.pageHeightMm).toBe(210);
    expect(fullPage.pageWidthMm).toBe(420);
    expect(fullPage.pageHeightMm).toBe(360);
  });

  it("builds a single dynamic page in full-page mode", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        rows: Array.from({ length: 42 }, (_, index) => ({
          id: `s-${index + 1}`,
          number: index + 1,
          name: `Siswa ${index + 1} Dengan Nama Yang Cukup Panjang Untuk Menguji Tinggi Halaman Dinamis`,
          nisn: `1234567890${String(index).padStart(5, "0")}`,
          cells: Array.from({ length: 30 }, (_, dayIndex) => ({
            value: dayIndex % 6 === 0 ? "S" : "H",
            isHoliday: false,
            hasEvent: false,
          })),
          totals: { H: 20, S: 4, I: 0, A: 0, D: 0, total: 4 },
        })),
        holidayItems: createHolidayItems(10, 12),
        eventItems: createHolidayItems(6, 10),
        notes: ["Catatan pertama yang cukup panjang untuk menguji tinggi konten halaman penuh."],
      }),
      paperSize: "full-page",
      includeSignature: true,
      signature: {
        city: "Bandung",
        signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
        useCustomDate: false,
        customDate: null,
        fontSize: 10,
        showSignatureLine: true,
        signatureLineWidth: 50,
        signatureSpacing: 20,
        signatureAlignment: "right",
        signatureOffsetX: 0,
        signatureOffsetY: 0,
        placementMode: "adaptive",
        signaturePreset: "bottom-right",
        manualXPercent: null,
        manualYPercent: null,
        snapToGrid: true,
        gridSizeMm: 5,
        lockSignaturePosition: false,
        showDebugGuides: false,
        signaturePageIndex: null,
      },
      forceSinglePage: false,
    });

    expect(plan.pages).toHaveLength(1);
    expect(plan.pages[0]?.kind).toBe("table");
    expect(plan.pages[0]?.drawSignatureHere).toBe(true);
    expect(plan.summaryLayout.continuationPageCount).toBe(0);
    expect(plan.paper.pageHeightMm).toBeGreaterThan(210);
  });

  it("keeps short keterangan on the table page without continuation", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        holidayItems: createHolidayItems(2, 3),
        eventItems: [],
      }),
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
    });

    expect(plan.summaryLayout.continuationPageCount).toBe(0);
    expect(plan.pages.some((page) => page.kind === "summary-continuation")).toBe(false);
    expect(plan.pages[plan.pages.length - 1]?.summaryContent?.keteranganItems.length).toBe(plan.summary.keterangan.length);
    expect(plan.summaryLayout.keteranganFontPt).toBe(10);
  });

  it("shrinks keterangan font before creating a continuation page", () => {
    const signatureConfig = {
      city: "Bandung",
      signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
      useCustomDate: false,
      customDate: null,
      fontSize: 10,
      showSignatureLine: true,
      signatureLineWidth: 50,
      signatureSpacing: 20,
      signatureAlignment: "right" as const,
      signatureOffsetX: 0,
      signatureOffsetY: 0,
      placementMode: "adaptive" as const,
      signaturePreset: "bottom-right" as const,
      manualXPercent: null,
      manualYPercent: null,
      snapToGrid: true,
      gridSizeMm: 5,
      lockSignaturePosition: false,
      showDebugGuides: false,
      signaturePageIndex: null,
    };
    let plan = buildAttendancePrintLayoutPlan({
      data: createDataset(),
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
    });
    for (const includeSignature of [false, true]) {
      for (const holidayCount of [6, 8, 10, 12, 14, 16]) {
        for (const wordSize of [10, 12, 14, 16, 18, 20, 22]) {
          const candidate = buildAttendancePrintLayoutPlan({
            data: createDataset({
              holidayItems: createHolidayItems(holidayCount, wordSize),
              eventItems: createHolidayItems(Math.max(1, Math.floor(holidayCount / 3)), Math.max(8, wordSize - 2)),
            }),
            paperSize: "a4",
            includeSignature,
            signature: includeSignature ? signatureConfig : null,
            forceSinglePage: false,
          });
          if (candidate.summaryLayout.continuationPageCount === 0 && candidate.summaryLayout.keteranganFontPt < 10) {
            plan = candidate;
            break;
          }
        }
        if (plan.summaryLayout.continuationPageCount === 0 && plan.summaryLayout.keteranganFontPt < 10) break;
      }
      if (plan.summaryLayout.continuationPageCount === 0 && plan.summaryLayout.keteranganFontPt < 10) break;
    }

    expect(plan.summaryLayout.continuationPageCount).toBe(0);
    expect(plan.summaryLayout.keteranganFontPt).toBeLessThan(10);
    expect(plan.summaryLayout.keteranganFontPt).toBeGreaterThanOrEqual(9.1);
  });

  it("moves overflowing keterangan into continuation pages without losing items", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        holidayItems: createHolidayItems(18, 24),
        eventItems: createHolidayItems(12, 20),
      }),
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
    });

    const continuationPages = plan.pages.filter((page) => page.kind === "summary-continuation");
    const distributedItems = plan.pages.flatMap((page) => page.summaryContent?.keteranganItems ?? []);

    expect(continuationPages.length).toBeGreaterThan(0);
    expect(distributedItems).toHaveLength(plan.summary.keterangan.length);
    expect(new Set(distributedItems).size).toBe(plan.summary.keterangan.length);
  });

  it("keeps signature on the final summary page when keterangan continues", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        holidayItems: createHolidayItems(18, 24),
        eventItems: createHolidayItems(12, 20),
      }),
      paperSize: "a4",
      includeSignature: true,
      signature: {
        city: "Bandung",
        signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
        useCustomDate: false,
        customDate: null,
        fontSize: 10,
        showSignatureLine: true,
        signatureLineWidth: 50,
        signatureSpacing: 20,
        signatureAlignment: "right",
        signatureOffsetX: 0,
        signatureOffsetY: 0,
        placementMode: "adaptive",
        signaturePreset: "bottom-right",
        manualXPercent: null,
        manualYPercent: null,
        snapToGrid: true,
        gridSizeMm: 5,
        lockSignaturePosition: false,
        showDebugGuides: false,
        signaturePageIndex: null,
      },
      forceSinglePage: false,
    });

    const signaturePages = plan.pages.filter((page) => page.drawSignatureHere);
    expect(signaturePages).toHaveLength(1);
    expect(signaturePages[0]?.pageNumber).toBe(plan.pages[plan.pages.length - 1]?.pageNumber);
    expect(plan.signaturePlacement?.pageIndex).toBe((signaturePages[0]?.pageNumber ?? 1) - 1);
  });

  it("adds Sunday inline annotations when no explicit holiday item covers the day", () => {
    const days = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(`2026-04-${String(index + 1).padStart(2, "0")}T00:00:00`);
      return {
        key: `2026-04-${String(index + 1).padStart(2, "0")}`,
        dayName: ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"][day.getDay()],
        dateLabel: String(index + 1),
        isHoliday: day.getDay() === 0,
        hasEvent: false,
      };
    });
    const rows = createDataset().rows.map((row) => ({
      ...row,
      cells: days.map((day) => ({ value: day.isHoliday ? "L" : "H", isHoliday: day.isHoliday, hasEvent: false })),
      totals: { H: 6, S: 0, I: 0, A: 0, D: 0, total: 0 },
    }));
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        days,
        rows,
        holidayItems: [],
        eventItems: [],
      }),
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
      annotationDisplayMode: "inline-vertical",
      inlineLabelStyle: "rotate-90",
    });

    expect(plan.inlineAnnotations.some((annotation) => annotation.text === "Hari Minggu" && annotation.startDay === 5)).toBe(true);
  });

  it("keeps special activities in summary when only holiday labels are inline", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset({
        holidayItems: [{ date: "2026-04-05", dayNumber: 5, description: "Libur Nasional" }],
        eventItems: [{ date: "2026-04-12", dayNumber: 12, description: "Hari Raya" }],
      }),
      paperSize: "a4",
      includeSignature: false,
      forceSinglePage: false,
      annotationDisplayMode: "inline-vertical",
      eventAnnotationDisplayMode: "summary-card",
      inlineLabelStyle: "rotate-90",
    });

    expect(plan.inlineAnnotations.some((annotation) => annotation.text === "Libur Nasional")).toBe(true);
    expect(plan.inlineAnnotations.some((annotation) => annotation.text === "Hari Raya")).toBe(false);
    expect(plan.summary.keterangan.some((item) => item.text.includes("Hari Raya"))).toBe(true);
  });

  it("converts spaces and symbols in stacked inline annotations into readable word gaps", () => {
    const layout = resolveAttendanceInlineAnnotationLayout({
      text: "Wafat Isa Al-Masih",
      labelStyle: "stacked",
      widthMm: 6,
      heightMm: 90,
    });
    const segments = getAttendanceInlineAnnotationStackedSegments("Wafat Isa Al-Masih");

    expect(layout.stackedChars.includes(" ")).toBe(false);
    expect(segments.some((segment) => segment.kind === "gap")).toBe(true);
    expect(layout.text).toContain("\n");
    expect(layout.gapLineHeightPx).toBeGreaterThan(0);
    expect(layout.fontPx).toBeGreaterThan(8);
  });

  it("resolves rotate-90 labels as a rotated cell box, not just raw text rotation", () => {
    const layout = resolveAttendanceInlineAnnotationLayout({
      text: "Hari Raya",
      labelStyle: "rotate-90",
      widthMm: 7,
      heightMm: 96,
    });

    expect(layout.rotateBoxWidthPx).toBeDefined();
    expect(layout.rotateBoxHeightPx).toBeDefined();
    expect(layout.rotateBoxWidthPx).toBeGreaterThan(layout.rotateBoxHeightPx ?? 0);
    expect(layout.text).toBe("Hari Raya");
  });

  it("builds pdf documents with the same page count as the layout plan", () => {
    const dataset = createDataset({
      rows: Array.from({ length: 28 }, (_, index) => ({
        id: `s-${index + 1}`,
        number: index + 1,
        name: index === 2
          ? "Nama Sangat Panjang Untuk Memaksa Tinggi Baris Membesar Dan Mendorong Planner Ke Multi Halaman Dengan Aman"
          : `Siswa ${index + 1}`,
        nisn: `1234567890${String(index).padStart(5, "0")}`,
        cells: Array.from({ length: 30 }, (_, dayIndex) => ({
          value: dayIndex % 9 === 0 ? "S" : "H",
          isHoliday: false,
          hasEvent: false,
        })),
        totals: { H: 24, S: 4, I: 0, A: 0, D: 0, total: 4 },
      })),
    });
    const plan = buildAttendancePrintLayoutPlan({
      data: dataset,
      paperSize: "a4",
      includeSignature: true,
      signature: {
        city: "Bandung",
        signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
        useCustomDate: false,
        customDate: null,
        fontSize: 10,
        showSignatureLine: true,
        signatureLineWidth: 50,
        signatureSpacing: 20,
        signatureAlignment: "right",
        signatureOffsetX: 0,
        signatureOffsetY: 0,
        placementMode: "adaptive",
        signaturePreset: "bottom-right",
        manualXPercent: null,
        manualYPercent: null,
        snapToGrid: true,
        gridSizeMm: 5,
        lockSignaturePosition: false,
        showDebugGuides: false,
        signaturePageIndex: null,
      },
      forceSinglePage: false,
    });

    const built = buildAttendancePdfDocument({
      data: dataset,
      plan,
      includeSignature: true,
      signature: {
        city: "Bandung",
        signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
        useCustomDate: false,
        customDate: null,
        fontSize: 10,
        showSignatureLine: true,
        signatureLineWidth: 50,
        signatureSpacing: 20,
        signatureAlignment: "right",
        signatureOffsetX: 0,
        signatureOffsetY: 0,
        placementMode: "adaptive",
        signaturePreset: "bottom-right",
        manualXPercent: null,
        manualYPercent: null,
        snapToGrid: true,
        gridSizeMm: 5,
        lockSignaturePosition: false,
        showDebugGuides: false,
        signaturePageIndex: null,
      },
    });

    expect(built.pageCount).toBe(plan.pages.length);
    expect(built.runtimeEntries).toHaveLength(plan.pages.length);
  });

  it("converts drag delta to mm consistently across zoomed preview widths", () => {
    const pageWidthMm = 297;
    expect(convertPreviewDeltaPxToMm(50, 1122.5196850393702, pageWidthMm)).toBeCloseTo(13.23, 2);
    expect(convertPreviewDeltaPxToMm(50, 561.2598425196851, pageWidthMm)).toBeCloseTo(26.46, 2);
    expect(convertPreviewDeltaPxToMm(50, 1683.7795275590552, pageWidthMm)).toBeCloseTo(8.82, 2);
    expect(convertPreviewDeltaPxToMm(50, 2245.0393700787404, pageWidthMm)).toBeCloseTo(6.61, 2);
  });

  it("resolves manual signature percents from clamped preview drag positions", () => {
    const plan = buildAttendancePrintLayoutPlan({
      data: createDataset(),
      paperSize: "a4",
      includeSignature: true,
      signature: {
        city: "Bandung",
        signers: [{ id: "1", name: "Guru", title: "Guru Mata Pelajaran", nip: "", school_name: "" }],
        useCustomDate: false,
        customDate: null,
        fontSize: 10,
        showSignatureLine: true,
        signatureLineWidth: 50,
        signatureSpacing: 20,
        signatureAlignment: "right",
        signatureOffsetX: 0,
        signatureOffsetY: 0,
        placementMode: "adaptive",
        signaturePreset: "bottom-right",
        manualXPercent: null,
        manualYPercent: null,
        snapToGrid: true,
        gridSizeMm: 5,
        lockSignaturePosition: false,
        showDebugGuides: false,
        signaturePageIndex: null,
      },
      forceSinglePage: false,
    });

    expect(plan.signaturePlacement).not.toBeNull();
    const placement = plan.signaturePlacement!;
    const clamped = clampSignaturePlacementMm({
      placement,
      xMm: placement.xMm + 11.3,
      yMm: placement.yMm + 7.2,
      snapToGrid: true,
      gridSizeMm: 5,
    });
    const manual = resolveManualSignaturePercents({
      placement,
      xMm: clamped.xMm,
      yMm: clamped.yMm,
    });

    expect(manual.manualXPercent).toBeGreaterThanOrEqual(0);
    expect(manual.manualYPercent).toBeGreaterThanOrEqual(0);
    expect(manual.manualXPercent).toBeLessThanOrEqual(100);
    expect(manual.manualYPercent).toBeLessThanOrEqual(100);

    const fixed = resolveFixedSignaturePositionState({
      placement,
      xMm: clamped.xMm,
      yMm: clamped.yMm,
      snapToGrid: true,
      gridSizeMm: 5,
    });

    expect(fixed.placementMode).toBe("fixed");
    expect(fixed.signatureOffsetX).toBe(0);
    expect(fixed.signatureOffsetY).toBe(0);
    expect(fixed.manualXPercent).toBeGreaterThanOrEqual(0);
    expect(fixed.manualYPercent).toBeGreaterThanOrEqual(0);
  });
});

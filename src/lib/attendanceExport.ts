/**
 * attendancePrintLayout.ts
 * ─────────────────────────────────────────────────────────────────
 * SINGLE source of truth for attendance print layout.
 * Ensures: preview ≡ print ≡ raster capture (PDF / PNG)
 *
 * Key design goals
 * ────────────────
 * 1. ALL 31 day-columns + fixed columns MUST fit in ONE page width.
 *    Day column width is computed dynamically, never hardcoded.
 * 2. Row count per page is computed from actual page height minus
 *    header / summary / signature footprint.
 * 3. forceSinglePage shrinks font & row height further to fit all
 *    students on one sheet while keeping text readable (min 5pt).
 * 4. Every px value derives from mm via PX_PER_MM so preview is
 *    pixel-perfect with PDF output.
 */

import {
  getNaturalColumnWidthMmV2,
  resolveDocumentStyle,
  type ReportDocumentStyle,
} from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import type { AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";

// ─── Re-export shared metrics for callers ──────────────────────────────────
export { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";

// ─── Paper definitions (mm) ────────────────────────────────────────────────
const PAPER: Record<ReportPaperSize, { w: number; h: number }> = {
  a4: { w: 297, h: 210 },   // landscape A4
  f4: { w: 330, h: 215 },   // landscape F4
  auto: { w: 0, h: 210 },   // width computed dynamically
};

const MARGIN = { top: 10, right: 8, bottom: 10, left: 8 } as const;
const FOOTER_HEIGHT_MM = 6;
const BANNER_HEIGHT_MM = 14;
const META_BAR_HEIGHT_MM = 7;
const LEGEND_HEIGHT_MM = 6;
const SUMMARY_BASE_MM = 8; // base height for legend + events/holidays/notes blocks
const SIGNATURE_HEIGHT_MM = 40;
const HEADER_ROWS = 2; // day-name row + date row

// Fixed column widths (mm)
const COL_NO_MM = 7;
const COL_NAME_MM = 38;
const COL_NISN_MM = 22;
const COL_REKAP_MM = 8; // H S I A D
const COL_TOTAL_MM = 10;

const REKAP_KEYS = ["H", "S", "I", "A", "D", "total"] as const;
export type RekapKey = (typeof REKAP_KEYS)[number];

interface ComputeAttendanceColumnLayoutArgs {
  rows: Array<{ name: string; nisn?: string | null }>;
  visibleDayCount: number;
  visibleRekapCount: number;
  availableWidthMm: number;
  includeNo: boolean;
  includeName: boolean;
  includeNisn: boolean;
  documentStyle?: Partial<ReportDocumentStyle>;
  minNameWidthMm?: number;
  minNisnWidthMm?: number;
  minRekapWidthMm?: number;
  minDayWidthMm?: number;
  maxNameWidthMm?: number;
  maxNisnWidthMm?: number;
  maxRekapWidthMm?: number;
  rightSafetyMm?: number;
}

interface AttendanceColumnLayout {
  noWidthMm: number;
  nameWidthMm: number;
  nisnWidthMm: number;
  dayWidthMm: number;
  rekapWidthMm: number;
}

// ─── Public types ──────────────────────────────────────────────────────────

export interface AttendancePrintRow {
  id: string;
  number: number;
  name: string;
  nisn: string;
  cells: Array<{ value: string; isHoliday: boolean; hasEvent: boolean }>;
  totals: Record<RekapKey, number>;
}

export interface AttendanceDayColumn {
  key: string;
  dayName: string;
  dateLabel: string;
  isHoliday: boolean;
  hasEvent: boolean;
}

export interface AttendancePrintDataset {
  className: string;
  monthLabel: string;
  exportTimeLabel: string;
  workDayFormatLabel: string;
  effectiveDays: number;
  rows: AttendancePrintRow[];
  days: AttendanceDayColumn[];
  notes: string[];
  holidayItems: AttendanceHolidayInputItem[];
  eventItems: AttendanceHolidayInputItem[];
}

export interface AttendancePrintPage {
  key: string;
  pageNumber: number;
  rowStart: number;
  rowEnd: number;   // exclusive
  isLastPage: boolean;
  showSummary: boolean;
}

export interface AttendancePrintLayoutPlan {
  /** Paper dimensions used for rendering */
  paper: {
    pageWidthMm: number;
    pageHeightMm: number;
    marginTopMm: number;
    marginRightMm: number;
    marginBottomMm: number;
    marginLeftMm: number;
  };
  table: {
    /** pt — use * 1.25 for px in preview */
    headerFontPt: number;
    bodyFontPt: number;
    metaFontPt: number;
    titleFontPt: number;
    headerRowHeightMm: number;
    bodyRowHeightMm: number;
    bodyCellPaddingMm: number;
    noWidthMm: number;
    nameWidthMm: number;
    nisnWidthMm: number;
    dayWidthMm: number;   // DYNAMIC — computed to fill page
    rekapWidthMm: number;
  };
  fit: {
    mode: "normal" | "compact" | "micro";
    scale: number; // 1.0 = normal
  };
  pages: AttendancePrintPage[];
  rows: AttendancePrintRow[];
  visibleDays: AttendanceDayColumn[];
  visibleColumnKeys: Set<string>;
  visibleRekapKeys: RekapKey[];
  totals: Record<RekapKey, number>;
  summary: {
    legend: Array<{ label: string; description: string; bg: string; color: string }>;
    events: string[];
    holidays: string[];
    notes: string[];
  };
}

function estimateNameWidthMm(rows: Array<{ name: string }>, style?: Partial<ReportDocumentStyle>) {
  const longestNameLength = rows.reduce((max, row) => Math.max(max, row.name.trim().length), 0);
  const naturalWidth = getNaturalColumnWidthMmV2({ key: "name", label: "Nama Siswa", type: "name" }, style);
  const extraWidth = Math.min(16, Math.max(0, longestNameLength - 18) * 0.45);
  return naturalWidth + extraWidth;
}

function estimateNisnWidthMm(rows: Array<{ nisn?: string | null }>, style?: Partial<ReportDocumentStyle>) {
  const resolvedStyle = resolveDocumentStyle(style);
  const longestNisnLength = rows.reduce((max, row) => Math.max(max, (row.nisn || "").trim().length), 0);
  const naturalWidth = getNaturalColumnWidthMmV2({ key: "nisn", label: "NISN", type: "nisn" }, resolvedStyle);
  if (longestNisnLength <= 0) return naturalWidth;

  const averageDigitWidthMm = Math.max(0.58, resolvedStyle.tableBodyFontSize * 0.108);
  const paddedWidthMm = longestNisnLength * averageDigitWidthMm + 3.2;
  return Math.max(naturalWidth, paddedWidthMm);
}

export function computeAttendanceColumnLayout(args: ComputeAttendanceColumnLayoutArgs): AttendanceColumnLayout {
  const {
    rows,
    visibleDayCount,
    visibleRekapCount,
    availableWidthMm,
    includeNo,
    includeName,
    includeNisn,
    documentStyle,
    minNameWidthMm: minNameWidthInput,
    minNisnWidthMm: minNisnWidthInput,
    minRekapWidthMm: minRekapWidthInput,
    minDayWidthMm: minDayWidthInput,
    maxNameWidthMm,
    maxNisnWidthMm,
    maxRekapWidthMm,
    rightSafetyMm = 0,
  } = args;

  const resolvedStyle = resolveDocumentStyle(documentStyle);
  const safeAvailableWidthMm = Math.max(20, availableWidthMm - Math.max(0, rightSafetyMm));
  const noWidthMm = includeNo ? 7 : 0;
  const baseNameWidthMm = includeName ? estimateNameWidthMm(rows, resolvedStyle) : 0;
  const baseNisnWidthMm = includeNisn
    ? estimateNisnWidthMm(rows, resolvedStyle)
    : 0;
  const baseRekapWidthMm = visibleRekapCount > 0
    ? getNaturalColumnWidthMmV2({ key: "total", label: "Jml", type: "status" }, resolvedStyle)
    : 0;

  const minNameWidthMm = includeName ? Math.max(16, minNameWidthInput ?? 24) : 0;
  const minNisnWidthMm = includeNisn ? Math.max(10, minNisnWidthInput ?? 12) : 0;
  const minRekapWidthMm = visibleRekapCount > 0 ? Math.max(5.5, minRekapWidthInput ?? 6.2) : 0;
  const minDayWidthMm = visibleDayCount > 0 ? Math.max(3.8, minDayWidthInput ?? 4) : 0;
  const cappedNameWidthMm = includeName ? Math.min(baseNameWidthMm, maxNameWidthMm ?? Math.max(baseNameWidthMm, minNameWidthMm + 4)) : 0;
  const cappedNisnWidthMm = includeNisn ? Math.min(baseNisnWidthMm, maxNisnWidthMm ?? Math.max(baseNisnWidthMm, minNisnWidthMm + 6)) : 0;
  const cappedRekapWidthMm = visibleRekapCount > 0 ? Math.min(baseRekapWidthMm, maxRekapWidthMm ?? baseRekapWidthMm) : 0;

  const minimumFixedWidthMm =
    noWidthMm
    + minNameWidthMm
    + minNisnWidthMm
    + visibleRekapCount * minRekapWidthMm;
  const minimumDaysWidthMm = visibleDayCount * minDayWidthMm;
  const fixedBudgetMm = Math.max(minimumFixedWidthMm, safeAvailableWidthMm - minimumDaysWidthMm);

  let nameWidthMm = includeName ? minNameWidthMm : 0;
  let nisnWidthMm = includeNisn ? minNisnWidthMm : 0;
  let rekapWidthMm = visibleRekapCount > 0 ? minRekapWidthMm : 0;
  let remainingFixedExtraMm = Math.max(0, fixedBudgetMm - minimumFixedWidthMm);

  const consumeExtra = (requestedMm: number) => {
    const appliedMm = Math.min(remainingFixedExtraMm, Math.max(0, requestedMm));
    remainingFixedExtraMm -= appliedMm;
    return appliedMm;
  };

  if (includeNisn) {
    nisnWidthMm += consumeExtra(cappedNisnWidthMm - minNisnWidthMm);
  }
  if (includeName) {
    nameWidthMm += consumeExtra(cappedNameWidthMm - minNameWidthMm);
  }
  if (visibleRekapCount > 0) {
    const rekapExtraPerColumnMm = consumeExtra((cappedRekapWidthMm - minRekapWidthMm) * visibleRekapCount) / visibleRekapCount;
    rekapWidthMm += rekapExtraPerColumnMm;
  }

  const usedFixedWidthMm =
    noWidthMm
    + nameWidthMm
    + nisnWidthMm
    + visibleRekapCount * rekapWidthMm;
  const remainingWidthMm = Math.max(minimumDaysWidthMm, safeAvailableWidthMm - usedFixedWidthMm);
  const dayWidthMm = visibleDayCount > 0 ? remainingWidthMm / visibleDayCount : 0;

  const totalWidthMm =
    noWidthMm
    + nameWidthMm
    + nisnWidthMm
    + visibleRekapCount * rekapWidthMm
    + visibleDayCount * dayWidthMm;
  const overflowMm = Math.max(0, totalWidthMm - safeAvailableWidthMm);
  const correctedDayWidthMm = visibleDayCount > 0
    ? Math.max(minDayWidthMm, dayWidthMm - overflowMm / visibleDayCount)
    : 0;

  const correctedTotalWidthMm =
    noWidthMm
    + nameWidthMm
    + nisnWidthMm
    + visibleRekapCount * rekapWidthMm
    + visibleDayCount * correctedDayWidthMm;
  const trailingSlackMm = Math.max(0, safeAvailableWidthMm - correctedTotalWidthMm);
  if (trailingSlackMm > 0 && visibleDayCount > 0) {
    return {
      noWidthMm,
      nameWidthMm: Number(nameWidthMm.toFixed(2)),
      nisnWidthMm: Number(nisnWidthMm.toFixed(2)),
      dayWidthMm: Number((correctedDayWidthMm + trailingSlackMm / visibleDayCount).toFixed(2)),
      rekapWidthMm: Number(rekapWidthMm.toFixed(2)),
    };
  }

  return {
    noWidthMm,
    nameWidthMm: Number(nameWidthMm.toFixed(2)),
    nisnWidthMm: Number(nisnWidthMm.toFixed(2)),
    dayWidthMm: Number(correctedDayWidthMm.toFixed(2)),
    rekapWidthMm: Number(rekapWidthMm.toFixed(2)),
  };
}

export function formatAttendanceNameForNarrowColumn(name: string) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) return "";

  const parts = normalized.split(" ");
  if (normalized.length <= 20 || parts.length === 1) return normalized;

  const [first, ...rest] = parts;
  const compact = [first, ...rest.map((part) => `${part[0]}.`)].join(" ");
  return compact.length < normalized.length ? compact : normalized;
}

// ─── Legend config ─────────────────────────────────────────────────────────
const LEGEND = [
  { label: "H", description: "Hadir",       bg: "#dcfce7", color: "#166534" },
  { label: "S", description: "Sakit",       bg: "#fef3c7", color: "#92400e" },
  { label: "I", description: "Izin",        bg: "#dbeafe", color: "#1d4ed8" },
  { label: "A", description: "Alpha",       bg: "#fee2e2", color: "#b91c1c" },
  { label: "D", description: "Dispensasi",  bg: "#ede9fe", color: "#6d28d9" },
  { label: "L", description: "Libur",       bg: "#fff7ed", color: "#b45309" },
] as const;

// ─── Build layout plan ─────────────────────────────────────────────────────

interface BuildOptions {
  data: AttendancePrintDataset;
  paperSize?: ReportPaperSize;
  documentStyle?: ReportDocumentStyle;
  visibleColumnKeys?: string[];
  includeSignature?: boolean;
  forceSinglePage?: boolean;
  signatureOffsetYMm?: number;
}

export function buildAttendancePrintLayoutPlan(opts: BuildOptions): AttendancePrintLayoutPlan {
  const {
    data,
    paperSize = "a4",
    documentStyle,
    visibleColumnKeys,
    includeSignature = false,
    forceSinglePage = false,
    signatureOffsetYMm = 0,
  } = opts;

  // ── 1. Determine visible structure ────────────────────────────────────────
  const colSet = visibleColumnKeys ? new Set(visibleColumnKeys) : new Set(["no", "name", "nisn", ...REKAP_KEYS]);
  const hasNo   = colSet.has("no")   !== false;
  const hasName = colSet.has("name") !== false;
  const hasNisn = colSet.has("nisn") !== false;

  const visibleDays: AttendanceDayColumn[] = data.days.slice(); // all day columns always shown
  const visibleRekapKeys: RekapKey[] = REKAP_KEYS.filter((k) => colSet.has(k) || !visibleColumnKeys);

  const rows: AttendancePrintRow[] = data.rows.length > 0 ? data.rows : [{
    id: "empty-preview",
    number: 1,
    name: "Belum ada data siswa",
    nisn: "-",
    cells: data.days.map((day) => ({ value: day.isHoliday ? "L" : "-", isHoliday: day.isHoliday, hasEvent: day.hasEvent })),
    totals: { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 },
  }];

  // ── 2. Paper geometry ──────────────────────────────────────────────────────
  const basePaper = PAPER[paperSize] ?? PAPER.a4;
  const marginH = MARGIN.left + MARGIN.right;
  const marginV = MARGIN.top + MARGIN.bottom;

  // ── 3. Compute fixed column total width ────────────────────────────────────
  const fixedWidthMm
    = (hasNo   ? COL_NO_MM   : 0)
    + (hasName ? COL_NAME_MM : 0)
    + (hasNisn ? COL_NISN_MM : 0)
    + visibleRekapKeys.length * COL_REKAP_MM
    + (visibleRekapKeys.includes("total") ? COL_TOTAL_MM - COL_REKAP_MM : 0);

  // ── 4. Scale factor for forceSinglePage ────────────────────────────────────
  // We try progressively smaller font/row until all rows fit on 1 page.
  // Steps: normal(1.0) → compact(0.85) → micro(0.72) → force(computed)

  const baseHeaderFontPt = documentStyle?.tableHeaderFontSize ?? 9;
  const baseBodyFontPt   = documentStyle?.tableBodyFontSize   ?? 9;
  const baseTitleFontPt  = documentStyle?.titleFontSize       ?? 14;
  const baseMetaFontPt   = documentStyle?.metaFontSize        ?? 8;

  const scales = forceSinglePage
    ? [1.0, 0.85, 0.72, 0.62, 0.54, 0.47]
    : [1.0];

  let chosen: AttendancePrintLayoutPlan | null = null;

  for (const scale of scales) {
    const headerFontPt = Math.max(5, baseHeaderFontPt * scale);
    const bodyFontPt   = Math.max(5, baseBodyFontPt   * scale);
    const titleFontPt  = Math.max(6, baseTitleFontPt  * scale);
    const metaFontPt   = Math.max(5, baseMetaFontPt   * scale);

    const headerRowHeightMm = Math.max(3.5, 4.5 + (headerFontPt - 7) * 0.5) * scale;
    const bodyRowHeightMm   = Math.max(3.0, 4.0 + (bodyFontPt   - 7) * 0.5) * scale;
    const cellPaddingMm     = Math.max(0.5, 1.0 * scale);

    // Total header rows height (2 sub-rows: day name + date)
    const tableHeaderTotalMm = headerRowHeightMm * HEADER_ROWS;

    // ── 5. Compute available page content height ──────────────────────────
    const pageH = basePaper.h;
    const contentH = pageH - marginV - FOOTER_HEIGHT_MM;

    // Overhead on first page (banner + meta bar + table headers)
    const firstPageOverhead = BANNER_HEIGHT_MM + META_BAR_HEIGHT_MM + tableHeaderTotalMm;

    // Overhead on last page (summary + optional signature)
    const summaryBlocks = data.eventItems.length + data.holidayItems.length + data.notes.length;
    const summaryHeight = LEGEND_HEIGHT_MM
      + Math.min(summaryBlocks, 8) * metaFontPt * 0.352 // mm per line (~0.352mm/pt)
      + (includeSignature ? SIGNATURE_HEIGHT_MM + Math.abs(signatureOffsetYMm) : 0);

    // Rows per page
    const rowsPerFirstPage = Math.max(1, Math.floor((contentH - firstPageOverhead) / bodyRowHeightMm));
    const rowsPerLastPage  = Math.max(1, Math.floor((contentH - tableHeaderTotalMm - summaryHeight) / bodyRowHeightMm));
    const rowsPerMidPage   = Math.max(1, Math.floor((contentH - tableHeaderTotalMm) / bodyRowHeightMm));

    // ── 6. Paginate ────────────────────────────────────────────────────────
    const pages: AttendancePrintPage[] = [];
    let remaining = rows.length;
    let cursor = 0;
    let pageNumber = 1;

    while (remaining > 0) {
      const isFirst = pageNumber === 1;
      const capacity = isFirst ? rowsPerFirstPage : rowsPerMidPage;

      // If this will be the last page, check if summary fits
      const willBeLastPage = remaining <= capacity;
      const effectiveCapacity = willBeLastPage
        ? Math.min(capacity, rowsPerLastPage)
        : capacity;

      const rowEnd = Math.min(cursor + effectiveCapacity, rows.length);
      pages.push({
        key: `page-${pageNumber}`,
        pageNumber,
        rowStart: cursor,
        rowEnd,
        isLastPage: false,
        showSummary: false,
      });
      cursor = rowEnd;
      remaining = rows.length - cursor;
      pageNumber++;
    }

    if (pages.length === 0) {
      pages.push({ key: "page-1", pageNumber: 1, rowStart: 0, rowEnd: 0, isLastPage: true, showSummary: true });
    } else {
      pages[pages.length - 1].isLastPage = true;
      pages[pages.length - 1].showSummary = true;
    }

    // ── 7. Compute dynamic day column width ───────────────────────────────
    const dayCount = visibleDays.length;

    // Compute page width
    let pageW = basePaper.w > 0 ? basePaper.w : 297;

    if (paperSize === "auto") {
      // Auto: compute minimum width needed, with a sane cap at 500mm
      const minDayWidth = Math.max(4, headerFontPt * 0.35 + 1);
      const autoW = MARGIN.left + MARGIN.right + fixedWidthMm + dayCount * minDayWidth;
      pageW = Math.min(500, Math.max(297, autoW));
    }

    const availableForDays = pageW - marginH - fixedWidthMm;
    const rawDayWidth = dayCount > 0 ? availableForDays / dayCount : 6;
    // Clamp: min 4mm (fits 2 chars at small font), max 12mm
    const dayWidthMm = Math.max(4, Math.min(12, rawDayWidth));

    // ── 8. Check if forceSinglePage is satisfied ──────────────────────────
    const fitsOnePage = pages.length <= 1;
    if (!forceSinglePage || fitsOnePage || scale === scales[scales.length - 1]) {
      const fitMode: "normal" | "compact" | "micro"
        = scale >= 1.0 ? "normal"
        : scale >= 0.72 ? "compact"
        : "micro";

      // ── 9. Compute totals ───────────────────────────────────────────────
      const totals: Record<RekapKey, number> = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };
      rows.forEach((row) => {
        REKAP_KEYS.forEach((k) => { totals[k] += row.totals[k] ?? 0; });
      });

      chosen = {
        paper: {
          pageWidthMm: pageW,
          pageHeightMm: pageH,
          marginTopMm: MARGIN.top,
          marginRightMm: MARGIN.right,
          marginBottomMm: MARGIN.bottom,
          marginLeftMm: MARGIN.left,
        },
        table: {
          headerFontPt,
          bodyFontPt,
          metaFontPt,
          titleFontPt,
          headerRowHeightMm,
          bodyRowHeightMm,
          bodyCellPaddingMm: cellPaddingMm,
          noWidthMm: hasNo   ? COL_NO_MM   : 0,
          nameWidthMm: hasName ? COL_NAME_MM : 0,
          nisnWidthMm: hasNisn ? COL_NISN_MM : 0,
          dayWidthMm,
          rekapWidthMm: COL_REKAP_MM,
        },
        fit: { mode: fitMode, scale },
        pages,
        rows,
        visibleDays,
        visibleColumnKeys: colSet,
        visibleRekapKeys,
        totals,
        summary: {
          legend: LEGEND.map((l) => ({ ...l })),
          events: data.eventItems.map((e) => `${e.dayNumber}: ${e.description}`),
          holidays: data.holidayItems.map((h) => `${h.dayNumber}: ${h.description}`),
          notes: data.notes,
        },
      };
      break;
    }
  }

  return chosen!;
}

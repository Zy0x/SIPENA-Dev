/**
 * TESTING
 * Single source of truth for Attendance export layout planning.
 *
 * Consumed by `AttendancePrintDocument` (renderer), the live preview
 * shell, and the rasterized PDF/PNG adapters. All sizing decisions —
 * column widths, font sizes, row heights, page splits, summary
 * placement, holiday grouping — happen here so preview ≡ export.
 */

import {
  resolveDocumentStyle,
  resolveReportPaperSize,
  resolveSignaturePlacementFromBounds,
  type ReportDocumentStyle,
  type SignatureBlockMetrics,
  type SignaturePlacement,
} from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import { computeAttendanceColumnLayout } from "@/lib/attendanceExport";
import { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";
import { groupAttendanceHolidayRanges, type AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";
import { computeSignatureHeight, type SignatureData } from "@/lib/exportSignature";
import type {
  AttendancePlannerPageTrace,
  AttendancePlannerStageTrace,
  AttendancePlannerTrace,
} from "@/lib/attendanceExportDebug";

export type AttendanceFitMode = "base" | "shrunk-soft" | "shrunk-hard";

export interface AttendancePrintCell {
  value: string;
  isHoliday: boolean;
  hasEvent: boolean;
}

export interface AttendancePrintRow {
  id: string;
  number: number;
  name: string;
  nisn: string;
  cells: AttendancePrintCell[];
  totals: {
    H: number;
    S: number;
    I: number;
    A: number;
    D: number;
    total: number;
  };
}

export interface AttendancePrintDay {
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
  days: AttendancePrintDay[];
  notes: string[];
  /** Already pre-filtered & month-scoped raw holiday strings (e.g. "20 Mei: Cuti...") */
  holidayItems: AttendanceHolidayInputItem[];
  /** Already pre-filtered & month-scoped raw event strings (e.g. "21 Mei: Bakti Sosial") */
  eventItems: AttendanceHolidayInputItem[];
}

export interface AttendancePrintPaper {
  key: ReportPaperSize;
  pageWidthMm: number;
  pageHeightMm: number;
  marginTopMm: number;
  marginRightMm: number;
  marginBottomMm: number;
  marginLeftMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
}

export interface AttendancePrintTableLayout {
  tableWidthMm: number;
  noWidthMm: number;
  nameWidthMm: number;
  nisnWidthMm: number;
  dayWidthMm: number;
  rekapWidthMm: number;
  headerRowHeightMm: number;
  bodyRowHeightMm: number;
  summaryRowHeightMm: number;
  headerFontPt: number;
  dayHeaderFontPt: number;
  dayDateFontPt: number;
  bodyFontPt: number;
  metaFontPt: number;
  titleFontPt: number;
  bodyCellPaddingMm: number;
}

export interface AttendancePrintPage {
  key: string;
  kind: "table" | "summary-continuation" | "signature-only";
  pageNumber: number;
  rowStart: number;
  rowEnd: number;
  rowHeightsMm: number[];
  tableStartYMm: number;
  tableMaxBottomMm: number;
  plannedBodyHeightMm: number;
  plannedSummaryHeightMm: number;
  plannedFooterReserveMm: number;
  plannedHeaderReserveMm: number;
  pageContentHeightMm: number;
  availableBodyHeightMm: number;
  hasDocumentHeader: boolean;
  hasTableHeader: boolean;
  hasContinuationNote: boolean;
  /** Render legend + Keterangan + Catatan info blocks under the table. */
  showSummary: boolean;
  /** Append TOTAL & PERSENTASE summary rows to the table body. */
  hasSummaryRows: boolean;
  /** Render the signature block on this page (true on EXACTLY ONE page). */
  drawSignatureHere: boolean;
  /** Render only the signature (no table). True for dedicated trailing page. */
  isSignatureOnlyPage: boolean;
  /** Last page in the document (controls "Halaman N/N" footer & table border). */
  isLastPage: boolean;
  summaryContent: AttendancePrintPageSummaryContent | null;
}

export interface AttendancePrintSummary {
  legend: { label: string; description: string; bg: string; color: string }[];
  keterangan: AttendancePrintInfoItem[];
  /** Generalized "Keterangan" — combined custom holidays + national holidays + events,
   *  sorted by day-of-month, smart-grouped. This replaces the previous 3 separate blocks. */
  /** Kept for backwards-compat (some debug/legacy paths still read these). */
  events: string[];
  customHolidays: string[];
  nationalHolidays: string[];
  holidays: string[];
  notes: string[];
}

export interface AttendancePrintInfoItem {
  text: string;
  tone?: "default" | "national" | "custom" | "event";
}

export type AttendanceAnnotationDisplayMode = "summary-card" | "inline-vertical";
export type AttendanceInlineLabelStyle = "rotate-90" | "stacked";

export interface AttendanceInlineAnnotationStackedSegment {
  text: string;
  kind: "char" | "gap";
}

export interface AttendanceInlineAnnotationLayout {
  text: string;
  stackedChars: string[];
  stackedSegments?: AttendanceInlineAnnotationStackedSegment[];
  fontPx: number;
  lineHeightPx: number;
  gapLineHeightPx?: number;
  rotateBoxWidthPx?: number;
  rotateBoxHeightPx?: number;
}

export interface AttendanceInlineAnnotationRange {
  key: string;
  text: string;
  tone: "national" | "custom" | "event";
  startDay: number;
  endDay: number;
  startColumnIndex: number;
  endColumnIndex: number;
}

export interface AttendancePrintPageSummaryContent {
  mode: "table-tail" | "continuation";
  showLegend: boolean;
  legendHeightMm: number;
  keteranganTitle: string | null;
  keteranganItems: AttendancePrintInfoItem[];
  keteranganFontPt: number;
  keteranganHeightMm: number;
  notesTitle: string | null;
  notesItems: string[];
  notesFontPt: number;
  notesHeightMm: number;
  contentHeightMm: number;
  reservedSignatureHeightMm: number;
}

type AttendanceInfoLike = string | AttendancePrintInfoItem;

function getAttendanceInfoText(item: AttendanceInfoLike) {
  return typeof item === "string" ? item : item.text;
}

export interface AttendancePrintSummaryLayout {
  tableStartYMm: number;
  tableEndYMm: number;
  legendHeightMm: number;
  /** Height reserved for the unified "Keterangan" block (replaces eventsHeightMm + holidaysHeightMm). */
  keteranganHeightMm: number;
  /** @deprecated kept only to avoid breaking any external readers. */
  eventsHeightMm: number;
  /** @deprecated kept only to avoid breaking any external readers. */
  holidaysHeightMm: number;
  notesHeightMm: number;
  contentHeightMm: number;
  signatureZoneTopMm: number;
  signatureZoneHeightMm: number;
  printableBottomMm: number;
  /** True when the planner had to add a dedicated trailing page just for the signature. */
  signatureOnDedicatedPage: boolean;
  keteranganFontPt: number;
  continuationPageCount: number;
}

export interface AttendancePrintSummaryRows {
  totalLabel: string;
  percentLabel: string;
  percentageByKey: Record<keyof AttendancePrintRow["totals"], string>;
}

export interface AttendancePrintLayoutPlan {
  shell: { -readonly [K in keyof typeof ATTENDANCE_SHELL_MM]: number };
  paper: AttendancePrintPaper;
  table: AttendancePrintTableLayout;
  visibleColumnKeys: Set<string>;
  visibleDays: AttendancePrintDay[];
  visibleRekapKeys: ("H" | "S" | "I" | "A" | "D" | "total")[];
  annotationDisplayMode: AttendanceAnnotationDisplayMode;
  eventAnnotationDisplayMode: AttendanceAnnotationDisplayMode;
  inlineLabelStyle: AttendanceInlineLabelStyle;
  inlineAnnotations: AttendanceInlineAnnotationRange[];
  rows: AttendancePrintRow[];
  rowHeightsMm: number[];
  pages: AttendancePrintPage[];
  summary: AttendancePrintSummary;
  summaryRows: AttendancePrintSummaryRows;
  summaryLayout: AttendancePrintSummaryLayout;
  signaturePlacement: SignaturePlacement | null;
  plannedPageCount: number;
  bodyRowsTotalHeightMm: number;
  tablePlannedTotalHeightMm: number;
  reservedLastPageMm: number;
  reservedRegularPageMm: number;
  overflowRisk: boolean;
  plannerWarnings: string[];
  fit: {
    mode: AttendanceFitMode;
    appliedScale: number;
    forceSinglePage: boolean;
  };
  totals: AttendancePrintRow["totals"];
  debug: {
    planner: AttendancePlannerTrace;
  };
}

export interface BuildAttendancePrintLayoutArgs {
  data: AttendancePrintDataset;
  paperSize: ReportPaperSize;
  documentStyle?: ReportDocumentStyle;
  visibleColumnKeys?: string[];
  includeSignature: boolean;
  signature?: SignatureData | null;
  forceSinglePage: boolean;
  annotationDisplayMode?: AttendanceAnnotationDisplayMode;
  eventAnnotationDisplayMode?: AttendanceAnnotationDisplayMode;
  inlineLabelStyle?: AttendanceInlineLabelStyle;
  /** Vertical signature offset in mm (positive = downward). Reserved into page so TTD never gets clipped. */
  signatureOffsetYMm?: number;
}

// Distinct hue per status — Sakit (S) is amber, Libur (L) is slate-violet so
// they can never visually blend in the rekap row. Avoids the previous bug
// where S (#fef3c7) and L (#fff7ed) looked nearly identical when printed.
const DEFAULT_LEGEND = [
  { label: "H", description: "Hadir", bg: "#dcfce7", color: "#166534" },
  { label: "I", description: "Izin", bg: "#dbeafe", color: "#1d4ed8" },
  { label: "S", description: "Sakit", bg: "#fef9c3", color: "#854d0e" },
  { label: "A", description: "Alpha", bg: "#fee2e2", color: "#b91c1c" },
  { label: "D", description: "Dispensasi", bg: "#ede9fe", color: "#6d28d9" },
  { label: "L", description: "Libur", bg: "#e2e8f0", color: "#475569" },
];

// ─── Shared shell metrics — single source of truth (mm) ─────────────────
// Both this planner and the PDF renderer (attendancePdfExport.ts) import
// the SAME constants from `exportEngine/attendanceShellMetrics.ts`. That
// guarantees the live preview and the exported PDF reserve identical space
// for banner/footer/summary/signature regions.
import {
  ATTENDANCE_SHELL_MM,
  ATTENDANCE_MARGIN_MM,
  ATTENDANCE_LAYOUT_TOLERANCE_MM,
} from "@/lib/exportEngine/attendanceShellMetrics";

const SHELL_HEIGHT_MM = ATTENDANCE_SHELL_MM;
const MARGIN_MM = ATTENDANCE_MARGIN_MM;
const TABLE_SLACK_TOLERANCE_MM = ATTENDANCE_LAYOUT_TOLERANCE_MM.tableSlack;
const TABLE_BOTTOM_SAFETY_MM = ATTENDANCE_LAYOUT_TOLERANCE_MM.tableBottomSafety;
const AUTOTABLE_ROW_OVERHEAD_MM = ATTENDANCE_LAYOUT_TOLERANCE_MM.autotableRowOverhead;
const INFO_BLOCK_LINE_HEIGHT_MM = 3.15;
const INFO_BLOCK_BOTTOM_PADDING_MM = 1.5;
const KETERANGAN_MIN_CONTENT_FONT_PT = 8;
const KETERANGAN_FONT_STEP_PT = 0.25;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function getAttendanceRekapLabel(key: keyof AttendancePrintRow["totals"]) {
  return key === "total" ? "Jml" : key;
}

export function formatAttendancePercent(value: number, denominator: number) {
  if (denominator <= 0 || value <= 0) return "0%";
  const raw = (value * 100) / denominator;
  // Cap at 1 decimal place so values like '98,57%' become '98,6%',
  // preventing overflow in narrow rekap columns (~8-9mm wide).
  const rounded = Math.round(raw * 10) / 10;
  const normalized = Number.isInteger(rounded) ? String(Math.round(rounded)) : rounded.toFixed(1);
  return `${normalized.replace(".", ",")}%`;
}

function normalizeInlineAnnotationText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function estimateInlineAnnotationCharUnit(char: string) {
  if (!char.trim()) return 0;
  if (/[MW@#%&8B]/.test(char)) return 0.9;
  if (/[A-Z0-9]/.test(char)) return 0.74;
  if (/[ilI1.,:;!'`]/.test(char)) return 0.38;
  return 0.62;
}

function estimateInlineAnnotationTextUnits(text: string) {
  const normalized = normalizeInlineAnnotationText(text);
  if (!normalized) return 1;
  return Array.from(normalized).reduce((sum, char) => sum + (/\s/.test(char) ? 0.34 : estimateInlineAnnotationCharUnit(char)), 0);
}

export function getAttendanceInlineAnnotationStackedChars(text: string) {
  const chars = getAttendanceInlineAnnotationStackedSegments(text)
    .filter((segment) => segment.kind === "char")
    .map((segment) => segment.text);
  return chars.length > 0 ? chars : ["-"];
}

export function getAttendanceInlineAnnotationStackedSegments(text: string): AttendanceInlineAnnotationStackedSegment[] {
  const normalized = normalizeInlineAnnotationText(text);
  const words = normalized
    .split(/\s+/)
    .flatMap((word) => word.split(/[-–—_/|+&]+/))
    .map((word) => word.replace(/['’`".,;:()[\]{}]+/g, "").trim())
    .filter(Boolean);

  if (words.length === 0) {
    return [{ text: "-", kind: "char" }];
  }

  return words.flatMap((word, wordIndex) => {
    const chars = Array.from(word).map((char) => ({ text: char, kind: "char" as const }));
    if (wordIndex === words.length - 1) return chars;
    return [...chars, { text: "", kind: "gap" as const }];
  });
}

export function resolveAttendanceInlineAnnotationLayout({
  text,
  labelStyle,
  widthMm,
  heightMm,
}: {
  text: string;
  labelStyle: AttendanceInlineLabelStyle;
  widthMm: number;
  heightMm: number;
}): AttendanceInlineAnnotationLayout {
  const normalizedText = normalizeInlineAnnotationText(text) || "-";
  const widthPx = Math.max(1, mmToPreviewPx(widthMm));
  const heightPx = Math.max(1, mmToPreviewPx(heightMm));

  if (labelStyle === "rotate-90") {
    const usableWidthPx = Math.max(8, widthPx - 5.5);
    const usableHeightPx = Math.max(14, heightPx - 10);
    const rawFontPx = Math.min(
      usableWidthPx * 0.82,
      usableHeightPx / Math.max(1, estimateInlineAnnotationTextUnits(normalizedText)),
    );
    const fontPx = clamp(rawFontPx, Math.min(8.5, rawFontPx), 17.5);
    return {
      text: normalizedText,
      stackedChars: getAttendanceInlineAnnotationStackedChars(normalizedText),
      fontPx: Number(fontPx.toFixed(2)),
      lineHeightPx: Number((fontPx * 0.98).toFixed(2)),
      rotateBoxWidthPx: Number(usableHeightPx.toFixed(2)),
      rotateBoxHeightPx: Number(usableWidthPx.toFixed(2)),
    };
  }

  const stackedChars = getAttendanceInlineAnnotationStackedChars(normalizedText);
  const stackedSegments = getAttendanceInlineAnnotationStackedSegments(normalizedText);
  const usableWidthPx = Math.max(8, widthPx - 6);
  const usableHeightPx = Math.max(14, heightPx - 12);
  const widestCharUnit = Math.max(...stackedChars.map(estimateInlineAnnotationCharUnit), 0.72);
  const lineHeightFactor = stackedChars.length >= 10 ? 0.96 : 1.02;
  const stackedHeightUnits = stackedSegments.reduce(
    (sum, segment) => sum + (segment.kind === "gap" ? 0.48 : 1),
    0,
  );
  const rawFontPx = Math.min(
    usableWidthPx / widestCharUnit,
    usableHeightPx / Math.max(1, stackedHeightUnits * lineHeightFactor),
  );
  const fontPx = clamp(rawFontPx, Math.min(8.2, rawFontPx), 18.5);
  return {
    text: stackedSegments.map((segment) => segment.text).join("\n"),
    stackedChars,
    stackedSegments,
    fontPx: Number(fontPx.toFixed(2)),
    lineHeightPx: Number((fontPx * lineHeightFactor).toFixed(2)),
    gapLineHeightPx: Number((fontPx * lineHeightFactor * 0.48).toFixed(2)),
  };
}

function estimateWrappedLineCount(text: string, fontPt: number, widthMm: number) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return 1;

  const averageCharWidthMm = Math.max(0.58, fontPt * 0.108);
  const usableWidthMm = Math.max(10, widthMm - 4);
  const charsPerLine = Math.max(8, Math.floor(usableWidthMm / averageCharWidthMm));
  const words = normalized.split(" ");
  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = wordLength;
      if (wordLength > charsPerLine) {
        lines += Math.ceil(wordLength / charsPerLine) - 1;
        currentLineLength = wordLength % charsPerLine || charsPerLine;
      }
      return;
    }

    const nextLength = currentLineLength + 1 + wordLength;
    if (nextLength <= charsPerLine) {
      currentLineLength = nextLength;
      return;
    }

    lines += 1;
    currentLineLength = wordLength;
    if (wordLength > charsPerLine) {
      lines += Math.ceil(wordLength / charsPerLine) - 1;
      currentLineLength = wordLength % charsPerLine || charsPerLine;
    }
  });

  return clamp(lines, 1, 12);
}

function estimateInfoBlockHeightMm(items: AttendanceInfoLike[], maxItems: number, widthMm: number, fontPt: number): number {
  if (items.length <= 0) return 0;
  const visibleItems = items.slice(0, maxItems);
  return measureInfoBlockHeightMm(visibleItems, widthMm, fontPt);
}

function resolveInfoContentFontPt(baseFontPt: number) {
  return Math.max(5.6, baseFontPt - 1.1);
}

function buildInfoBlockMeasurement(
  items: AttendanceInfoLike[],
  widthMm: number,
  baseFontPt: number,
  infoBlockGapMm: number = SHELL_HEIGHT_MM.infoBlockGap,
) {
  const contentFontPt = resolveInfoContentFontPt(baseFontPt);
  const useTwoCols = items.length > 2;
  const effectiveWidthMm = useTwoCols ? Math.max(40, (widthMm - 12) / 2) : widthMm;
  const itemHeightsMm = items.map((item) => {
    const lineCount = estimateWrappedLineCount(getAttendanceInfoText(item), contentFontPt, effectiveWidthMm);
    return lineCount * INFO_BLOCK_LINE_HEIGHT_MM;
  });

  const resolveHeightForCount = (count: number) => {
    if (count <= 0) return 0;
    let contentHeightMm = 0;
    if (useTwoCols) {
      for (let index = 0; index < count; index += 2) {
        const leftHeight = itemHeightsMm[index] ?? INFO_BLOCK_LINE_HEIGHT_MM;
        const rightHeight = itemHeightsMm[index + 1] ?? 0;
        contentHeightMm += Math.max(leftHeight, rightHeight);
      }
    } else {
      contentHeightMm = itemHeightsMm.slice(0, count).reduce((sum, value) => sum + value, 0);
    }
    return SHELL_HEIGHT_MM.infoBlockHeader
      + contentHeightMm
      + INFO_BLOCK_BOTTOM_PADDING_MM
      + infoBlockGapMm;
  };

  return {
    useTwoCols,
    itemHeightsMm,
    contentFontPt,
    totalHeightMm: resolveHeightForCount(items.length),
    resolveHeightForCount,
  };
}

function measureInfoBlockHeightMm(
  items: AttendanceInfoLike[],
  widthMm: number,
  baseFontPt: number,
  infoBlockGapMm: number = SHELL_HEIGHT_MM.infoBlockGap,
) {
  if (items.length <= 0) return 0;
  return buildInfoBlockMeasurement(items, widthMm, baseFontPt, infoBlockGapMm).totalHeightMm;
}

function takeInfoItemsForHeight(
  items: AttendanceInfoLike[],
  widthMm: number,
  baseFontPt: number,
  availableMm: number,
  infoBlockGapMm: number = SHELL_HEIGHT_MM.infoBlockGap,
) {
  if (items.length <= 0 || availableMm <= 0) return 0;
  const measurement = buildInfoBlockMeasurement(items, widthMm, baseFontPt, infoBlockGapMm);
  let fitCount = 0;
  for (let count = 1; count <= items.length; count += 1) {
    if (measurement.resolveHeightForCount(count) <= availableMm + 0.01) {
      fitCount = count;
      continue;
    }
    break;
  }
  return fitCount > 0 ? fitCount : 1;
}

function resolveAttendanceShellMetrics(documentStyle: ReportDocumentStyle) {
  return {
    ...ATTENDANCE_SHELL_MM,
    contentPaddingY: documentStyle.attendanceLayout.contentPaddingYMm,
    summaryGap: documentStyle.attendanceLayout.summaryGapMm,
    infoBlockGap: documentStyle.attendanceLayout.infoBlockGapMm,
    signatureGap: documentStyle.attendanceLayout.signatureGapMm,
    footerClearance: documentStyle.attendanceLayout.footerClearanceMm,
  };
}

function enumerateKeteranganBaseFontCandidates(baseFontPt: number) {
  const minBaseFontPt = Math.max(1, KETERANGAN_MIN_CONTENT_FONT_PT + 1.1);
  const candidates: number[] = [];
  for (let current = baseFontPt; current >= minBaseFontPt - 0.001; current -= KETERANGAN_FONT_STEP_PT) {
    candidates.push(Number(current.toFixed(2)));
  }
  if (candidates.length === 0 || candidates[candidates.length - 1] > minBaseFontPt + 0.001) {
    candidates.push(Number(minBaseFontPt.toFixed(2)));
  }
  return [...new Set(candidates)];
}

function estimateLegendHeightMm(
  legend: AttendancePrintSummary["legend"],
  contentWidthMm: number,
  fontPt: number,
) {
  if (legend.length === 0) return 0;

  const averageCharWidthMm = Math.max(0.56, fontPt * 0.102);
  let rows = 1;
  let cursorX = 0;

  legend.forEach((item) => {
    const text = `${item.label} = ${item.description}`;
    const badgeWidthMm = Math.max(18, text.length * averageCharWidthMm + 6);
    if (cursorX > 0 && cursorX + badgeWidthMm > contentWidthMm) {
      rows += 1;
      cursorX = 0;
    }
    cursorX += badgeWidthMm + 2;
  });

  return rows * 6 + 2;
}

function estimateSignatureBlockMetrics(signature: SignatureData | null | undefined): SignatureBlockMetrics | null {
  if (!signature) return null;

  const signers = Array.isArray(signature.signers) && signature.signers.length > 0
    ? signature.signers.filter((signer) => signer.name?.trim() || signer.title?.trim())
    : [{
        name: signature.name || "",
        title: signature.title || "Guru Mata Pelajaran",
        nip: signature.nip,
        school_name: signature.school_name,
      }];
  const activeSigners = signers.length > 0 ? signers : [{ name: "", title: "Guru Mata Pelajaran", nip: "", school_name: "" }];
  const lineWidthMm = Math.max(42, signature.signatureLineWidth || 50);
  const spacingMm = Math.max(10, signature.signatureSpacing || 20);
  const blockUnitMm = Math.max(54, lineWidthMm + 10);
  const widthMm = activeSigners.length === 1
    ? blockUnitMm
    : clamp(activeSigners.length * blockUnitMm + (activeSigners.length - 1) * spacingMm, 86, 190);
  return {
    widthMm,
    heightMm: computeSignatureHeight(signature),
    safeXMm: 0,
    safeYMm: 0,
    safeWidthMm: 0,
    safeHeightMm: 0,
  };
}

export function resolveAttendanceDayHeaderFontPt(dayWidthMm: number, headerFontPt: number) {
  return clamp(Math.min(headerFontPt - 0.2, dayWidthMm * 1.08), 5.4, headerFontPt);
}

export function resolveAttendanceDayDateFontPt(dayWidthMm: number, headerFontPt: number) {
  return clamp(Math.min(headerFontPt - 0.6, dayWidthMm * 1.02), 5.1, headerFontPt - 0.1);
}

function buildVisibleColumnSet(data: AttendancePrintDataset, visibleColumnKeys?: string[]): Set<string> {
  if (visibleColumnKeys && visibleColumnKeys.length > 0) return new Set(visibleColumnKeys);
  return new Set([
    "no",
    "name",
    "nisn",
    ...data.days.map((day) => day.key),
    "H",
    "S",
    "I",
    "A",
    "D",
    "total",
  ]);
}

function autoFitTable(args: {
  rows: AttendancePrintRow[];
  visibleDays: AttendancePrintDay[];
  visibleRekapCount: number;
  contentWidthMm: number;
  contentHeightMm: number;
  visibleSet: Set<string>;
  documentStyle: ReportDocumentStyle;
  reservedHeightMm: number;
  forceSinglePage: boolean;
}): {
  table: AttendancePrintTableLayout;
  mode: AttendanceFitMode;
  singlePageFits: boolean;
  rowHeightsMm: number[];
  summaryRowHeightMm: number;
  stageCandidates: AttendancePlannerStageTrace[];
  tableRightSlackMm: number;
  tableLeftSlackMm: number;
  rekapGroupWidthMm: number;
  daysGroupWidthMm: number;
} {
  const { rows, visibleDays, visibleRekapCount, contentWidthMm, contentHeightMm, visibleSet, documentStyle, reservedHeightMm, forceSinglePage } = args;
  const baseHeaderPt = clamp(documentStyle.tableHeaderFontSize ?? 11, 7, 16);
  const baseBodyPt = clamp(documentStyle.tableBodyFontSize ?? 10, 7, 16);
  const baseMetaPt = clamp(documentStyle.metaFontSize ?? 10, 7, 14);
  const baseTitlePt = clamp(documentStyle.titleFontSize ?? 16, 11, 24);
  const widthSafetyMm = 0;

  // nameMin is generous so most full names fit on a single line (no wrap → no clipping).
  // dayMin ensures the 3-letter day abbreviation ("Sen", "Sel", "Rab", ...) always fits.
  const stages: Array<{
    mode: AttendanceFitMode;
    headerPt: number;
    bodyPt: number;
    padMm: number;
    nameMin: number;
    nisnMin: number;
    rekapMin: number;
    dayMin: number;
  }> = [
    // rekapMin raised so the bold "Jml" header (≈4.8mm at 9.5pt) never gets
    // truncated into "Jm" by autoTable's linebreak overflow handler.
    { mode: "base", headerPt: baseHeaderPt, bodyPt: baseBodyPt, padMm: 1.0, nameMin: 42, nisnMin: 14.5, rekapMin: 7.4, dayMin: 5.8 },
    { mode: "shrunk-soft", headerPt: Math.max(6.9, baseHeaderPt - 0.8), bodyPt: Math.max(6.8, baseBodyPt - 0.8), padMm: 0.75, nameMin: 40, nisnMin: 13, rekapMin: 7.0, dayMin: 5.2 },
    { mode: "shrunk-hard", headerPt: Math.max(6.2, baseHeaderPt - 1.6), bodyPt: Math.max(6.2, baseBodyPt - 1.5), padMm: 0.55, nameMin: 38, nisnMin: 11.5, rekapMin: 6.6, dayMin: 4.8 },
  ];

  let chosen = stages[0];
  let widths = computeWidths(stages[0]);
  let rowHeights = resolveRowHeightsMm(stages[0].bodyPt, widths.nameWidthMm, rows, stages[0].padMm);
  let bodyRowH = Math.max(...rowHeights, minimumBodyRowHeightMm(stages[0].bodyPt, stages[0].padMm));
  let summaryRowHeightMm = bodyRowH;
  let dayHeaderPt = resolveAttendanceDayHeaderFontPt(widths.dayWidthMm, stages[0].headerPt);
  let dayDatePt = resolveAttendanceDayDateFontPt(widths.dayWidthMm, stages[0].headerPt);
  let headerRowH = headerRowHeightMm(stages[0].headerPt, dayHeaderPt, dayDatePt);
  let chosenMode: AttendanceFitMode = stages[0].mode;
  let singlePageFits = false;
  const stageCandidates: AttendancePlannerStageTrace[] = [];

  for (const stage of stages) {
    const w = computeWidths(stage);
    const nextDayHeaderPt = resolveAttendanceDayHeaderFontPt(w.dayWidthMm, stage.headerPt);
    const nextDayDatePt = resolveAttendanceDayDateFontPt(w.dayWidthMm, stage.headerPt);
    const nextRowHeights = resolveRowHeightsMm(stage.bodyPt, w.nameWidthMm, rows, stage.padMm);
    const bodyH = Math.max(...nextRowHeights, minimumBodyRowHeightMm(stage.bodyPt, stage.padMm));
    const nextSummaryRowHeightMm = Math.max(bodyH, minimumBodyRowHeightMm(stage.bodyPt, stage.padMm) + 0.2);
    const headerH = headerRowHeightMm(stage.headerPt, nextDayHeaderPt, nextDayDatePt);
    const tableHeightMm = headerH * 2 + nextRowHeights.reduce((sum, height) => sum + height, 0) + (nextSummaryRowHeightMm * 2);
    const fits = !forceSinglePage || (tableHeightMm + reservedHeightMm <= contentHeightMm);
    stageCandidates.push({
      mode: stage.mode,
      headerPt: stage.headerPt,
      bodyPt: stage.bodyPt,
      padMm: stage.padMm,
      nameMin: stage.nameMin,
      nisnMin: stage.nisnMin,
      rekapMin: stage.rekapMin,
      dayMin: stage.dayMin,
      tableWidthMm: Number((
        (visibleSet.has("no") ? w.noWidthMm : 0)
        + (visibleSet.has("name") ? w.nameWidthMm : 0)
        + (visibleSet.has("nisn") ? w.nisnWidthMm : 0)
        + visibleDays.length * w.dayWidthMm
        + visibleRekapCount * w.rekapWidthMm
      ).toFixed(2)),
      dayWidthMm: w.dayWidthMm,
      rekapWidthMm: w.rekapWidthMm,
      nameWidthMm: visibleSet.has("name") ? w.nameWidthMm : 0,
      nisnWidthMm: visibleSet.has("nisn") ? w.nisnWidthMm : 0,
      headerRowHeightMm: headerH,
      bodyRowsTotalHeightMm: Number(nextRowHeights.reduce((sum, height) => sum + height, 0).toFixed(2)),
      summaryRowsHeightMm: Number((nextSummaryRowHeightMm * 2).toFixed(2)),
      reservedHeightMm: Number(reservedHeightMm.toFixed(2)),
      totalHeightMm: Number((tableHeightMm + reservedHeightMm).toFixed(2)),
      fits,
    });

    chosen = stage;
    widths = w;
    rowHeights = nextRowHeights;
    bodyRowH = bodyH;
    summaryRowHeightMm = nextSummaryRowHeightMm;
    headerRowH = headerH;
    dayHeaderPt = nextDayHeaderPt;
    dayDatePt = nextDayDatePt;
    chosenMode = stage.mode;
    singlePageFits = tableHeightMm + reservedHeightMm <= contentHeightMm;

    if (fits) break;
  }

  const tableWidthMm =
    (visibleSet.has("no") ? widths.noWidthMm : 0)
    + (visibleSet.has("name") ? widths.nameWidthMm : 0)
    + (visibleSet.has("nisn") ? widths.nisnWidthMm : 0)
    + visibleDays.length * widths.dayWidthMm
    + visibleRekapCount * widths.rekapWidthMm;

  return {
    mode: chosenMode,
    singlePageFits,
    rowHeightsMm: rowHeights,
    summaryRowHeightMm,
    stageCandidates,
    tableRightSlackMm: Number(Math.max(0, contentWidthMm - tableWidthMm).toFixed(2)),
    tableLeftSlackMm: 0,
    rekapGroupWidthMm: Number((visibleRekapCount * widths.rekapWidthMm).toFixed(2)),
    daysGroupWidthMm: Number((visibleDays.length * widths.dayWidthMm).toFixed(2)),
    table: {
      tableWidthMm: Number(tableWidthMm.toFixed(2)),
      noWidthMm: visibleSet.has("no") ? widths.noWidthMm : 0,
      nameWidthMm: visibleSet.has("name") ? widths.nameWidthMm : 0,
      nisnWidthMm: visibleSet.has("nisn") ? widths.nisnWidthMm : 0,
      dayWidthMm: widths.dayWidthMm,
      rekapWidthMm: widths.rekapWidthMm,
      headerRowHeightMm: headerRowH,
      bodyRowHeightMm: bodyRowH,
      summaryRowHeightMm,
      headerFontPt: chosen.headerPt,
      dayHeaderFontPt: dayHeaderPt,
      dayDateFontPt: dayDatePt,
      bodyFontPt: chosen.bodyPt,
      metaFontPt: baseMetaPt,
      titleFontPt: baseTitlePt,
      bodyCellPaddingMm: chosen.padMm,
    },
  };

  function computeWidths(stage: { padMm: number; nameMin: number; nisnMin: number; rekapMin: number; dayMin: number }) {
    const usableWidthMm = Math.max(20, contentWidthMm - widthSafetyMm);
    const layout = computeAttendanceColumnLayout({
      rows: rows.map((row) => ({ name: row.name, nisn: row.nisn })),
      visibleDayCount: visibleDays.length,
      visibleRekapCount,
      availableWidthMm: usableWidthMm,
      includeNo: visibleSet.has("no"),
      includeName: visibleSet.has("name"),
      includeNisn: visibleSet.has("nisn"),
      documentStyle,
      minNameWidthMm: stage.nameMin,
      minNisnWidthMm: stage.nisnMin,
      minRekapWidthMm: stage.rekapMin,
      minDayWidthMm: stage.dayMin,
      maxNisnWidthMm: 28,
      maxRekapWidthMm: 8.6,
      rightSafetyMm: 0,
    });
    return layout;
  }
}

function minimumBodyRowHeightMm(bodyFontPt: number, padMm: number) {
  return clamp(bodyFontPt * 0.4 + padMm * 2 + 0.8, 3.9, 7.2);
}

function estimateNameLineCount(name: string, bodyFontPt: number, nameWidthMm: number) {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) return 1;

  const averageCharWidthMm = Math.max(0.64, bodyFontPt * 0.112);
  const usableWidthMm = Math.max(10, nameWidthMm - 3.2);
  const charsPerLine = Math.max(8, Math.floor(usableWidthMm / averageCharWidthMm));
  const words = normalized.split(" ");
  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = wordLength;
      if (wordLength > charsPerLine) {
        lines += Math.ceil(wordLength / charsPerLine) - 1;
        currentLineLength = wordLength % charsPerLine || charsPerLine;
      }
      return;
    }

    const nextLength = currentLineLength + 1 + wordLength;
    if (nextLength <= charsPerLine) {
      currentLineLength = nextLength;
      return;
    }

    lines += 1;
    currentLineLength = wordLength;
    if (wordLength > charsPerLine) {
      lines += Math.ceil(wordLength / charsPerLine) - 1;
      currentLineLength = wordLength % charsPerLine || charsPerLine;
    }
  });

  return clamp(lines, 1, 8);
}

function resolveRowHeightsMm(bodyFontPt: number, nameWidthMm: number, rows: AttendancePrintRow[], padMm: number) {
  const baseHeightMm = minimumBodyRowHeightMm(bodyFontPt, padMm);
  const extraLineHeightMm = Math.max(1.25, bodyFontPt * 0.38 + 0.5);
  // Add per-row overhead so planner predictions match jsPDF-autoTable runtime
  // (autoTable adds ~0.4-0.5mm per row for borders + min-height rounding).
  return rows.map((row) => {
    const lineCount = estimateNameLineCount(row.name, bodyFontPt, nameWidthMm);
    const computed = baseHeightMm + Math.max(0, lineCount - 1) * extraLineHeightMm + AUTOTABLE_ROW_OVERHEAD_MM;
    return clamp(computed, baseHeightMm + AUTOTABLE_ROW_OVERHEAD_MM, 24);
  });
}

function headerRowHeightMm(headerFontPt: number, dayHeaderFontPt: number, dayDateFontPt: number): number {
  const dominantPt = Math.max(headerFontPt, dayHeaderFontPt, dayDateFontPt);
  return clamp(dominantPt * 0.56 + 2.6, 5.3, 9.8);
}

export function buildAttendancePrintLayoutPlan(args: BuildAttendancePrintLayoutArgs): AttendancePrintLayoutPlan {
  const {
    data,
    paperSize,
    includeSignature,
    signature = null,
    forceSinglePage,
    signatureOffsetYMm = 0,
    annotationDisplayMode = "summary-card",
    eventAnnotationDisplayMode = "summary-card",
    inlineLabelStyle = "rotate-90",
  } = args;
  const documentStyle = resolveDocumentStyle(args.documentStyle);
  const shell = resolveAttendanceShellMetrics(documentStyle);
  const useFullPage = paperSize === "full-page";
  const visibleSet = buildVisibleColumnSet(data, args.visibleColumnKeys);
  const signatureMetrics = includeSignature ? estimateSignatureBlockMetrics(signature) : null;

  const visibleDays = data.days.filter((day) => visibleSet.has(day.key));
  const visibleRekapKeys = (["H", "S", "I", "A", "D", "total"] as const).filter((key) => visibleSet.has(key));

  const rows = data.rows.length > 0
    ? data.rows
    : [{
        id: "empty-preview",
        number: 1,
        name: "Belum ada data siswa",
        nisn: "-",
        cells: visibleDays.map((day) => ({ value: day.isHoliday ? "L" : "-", isHoliday: day.isHoliday, hasEvent: day.hasEvent })),
        totals: { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 },
      }];

  // Required content width estimate: 1 No + 1 Name + 1 NISN + days + rekap (approx)
  const minRequiredWidthMm = (visibleSet.has("no") ? 7 : 0)
    + (visibleSet.has("name") ? 22 : 0)
    + (visibleSet.has("nisn") ? 12 : 0)
    + visibleDays.length * 6
    + visibleRekapKeys.length * 7
    + MARGIN_MM.left + MARGIN_MM.right;

  const resolvedPaper = resolveReportPaperSize(paperSize, {
    orientation: "landscape",
    requiredContentWidthMm: minRequiredWidthMm,
  });

  let paper: AttendancePrintPaper = {
    key: paperSize,
    pageWidthMm: resolvedPaper.pageWidthMm,
    pageHeightMm: resolvedPaper.pageHeightMm,
    marginTopMm: MARGIN_MM.top,
    marginRightMm: MARGIN_MM.right,
    marginBottomMm: MARGIN_MM.bottom,
    marginLeftMm: MARGIN_MM.left,
    contentWidthMm: resolvedPaper.pageWidthMm - MARGIN_MM.left - MARGIN_MM.right,
    contentHeightMm: resolvedPaper.pageHeightMm - MARGIN_MM.top - MARGIN_MM.bottom,
  };

  const groupedHolidays = groupAttendanceHolidayRanges(data.holidayItems);
  const groupedEvents = groupAttendanceHolidayRanges(data.eventItems);
  const groupedCustomHolidays = groupedHolidays.filter((g) => g.source !== "national");
  const groupedNationalHolidays = groupedHolidays.filter((g) => g.source === "national");

  const holidayAnnotationGroups = groupedHolidays.map((group) => ({
    ...group,
    _kind: group.source === "national" ? "national" as const : "custom" as const,
  }));
  const eventAnnotationGroups = groupedEvents.map((group) => ({ ...group, _kind: "event" as const }));

  const summaryKeteranganGroups = [
    ...(eventAnnotationDisplayMode === "summary-card" ? eventAnnotationGroups : []),
    ...(annotationDisplayMode === "summary-card" ? holidayAnnotationGroups : []),
  ].sort((a, b) => {
    if (a.startDay !== b.startDay) return a.startDay - b.startDay;
    const order = { event: 0, custom: 1, national: 2 } as const;
    return order[a._kind] - order[b._kind];
  });
  const keterangan = summaryKeteranganGroups.map((g) => ({
    text: g.text,
    tone: g._kind,
  } satisfies AttendancePrintInfoItem));
  const visibleDayNumberToIndex = new Map(
    visibleDays.map((day, index) => [Number.parseInt(day.dateLabel, 10), index]),
  );
  const inlineAnnotationSourceGroups = [
    ...(annotationDisplayMode === "inline-vertical" ? holidayAnnotationGroups : []),
    ...(eventAnnotationDisplayMode === "inline-vertical" ? eventAnnotationGroups : []),
  ].sort((a, b) => {
    if (a.startDay !== b.startDay) return a.startDay - b.startDay;
    const order = { event: 0, custom: 1, national: 2 } as const;
    return order[a._kind] - order[b._kind];
  });
  const shouldRenderInlineAnnotations =
    annotationDisplayMode === "inline-vertical"
    || eventAnnotationDisplayMode === "inline-vertical";
  const inlineAnnotations: AttendanceInlineAnnotationRange[] = shouldRenderInlineAnnotations
    ? (() => {
        const explicitAnnotationDays = new Set(
          inlineAnnotationSourceGroups.flatMap((group) => {
            const days: number[] = [];
            for (let day = group.startDay; day <= group.endDay; day += 1) {
              days.push(day);
            }
            return days;
          }),
        );
        const groupedAnnotations = inlineAnnotationSourceGroups.flatMap((group) => {
          const startColumnIndex = visibleDayNumberToIndex.get(group.startDay);
          const endColumnIndex = visibleDayNumberToIndex.get(group.endDay);
          if (typeof startColumnIndex !== "number" || typeof endColumnIndex !== "number") return [];
          return [{
            key: `${group._kind}-${group.startDay}-${group.endDay}-${group.description}`,
            text: group.description,
            tone: group._kind,
            startDay: group.startDay,
            endDay: group.endDay,
            startColumnIndex,
            endColumnIndex,
          } satisfies AttendanceInlineAnnotationRange];
        });
        const sundayAnnotations = data.days.flatMap((day) => {
          if (annotationDisplayMode !== "inline-vertical") return [];
          if (!day.isHoliday) return [];
          const parsedDate = new Date(day.key);
          if (Number.isNaN(parsedDate.getTime()) || parsedDate.getDay() !== 0) return [];
          const dayNumber = Number.parseInt(day.dateLabel, 10);
          const columnIndex = visibleDayNumberToIndex.get(dayNumber);
          if (!Number.isInteger(dayNumber) || explicitAnnotationDays.has(dayNumber) || typeof columnIndex !== "number") {
            return [];
          }
          return [{
            key: `default-sunday-${day.key}`,
            text: "Hari Minggu",
            tone: "custom",
            startDay: dayNumber,
            endDay: dayNumber,
            startColumnIndex: columnIndex,
            endColumnIndex: columnIndex,
          } satisfies AttendanceInlineAnnotationRange];
        });
        return [...groupedAnnotations, ...sundayAnnotations]
          .sort((left, right) => left.startColumnIndex - right.startColumnIndex || left.endColumnIndex - right.endColumnIndex);
      })()
    : [];

  const summary: AttendancePrintSummary = {
    legend: DEFAULT_LEGEND,
    keterangan,
    events: groupedEvents.map((group) => group.text),
    customHolidays: groupedCustomHolidays.map((group) => group.text),
    nationalHolidays: groupedNationalHolidays.map((group) => group.text),
    holidays: groupedHolidays.map((group) => group.text),
    notes: data.notes,
  };
  const denominator = rows.length * Math.max(1, data.effectiveDays);
  const summaryRows: AttendancePrintSummaryRows = {
    totalLabel: "TOTAL",
    percentLabel: "PERSENTASE",
    percentageByKey: {
      H: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.H, 0), denominator),
      S: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.S, 0), denominator),
      I: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.I, 0), denominator),
      A: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.A, 0), denominator),
      D: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.D, 0), denominator),
      total: formatAttendancePercent(rows.reduce((sum, row) => sum + row.totals.total, 0), denominator),
    },
  };

  // Reserve extra vertical room for the user's downward TTD drag offset so the
  // signature block never gets clipped by the page rectangle in PDF/PNG capture.
  const signatureSafetyMm = includeSignature ? Math.max(0, signatureOffsetYMm) : 0;
  const signatureReserveMm = signatureMetrics
    ? Math.max(signatureMetrics.heightMm + 4, shell.signatureBlock) + signatureSafetyMm
    : 0;
  const summaryContentWidthMm = paper.contentWidthMm;
  const legendHeightMm = estimateLegendHeightMm(summary.legend, summaryContentWidthMm, Math.max(6, documentStyle.metaFontSize - 1.2));
  const notesBaseFontPt = documentStyle.metaFontSize;
  const notesHeightMm = measureInfoBlockHeightMm(summary.notes, summaryContentWidthMm, notesBaseFontPt, shell.infoBlockGap);
  // Legacy fields kept for backwards compat in trace/debug paths
  const eventsHeightMm = 0;
  const customHolidaysHeightMm = 0;
  const nationalHolidaysHeightMm = 0;
  const holidaysHeightMm = 0;

  const reservedShellMm =
    shell.topBanner
    + shell.metaBar
    + shell.contentPaddingY
    + shell.footerBar
    + shell.footerClearance;
  const keteranganFontCandidates = enumerateKeteranganBaseFontCandidates(documentStyle.metaFontSize);
  const minKeteranganBaseFontPt = keteranganFontCandidates[keteranganFontCandidates.length - 1] ?? documentStyle.metaFontSize;
  const minimalSummaryReserveMm = reservedShellMm
    + shell.summaryGap
    + legendHeightMm
    + (summary.keterangan.length > 0
      ? measureInfoBlockHeightMm(summary.keterangan.slice(0, 1), summaryContentWidthMm, minKeteranganBaseFontPt, shell.infoBlockGap)
      : 0);

  const firstPass = autoFitTable({
    rows,
    visibleDays,
    visibleRekapCount: visibleRekapKeys.length,
    contentWidthMm: paper.contentWidthMm,
    contentHeightMm: paper.contentHeightMm,
    visibleSet,
    documentStyle,
    reservedHeightMm: minimalSummaryReserveMm,
    forceSinglePage,
  });
  const firstPassTableHeaderHeightMm = firstPass.table.headerRowHeightMm * 2;
  const firstPassMaxTableTailSummaryMm = Math.max(
    0,
    paper.contentHeightMm - firstPassTableHeaderHeightMm - (firstPass.summaryRowHeightMm * 2) - TABLE_BOTTOM_SAFETY_MM - 10,
  );

  let selectedSinglePageFontPt: number | null = null;
  let selectedSinglePageSummaryInfoHeightMm = 0;
  for (const candidateFontPt of keteranganFontCandidates) {
    const candidateInfoHeightMm =
      shell.summaryGap
      + legendHeightMm
      + (summary.keterangan.length > 0
        ? measureInfoBlockHeightMm(summary.keterangan, summaryContentWidthMm, candidateFontPt, shell.infoBlockGap)
        : 0)
      + notesHeightMm;
    if (candidateInfoHeightMm + signatureReserveMm <= firstPassMaxTableTailSummaryMm + 0.01) {
      selectedSinglePageFontPt = candidateFontPt;
      selectedSinglePageSummaryInfoHeightMm = candidateInfoHeightMm;
      break;
    }
  }

  const reservedLastPageMm = useFullPage
    ? reservedShellMm + signatureReserveMm
    : selectedSinglePageFontPt
    ? reservedShellMm + selectedSinglePageSummaryInfoHeightMm + signatureReserveMm
    : minimalSummaryReserveMm;

  const {
    table,
    mode,
    singlePageFits,
    rowHeightsMm,
    summaryRowHeightMm,
    stageCandidates,
    tableRightSlackMm,
    tableLeftSlackMm,
    rekapGroupWidthMm,
    daysGroupWidthMm,
  } = autoFitTable({
    rows,
    visibleDays,
    visibleRekapCount: visibleRekapKeys.length,
    contentWidthMm: paper.contentWidthMm,
    contentHeightMm: paper.contentHeightMm,
    visibleSet,
    documentStyle,
    reservedHeightMm: reservedLastPageMm,
    forceSinglePage,
  });
  const shouldForceSinglePage = !useFullPage && forceSinglePage && singlePageFits;
  const plannerWarnings: string[] = [];

  const tableHeaderHeightMm = table.headerRowHeightMm * 2;
  const availableLastPageMm = Math.max(10, paper.contentHeightMm - reservedLastPageMm - tableHeaderHeightMm - (summaryRowHeightMm * 2) - TABLE_BOTTOM_SAFETY_MM);
  const availableRegularPageMm =
    Math.max(10, paper.contentHeightMm - reservedShellMm - shell.continuationNote - tableHeaderHeightMm - TABLE_BOTTOM_SAFETY_MM);
  const bodyRowsTotalHeightMm = rowHeightsMm.reduce((sum, height) => sum + height, 0);
  const tablePlannedTotalHeightMm = tableHeaderHeightMm + bodyRowsTotalHeightMm + (summaryRowHeightMm * 2);
  const overflowRisk = tableRightSlackMm > TABLE_SLACK_TOLERANCE_MM || (!useFullPage && !singlePageFits);
  if (tableRightSlackMm > TABLE_SLACK_TOLERANCE_MM) {
    plannerWarnings.push(`Lebar tabel belum sinkron penuh dengan frame cetak. Slack kanan tersisa ${tableRightSlackMm.toFixed(2)}mm.`);
  }
  if (forceSinglePage && !singlePageFits && !useFullPage) {
    plannerWarnings.push("Mode satu halaman tidak muat penuh, planner beralih ke multi-page terencana.");
  }
  const tableStartYMm = paper.marginTopMm + shell.topBanner + shell.metaBar + shell.contentPaddingY;
  const tableMaxBottomRegularMm = paper.pageHeightMm - paper.marginBottomMm - shell.footerBar - shell.footerClearance - shell.continuationNote - TABLE_BOTTOM_SAFETY_MM;
  const tableMaxBottomLastMm = paper.pageHeightMm - paper.marginBottomMm - shell.footerBar - shell.footerClearance - TABLE_BOTTOM_SAFETY_MM;

  const pages: AttendancePrintPage[] = [];
  const pushTablePage = (page: Omit<AttendancePrintPage, "kind" | "summaryContent">) => {
    pages.push({
      ...page,
      kind: "table",
      summaryContent: null,
    });
  };

  if (useFullPage) {
    pushTablePage({
      key: "p-0",
      pageNumber: 1,
      rowStart: 0,
      rowEnd: rows.length,
      rowHeightsMm,
      tableStartYMm,
      tableMaxBottomMm: Number.MAX_SAFE_INTEGER,
      plannedBodyHeightMm: bodyRowsTotalHeightMm,
      plannedSummaryHeightMm: summaryRowHeightMm * 2,
      plannedFooterReserveMm: shell.footerBar,
      plannedHeaderReserveMm: shell.topBanner + shell.metaBar + shell.contentPaddingY + tableHeaderHeightMm,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: bodyRowsTotalHeightMm,
      hasDocumentHeader: true,
      hasTableHeader: true,
      hasContinuationNote: false,
      showSummary: true,
      hasSummaryRows: true,
      drawSignatureHere: false,
      isSignatureOnlyPage: false,
      isLastPage: true,
    });
  } else if (shouldForceSinglePage) {
    const plannedBodyHeightMm = bodyRowsTotalHeightMm;
    pushTablePage({
      key: "p-0",
      pageNumber: 1,
      rowStart: 0,
      rowEnd: rows.length,
      rowHeightsMm,
      tableStartYMm,
      tableMaxBottomMm: tableMaxBottomLastMm,
      plannedBodyHeightMm,
      plannedSummaryHeightMm: summaryRowHeightMm * 2,
      plannedFooterReserveMm: shell.footerBar,
      plannedHeaderReserveMm: shell.topBanner + shell.metaBar + shell.contentPaddingY + tableHeaderHeightMm,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: availableLastPageMm,
      hasDocumentHeader: true,
      hasTableHeader: true,
      hasContinuationNote: false,
      showSummary: true,
      hasSummaryRows: true,
      drawSignatureHere: false,
      isSignatureOnlyPage: false,
      isLastPage: true,
    });
  } else if (rowHeightsMm.reduce((sum, height) => sum + height, 0) <= availableLastPageMm) {
    const plannedBodyHeightMm = bodyRowsTotalHeightMm;
    pushTablePage({
      key: "p-0",
      pageNumber: 1,
      rowStart: 0,
      rowEnd: rows.length,
      rowHeightsMm,
      tableStartYMm,
      tableMaxBottomMm: tableMaxBottomLastMm,
      plannedBodyHeightMm,
      plannedSummaryHeightMm: summaryRowHeightMm * 2,
      plannedFooterReserveMm: shell.footerBar,
      plannedHeaderReserveMm: shell.topBanner + shell.metaBar + shell.contentPaddingY + tableHeaderHeightMm,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: availableLastPageMm,
      hasDocumentHeader: true,
      hasTableHeader: true,
      hasContinuationNote: false,
      showSummary: true,
      hasSummaryRows: true,
      drawSignatureHere: false,
      isSignatureOnlyPage: false,
      isLastPage: true,
    });
  } else {
    let cursor = 0;
    let pageIdx = 0;
    const takeRowsForHeight = (start: number, availableMm: number) => {
      let end = start;
      let usedMm = 0;
      while (end < rowHeightsMm.length) {
        const nextHeight = rowHeightsMm[end];
        if (end > start && usedMm + nextHeight > availableMm) break;
        usedMm += nextHeight;
        end += 1;
        if (usedMm >= availableMm) break;
      }
      return Math.max(start + 1, end);
    };

    while (cursor < rows.length) {
      const remainingHeightMm = rowHeightsMm.slice(cursor).reduce((sum, height) => sum + height, 0);
      const willFitAsLastPage = remainingHeightMm <= availableLastPageMm;
      const next = takeRowsForHeight(cursor, willFitAsLastPage ? availableLastPageMm : availableRegularPageMm);
      const isLastPage = next >= rows.length;
      const pageRowHeights = rowHeightsMm.slice(cursor, next);
      const plannedBodyHeightMm = pageRowHeights.reduce((sum, height) => sum + height, 0);
      pushTablePage({
        key: `p-${pageIdx}`,
        pageNumber: pageIdx + 1,
        rowStart: cursor,
        rowEnd: next,
        rowHeightsMm: pageRowHeights,
        tableStartYMm,
        tableMaxBottomMm: isLastPage ? tableMaxBottomLastMm : tableMaxBottomRegularMm,
        plannedBodyHeightMm,
        plannedSummaryHeightMm: isLastPage ? summaryRowHeightMm * 2 : 0,
        plannedFooterReserveMm: shell.footerBar + (isLastPage ? 0 : shell.continuationNote),
        plannedHeaderReserveMm: shell.topBanner + shell.metaBar + shell.contentPaddingY + tableHeaderHeightMm,
        pageContentHeightMm: paper.contentHeightMm,
        availableBodyHeightMm: isLastPage ? availableLastPageMm : availableRegularPageMm,
        hasDocumentHeader: true,
        hasTableHeader: true,
        hasContinuationNote: !isLastPage,
        showSummary: isLastPage,
        hasSummaryRows: isLastPage,
        drawSignatureHere: false,
        isSignatureOnlyPage: false,
        isLastPage,
      });
      cursor = next;
      pageIdx += 1;
      if (isLastPage) break;
    }
  }

  // Aggregate totals
  const totals = rows.reduce<AttendancePrintRow["totals"]>((acc, row) => {
    acc.H += row.totals.H;
    acc.S += row.totals.S;
    acc.I += row.totals.I;
    acc.A += row.totals.A;
    acc.D += row.totals.D;
    acc.total += row.totals.total;
    return acc;
  }, { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 });

  let lastTablePageIndex = pages.length - 1;
  while (lastTablePageIndex > 0 && pages[lastTablePageIndex]?.kind !== "table") {
    lastTablePageIndex -= 1;
  }
  const lastTablePage = pages[lastTablePageIndex];
  const lastPageRowsHeightMm = lastTablePage ? lastTablePage.rowHeightsMm.reduce((sum, height) => sum + height, 0) : 0;
  const tableEndYMm = tableStartYMm + (table.headerRowHeightMm * 2) + lastPageRowsHeightMm + (lastTablePage?.hasSummaryRows ? summaryRowHeightMm * 2 : 0);
  let printableBottomMm = paper.pageHeightMm - paper.marginBottomMm - shell.footerBar - shell.footerClearance;

  const continuationSummaryStartYMm = paper.marginTopMm + Math.max(0, shell.topBanner - 2);
  const firstSummaryAvailableMm = Math.max(0, printableBottomMm - tableEndYMm);
  const continuationSummaryAvailableMm = Math.max(0, printableBottomMm - continuationSummaryStartYMm);
  const chosenKeteranganFontPt = useFullPage
    ? documentStyle.metaFontSize
    : selectedSinglePageFontPt ?? minKeteranganBaseFontPt;
  const totalKeteranganHeightMm = summary.keterangan.length > 0
    ? measureInfoBlockHeightMm(summary.keterangan, summaryContentWidthMm, chosenKeteranganFontPt, shell.infoBlockGap)
    : 0;

  const buildSummaryPageContent = (
    availableMm: number,
    showLegend: boolean,
    remainingKeterangan: AttendancePrintInfoItem[],
    remainingNotes: string[],
  ): AttendancePrintPageSummaryContent => {
    let usedMm = shell.summaryGap + (showLegend ? legendHeightMm : 0);
    let keteranganItems: AttendancePrintInfoItem[] = [];
    let notesItems: string[] = [];

    if (remainingKeterangan.length > 0) {
      const availableForKeteranganMm = Math.max(0, availableMm - usedMm);
      const fitsAllKeterangan = usedMm + measureInfoBlockHeightMm(
        remainingKeterangan,
        summaryContentWidthMm,
        chosenKeteranganFontPt,
        shell.infoBlockGap,
      ) <= availableMm + 0.01;
      const takeCount = fitsAllKeterangan
        ? remainingKeterangan.length
        : takeInfoItemsForHeight(
            remainingKeterangan,
            summaryContentWidthMm,
            chosenKeteranganFontPt,
            availableForKeteranganMm,
            shell.infoBlockGap,
          );
      keteranganItems = remainingKeterangan.splice(0, takeCount);
      usedMm += measureInfoBlockHeightMm(keteranganItems, summaryContentWidthMm, chosenKeteranganFontPt, shell.infoBlockGap);
    }

    if (remainingKeterangan.length === 0 && remainingNotes.length > 0) {
      const availableForNotesMm = Math.max(0, availableMm - usedMm);
      const fitsAllNotes = usedMm + measureInfoBlockHeightMm(
        remainingNotes,
        summaryContentWidthMm,
        notesBaseFontPt,
        shell.infoBlockGap,
      ) <= availableMm + 0.01;
      const takeCount = fitsAllNotes
        ? remainingNotes.length
        : takeInfoItemsForHeight(
            remainingNotes,
            summaryContentWidthMm,
            notesBaseFontPt,
            availableForNotesMm,
            shell.infoBlockGap,
          );
      notesItems = remainingNotes.splice(0, takeCount);
      usedMm += measureInfoBlockHeightMm(notesItems, summaryContentWidthMm, notesBaseFontPt, shell.infoBlockGap);
    }

    return {
      mode: showLegend ? "table-tail" : "continuation",
      showLegend,
      legendHeightMm: showLegend ? legendHeightMm : 0,
      keteranganTitle: keteranganItems.length > 0 ? (showLegend ? "Keterangan" : "Keterangan (Lanjutan)") : null,
      keteranganItems,
      keteranganFontPt: chosenKeteranganFontPt,
      keteranganHeightMm: measureInfoBlockHeightMm(keteranganItems, summaryContentWidthMm, chosenKeteranganFontPt, shell.infoBlockGap),
      notesTitle: notesItems.length > 0 ? "Catatan Siswa" : null,
      notesItems,
      notesFontPt: notesBaseFontPt,
      notesHeightMm: measureInfoBlockHeightMm(notesItems, summaryContentWidthMm, notesBaseFontPt, shell.infoBlockGap),
      contentHeightMm: usedMm,
      reservedSignatureHeightMm: 0,
    };
  };

  const remainingKeterangan = [...summary.keterangan];
  const remainingNotes = [...summary.notes];
  const summaryPageContents: AttendancePrintPageSummaryContent[] = [];
  if (useFullPage) {
    summaryPageContents.push({
      mode: "table-tail",
      showLegend: true,
      legendHeightMm,
      keteranganTitle: summary.keterangan.length > 0 ? "Keterangan" : null,
      keteranganItems: [...summary.keterangan],
      keteranganFontPt: chosenKeteranganFontPt,
      keteranganHeightMm: summary.keterangan.length > 0
        ? measureInfoBlockHeightMm(summary.keterangan, summaryContentWidthMm, chosenKeteranganFontPt, shell.infoBlockGap)
        : 0,
      notesTitle: summary.notes.length > 0 ? "Catatan Siswa" : null,
      notesItems: [...summary.notes],
      notesFontPt: notesBaseFontPt,
      notesHeightMm: measureInfoBlockHeightMm(summary.notes, summaryContentWidthMm, notesBaseFontPt, shell.infoBlockGap),
      contentHeightMm:
        shell.summaryGap
        + legendHeightMm
        + (summary.keterangan.length > 0
          ? measureInfoBlockHeightMm(summary.keterangan, summaryContentWidthMm, chosenKeteranganFontPt, shell.infoBlockGap)
          : 0)
        + measureInfoBlockHeightMm(summary.notes, summaryContentWidthMm, notesBaseFontPt, shell.infoBlockGap),
      reservedSignatureHeightMm: signatureReserveMm,
    });
    remainingKeterangan.length = 0;
    remainingNotes.length = 0;
  } else {
    let summaryGuard = 0;
    while ((summaryPageContents.length === 0 || remainingKeterangan.length > 0 || remainingNotes.length > 0) && summaryGuard < 100) {
      const isFirst = summaryPageContents.length === 0;
      summaryPageContents.push(buildSummaryPageContent(
        isFirst ? firstSummaryAvailableMm : continuationSummaryAvailableMm,
        isFirst,
        remainingKeterangan,
        remainingNotes,
      ));
      summaryGuard += 1;
    }
    if (summaryGuard >= 100) {
      plannerWarnings.push("Pagination Keterangan mencapai batas pengaman loop.");
    }
  }

  if (summaryPageContents.length === 0) {
    summaryPageContents.push({
      mode: "table-tail",
      showLegend: true,
      legendHeightMm,
      keteranganTitle: null,
      keteranganItems: [],
      keteranganFontPt: chosenKeteranganFontPt,
      keteranganHeightMm: 0,
      notesTitle: null,
      notesItems: [],
      notesFontPt: notesBaseFontPt,
      notesHeightMm: 0,
      contentHeightMm: shell.summaryGap + legendHeightMm,
      reservedSignatureHeightMm: 0,
    });
  }

  if (lastTablePage) {
    lastTablePage.summaryContent = summaryPageContents[0];
    lastTablePage.showSummary = true;
  }

  for (let index = 1; index < summaryPageContents.length; index += 1) {
    pages.push({
      key: `p-${pages.length}-summary-${index}`,
      kind: "summary-continuation",
      pageNumber: pages.length + 1,
      rowStart: rows.length,
      rowEnd: rows.length,
      rowHeightsMm: [],
      tableStartYMm: continuationSummaryStartYMm,
      tableMaxBottomMm: tableMaxBottomLastMm,
      plannedBodyHeightMm: 0,
      plannedSummaryHeightMm: 0,
      plannedFooterReserveMm: shell.footerBar,
      plannedHeaderReserveMm: shell.topBanner + shell.contentPaddingY,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: continuationSummaryAvailableMm,
      hasDocumentHeader: true,
      hasTableHeader: false,
      hasContinuationNote: false,
      showSummary: true,
      hasSummaryRows: false,
      drawSignatureHere: false,
      isSignatureOnlyPage: false,
      isLastPage: false,
      summaryContent: summaryPageContents[index],
    });
  }

  const summaryInfoHeightMm = summaryPageContents[summaryPageContents.length - 1]?.contentHeightMm ?? 0;

  if (useFullPage) {
    const resolvedFullPage = resolveReportPaperSize("full-page", {
      orientation: "landscape",
      requiredContentWidthMm: paper.pageWidthMm,
      requiredContentHeightMm:
        tableEndYMm
        + summaryInfoHeightMm
        + (includeSignature && signatureMetrics ? shell.signatureGap + signatureMetrics.heightMm + 3 : 0)
        + paper.marginBottomMm
        + shell.footerBar
        + shell.footerClearance,
    });
    paper = {
      ...paper,
      pageWidthMm: resolvedFullPage.pageWidthMm,
      pageHeightMm: resolvedFullPage.pageHeightMm,
      contentWidthMm: resolvedFullPage.pageWidthMm - paper.marginLeftMm - paper.marginRightMm,
      contentHeightMm: resolvedFullPage.pageHeightMm - paper.marginTopMm - paper.marginBottomMm,
    };
    printableBottomMm = paper.pageHeightMm - paper.marginBottomMm - shell.footerBar - shell.footerClearance;
    const fullPageBottomMm = printableBottomMm - TABLE_BOTTOM_SAFETY_MM;
    const fullPageAvailableBodyMm = Math.max(
      bodyRowsTotalHeightMm,
      paper.contentHeightMm - reservedShellMm - tableHeaderHeightMm - (summaryRowHeightMm * 2) - TABLE_BOTTOM_SAFETY_MM,
    );
    pages[0] = {
      ...pages[0],
      tableMaxBottomMm: fullPageBottomMm,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: fullPageAvailableBodyMm,
      isLastPage: true,
    };
  }

  pages.forEach((page, index) => {
    page.pageNumber = index + 1;
    page.isLastPage = index === pages.length - 1;
  });

  const keteranganHeightMm = totalKeteranganHeightMm;
  const lastPage = pages[pages.length - 1];
  const provisionalSignatureZoneTopMm = (lastPage?.kind === "table" ? tableEndYMm : continuationSummaryStartYMm)
    + summaryInfoHeightMm
    + (includeSignature ? shell.signatureGap : 0);
  const provisionalSignatureZoneHeightMm = includeSignature
    ? Math.max(0, printableBottomMm - provisionalSignatureZoneTopMm)
    : 0;

  // SMART SIGNATURE PAGINATION
  // ──────────────────────────────────────────────────────────────────────
  // Three modes:
  //  1. Manual page index → user explicitly chose a page; honor unless invalid.
  //  2. Auto: if signature won't fit safely on the table's last page, append
  //     a dedicated trailing "signature-only" page so the TTD never sits on
  //     top of the data table.
  //  3. Auto: signature fits → keep on table's last page.
  let signatureOnDedicatedPage = false;
  let signatureZoneTopMm = provisionalSignatureZoneTopMm;
  let signatureZoneHeightMm = provisionalSignatureZoneHeightMm;
  // Comfortable spacing — signature height + shared breathing buffer.
  const minimumViableSignatureZoneMm = signatureMetrics
    ? signatureMetrics.heightMm + ATTENDANCE_LAYOUT_TOLERANCE_MM.minimumViableSignatureZone
    : 0;
  const manualPageIndex = signature?.signaturePageIndex;
  const wantsManualPageMoveToNewPage = includeSignature
    && typeof manualPageIndex === "number"
    && manualPageIndex >= pages.length;

  if (
    includeSignature
    && signatureMetrics
    && lastPage
    && !shouldForceSinglePage
    && !useFullPage
    && (
      wantsManualPageMoveToNewPage
      || provisionalSignatureZoneHeightMm < minimumViableSignatureZoneMm
    )
  ) {
    const signaturePage: AttendancePrintPage = {
      key: `p-${pages.length}-sig`,
      kind: "signature-only",
      pageNumber: pages.length + 1,
      rowStart: rows.length,
      rowEnd: rows.length,
      rowHeightsMm: [],
      tableStartYMm,
      tableMaxBottomMm: tableMaxBottomLastMm,
      plannedBodyHeightMm: 0,
      plannedSummaryHeightMm: 0,
      plannedFooterReserveMm: shell.footerBar,
      plannedHeaderReserveMm: shell.topBanner + shell.contentPaddingY,
      pageContentHeightMm: paper.contentHeightMm,
      availableBodyHeightMm: paper.contentHeightMm - reservedShellMm,
      hasDocumentHeader: true,
      hasTableHeader: false,
      hasContinuationNote: false,
      showSummary: false,
      hasSummaryRows: false,
      drawSignatureHere: true,
      isSignatureOnlyPage: true,
      isLastPage: true,
      summaryContent: null,
    };
    if (lastPage) {
      // The previous "last" table page keeps the legend + Keterangan summary
      // and the TOTAL/PERSENTASE rows, but MUST NOT redraw the signature —
      // that now lives exclusively on the dedicated trailing page below.
      lastPage.isLastPage = false;
      lastPage.drawSignatureHere = false;
      // Keep hasSummaryRows = true so TOTAL & PERSENTASE remain on the table.
      // Keep showSummary = true so legend + Keterangan stay on the table page.
    }
    pages.push(signaturePage);
    signatureOnDedicatedPage = true;
    signatureZoneTopMm = paper.marginTopMm + shell.topBanner + shell.contentPaddingY + 6;
    signatureZoneHeightMm = printableBottomMm - signatureZoneTopMm;
  }

  if (includeSignature && signatureMetrics && !signatureOnDedicatedPage && lastPage) {
    lastPage.drawSignatureHere = true;
  }

  const summaryLayout: AttendancePrintSummaryLayout = {
    tableStartYMm,
    tableEndYMm,
    legendHeightMm,
    keteranganHeightMm,
    eventsHeightMm,
    holidaysHeightMm,
    notesHeightMm,
    contentHeightMm: summaryInfoHeightMm,
    signatureZoneTopMm,
    signatureZoneHeightMm,
    printableBottomMm,
    signatureOnDedicatedPage,
    keteranganFontPt: chosenKeteranganFontPt,
    continuationPageCount: Math.max(0, summaryPageContents.length - 1),
  };

  const finalLastPage = pages[pages.length - 1];
  let signaturePlacement = includeSignature && signature && signatureMetrics && finalLastPage
    ? resolveSignaturePlacementFromBounds({
        pageIndex: finalLastPage.pageNumber - 1,
        signature,
        signatureMetrics,
        pageWidthMm: paper.pageWidthMm,
        pageHeightMm: paper.pageHeightMm,
        marginLeftMm: paper.marginLeftMm,
        marginRightMm: paper.marginRightMm,
        marginTopMm: paper.marginTopMm,
        marginBottomMm: paper.marginBottomMm,
        footerHeightMm: shell.footerBar,
        safeZoneTopMm: signatureZoneTopMm,
      })
    : null;

  // Default TTD anchor: TOP-RIGHT of safe zone + small breathing room (3mm).
  // Only when user hasn't dragged manually.
  if (
    signaturePlacement
    && signature
    && signature.manualXPercent == null
    && signature.manualYPercent == null
    && Math.abs(signatureOffsetYMm) < 0.05
    && (signature.signaturePreset ?? "bottom-right") !== "follow-content"
  ) {
    const breathingRoomMm = 3;
    const desiredXMm = signaturePlacement.safeZone.safeXMm
      + Math.max(0, signaturePlacement.safeZone.safeWidthMm - signaturePlacement.widthMm);
    const desiredYMm = signaturePlacement.safeZone.safeYMm + breathingRoomMm;
    const maxXMm = signaturePlacement.movementBounds.safeXMm
      + Math.max(0, signaturePlacement.movementBounds.safeWidthMm - signaturePlacement.widthMm);
    const maxYMm = signaturePlacement.movementBounds.safeYMm
      + Math.max(0, signaturePlacement.movementBounds.safeHeightMm - signaturePlacement.heightMm);
    const clampedXMm = clamp(desiredXMm, signaturePlacement.movementBounds.safeXMm, maxXMm);
    const clampedYMm = clamp(desiredYMm, signaturePlacement.movementBounds.safeYMm, maxYMm);
    signaturePlacement = { ...signaturePlacement, xMm: clampedXMm, yMm: clampedYMm };
  }

  // Safety clamp: when the page is packed and the signature zone is zero or
  // negative (no real room), push the signature to the bottom of the printable
  // area so it does NOT overlap the data table. We accept it may clip slightly
  // at the page bottom — that is better than covering student data.
  if (signaturePlacement && signatureMetrics) {
    const absoluteMinYMm = paper.marginTopMm; // can't go above top margin
    const absoluteMaxYMm = Math.max(
      absoluteMinYMm + signatureMetrics.heightMm,
      printableBottomMm - signatureMetrics.heightMm,
    );
    if (signaturePlacement.yMm > absoluteMaxYMm || signatureZoneHeightMm < 4) {
      // Anchor to printable bottom - signature height, right-aligned
      const safeY = clamp(absoluteMaxYMm - 2, absoluteMinYMm, absoluteMaxYMm);
      signaturePlacement = {
        ...signaturePlacement,
        yMm: safeY,
      };
    }
  }

  const pagePlans: AttendancePlannerPageTrace[] = pages.map((page) => ({
    key: page.key,
    pageNumber: page.pageNumber,
    rowStart: page.rowStart,
    rowEnd: page.rowEnd,
    rowCount: page.rowEnd - page.rowStart,
    rowHeightsMm: page.rowHeightsMm,
    tableStartYMm: page.tableStartYMm,
    tableMaxBottomMm: page.tableMaxBottomMm,
    plannedBodyHeightMm: Number(page.plannedBodyHeightMm.toFixed(2)),
    plannedSummaryHeightMm: Number(page.plannedSummaryHeightMm.toFixed(2)),
    plannedFooterReserveMm: Number(page.plannedFooterReserveMm.toFixed(2)),
    plannedHeaderReserveMm: Number(page.plannedHeaderReserveMm.toFixed(2)),
    pageContentHeightMm: Number(page.pageContentHeightMm.toFixed(2)),
    availableBodyHeightMm: Number(page.availableBodyHeightMm.toFixed(2)),
    hasDocumentHeader: page.hasDocumentHeader,
    hasTableHeader: page.hasTableHeader,
    hasContinuationNote: page.hasContinuationNote,
    hasSummary: page.showSummary,
    sliceOverflowBeforeRender: page.plannedBodyHeightMm > page.availableBodyHeightMm,
  }));
  if (pagePlans[0]?.rowCount === 0) {
    plannerWarnings.push("Halaman pertama direncanakan tanpa baris tabel, berisiko menjadi halaman kosong.");
  }
  pagePlans.forEach((pagePlan) => {
    if (pagePlan.sliceOverflowBeforeRender) {
      plannerWarnings.push(`Slice halaman ${pagePlan.pageNumber} melebihi ruang body tersedia sebelum dirender.`);
    }
  });
  const plannerTrace: AttendancePlannerTrace = {
    paperSize,
    paperWidthMm: paper.pageWidthMm,
    paperHeightMm: paper.pageHeightMm,
    contentWidthMm: paper.contentWidthMm,
    contentHeightMm: paper.contentHeightMm,
    tableWidthMm: table.tableWidthMm,
    tableLeftSlackMm,
    tableRightSlackMm,
    rekapGroupWidthMm,
    daysGroupWidthMm,
    plannedPageCount: pages.length,
    bodyRowsTotalHeightMm: Number(bodyRowsTotalHeightMm.toFixed(2)),
    tablePlannedTotalHeightMm: Number(tablePlannedTotalHeightMm.toFixed(2)),
    reservedLastPageMm: Number(reservedLastPageMm.toFixed(2)),
    reservedRegularPageMm: Number(reservedShellMm.toFixed(2)),
    overflowRisk,
    plannerWarnings,
    chosenStageMode: mode,
    stageCandidates,
    pagePlans,
  };

  return {
    shell,
    paper,
    table,
    visibleColumnKeys: visibleSet,
    visibleDays,
    visibleRekapKeys,
    annotationDisplayMode,
    eventAnnotationDisplayMode,
    inlineLabelStyle,
    inlineAnnotations,
    rows,
    rowHeightsMm,
    pages,
    summary,
    summaryRows,
    summaryLayout,
    signaturePlacement,
    plannedPageCount: pages.length,
    bodyRowsTotalHeightMm: Number(bodyRowsTotalHeightMm.toFixed(2)),
    tablePlannedTotalHeightMm: Number(tablePlannedTotalHeightMm.toFixed(2)),
    reservedLastPageMm: Number(reservedLastPageMm.toFixed(2)),
    reservedRegularPageMm: Number(reservedShellMm.toFixed(2)),
    overflowRisk,
    plannerWarnings,
    fit: {
      mode,
      appliedScale: 1,
      forceSinglePage: shouldForceSinglePage || useFullPage,
    },
    totals,
    debug: {
      planner: plannerTrace,
    },
  };
}

/** mm → preview px */
export function mmToPreviewPx(mm: number): number {
  return mm * PX_PER_MM;
}

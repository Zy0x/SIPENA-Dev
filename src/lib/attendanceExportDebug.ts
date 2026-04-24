import type { ReportPaperSize } from "@/lib/reportExportLayout";
import type { AttendanceFitMode } from "@/lib/attendancePrintLayout";

export type AttendanceExportMismatchKind =
  | "planned_page_count_mismatch"
  | "extra_pdf_page_inserted"
  | "blank_first_page_risk"
  | "table_right_slack_too_small"
  | "slice_overflow_before_render"
  | "header_footer_page_number_mismatch";

export interface AttendanceExportMismatch {
  kind: AttendanceExportMismatchKind;
  severity: "info" | "warning" | "error";
  message: string;
  pageNumber?: number;
  details?: Record<string, unknown>;
}

export interface AttendancePlannerStageTrace {
  mode: AttendanceFitMode;
  headerPt: number;
  bodyPt: number;
  padMm: number;
  nameMin: number;
  nisnMin: number;
  rekapMin: number;
  dayMin: number;
  tableWidthMm: number;
  dayWidthMm: number;
  rekapWidthMm: number;
  nameWidthMm: number;
  nisnWidthMm: number;
  headerRowHeightMm: number;
  bodyRowsTotalHeightMm: number;
  summaryRowsHeightMm: number;
  reservedHeightMm: number;
  totalHeightMm: number;
  fits: boolean;
}

export interface AttendancePlannerPageTrace {
  key: string;
  pageNumber: number;
  rowStart: number;
  rowEnd: number;
  rowCount: number;
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
  hasSummary: boolean;
  sliceOverflowBeforeRender: boolean;
}

export interface AttendancePlannerTrace {
  paperSize: ReportPaperSize;
  paperWidthMm: number;
  paperHeightMm: number;
  contentWidthMm: number;
  contentHeightMm: number;
  tableWidthMm: number;
  tableLeftSlackMm: number;
  tableRightSlackMm: number;
  rekapGroupWidthMm: number;
  daysGroupWidthMm: number;
  plannedPageCount: number;
  bodyRowsTotalHeightMm: number;
  tablePlannedTotalHeightMm: number;
  reservedLastPageMm: number;
  reservedRegularPageMm: number;
  overflowRisk: boolean;
  plannerWarnings: string[];
  chosenStageMode: AttendanceFitMode;
  stageCandidates: AttendancePlannerStageTrace[];
  pagePlans: AttendancePlannerPageTrace[];
}

export interface AttendancePdfRuntimeTrace {
  plannedPageNumber: number;
  docPageBeforeTable: number;
  docPageAfterTable: number;
  autoTableFinalY: number | null;
  tableOverflowDetected: boolean;
  extraPagesInserted: number;
  bodyRowCount: number;
  summaryRowsIncluded: number;
  actualPageNumbers: number[];
  headerDrawn: boolean;
  footerDrawn: boolean;
  footerLabel: string;
}

export interface AttendancePngRuntimeTrace {
  format: "png-hd" | "png-4k";
  scale: number;
  renderedPageCount: number;
  wrapperWidthPx: number;
  wrapperHeightPx: number;
  canvasWidthPx: number;
  canvasHeightPx: number;
  pageImageNames?: string[];
  archiveFileName?: string | null;
}

export interface AttendanceTraceLogEntry {
  phase: string;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

export interface AttendancePreviewTrace {
  renderedPageCount: number;
  rowHeightsByPage: number[][];
  logs: AttendanceTraceLogEntry[];
  summaryPlacement: {
    tableStartYMm: number;
    tableEndYMm: number;
    legendHeightMm: number;
    eventsHeightMm: number;
    holidaysHeightMm: number;
    notesHeightMm: number;
    contentHeightMm: number;
    signatureZoneTopMm: number;
    signatureZoneHeightMm: number;
  };
}

export interface AttendanceExportTrace {
  kind: "attendance-export-trace";
  timestamp: string;
  input: {
    className: string;
    monthLabel: string;
    rowCount: number;
    visibleColumns: string[];
    visibleDayCount: number;
    visibleRekapKeys: string[];
    paperSize: ReportPaperSize;
    autoFitOnePage: boolean;
    includeSignature: boolean;
  };
  planner: AttendancePlannerTrace;
  preview: AttendancePreviewTrace;
  pdfRuntime: AttendancePdfRuntimeTrace[];
  pngRuntime: AttendancePngRuntimeTrace[];
  downloads: Array<{
    kind: "pdf" | "png" | "zip" | "trace-json";
    fileName: string;
    timestamp: string;
  }>;
  mismatch: AttendanceExportMismatch[];
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Set) return [...value];
  if (Array.isArray(value)) return value.map((item) => normalizeValue(item));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested)]),
    );
  }
  return value;
}

export function serializeAttendanceExportTrace(trace: AttendanceExportTrace) {
  return JSON.stringify(normalizeValue(trace), null, 2);
}

export function downloadAttendanceExportTrace(trace: AttendanceExportTrace, fileName?: string) {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  const blob = new Blob([serializeAttendanceExportTrace(trace)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const resolvedFileName = fileName || `attendance-export-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  anchor.href = url;
  anchor.download = resolvedFileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  return resolvedFileName;
}

export function persistAttendanceExportTrace(trace: AttendanceExportTrace) {
  if (typeof window === "undefined") return;
  const storageKey = "attendance_export_trace_history";
  const nextEntry = normalizeValue(trace);
  const current = window.localStorage.getItem(storageKey);
  const parsed = current ? JSON.parse(current) : [];
  const history = Array.isArray(parsed) ? parsed : [];
  history.unshift(nextEntry);
  window.localStorage.setItem(storageKey, JSON.stringify(history.slice(0, 5)));
}

export function collectTraceMismatches(trace: AttendanceExportTrace): AttendanceExportMismatch[] {
  const mismatches = [...trace.mismatch];

  if (trace.pdfRuntime.length > 0 && trace.planner.plannedPageCount !== trace.pdfRuntime.length) {
    mismatches.push({
      kind: "planned_page_count_mismatch",
      severity: "error",
      message: `Planner membuat ${trace.planner.plannedPageCount} halaman, tetapi runtime PDF merekam ${trace.pdfRuntime.length} halaman planned.`,
    });
  }

  return mismatches;
}

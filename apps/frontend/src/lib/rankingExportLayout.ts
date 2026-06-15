import type { ExportColumn, ReportPaperSize } from "./reportExportLayout";
import {
  createDefaultReportDocumentStyle,
  resolveDocumentStyle,
  resolveReportPaperSize,
  type ReportDocumentStyle,
} from "./reportExportLayoutV2";
import { pdfEffectiveFontSize } from "./exportEngine/sharedMetrics";

const RANKING_EXPORT_PAGE_MARGIN_MM = 16;
const RANKING_COMPACT_MIN_COLUMN_WIDTH_MM = 8;
const RANKING_INDEX_COLUMN_WIDTH_MM = 8;
const RANKING_NAME_COLUMN_WIDTH_MM = 24;
const RANKING_NISN_COLUMN_WIDTH_MM = 18;
const RANKING_GRADE_COLUMN_WIDTH_MM = 10.75;
const RANKING_SUMMARY_COLUMN_WIDTH_MM = 17;
const RANKING_STATUS_COLUMN_WIDTH_MM = 20;
const RANKING_READABLE_STYLE_FONT_PT = 13;
const RANKING_HEADER_ROW_HEIGHT_MM = 10.4;
const RANKING_BODY_ROW_HEIGHT_MM = 6.7;

type RankingExportRow = Record<string, string | number>;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function preferredRankingColumnWidthMm(column: ExportColumn) {
  switch (column.type) {
    case "index":
      return RANKING_INDEX_COLUMN_WIDTH_MM;
    case "name":
      return RANKING_NAME_COLUMN_WIDTH_MM;
    case "nisn":
      return RANKING_NISN_COLUMN_WIDTH_MM;
    case "status":
      return RANKING_STATUS_COLUMN_WIDTH_MM;
    case "grandAvg":
    case "avgRapor":
    case "rapor":
    case "chapterAvg":
      return RANKING_SUMMARY_COLUMN_WIDTH_MM;
    default:
      return RANKING_GRADE_COLUMN_WIDTH_MM;
  }
}

function isFlexibleGradeColumn(column: ExportColumn) {
  return column.type === "assignment" || column.type === "sts" || column.type === "sas";
}

function getUsablePageWidthMm(paperSize: ReportPaperSize) {
  const paper = resolveReportPaperSize(paperSize === "f4" ? "f4" : "a4", { orientation: "landscape" });
  return paper.pageWidthMm - RANKING_EXPORT_PAGE_MARGIN_MM;
}

function fitRankingColumnWidths(columns: ExportColumn[], paperSize: ReportPaperSize) {
  const usableWidth = getUsablePageWidthMm(paperSize);
  const widths: number[] = columns.map(preferredRankingColumnWidthMm);
  let totalWidth = widths.reduce((sum, width) => sum + width, 0);

  if (totalWidth <= usableWidth) {
    return widths;
  }

  const flexibleIndexes = columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => isFlexibleGradeColumn(column))
    .map(({ index }) => index);
  const overflow = totalWidth - usableWidth;
  const flexibleReduction = flexibleIndexes.length > 0 ? overflow / flexibleIndexes.length : 0;

  flexibleIndexes.forEach((index) => {
    widths[index] = Math.max(RANKING_COMPACT_MIN_COLUMN_WIDTH_MM, widths[index] - flexibleReduction);
  });

  totalWidth = widths.reduce((sum, width) => sum + width, 0);
  if (totalWidth <= usableWidth) {
    return widths;
  }

  const scale = usableWidth / totalWidth;
  return widths.map((width) => Math.max(RANKING_COMPACT_MIN_COLUMN_WIDTH_MM, width * scale));
}

function estimateWrappedLineCount(text: string, fontPt: number, widthMm: number) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (!normalized) return 1;

  const usableWidthMm = Math.max(8, widthMm - 4);
  const averageCharWidthMm = Math.max(0.86, fontPt * 0.14);
  const charsPerLine = Math.max(6, Math.floor(usableWidthMm / averageCharWidthMm));
  const words = normalized.split(" ");
  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = Math.min(wordLength, charsPerLine);
      lines += Math.max(0, Math.ceil(wordLength / charsPerLine) - 1);
      return;
    }

    const nextLength = currentLineLength + 1 + wordLength;
    if (nextLength <= charsPerLine) {
      currentLineLength = nextLength;
      return;
    }

    lines += 1;
    currentLineLength = Math.min(wordLength, charsPerLine);
    lines += Math.max(0, Math.ceil(wordLength / charsPerLine) - 1);
  });

  return Math.max(1, lines);
}

function resolveRankingHeaderRowHeightMm(style: ReportDocumentStyle, columns: ExportColumn[], widths: number[]) {
  const headerFontPt = pdfEffectiveFontSize(Math.max(style.tableHeaderFontSize, RANKING_READABLE_STYLE_FONT_PT));
  const maxHeaderLines = Math.max(
    1,
    ...columns.map((column, index) => estimateWrappedLineCount(column.label, headerFontPt, widths[index] ?? preferredRankingColumnWidthMm(column))),
  );
  const textHeightMm = Math.min(maxHeaderLines, 3) * headerFontPt * 0.34;
  return Number(clamp(textHeightMm + 3, RANKING_HEADER_ROW_HEIGHT_MM, 12.4).toFixed(2));
}

export function createDefaultRankingDocumentStyle(): ReportDocumentStyle {
  const baseStyle = createDefaultReportDocumentStyle();

  return {
    ...baseStyle,
    titleFontSize: 14,
    metaFontSize: 9.25,
    tableHeaderFontSize: RANKING_READABLE_STYLE_FONT_PT,
    tableBodyFontSize: RANKING_READABLE_STYLE_FONT_PT,
    layoutPreset: "compact",
    experimentalColumnTypographyEnabled: true,
    experimentalColumnLayoutEnabled: true,
    tableSizing: {
      ...baseStyle.tableSizing,
      mode: "fixed",
      tableWidthPercent: 100,
      headerRowHeightMm: RANKING_HEADER_ROW_HEIGHT_MM,
      bodyRowHeightMm: RANKING_BODY_ROW_HEIGHT_MM,
    },
  };
}

export function buildCompactRankingDocumentStyle(
  baseStyle: Partial<ReportDocumentStyle> | undefined,
  columns: ExportColumn[],
  paperSize: ReportPaperSize,
  _rows: RankingExportRow[] = [],
): ReportDocumentStyle {
  const resolvedStyle = resolveDocumentStyle(baseStyle ?? createDefaultRankingDocumentStyle());
  const widths = fitRankingColumnWidths(columns, paperSize);
  const readableHeaderFontSize = Math.max(resolvedStyle.tableHeaderFontSize, RANKING_READABLE_STYLE_FONT_PT);
  const readableBodyFontSize = Math.max(resolvedStyle.tableBodyFontSize, RANKING_READABLE_STYLE_FONT_PT);
  const headerRowHeightMm = Math.max(
    resolvedStyle.tableSizing.headerRowHeightMm ?? 0,
    resolveRankingHeaderRowHeightMm({ ...resolvedStyle, tableHeaderFontSize: readableHeaderFontSize }, columns, widths),
  );
  const bodyRowHeightMm = RANKING_BODY_ROW_HEIGHT_MM;

  return {
    ...resolvedStyle,
    tableHeaderFontSize: readableHeaderFontSize,
    tableBodyFontSize: readableBodyFontSize,
    experimentalColumnLayoutEnabled: true,
    tableSizing: {
      ...resolvedStyle.tableSizing,
      mode: "fixed",
      tableWidthPercent: 100,
      headerRowHeightMm,
      bodyRowHeightMm,
    },
    columnFontOverrides: Object.fromEntries(columns.map((column, index) => {
      const existing = resolvedStyle.columnFontOverrides[column.key] || {};
      const bodyAlignment = column.type === "name"
        ? existing.bodyAlignment ?? "left"
        : "center";

      return [
        column.key,
        {
          ...existing,
          headerAlignment: existing.headerAlignment ?? "center",
          bodyAlignment,
          widthMm: existing.widthMm ?? Number(widths[index].toFixed(2)),
          sizingMode: existing.sizingMode ?? "fixed",
        },
      ];
    })),
  };
}

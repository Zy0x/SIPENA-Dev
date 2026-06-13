import type { ExportColumn, ReportPaperSize } from "./reportExportLayout";
import {
  createDefaultReportDocumentStyle,
  resolveDocumentStyle,
  resolveReportPaperSize,
  type ReportDocumentStyle,
} from "./reportExportLayoutV2";

const RANKING_EXPORT_PAGE_MARGIN_MM = 16;
const RANKING_COMPACT_MIN_COLUMN_WIDTH_MM = 8;

function preferredRankingColumnWidthMm(column: ExportColumn) {
  switch (column.type) {
    case "index":
      return 8;
    case "name":
      return 24;
    case "nisn":
      return 17;
    case "status":
      return 19;
    case "grandAvg":
    case "avgRapor":
    case "rapor":
    case "chapterAvg":
      return 15;
    default:
      return 11;
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

export function createDefaultRankingDocumentStyle(): ReportDocumentStyle {
  const baseStyle = createDefaultReportDocumentStyle();

  return {
    ...baseStyle,
    titleFontSize: 14,
    metaFontSize: 9.25,
    tableHeaderFontSize: 11.25,
    tableBodyFontSize: 11.25,
    layoutPreset: "compact",
    experimentalColumnTypographyEnabled: true,
    experimentalColumnLayoutEnabled: true,
    tableSizing: {
      ...baseStyle.tableSizing,
      mode: "autofit-content",
      tableWidthPercent: 100,
      headerRowHeightMm: 8.8,
      bodyRowHeightMm: 6.2,
    },
  };
}

export function buildCompactRankingDocumentStyle(
  baseStyle: Partial<ReportDocumentStyle> | undefined,
  columns: ExportColumn[],
  paperSize: ReportPaperSize,
): ReportDocumentStyle {
  const resolvedStyle = resolveDocumentStyle(baseStyle ?? createDefaultRankingDocumentStyle());
  const widths = fitRankingColumnWidths(columns, paperSize);

  return {
    ...resolvedStyle,
    experimentalColumnLayoutEnabled: true,
    tableSizing: {
      ...resolvedStyle.tableSizing,
      mode: "autofit-content",
      tableWidthPercent: 100,
    },
    columnFontOverrides: Object.fromEntries(columns.map((column, index) => {
      const existing = resolvedStyle.columnFontOverrides[column.key] || {};
      const bodyAlignment = column.type === "name" || column.type === "status"
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

import jsPDF from "jspdf";
import autoTable, { type CellDef, type RowInput } from "jspdf-autotable";
import { addSignatureBlockPDF } from "@/lib/exportSignature";
import {
  buildReportLayoutPlanV2,
  getColumnBodyAlignment,
  getColumnHeaderAlignment,
  getColumnTypography,
  resolveReportPaperSize,
  type ReportDocumentStyle,
} from "@/lib/reportExportLayoutV2";
import { type ExportColumn, type ExportConfig, type HeaderGroup } from "@/lib/reportExportLayout";
import { getExportContinuationTitle, getExportFileBaseName, getExportMetaGroups, getExportTitle } from "@/lib/exportEngine/shared";
import {
  CELL_PADDING,
  FOOTER,
  TABLE_COLORS,
  TABLE_LINE,
  pdfEffectiveFontSize,
  pdfBodyRowHeightMm,
  pdfHeaderRowHeightMm,
} from "@/lib/exportEngine/sharedMetrics";

function getFillColor(group: HeaderGroup | ExportColumn): [number, number, number] {
  if ("semester" in group && group.semester === 1) return TABLE_COLORS.headerSemester1;
  if ("semester" in group && group.semester === 2) return TABLE_COLORS.headerSemester2;
  if ("type" in group && ["chapterAvg", "grandAvg", "avgRapor", "rapor"].includes(group.type)) return TABLE_COLORS.headerSummary;
  if ("label" in group && (group.label === "Rekap Akhir" || group.label === "Nilai Akhir")) return TABLE_COLORS.headerFinal;
  if ("isChapter" in group && group.isChapter) return TABLE_COLORS.headerChapter;
  return TABLE_COLORS.headerDefault;
}

function buildHeaderRows(columns: ExportColumn[], headerGroups: HeaderGroup[], style: ReportDocumentStyle): RowInput[] {
  const rows: RowInput[] = [];
  const hasMultiLevel = headerGroups.length > 1;
  const fixedTypes = new Set(["index", "name", "nisn"]);

  if (hasMultiLevel) {
    const level1: CellDef[] = [];
    headerGroups.forEach((group) => {
      const groupStartIndex = level1.reduce((sum, cell) => sum + (cell.colSpan ?? 1), 0);
      const groupColumns = columns.slice(groupStartIndex, groupStartIndex + group.colSpan);
      const allFixed = groupColumns.every((column) => fixedTypes.has(column.type));

      if (allFixed) {
        groupColumns.forEach((column) => {
          const typography = getColumnTypography(style, column.key);
          level1.push({
            content: column.label,
            rowSpan: 2,
            styles: {
              halign: getColumnHeaderAlignment(style, column),
              valign: "middle",
              fillColor: getFillColor(column),
              textColor: TABLE_COLORS.text,
              fontStyle: "bold",
              fontSize: pdfEffectiveFontSize(typography.headerFontSize),
              cellPadding: CELL_PADDING.headerFixed,
              overflow: "linebreak",
            },
          });
        });
        return;
      }

      const groupHeaderFontSize = Math.max(...groupColumns.map((column) => getColumnTypography(style, column.key).headerFontSize));
      level1.push({
        content: group.label,
        colSpan: group.colSpan,
        styles: {
          halign: "center",
          valign: "middle",
          fillColor: group.label ? getFillColor(group) : [255, 255, 255],
          textColor: group.label ? TABLE_COLORS.text : [0, 0, 0],
          fontStyle: "bold",
          fontSize: pdfEffectiveFontSize(groupHeaderFontSize),
          cellPadding: CELL_PADDING.headerGroup,
          overflow: "linebreak",
        },
      });
    });
    rows.push(level1);

    const level2: CellDef[] = [];
    columns.forEach((column) => {
      if (fixedTypes.has(column.type)) return;
      const typography = getColumnTypography(style, column.key);
      level2.push({
        content: column.label,
        styles: {
          halign: getColumnHeaderAlignment(style, column),
          valign: "middle",
          fillColor: getFillColor(column),
          textColor: TABLE_COLORS.text,
          fontStyle: ["chapterAvg", "grandAvg", "avgRapor", "rapor"].includes(column.type) ? "bold" : "normal",
          fontSize: pdfEffectiveFontSize(typography.headerFontSize),
          cellPadding: CELL_PADDING.header,
          overflow: "linebreak",
        },
      });
    });
    rows.push(level2);
    return rows;
  }

  rows.push(columns.map((column) => ({
    content: column.label,
    styles: {
      halign: getColumnHeaderAlignment(style, column),
      valign: "middle",
      fillColor: getFillColor(column),
      textColor: TABLE_COLORS.text,
      fontStyle: ["chapterAvg", "grandAvg", "avgRapor", "rapor"].includes(column.type) ? "bold" : "normal",
      fontSize: pdfEffectiveFontSize(getColumnTypography(style, column.key).headerFontSize),
      cellPadding: CELL_PADDING.header,
      overflow: "linebreak",
    },
  })));

  return rows;
}

function drawMetaGroups(doc: jsPDF, config: ExportConfig, pageWidth: number) {
  const groups = getExportMetaGroups(config);
  const leftX = 10;
  const centerX = pageWidth / 2;
  const rightX = pageWidth - 10;

  groups.forEach((group) => {
    const x = group.align === "right" ? rightX : group.align === "center" ? centerX : leftX;
    const align = group.align === "right" ? "right" : group.align === "center" ? "center" : "left";
    group.items.slice(0, 2).forEach((item, index) => {
      doc.text(`${item.label}: ${item.value}`, x, 20 + index * 5, { align });
    });
  });
}

export function exportToPDF(config: ExportConfig): void {
  const layoutPlan = buildReportLayoutPlanV2(config);
  const paper = resolveReportPaperSize(config.paperSize, {
    orientation: "landscape",
    requiredContentWidthMm: layoutPlan.metrics.pageWidthMm,
    requiredContentHeightMm: layoutPlan.metrics.pageHeightMm,
  });
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: paper.pdfFormat });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const title = getExportTitle(config);
  const continuationTitle = getExportContinuationTitle(config);

  const drawFooter = (pageNumber: number, totalPages: number) => {
    doc.setFontSize(FOOTER.fontSize);
    doc.setFont("helvetica", "normal");
    doc.text(`Halaman ${pageNumber}/${totalPages}`, pageWidth / 2, pageHeight - FOOTER.yFromBottom, { align: "center" });
    doc.text(FOOTER.leftText, FOOTER.leftX, pageHeight - FOOTER.yFromBottom);
  };

  layoutPlan.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    if (pageIndex === 0 && page.pageType === "table") {
      doc.setFontSize(layoutPlan.documentStyle.titleFontSize);
      doc.setFont("helvetica", "bold");
      doc.text(title, pageWidth / 2, 12, { align: "center" });

      doc.setFontSize(layoutPlan.documentStyle.metaFontSize);
      doc.setFont("helvetica", "normal");
      drawMetaGroups(doc, config, pageWidth);
    } else if (page.pageType === "table") {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(
        `${continuationTitle} - Halaman ${page.number}${page.totalSegments > 1 ? ` - Bagian ${page.segmentNumber}/${page.totalSegments}` : ""}`,
        10,
        12,
      );
    }

    if (page.pageType === "table") {
      const bodyData = page.rows.map((row) =>
        page.columns.map((column) => {
          const value = row[column.key];
          return value !== undefined && value !== null ? String(value) : "-";
        }),
      );

      const headerRows = buildHeaderRows(page.columns, page.headerGroups, layoutPlan.documentStyle);
      const columnStyles: Record<number, object> = {};
      page.columns.forEach((column, index) => {
        const width = page.columnWidthsMm[index] ?? 14;
        const typography = getColumnTypography(layoutPlan.documentStyle, column.key);
        columnStyles[index] = {
          cellWidth: width,
          halign: getColumnBodyAlignment(layoutPlan.documentStyle, column),
          overflow: column.type === "name" ? "linebreak" : "ellipsize",
          cellPadding: column.type === "name" ? CELL_PADDING.bodyName : CELL_PADDING.bodyDefault,
          fontSize: pdfEffectiveFontSize(typography.bodyFontSize),
          minCellHeight: pdfBodyRowHeightMm(typography.bodyFontSize, layoutPlan.documentStyle.tableSizing.bodyRowHeightMm),
        };
      });

      autoTable(doc, {
        head: headerRows,
        body: bodyData,
        startY: page.tableStartY,
        margin: {
          left: layoutPlan.metrics.marginLeftMm,
          right: layoutPlan.metrics.marginRightMm,
          top: layoutPlan.metrics.marginTopMm,
          bottom: layoutPlan.metrics.marginBottomMm + layoutPlan.metrics.footerHeightMm,
        },
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        styles: {
          fontSize: pdfEffectiveFontSize(layoutPlan.documentStyle.tableBodyFontSize),
          cellPadding: CELL_PADDING.bodyDefault,
          lineColor: [...TABLE_LINE.color],
          lineWidth: TABLE_LINE.width,
          minCellHeight: pdfBodyRowHeightMm(layoutPlan.documentStyle.tableBodyFontSize, layoutPlan.documentStyle.tableSizing.bodyRowHeightMm),
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fontSize: pdfEffectiveFontSize(layoutPlan.documentStyle.tableHeaderFontSize),
          cellPadding: CELL_PADDING.header,
          minCellHeight: pdfHeaderRowHeightMm(layoutPlan.documentStyle.tableHeaderFontSize, layoutPlan.documentStyle.tableSizing.headerRowHeightMm),
          overflow: "linebreak",
        },
        bodyStyles: {
          fontSize: pdfEffectiveFontSize(layoutPlan.documentStyle.tableBodyFontSize),
        },
        columnStyles,
        alternateRowStyles: {
          fillColor: [...TABLE_COLORS.alternateRow],
        },
        tableLineColor: [...TABLE_LINE.color],
        tableLineWidth: TABLE_LINE.width,
      });
    }

    if (page.isLastPage && config.includeSignature && config.signature) {
      const finalY = page.pageType === "table"
        ? ((doc as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY || page.estimatedTableEndY)
        : page.tableStartY;
      addSignatureBlockPDF(
        doc,
        {
          ...config.signature,
          fontSize: Math.max(config.signature.fontSize || 10, layoutPlan.documentStyle.metaFontSize),
        },
        finalY,
        layoutPlan.signaturePlacement
          ? {
              xMm: layoutPlan.signaturePlacement.xMm,
              yMm: layoutPlan.signaturePlacement.yMm,
              widthMm: layoutPlan.signaturePlacement.widthMm,
            }
          : null,
      );
    }

    drawFooter(page.number, layoutPlan.pages.length);
  });

  doc.save(`${getExportFileBaseName(config)}.pdf`);
}

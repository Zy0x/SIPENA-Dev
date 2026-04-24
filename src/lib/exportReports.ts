/**
 * Export utility for Grade Reports
 * Creates hierarchical multi-level headers matching the web spreadsheet UI
 */

import jsPDF from "jspdf";
import autoTable, { RowInput, CellDef } from "jspdf-autotable";
import * as XLSX from "xlsx";
import { addSignatureBlockPDF, getSignatureRowsExcel, getSignatureRowsCSV } from "./exportSignature";
import { exportToPDF as exportToPDFEngine } from "@/lib/exportEngine/pdfEngine";
import { exportToExcel as exportToExcelEngine } from "@/lib/exportEngine/excelEngine";
import { exportToCSV as exportToCSVEngine } from "@/lib/exportEngine/csvEngine";
import {
  buildReportLayoutPlanV2,
  getColumnBodyAlignment,
  getColumnHeaderAlignment,
  getColumnTypography,
  resolveSignaturePlacementFromBounds,
  resolveReportPaperSize,
  type ReportDocumentStyle,
} from "./reportExportLayoutV2";
import {
  type ExportColumn,
  type ExportConfig,
  type HeaderGroup,
} from "./reportExportLayout";

export type { ExportColumn, ExportConfig, HeaderGroup } from "./reportExportLayout";
export type { ReportPaperSize } from "./reportExportLayout";

interface ChapterInfo {
  id: string;
  name: string;
  columns: ExportColumn[];
}

/**
 * Build chapter-based sub-header groups for Excel/PDF
 */
export function buildChapterGroups(
  columns: ExportColumn[],
  isCombinedView: boolean
): ChapterInfo[] {
  const chapterMap = new Map<string, ChapterInfo>();
  
  columns.forEach(col => {
    if (col.chapterId) {
      const key = isCombinedView && col.semester 
        ? `${col.semester}_${col.chapterId}` 
        : col.chapterId;
      
      if (!chapterMap.has(key)) {
        chapterMap.set(key, {
          id: key,
          name: col.type === 'chapterAvg' ? col.label : '',
          columns: [],
        });
      }
      chapterMap.get(key)!.columns.push(col);
      
      // Update chapter name from chapterAvg column
      if (col.type === 'chapterAvg') {
        chapterMap.get(key)!.name = col.label;
      }
    }
  });
  
  return Array.from(chapterMap.values());
}

/**
 * Export to PDF with hierarchical multi-level headers
 */
export function exportToPDF(config: ExportConfig): void {
  const layoutPlan = buildReportLayoutPlanV2(config);
  const paper = resolveReportPaperSize(config.paperSize, {
    orientation: "landscape",
    requiredContentWidthMm: layoutPlan.metrics.pageWidthMm,
    requiredContentHeightMm: layoutPlan.metrics.pageHeightMm,
  });
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: paper.pdfFormat });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const drawFooter = (pageNumber: number, totalPages: number) => {
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(`Halaman ${pageNumber}/${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
    doc.text('SIPENA - Sistem Penilaian', 10, pageHeight - 8);
  };

  const getFillColor = (group: HeaderGroup | ExportColumn): [number, number, number] => {
    if ("semester" in group && group.semester === 1) return [37, 99, 235];
    if ("semester" in group && group.semester === 2) return [22, 163, 74];
    if ("type" in group && ['chapterAvg', 'grandAvg', 'avgRapor', 'rapor'].includes(group.type)) return [124, 58, 237];
    if ("label" in group && (group.label === 'Rekap Akhir' || group.label === 'Nilai Akhir')) return [147, 51, 234];
    if ("isChapter" in group && group.isChapter) return [14, 165, 233];
    return [59, 130, 246];
  };

  const fixedTypes = new Set(['index', 'name', 'nisn']);

  const buildHeaderRows = (columns: ExportColumn[], headerGroups: HeaderGroup[], style: ReportDocumentStyle): RowInput[] => {
    const rows: RowInput[] = [];
    const hasMultiLevel = headerGroups.length > 1;

    if (hasMultiLevel) {
      // Level 1: group headers — merge fixed columns (No, Nama, NISN) vertically with rowSpan
      const level1: CellDef[] = [];
      headerGroups.forEach((group) => {
        // Check if this group only covers fixed columns
        const groupStartIdx = level1.reduce((sum, c) => sum + (c.colSpan ?? 1), 0);
        const groupCols = columns.slice(groupStartIdx, groupStartIdx + group.colSpan);
        const allFixed = groupCols.every(c => fixedTypes.has(c.type));

        if (allFixed) {
          // Each fixed col gets its own cell with rowSpan=2
          groupCols.forEach((col) => {
            const typography = getColumnTypography(style, col.key);
          level1.push({
            content: col.label,
            rowSpan: 2,
            styles: {
              halign: getColumnHeaderAlignment(style, col),
                valign: 'middle',
                fillColor: getFillColor(col),
                textColor: [255, 255, 255],
                fontStyle: 'bold',
                fontSize: Math.max(5, typography.headerFontSize - 2),
                cellPadding: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
                overflow: 'linebreak',
              },
            });
          });
        } else {
          const groupHeaderFontSize = Math.max(...groupCols.map((col) => getColumnTypography(style, col.key).headerFontSize));
          level1.push({
            content: group.label,
            colSpan: group.colSpan,
            styles: {
              halign: 'center',
              valign: 'middle',
              fillColor: group.label ? getFillColor(group) : [255, 255, 255],
              textColor: group.label ? [255, 255, 255] : [0, 0, 0],
              fontStyle: 'bold',
              fontSize: Math.max(5, groupHeaderFontSize - 2),
              cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
              overflow: 'linebreak',
            },
          });
        }
      });
      rows.push(level1);

      // Level 2: column labels — skip fixed columns (already merged via rowSpan)
      const level2: CellDef[] = [];
      columns.forEach((col) => {
        if (fixedTypes.has(col.type)) return; // skip, already in level1 with rowSpan
        const typography = getColumnTypography(style, col.key);
          level2.push({
            content: col.label,
            styles: {
            halign: getColumnHeaderAlignment(style, col),
            valign: 'middle',
            fillColor: getFillColor(col),
            textColor: [255, 255, 255],
            fontStyle: ['chapterAvg', 'grandAvg', 'avgRapor', 'rapor'].includes(col.type) ? 'bold' : 'normal',
            fontSize: Math.max(5, typography.headerFontSize - 2),
            cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
            overflow: 'linebreak',
          },
        });
      });
      rows.push(level2);
    } else {
      // Single level header — all centered with word wrap
      rows.push(columns.map((col) => ({
        content: col.label,
        styles: {
          halign: getColumnHeaderAlignment(style, col),
          valign: 'middle',
          fillColor: getFillColor(col),
          textColor: [255, 255, 255],
          fontStyle: ['chapterAvg', 'grandAvg', 'avgRapor', 'rapor'].includes(col.type) ? 'bold' : 'normal',
          fontSize: Math.max(5, getColumnTypography(style, col.key).headerFontSize - 2),
          cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
          overflow: 'linebreak',
        },
      })));
    }
    return rows;
  };

  layoutPlan.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage();
    }

    if (pageIndex === 0 && page.pageType === "table") {
      doc.setFontSize(layoutPlan.documentStyle.titleFontSize);
      doc.setFont('helvetica', 'bold');
      doc.text("LAPORAN NILAI SISWA", pageWidth / 2, 12, { align: "center" });

      doc.setFontSize(layoutPlan.documentStyle.metaFontSize);
      doc.setFont('helvetica', 'normal');
      doc.text(`Kelas: ${config.className}`, 10, 20);
      doc.text(`Mata Pelajaran: ${config.subjectName}`, 10, 25);
      doc.text(`KKM: ${config.kkm}`, pageWidth / 2, 20);
      doc.text(`Periode: ${config.periodLabel}`, pageWidth / 2, 25);
      doc.text(`Tanggal: ${config.dateStr}`, pageWidth - 10, 20, { align: 'right' });
      doc.text(`Jumlah Siswa: ${config.studentCount}`, pageWidth - 10, 25, { align: 'right' });
    } else if (page.pageType === "table") {
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text(
        `Lanjutan Laporan Nilai Siswa • Halaman ${page.number}${page.totalSegments > 1 ? ` • Bagian ${page.segmentNumber}/${page.totalSegments}` : ""}`,
        10,
        12,
      );
    }

    if (page.pageType === "table") {
      const bodyData = page.rows.map((row) =>
        page.columns.map((col) => {
          const value = row[col.key];
          return value !== undefined && value !== null ? String(value) : "-";
        })
      );

      const headerRows = buildHeaderRows(page.columns, page.headerGroups, layoutPlan.documentStyle);
      const columnStyles: Record<number, object> = {};
      page.columns.forEach((col, idx) => {
        const width = page.columnWidthsMm[idx] ?? 14;
        const typography = getColumnTypography(layoutPlan.documentStyle, col.key);
        columnStyles[idx] = {
          cellWidth: width,
          halign: getColumnBodyAlignment(layoutPlan.documentStyle, col),
          overflow: col.type === "name" ? "linebreak" : "ellipsize",
          cellPadding: col.type === "name" ? { top: 1, right: 2, bottom: 1, left: 2 } : 1.2,
          fontSize: Math.max(5, typography.bodyFontSize - 2),
          minCellHeight: layoutPlan.documentStyle.tableSizing.bodyRowHeightMm ?? 5 + (typography.bodyFontSize - 10) * 0.8,
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
          fontSize: Math.max(5, layoutPlan.documentStyle.tableBodyFontSize - 2),
          cellPadding: 1.2,
          lineColor: [200, 200, 200],
          lineWidth: 0.1,
          minCellHeight: 5 + (layoutPlan.documentStyle.tableBodyFontSize - 10) * 0.8,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fontSize: Math.max(5, layoutPlan.documentStyle.tableHeaderFontSize - 2),
          cellPadding: { top: 1.5, right: 1, bottom: 1.5, left: 1 },
          minCellHeight: layoutPlan.documentStyle.tableSizing.headerRowHeightMm ?? 5.5 + (layoutPlan.documentStyle.tableHeaderFontSize - 10) * 0.7,
          overflow: 'linebreak',
        },
        bodyStyles: {
          fontSize: Math.max(5, layoutPlan.documentStyle.tableBodyFontSize - 2),
        },
        columnStyles,
        alternateRowStyles: {
          fillColor: [250, 250, 250],
        },
        tableLineColor: [200, 200, 200],
        tableLineWidth: 0.1,
      });
    }

    if (page.isLastPage && config.includeSignature && config.signature) {
      const finalY = page.pageType === "table"
        ? ((doc as any).lastAutoTable?.finalY || page.estimatedTableEndY)
        : page.tableStartY;
      const adjustedPlacement = layoutPlan.signaturePlacement
        ? resolveSignaturePlacementFromBounds({
            pageIndex: layoutPlan.signaturePlacement.pageIndex,
            signature: config.signature,
            signatureMetrics: {
              widthMm: layoutPlan.signaturePlacement.widthMm,
              heightMm: layoutPlan.signaturePlacement.heightMm,
              safeXMm: 0,
              safeYMm: 0,
              safeWidthMm: 0,
              safeHeightMm: 0,
            },
            pageWidthMm: layoutPlan.metrics.pageWidthMm,
            pageHeightMm: layoutPlan.metrics.pageHeightMm,
            marginLeftMm: layoutPlan.metrics.marginLeftMm,
            marginRightMm: layoutPlan.metrics.marginRightMm,
            marginTopMm: layoutPlan.metrics.marginTopMm,
            marginBottomMm: layoutPlan.metrics.marginBottomMm,
            footerHeightMm: layoutPlan.metrics.footerHeightMm,
            safeZoneTopMm: page.pageType === "table"
              ? finalY + layoutPlan.metrics.signatureGapMm
              : page.tableStartY,
          })
        : null;
      addSignatureBlockPDF(
        doc,
        {
          ...config.signature,
          fontSize: Math.max(config.signature.fontSize || 10, layoutPlan.documentStyle.metaFontSize),
        },
        finalY,
        adjustedPlacement
          ? {
              xMm: adjustedPlacement.xMm,
              yMm: adjustedPlacement.yMm,
              widthMm: adjustedPlacement.widthMm,
            }
          : null,
      );
    }

    drawFooter(page.number, layoutPlan.pages.length);
  });
  
  doc.save(`Laporan_${config.className}_${config.subjectName}_${config.periodLabel.replace(/\s/g, '_')}.pdf`);
}

/**
 * Export to Excel with hierarchical merged headers
 */
export function exportToExcel(config: ExportConfig): void {
  const wb = XLSX.utils.book_new();
  
  // === Sheet 1: Summary ===
  const summaryData = [
    ["LAPORAN NILAI SISWA"],
    [""],
    ["Informasi Laporan"],
    ["Kelas:", config.className],
    ["Mata Pelajaran:", config.subjectName],
    ["KKM:", config.kkm],
    ["Periode:", config.periodLabel],
    ["Tanggal Ekspor:", config.dateStr],
    [""],
    ["Statistik"],
    ["Jumlah Siswa:", config.studentCount],
    ["Jumlah BAB:", config.chapterCount],
    ["Jumlah Tugas:", config.assignmentCount],
  ];
  
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  wsSummary['!cols'] = [{ wch: 18 }, { wch: 30 }];
  
  // Style title cell
  if (wsSummary['A1']) {
    wsSummary['A1'].s = { font: { bold: true, sz: 16 } };
  }
  
  XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");
  
  // === Sheet 2: Data with Multi-level Headers ===
  const sheetData: (string | number)[][] = [];
  const fixedColTypes = new Set(['index', 'name', 'nisn']);
  const fixedColCount = config.columns.filter(c => fixedColTypes.has(c.type)).length;

  if (config.headerGroups.length > 1) {
    // Row 1: Level 1 headers — fixed cols get their own cell (will merge down)
    const level1Row: (string | number)[] = [];
    let colCursor = 0;
    config.headerGroups.forEach(group => {
      const groupCols = config.columns.slice(colCursor, colCursor + group.colSpan);
      const allFixed = groupCols.every(c => fixedColTypes.has(c.type));
      if (allFixed) {
        groupCols.forEach(col => {
          level1Row.push(col.label);
        });
      } else {
        level1Row.push(group.label);
        for (let i = 1; i < group.colSpan; i++) {
          level1Row.push('');
        }
      }
      colCursor += group.colSpan;
    });
    sheetData.push(level1Row);

    // Row 2: Level 2 headers — fixed cols are empty (merged from above)
    const level2Row = config.columns.map(col => fixedColTypes.has(col.type) ? '' : col.label);
    sheetData.push(level2Row);
  } else {
    const level2Row = config.columns.map(col => col.label);
    sheetData.push(level2Row);
  }

  // Data rows
  config.data.forEach(row => {
    const dataRow = config.columns.map(col => {
      const val = row[col.key];
      if (val === undefined || val === null || val === '-') return '';
      return val;
    });
    sheetData.push(dataRow);
  });

  // Add signature rows if enabled
  if (config.includeSignature && config.signature) {
    const sigRows = getSignatureRowsExcel(config.signature, config.columns.length);
    sigRows.forEach(row => sheetData.push(row));
  }

  const wsData = XLSX.utils.aoa_to_sheet(sheetData);

  // Build merge ranges
  const merges: XLSX.Range[] = [];
  if (config.headerGroups.length > 1) {
    // Merge fixed columns vertically (row 0 → row 1)
    config.columns.forEach((col, idx) => {
      if (fixedColTypes.has(col.type)) {
        merges.push({ s: { r: 0, c: idx }, e: { r: 1, c: idx } });
      }
    });
    // Merge group headers horizontally (skip fixed cols)
    let colIndex = 0;
    config.headerGroups.forEach(group => {
      const groupCols = config.columns.slice(colIndex, colIndex + group.colSpan);
      const allFixed = groupCols.every(c => fixedColTypes.has(c.type));
      if (!allFixed && group.colSpan > 1) {
        merges.push({
          s: { r: 0, c: colIndex },
          e: { r: 0, c: colIndex + group.colSpan - 1 }
        });
      }
      colIndex += group.colSpan;
    });
  }
  wsData['!merges'] = merges;
  
  // Set column widths
  const colWidths: { wch: number }[] = config.columns.map(col => {
    if (col.type === 'index') return { wch: 5 };
    if (col.type === 'name') return { wch: 25 };
    if (col.type === 'nisn') return { wch: 15 };
    if (col.type === 'status') return { wch: 12 };
    return { wch: 10 };
  });
  wsData['!cols'] = colWidths;
  
  // Freeze panes (freeze first 3 columns and header rows)
  const headerRowCount = config.headerGroups.length > 1 ? 2 : 1;
  wsData['!freeze'] = { xSplit: 3, ySplit: headerRowCount };
  
  XLSX.utils.book_append_sheet(wb, wsData, "Data Nilai");
  
  // Save file
  XLSX.writeFile(wb, `Laporan_${config.className}_${config.subjectName}_${config.periodLabel.replace(/\s/g, '_')}.xlsx`);
}

/**
 * Export to CSV with hierarchical headers
 */
export function exportToCSV(config: ExportConfig): void {
  const rows: string[][] = [];
  
  // Level 1 headers (if exists)
  if (config.headerGroups.length > 1) {
    const level1Row: string[] = [];
    config.headerGroups.forEach(group => {
      level1Row.push(group.label);
      for (let i = 1; i < group.colSpan; i++) {
        level1Row.push('');
      }
    });
    rows.push(level1Row);
  }
  
  // Level 2 headers
  rows.push(config.columns.map(col => col.label));
  
  // Data rows - use col.key for lookup
  config.data.forEach(row => {
    const dataRow = config.columns.map(col => {
      const val = row[col.key];
      if (val === undefined || val === null) return '';
      return String(val);
    });
    rows.push(dataRow);
  });
  
  // Add signature rows if enabled
  if (config.includeSignature && config.signature) {
    const sigRows = getSignatureRowsCSV(config.signature, config.columns.length);
    sigRows.forEach(row => rows.push(row));
  }
  
  // Convert to CSV string
  const csvContent = rows.map(row => 
    row.map(cell => {
      // Escape quotes and wrap in quotes if contains comma or quote
      if (typeof cell === 'string' && (cell.includes(',') || cell.includes('"') || cell.includes('\n'))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(',')
  ).join('\n');
  
  // Add BOM for Excel UTF-8 compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Laporan_${config.className}_${config.subjectName}_${config.periodLabel.replace(/\s/g, '_')}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Main export function
 */
export function exportReport(
  format: 'pdf' | 'excel' | 'csv',
  config: ExportConfig
): void {
  switch (format) {
    case 'pdf':
      exportToPDFEngine(config);
      break;
    case 'excel':
      exportToExcelEngine(config);
      break;
    case 'csv':
      exportToCSVEngine(config);
      break;
  }
}

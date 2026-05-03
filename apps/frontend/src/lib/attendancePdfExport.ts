import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addSignatureBlockPDF, type SignatureData } from "@/lib/exportSignature";
import type {
  AttendancePrintDataset,
  AttendanceInlineAnnotationStackedSegment,
  AttendancePrintInfoItem,
  AttendancePrintLayoutPlan,
  AttendancePrintPage,
} from "@/lib/attendancePrintLayout";
import {
  getAttendanceInlineAnnotationStackedSegments,
  getAttendanceRekapLabel,
  resolveAttendanceInlineAnnotationLayout,
} from "@/lib/attendancePrintLayout";
import { PX_PER_MM } from "@/lib/exportEngine/sharedMetrics";
import type {
  AttendanceExportMismatch,
  AttendancePdfRuntimeTrace,
} from "@/lib/attendanceExportDebug";

type PdfOpacityState = { opacity: number };
type JsPdfWithGState = jsPDF & {
  GState: new (options: PdfOpacityState) => unknown;
  setGState: (state: unknown) => jsPDF;
};
type AutoTableSpanCell = {
  content: string;
  colSpan?: number;
  styles?: {
    halign?: "center";
    fontStyle?: "bold";
  };
};

export interface AttendancePdfRotateInlineAnnotationFit {
  text: string;
  fontPt: number;
  textWidthMm: number;
  lineBoxHeightMm: number;
  availableLengthMm: number;
  availableThicknessMm: number;
  glyphCenterOffsetMm: number;
}

const COLORS = {
  header: [37, 99, 235] as [number, number, number],
  headerDark: [29, 78, 216] as [number, number, number],
  headerText: [255, 255, 255] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  border: [219, 228, 240] as [number, number, number],
  panel: [248, 250, 252] as [number, number, number],
  totalRow: [226, 232, 240] as [number, number, number],
  percentRow: [219, 234, 254] as [number, number, number],
} as const;

const STATUS_COLORS: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
  H: { fill: [220, 252, 231], text: [22, 101, 52] },
  I: { fill: [219, 234, 254], text: [29, 78, 216] },
  S: { fill: [254, 249, 195], text: [133, 77, 14] },
  A: { fill: [254, 226, 226], text: [185, 28, 28] },
  D: { fill: [237, 233, 254], text: [109, 40, 217] },
  L: { fill: [226, 232, 240], text: [71, 85, 105] },
};

// Shared shell metrics — imported so the PDF renderer and the live preview
// planner (attendancePrintLayout.ts) always agree on every measurement.
import { ATTENDANCE_SHELL_MM as SHELL_MM } from "@/lib/exportEngine/attendanceShellMetrics";

const ROTATE_90_LENGTH_SAFETY_MM = 2.4;
const ROTATE_90_THICKNESS_SAFETY_MM = 1.2;
const ROTATE_90_BASELINE_CENTER_FACTOR = 0.38;

function drawPageHeader(doc: jsPDF, data: AttendancePrintDataset, plan: AttendancePrintLayoutPlan, _page: AttendancePrintPage) {
  const docWithGState = doc as JsPdfWithGState;
  const bannerY = plan.paper.marginTopMm;
  const contentLeft = plan.paper.marginLeftMm;
  const contentRight = plan.paper.pageWidthMm - plan.paper.marginRightMm;
  const bannerHeight = plan.shell.topBanner - 2; // 16mm visible
  const bannerWidth = plan.paper.contentWidthMm;

  // Solid banner with subtle bottom band for depth.
  doc.setFillColor(...COLORS.header);
  doc.roundedRect(contentLeft, bannerY, bannerWidth, bannerHeight, 2.2, 2.2, "F");
  doc.setFillColor(...COLORS.headerDark);
  doc.roundedRect(contentLeft, bannerY + bannerHeight - 1.4, bannerWidth, 1.4, 0, 0, "F");

  doc.setTextColor(...COLORS.headerText);

  // ── Top row: Title (left) + Class pill (right)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(plan.table.titleFontPt);
  doc.text("REKAP PRESENSI BULANAN", contentLeft + 3.5, bannerY + 6.2);

  const classText = `Kelas ${data.className}`;
  doc.setFontSize(plan.table.metaFontPt + 1.2);
  const classTextW = doc.getTextWidth(classText);
  const pillPadX = 1.6;
  const pillW = classTextW + pillPadX * 2;
  const pillH = 4.6;
  const pillX = contentRight - 3 - pillW;
  const pillY = bannerY + 3.0;
  doc.setFillColor(255, 255, 255);
  docWithGState.setGState(new docWithGState.GState({ opacity: 0.18 }));
  doc.roundedRect(pillX, pillY, pillW, pillH, 1.2, 1.2, "F");
  docWithGState.setGState(new docWithGState.GState({ opacity: 1 }));
  doc.setTextColor(...COLORS.headerText);
  doc.setFont("helvetica", "bold");
  doc.text(classText, pillX + pillPadX, pillY + 3.4);

  // ── Bottom row: Month (left) + meta pills (right, rendered RTL)
  const bottomY = bannerY + 11.6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(plan.table.metaFontPt + 1.2);
  doc.setTextColor(...COLORS.headerText);
  doc.text(data.monthLabel, contentLeft + 3.5, bottomY + 1.4);

  const pills: Array<{ strong: string; rest: string }> = [
    { strong: String(plan.rows.length), rest: " siswa" },
    { strong: String(data.effectiveDays), rest: " hari efektif" },
    { strong: "", rest: data.workDayFormatLabel },
  ];
  doc.setFontSize(plan.table.metaFontPt);
  let cursorX = contentRight - 3;
  for (let i = pills.length - 1; i >= 0; i -= 1) {
    const pill = pills[i];
    const text = `${pill.strong}${pill.rest}`;
    const textW = doc.getTextWidth(text);
    const pPad = 1.4;
    const pW = textW + pPad * 2;
    const pH = 4.4;
    const pX = cursorX - pW;
    const pY = bottomY - 1.6;

    doc.setFillColor(255, 255, 255);
    docWithGState.setGState(new docWithGState.GState({ opacity: 0.16 }));
    doc.roundedRect(pX, pY, pW, pH, 2.2, 2.2, "F");
    docWithGState.setGState(new docWithGState.GState({ opacity: 1 }));
    doc.setTextColor(...COLORS.headerText);

    if (pill.strong) {
      doc.setFont("helvetica", "bold");
      doc.text(pill.strong, pX + pPad, pY + 3.2);
      const strongW = doc.getTextWidth(pill.strong);
      doc.setFont("helvetica", "normal");
      doc.text(pill.rest, pX + pPad + strongW, pY + 3.2);
    } else {
      doc.setFont("helvetica", "normal");
      doc.text(pill.rest, pX + pPad, pY + 3.2);
    }
    cursorX = pX - 1.2;
  }
}

function buildHeadRows(plan: AttendancePrintLayoutPlan) {
  const row1: string[] = [];
  const row2: string[] = [];
  const mergedColumns = new Set<number>();
  let index = 0;

  if (plan.visibleColumnKeys.has("no")) {
    row1.push("No");
    row2.push("");
    mergedColumns.add(index);
    index += 1;
  }
  if (plan.visibleColumnKeys.has("name")) {
    row1.push("Nama");
    row2.push("");
    mergedColumns.add(index);
    index += 1;
  }
  if (plan.visibleColumnKeys.has("nisn")) {
    row1.push("NISN");
    row2.push("");
    mergedColumns.add(index);
    index += 1;
  }

  plan.visibleDays.forEach((day) => {
    row1.push(day.dayName.slice(0, 3));
    row2.push(day.dateLabel);
    index += 1;
  });

  plan.visibleRekapKeys.forEach((key) => {
    row1.push(getAttendanceRekapLabel(key));
    row2.push("");
    mergedColumns.add(index);
    index += 1;
  });

  return { row1, row2, mergedColumns };
}

function buildBodyRows(data: AttendancePrintDataset, plan: AttendancePrintLayoutPlan, page: AttendancePrintPage) {
  const rows = plan.rows.slice(page.rowStart, page.rowEnd);
  const visibleDayIndex = new Map(plan.visibleDays.map((day) => [day.key, data.days.findIndex((item) => item.key === day.key)]));
  const inlineDayColumns = new Set<number>();
  if (plan.annotationDisplayMode === "inline-vertical") {
    plan.inlineAnnotations.forEach((range) => {
      for (let columnIndex = range.startColumnIndex; columnIndex <= range.endColumnIndex; columnIndex += 1) {
        inlineDayColumns.add(columnIndex);
      }
    });
  }
  const body = rows.map((row) => {
    const values: string[] = [];
    if (plan.visibleColumnKeys.has("no")) values.push(String(row.number));
    if (plan.visibleColumnKeys.has("name")) values.push(row.name);
    if (plan.visibleColumnKeys.has("nisn")) values.push(row.nisn);

    plan.visibleDays.forEach((day, visibleDayColumnIndex) => {
      const index = visibleDayIndex.get(day.key) ?? -1;
      if (inlineDayColumns.has(visibleDayColumnIndex)) {
        values.push("");
        return;
      }
      values.push(index >= 0 ? row.cells[index]?.value ?? "-" : "-");
    });

    plan.visibleRekapKeys.forEach((key) => values.push(String(row.totals[key])));
    return values;
  });

  if (page.hasSummaryRows) {
    // MERGED rows: label spans No+Name+NISN as one cell; the day columns are
    // collapsed into a single empty colSpan cell so the row reads as
    // "[ TOTAL ............ ]  [ ........... days ........... ]  H S I A D Jml"
    const fixedColCount
      = (plan.visibleColumnKeys.has("no") ? 1 : 0)
      + (plan.visibleColumnKeys.has("name") ? 1 : 0)
      + (plan.visibleColumnKeys.has("nisn") ? 1 : 0);
    const dayColCount = plan.visibleDays.length;

    const totalRow: Array<string | AutoTableSpanCell> = [];
    if (fixedColCount > 0) {
      totalRow.push({ content: plan.summaryRows.totalLabel, colSpan: fixedColCount, styles: { halign: "center", fontStyle: "bold" } });
    }
    if (dayColCount > 0) {
      totalRow.push({ content: "", colSpan: dayColCount });
    }
    plan.visibleRekapKeys.forEach((key) => totalRow.push({ content: String(plan.totals[key]) }));
    body.push(totalRow as unknown as string[]);

    const percentageRow: Array<string | AutoTableSpanCell> = [];
    if (fixedColCount > 0) {
      percentageRow.push({ content: plan.summaryRows.percentLabel, colSpan: fixedColCount, styles: { halign: "center", fontStyle: "bold" } });
    }
    if (dayColCount > 0) {
      percentageRow.push({ content: "", colSpan: dayColCount });
    }
    plan.visibleRekapKeys.forEach((key) => {
      percentageRow.push({ content: plan.summaryRows.percentageByKey[key] });
    });
    body.push(percentageRow as unknown as string[]);
  }

  return body;
}

function resolveBodyRowHeightMm(page: AttendancePrintPage, plan: AttendancePrintLayoutPlan, rowIndex: number) {
  const lastSummaryStartIndex = page.hasSummaryRows ? Math.max(0, page.rowHeightsMm.length) : Number.MAX_SAFE_INTEGER;
  if (rowIndex >= lastSummaryStartIndex) return plan.table.summaryRowHeightMm;
  return page.rowHeightsMm[rowIndex] ?? plan.table.bodyRowHeightMm;
}

function buildColumnStyles(plan: AttendancePrintLayoutPlan) {
  const styles: Record<number, Record<string, unknown>> = {};
  let index = 0;

  if (plan.visibleColumnKeys.has("no") && plan.table.noWidthMm > 0) {
    styles[index] = { cellWidth: plan.table.noWidthMm, halign: "center" };
    index += 1;
  }
  if (plan.visibleColumnKeys.has("name") && plan.table.nameWidthMm > 0) {
    styles[index] = {
      cellWidth: plan.table.nameWidthMm,
      halign: "left",
      overflow: "linebreak",
      cellPadding: { top: plan.table.bodyCellPaddingMm, right: 1.1, bottom: plan.table.bodyCellPaddingMm, left: 1.3 },
    };
    index += 1;
  }
  if (plan.visibleColumnKeys.has("nisn") && plan.table.nisnWidthMm > 0) {
    // NISN must NEVER wrap — keep on a single line so 10-15 digits stay readable.
    styles[index] = { cellWidth: plan.table.nisnWidthMm, halign: "center", overflow: "visible" };
    index += 1;
  }
  plan.visibleDays.forEach(() => {
    styles[index] = { cellWidth: plan.table.dayWidthMm, halign: "center" };
    index += 1;
  });
  // Rekap headers ("H/S/I/A/D/Jml") must NEVER wrap or get clipped to "Jm".
  plan.visibleRekapKeys.forEach(() => {
    styles[index] = { cellWidth: plan.table.rekapWidthMm, halign: "center", overflow: "visible" };
    index += 1;
  });

  return styles;
}

function resolveCompactRekapFontSize(
  rekapWidthMm: number,
  baseFontPt: number,
  options?: { extraTight?: boolean },
) {
  const compactFont = rekapWidthMm <= 5.3
    ? Math.max(6, baseFontPt - 1.5)
    : rekapWidthMm <= 6.1
      ? Math.max(6, baseFontPt - 0.8)
      : baseFontPt;

  if (!options?.extraTight) return compactFont;

  return rekapWidthMm <= 5.3
    ? Math.max(5.2, compactFont - 0.8)
    : rekapWidthMm <= 6.1
      ? Math.max(5.8, compactFont - 0.5)
      : Math.max(6.2, compactFont - 0.3);
}

function resolveFittedTextFontSize(
  doc: jsPDF,
  text: string,
  widthMm: number,
  baseFontPt: number,
  minFontPt: number,
) {
  const normalized = text.trim();
  if (!normalized) return baseFontPt;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(baseFontPt);
  const textWidthMm = doc.getTextWidth(normalized);
  if (textWidthMm <= widthMm) return baseFontPt;

  const scaledFontPt = (widthMm / textWidthMm) * baseFontPt;
  return Number(Math.max(minFontPt, Math.min(baseFontPt, scaledFontPt)).toFixed(2));
}

function drawFooter(doc: jsPDF, data: AttendancePrintDataset, plan: AttendancePrintLayoutPlan, pageNumber: number) {
  const y = plan.paper.pageHeightMm - 3.5;
  const xLeft = plan.paper.marginLeftMm;
  const xRight = plan.paper.pageWidthMm - plan.paper.marginRightMm;

  // Top border line for footer
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.2);
  doc.line(xLeft, y - 3.2, xRight, y - 3.2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(Math.max(6, plan.table.metaFontPt - 1));
  doc.setTextColor(...COLORS.muted);
  doc.text(`SIPENA — Dokumen Presensi · ${data.exportTimeLabel}`, xLeft, y);

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.ink);
  doc.text(`Halaman ${pageNumber}/${plan.plannedPageCount}`, xRight, y, { align: "right" });
}

function estimateInfoBlockHeight(items: string[], doc: jsPDF, widthMm: number, fontSizePt: number) {
  if (items.length === 0) return 0;
  const contentFontPt = Math.max(5.6, fontSizePt - 1.1);
  const lineHeight = 3.15;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(contentFontPt);
  const contentLines = items.reduce((total, item) => total + Math.max(1, doc.splitTextToSize(item, widthMm).length), 0);
  return SHELL_MM.infoBlockHeader + contentLines * lineHeight + 1.5;
}

function resolveInfoItemToneColor(item: string | AttendancePrintInfoItem): [number, number, number] {
  if (typeof item === "string") return COLORS.muted;
  if (item.tone === "national") return [185, 28, 28];
  if (item.tone === "custom") return [180, 83, 9];
  if (item.tone === "event") return [124, 58, 237];
  return COLORS.muted;
}

function drawInfoBlock(
  doc: jsPDF,
  title: string,
  items: Array<string | AttendancePrintInfoItem>,
  x: number,
  y: number,
  widthMm: number,
  fontSizePt: number,
  accentColor = "#0f172a",
  accentBg = "#f8fafc",
  infoBlockGapMm: number = SHELL_MM.infoBlockGap,
) {
  if (items.length === 0) return y;

  const useTwoCols = items.length > 2;
  const colWidthMm = useTwoCols ? (widthMm - 10) / 2 : widthMm - 4;
  const wrappedItems = items.map((item) => ({ item, lines: doc.splitTextToSize(typeof item === "string" ? item : item.text, colWidthMm) }));
  const contentFontPt = Math.max(5.6, fontSizePt - 1.1);
  const contentLineHeight = 3.15;
  const titleFontPt = Math.max(6, fontSizePt - 0.35);

  // Calculate block height based on visual rows (paired in 2-col mode)
  let blockHeight: number;
  if (useTwoCols) {
    // Pair items left/right; height = max of each pair
    let totalRowHeightMm = 0;
    for (let i = 0; i < wrappedItems.length; i += 2) {
      const leftLines = Math.max(1, wrappedItems[i]?.lines.length ?? 0);
      const rightLines = i + 1 < wrappedItems.length ? Math.max(1, wrappedItems[i + 1]?.lines.length ?? 0) : 0;
      totalRowHeightMm += Math.max(leftLines, rightLines) * contentLineHeight;
    }
    blockHeight = SHELL_MM.infoBlockHeader + totalRowHeightMm + 1.5;
  } else {
    blockHeight = SHELL_MM.infoBlockHeader
      + wrappedItems.reduce((sum, entry) => sum + Math.max(1, entry.lines.length) * contentLineHeight, 0)
      + 1.5;
  }

  const hexToRgb = (hex: string): [number, number, number] => [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];

  doc.setFillColor(...hexToRgb(accentBg));
  doc.setDrawColor(...COLORS.border);
  doc.roundedRect(x, y, widthMm, blockHeight, 1.5, 1.5, "FD");

  let cursorY = y + 4;
  doc.setTextColor(...hexToRgb(accentColor));
  doc.setFont("helvetica", "bold");
  doc.setFontSize(titleFontPt);
  doc.text(title, x + 2, cursorY);
  cursorY += 3.1;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(contentFontPt);
  doc.setTextColor(...COLORS.muted);

  if (useTwoCols) {
    const col2X = x + 2 + colWidthMm + 6;
    for (let i = 0; i < wrappedItems.length; i += 2) {
      const left = wrappedItems[i];
      const right = i + 1 < wrappedItems.length ? wrappedItems[i + 1] : null;
      const rowLines = Math.max(left.lines.length, right ? right.lines.length : 0);
      doc.setTextColor(...resolveInfoItemToneColor(left.item));
      doc.text(left.lines, x + 2, cursorY);
      if (right) {
        doc.setTextColor(...resolveInfoItemToneColor(right.item));
        doc.text(right.lines, col2X, cursorY);
      }
      cursorY += rowLines * contentLineHeight;
    }
  } else {
    wrappedItems.forEach(({ item, lines }) => {
      doc.setTextColor(...resolveInfoItemToneColor(item));
      doc.text(lines, x + 2, cursorY);
      cursorY += Math.max(1, lines.length) * contentLineHeight;
    });
  }

  return y + blockHeight + infoBlockGapMm;
}

export function resolveAttendancePdfRotateInlineAnnotationFit(
  doc: jsPDF,
  text: string,
  widthMm: number,
  heightMm: number,
): AttendancePdfRotateInlineAnnotationFit {
  const previewPxToPt = (value: number) => value * 0.75;
  const layout = resolveAttendanceInlineAnnotationLayout({
    text,
    labelStyle: "rotate-90",
    widthMm,
    heightMm,
  });
  const normalizedText = layout.text.trim() || "-";
  const availableLengthMm = Math.max(2, heightMm - ROTATE_90_LENGTH_SAFETY_MM);
  const availableThicknessMm = Math.max(1.2, widthMm - ROTATE_90_THICKNESS_SAFETY_MM);
  let fontPt = previewPxToPt(layout.fontPx);
  const minFontPt = 3.4;

  doc.setFontSize(fontPt);
  let textWidthMm = doc.getTextWidth(normalizedText);
  let lineBoxHeightMm = doc.getTextDimensions(normalizedText).h;
  while (
    fontPt > minFontPt
    && (textWidthMm > availableLengthMm || lineBoxHeightMm > availableThicknessMm)
  ) {
    fontPt = Math.max(minFontPt, fontPt - 0.2);
    doc.setFontSize(fontPt);
    textWidthMm = doc.getTextWidth(normalizedText);
    lineBoxHeightMm = doc.getTextDimensions(normalizedText).h;
  }

  return {
    text: normalizedText,
    fontPt: Number(fontPt.toFixed(2)),
    textWidthMm: Number(textWidthMm.toFixed(2)),
    lineBoxHeightMm: Number(lineBoxHeightMm.toFixed(2)),
    availableLengthMm: Number(availableLengthMm.toFixed(2)),
    availableThicknessMm: Number(availableThicknessMm.toFixed(2)),
    glyphCenterOffsetMm: Number((-lineBoxHeightMm * ROTATE_90_BASELINE_CENTER_FACTOR).toFixed(2)),
  };
}

function drawInlineAnnotations(doc: jsPDF, plan: AttendancePrintLayoutPlan, page: AttendancePrintPage) {
  if (plan.annotationDisplayMode !== "inline-vertical" || plan.inlineAnnotations.length === 0) return;

  const headerHeightMm = plan.table.headerRowHeightMm * 2;
  const bodyTopMm = page.tableStartYMm + headerHeightMm;
  const bodyHeightMm = page.rowHeightsMm.reduce((sum, height) => sum + height, 0);
  if (bodyHeightMm <= 0) return;

  let dayAreaLeftMm = plan.paper.marginLeftMm;
  if (plan.visibleColumnKeys.has("no")) dayAreaLeftMm += plan.table.noWidthMm;
  if (plan.visibleColumnKeys.has("name")) dayAreaLeftMm += plan.table.nameWidthMm;
  if (plan.visibleColumnKeys.has("nisn")) dayAreaLeftMm += plan.table.nisnWidthMm;

  const toneMap = {
    national: { fill: [30, 64, 175] as [number, number, number], stroke: [191, 219, 254] as [number, number, number] },
    custom: { fill: [180, 83, 9] as [number, number, number], stroke: [253, 230, 138] as [number, number, number] },
    event: { fill: [109, 40, 217] as [number, number, number], stroke: [221, 214, 254] as [number, number, number] },
  } as const;
  const previewPxToMm = (value: number) => value / PX_PER_MM;
  const previewPxToPt = (value: number) => value * 0.75;

  const resolveStackedLayout = (text: string, widthMm: number, heightMm: number) => {
    const layout = resolveAttendanceInlineAnnotationLayout({
      text,
      labelStyle: "stacked",
      widthMm,
      heightMm,
    });
    let fontPt = previewPxToPt(layout.fontPx);
    doc.setFontSize(fontPt);
    let widestCharMm = Math.max(...layout.stackedChars.map((char) => doc.getTextWidth(char)), 0);
    let charLineHeightMm = Math.max(1.75, previewPxToMm(layout.lineHeightPx));
    const gapRatio = Math.max(0.52, Math.min(0.82, (layout.gapLineHeightPx ?? layout.lineHeightPx * 0.48) / Math.max(layout.lineHeightPx, 0.01)));
    let gapLineHeightMm = Math.max(0.9, previewPxToMm(layout.gapLineHeightPx ?? layout.lineHeightPx * gapRatio));
    const getTotalHeightMm = (segments: AttendanceInlineAnnotationStackedSegment[]) => segments.reduce(
      (sum, segment) => sum + (segment.kind === "gap" ? gapLineHeightMm : charLineHeightMm),
      0,
    );
    while (
      fontPt > 4.6
      && (
        widestCharMm > Math.max(1.4, widthMm - 1.1)
        || getTotalHeightMm(layout.stackedSegments ?? getAttendanceInlineAnnotationStackedSegments(text)) > Math.max(8, heightMm - 3.5)
      )
    ) {
      fontPt -= 0.2;
      doc.setFontSize(fontPt);
      widestCharMm = Math.max(...layout.stackedChars.map((char) => doc.getTextWidth(char)), 0);
      charLineHeightMm = Math.max(1.7, fontPt * 0.34 + 0.34);
      gapLineHeightMm = Math.max(0.9, charLineHeightMm * gapRatio);
    }
    return {
      segments: layout.stackedSegments ?? getAttendanceInlineAnnotationStackedSegments(text),
      fontPt: Number(fontPt.toFixed(2)),
      charLineHeightMm: Number(charLineHeightMm.toFixed(2)),
      gapLineHeightMm: Number(gapLineHeightMm.toFixed(2)),
    };
  };

  plan.inlineAnnotations.forEach((annotation) => {
    const leftMm = dayAreaLeftMm + (annotation.startColumnIndex * plan.table.dayWidthMm);
    const widthMm = (annotation.endColumnIndex - annotation.startColumnIndex + 1) * plan.table.dayWidthMm;
    if (widthMm <= 0) return;
    const tone = toneMap[annotation.tone];
    const centerX = leftMm + (widthMm / 2);
    const centerY = bodyTopMm + (bodyHeightMm / 2);

    // Step 1: paint a white merged-cell background so the table's row/column
    // separators (which still draw underneath) disappear visually.
    doc.setFillColor(255, 255, 255);
    doc.rect(leftMm, bodyTopMm, widthMm, bodyHeightMm, "F");

    // Step 2: draw the rounded outline of the merged annotation cell.
    doc.setDrawColor(...tone.stroke);
    doc.setLineWidth(0.18);
    const padInset = 0.6;
    doc.roundedRect(
      leftMm + padInset,
      bodyTopMm + padInset,
      Math.max(1, widthMm - padInset * 2),
      Math.max(1, bodyHeightMm - padInset * 2),
      1.6,
      1.6,
      "S",
    );
    doc.setTextColor(...tone.fill);
    doc.setFont("helvetica", "bold");

    if (plan.inlineLabelStyle === "stacked") {
      const stackedLayout = resolveStackedLayout(annotation.text, widthMm, bodyHeightMm);
      const { segments, fontPt, charLineHeightMm, gapLineHeightMm } = stackedLayout;
      const totalHeightMm = segments.reduce(
        (sum, segment) => sum + (segment.kind === "gap" ? gapLineHeightMm : charLineHeightMm),
        0,
      );
      let cursorY = centerY - (totalHeightMm / 2);
      doc.setFontSize(fontPt);
      segments.forEach((segment) => {
        const lineHeightMm = segment.kind === "gap" ? gapLineHeightMm : charLineHeightMm;
        cursorY += lineHeightMm / 2;
        if (segment.kind === "char") {
          doc.text(segment.text, centerX, cursorY, { align: "center", baseline: "middle" });
        }
        cursorY += lineHeightMm / 2;
      });
      return;
    }

    const rotateLayout = resolveAttendancePdfRotateInlineAnnotationFit(doc, annotation.text, widthMm, bodyHeightMm);
    const { text, fontPt, textWidthMm, glyphCenterOffsetMm } = rotateLayout;
    doc.setFontSize(fontPt);
    doc.text(text, centerX + glyphCenterOffsetMm, centerY - (textWidthMm / 2), {
      angle: -90,
    });
  });
}

function drawSummary(
  doc: jsPDF,
  plan: AttendancePrintLayoutPlan,
  page: AttendancePrintPage,
  currentY: number,
  signature: SignatureData | null | undefined,
  includeSignature: boolean,
  drawSignatureHere: boolean,
) {
  const summaryContent = page.summaryContent;
  if (!summaryContent) return;

  const contentWidth = plan.paper.contentWidthMm;
  const x = plan.paper.marginLeftMm;
  const legendFontPt = Math.max(6, plan.table.metaFontPt - 1.2);

  let nextY = currentY + plan.shell.summaryGap;
  if (summaryContent.showLegend) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(legendFontPt);
    let legendX = x;
    let legendY = nextY + 2.8;

    plan.summary.legend.forEach((item) => {
      doc.setFillColor(
        Number.parseInt(item.bg.slice(1, 3), 16),
        Number.parseInt(item.bg.slice(3, 5), 16),
        Number.parseInt(item.bg.slice(5, 7), 16),
      );
      const labelText = `${item.label} = ${item.description}`;
      const badgePadX = 2.4;
      const labelWidth = Math.max(18, doc.getTextWidth(labelText) + badgePadX * 2);
      if (legendX + labelWidth > x + contentWidth) {
        legendX = x;
        legendY += 6;
      }
      doc.roundedRect(legendX, legendY - 3.5, labelWidth, 5, 2, 2, "F");
      doc.setTextColor(
        Number.parseInt(item.color.slice(1, 3), 16),
        Number.parseInt(item.color.slice(3, 5), 16),
        Number.parseInt(item.color.slice(5, 7), 16),
      );
      doc.text(labelText, legendX + badgePadX, legendY);
      legendX += labelWidth + 2;
    });

    nextY = legendY + 4.1;
  }
  if (summaryContent.keteranganItems.length > 0) {
    nextY = drawInfoBlock(doc, summaryContent.keteranganTitle ?? "Keterangan", summaryContent.keteranganItems, x, nextY, contentWidth, summaryContent.keteranganFontPt, "#0369a1", "#f0f9ff", plan.shell.infoBlockGap);
  }
  if (summaryContent.notesItems.length > 0) {
    nextY = drawInfoBlock(doc, summaryContent.notesTitle ?? "Catatan Siswa", summaryContent.notesItems, x, nextY, contentWidth, summaryContent.notesFontPt, "#0f172a", "#f8fafc", plan.shell.infoBlockGap);
  }

  // CRITICAL: only draw the signature when this page is the designated TTD page.
  // When a dedicated trailing signature page exists, drawSignatureHere=false so
  // the table page never renders the TTD on top of student rows.
  if (drawSignatureHere && includeSignature && signature) {
    addSignatureBlockPDF(
      doc,
      signature,
      nextY + plan.shell.signatureGap,
      plan.signaturePlacement
        ? {
            xMm: plan.signaturePlacement.xMm,
            yMm: plan.signaturePlacement.yMm,
            widthMm: plan.signaturePlacement.widthMm,
          }
        : null,
    );
  }
}

export function exportAttendancePdf(args: {
  data: AttendancePrintDataset;
  plan: AttendancePrintLayoutPlan;
  signature?: SignatureData | null;
  includeSignature: boolean;
  fileName: string;
  debugCollector?: (event: {
    phase: "start" | "page" | "finish";
    runtime?: AttendancePdfRuntimeTrace;
    mismatch?: AttendanceExportMismatch;
  }) => void;
}) {
  const { fileName, debugCollector } = args;
  const built = buildAttendancePdfDocument({
    ...args,
    debugCollector,
  });
  built.doc.save(fileName);
  debugCollector?.({ phase: "finish" });
}

export function buildAttendancePdfDocument(args: {
  data: AttendancePrintDataset;
  plan: AttendancePrintLayoutPlan;
  signature?: SignatureData | null;
  includeSignature: boolean;
  debugCollector?: (event: {
    phase: "start" | "page";
    runtime?: AttendancePdfRuntimeTrace;
    mismatch?: AttendanceExportMismatch;
  }) => void;
}) {
  const { data, plan, signature, includeSignature, debugCollector } = args;
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: [plan.paper.pageWidthMm, plan.paper.pageHeightMm],
  });

    const tableStartY = plan.paper.marginTopMm + plan.shell.topBanner + plan.shell.metaBar + plan.shell.contentPaddingY;
  const bodyRowsByPage = plan.pages.map((page) => buildBodyRows(data, plan, page));
  const { row1, row2, mergedColumns } = buildHeadRows(plan);
  const columnStyles = buildColumnStyles(plan);
  const mismatches: AttendanceExportMismatch[] = [];
  const runtimeEntries: AttendancePdfRuntimeTrace[] = [];

  debugCollector?.({ phase: "start" });

  plan.pages.forEach((page, pageIndex) => {
    if (pageIndex > 0) {
      doc.addPage([plan.paper.pageWidthMm, plan.paper.pageHeightMm], "landscape");
    }

    drawPageHeader(doc, data, plan, page);

    // Dedicated signature-only page: skip the table entirely and draw just
    // the signature block + footer. Triggered when planner detects there
    // is not enough safe room on the table's last page.
    const isSignatureOnlyPage = page.isSignatureOnlyPage;
    if (isSignatureOnlyPage) {
      if (includeSignature && signature && plan.signaturePlacement) {
        addSignatureBlockPDF(doc, signature, plan.signaturePlacement.yMm, {
          xMm: plan.signaturePlacement.xMm,
          yMm: plan.signaturePlacement.yMm,
          widthMm: plan.signaturePlacement.widthMm,
        });
      }
      drawFooter(doc, data, plan, page.pageNumber);
      runtimeEntries.push({
        plannedPageNumber: page.pageNumber,
        docPageBeforeTable: doc.getCurrentPageInfo().pageNumber,
        docPageAfterTable: doc.getCurrentPageInfo().pageNumber,
        autoTableFinalY: null,
        tableOverflowDetected: false,
        extraPagesInserted: 0,
        bodyRowCount: 0,
        summaryRowsIncluded: 0,
        actualPageNumbers: [doc.getCurrentPageInfo().pageNumber],
        headerDrawn: true,
        footerDrawn: true,
        footerLabel: `Halaman ${page.pageNumber}/${plan.plannedPageCount}`,
      });
      debugCollector?.({
        phase: "page",
        runtime: {
          plannedPageNumber: page.pageNumber,
          docPageBeforeTable: doc.getCurrentPageInfo().pageNumber,
          docPageAfterTable: doc.getCurrentPageInfo().pageNumber,
          autoTableFinalY: null,
          tableOverflowDetected: false,
          extraPagesInserted: 0,
          bodyRowCount: 0,
          summaryRowsIncluded: 0,
          actualPageNumbers: [doc.getCurrentPageInfo().pageNumber],
          headerDrawn: true,
          footerDrawn: true,
          footerLabel: `Halaman ${page.pageNumber}/${plan.plannedPageCount}`,
        },
      });
      return;
    }

    const dayStartIndex
      = (plan.visibleColumnKeys.has("no") ? 1 : 0)
      + (plan.visibleColumnKeys.has("name") ? 1 : 0)
      + (plan.visibleColumnKeys.has("nisn") ? 1 : 0);
    const dayEndIndex = dayStartIndex + plan.visibleDays.length;
    const inlineDayTableColumns = new Set<number>();
    if (plan.annotationDisplayMode === "inline-vertical") {
      plan.inlineAnnotations.forEach((range) => {
        for (let columnIndex = range.startColumnIndex; columnIndex <= range.endColumnIndex; columnIndex += 1) {
          inlineDayTableColumns.add(dayStartIndex + columnIndex);
        }
      });
    }
    const nameColumnIndex = plan.visibleColumnKeys.has("name")
      ? (plan.visibleColumnKeys.has("no") ? 1 : 0)
      : -1;
    const nisnColumnIndex = plan.visibleColumnKeys.has("nisn")
      ? (plan.visibleColumnKeys.has("no") ? 1 : 0) + (plan.visibleColumnKeys.has("name") ? 1 : 0)
      : -1;
    const isSummaryOnlyPage = page.kind === "summary-continuation";
    const totalRowIndex = page.hasSummaryRows ? bodyRowsByPage[pageIndex].length - 2 : -1;
    const percentageRowIndex = page.hasSummaryRows ? bodyRowsByPage[pageIndex].length - 1 : -1;
    const docPageBeforeTable = doc.getCurrentPageInfo().pageNumber;
    const pageBottomLimitMm = page.tableMaxBottomMm;
    const pageBottomMarginMm = Math.max(0, plan.paper.pageHeightMm - pageBottomLimitMm);
    const runtimeTrace: AttendancePdfRuntimeTrace = {
      plannedPageNumber: page.pageNumber,
      docPageBeforeTable,
      docPageAfterTable: docPageBeforeTable,
      autoTableFinalY: null,
      tableOverflowDetected: false,
      extraPagesInserted: 0,
      bodyRowCount: page.rowEnd - page.rowStart,
      summaryRowsIncluded: page.hasSummaryRows ? 2 : 0,
      actualPageNumbers: [docPageBeforeTable],
      headerDrawn: true,
      footerDrawn: false,
      footerLabel: `Halaman ${page.pageNumber}/${plan.plannedPageCount}`,
    };

    if (page.plannedBodyHeightMm > page.availableBodyHeightMm) {
      const mismatch: AttendanceExportMismatch = {
        kind: "slice_overflow_before_render",
        severity: "error",
        message: `Halaman ${page.pageNumber} melebihi tinggi body yang direncanakan sebelum autoTable berjalan.`,
        pageNumber: page.pageNumber,
        details: {
          plannedBodyHeightMm: page.plannedBodyHeightMm,
          availableBodyHeightMm: page.availableBodyHeightMm,
        },
      };
      mismatches.push(mismatch);
      debugCollector?.({ phase: "page", mismatch });
    }

    if (!isSummaryOnlyPage) {
      autoTable(doc, {
      startY: tableStartY,
      tableWidth: plan.table.tableWidthMm,
      head: [row1, row2],
      body: bodyRowsByPage[pageIndex],
      margin: {
        top: tableStartY,
        left: plan.paper.marginLeftMm,
        right: plan.paper.marginRightMm,
        bottom: plan.paper.marginBottomMm,
      },
      // pageBreak:"auto" lets autoTable split inside the table when our pre-sliced
      // rows minimally overflow due to border/padding rounding, instead of pushing
      // the WHOLE table to a new page (which causes blank-first-page bug).
      pageBreak: "auto",
      rowPageBreak: "avoid",
      styles: {
        font: "helvetica",
        fontSize: plan.table.bodyFontPt,
        cellPadding: plan.table.bodyCellPaddingMm,
        lineWidth: 0.1,
        lineColor: COLORS.border,
        textColor: COLORS.ink,
        minCellHeight: plan.table.bodyRowHeightMm,
        halign: "center",
        valign: "middle",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: COLORS.header,
        textColor: COLORS.headerText,
        fontSize: plan.table.headerFontPt,
        fontStyle: "bold",
        lineColor: COLORS.headerDark,
        minCellHeight: plan.table.headerRowHeightMm,
        halign: "center",
        valign: "middle",
      },
      columnStyles,
      alternateRowStyles: { fillColor: COLORS.panel },
      didParseCell: (hook) => {
        if (hook.section === "body") {
          hook.cell.styles.minCellHeight = resolveBodyRowHeightMm(page, plan, hook.row.index);
        }

        if (hook.section === "head" && mergedColumns.has(hook.column.index)) {
          if (hook.row.index === 0) {
            hook.cell.rowSpan = 2;
          } else if (hook.row.index === 1) {
            hook.cell.text = [];
          }
        }

        if (hook.section === "head" && hook.column.index >= dayStartIndex && hook.column.index < dayEndIndex) {
          const day = plan.visibleDays[hook.column.index - dayStartIndex];
          hook.cell.styles.fontSize = hook.row.index === 0 ? plan.table.dayHeaderFontPt : plan.table.dayDateFontPt;
          hook.cell.styles.cellPadding = { top: 0.4, right: 0.2, bottom: 0.4, left: 0.2 };
          if (day?.isHoliday) hook.cell.styles.fillColor = [245, 158, 11];
          else if (day?.hasEvent) hook.cell.styles.fillColor = [124, 58, 237];
        }

        if (hook.section === "head" && hook.column.index >= dayEndIndex) {
          hook.cell.styles.fontSize = resolveCompactRekapFontSize(
            plan.table.rekapWidthMm,
            plan.table.headerFontPt,
          );
          hook.cell.styles.cellPadding = { top: 0.5, right: 0.4, bottom: 0.5, left: 0.4 };
        }

        if (
          hook.section === "body"
          && hook.row.index !== totalRowIndex
          && hook.row.index !== percentageRowIndex
          && hook.column.index === nameColumnIndex
        ) {
          hook.cell.styles.halign = "left";
          hook.cell.styles.overflow = "linebreak";
        }
        if (
          hook.section === "body"
          && hook.row.index !== totalRowIndex
          && hook.row.index !== percentageRowIndex
          && hook.column.index === nisnColumnIndex
        ) {
          hook.cell.styles.overflow = "visible";
          hook.cell.styles.halign = "center";
        }

        if (hook.section === "body" && hook.row.index === totalRowIndex) {
          hook.cell.styles.fillColor = COLORS.totalRow;
          hook.cell.styles.fontStyle = "bold";
          hook.cell.styles.textColor = [30, 41, 59];
          // Apply same compact-font scaling as regular rekap cells so content fits
          if (hook.column.index >= dayEndIndex) {
            hook.cell.styles.fontSize = resolveCompactRekapFontSize(
              plan.table.rekapWidthMm,
              plan.table.bodyFontPt,
            );
          }
        }

        if (hook.section === "body" && hook.row.index === percentageRowIndex) {
          hook.cell.styles.fillColor = COLORS.percentRow;
          hook.cell.styles.fontStyle = "bold";
          hook.cell.styles.textColor = [30, 64, 175];
          hook.cell.styles.cellPadding = { top: 0.35, right: 0.1, bottom: 0.35, left: 0.1 };
          if (hook.column.index >= dayEndIndex) {
            const basePercentFontPt = resolveCompactRekapFontSize(
              plan.table.rekapWidthMm,
              plan.table.bodyFontPt,
            );
            const availableTextWidthMm = Math.max(
              3.6,
              plan.table.rekapWidthMm - 0.25,
            );
            const fittedPercentFontPt = resolveFittedTextFontSize(
              doc,
              String(hook.cell.raw ?? ""),
              availableTextWidthMm,
              basePercentFontPt,
              Math.max(5.8, basePercentFontPt - 1.4),
            );
            hook.cell.styles.fontSize = fittedPercentFontPt;
          }
        }

        if (
          hook.section === "body"
          && hook.row.index !== totalRowIndex
          && hook.row.index !== percentageRowIndex
          && hook.column.index >= dayStartIndex
          && hook.column.index < dayEndIndex
        ) {
          const dayColumnIndex = hook.column.index;
          if (inlineDayTableColumns.has(dayColumnIndex)) {
            // Visually merge inline-annotation columns: hide row separators
            // and cell fill so drawInlineAnnotations() can paint a single
            // continuous block over the entire body strip.
            hook.cell.styles.fillColor = [255, 255, 255];
            hook.cell.styles.lineColor = [255, 255, 255];
            hook.cell.styles.lineWidth = 0.001;
            hook.cell.text = [];
          } else {
            const cellValue = String(hook.cell.raw ?? "");
            const status = STATUS_COLORS[cellValue];
            if (status) {
              hook.cell.styles.fillColor = status.fill;
              hook.cell.styles.textColor = status.text;
              hook.cell.styles.fontStyle = "bold";
            }
          }
        }

        if (
          hook.section === "body"
          && hook.row.index !== totalRowIndex
          && hook.row.index !== percentageRowIndex
          && hook.column.index >= dayEndIndex
        ) {
          const rekapKey = plan.visibleRekapKeys[hook.column.index - dayEndIndex];
          const status = rekapKey && rekapKey !== "total" ? STATUS_COLORS[rekapKey] : null;
          hook.cell.styles.fontSize = resolveCompactRekapFontSize(
            plan.table.rekapWidthMm,
            plan.table.bodyFontPt,
          );
          if (status) {
            hook.cell.styles.fillColor = status.fill;
            hook.cell.styles.textColor = status.text;
            hook.cell.styles.fontStyle = "bold";
          }
        }
      },
      });

    // ── Rounded table outer border (overlays autoTable's rect border with
    //    a roundedRect stroke so corners visually appear rounded). Sinkron
    //    1:1 dengan preview yang membungkus <table> dengan borderRadius.
      const tableFinalYForBorder = Number(((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? tableStartY));
      if (tableFinalYForBorder > tableStartY) {
        const radius = 1.6;
        doc.setDrawColor(...COLORS.headerDark);
        doc.setLineWidth(0.35);
        doc.roundedRect(
          plan.paper.marginLeftMm,
          tableStartY,
          plan.table.tableWidthMm,
          tableFinalYForBorder - tableStartY,
          radius,
          radius,
          "S",
        );
      }
      drawInlineAnnotations(doc, plan, page);

      runtimeTrace.docPageAfterTable = doc.getCurrentPageInfo().pageNumber;
      runtimeTrace.autoTableFinalY = Number(((doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 0).toFixed(2));
      runtimeTrace.extraPagesInserted = Math.max(0, runtimeTrace.docPageAfterTable - runtimeTrace.docPageBeforeTable);
      runtimeTrace.actualPageNumbers = Array.from(
        { length: runtimeTrace.extraPagesInserted + 1 },
        (_, index) => runtimeTrace.docPageBeforeTable + index,
      );
      runtimeTrace.tableOverflowDetected = runtimeTrace.extraPagesInserted > 0 || (!!runtimeTrace.autoTableFinalY && runtimeTrace.autoTableFinalY > pageBottomLimitMm);

      if (runtimeTrace.extraPagesInserted > 0) {
        const mismatch: AttendanceExportMismatch = {
          kind: "extra_pdf_page_inserted",
          severity: "error",
          message: `autoTable menambahkan ${runtimeTrace.extraPagesInserted} halaman tambahan di luar plan pada halaman ${page.pageNumber}.`,
          pageNumber: page.pageNumber,
          details: {
            docPageBeforeTable: runtimeTrace.docPageBeforeTable,
            docPageAfterTable: runtimeTrace.docPageAfterTable,
            pageBottomLimitMm,
            autoTableFinalY: runtimeTrace.autoTableFinalY,
          },
        };
        mismatches.push(mismatch);
        debugCollector?.({ phase: "page", mismatch });
      }
    }

    if (page.showSummary) {
      drawSummary(
        doc,
        plan,
        page,
        page.kind === "summary-continuation"
          ? (plan.paper.marginTopMm + Math.max(0, plan.shell.topBanner - 2))
          : plan.summaryLayout.tableEndYMm,
        signature,
        includeSignature,
        page.drawSignatureHere,
      );
      drawFooter(doc, data, plan, page.pageNumber);
      runtimeTrace.footerDrawn = true;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(Math.max(6, plan.table.metaFontPt - 1));
      doc.setTextColor(...COLORS.muted);
      doc.text(
        "Lanjutan tabel presensi. Ringkasan ditampilkan pada halaman terakhir.",
        plan.paper.pageWidthMm / 2,
        plan.paper.pageHeightMm - plan.paper.marginBottomMm - 2.5,
        { align: "center" },
      );
      drawFooter(doc, data, plan, page.pageNumber);
      runtimeTrace.footerDrawn = true;
    }
    runtimeEntries.push(runtimeTrace);
    debugCollector?.({ phase: "page", runtime: runtimeTrace });
  });

  return {
    doc,
    runtimeEntries,
    mismatches,
    pageCount: doc.getNumberOfPages(),
    arrayBuffer: () => doc.output("arraybuffer"),
    blob: () => doc.output("blob"),
    dataUriString: () => doc.output("datauristring"),
  };
}

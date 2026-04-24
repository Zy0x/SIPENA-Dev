import type { SignatureData } from "./exportSignature";

export type ReportPaperSize = "a4" | "f4" | "auto" | "full-page";
export type ReportColumnAlignment = "left" | "center" | "right";
export type ReportTableSizingMode = "autofit-window" | "autofit-content" | "fixed";

export interface ExportMetaItem {
  label: string;
  value: string | number;
}

export interface ExportMetaGroup {
  align?: "left" | "center" | "right";
  items: ExportMetaItem[];
}

export interface ExportColumn {
  key: string;
  label: string;
  type: string;
  chapterId?: string;
  assignmentId?: string;
  semester?: number;
}

export interface HeaderGroup {
  label: string;
  colSpan: number;
  bgClass?: string;
  isChapter?: boolean;
  semester?: number;
}

export interface ExportConfig {
  className: string;
  subjectName: string;
  kkm: number;
  periodLabel: string;
  isCombinedView: boolean;
  columns: ExportColumn[];
  headerGroups: HeaderGroup[];
  chapterGroups: Array<{ id: string; name: string; columns: ExportColumn[] }>;
  data: Record<string, string | number>[];
  dateStr: string;
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  signature?: SignatureData | null;
  includeSignature?: boolean;
  paperSize?: ReportPaperSize;
  documentTitle?: string;
  continuationTitle?: string;
  metaGroups?: ExportMetaGroup[];
  fileBaseName?: string;
  documentStyle?: {
    titleFontSize: number;
    metaFontSize: number;
    tableHeaderFontSize: number;
    tableBodyFontSize: number;
    layoutPreset?: "standard" | "one-page" | "single-column-full" | "compact" | "large";
    experimentalColumnTypographyEnabled?: boolean;
    experimentalColumnLayoutEnabled?: boolean;
    tableSizing?: {
      mode?: ReportTableSizingMode;
      tableWidthPercent?: number;
      headerRowHeightMm?: number;
      bodyRowHeightMm?: number;
    };
    columnFontOverrides?: Record<string, {
      headerFontSize?: number;
      bodyFontSize?: number;
      headerAlignment?: ReportColumnAlignment;
      bodyAlignment?: ReportColumnAlignment;
      widthMm?: number;
      sizingMode?: "inherit" | ReportTableSizingMode;
    }>;
  };
  autoFitOnePage?: boolean;
}

export interface ReportPageMetrics {
  pageWidthMm: number;
  pageHeightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  footerHeightMm: number;
  firstPageTableStartY: number;
  nextPageTableStartY: number;
  headerRowHeightMm: number;
  bodyRowHeightMm: number;
  metaSectionHeightMm: number;
  signatureGapMm: number;
}

export interface SignatureBlockMetrics {
  widthMm: number;
  heightMm: number;
  safeXMm: number;
  safeYMm: number;
  safeWidthMm: number;
  safeHeightMm: number;
}

export interface SignaturePlacement {
  pageIndex: number;
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  safeZone: SignatureBlockMetrics;
  mode: "adaptive" | "flow" | "fixed";
  preset: "follow-content" | "bottom-left" | "bottom-center" | "bottom-right";
  isClamped: boolean;
}

export interface ReportLayoutPage {
  index: number;
  number: number;
  tableStartY: number;
  rows: Record<string, string | number>[];
  bodyStartIndex: number;
  bodyEndIndex: number;
  isLastPage: boolean;
  estimatedTableHeightMm: number;
  estimatedTableEndY: number;
}

export interface ReportExportLayoutPlan {
  metrics: ReportPageMetrics;
  pageLabel: string;
  pages: ReportLayoutPage[];
  columnWidthsMm: number[];
  warnings: string[];
  signaturePlacement: SignaturePlacement | null;
}

const DEFAULT_METRICS: ReportPageMetrics = {
  pageWidthMm: 297,
  pageHeightMm: 210,
  marginLeftMm: 8,
  marginRightMm: 8,
  marginTopMm: 10,
  marginBottomMm: 10,
  footerHeightMm: 8,
  firstPageTableStartY: 30,
  nextPageTableStartY: 18,
  headerRowHeightMm: 6,
  bodyRowHeightMm: 6,
  metaSectionHeightMm: 14,
  signatureGapMm: 5,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToGrid(value: number, gridSize: number) {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function getPageMetrics() {
  return DEFAULT_METRICS;
}

export function getColumnWidthMm(column: ExportColumn): number {
  switch (column.type) {
    case "index":
      return 10;
    case "name":
      return 34;
    case "nisn":
      return 20;
    case "status":
      return 18;
    case "rapor":
    case "avgRapor":
    case "grandAvg":
      return 18;
    case "chapterAvg":
      return 18;
    default:
      return 14;
  }
}

export function getColumnWidthsMm(columns: ExportColumn[]) {
  return columns.map(getColumnWidthMm);
}

export function estimateSignatureBlockMetrics(signature: SignatureData | null | undefined): SignatureBlockMetrics | null {
  if (!signature) return null;

  const signers = Array.isArray(signature.signers) && signature.signers.length > 0
    ? signature.signers.filter((signer) => signer.name?.trim() || signer.title?.trim())
    : [{
        name: signature.name || "",
        title: signature.title || "Guru Mata Pelajaran",
        nip: signature.nip,
        school_name: signature.school_name,
      }];

  const activeSigners = signers.length > 0 ? signers : [{
    name: "",
    title: "Guru Mata Pelajaran",
    nip: "",
    school_name: "",
  }];

  const lineWidthMm = Math.max(42, signature.signatureLineWidth || 50);
  const spacingMm = Math.max(10, signature.signatureSpacing || 20);
  const blockWidthMm = activeSigners.length === 1
    ? Math.max(72, lineWidthMm + 20)
    : clamp(activeSigners.length * Math.max(52, lineWidthMm + 12) + (activeSigners.length - 1) * spacingMm, 86, 190);
  const hasSchool = activeSigners.some((signer, index) => index === 0 && signer.school_name);
  const hasNip = activeSigners.some((signer) => signer.nip);
  const heightMm = 6 + 5 + (hasSchool ? 4 : 0) + 16 + 6 + (hasNip ? 4 : 0) + 7;

  return {
    widthMm: blockWidthMm,
    heightMm,
    safeXMm: 0,
    safeYMm: 0,
    safeWidthMm: 0,
    safeHeightMm: 0,
  };
}

function getSignatureMode(signature: SignatureData | null | undefined) {
  return signature?.placementMode || "adaptive";
}

function getSignaturePreset(signature: SignatureData | null | undefined) {
  return signature?.signaturePreset || "bottom-right";
}

function getHeaderRowCount(config: ExportConfig) {
  return config.headerGroups.length > 1 ? 2 : 1;
}

function getMaxRowsForPage({
  tableStartY,
  reserveSignature,
}: {
  tableStartY: number;
  reserveSignature: number;
}) {
  const metrics = DEFAULT_METRICS;
  const usableHeight = metrics.pageHeightMm
    - metrics.marginBottomMm
    - metrics.footerHeightMm
    - tableStartY
    - getHeaderRowCountHeight()
    - reserveSignature;

  return Math.max(1, Math.floor(usableHeight / metrics.bodyRowHeightMm));
}

function getHeaderRowCountHeight() {
  return DEFAULT_METRICS.headerRowHeightMm * 2;
}

export function buildReportLayoutPlan(config: ExportConfig): ReportExportLayoutPlan {
  const metrics = DEFAULT_METRICS;
  const signatureMetrics = config.includeSignature ? estimateSignatureBlockMetrics(config.signature) : null;
  const signatureReserve = signatureMetrics ? signatureMetrics.heightMm + metrics.signatureGapMm : 0;
  const firstPageCapacityWithSignature = getMaxRowsForPage({
    tableStartY: metrics.firstPageTableStartY,
    reserveSignature: signatureReserve,
  });
  const firstPageCapacity = getMaxRowsForPage({
    tableStartY: metrics.firstPageTableStartY,
    reserveSignature: 0,
  });
  const nextPageCapacity = getMaxRowsForPage({
    tableStartY: metrics.nextPageTableStartY,
    reserveSignature: 0,
  });
  const lastPageCapacity = getMaxRowsForPage({
    tableStartY: metrics.nextPageTableStartY,
    reserveSignature: signatureReserve,
  });

  const dataRows = [...config.data];
  const pages: ReportLayoutPage[] = [];

  if (dataRows.length <= firstPageCapacityWithSignature) {
    pages.push({
      index: 0,
      number: 1,
      tableStartY: metrics.firstPageTableStartY,
      rows: dataRows,
      bodyStartIndex: 0,
      bodyEndIndex: Math.max(0, dataRows.length - 1),
      isLastPage: true,
      estimatedTableHeightMm: getHeaderRowCountHeight() + dataRows.length * metrics.bodyRowHeightMm,
      estimatedTableEndY: metrics.firstPageTableStartY + getHeaderRowCountHeight() + dataRows.length * metrics.bodyRowHeightMm,
    });
  } else {
    let cursor = 0;
    const firstPageRows = dataRows.slice(0, firstPageCapacity);
    pages.push({
      index: 0,
      number: 1,
      tableStartY: metrics.firstPageTableStartY,
      rows: firstPageRows,
      bodyStartIndex: 0,
      bodyEndIndex: Math.max(0, firstPageRows.length - 1),
      isLastPage: false,
      estimatedTableHeightMm: getHeaderRowCountHeight() + firstPageRows.length * metrics.bodyRowHeightMm,
      estimatedTableEndY: metrics.firstPageTableStartY + getHeaderRowCountHeight() + firstPageRows.length * metrics.bodyRowHeightMm,
    });
    cursor += firstPageRows.length;

    while (dataRows.length - cursor > lastPageCapacity) {
      const pageRows = dataRows.slice(cursor, cursor + nextPageCapacity);
      pages.push({
        index: pages.length,
        number: pages.length + 1,
        tableStartY: metrics.nextPageTableStartY,
        rows: pageRows,
        bodyStartIndex: cursor,
        bodyEndIndex: cursor + pageRows.length - 1,
        isLastPage: false,
        estimatedTableHeightMm: getHeaderRowCountHeight() + pageRows.length * metrics.bodyRowHeightMm,
        estimatedTableEndY: metrics.nextPageTableStartY + getHeaderRowCountHeight() + pageRows.length * metrics.bodyRowHeightMm,
      });
      cursor += pageRows.length;
    }

    const lastRows = dataRows.slice(cursor);
    pages.push({
      index: pages.length,
      number: pages.length + 1,
      tableStartY: pages.length === 0 ? metrics.firstPageTableStartY : metrics.nextPageTableStartY,
      rows: lastRows,
      bodyStartIndex: cursor,
      bodyEndIndex: cursor + lastRows.length - 1,
      isLastPage: true,
      estimatedTableHeightMm: getHeaderRowCountHeight() + lastRows.length * metrics.bodyRowHeightMm,
      estimatedTableEndY: (pages.length === 0 ? metrics.firstPageTableStartY : metrics.nextPageTableStartY) + getHeaderRowCountHeight() + lastRows.length * metrics.bodyRowHeightMm,
    });
  }

  const warnings: string[] = [];
  let signaturePlacement: SignaturePlacement | null = null;

  if (config.includeSignature && config.signature && signatureMetrics && pages.length > 0) {
    const lastPage = pages[pages.length - 1];
    const safeXMm = metrics.marginLeftMm;
    const safeYMm = lastPage.estimatedTableEndY + metrics.signatureGapMm;
    const safeWidthMm = metrics.pageWidthMm - metrics.marginLeftMm - metrics.marginRightMm;
    const safeHeightMm = metrics.pageHeightMm - metrics.marginBottomMm - metrics.footerHeightMm - safeYMm;
    const mode = getSignatureMode(config.signature);
    const preset = getSignaturePreset(config.signature);

    if (safeHeightMm < signatureMetrics.heightMm) {
      warnings.push("Area tanda tangan terlalu sempit. Sistem memindahkan blok ke area aman paling bawah halaman.");
    }

    const effectiveSafeHeight = Math.max(signatureMetrics.heightMm, safeHeightMm);
    const safeZone = {
      ...signatureMetrics,
      safeXMm,
      safeYMm,
      safeWidthMm,
      safeHeightMm: effectiveSafeHeight,
    };

    const baseY = preset === "follow-content"
      ? safeYMm
      : safeYMm + Math.max(0, effectiveSafeHeight - signatureMetrics.heightMm);

    let xMm = safeXMm + safeWidthMm - signatureMetrics.widthMm;
    if (preset === "bottom-left") {
      xMm = safeXMm;
    } else if (preset === "bottom-center") {
      xMm = safeXMm + (safeWidthMm - signatureMetrics.widthMm) / 2;
    }

    let yMm = baseY;
    let isClamped = false;

    const manualX = typeof config.signature.manualXPercent === "number"
      ? safeXMm + (config.signature.manualXPercent / 100) * Math.max(1, safeWidthMm - signatureMetrics.widthMm)
      : null;
    const manualY = typeof config.signature.manualYPercent === "number"
      ? safeYMm + (config.signature.manualYPercent / 100) * Math.max(1, effectiveSafeHeight - signatureMetrics.heightMm)
      : null;

    if (mode === "fixed" && manualX !== null && manualY !== null) {
      xMm = manualX;
      yMm = manualY;
    } else if (mode === "flow") {
      yMm = safeYMm;
      if (preset === "bottom-center") {
        xMm = safeXMm + (safeWidthMm - signatureMetrics.widthMm) / 2;
      } else if (preset === "bottom-left") {
        xMm = safeXMm;
      } else {
        xMm = safeXMm + safeWidthMm - signatureMetrics.widthMm;
      }
    } else if (manualX !== null && manualY !== null) {
      xMm = manualX;
      yMm = manualY;
    }

    const gridSize = config.signature.snapToGrid ? Math.max(1, config.signature.gridSizeMm || 5) : 0;
    if (gridSize > 0) {
      xMm = roundToGrid(xMm - safeXMm, gridSize) + safeXMm;
      yMm = roundToGrid(yMm - safeYMm, gridSize) + safeYMm;
    }

    const clampedX = clamp(xMm, safeXMm, safeXMm + Math.max(0, safeWidthMm - signatureMetrics.widthMm));
    const clampedY = clamp(yMm, safeYMm, safeYMm + Math.max(0, effectiveSafeHeight - signatureMetrics.heightMm));
    if (clampedX !== xMm || clampedY !== yMm) {
      isClamped = true;
      warnings.push("Posisi tanda tangan disesuaikan otomatis agar tetap berada di area aman cetak.");
    }

    signaturePlacement = {
      pageIndex: lastPage.index,
      xMm: clampedX,
      yMm: clampedY,
      widthMm: signatureMetrics.widthMm,
      heightMm: signatureMetrics.heightMm,
      safeZone,
      mode,
      preset,
      isClamped,
    };
  }

  return {
    metrics,
    pageLabel: "A4 Landscape",
    pages: pages.map((page, index) => ({
      ...page,
      index,
      number: index + 1,
      isLastPage: index === pages.length - 1,
    })),
    columnWidthsMm: getColumnWidthsMm(config.columns),
    warnings,
    signaturePlacement,
  };
}

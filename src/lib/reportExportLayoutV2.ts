// TESTING
import { computeSignatureHeight, type SignatureData } from "./exportSignature";
import { pdfBodyRowHeightMm, pdfHeaderRowHeightMm } from "./exportEngine/sharedMetrics";
import type { ExportColumn, ExportConfig, HeaderGroup, ReportPaperSize } from "./reportExportLayout";

export type ReportColumnAlignment = "left" | "center" | "right";
export type ReportTableSizingMode = "autofit-window" | "autofit-content" | "fixed";

export interface ReportColumnStyleOverride {
  headerFontSize?: number;
  bodyFontSize?: number;
  headerAlignment?: ReportColumnAlignment;
  bodyAlignment?: ReportColumnAlignment;
  widthMm?: number;
  sizingMode?: "inherit" | ReportTableSizingMode;
}

export interface ReportTableSizingStyle {
  mode: ReportTableSizingMode;
  tableWidthPercent: number;
  headerRowHeightMm?: number;
  bodyRowHeightMm?: number;
}

export interface ReportDocumentStyle {
  titleFontSize: number;
  metaFontSize: number;
  tableHeaderFontSize: number;
  tableBodyFontSize: number;
  layoutPreset?: "standard" | "one-page" | "single-column-full" | "compact" | "large";
  experimentalColumnTypographyEnabled: boolean;
  experimentalColumnLayoutEnabled: boolean;
  tableSizing: ReportTableSizingStyle;
  columnFontOverrides: Record<string, ReportColumnStyleOverride>;
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
  movementBounds: SignatureBlockMetrics;
  mode: "adaptive" | "flow" | "fixed";
  preset: "follow-content" | "bottom-left" | "bottom-center" | "bottom-right";
  isClamped: boolean;
  isOutsideSafeZone: boolean;
}

export interface ReportLayoutPageV2 {
  index: number;
  number: number;
  pageType: "table" | "signature";
  segmentIndex: number;
  segmentNumber: number;
  totalSegments: number;
  tableStartY: number;
  rows: Record<string, string | number>[];
  columns: ExportColumn[];
  headerGroups: HeaderGroup[];
  columnWidthsMm: number[];
  bodyStartIndex: number;
  bodyEndIndex: number;
  isLastPage: boolean;
  isFirstPageOverall: boolean;
  isFirstPageInSegment: boolean;
  estimatedTableHeightMm: number;
  estimatedTableEndY: number;
}

export interface ReportExportLayoutPlanV2 {
  metrics: {
    pageWidthMm: number;
    pageHeightMm: number;
    marginLeftMm: number;
    marginRightMm: number;
    marginTopMm: number;
    marginBottomMm: number;
    footerHeightMm: number;
    firstPageTableStartY: number;
    nextPageTableStartY: number;
    signatureGapMm: number;
  };
  documentStyle: ReportDocumentStyle;
  pageLabel: string;
  pages: ReportLayoutPageV2[];
  columnWidthsMm: number[];
  warnings: string[];
  signaturePlacement: SignaturePlacement | null;
}

export interface ResolveSignaturePlacementOptions {
  pageIndex: number;
  signature: SignatureData;
  signatureMetrics: SignatureBlockMetrics;
  pageWidthMm: number;
  pageHeightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  footerHeightMm: number;
  safeZoneTopMm: number;
}

interface ReportLayoutMetrics {
  pageWidthMm: number;
  pageHeightMm: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  footerHeightMm: number;
  firstPageTableStartY: number;
  nextPageTableStartY: number;
  signatureGapMm: number;
  signatureOnlyTopMm: number;
}

const BASE_LAYOUT_METRICS = {
  marginLeftMm: 8,
  marginRightMm: 8,
  marginTopMm: 10,
  marginBottomMm: 10,
  footerHeightMm: 8,
  firstPageTableStartY: 30,
  nextPageTableStartY: 18,
  signatureGapMm: 5,
  signatureOnlyTopMm: 18,
} satisfies Omit<ReportLayoutMetrics, "pageWidthMm" | "pageHeightMm">;

const PAPER_PRESETS = {
  a4: { label: "A4 (210 x 297 mm)", landscape: { pageWidthMm: 297, pageHeightMm: 210 }, portrait: { pageWidthMm: 210, pageHeightMm: 297 } },
  f4: { label: "F4 (215.9 x 330.2 mm)", landscape: { pageWidthMm: 330.2, pageHeightMm: 215.9 }, portrait: { pageWidthMm: 215.9, pageHeightMm: 330.2 } },
} as const;

export interface ResolvedReportPaper {
  key: ReportPaperSize;
  label: string;
  pageWidthMm: number;
  pageHeightMm: number;
  pdfFormat: "a4" | [number, number];
}

function createLayoutMetrics(pageWidthMm: number, pageHeightMm: number): ReportLayoutMetrics {
  return {
    pageWidthMm,
    pageHeightMm,
    ...BASE_LAYOUT_METRICS,
  };
}

export function resolveReportPaperSize(
  paperSize: ReportPaperSize = "a4",
  options?: {
    orientation?: "landscape" | "portrait";
    requiredContentWidthMm?: number;
  },
): ResolvedReportPaper {
  const orientation = options?.orientation ?? "landscape";

  if (paperSize === "a4") {
    const preset = PAPER_PRESETS.a4[orientation];
    return { key: "a4", label: PAPER_PRESETS.a4.label, ...preset, pdfFormat: [preset.pageWidthMm, preset.pageHeightMm] };
  }

  if (paperSize === "f4") {
    const preset = PAPER_PRESETS.f4[orientation];
    return { key: "f4", label: PAPER_PRESETS.f4.label, ...preset, pdfFormat: [preset.pageWidthMm, preset.pageHeightMm] };
  }

  const base = PAPER_PRESETS.a4[orientation];
  const fallback = PAPER_PRESETS.f4[orientation];
  const targetWidth = clamp(
    Math.round(Math.max(base.pageWidthMm, options?.requiredContentWidthMm ?? base.pageWidthMm) * 10) / 10,
    base.pageWidthMm,
    orientation === "landscape" ? 420 : 297,
  );
  const pageHeightMm = orientation === "landscape"
    ? targetWidth > fallback.pageWidthMm
      ? 230
      : targetWidth > base.pageWidthMm
        ? fallback.pageHeightMm
        : base.pageHeightMm
    : targetWidth > base.pageWidthMm
      ? fallback.pageHeightMm
      : base.pageHeightMm;

  return {
    key: "auto",
    label: "Auto",
    pageWidthMm: targetWidth,
    pageHeightMm,
    pdfFormat: [targetWidth, pageHeightMm],
  };
}

const DEFAULT_DOCUMENT_STYLE: ReportDocumentStyle = {
  titleFontSize: 16,
  metaFontSize: 10,
  tableHeaderFontSize: 12,
  tableBodyFontSize: 11,
  layoutPreset: "standard",
  experimentalColumnTypographyEnabled: false,
  experimentalColumnLayoutEnabled: false,
  tableSizing: {
    mode: "autofit-window",
    tableWidthPercent: 100,
  },
  columnFontOverrides: {},
};

interface ColumnSegment {
  index: number;
  columns: ExportColumn[];
  columnIndexes: number[];
  columnWidthsMm: number[];
  headerGroups: HeaderGroup[];
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToGrid(value: number, gridSize: number) {
  if (gridSize <= 0) return value;
  return Math.round(value / gridSize) * gridSize;
}

export function resolveSignaturePlacementFromBounds({
  pageIndex,
  signature,
  signatureMetrics,
  pageWidthMm,
  pageHeightMm,
  marginLeftMm,
  marginRightMm,
  marginTopMm,
  marginBottomMm,
  footerHeightMm,
  safeZoneTopMm,
}: ResolveSignaturePlacementOptions): SignaturePlacement {
  const printableBottomMm = pageHeightMm - marginBottomMm - footerHeightMm;
  const movementBounds = {
    ...signatureMetrics,
    safeXMm: marginLeftMm,
    safeYMm: marginTopMm,
    safeWidthMm: pageWidthMm - marginLeftMm - marginRightMm,
    safeHeightMm: printableBottomMm - marginTopMm,
  };

  const safeXMm = marginLeftMm;
  const safeWidthMm = movementBounds.safeWidthMm;
  const normalizedSafeTopMm = clamp(safeZoneTopMm, movementBounds.safeYMm, printableBottomMm);
  const rawSafeHeightMm = printableBottomMm - normalizedSafeTopMm;
  const effectiveSafeHeight = Math.max(signatureMetrics.heightMm, rawSafeHeightMm);
  const safeZone = {
    ...signatureMetrics,
    safeXMm,
    safeYMm: normalizedSafeTopMm,
    safeWidthMm,
    safeHeightMm: effectiveSafeHeight,
  };

  const mode = signature?.placementMode || "adaptive";
  const preset = signature?.signaturePreset || "bottom-right";

  let xMm = safeXMm + safeWidthMm - signatureMetrics.widthMm;
  if (preset === "bottom-left") xMm = safeXMm;
  if (preset === "bottom-center") xMm = safeXMm + (safeWidthMm - signatureMetrics.widthMm) / 2;

  let yMm = preset === "follow-content"
    ? normalizedSafeTopMm
    : normalizedSafeTopMm + Math.max(0, effectiveSafeHeight - signatureMetrics.heightMm);

  const manualX = typeof signature.manualXPercent === "number"
    ? movementBounds.safeXMm + (signature.manualXPercent / 100) * Math.max(1, movementBounds.safeWidthMm - signatureMetrics.widthMm)
    : null;
  const manualY = typeof signature.manualYPercent === "number"
    ? movementBounds.safeYMm + (signature.manualYPercent / 100) * Math.max(1, movementBounds.safeHeightMm - signatureMetrics.heightMm)
    : null;

  if (mode === "fixed" && manualX !== null && manualY !== null) {
    xMm = manualX;
    yMm = manualY;
  } else if (mode === "flow") {
    yMm = normalizedSafeTopMm;
  }

  xMm += Number(signature.signatureOffsetX || 0);
  yMm += Number(signature.signatureOffsetY || 0);

  const gridSize = signature.snapToGrid ? Math.max(1, signature.gridSizeMm || 5) : 0;
  if (gridSize > 0) {
    xMm = roundToGrid(xMm - movementBounds.safeXMm, gridSize) + movementBounds.safeXMm;
    yMm = roundToGrid(yMm - movementBounds.safeYMm, gridSize) + movementBounds.safeYMm;
  }

  const clampedX = clamp(xMm, movementBounds.safeXMm, movementBounds.safeXMm + Math.max(0, movementBounds.safeWidthMm - signatureMetrics.widthMm));
  const clampedY = clamp(yMm, movementBounds.safeYMm, movementBounds.safeYMm + Math.max(0, movementBounds.safeHeightMm - signatureMetrics.heightMm));
  const isClamped = clampedX !== xMm || clampedY !== yMm;
  const isOutsideSafeZone =
    clampedX < safeXMm
    || clampedX + signatureMetrics.widthMm > safeXMm + safeWidthMm
    || clampedY < normalizedSafeTopMm
    || clampedY + signatureMetrics.heightMm > normalizedSafeTopMm + effectiveSafeHeight;

  return {
    pageIndex,
    xMm: clampedX,
    yMm: clampedY,
    widthMm: signatureMetrics.widthMm,
    heightMm: signatureMetrics.heightMm,
    safeZone,
    movementBounds,
    mode,
    preset,
    isClamped,
    isOutsideSafeZone,
  };
}

export function createDefaultReportDocumentStyle() {
  return {
    ...DEFAULT_DOCUMENT_STYLE,
    tableSizing: { ...DEFAULT_DOCUMENT_STYLE.tableSizing },
    columnFontOverrides: {},
  };
}

export function resolveDocumentStyle(style?: Partial<ReportDocumentStyle> | ExportConfig["documentStyle"]): ReportDocumentStyle {
  return {
    titleFontSize: clamp(style?.titleFontSize ?? DEFAULT_DOCUMENT_STYLE.titleFontSize, 1, 40),
    metaFontSize: clamp(style?.metaFontSize ?? DEFAULT_DOCUMENT_STYLE.metaFontSize, 1, 40),
    tableHeaderFontSize: clamp(style?.tableHeaderFontSize ?? DEFAULT_DOCUMENT_STYLE.tableHeaderFontSize, 1, 40),
    tableBodyFontSize: clamp(style?.tableBodyFontSize ?? DEFAULT_DOCUMENT_STYLE.tableBodyFontSize, 1, 40),
    layoutPreset: style?.layoutPreset ?? DEFAULT_DOCUMENT_STYLE.layoutPreset,
    experimentalColumnTypographyEnabled: style?.experimentalColumnTypographyEnabled ?? DEFAULT_DOCUMENT_STYLE.experimentalColumnTypographyEnabled,
    experimentalColumnLayoutEnabled: style?.experimentalColumnLayoutEnabled ?? DEFAULT_DOCUMENT_STYLE.experimentalColumnLayoutEnabled,
    tableSizing: {
      mode: style?.tableSizing?.mode ?? DEFAULT_DOCUMENT_STYLE.tableSizing.mode,
      tableWidthPercent: clamp(style?.tableSizing?.tableWidthPercent ?? DEFAULT_DOCUMENT_STYLE.tableSizing.tableWidthPercent, 40, 160),
      headerRowHeightMm: typeof style?.tableSizing?.headerRowHeightMm === "number"
        ? clamp(style.tableSizing.headerRowHeightMm, 3, 30)
        : undefined,
      bodyRowHeightMm: typeof style?.tableSizing?.bodyRowHeightMm === "number"
        ? clamp(style.tableSizing.bodyRowHeightMm, 3, 30)
        : undefined,
    },
    columnFontOverrides: Object.fromEntries(
      Object.entries(style?.columnFontOverrides ?? {}).map(([key, value]) => [
        key,
        {
          headerFontSize: typeof value?.headerFontSize === "number" ? clamp(value.headerFontSize, 1, 40) : undefined,
          bodyFontSize: typeof value?.bodyFontSize === "number" ? clamp(value.bodyFontSize, 1, 40) : undefined,
          headerAlignment: value?.headerAlignment === "left" || value?.headerAlignment === "right" ? value.headerAlignment : value?.headerAlignment === "center" ? "center" : undefined,
          bodyAlignment: value?.bodyAlignment === "left" || value?.bodyAlignment === "right" ? value.bodyAlignment : value?.bodyAlignment === "center" ? "center" : undefined,
          widthMm: typeof value?.widthMm === "number" ? clamp(value.widthMm, 4, 120) : undefined,
          sizingMode: value?.sizingMode === "autofit-content" || value?.sizingMode === "autofit-window" || value?.sizingMode === "fixed"
            ? value.sizingMode
            : "inherit",
        },
      ]),
    ),
  };
}

export function getColumnTypography(style: ReportDocumentStyle, columnKey: string) {
  const override = style.experimentalColumnTypographyEnabled ? style.columnFontOverrides[columnKey] : undefined;
  return {
    headerFontSize: clamp(override?.headerFontSize ?? style.tableHeaderFontSize, 1, 40),
    bodyFontSize: clamp(override?.bodyFontSize ?? style.tableBodyFontSize, 1, 40),
  };
}

export function getDefaultColumnAlignment(columnType: ExportColumn["type"]) {
  if (columnType === "name" || columnType === "nisn" || columnType === "status") {
    return "left" as const;
  }
  return "center" as const;
}

export function getColumnHeaderAlignment(style: ReportDocumentStyle, column: ExportColumn) {
  const override = (style.experimentalColumnTypographyEnabled || style.experimentalColumnLayoutEnabled)
    ? style.columnFontOverrides[column.key]
    : undefined;
  return override?.headerAlignment ?? "center";
}

export function getColumnBodyAlignment(style: ReportDocumentStyle, column: ExportColumn) {
  const override = (style.experimentalColumnTypographyEnabled || style.experimentalColumnLayoutEnabled)
    ? style.columnFontOverrides[column.key]
    : undefined;
  return override?.bodyAlignment ?? getDefaultColumnAlignment(column.type);
}

export function getColumnAlignment(style: ReportDocumentStyle, column: ExportColumn) {
  return getColumnBodyAlignment(style, column);
}

export function getNaturalColumnWidthMmV2(column: ExportColumn, style?: Partial<ReportDocumentStyle>) {
  const resolved = resolveDocumentStyle(style);
  const typography = getColumnTypography(resolved, column.key);
  const baseFontSize = Math.max(typography.headerFontSize, typography.bodyFontSize);
  const scaleFactor = baseFontSize / 11;
  const longestWord = (column.label || "").split(/\s+/).reduce((max, w) => Math.max(max, w.length), 0);
  const headerMinWidth = Math.max(8, longestWord * baseFontSize * 0.32);

  let baseWidth: number;
  switch (column.type) {
    case "index":
      baseWidth = 10 * scaleFactor;
      break;
    case "name":
      baseWidth = Math.max(25, 38 * scaleFactor);
      break;
    case "nisn":
      baseWidth = 22 * scaleFactor;
      break;
    case "status":
      baseWidth = 22 * scaleFactor;
      break;
    case "rapor":
    case "avgRapor":
    case "grandAvg":
    case "chapterAvg":
      baseWidth = 20 * scaleFactor;
      break;
    case "sts":
    case "sas":
      baseWidth = 16 * scaleFactor;
      break;
    default:
      baseWidth = 15 * scaleFactor;
      break;
  }

  return Math.max(baseWidth, headerMinWidth);
}

export function getColumnWidthMmV2(column: ExportColumn, style?: Partial<ReportDocumentStyle>) {
  const resolved = resolveDocumentStyle(style);
  const override = resolved.columnFontOverrides[column.key];
  const naturalWidth = getNaturalColumnWidthMmV2(column, resolved);
  const scaleMultiplier = clamp((resolved.tableSizing.tableWidthPercent ?? 100) / 100, 0.4, 1.6);
  if ((resolved.experimentalColumnLayoutEnabled || resolved.experimentalColumnTypographyEnabled) && typeof override?.widthMm === "number") {
    return clamp(override.widthMm, 4, 120);
  }
  if (override?.sizingMode === "autofit-content") {
    return naturalWidth;
  }
  if (override?.sizingMode === "autofit-window") {
    return naturalWidth * scaleMultiplier;
  }
  return naturalWidth * scaleMultiplier;
}

export function getColumnWidthsMmV2(columns: ExportColumn[], style?: Partial<ReportDocumentStyle>) {
  return columns.map((column) => getColumnWidthMmV2(column, style));
}

function getHeaderHeightMm(style: ReportDocumentStyle, groupCount: number) {
  const rowHeight = pdfHeaderRowHeightMm(style.tableHeaderFontSize, style.tableSizing.headerRowHeightMm);
  return rowHeight * (groupCount > 1 ? 2 : 1);
}

function getBodyHeightMm(style: ReportDocumentStyle) {
  return pdfBodyRowHeightMm(style.tableBodyFontSize, style.tableSizing.bodyRowHeightMm);
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

function expandGroupMeta(columns: ExportColumn[], headerGroups: HeaderGroup[]) {
  const expanded: Array<HeaderGroup | null> = new Array(columns.length).fill(null);
  let cursor = 0;
  headerGroups.forEach((group) => {
    for (let i = 0; i < group.colSpan && cursor + i < columns.length; i += 1) {
      expanded[cursor + i] = group;
    }
    cursor += group.colSpan;
  });
  return expanded;
}

function buildSegmentHeaderGroups(columnIndexes: number[], expanded: Array<HeaderGroup | null>) {
  const groups: HeaderGroup[] = [];
  columnIndexes.forEach((columnIndex) => {
    const meta = expanded[columnIndex];
    const last = groups[groups.length - 1];
    if (
      last &&
      last.label === (meta?.label || "") &&
      last.semester === meta?.semester &&
      last.isChapter === meta?.isChapter
    ) {
      last.colSpan += 1;
      return;
    }
    groups.push({
      label: meta?.label || "",
      colSpan: 1,
      bgClass: meta?.bgClass || "",
      semester: meta?.semester,
      isChapter: meta?.isChapter,
    });
  });
  return groups;
}

function buildSegments(config: ExportConfig, style: ReportDocumentStyle, metrics: ReportLayoutMetrics) {
  const allWidths = getColumnWidthsMmV2(config.columns, style);
  const expanded = expandGroupMeta(config.columns, config.headerGroups);
  const fixedIndexes = config.columns
    .map((column, index) => ({ column, index }))
    .filter(({ column }) => column.type === "index" || column.type === "name" || column.type === "nisn")
    .map(({ index }) => index);
  const dynamicIndexes = config.columns.map((_, index) => index).filter((index) => !fixedIndexes.includes(index));
  const fixedWidth = fixedIndexes.reduce((sum, index) => sum + allWidths[index], 0);
  const usableWidth = metrics.pageWidthMm - metrics.marginLeftMm - metrics.marginRightMm;

  const segments: ColumnSegment[] = [];
  let currentIndexes = [...fixedIndexes];
  let currentWidth = fixedWidth;

  dynamicIndexes.forEach((index) => {
    const width = allWidths[index];
    if (currentIndexes.length > fixedIndexes.length && currentWidth + width > usableWidth) {
      segments.push({
        index: segments.length,
        columns: currentIndexes.map((columnIndex) => config.columns[columnIndex]),
        columnIndexes: [...currentIndexes],
        columnWidthsMm: currentIndexes.map((columnIndex) => allWidths[columnIndex]),
        headerGroups: buildSegmentHeaderGroups(currentIndexes, expanded),
      });
      currentIndexes = [...fixedIndexes];
      currentWidth = fixedWidth;
    }
    currentIndexes.push(index);
    currentWidth += width;
  });

  if (currentIndexes.length > 0 && (currentIndexes.length > fixedIndexes.length || segments.length === 0)) {
    segments.push({
      index: segments.length,
      columns: currentIndexes.map((columnIndex) => config.columns[columnIndex]),
      columnIndexes: [...currentIndexes],
      columnWidthsMm: currentIndexes.map((columnIndex) => allWidths[columnIndex]),
      headerGroups: buildSegmentHeaderGroups(currentIndexes, expanded),
    });
  }

  segments.forEach((segment) => {
    const totalWidth = segment.columnWidthsMm.reduce((s, w) => s + w, 0);
    const targetWidth = usableWidth * clamp((style.tableSizing.tableWidthPercent ?? 100) / 100, 0.4, 1.6);
    if (style.tableSizing.mode === "autofit-content") {
      return;
    }
    if (totalWidth > 0 && totalWidth !== targetWidth) {
      const scale = (style.tableSizing.mode === "fixed" ? targetWidth : usableWidth) / totalWidth;
      segment.columnWidthsMm = segment.columnWidthsMm.map((w) => w * scale);
    }
  });

  return { segments, allWidths };
}

function getCapacity(metrics: ReportLayoutMetrics, tableStartY: number, groupCount: number, style: ReportDocumentStyle, reserveSignature: number) {
  const usableHeight = metrics.pageHeightMm
    - metrics.marginBottomMm
    - metrics.footerHeightMm
    - tableStartY
    - getHeaderHeightMm(style, groupCount)
    - reserveSignature;
  return Math.max(1, Math.floor(usableHeight / getBodyHeightMm(style)));
}
/**
 * Iteratively shrink font sizes until all data rows + signature fit on a single page.
 * Returns the adjusted ReportDocumentStyle.
 */
function autoFitOnePageStyle(config: ExportConfig, baseStyle: ReportDocumentStyle): ReportDocumentStyle {
  const style = resolveDocumentStyle(baseStyle);
  const signatureMetrics = config.includeSignature ? estimateSignatureBlockMetrics(config.signature) : null;
  const initialWidths = getColumnWidthsMmV2(config.columns, style);
  const paper = resolveReportPaperSize(config.paperSize, {
    orientation: "landscape",
    requiredContentWidthMm: initialWidths.reduce((sum, width) => sum + width, 0) + BASE_LAYOUT_METRICS.marginLeftMm + BASE_LAYOUT_METRICS.marginRightMm,
  });
  const metrics = createLayoutMetrics(paper.pageWidthMm, paper.pageHeightMm);
  const signatureReserve = signatureMetrics ? signatureMetrics.heightMm + metrics.signatureGapMm : 0;
  const rowCount = config.data.length;
  let bestTableOnlyCandidate: ReportDocumentStyle | null = null;

  for (let bodyPt = style.tableBodyFontSize; bodyPt >= 1; bodyPt -= 0.25) {
    for (let headerPt = Math.max(bodyPt, style.tableHeaderFontSize); headerPt >= Math.max(1, bodyPt); headerPt -= 0.25) {
      const candidate = resolveDocumentStyle({
        titleFontSize: Math.max(1, style.titleFontSize - (style.tableBodyFontSize - bodyPt) * 0.5),
        metaFontSize: Math.max(1, style.metaFontSize - (style.tableBodyFontSize - bodyPt) * 0.35),
        tableHeaderFontSize: headerPt,
        tableBodyFontSize: bodyPt,
        experimentalColumnTypographyEnabled: style.experimentalColumnTypographyEnabled,
        experimentalColumnLayoutEnabled: style.experimentalColumnLayoutEnabled,
        tableSizing: { ...style.tableSizing },
        columnFontOverrides: { ...style.columnFontOverrides },
      });
      const { segments } = buildSegments(config, candidate, metrics);
      if (segments.length !== 1) {
        continue;
      }
      const groupCount = segments[0]?.headerGroups.length || 1;
      const capacityWithSignature = getCapacity(metrics, metrics.firstPageTableStartY, groupCount, candidate, signatureReserve);
      if (capacityWithSignature >= rowCount) {
        return candidate;
      }
      const capacityWithoutSignature = getCapacity(metrics, metrics.firstPageTableStartY, groupCount, candidate, 0);
      if (!bestTableOnlyCandidate && capacityWithoutSignature >= rowCount) {
        bestTableOnlyCandidate = candidate;
      }
    }
  }

  return bestTableOnlyCandidate ?? style;
}

function createSignatureOnlyPage(metrics: ReportLayoutMetrics, previousPage: ReportLayoutPageV2 | undefined): ReportLayoutPageV2 {
  return {
    index: previousPage ? previousPage.index + 1 : 0,
    number: 0,
    pageType: "signature",
    segmentIndex: previousPage?.segmentIndex ?? 0,
    segmentNumber: previousPage?.segmentNumber ?? 1,
    totalSegments: previousPage?.totalSegments ?? 1,
    tableStartY: metrics.signatureOnlyTopMm,
    rows: [],
    columns: [],
    headerGroups: [],
    columnWidthsMm: [],
    bodyStartIndex: previousPage ? previousPage.bodyEndIndex + 1 : 0,
    bodyEndIndex: previousPage?.bodyEndIndex ?? -1,
    isLastPage: false,
    isFirstPageOverall: false,
    isFirstPageInSegment: false,
    estimatedTableHeightMm: 0,
    estimatedTableEndY: metrics.signatureOnlyTopMm,
  };
}

export function buildReportLayoutPlanV2(config: ExportConfig): ReportExportLayoutPlanV2 {
  let documentStyle = resolveDocumentStyle(config.documentStyle);
  
  // Auto-fit one page: iteratively shrink font until all rows + signature fit on 1 page
  if (config.autoFitOnePage && config.data.length > 0) {
    documentStyle = autoFitOnePageStyle(config, documentStyle);
  }
  
  const initialWidths = getColumnWidthsMmV2(config.columns, documentStyle);
  const paper = resolveReportPaperSize(config.paperSize, {
    orientation: "landscape",
    requiredContentWidthMm: initialWidths.reduce((sum, width) => sum + width, 0) + BASE_LAYOUT_METRICS.marginLeftMm + BASE_LAYOUT_METRICS.marginRightMm,
  });
  const metrics = createLayoutMetrics(paper.pageWidthMm, paper.pageHeightMm);
  const { segments, allWidths } = buildSegments(config, documentStyle, metrics);
  const signatureMetrics = config.includeSignature ? estimateSignatureBlockMetrics(config.signature) : null;
  const signatureReserve = signatureMetrics ? signatureMetrics.heightMm + metrics.signatureGapMm : 0;
  const warnings: string[] = [];
  const pages: ReportLayoutPageV2[] = [];

  if (segments.length > 1) {
    warnings.push(`Data tugas sangat banyak, jadi tabel dibagi menjadi ${segments.length} bagian kolom agar font tetap terbaca dan tidak terpotong.`);
    if (documentStyle.tableBodyFontSize >= 11) {
      warnings.push("Ukuran font tetap dipertahankan di kisaran nyaman baca, sehingga sistem memilih memecah kolom ke beberapa bagian halaman.");
    }
  }

  segments.forEach((segment, segmentIndex) => {
    const firstStartY = pages.length === 0 ? metrics.firstPageTableStartY : metrics.nextPageTableStartY;
    const firstCapacityWithSignature = getCapacity(metrics, firstStartY, segment.headerGroups.length, documentStyle, segmentIndex === segments.length - 1 ? signatureReserve : 0);
    const firstCapacity = getCapacity(metrics, firstStartY, segment.headerGroups.length, documentStyle, 0);
    const nextCapacity = getCapacity(metrics, metrics.nextPageTableStartY, segment.headerGroups.length, documentStyle, 0);
    const lastCapacity = getCapacity(metrics, metrics.nextPageTableStartY, segment.headerGroups.length, documentStyle, segmentIndex === segments.length - 1 ? signatureReserve : 0);
    const headerHeight = getHeaderHeightMm(documentStyle, segment.headerGroups.length);
    const bodyHeight = getBodyHeightMm(documentStyle);
    const rows = [...config.data];

    if (rows.length <= firstCapacityWithSignature) {
      pages.push({
        index: pages.length,
        number: 0,
        pageType: "table",
        segmentIndex,
        segmentNumber: segmentIndex + 1,
        totalSegments: segments.length,
        tableStartY: firstStartY,
        rows,
        columns: segment.columns,
        headerGroups: segment.headerGroups,
        columnWidthsMm: segment.columnWidthsMm,
        bodyStartIndex: 0,
        bodyEndIndex: Math.max(0, rows.length - 1),
        isLastPage: false,
        isFirstPageOverall: pages.length === 0,
        isFirstPageInSegment: true,
        estimatedTableHeightMm: headerHeight + rows.length * bodyHeight,
        estimatedTableEndY: firstStartY + headerHeight + rows.length * bodyHeight,
      });
      return;
    }

    let cursor = 0;
    const firstRows = rows.slice(0, firstCapacity);
    pages.push({
      index: pages.length,
      number: 0,
      pageType: "table",
      segmentIndex,
      segmentNumber: segmentIndex + 1,
      totalSegments: segments.length,
      tableStartY: firstStartY,
      rows: firstRows,
      columns: segment.columns,
      headerGroups: segment.headerGroups,
      columnWidthsMm: segment.columnWidthsMm,
      bodyStartIndex: 0,
      bodyEndIndex: Math.max(0, firstRows.length - 1),
      isLastPage: false,
      isFirstPageOverall: pages.length === 0,
      isFirstPageInSegment: true,
      estimatedTableHeightMm: headerHeight + firstRows.length * bodyHeight,
      estimatedTableEndY: firstStartY + headerHeight + firstRows.length * bodyHeight,
    });
    cursor += firstRows.length;

    while (rows.length - cursor > lastCapacity) {
      const pageRows = rows.slice(cursor, cursor + nextCapacity);
      pages.push({
        index: pages.length,
        number: 0,
        pageType: "table",
        segmentIndex,
        segmentNumber: segmentIndex + 1,
        totalSegments: segments.length,
        tableStartY: metrics.nextPageTableStartY,
        rows: pageRows,
        columns: segment.columns,
        headerGroups: segment.headerGroups,
        columnWidthsMm: segment.columnWidthsMm,
        bodyStartIndex: cursor,
        bodyEndIndex: cursor + pageRows.length - 1,
        isLastPage: false,
        isFirstPageOverall: false,
        isFirstPageInSegment: false,
        estimatedTableHeightMm: headerHeight + pageRows.length * bodyHeight,
        estimatedTableEndY: metrics.nextPageTableStartY + headerHeight + pageRows.length * bodyHeight,
      });
      cursor += pageRows.length;
    }

    const lastRows = rows.slice(cursor);
    if (lastRows.length > 0) {
      pages.push({
        index: pages.length,
        number: 0,
        pageType: "table",
        segmentIndex,
        segmentNumber: segmentIndex + 1,
        totalSegments: segments.length,
        tableStartY: metrics.nextPageTableStartY,
        rows: lastRows,
        columns: segment.columns,
        headerGroups: segment.headerGroups,
        columnWidthsMm: segment.columnWidthsMm,
        bodyStartIndex: cursor,
        bodyEndIndex: cursor + lastRows.length - 1,
        isLastPage: false,
        isFirstPageOverall: false,
        isFirstPageInSegment: false,
        estimatedTableHeightMm: headerHeight + lastRows.length * bodyHeight,
        estimatedTableEndY: metrics.nextPageTableStartY + headerHeight + lastRows.length * bodyHeight,
      });
    }
  });

  let signaturePlacement: SignaturePlacement | null = null;
  if (config.includeSignature && config.signature && signatureMetrics && pages.length > 0) {
    let lastPage = pages[pages.length - 1];
    let safeYMm = lastPage.pageType === "signature"
      ? metrics.signatureOnlyTopMm
      : lastPage.estimatedTableEndY + metrics.signatureGapMm;
    let safeHeightMm = metrics.pageHeightMm - metrics.marginBottomMm - metrics.footerHeightMm - safeYMm;

    if (safeHeightMm < signatureMetrics.heightMm) {
      if (lastPage.pageType === "table") {
        const signatureOnlyPage = createSignatureOnlyPage(metrics, lastPage);
        pages.push(signatureOnlyPage);
        lastPage = signatureOnlyPage;
        safeYMm = metrics.signatureOnlyTopMm;
        safeHeightMm = metrics.pageHeightMm - metrics.marginBottomMm - metrics.footerHeightMm - safeYMm;
        warnings.push("Tabel sudah selesai di halaman sebelumnya, jadi tanda tangan dipindahkan ke halaman akhir tanpa header tabel kosong.");
      } else {
        warnings.push("Area tanda tangan sempit, jadi blok dirapatkan ke area aman bawah agar tetap utuh.");
      }
    }

    signaturePlacement = resolveSignaturePlacementFromBounds({
      pageIndex: pages.length - 1,
      signature: config.signature,
      signatureMetrics,
      pageWidthMm: metrics.pageWidthMm,
      pageHeightMm: metrics.pageHeightMm,
      marginLeftMm: metrics.marginLeftMm,
      marginRightMm: metrics.marginRightMm,
      marginTopMm: metrics.marginTopMm,
      marginBottomMm: metrics.marginBottomMm,
      footerHeightMm: metrics.footerHeightMm,
      safeZoneTopMm: safeYMm,
    });

    if (signaturePlacement.isClamped) {
      warnings.push("Posisi tanda tangan disesuaikan agar tetap berada di area halaman yang bisa dicetak.");
    }
    if (signaturePlacement.isOutsideSafeZone) {
      warnings.push("Tanda tangan berada di luar safe zone. Posisi tetap diizinkan, tetapi area ini tidak lagi dijamin aman dari benturan layout.");
    }
  }

  const widthWarnings = config.columns
    .map((column) => {
      const currentWidth = getColumnWidthMmV2(column, documentStyle);
      const naturalWidth = getNaturalColumnWidthMmV2(column, documentStyle);
      if (currentWidth < naturalWidth * 0.72) {
        return `Kolom ${column.label} dipersempit cukup jauh. Beberapa data mungkin akan terpotong atau membungkus lebih rapat.`;
      }
      return null;
    })
    .filter((warning): warning is string => !!warning);
  warnings.push(...widthWarnings.slice(0, 3));

  const defaultHeaderHeight = clamp(5.4 + (documentStyle.tableHeaderFontSize - 10) * 0.7, 5.4, 12);
  const defaultBodyHeight = clamp(5.2 + (documentStyle.tableBodyFontSize - 10) * 0.9, 5.2, 9.5);
  if (typeof documentStyle.tableSizing.headerRowHeightMm === "number" && documentStyle.tableSizing.headerRowHeightMm < defaultHeaderHeight * 0.9) {
    warnings.push("Tinggi baris header cukup rapat. Header yang panjang bisa membungkus lebih padat.");
  }
  if (typeof documentStyle.tableSizing.bodyRowHeightMm === "number" && documentStyle.tableSizing.bodyRowHeightMm < defaultBodyHeight * 0.9) {
    warnings.push("Tinggi baris data cukup rapat. Beberapa nilai atau nama mungkin terlihat lebih padat.");
  }

  pages.forEach((page, index) => {
    page.index = index;
    page.number = index + 1;
    page.isLastPage = index === pages.length - 1;
  });

  return {
    metrics,
    documentStyle,
    pageLabel: `${paper.label} Landscape${segments.length > 1 ? ` • ${segments.length} bagian kolom` : ""}`,
    pages,
    columnWidthsMm: allWidths,
    warnings,
    signaturePlacement,
  };
}

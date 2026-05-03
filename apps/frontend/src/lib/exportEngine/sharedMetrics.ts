/**
 * Shared metrics between PDF engine and Live Preview.
 * ALL values are in mm — the single source of truth.
 * Preview converts mm→px using PX_PER_MM.
 * PDF engine uses mm directly.
 *
 * This file ensures ZERO discrepancy between preview and export.
 */

/** Conversion factor: CSS pixels per mm for preview rendering */
export const PX_PER_MM = 3.78; // 96dpi / 25.4mm ≈ 3.7795 → rounded for clean rendering

/**
 * jsPDF font sizes are in pt. The PDF engine historically subtracts 2pt
 * from the document style font sizes when rendering tables.
 * Preview must apply the SAME reduction to match.
 */
export const PDF_FONT_SIZE_OFFSET = 2;
export const PDF_MIN_FONT_SIZE = 5;

/** Resolve the effective font size used in PDF export */
export function pdfEffectiveFontSize(styleFontSize: number): number {
  return Math.max(PDF_MIN_FONT_SIZE, styleFontSize - PDF_FONT_SIZE_OFFSET);
}

// ─── Table cell padding (mm) ───────────────────────────────────────────────

export const CELL_PADDING = {
  /** Default body cell padding (uniform, mm) */
  bodyDefault: 1.2,
  /** Name column body cell padding (mm) */
  bodyName: { top: 1, right: 2, bottom: 1, left: 2 },
  /** Header cell padding (mm) */
  header: { top: 1.5, right: 1, bottom: 1.5, left: 1 },
  /** Level-1 header group cell padding (mm) */
  headerGroup: { top: 1, right: 1, bottom: 1, left: 1 },
  /** Fixed column (No/Nama/NISN) header padding (mm) */
  headerFixed: { top: 1.5, right: 1.5, bottom: 1.5, left: 1.5 },
} as const;

// ─── Table row heights (mm) ────────────────────────────────────────────────

/** Calculate PDF body row min-height in mm */
export function pdfBodyRowHeightMm(bodyFontSize: number, overrideMm?: number): number {
  if (typeof overrideMm === "number") return overrideMm;
  return 5 + (pdfEffectiveFontSize(bodyFontSize) - (10 - PDF_FONT_SIZE_OFFSET)) * 0.8;
}

/** Calculate PDF header row min-height in mm */
export function pdfHeaderRowHeightMm(headerFontSize: number, overrideMm?: number): number {
  if (typeof overrideMm === "number") return overrideMm;
  return 5.5 + (pdfEffectiveFontSize(headerFontSize) - (10 - PDF_FONT_SIZE_OFFSET)) * 0.7;
}

// ─── Table lines ───────────────────────────────────────────────────────────

export const TABLE_LINE = {
  color: [200, 200, 200] as [number, number, number],
  width: 0.1,
} as const;

export const TABLE_COLORS = {
  alternateRow: [250, 250, 250] as [number, number, number],
  headerSemester1: [37, 99, 235] as [number, number, number],
  headerSemester2: [22, 163, 74] as [number, number, number],
  headerSummary: [124, 58, 237] as [number, number, number],
  headerFinal: [147, 51, 234] as [number, number, number],
  headerChapter: [14, 165, 233] as [number, number, number],
  headerDefault: [59, 130, 246] as [number, number, number],
  text: [255, 255, 255] as [number, number, number],
} as const;

// ─── Footer ────────────────────────────────────────────────────────────────

export const FOOTER = {
  /** Footer font size in pt */
  fontSize: 7,
  /** Footer Y offset from bottom of page (mm) */
  yFromBottom: 8,
  /** Footer left text */
  leftText: "SIPENA - Sistem Penilaian",
  /** Left X position (mm) */
  leftX: 10,
} as const;

// ─── Conversion helpers ────────────────────────────────────────────────────

/** Convert mm to preview px */
export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

/** Convert a uniform padding in mm to CSS padding string in px */
export function paddingMmToCss(padding: number | { top: number; right: number; bottom: number; left: number }): string {
  if (typeof padding === "number") {
    const px = mmToPx(padding);
    return `${px}px`;
  }
  return `${mmToPx(padding.top)}px ${mmToPx(padding.right)}px ${mmToPx(padding.bottom)}px ${mmToPx(padding.left)}px`;
}

/** Convert RGB array to CSS color */
export function rgbToCss(rgb: readonly [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

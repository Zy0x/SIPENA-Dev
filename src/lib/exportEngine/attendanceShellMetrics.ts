/**
 * Single source of truth for the Attendance export shell measurements.
 * Both the planner (attendancePrintLayout.ts) and the PDF renderer
 * (attendancePdfExport.ts) MUST import from this file so margins,
 * banner heights, and row reservations stay in lock-step. Any change
 * here propagates to BOTH preview and exported PDF without drift.
 *
 * All values are in millimetres (mm).
 */

export const ATTENDANCE_SHELL_MM = {
  /** Unified top banner height (title + class pill + meta strip). */
  topBanner: 18,
  /** Legacy meta-bar slot (kept at 0 — meta is now inside topBanner). */
  metaBar: 0,
  /** Vertical padding between banner and table content. */
  contentPaddingY: 4,
  /** Footer bar height reserved at bottom of every page. */
  footerBar: 7,
  /** Minimum vertical clearance above the footer line for summary cards. */
  footerClearance: 2.4,
  /** "Lanjutan halaman sebelumnya" continuation note height. */
  continuationNote: 6,
  /** Gap between table and summary block. */
  summaryGap: 3,
  /** Legend strip row height. */
  legendRow: 7,
  /** Header row inside an info block (Keterangan / Catatan). */
  infoBlockHeader: 5,
  /** Single text line height inside an info block. */
  infoLine: 4,
  /** Reserved height for the signature block. */
  signatureBlock: 34,
} as const;

/** Page margins (mm) used by the planner & PDF engine. */
export const ATTENDANCE_MARGIN_MM = {
  top: 7,
  right: 7,
  bottom: 7,
  left: 7,
} as const;

/** Tolerance values used by the layout planner. */
export const ATTENDANCE_LAYOUT_TOLERANCE_MM = {
  /** How much slack we permit before a row is considered "too tall". */
  tableSlack: 0.6,
  /** Buffer below the last row so autotable never spills to a new blank page. */
  tableBottomSafety: 6.5,
  /** Per-row autotable border + min-height rounding overhead. */
  autotableRowOverhead: 0.45,
  /** Minimum signature zone height that must remain on the last data page
   *  before the planner moves the signature to its own dedicated page. */
  minimumViableSignatureZone: 8,
} as const;

export type AttendanceShellKey = keyof typeof ATTENDANCE_SHELL_MM;

# DISCOVERY EXPORT COUPLING MAP: Attendance V1

## Objective
Identify exactly how Attendance V1 feeds the existing studio/export pipeline and where a future canonical seam can connect without changing stable export behavior.

## Evidence from actual repo files
- `docs/plans/attendance/export/STUDIO_EXPORT_COMPATIBILITY.md:1-17`: export is legacy stable, must not change PDF/Excel format, and should accept canonical attendance model rather than V1/V2 data directly.
- `apps/frontend/src/pages/Attendance.tsx:695-809`: `attendancePreviewData` is built in the page from filtered murid, `monthDays`, statuses, holidays, events, notes, and jumlah config.
- `apps/frontend/src/pages/Attendance.tsx:811-869`: `attendancePrintDataset` and `attendancePreviewStudioData` are built from `attendancePreviewData`, structured holiday items, and day events.
- `apps/frontend/src/pages/Attendance.tsx:1024-1055`: static export markup is generated with `AttendanceExportPreviewV2`.
- `apps/frontend/src/pages/Attendance.tsx:3207-3305`: `UnifiedExportStudio` receives format options, selected columns, style/signature state, export callbacks, and a renderPreview function returning `AttendanceExportPreviewV2`.
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx:1-10`: preview is intentionally the same as exported PDF/PNG.
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx:103-127`: preview data is normalized to `AttendancePrintDataset`.
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx:153-188`: preview builds `AttendancePrintLayoutPlan` and `buildAttendancePdfDocument`.
- `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx:275-287`: preview delegates rendering to `AttendancePdfCanvasPreview`.
- `apps/frontend/src/lib/attendancePrintLayout.ts:1-9`: layout is the single source of truth for column widths, font sizes, row heights, page splits, summary placement, and holiday grouping.
- `apps/frontend/src/lib/attendancePrintLayout.ts:299-308`: shell metrics are shared with the PDF renderer.
- `apps/frontend/src/lib/attendancePrintLayout.ts:908-960`: layout planner resolves paper size, visible day/rekap columns, and page dimensions.
- `apps/frontend/src/components/export/AttendancePrintDocument.tsx:1-12`: renderer does not recompute layout and day columns are dynamic.
- `apps/frontend/src/lib/attendancePdfExport.ts:699-735`: PDF export consumes `AttendancePrintDataset` and `AttendancePrintLayoutPlan`.

## Findings
- Export coupling starts in `Attendance.tsx`, not in `useAttendance.ts`: the page transforms V1 hook/UI data into export-friendly preview data.
- `AttendanceExportPreviewV2` is a compatibility shell. It is not the business logic owner; it converts preview props to `AttendancePrintDataset` and uses `attendancePrintLayout`.
- `attendancePrintLayout.ts` is the high-risk core for visual parity. It owns row splitting, paper sizing, columns, font sizing, summary/signature placement, and holiday grouping.
- `AttendancePdfCanvasPreview` and `attendancePdfExport.ts` are downstream renderers and must receive the same plan/dataset for parity.
- Excel export still appears to be page-owned legacy code in `Attendance.tsx`; PDF/PNG use the newer preview/layout path.
- Export must not directly know whether records came from V1 or V2. The safe contract is a canonical attendance export dataset that can be converted to `AttendancePrintDataset`.

## Risks
- `BLOCKER`: touching export renderer or print layout during runtime discovery violates `STUDIO_EXPORT_COMPATIBILITY.md`.
- `HIGH`: any canonical seam that changes `rows`, `days`, `totals`, `holidayItems`, or `eventItems` semantics can break preview/export parity.
- `HIGH`: Excel export remains page-coupled; future V2 must either preserve this input shape or isolate Excel behind an adapter.
- `MEDIUM`: custom holiday/event annotations are assembled from both structured objects and legacy strings; a seam must avoid string round-trip ambiguity.
- `LOW`: debug/export trace helpers are valuable for validation and should be preserved as optional diagnostics.

## Safe next action
Before implementing runtime work, define an export adapter contract:
1. V1 or V2 engine produces canonical records, days, holidays, events, locks, and murid metadata.
2. Adapter maps that canonical model into the existing `AttendanceExportPreviewDataV2`/`AttendancePrintDataset` shape.
3. Existing `AttendanceExportPreviewV2`, `attendancePrintLayout.ts`, `AttendancePdfCanvasPreview`, and `attendancePdfExport.ts` remain unchanged until export-specific phase.

## Blockers
- Do not modify export format, PDF structure, Excel structure, or renderer internals in Phase -1.
- Export compatibility cannot be judged from DB schema alone; it depends on the exact page-built dataset shape.

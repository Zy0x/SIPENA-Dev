# DISCOVERY EXPORT COUPLING MAP: Attendance V1

## Objective
Map the exact dependency points and data coupling between the Attendance V1 system and the PDF/Excel/PNG export pipeline.

## Evidence from Actual Repo Files
- **Export Trigger**: In `Attendance.tsx`, both desktop and mobile viewports render `<UnifiedExportStudio>` which is passed `onExport` and `renderPreview` props.
- **Preview Component**: [AttendanceExportPreviewV2.tsx](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx) accepts:
  - `data: AttendanceExportPreviewDataV2` (re-mapped structure from `attendancePreviewStudioData`).
  - `visibleColumnKeys: string[]`
- **PDF Core Generator**: [attendancePdfExport.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/lib/attendancePdfExport.ts) calls `buildAttendancePdfDocument` which depends on `AttendancePrintDataset`.
- **Print Layout**: [attendancePrintLayout.ts](file:///e:/Data/GitHub/SIPENA/tessipena3-f7e2575d/apps/frontend/src/lib/attendancePrintLayout.ts) does layout calculation based on `AttendancePrintDataset`.

## Findings
- **Data Contract**: The export pipeline consumes `AttendancePrintDataset` and `AttendanceExportPreviewDataV2`. These are computed in `Attendance.tsx` via `attendancePreviewData` and `attendancePrintDataset` useMemos.
- **Shared Calculations**: The layout logic relies on `effectiveDays` and attendance statuses (H, S, I, A, D) mapping to days of the month.
- **Tight Coupling**: Although layout computations are separated in helper libraries under `apps/frontend/src/lib`, they expect V1 format arrays where attendance cells have a flat `{ value: string; isHoliday: boolean; hasEvent: boolean }` structure.

## Risks
- **Layout Mismatches**: If V2 changes how holiday or status values are resolved, the PDF export table layout calculations in `attendancePrintLayout.ts` could break, leading to misaligned columns.

## Safe Next Action
- Lock down the export data contracts (`AttendancePrintDataset` and `AttendanceExportPreviewDataV2`). Ensure that whatever engine runs (V1 or V2), the adapter wraps the output into these exact types.

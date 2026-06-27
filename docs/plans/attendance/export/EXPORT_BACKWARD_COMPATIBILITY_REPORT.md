# Export Backward Compatibility Report

## Objective
Report which legacy Presensi export surfaces remain unchanged after Phase 09.

## Evidence from actual repo files
- No changes were made to `apps/frontend/src/pages/Attendance.tsx`.
- No changes were made to `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx`.
- No changes were made to `apps/frontend/src/lib/attendancePrintLayout.ts`.
- No changes were made to `apps/frontend/src/lib/attendancePdfExport.ts`.
- New code is isolated under `apps/frontend/src/features/attendance/export/`.

## Findings
Compatibility status:

- PDF: `UNCHANGED`; adapter produces compatible print dataset but is not wired into live PDF export yet.
- Excel: `UNCHANGED`; V1 page-owned export remains active.
- PNG HD: `UNCHANGED`; preview/canvas path remains active.
- PNG 4K: `UNCHANGED`; preview/canvas path remains active.
- ZIP/batch: `UNCHANGED`; no adapter wiring or renderer change.
- Monthly recap: `UNCHANGED`.
- Daily recap: `UNCHANGED`.
- CSV: `NOT INTRODUCED`.
- Signature support: `UNCHANGED`; signature settings stay in legacy studio/renderer.
- Selected columns: `UNCHANGED`; visible column settings stay in legacy studio/layout planner.
- Attendance annotations/events: `COMPATIBLE`; adapter carries `holidayItems` and `eventItems`, but live V1 path remains unchanged.

## Risks
- `MEDIUM`: Since live V1 export is not switched to canonical yet, future integration still needs a parity gate.
- `LOW`: Adapter default labels may differ from V1 if callers do not pass explicit `monthLabel`, `exportTimeLabel`, and `workDayFormatLabel`.

## Safe next action
- Use explicit labels from UI/runtime when wiring this adapter later.
- Preserve current renderers until output parity is proven at structured payload level.

## Blockers
- None for Phase 10 testing.

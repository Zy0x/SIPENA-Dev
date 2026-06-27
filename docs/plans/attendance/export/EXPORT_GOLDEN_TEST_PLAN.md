# Export Golden Test Plan

## Objective
Define the non-binary golden checks used to protect Presensi export output while moving toward canonical data sources.

## Evidence from actual repo files
- `apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts` compares structured legacy export payloads.
- `apps/frontend/src/lib/attendancePrintLayout.test.ts` already protects layout planner behavior.
- `apps/frontend/src/lib/exportEngine/pdfEngine.test.ts` protects report PDF behavior and sparse-page regressions.

## Findings
Phase 09 golden checks compare structured export input before rendering because binary PDF/PNG/Excel comparison is fragile.

Covered by Phase 09 tests:
- same day column count;
- same murid row count;
- same status cell symbols;
- same per-status totals;
- same configurable `Jumlah` count behavior;
- same note format;
- same holiday/event structured items;
- no engine/debug metadata leakage;
- preview and print dataset row/day count parity.

Formats to preserve:
- PDF: protected indirectly by preserving `AttendancePrintDataset` and not editing renderer/layout.
- Excel: protected by not editing the existing V1 Excel path in Phase 09.
- PNG HD/4K: protected by not editing the preview/canvas/PDF render path.
- ZIP/batch: no Phase 09 code path changed.
- Monthly recap/daily recap: no Phase 09 code path changed.
- CSV: not introduced in Phase 09.

## Risks
- `HIGH`: Binary parity should not be attempted until test fixtures can freeze fonts, page metrics, and runtime rendering.
- `MEDIUM`: Current tests cover adapter output, not the live V1 page-built payload.

## Safe next action
- In Phase 10, add a parity harness that feeds the same fixture through current V1 export data builder and canonical bridge.
- Only after parity passes should live export UI receive canonical bridge output.

## Blockers
- None for Phase 10.

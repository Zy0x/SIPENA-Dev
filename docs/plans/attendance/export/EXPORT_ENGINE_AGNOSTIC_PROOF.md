# Export Engine Agnostic Proof

## Objective
Prove that Phase 09 export adapter code does not depend on V1 hook output, V2 engine internals, runtime switch internals, Supabase, or renderer-specific database details.

## Evidence from actual repo files
- `attendanceExportLegacyBridge.ts` imports canonical types and legacy export target types only.
- `attendanceExport.adapter.ts` accepts `AttendanceDatasetCanonical` and export settings only.
- `attendanceExport.validation.ts` uses canonical export leakage validation and bridge shape checks only.
- No imports from:
  - `apps/frontend/src/pages/Attendance.tsx`;
  - `apps/frontend/src/hooks/useAttendance.ts`;
  - `apps/frontend/src/features/attendance/v1/`;
  - `apps/frontend/src/features/attendance/v2/`;
  - Supabase clients or repositories.

## Findings
Allowed inputs:
- Canonical attendance dataset.
- Export UI settings such as class name, month label, work-day label, export time label, and configurable `Jumlah` status set.
- Legacy style/signature/selected-column settings remain outside the adapter and continue to be handled by the existing studio.

Forbidden inputs not used:
- V1 hook output directly.
- V2 engine output directly.
- runtime engine flags.
- Supabase client.
- source table names.
- debug metadata in export payload.

Validation:
- `validateAttendanceCanonicalExportBridge()` runs `validateExportPayloadHasNoEngineLeakage()` on preview and print datasets.
- Tests include canonical records with debug/source metadata and verify the exported bridge contains none of it.

## Risks
- `MEDIUM`: A future caller can still pass poor labels/settings; Phase 10 should add higher-level integration tests around the route/provider seam.
- `LOW`: Adapter imports legacy preview/print types to preserve exact shape. This is intentional boundary coupling, not engine coupling.

## Safe next action
- Add source guard tests that prevent `features/attendance/export` from importing V1/V2 engine folders or Supabase.

## Blockers
- None for Phase 10.

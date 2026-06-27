# Frontend Integration Report

## Objective
Integrate the Presensi frontend route with the runtime and canonical provider layer while preserving the current V1 UI, import, OCR, and export behavior.

## Evidence from actual repo files
- Runtime route anchor: `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx`.
- V1 render anchor: `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`.
- Production V1 page remains at `apps/frontend/src/pages/Attendance.tsx`.
- Production V1 hook remains at `apps/frontend/src/hooks/useAttendance.ts`.
- Canonical provider files:
  - `apps/frontend/src/features/attendance/provider/AttendanceProvider.tsx`
  - `apps/frontend/src/features/attendance/provider/useAttendanceCanonical.ts`
  - `apps/frontend/src/features/attendance/provider/attendanceProvider.types.ts`
- Debug-only boundary files:
  - `apps/frontend/src/features/attendance/ui/AttendanceRuntimeBoundary.tsx`
  - `apps/frontend/src/features/attendance/ui/AttendanceDebugPanel.tsx`
- Guard file: `apps/frontend/src/features/attendance/guards/frontendImportGuard.ts`.

## Findings
- `/attendance` is already routed through `AttendanceRuntimeRoute`, so Phase 08 can mount a provider boundary without touching `Attendance.tsx`.
- The route still resolves to `AttendanceV1Wrapper` for all normal users.
- `AttendanceProvider` accepts an optional canonical dataset and creates UI/export-safe projections only when a dataset is supplied.
- No canonical dataset is mounted from V1 in this phase; the provider starts in an idle read-only shape.
- The debug panel is opt-in only via `?attendanceDebug=1` or `localStorage.attendance_debug_panel=1`.
- Normal users do not see runtime engine labels, canonical status, or debug details.

## Risks
- `LOW`: The canonical provider is currently mounted without live V1 canonical data, so it is a ready seam rather than a full V1 projection.
- `MEDIUM`: Future UI migration must avoid direct imports from `Attendance.tsx` or `useAttendance.ts`; the guard exists, but it is not yet wired as a repository-wide lint rule.
- `LOW`: Debug panel reads localStorage and URL query at render setup; failures are caught and default to hidden.

## Safe next action
- Phase 09 can connect export through canonical adapter tests without changing export formatting.
- Later frontend phases may add a read-only V1 canonical projection behind the wrapper, but only after a preservation test proves V1 behavior remains unchanged.

## Blockers
- None for Phase 08.
- Do not activate V2 UI until runtime guard and shadow comparison are ready for user-facing validation.

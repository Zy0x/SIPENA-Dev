# Canonical Provider Spec

## Objective
Define the frontend provider contract that lets Presensi UI, export, and future runtime engines consume canonical data without importing V1 or V2 internals directly.

## Evidence from actual repo files
- Provider implementation: `apps/frontend/src/features/attendance/provider/AttendanceProvider.tsx`.
- Provider hook: `apps/frontend/src/features/attendance/provider/useAttendanceCanonical.ts`.
- Provider types: `apps/frontend/src/features/attendance/provider/attendanceProvider.types.ts`.
- Canonical mappers and validation: `apps/frontend/src/features/attendance/canonical/`.
- Runtime hook: `apps/frontend/src/features/attendance/runtime/useAttendanceRuntime.ts`.

## Findings
`AttendanceProvider` owns a single `AttendanceCanonicalContextValue`:

- `dataset`: canonical dataset or `null`.
- `uiModel`: canonical UI projection or `null`.
- `exportDataset`: export-safe canonical projection or `null`.
- `issues`: canonical validation issues.
- `source`: `none`, `v1-wrapper`, `backend`, or `v2-shadow`.
- `status`: `idle`, `ready`, or `error`.
- `runtime`: current runtime context.
- `isCanonicalReady`: true only when status is `ready`.
- `isDebugEnabled`: debug opt-in state.

The provider creates snapshots through `createAttendanceCanonicalSnapshot()`:

- Missing dataset returns an idle, stable shape.
- Present dataset is validated deterministically.
- UI/export projections use the existing canonical mapper functions.
- Engine source is not added to export payloads.

## Allowed imports
- Provider may import canonical mappers and runtime hook.
- Runtime route may import the provider and runtime boundary.
- Future pure UI may import only `useAttendanceCanonical()`.

## Forbidden imports
- Pure UI must not import `apps/frontend/src/pages/Attendance.tsx`.
- Pure UI must not import `apps/frontend/src/hooks/useAttendance.ts`.
- Pure UI must not import V1 or V2 engine modules directly.
- Export integration must consume canonical export data, not engine-specific state.

## Risks
- `MEDIUM`: A future developer can still bypass the provider unless the import guard is wired into CI or source guard tests.
- `LOW`: Empty canonical state is intentional in Phase 08, but future phases must not assume `dataset` is always present.

## Safe next action
- Add source guard coverage for forbidden imports in any future pure UI files.
- Add read-only V1-to-canonical projection only after V1 preservation tests are updated.

## Blockers
- None for provider mounting.

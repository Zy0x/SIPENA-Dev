# FOLDER STRUCTURE PROPOSAL: Attendance V2

## Objective
Define the target module layout for V2 without creating folders in Phase 00. The structure must isolate V1, V2, canonical contracts, export adapters, backend orchestration, shadow mode, and tests.

## Evidence from actual repo files
- `apps/frontend/src/features/attendance/runtime/*`: a runtime folder already exists, but the route is not wired to it.
- `apps/frontend/src/features/attendance/canonical/canonical.types.ts`: a canonical type draft already exists in frontend.
- `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`: a V1 wrapper exists but only renders the current V1 page.
- `apps/backend/src/modules`: only `auth`, `health`, and `users` modules exist; no attendance backend module exists yet.
- `docs/plans/attendance/discovery/DISCOVERY_SYSTEM_MAP.md`: current V1 files are high-risk and must stay untouched.

## Findings
Use one frontend feature boundary, one backend attendance module, and one shared contracts package. Phase 01 may create only the smallest route/runtime files needed for a V1-default shell. Other folders are planned, not created yet.

## Proposed frontend structure
```txt
apps/frontend/src/features/attendance/
  runtime/
    AttendanceRuntimeRoute.tsx
    AttendanceRuntimeProvider.tsx
    attendanceRuntime.config.ts
    attendanceRuntime.registry.ts
    attendanceRuntimeGuard.ts
    useAttendanceRuntime.ts
  canonical/
    canonical.types.ts
    canonical.status.ts
    canonical.validators.ts
    canonical.date.ts
  v1/
    AttendanceV1Wrapper.tsx
    useAttendanceV1Adapter.ts
    v1CanonicalMapper.ts
    v1ReadOnlyTypes.ts
  v2/
    useAttendanceV2Engine.ts
    v2Engine.ts
    calendar/
      calendarEngine.ts
      holidayResolver.ts
      workdayResolver.ts
    rules/
      statusEngine.ts
      conflictEngine.ts
      lockEngine.ts
    data/
      attendanceV2Client.ts
      attendanceV2Cache.ts
    components/
      AttendanceV2Shell.tsx
  export/
    canonicalToPrintDataset.ts
    canonicalExportGuards.ts
  import/
    canonicalImportPlan.ts
    canonicalOcrAttendanceMapper.ts
  shadow/
    shadowDiff.ts
    shadowDiagnostics.ts
  testing/
    attendanceFixtures.ts
    engineParityScenarios.ts
```

## Proposed backend structure
```txt
apps/backend/src/modules/attendance/
  runtime/
    runtime-router.ts
    runtime-config.service.ts
  canonical/
    canonical.dto.ts
    canonical.validation.ts
  engines/
    engine-registry.ts
    engine-contract.ts
    v1/
      v1-read-model.service.ts
      v1-compatibility.mapper.ts
    v2/
      v2-command.service.ts
      v2-query.service.ts
      v2-calendar.service.ts
      v2-rule.service.ts
  shadow/
    shadow-runner.service.ts
    shadow-diff.service.ts
    shadow-audit.repository.ts
  audit/
    attendance-audit.service.ts
    attendance-audit.repository.ts
  validation/
    attendance-command.guard.ts
    attendance-permission.guard.ts
```

## Proposed shared contracts package
```txt
packages/attendance-contracts/
  package.json
  tsconfig.json
  src/
    canonical.ts
    runtime.ts
    engine.ts
    api.ts
    export.ts
    import.ts
    shadow.ts
    errors.ts
    index.ts
```

## Allowed imports
| From | Allowed to import |
|---|---|
| `runtime/*` | `canonical/*`, `v1/*` adapter surface, `v2/*` engine surface, shared contracts |
| `v1/*` | shared contracts, existing V1 page/hook only through adapter wrapper during Phase 01 |
| `v2/*` | shared contracts, V2 internal modules, API client |
| `export/*` | shared contracts, existing export types only at adapter edge |
| backend attendance module | shared contracts and backend infra |

## Forbidden imports
- `v2/*` must never import `apps/frontend/src/pages/Attendance.tsx`.
- `v2/*` must never import `apps/frontend/src/hooks/useAttendance.ts`.
- Existing V1 files must not import V2 or canonical modules during Phase 01.
- Export renderers must not import engine-specific modules.
- Shared contracts must not import React, Supabase clients, browser APIs, or backend framework types.

## Risks
- `HIGH`: moving contracts into `packages/attendance-contracts` too early can create build/package churn.
- `MEDIUM`: duplicating canonical types between frontend and package can drift if not staged.
- `MEDIUM`: backend module does not exist yet; API contract must be documented before code.

## Safe next action
Phase 01 should add only the runtime route shell and registry surface needed to keep V1 active. Shared package creation can wait until the canonical model phase unless Phase 01 needs type-only stubs.

## Blockers
- Do not create backend attendance module until API and table compatibility are approved.
- Do not create V2 engine folders with live writes until shadow mode design is implemented.

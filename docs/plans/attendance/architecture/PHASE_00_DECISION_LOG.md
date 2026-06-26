# PHASE 00 DECISION LOG: Attendance V2

## Objective
Record the architecture decisions that control Phase 01 and later Attendance V2 work.

## Evidence from actual repo files
- Phase -1 discovery files exist under `docs/plans/attendance/discovery/`.
- `apps/frontend/src/app/App.tsx:114`: route does not yet use runtime provider.
- `apps/frontend/src/features/attendance/runtime/*`: runtime scaffolding exists but is not wired to route.
- `apps/frontend/src/pages/Attendance.tsx` and `apps/frontend/src/hooks/useAttendance.ts`: V1 is locked and high risk.
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx`: legacy import uses `attendance`.
- `apps/frontend/src/pages/Attendance.tsx`: OCR/import and hook use `attendance_records`.
- Existing export pipeline is coupled to print dataset/layout planner.

## Findings
Phase 00 approves architecture only. It does not authorize V2 implementation, database migration, export modification, or V1 refactor.

## Decisions

### ADR-001: V1 is production authority until explicit cutover
- Status: Approved.
- Decision: V1 route behavior, hook behavior, import/OCR behavior, and export output remain unchanged in Phase 01.
- Consequence: The runtime shell must default to V1 and render V1 unchanged.

### ADR-002: Route-level runtime shell is the first safe seam
- Status: Approved.
- Decision: `/attendance` should eventually render `AttendanceRuntimeRoute`, which resolves an engine and mounts V1 by default.
- Consequence: No changes inside `Attendance.tsx` are needed for Phase 01.

### ADR-003: Canonical model is the only shared interface
- Status: Approved.
- Decision: UI facades, export adapters, backend API, shadow mode, and tests use canonical contracts.
- Consequence: Engine-specific raw rows cannot cross the runtime boundary.

### ADR-004: V2 cannot import V1 internals
- Status: Approved.
- Decision: V2 code cannot import `Attendance.tsx`, `useAttendance.ts`, V1 helpers, or V1 export assembly.
- Consequence: Parity must be proven through canonical fixtures and adapter tests.

### ADR-005: Export renderer remains locked during runtime phase
- Status: Approved.
- Decision: Existing export preview/PDF/PNG/print layout files are not modified in Phase 01.
- Consequence: Export work starts later at canonical-to-print adapter boundary.

### ADR-006: Table compatibility is a blocker
- Status: Approved.
- Decision: `attendance` vs `attendance_records` ownership must be resolved before V2 writes, shadow mode, or migration.
- Consequence: Create a dedicated compatibility decision document before backend/shadow implementation.

### ADR-007: Rollback is config-first
- Status: Approved.
- Decision: Rollback is `runtime_engine=v1` with emergency V1 priority.
- Consequence: V2 storage and shadow mode must not corrupt V1 authority.

### ADR-008: Backend attendance module is future architecture, not Phase 01 scope
- Status: Approved.
- Decision: Phase 01 does not implement backend attendance endpoints.
- Consequence: Backend API contract remains documentation until table compatibility and shadow storage are approved.

## Phase 01 readiness checklist
- [x] Phase -1 discovery files exist.
- [x] V1 route bypass risk is documented.
- [x] Runtime shell design is documented.
- [x] Engine boundary contract is documented.
- [x] Canonical model ownership is documented.
- [x] Export safe boundary is documented.
- [x] Migration/shadow blockers are documented.
- [x] Rollback design is documented.
- [x] Table compatibility decision document exists: `docs/plans/attendance/database/ATTENDANCE_TABLE_COMPATIBILITY_DECISION.md`.
- [x] Route wrapper implementation plan exists: `docs/plans/attendance/architecture/RUNTIME_ROUTE_WRAPPER_SPEC.md`.

## Risks
- `BLOCKER`: Phase 01 cannot enable V2, only V1-default shell.
- `BLOCKER`: table compatibility unresolved.
- `HIGH`: existing export path remains coupled to V1 page assembly.
- `MEDIUM`: remote runtime config source is not yet selected.

## Safe next action
Proceed to Phase 01 Runtime and implement the route/runtime shell only:
1. create or update `AttendanceRuntimeRoute`;
2. wire `/attendance` to the runtime route;
3. keep V1 as the only active rendered engine;
4. prove V1 page, import, OCR, and export still behave unchanged.

## Blockers
- Do not start V2 engine implementation before the Phase 01 route wrapper has a V1-unchanged proof.

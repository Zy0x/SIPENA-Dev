# V2 MUTATION SAFETY: Attendance V2

## Objective
Define the safety checks that protect every Attendance V2 mutation path before backend persistence exists.

## Evidence from Actual Repo Files
- Validation implementation: `apps/frontend/src/features/attendance/v2/attendanceV2.validation.ts`
- Service write path: `apps/frontend/src/features/attendance/v2/attendanceV2.service.ts`
- Rule guard: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.ts`
- Calendar guard: `apps/frontend/src/features/attendance/v2/calendar/effectiveDayEngine.ts`
- Tests: `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`

## Findings
Every mutation checks:
- runtime mode and explicit `enableWrite`;
- patch class scope equals dataset class;
- murid belongs to class;
- ISO date;
- registered status when status is provided;
- calendar context is available;
- effective day;
- locked write state;
- duplicate existing record risk;
- rule engine write allowance;
- audit event completeness after success.

V2 write behavior is intentionally in-memory only:
- `runtimeMode = disabled`: rejects writes;
- `runtimeMode = shadow`: rejects writes, but shadow comparison can run;
- `runtimeMode = active` with `enableWrite = true`: allows isolated canonical dataset mutation.

The input dataset is cloned before mutation. Callers must use `result.dataset` as the next state.

## Risks
- `HIGH`: A future backend implementation must re-run the same validation server-side. Frontend validation is not enough for production writes.
- `MEDIUM`: Duplicate record detection blocks only when more than one existing matching record already exists; backend should enforce uniqueness.
- `LOW`: Note-only updates reuse the same patch path and therefore require effective unlocked dates.

## Safe Next Action
Phase 07 should implement server-side equivalents of these checks before any database write path is exposed.

## Blockers
Production V2 persistence is blocked until backend authorization, unique constraints, RLS, and audit persistence exist.

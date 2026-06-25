<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 07 — BACKEND PROMPT

## PHASE
Add backend attendance orchestration safely around existing backend structure.

## ROLE
You are a backend architect implementing the Attendance API layer for SIPENA. Your job is to create a safe orchestration backend for dual-engine attendance.

## REQUIRED PRECONDITIONS
Read:
- `attendance/backend/HYBRID_BACKEND.md`
- `attendance/backend/API_SPEC.md`
- `attendance/backend/BACKEND_ROUTER.md`
- `attendance/backend/MIDDLEWARE_RUNTIME.md`
- `attendance/backend/SAFE_EXECUTION_RULES.md`
- `attendance/backend/DATABASE_MODEL.md`
- `attendance/v2/V2_ENGINE_IMPLEMENTATION.md`
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`

## REPO REALITY CHECK
Before implementing, inspect `apps/backend/src/modules`. If attendance module does not exist, create a new module following existing backend conventions. Do not invent framework patterns that conflict with current code.

## GOAL
Create backend attendance orchestration that can expose canonical attendance data and route to V1/V2 via runtime switch.

## HARD RULES
- Do not alter V1 DB schema.
- Do not delete or rewrite V1 attendance data.
- Do not make frontend depend on engine-specific backend routes.
- Do not bypass runtime middleware.
- Do not expose engine internals in normal API response.
- V1 route must remain default behavior until cutover.

## TASK
Implement or spec backend attendance module.

Suggested structure:
```txt
apps/backend/src/modules/attendance/
  attendance.routes.ts
  attendance.controller.ts
  attendance.service.ts
  runtime/
  canonical/
  v1/
  v2/
  audit/
  shadow/
  validation/
```

Adapt names to actual backend conventions.

## REQUIRED API SURFACE
Design/implement endpoints:
- `GET /attendance` → canonical dataset
- `POST /attendance` → guarded write/patch
- `POST /attendance/bulk` → guarded bulk patch
- `PATCH /attendance/note` → guarded note update
- `GET /attendance/summary/daily`
- `GET /attendance/summary/monthly`
- `GET /attendance/export-dataset`
- `GET /attendance/runtime`
- `POST /attendance/runtime` admin-only if allowed
- `GET /attendance/shadow/report` admin/debug only

## REQUIRED BACKEND LAYERS
Implement or document:
- runtime middleware
- request validation
- controller
- service orchestration
- V1 adapter
- V2 service
- canonical mapper
- audit service
- shadow comparison service
- error mapper

## DATABASE SAFETY
If DB files/migrations are needed, create V2-only additive migration proposals:
- `attendance_v2_events`
- `attendance_v2_rules`
- `attendance_v2_calendar`
- `attendance_v2_audit_logs`
- `attendance_v2_shadow_results`
- `attendance_runtime_config`

Never alter V1 tables. Verify actual V1 table names from code before any mapping.

## SECURITY REQUIREMENTS
- Validate class scope.
- Validate student scope.
- Validate status codes.
- Validate dates.
- Guard admin-only runtime/shadow routes.
- Do not leak sensitive debug details in normal responses.

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/backend/BACKEND_IMPLEMENTATION_REPORT.md`
- `attendance/backend/API_CONTRACT_FINAL.md`
- `attendance/backend/RUNTIME_MIDDLEWARE_FINAL.md`
- `attendance/backend/DATABASE_EXTENSION_PROPOSAL.md`
- `attendance/backend/BACKEND_SECURITY_CHECKLIST.md`

## ACCEPTANCE CRITERIA
Phase 07 passes only if:
- Backend attendance module follows repo conventions.
- API returns canonical output.
- Runtime routing exists or is precisely specified.
- V1 remains default.
- V1 schema is untouched.
- V2 tables are additive only.
- Typecheck/build result is documented.

## STOP CONDITIONS
Stop if:
- Existing backend architecture is unclear.
- Any implementation requires destructive DB migration.
- Runtime route cannot be secured.
- API would leak engine details.

## FINAL RESPONSE
Return:
- Backend files added/updated.
- API surface implemented/speced.
- DB safety status.
- Validation command results.
- Whether Phase 08 Frontend can start.

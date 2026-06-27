# BACKEND SECURITY CHECKLIST: Attendance Phase 07

## Objective
Record security controls implemented or still required for the Attendance backend module.

## Evidence from Actual Repo Files
- `apps/backend/src/modules/attendance/runtime/attendanceRuntime.ts`
- `apps/backend/src/modules/attendance/validation/attendanceRequestValidation.ts`
- `apps/backend/src/modules/attendance/attendance.service.ts`
- `apps/backend/src/modules/attendance/attendance.controller.ts`

## Findings
Implemented controls:
- runtime defaults to V1;
- invalid runtime config forces V1;
- V2 cannot activate unless explicitly allowed by env;
- write endpoints fail closed by default;
- runtime mutation requires admin key;
- shadow report requires admin/debug key;
- normal dataset/export response omits debug/source-engine metadata;
- request validation checks class, date, month, patch shape, status, and note type;
- no direct database connection and no V1 table mutation in Phase 07.

Controls still required before production backend writes:
- authenticated user identity parsing;
- class ownership validation;
- murid membership validation;
- status permission validation with server-side rule engine;
- persistent audit logs;
- RLS-backed V2 tables;
- service role separation;
- backend integration tests for forbidden writes and debug access;
- rate limiting for write/bulk endpoints.

## Risks
- `HIGH`: The current backend has no real auth middleware. Phase 07 therefore blocks writes rather than trusting headers.
- `HIGH`: Class/student scope cannot be fully validated until a safe repository layer exists.
- `MEDIUM`: Admin key protection is enough for development scaffolding, not final production admin control.

## Safe Next Action
Phase 08 may read runtime status. Any backend write activation must wait for auth, scope, RLS, audit persistence, and V2 storage.

## Blockers
- Do not enable `ATTENDANCE_BACKEND_ENABLE_WRITES` in production before the checklist above is complete.

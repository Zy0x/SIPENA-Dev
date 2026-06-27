# BACKEND IMPLEMENTATION REPORT: Attendance Phase 07

## Objective
Document the backend attendance orchestration added in Phase 07 and prove that it follows the actual repo backend conventions without changing V1 Presensi behavior or database schema.

## Evidence from Actual Repo Files
- Backend entrypoint: `apps/backend/src/app.module.ts`
- New attendance controller: `apps/backend/src/modules/attendance/attendance.controller.ts`
- New attendance service: `apps/backend/src/modules/attendance/attendance.service.ts`
- Runtime guard: `apps/backend/src/modules/attendance/runtime/attendanceRuntime.ts`
- Request validation: `apps/backend/src/modules/attendance/validation/attendanceRequestValidation.ts`
- Canonical backend contracts: `apps/backend/src/modules/attendance/attendance.types.ts`
- V1 adapter placeholder: `apps/backend/src/modules/attendance/v1/attendanceV1.adapter.ts`
- V2 adapter placeholder: `apps/backend/src/modules/attendance/v2/attendanceV2.adapter.ts`
- Shadow/audit placeholders: `apps/backend/src/modules/attendance/shadow/attendanceShadow.service.ts`, `apps/backend/src/modules/attendance/audit/attendanceAudit.service.ts`

## Findings
The existing backend is a minimal `node:http` server, not NestJS. Phase 07 therefore added an HTTP module that follows the repo's current controller style instead of introducing a new framework.

Implemented route family:
- `GET /api/attendance`
- `POST /api/attendance`
- `POST /api/attendance/bulk`
- `PATCH /api/attendance/note`
- `GET /api/attendance/summary/daily`
- `GET /api/attendance/summary/monthly`
- `GET /api/attendance/export-dataset`
- `GET /api/attendance/runtime`
- `POST /api/attendance/runtime`
- `GET /api/attendance/shadow/report`

The default backend runtime is V1. V2 cannot activate unless `ATTENDANCE_BACKEND_ALLOW_V2=true` is set. Writes remain disabled unless V2 is active and `ATTENDANCE_BACKEND_ENABLE_WRITES=true` is also set. Even then, persistence is intentionally not configured yet, so the write path fails closed.

Validation run:
- `npm run typecheck`: passed.
- `npm test`: passed, 64 files / 544 tests.
- `npm run lint`: passed with existing repo-wide warnings.
- `npm run build`: passed with existing Vite chunk warnings.
- `npm --workspace apps/backend run build`: passed.
- `npm run verify:web:dist`: passed.
- `git diff --check`: passed.
- forbidden-path guard for V1 page/hook, export, import, OCR, and Supabase: passed.

## Risks
- `BLOCKER`: The real V1 data path still has unresolved `attendance_records` versus legacy `attendance` ownership. Phase 07 does not read or write either table.
- `HIGH`: The backend returns a canonical empty dataset with a warning until a safe database adapter is approved.
- `HIGH`: `node apps/backend/dist/main.js` currently fails because the existing backend TypeScript output emits extensionless ESM imports. Phase 07 did not change backend module resolution because that is outside the attendance API contract scope.
- `MEDIUM`: Runtime override is in-memory only for this backend process. Durable remote config is deferred.
- `LOW`: Audit and shadow services are placeholders until persistence is introduced.

## Safe Next Action
Phase 08 can integrate frontend runtime calls against `/api/attendance/runtime` only if it keeps V1 UI behavior unchanged. Data-reading integration should wait until the V1 compatibility adapter is approved.

## Blockers
- Do not enable V2 backend writes before additive storage, RLS, and compatibility tests exist.
- Do not connect V1 database reads before `attendance_records` versus `attendance` is resolved.
- Resolve backend ESM runtime output before relying on `npm --workspace apps/backend start` in production.

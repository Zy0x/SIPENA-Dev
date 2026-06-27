# V2 AUDIT SPEC: Attendance V2

## Objective
Define the audit event emitted by isolated Attendance V2 mutation operations.

## Evidence from Actual Repo Files
- Audit type: `apps/frontend/src/features/attendance/v2/attendanceV2.types.ts`
- Audit factory: `apps/frontend/src/features/attendance/v2/attendanceV2.audit.ts`
- Audit usage: `apps/frontend/src/features/attendance/v2/attendanceV2.service.ts`
- Tests: `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`

## Findings
Audit events include:
- ID and timestamp;
- actor;
- action: `CREATE`, `UPDATE`, `DELETE`, `BULK_UPDATE`, `NOTE_UPDATE`, or `VALIDATE`;
- class, murid, and date scope;
- before/after canonical record snapshots;
- reason code from rule/validation path;
- metadata for applied rule IDs, rule audit metadata, conflict notes, and optional shadow mismatch.

Phase 06 stores audit logs in memory on the service instance and exposes copies through `getAuditLogs()`. It does not persist audit logs to Supabase.

## Risks
- `HIGH`: Backend Phase 07 must make audit persistence append-only and authorization-aware.
- `MEDIUM`: Local audit ID generation is sufficient for tests, not for production audit authority.
- `LOW`: Metadata is extensible and should be treated as diagnostic payload.

## Safe Next Action
Phase 07 should move audit persistence behind a server-side module and keep frontend audit events as local previews until backend confirmation.

## Blockers
Production audit readiness is blocked until backend storage, RLS, and retention policy are implemented.

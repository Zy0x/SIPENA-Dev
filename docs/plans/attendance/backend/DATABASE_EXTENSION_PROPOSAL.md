# DATABASE EXTENSION PROPOSAL: Attendance V2

## Objective
Propose additive-only tables for future V2 backend storage without modifying V1 Presensi tables.

## Evidence from Actual Repo Files
- Active V1 tables from discovery: `attendance_records`, `attendance_holidays`, `attendance_day_events`, `attendance_locks`.
- Legacy/conflicting table from discovery: `attendance`.
- Phase 07 changed no files under `supabase/` and created no migration.

## Findings
Phase 07 does not create migrations. The safe proposal for later phases is additive-only:

| Proposed table | Purpose | Safety rule |
|---|---|---|
| `attendance_v2_events` | raw immutable attendance events | append-only, no V1 references mutated |
| `attendance_v2_rules` | rule definitions and custom status behavior | RLS by owner/school |
| `attendance_v2_calendar` | school/class calendar rules and overrides | derived effective days are not stored as truth |
| `attendance_v2_audit_logs` | immutable audit trail | insert-only for authenticated service path |
| `attendance_v2_shadow_results` | shadow comparison reports | debug/admin access only |
| `attendance_runtime_config` | remote runtime switch | admin-only, rollback to V1 possible |

Required migration properties:
- no `ALTER TABLE` against V1 tables;
- no deletion of existing V1 rows;
- RLS enabled on every new table;
- policies scoped by authenticated ownership/school/class;
- runtime config fail-closed to V1 if unreadable;
- shadow results cannot reveal debug internals to normal users.

## Risks
- `BLOCKER`: The project still needs a compatibility decision for `attendance_records` versus `attendance`.
- `HIGH`: A V2 event store without RLS and audit tests would create data leakage risk.
- `MEDIUM`: Runtime config table requires a secure admin model that does not exist in Phase 07 backend yet.

## Safe Next Action
Draft migrations only after Phase 08/09 confirm exact API consumption and after compatibility ownership is resolved.

## Blockers
- No migration should be applied from this proposal without Supabase advisor/security review and rollback plan.

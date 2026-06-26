# ATTENDANCE TABLE COMPATIBILITY DECISION

## Objective
Record the Phase 00 decision for the discovered `attendance_records` and `attendance` table split so Phase 01 can avoid guessing and later migration/shadow work has a safe starting point.

## Evidence from actual repo files
- `apps/frontend/src/hooks/useAttendance.ts`: active V1 hook reads/writes `attendance_records`, `attendance_holidays`, `attendance_day_events`, and `attendance_locks`.
- `apps/frontend/src/pages/Attendance.tsx`: OCR import preflights and writes through the active hook/table path.
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx`: Excel import writes legacy `attendance`.
- `supabase/functions/delete-semester-data/index.ts`: some cleanup flows include both `attendance_records` and `attendance`.
- `supabase/functions/process-account-deletion/index.ts`: account deletion references legacy `attendance`.
- `supabase/functions/morphe-chat/index.ts`: reads `attendance_records` and falls back to `attendance`.
- `docs/plans/attendance/discovery/DISCOVERY_DATABASE_TOUCHPOINTS.md`: table split is a Phase -1 blocker.

## Findings
The working production UI/hook path uses `attendance_records`. The legacy `attendance` table still appears in import, cleanup, account deletion, and AI context paths. Phase 00 does not authorize migration, but it must freeze read/write assumptions for Phase 01.

## Decision
Status: Approved for Phase 01 only.

1. `attendance_records` is treated as the active V1 UI/hook authority.
2. `attendance_holidays`, `attendance_day_events`, and `attendance_locks` remain active V1 companion tables.
3. `attendance` is treated as legacy/compatibility until a dedicated migration reconciles it.
4. Phase 01 runtime wrapper must not change any table read/write behavior.
5. V2/shadow writes are blocked until a migration phase defines storage targets and reconciliation.

## Compatibility rules
| Flow | Phase 01 behavior | Later required decision |
|---|---|---|
| V1 page reads/writes | unchanged, `attendance_records` via `useAttendance` | canonical mapper reads active V1 records |
| OCR import | unchanged, active V1 path | canonical import planner later |
| Excel import | unchanged, legacy `attendance` path | must be reconciled before cutover |
| Export | unchanged, page dataset assembly | canonical export adapter later |
| Cleanup | unchanged | update coverage after table audit |
| Account deletion | unchanged | must include active authority table before cutover |
| AI context | unchanged fallback behavior | canonical query service later |

## Data integrity rules
- Do not merge rows from `attendance` into `attendance_records` in Phase 01.
- Do not write V2 shadow rows into either active V1 table in Phase 01.
- Do not change RLS, indexes, triggers, or schema in Phase 01.
- Any future reconciliation must be idempotent and produce a per-class/month report.
- Duplicate key behavior for `(class_id, student_id, date)` must be explicitly tested before migration.

## Migration prerequisites
Before V2 write/shadow mode:
1. inventory row counts in both tables by user, class, month, and academic year;
2. decide whether `attendance` contains active user data or stale legacy data;
3. define conflict precedence when both tables contain same class/murid/date;
4. update account deletion and cleanup functions to include authoritative tables;
5. define audit report for migrated/skipped/conflicted rows;
6. add tests for no duplicate records after rerun.

## Risks
- `BLOCKER`: legacy Excel import can produce rows outside active V1 hook/export.
- `HIGH`: account deletion may miss `attendance_records` if not audited before cutover.
- `HIGH`: shadow mode can create duplicate records if storage target is not isolated.
- `MEDIUM`: AI fallback can mask missing active-table data during analysis.

## Safe next action
Phase 01 can proceed because it does not change any table behavior. Phase 03+ must create a compatibility mapper and migration inventory before canonical write work.

## Blockers
- No V2 write, shadow write, or table migration until the migration prerequisites are completed.

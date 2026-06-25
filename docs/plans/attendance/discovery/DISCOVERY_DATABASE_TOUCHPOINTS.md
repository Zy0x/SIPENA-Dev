# DISCOVERY DATABASE TOUCHPOINTS: Attendance V1

## Objective
List actual database tables, columns, read/write paths, local fallback paths, and server-side touchpoints used by Attendance V1. Do not assume table names from plans.

## Evidence from actual repo files
- `apps/frontend/src/hooks/useAttendance.ts:56-88`: DB availability check and monthly reads from `attendance_records`.
- `apps/frontend/src/hooks/useAttendance.ts:91-103`: reads `attendance_holidays` by `user_id`.
- `apps/frontend/src/hooks/useAttendance.ts:105-120`: reads `attendance_day_events` by `user_id`.
- `apps/frontend/src/hooks/useAttendance.ts:122-138`: reads `attendance_locks` by `class_id`, `user_id`, and month start date.
- `apps/frontend/src/hooks/useAttendance.ts:199-275`: upsert/delete behavior for individual `attendance_records`.
- `apps/frontend/src/hooks/useAttendance.ts:319-355`: bulk daily operation deletes `attendance_records` for class/date and reinserts rows.
- `apps/frontend/src/hooks/useAttendance.ts:357-383`: toggles rows in `attendance_holidays`.
- `apps/frontend/src/hooks/useAttendance.ts:385-434`: upserts/deletes rows in `attendance_day_events`.
- `apps/frontend/src/hooks/useAttendance.ts:436-456`: inserts/updates rows in `attendance_locks`.
- `apps/frontend/src/hooks/useAttendance.ts:518-544`: yearly data reads `attendance_records`, `attendance_holidays`, and `attendance_day_events`.
- `apps/frontend/src/pages/Attendance.tsx:1371-1390`: bulk clear dynamically imports Supabase and deletes `attendance_records` by class/date, then reloads the page.
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx:167-174`: Excel import writes to table `attendance`.
- `apps/frontend/src/pages/Attendance.tsx:4977-5025`: OCR import preflights and saves through `attendance_records` and `setAttendanceDb`.
- `docs/sql/001_ATTENDANCE_V2_MIGRATION.sql:7-17`: updates `attendance_records` status constraint to `H/I/S/A/D` and adds `note`.
- `docs/sql/001_ATTENDANCE_V2_MIGRATION.sql:19-57`: creates/guards `attendance_day_events` and index.
- `docs/sql/012_ACADEMIC_YEAR_COMPREHENSIVE.sql:55-102`: optionally adds `academic_year_id` to `attendance_records` and `attendance_locks`.
- `docs/sql/012_ACADEMIC_YEAR_COMPREHENSIVE.sql:143-160`: optionally indexes `attendance_records.academic_year_id`.
- `docs/sql/012_ACADEMIC_YEAR_COMPREHENSIVE.sql:233-248`: migrates `attendance_records.academic_year_id` from `classes`.
- `supabase/functions/delete-semester-data/index.ts:338-364`: deletes from `attendance_records`, then tries legacy `attendance`.
- `supabase/functions/delete-semester-data/index.ts:518-524`: year deletion deletes `attendance_records` by `semester_id`.
- `supabase/functions/process-account-deletion/index.ts:380-384`: account deletion deletes only from `attendance`.
- `supabase/functions/morphe-chat/index.ts:274-289`: reads `attendance_records`, then falls back to `attendance`.
- `supabase/functions/admin-database/index.ts:87-90` and `133-135`: admin table allowlists include `attendance`, not V1's current `attendance_records` family.

## Findings

### Tables actively used by V1 hook/page
| Table | Access path | Actual columns referenced |
|---|---|---|
| `attendance_records` | `useAttendance`, `Attendance.tsx` bulk clear, OCR import preflight | `id`, `class_id`, `student_id`, `date`, `status`, `note`, `created_by`; SQL docs also mention `academic_year_id`, `semester_id`, `user_id` in server deletion code |
| `attendance_holidays` | `useAttendance` | `id`, `user_id`, `date`, `description` |
| `attendance_day_events` | `useAttendance`, SQL doc | `id`, `user_id`, `date`, `label`, `description`, `color`, `created_at`, `updated_at` |
| `attendance_locks` | `useAttendance`, SQL doc | `id`, `class_id`, `user_id`, `month`, `is_locked`, `locked_at`, `locked_by`, optional `academic_year_id` |
| `attendance` | legacy Excel import and several Edge Functions | `class_id`, `student_id`, `date`, `status`, plus server cleanup assumptions (`semester_id`, `user_id`) |

### Direct DB dependencies
- V1 has direct browser-side Supabase reads and writes through `supabaseExternal`.
- No NestJS attendance backend module exists.
- Supabase Edge Functions are not a single source of truth: some know `attendance_records`, some know legacy `attendance`, and some know both.

### Local fallback and storage dependencies
- If `attendance_records` table detection fails, `useAttendance` falls back to in-memory `localAttendance`, `localHolidays`, `localDayEvents`, and `localLocked`.
- `attendance_work_format` in `Attendance.tsx` stores 5-day/6-day work format.
- `sipena_jumlah_config` in `JumlahCalculationConfig.tsx` stores jumlah-column status inclusion rules.
- `sipena_national_holidays_<year>` in `useIndonesianHolidays.ts` caches external holiday API data.
- `attendance_engine_override` in runtime config exists but does not affect the active route today.
- `attendanceExportDebug` stores recent export traces in localStorage when debug is active.

## Risks
- `BLOCKER`: real V1 table set cannot be represented as only one table; both `attendance_records` and legacy `attendance` appear in production-relevant paths.
- `HIGH`: `ImportAttendanceDialog` writes to `attendance`, not `attendance_records`, so imported Excel data may not appear in V1 hook/export if the database does not mirror both tables.
- `HIGH`: `process-account-deletion` deletes only `attendance`, leaving `attendance_records` family as a possible account-deletion gap.
- `HIGH`: `delete-semester-data` expects `semester_id`/`user_id` columns on attendance tables; `useAttendance` writes `created_by` and class/date fields, not semester/user fields for every operation.
- `MEDIUM`: lock month format is `yyyy-MM-dd` month start in V1 hook, while canonical draft uses `YYYY-MM`.
- `MEDIUM`: local fallback state is in-memory and not durable; any V2 test using table-unavailable mode must not infer persistence.
- `LOW`: admin DB allowlist still names `attendance` and may not expose `attendance_records` family consistently.

## Safe next action
Before V2 runtime or migration, write a database compatibility note that classifies `attendance` as legacy/import/cleanup table and `attendance_records` as active V1 hook table, then decide whether the adapter should read both or only the active V1 hook path.

## Blockers
- Do not implement runtime or V2 writes until `attendance` vs `attendance_records` ownership is decided.
- Do not modify RLS, schema, Edge Functions, or imports in Phase -1.

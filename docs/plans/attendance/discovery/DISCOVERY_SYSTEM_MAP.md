# DISCOVERY SYSTEM MAP: Attendance V1

## Objective
Map Attendance V1 as it exists in the repository before any runtime, V2, adapter, export, import, OCR, or database work starts. This is a read-only forensic map; V1 remains locked.

## Evidence from actual repo files
- `AGENTS.md`: repository root for this work is `E:\Data\GitHub\SIPENA\tessipena3-f7e2575d`; presensi/export parity is explicitly high risk.
- `docs/plans/attendance/01_MANIFEST.md:1-10`: `AGENTS.md` overrides manifest and phase rules.
- `docs/plans/attendance/02_AI_CONTRACT.md:3-13`: V1 must not be modified; V2 must be isolated; export and DB core schema must not be touched during this phase.
- `docs/plans/attendance/project-memory/CURRENT_PHASE.md:1-8`: Phase -1 is discovery only.
- `docs/plans/attendance/engines/V1_LOCKED.md:1-19`: V1 is production-stable, black-box, direct CRUD, and no refactor is allowed.
- Requested root path `attendance/01_MANIFEST.md` does not exist; actual project plan files are under `docs/plans/attendance/`.
- `package.json:1-22`: npm monorepo with `apps/frontend`, `apps/backend`, and root validation scripts (`build`, `typecheck`, `test`, `verify:web:dist`).
- `apps/frontend/src/app/App.tsx:28` imports `Attendance` directly; `apps/frontend/src/app/App.tsx:114` routes `/attendance` directly to `<Attendance />`.
- `apps/frontend/src/pages/Attendance.tsx:243-255` defines V1 status labels and colors for `H`, `I`, `S`, `A`, `D`.
- `apps/frontend/src/pages/Attendance.tsx:317-354` keeps most UI state locally in the page.
- `apps/frontend/src/pages/Attendance.tsx:359-380` reads and writes `attendance_work_format`.
- `apps/frontend/src/pages/Attendance.tsx:394-399` calls `useAttendance(...)` directly.
- `apps/frontend/src/hooks/useAttendance.ts:7-41` defines V1 record, holiday, day event, lock, workday, and status types.
- `apps/frontend/src/components/attendance/JumlahCalculationConfig.tsx:21-56` persists jumlah-column settings in localStorage and controls which status counts toward the `Jumlah` column.
- `apps/frontend/src/hooks/useIndonesianHolidays.ts:10-17` defines external holiday API URLs; `apps/frontend/src/hooks/useIndonesianHolidays.ts:25-42` caches national holidays in localStorage.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntime.config.ts:3-37`, `attendanceRuntimeGuard.ts:3-28`, and `AttendanceRuntimeProvider.tsx:8-23` show partial runtime-switch code exists, but `App.tsx` does not route through it.

## Findings
- V1 entry point is the direct `/attendance` route in `App.tsx`, not the runtime provider/wrapper.
- V1 UI responsibilities live primarily in `Attendance.tsx`: class/date/month selection, daily/monthly views, bulk status, holiday settings, day events, notes, lock controls, import menu, OCR dialog wiring, and export studio wiring.
- V1 hook responsibilities live in `useAttendance.ts`: Supabase availability detection, table queries, local fallback state, attendance CRUD, holiday CRUD, day-event CRUD, lock CRUD, day/month/year data derivation, and status counts.
- Status model is `H` Hadir, `I` Izin, `S` Sakit, `A` Alpha, `D` Dispensasi. Export/calendar also represent holidays as `L` and empty cells as `-`.
- Calendar behavior combines weekend rules from `workDayFormat`, custom `attendance_holidays`, and national holidays from `useIndonesianHolidays`.
- Custom holiday description `"Hari Kerja"` acts as an override that forces a date back to working day in `Attendance.tsx:641-675`.
- Day event behavior is separate from holiday behavior: `attendance_day_events` stores date labels/descriptions/colors and is merged into preview/export data.
- Lock behavior is UI/hook-level: `attendance_locks` stores monthly locked state, while mutating functions are exposed by the hook. The UI blocks many edit paths, but the hook does not enforce every caller-level lock invariant internally.
- Import flow splits:
  - Excel import dialog parses a file and writes directly from the dialog.
  - OCR dialog calls `ocr-import-process`, validates draft rows, and then uses `setAttendanceDb` from the page.
- Export flow is page-coupled but renderer-stabilized: `Attendance.tsx` builds preview datasets and passes them to `AttendanceExportPreviewV2`, `attendancePrintLayout`, `AttendancePdfCanvasPreview`, and `attendancePdfExport`.
- Backend readiness for attendance is effectively absent in `apps/backend`; only `auth`, `health`, and `users` modules exist. Attendance V1 is frontend + Supabase direct, with some Supabase Edge Functions touching attendance data.
- Partial runtime switch exists in `apps/frontend/src/features/attendance/runtime`, but it is not active for the current route.

## Risks
- `BLOCKER`: Direct `/attendance` route bypasses runtime-switch code. Any V2 runtime work must first define a safe wrapper path without changing V1 behavior.
- `BLOCKER`: V1 must not be refactored during Phase -1 by contract and `V1_LOCKED.md`.
- `HIGH`: `Attendance.tsx` is very large and directly couples UI state, import, export, calendar, localStorage, and hook output.
- `HIGH`: Excel import writes to `attendance`, while main V1 hook and OCR use `attendance_records`; this is a data-path mismatch that must be resolved before migration/runtime work.
- `MEDIUM`: Project prompt asked for `attendance/...`, but actual project memory is under `docs/plans/attendance/...`; future prompts must use the real repo path or include this alias explicitly.
- `MEDIUM`: National holidays depend on external APIs and localStorage cache, so export/runtime tests need deterministic fixtures.
- `LOW`: Existing runtime config uses localStorage key `attendance_engine_override`; until routed, it is inert for users.

## Safe next action
Create a V1 adapter seam outside `Attendance.tsx` and `useAttendance.ts` that can read V1 hook output and map it into the canonical model. Do not redirect `/attendance` to V2 until the route-level runtime wrapper is proven to render V1 unchanged.

## Blockers
- Runtime switch is present in files but absent from the actual route.
- Excel import table mismatch (`attendance` vs `attendance_records`) must be classified before V2 migration or shadow-mode work.
- No production code may be changed in this phase.

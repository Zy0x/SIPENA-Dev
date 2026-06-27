# Frontend Regression Checklist

## Objective
Define the minimum regression checks for frontend runtime/provider integration and future UI migration.

## Evidence from actual repo files
- Runtime route: `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx`.
- Provider tests: `apps/frontend/src/features/attendance/provider/attendanceProvider.test.ts`.
- Import guard tests: `apps/frontend/src/features/attendance/guards/frontendImportGuard.test.ts`.
- Runtime tests: `apps/frontend/src/features/attendance/runtime/attendanceRuntime.test.ts`.

## Findings
Phase 08 regression checks must prove:

- Default runtime remains V1.
- Invalid runtime config falls back to V1 active mode.
- V2-like invalid values cannot activate V2.
- Canonical provider returns a stable idle shape without V1 live data.
- Canonical provider can project a valid dataset to UI/export shapes.
- Canonical provider marks invalid datasets as errors without throwing during render setup.
- General UI files are blocked from direct V1 page/hook imports by the guard helper.
- Export/import/OCR source files remain untouched.
- Normal users do not see debug runtime information.

## Manual QA checklist
- Open `/attendance`; rendered UI should look like the current V1 Presensi page.
- Confirm export buttons remain visible and unchanged.
- Confirm import and OCR buttons remain visible and unchanged.
- Confirm no engine label/debug panel appears without opt-in.
- Open `/attendance?attendanceDebug=1`; debug panel may appear for developer inspection only.

## Automated gate checklist
- `npm run typecheck`
- targeted Vitest for provider, guard, and runtime tests
- full `npm test`
- `npm run lint`
- `npm run build`
- `npm run verify:web:dist`
- `git diff --check`
- forbidden-path guard for locked V1/export/import/OCR/database files

## Risks
- `MEDIUM`: If future phases add provider data from V1 without tests, V1 state could become double-owned.
- `HIGH`: Any accidental edit to `Attendance.tsx`, `useAttendance.ts`, export, import, OCR, or Supabase files must stop the phase for review.

## Safe next action
- Keep this checklist as a required gate for Phase 09 export integration and any future UI split.

## Blockers
- None for Phase 08 after gates pass.

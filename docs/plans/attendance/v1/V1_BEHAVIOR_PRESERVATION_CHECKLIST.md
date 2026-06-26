# V1 BEHAVIOR PRESERVATION CHECKLIST: Attendance V2 Phase 02

## Objective
List the exact checks required to prove Phase 02 preserves V1 Presensi behavior while adding a wrapper/adapter seam.

## Evidence from actual repo files
- `apps/frontend/src/pages/Attendance.tsx` remains the rendered page behind `AttendanceV1Wrapper`.
- `apps/frontend/src/hooks/useAttendance.ts` remains the mutation and query owner.
- `apps/frontend/src/app/App.tsx` routes `/attendance` through the Phase 01 runtime route, which still renders V1.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts` still blocks V2 activation.

## Findings
The Phase 02 seam is safe only if the user-facing path still reaches V1 and all existing V1 business behavior remains owned by the old files.

## Required source checks
- [x] `git diff -- apps/frontend/src/pages/Attendance.tsx` shows no changes.
- [x] `git diff -- apps/frontend/src/hooks/useAttendance.ts` shows no changes.
- [x] `git diff -- apps/frontend/src/components/export apps/frontend/src/lib/attendanceExport* apps/frontend/src/lib/attendancePrintLayout* apps/frontend/src/lib/attendancePdfExport*` shows no changes.
- [x] `git diff -- apps/frontend/src/components/import apps/frontend/src/components/import/OCRImportDialog.tsx` shows no changes.
- [x] `git diff -- supabase` shows no schema, policy, function, or migration changes.

## Required runtime checks
- [x] `/attendance` route uses `AttendanceRuntimeRoute`.
- [x] `AttendanceRuntimeRoute` renders `AttendanceV1Wrapper`.
- [x] `AttendanceV1Wrapper` renders `Attendance` with no props, no side effects, and no state.
- [x] V2 guard flag remains false.
- [x] Missing or invalid runtime config still falls back to V1.

## Required behavior checks for later manual QA
- [ ] Open `/attendance` and confirm the same Presensi page renders after login.
- [ ] Select class and month; murid rows load as before.
- [ ] Toggle `H`, `S`, `I`, `A`, and `D`; writes still use V1 hook behavior.
- [ ] Edit notes; notes still save through V1.
- [ ] Add/remove holiday and day event; V1 calendar behavior remains unchanged.
- [ ] Toggle month lock; lock behavior remains unchanged.
- [ ] Open import/OCR; existing dialogs and validation remain unchanged.
- [ ] Open export studio; preview/export remain unchanged.

## Risks
- `HIGH`: running the V1 hook in a new component would duplicate V1 queries/mutations; Phase 02 does not do this.
- `MEDIUM`: manual QA still requires an authenticated session; source/test proof is the current automated safety gate.
- `LOW`: wrapper adds one component level, but it does not change the DOM produced by `Attendance.tsx`.

## Safe next action
Phase 03 can add canonical model tests using pure adapter inputs. Any attempt to mount a second V1 hook instance must be rejected until lifecycle ownership is designed.

## Blockers
- If `Attendance.tsx`, `useAttendance.ts`, export, import, OCR, or Supabase diffs appear, Phase 02 fails.
- If runtime can activate V2, Phase 02 fails.

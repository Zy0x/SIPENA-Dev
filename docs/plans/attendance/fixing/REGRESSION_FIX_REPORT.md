# Phase 11 Regression Fix Report

## Objective
Mencatat verifikasi regresi untuk fix Phase 11 dan memastikan V1 tetap terkunci.

## Evidence From Actual Repo Files
- Regression tests added/updated:
  - `apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts`
  - `apps/frontend/src/features/attendance/v2/attendanceV2.test.ts`
- Protected files intentionally untouched:
  - `apps/frontend/src/pages/Attendance.tsx`
  - `apps/frontend/src/hooks/useAttendance.ts`
  - `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx`
  - `apps/frontend/src/lib/attendancePrintLayout.ts`
  - `apps/frontend/src/lib/attendancePdfExport.ts`
  - `apps/frontend/src/components/import/OCRImportDialog.tsx`
  - `supabase/**`

## Findings
Targeted validation:

```powershell
npm test -- --run apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts apps/frontend/src/features/attendance/v2/attendanceV2.test.ts apps/frontend/src/features/attendance/testing/attendancePhase10.test.ts
```

Result:
- PASS: `attendanceExportGolden.test.ts` - 7 tests
- PASS: `attendanceV2.test.ts` - 12 tests
- PASS: `attendancePhase10.test.ts` - 7 tests
- Total: 3 files, 26 tests

Full validation:
- PASS: `npm run typecheck`
- PASS: `npm test` - 68 files, 566 tests
- PASS: `npm run lint` - 0 errors, 401 existing warnings
- PASS: `npm run build`
- PASS: `npm run verify:web:dist`
- PASS: `git diff --check` - exit 0, line-ending warnings only
- PASS: protected-path guard - no diff in V1 page/hook, legacy export renderers, import/OCR, or Supabase

New regression coverage:
- signature-enabled canonical export carries settings and validates signer presence;
- missing signature settings blocks canonical export bridge;
- unmapped custom status blocks canonical export bridge;
- shadow comparison reports `record_order` drift;
- Phase 10 harness remains green.

## Risks
- `MEDIUM`: UI/browser tests remain manual until a browser harness is added.

## Safe Next Action
Commit Phase 11 after final git review. Do not start cutover until remaining render/browser gates are addressed or explicitly accepted.

## Blockers
None found in targeted verification.

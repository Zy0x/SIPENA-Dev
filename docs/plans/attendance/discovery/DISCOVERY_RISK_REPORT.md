# DISCOVERY RISK REPORT: Attendance V1

## Objective
Classify risks that must be understood before Attendance runtime, V2 engine, migration, adapter, or export work starts.

## Evidence from actual repo files
- `docs/plans/attendance/02_AI_CONTRACT.md:3-13`: no V1 modification, no export modification, no DB core schema modification.
- `docs/plans/attendance/engines/V1_LOCKED.md:1-19`: V1 is black box and no refactor is allowed.
- `apps/frontend/src/app/App.tsx:114`: `/attendance` currently renders `Attendance` directly.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts:3-28`: V2 requests are forced back to V1 because V2 is not implemented.
- `apps/frontend/src/pages/Attendance.tsx:317-399`: page owns broad state and calls the V1 hook directly.
- `apps/frontend/src/pages/Attendance.tsx:695-869`: page owns export dataset assembly.
- `apps/frontend/src/hooks/useAttendance.ts:199-456`: hook owns direct Supabase mutations.
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx:167-174`: Excel import writes to `attendance`.
- `apps/frontend/src/pages/Attendance.tsx:4977-5025`: OCR import uses `attendance_records`/`setAttendanceDb`.
- `apps/frontend/src/lib/attendancePrintLayout.ts:1-9`: export preview/output parity depends on this layout planner.
- `supabase/functions/process-account-deletion/index.ts:380-384`: account deletion deletes from `attendance`, not `attendance_records`.

## Findings

| Risk ID | Classification | Finding | Impact | Safe control |
|---|---|---|---|---|
| R-001 | `BLOCKER` | V1 route bypasses runtime switch. | Runtime flag cannot select V1/V2 for current `/attendance`. | Add route wrapper only in runtime phase; prove it renders V1 unchanged. |
| R-002 | `BLOCKER` | V1 is locked by contract. | Any refactor or hook edit violates phase and can break production presensi. | Phase -1 docs only; Phase 01 wrapper-only changes. |
| R-003 | `BLOCKER` | `attendance` and `attendance_records` both appear in data paths. | Migration/shadow mode may miss imported or deleted data. | Create compatibility decision before V2 writes. |
| R-004 | `HIGH` | `Attendance.tsx` assembles export data and owns UI/data orchestration. | Shape changes can break UI and export together. | Adapter must preserve page output shape or sit below export. |
| R-005 | `HIGH` | Excel import writes outside active hook table. | User-imported rows may diverge from displayed/exported rows. | Treat import flow as separate compatibility problem before cutover. |
| R-006 | `HIGH` | Account deletion and admin DB functions do not consistently include active V1 tables. | Data retention/security risk in future cleanup work. | Audit Edge Functions before migration/cutover. |
| R-007 | `HIGH` | Export parity is sensitive to `AttendancePrintDataset` and layout plan. | PDF/PNG/preview regressions if canonical adapter changes semantics. | Do not touch export renderer; map to existing dataset contract. |
| R-008 | `MEDIUM` | Workday format and jumlah rules are localStorage preferences. | V2 runtime can produce different counts if preferences are not carried. | Include preference adapter in canonical seam. |
| R-009 | `MEDIUM` | National holiday data comes from external APIs and local cache. | Tests may be non-deterministic or stale. | Use fixtures in V2 validation/shadow tests. |
| R-010 | `MEDIUM` | Lock model uses month-start date in V1 while canonical draft expects `YYYY-MM`. | Lock state mismatch during mapping. | Normalize lock month at adapter boundary only. |
| R-011 | `LOW` | Existing discovery path is `docs/plans`, not prompt path `attendance/`. | Future prompts can point to missing files. | Keep docs in actual project plan tree and note path mapping. |

## Risks
- The current system has no safe direct path for replacing `useAttendance` in-place.
- Export and import are not equal: export is mostly page/dataset driven; Excel import is dialog/table driven; OCR import is hook-driven.
- Backend absence means V2 cannot assume server module parity. Supabase functions must be audited individually.

## Safe next action
Phase 00 should produce an architecture decision record for:
1. runtime route wrapper placement,
2. `attendance` vs `attendance_records` compatibility,
3. export adapter input shape,
4. localStorage preference mapping,
5. Edge Function cleanup responsibilities.

## Blockers
- `attendance`/`attendance_records` data ownership is unresolved.
- Runtime switch is not wired to `/attendance`.
- V1 cannot be edited to create the seam.

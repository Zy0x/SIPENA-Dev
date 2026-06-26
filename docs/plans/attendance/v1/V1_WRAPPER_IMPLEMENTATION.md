# V1 WRAPPER IMPLEMENTATION: Attendance V2 Phase 02

## Objective
Create a stable V1 wrapper and adapter seam so the current Presensi screen remains the active experience while future V2 work can be built outside the locked V1 files.

## Evidence from actual repo files
- `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx` imports `@/pages/Attendance` and renders it unchanged.
- `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx` renders `AttendanceV1Wrapper` for every Phase 02 runtime path.
- `apps/frontend/src/features/attendance/v1/attendanceV1.adapter.ts` is a thin seam around `useAttendance` and is not used by the route.
- `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.ts` contains pure, read-only draft mapping helpers for canonical preparation.
- `apps/frontend/src/features/attendance/v1/attendanceV1.guard.ts` returns a structured guard result and expects the runtime engine to be `v1`.

## Findings
Phase 02 uses a wrapper, not a clone or refactor. The locked V1 page and hook continue owning all UI state, Supabase reads/writes, import flow, OCR flow, export flow, local storage preferences, and table behavior.

The only active runtime rendering chain is:

```txt
/attendance route
  -> AttendanceRuntimeRoute
  -> AttendanceRuntimeProvider
  -> AttendanceV1Wrapper
  -> pages/Attendance.tsx
  -> hooks/useAttendance.ts
```

The adapter seam added for future phases is intentionally read-only:

```txt
V1 data shapes
  -> attendanceV1.canonical.ts pure mapper
  -> canonical draft/dataset
  -> future Phase 03 canonical model validation
```

## Runtime behavior
- Default runtime remains `v1`.
- Requested `v2` remains blocked by `IS_ATTENDANCE_V2_IMPLEMENTED = false`.
- Invalid runtime config falls back to V1.
- The V1 wrapper has no props and no side effects.

## Files added or owned by the V1 seam
- `apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx`
- `apps/frontend/src/features/attendance/v1/attendanceV1.adapter.ts`
- `apps/frontend/src/features/attendance/v1/attendanceV1.types.ts`
- `apps/frontend/src/features/attendance/v1/attendanceV1.guard.ts`
- `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.ts`
- `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.test.ts`

## Files intentionally not modified
- `apps/frontend/src/pages/Attendance.tsx`
- `apps/frontend/src/hooks/useAttendance.ts`
- `apps/frontend/src/components/import/ImportAttendanceDialog.tsx`
- `apps/frontend/src/components/import/OCRImportDialog.tsx`
- `apps/frontend/src/components/export/*`
- `apps/frontend/src/lib/attendanceExport*`
- `apps/frontend/src/lib/attendancePrintLayout*`
- `apps/frontend/src/lib/attendancePdfExport*`
- `supabase/**`

## Risks
- `HIGH`: `attendanceV1.adapter.ts` imports the live V1 hook; it must not be activated for shadow/canonical reads until Phase 03 explicitly defines lifecycle ownership.
- `MEDIUM`: canonical mappers currently preserve only fields available from V1 public shapes; export-only derived data remains documented but not implemented as active mapping.
- `LOW`: wrapper proof is source-based and test-based; pixel-level UI equivalence is deferred because no UI was changed.

## Safe next action
Phase 03 may define the canonical model contract and expand read-only mapping tests. It must not make the V1 adapter own live UI state or writes.

## Blockers
- Do not activate V2.
- Do not replace `Attendance.tsx` internals.
- Do not route export/import through canonical data until an export parity phase explicitly owns that work.

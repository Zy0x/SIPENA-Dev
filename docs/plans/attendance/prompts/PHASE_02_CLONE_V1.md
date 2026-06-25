<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 02 — CLONE / WRAP V1 PROMPT

## PHASE
Create a safe V1 wrapper/adapter seam. Preserve behavior exactly.

## ROLE
You are a legacy-system preservation engineer. Your task is to wrap Attendance V1 safely so it can coexist with the future V2 engine.

## REQUIRED PRECONDITIONS
Read:
- `attendance/engines/V1_LOCKED.md`
- `attendance/frontend/V1_UI_WRAPPER.md`
- `attendance/engines/ENGINE_ADAPTER_LAYER.md`
- `attendance/architecture/ENGINE_BOUNDARY_CONTRACT.md`
- Phase -1 `V1_TO_CANONICAL_SEAM.md`
- Phase 01 runtime implementation notes

## GOAL
Create a V1 wrapper/adapter boundary without changing V1 behavior.

## HARD RULES
- Do not rewrite Attendance V1.
- Do not refactor V1 internals.
- Do not change existing state logic, export logic, import logic, or Supabase calls.
- Do not change user-facing UI.
- Do not change routes unless the runtime architecture requires a pure wrapper that renders the same component.
- If moving or renaming files is too risky, do not move them; create wrapper files around them.

## TASK
Implement a wrapper boundary around the existing V1 page/hook.

Preferred safe options, in order:
1. Create `AttendanceV1Wrapper.tsx` that imports and renders current `Attendance` unchanged.
2. Create a V1 adapter that reads existing outputs where safe, but does not transform live logic yet.
3. Create adapter type contracts and tests that prepare canonical mapping without activation.

Suggested files:
```txt
apps/frontend/src/features/attendance/v1/AttendanceV1Wrapper.tsx
apps/frontend/src/features/attendance/v1/attendanceV1.adapter.ts
apps/frontend/src/features/attendance/v1/attendanceV1.types.ts
apps/frontend/src/features/attendance/v1/attendanceV1.guard.ts
```

## CANONICAL SEAM REQUIREMENT
Identify and document how V1 data will map into:
- students
- class
- month/day selection
- records
- status values `H`, `I`, `S`, `A`, `D`
- holidays
- day events
- locks
- notes
- monthly summary
- daily summary
- yearly export data

## REQUIRED SAFETY CHECKS
Before and after any change:
- Confirm `Attendance.tsx` logic is unchanged.
- Confirm `useAttendance.ts` logic is unchanged.
- Confirm export imports are unchanged.
- Confirm default runtime still renders V1.
- Confirm V2 remains inactive.

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/v1/V1_WRAPPER_IMPLEMENTATION.md`
- `attendance/v1/V1_BEHAVIOR_PRESERVATION_CHECKLIST.md`
- `attendance/v1/V1_CANONICAL_MAPPING_DRAFT.md`
- `attendance/v1/V1_UNTOUCHED_PROOF.md`

## ACCEPTANCE CRITERIA
Phase 02 passes only if:
- V1 renders exactly as before.
- A wrapper or adapter seam exists.
- No V1 logic changed.
- No export behavior changed.
- Canonical mapping draft exists.
- Runtime default remains V1.

## STOP CONDITIONS
Stop if:
- You need to edit V1 internals.
- You need to rewrite exports.
- You cannot preserve route behavior.
- You cannot prove behavior preservation.

## FINAL RESPONSE
Return:
- Files added.
- Files intentionally not modified.
- V1 behavior preservation proof.
- Remaining risks.
- Whether Phase 03 Canonical Model can start.

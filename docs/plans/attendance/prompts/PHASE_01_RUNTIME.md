<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 01 — RUNTIME SWITCH PROMPT

## PHASE
Implement the minimal runtime foundation only. No behavior change. Default must remain V1.

## ROLE
You are a senior TypeScript engineer implementing the Attendance Runtime Switch for SIPENA with zero user-facing behavior change.

## REQUIRED PRECONDITIONS
Verify Phase 00 architecture is approved and read:
- `attendance/architecture/RUNTIME_SWITCH_BLUEPRINT.md`
- `attendance/architecture/ENGINE_BOUNDARY_CONTRACT.md`
- `attendance/architecture/ROLLBACK_BLUEPRINT.md`
- `attendance/engines/ENGINE_SWITCH.md`
- `attendance/frontend/RUNTIME_INTEGRATION.md`
- `attendance/backend/MIDDLEWARE_RUNTIME.md`

## GOAL
Create a runtime switch layer that can select `v1` or `v2`, but defaults to `v1`. At the end of this phase, the app must behave exactly like before.

## HARD RULES
- Default runtime engine is `v1`.
- Do not route production UI to V2.
- Do not modify V1 business logic.
- Do not modify export logic.
- Do not change database schema.
- Runtime must be reversible by config.
- Runtime must not require redeploy in final architecture, but local implementation may begin with env/local config.

## TASK
Implement the smallest safe runtime foundation.

Create or update only runtime-related files. Suggested frontend files:
```txt
apps/frontend/src/features/attendance/runtime/attendanceRuntime.types.ts
apps/frontend/src/features/attendance/runtime/attendanceRuntime.config.ts
apps/frontend/src/features/attendance/runtime/AttendanceRuntimeProvider.tsx
apps/frontend/src/features/attendance/runtime/useAttendanceRuntime.ts
apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts
```

Suggested shared/backend files only if the repo architecture supports them:
```txt
packages/attendance-contracts/src/runtime.ts
apps/backend/src/modules/attendance/runtime/*
```

## REQUIRED TYPES
Define these concepts precisely:
- `AttendanceRuntimeEngine = "v1" | "v2"`
- `AttendanceRuntimeMode = "active" | "shadow" | "disabled"`
- `AttendanceRuntimeConfig`
- `AttendanceRuntimeContextValue`
- `AttendanceRuntimeGuardResult`
- `AttendanceRuntimeSource = "env" | "localStorage" | "remote" | "default"`

## REQUIRED BEHAVIOR
- If runtime config is missing, invalid, or unsafe, force `v1`.
- If `v2` is requested but V2 is not implemented, force `v1` and log a safe warning in development only.
- Runtime provider must expose active engine, mode, source, and guard result.
- UI code must not import V1 or V2 through this phase.
- No page behavior should change.

## VALIDATION TASKS
Run available checks:
- `npm run typecheck` if available.
- `npm run lint` if available and reasonable.
- `npm run test` if available and safe.

If commands fail because the repo already has unrelated issues, document them clearly.

## EXPECTED DOCUMENTATION UPDATES
Create/update:
- `attendance/runtime/RUNTIME_IMPLEMENTATION_NOTES.md`
- `attendance/runtime/RUNTIME_GUARD_RULES.md`
- `attendance/runtime/RUNTIME_ROLLBACK_NOTES.md`
- `attendance/project-memory/CHANGELOG.md`
- `attendance/project-memory/PROGRESS_TRACKER.md`

## ACCEPTANCE CRITERIA
Phase 01 passes only if:
- Runtime types exist.
- Runtime config exists.
- Provider/hook exists.
- Default is V1.
- V2 cannot accidentally activate.
- Existing attendance behavior is unchanged.
- No V1 internals were modified.
- No export files were modified.

## STOP CONDITIONS
Stop if implementation requires:
- modifying `Attendance.tsx` business logic,
- changing `useAttendance.ts` behavior,
- altering export format,
- changing production DB tables.

## FINAL RESPONSE
Report:
- Runtime files added.
- Runtime default value.
- Safety guard behavior.
- Validation command results.
- Whether Phase 02 Clone V1 can start.

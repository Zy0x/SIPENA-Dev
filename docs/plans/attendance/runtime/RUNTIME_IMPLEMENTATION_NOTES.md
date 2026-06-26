# RUNTIME IMPLEMENTATION NOTES: Attendance V2

## Objective
Record the Phase 01 runtime implementation details and the exact safety limits of the current switch layer.

## Evidence from actual repo files
- `apps/frontend/src/features/attendance/runtime/attendanceRuntime.types.ts`: defines engine, mode, source, config, context value, and guard result types.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntime.config.ts`: resolves runtime config from remote input placeholder, localStorage override, env, or default.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts`: forces V1 when config is invalid, disabled, or V2 is requested.
- `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeProvider.tsx`: exposes runtime context value.
- `apps/frontend/src/features/attendance/runtime/useAttendanceRuntime.ts`: exposes runtime context hook.
- `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx`: route shell renders V1 wrapper in Phase 01.
- `apps/frontend/src/app/App.tsx`: `/attendance` is wired to `AttendanceRuntimeRoute`.

## Findings
Phase 01 implements the runtime foundation only. The runtime can resolve `v1` or a requested `v2`, but the guard prevents V2 from activating. The rendered attendance page is still the locked V1 page through `AttendanceV1Wrapper`.

## Runtime resolution order
1. Remote input placeholder if supplied to `resolveRuntimeConfig`.
2. `localStorage.attendance_engine_override`.
3. `import.meta.env.VITE_ATTENDANCE_ENGINE`.
4. Default `v1`.

Invalid values become config entries with `isValid=false` and are forced to V1 by the guard.

## Current behavior
- Default engine: `v1`.
- Default mode: `active`.
- V2 implementation flag: `false`.
- Route output: always V1 in Phase 01.
- Export/import/OCR/data behavior: unchanged because `Attendance.tsx` and `useAttendance.ts` are not modified.

## Risks
- `MEDIUM`: localStorage override can request V2 during development, but it will be forced to V1.
- `LOW`: remote config is only represented as resolver input placeholder; there is no production remote config source yet.

## Safe next action
Phase 02 can start by proving the V1 wrapper/clone path remains unchanged and by adding source guards around V1 files.

## Blockers
- V2 cannot activate until `IS_ATTENDANCE_V2_IMPLEMENTED` is intentionally changed in a later phase and table/export compatibility gates pass.

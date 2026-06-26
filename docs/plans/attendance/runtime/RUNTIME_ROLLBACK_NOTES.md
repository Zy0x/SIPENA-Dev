# RUNTIME ROLLBACK NOTES: Attendance V2

## Objective
Document rollback behavior after Phase 01 runtime foundation.

## Evidence from actual repo files
- `apps/frontend/src/features/attendance/runtime/attendanceRuntime.config.ts`: default and invalid config resolution return V1.
- `apps/frontend/src/features/attendance/runtime/attendanceRuntimeGuard.ts`: unsafe config and V2 requests force V1 active.
- `apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx`: route shell renders V1 wrapper.
- `apps/frontend/src/app/App.tsx`: `/attendance` now enters the runtime shell.

## Findings
Rollback is effectively immediate in Phase 01 because V1 is the only user-facing rendered engine. Setting override/env to V2 cannot activate V2 yet.

## Current rollback actions
Developer/session rollback:
```js
localStorage.setItem("attendance_engine_override", "v1");
```

Clear developer override:
```js
localStorage.removeItem("attendance_engine_override");
```

Environment rollback:
```env
VITE_ATTENDANCE_ENGINE=v1
```

Invalid values also rollback automatically:
```env
VITE_ATTENDANCE_ENGINE=unknown
```

## Failure behavior
- localStorage read failure: default V1.
- invalid engine or mode: forced V1 active.
- V2 requested: forced V1 active.
- runtime context hook used outside provider: creates safe V1 runtime context.

## Risks
- `LOW`: because remote config is not implemented, production rollback still relies on shipped env/default behavior in this phase.

## Safe next action
Future remote config must preserve emergency V1 priority and should add tests before enabling V2.

## Blockers
- No data rollback exists yet because Phase 01 performs no V2 writes and changes no database behavior.

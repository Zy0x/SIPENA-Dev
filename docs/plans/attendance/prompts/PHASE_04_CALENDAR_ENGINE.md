<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 04 — CALENDAR ENGINE PROMPT

## PHASE
Build the V2 calendar/effective-day foundation in isolation.

## ROLE
You are a school calendar domain engineer. Your task is to build a deterministic, event-based Calendar Engine for Attendance V2 without touching V1.

## REQUIRED PRECONDITIONS
Read:
- `attendance/core-engines/CALENDAR_ENGINE.md`
- `attendance/core-engines/EFFECTIVE_DAY_ENGINE.md`
- `attendance/backend/CONFLICT_RESOLVER.md`
- `attendance/testing/CALENDAR_RULE_TEST.md`
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`

## GOAL
Create a V2 Calendar Engine that determines effective school days, holidays, special events, and overrides based on rules and events.

## HARD RULES
- Do not modify V1 holiday logic.
- Do not modify current Attendance UI.
- Do not modify existing export logic.
- Do not store derived effective-day results as source of truth.
- Everything calendar-related must be computed from canonical calendar rules/events.
- The engine must be deterministic for the same input.

## TASK
Implement or spec the Calendar Engine in isolation.

Suggested files:
```txt
apps/frontend/src/features/attendance/v2/calendar/calendarEngine.types.ts
apps/frontend/src/features/attendance/v2/calendar/calendarEngine.ts
apps/frontend/src/features/attendance/v2/calendar/effectiveDayEngine.ts
apps/frontend/src/features/attendance/v2/calendar/calendarConflictResolver.ts
apps/frontend/src/features/attendance/v2/calendar/calendarEngine.test.ts
```

Backend equivalent may be created later under:
```txt
apps/backend/src/modules/attendance/engines/calendar/
```

## REQUIRED INPUTS
The engine must accept:
- date range
- class scope
- school scope
- work day format (`5days` / `6days` from current V1 behavior)
- calendar events
- holidays
- overrides
- lock context

## REQUIRED OUTPUTS
The engine must output canonical day objects containing:
- date
- day of week
- isEffectiveDay
- isHoliday
- holiday/event labels
- event priority
- blocked write state
- reason codes
- metadata for UI hints

## RULE PRIORITY
Document and implement a conflict priority system such as:
1. explicit lock / administrative closure
2. school-specific override
3. class-specific event
4. national holiday/custom holiday
5. work-day format
6. default school day

Adjust based on actual V1 discovery, but document any deviation.

## EDGE CASES TO COVER
- Sunday holiday.
- Saturday inactive in 5-day format.
- Saturday active in 6-day format.
- Custom holiday overriding normal school day.
- Event on holiday.
- Multiple events on same day.
- Class-specific event vs school-wide event.
- Month boundary.
- Leap year February.
- Locked date.
- Retroactive change.

## TEST REQUIREMENTS
Add unit tests or test specs for each edge case.
If the repo test setup is not ready, create executable-like test documentation with input/output examples.

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/calendar/CALENDAR_ENGINE_SPEC.md`
- `attendance/calendar/EFFECTIVE_DAY_RULES.md`
- `attendance/calendar/CALENDAR_CONFLICT_PRIORITY.md`
- `attendance/calendar/CALENDAR_EDGE_CASES.md`

## ACCEPTANCE CRITERIA
Phase 04 passes only if:
- Calendar Engine is isolated.
- Effective day calculation is deterministic.
- Calendar output uses canonical model.
- V1 is unchanged.
- Export is unchanged.
- Tests/specs cover edge cases.

## STOP CONDITIONS
Stop if:
- Calendar logic must be inserted into V1.
- Export code must change.
- Current V1 DB tables must be altered.
- Effective days are being stored as permanent truth.

## FINAL RESPONSE
Return:
- Calendar files created.
- Rules implemented/documented.
- Edge cases covered.
- Test result or test limitation.
- Whether Phase 05 Rule Engine can start.

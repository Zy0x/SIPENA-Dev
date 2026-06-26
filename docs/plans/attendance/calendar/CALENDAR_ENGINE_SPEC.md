# CALENDAR ENGINE SPEC: Attendance V2

## Objective

Define the isolated V2 calendar engine that computes effective school days, holidays, event labels, and write-blocking state from canonical inputs without touching V1 Presensi logic or export logic.

## Evidence from actual repo files

- Engine files:
  - `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.types.ts`
  - `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.ts`
  - `apps/frontend/src/features/attendance/v2/calendar/effectiveDayEngine.ts`
  - `apps/frontend/src/features/attendance/v2/calendar/calendarConflictResolver.ts`
  - `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.test.ts`
- Canonical model consumed from `apps/frontend/src/features/attendance/canonical/`.
- V1 page, V1 hook, import, export, OCR, and Supabase schema are not part of this engine.

## Findings

### Engine contract

`generateCalendarDays(inputs)` accepts:

- `startDate` and `endDate` in strict ISO `YYYY-MM-DD`
- `classId`
- optional `schoolScope`
- `workDayFormat`: `5days` or `6days`
- scoped calendar events
- holidays
- overrides
- attendance locks

The engine returns `V2CalendarDay[]`, where each day extends `AttendanceDayCanonical` and adds:

- `isHoliday`
- `eventPriority`
- `blockedWriteState`
- `reasonCodes`
- `metadata.uiHint`
- `isEffectiveDay` compatibility alias

### Determinism

For the same input, output is deterministic because:

- date iteration is sequential and inclusive;
- multiple events are sorted by explicit priority and stable ID;
- multiple overrides are sorted by class specificity, explicit priority, and stable ID;
- holidays are sorted by national flag and stable ID.

### Scope model

Events and overrides can be:

- school-wide;
- school-scoped by `schoolId`;
- class-scoped by `classId`.

Class-scoped event/override wins over school-wide event/override for the matching class.

### Lock behavior

Locks set `blockedWriteState` and add `LOCKED_PERIOD`, but they do not turn an otherwise effective day into a holiday. This follows the canonical invariant that locks block writes, not reads.

## Risks

- `HIGH`: Future UI wiring must not treat `V2CalendarDay` as stored truth; it must be regenerated from source inputs.
- `MEDIUM`: `CalendarScopedEvent` adds optional scope fields that are not part of base canonical event yet; moving contracts to a shared package should preserve this extension.
- `LOW`: Backend equivalent is not implemented in this phase.

## Safe next action

Phase 05 Rule Engine can consume `V2CalendarDay` for write/read decisions while keeping V1 runtime disabled for V2.

## Blockers

None.

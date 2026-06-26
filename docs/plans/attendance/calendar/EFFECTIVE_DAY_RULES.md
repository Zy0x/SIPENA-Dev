# EFFECTIVE DAY RULES: Attendance V2

## Objective

Document how V2 determines whether a date is an effective school day for Presensi, without storing the derived result as permanent truth.

## Evidence from actual repo files

- Single-day calculation is implemented by `computeEffectiveDay`.
- Range calculation is implemented by `generateCalendarDays`.
- Conflict priority is implemented by `resolveConflictForDate`.

## Findings

### Effective day definition

A day is effective when attendance is expected for murid. Effective status is computed from inputs in this order:

1. administrative closure;
2. forced effective/holiday override;
3. class-specific event;
4. school-wide event;
5. registered holiday;
6. weekend/work-day rule;
7. default school day.

### Work-day format

- `5days`: Monday-Friday are effective by default. Saturday and Sunday are non-effective unless higher-priority event/override applies.
- `6days`: Monday-Saturday are effective by default. Sunday is non-effective unless higher-priority event/override applies.

### Events and overrides

- `FORCED_EFFECTIVE` can make weekend or holiday effective.
- `FORCED_HOLIDAY` can make a normal school day non-effective.
- `ADMINISTRATIVE_CLOSURE` always makes the day non-effective and write-blocked.
- Class events make the date effective only for the matching class.
- School events make the date effective for matching school scope.

### Locks

Locks do not change `isEffective`. They set:

- `blockedWriteState: true`
- `reasonCodes` includes `LOCKED_PERIOD`
- `metadata.uiHint: "locked"`

## Risks

- `HIGH`: Treating locks as holidays would hide legitimate read-only attendance data.
- `MEDIUM`: A future backend implementation must use the same priority table or shadow comparisons will drift.

## Safe next action

Rule Engine should use `blockedWriteState` to reject writes and `isEffective` to determine whether attendance is expected.

## Blockers

None.

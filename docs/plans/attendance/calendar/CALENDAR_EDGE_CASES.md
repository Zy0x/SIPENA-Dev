# CALENDAR EDGE CASES: Attendance V2

## Objective

List the calendar edge cases covered by Phase 04 and the expected deterministic result for each case.

## Evidence from actual repo files

- Executable coverage exists in `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.test.ts`.

## Findings

| Edge case | Expected result | Test coverage |
| --- | --- | --- |
| Default weekday | Effective, `DEFAULT_SCHOOL_DAY`. | Yes |
| Sunday without event | Non-effective, `WEEKEND_SUNDAY`. | Yes |
| Holiday on Sunday | Non-effective with holiday label, `HOLIDAY_RECORD`. | Yes |
| Saturday in `5days` | Non-effective, `WEEKEND_SATURDAY`. | Yes |
| Saturday in `6days` | Effective, `DEFAULT_SCHOOL_DAY`. | Yes |
| Custom holiday | Non-effective with custom label. | Yes |
| Event on holiday | Effective, event label wins, holiday IDs preserved for UI hint. | Yes |
| Multiple events same day | Highest priority then stable ID wins. | Yes |
| Class event vs school event | Matching class event wins. | Yes |
| School-scoped event | Only matching `schoolScope.schoolId` applies. | Yes |
| Administrative closure | Non-effective and write-blocked. | Yes |
| Forced effective Sunday | Effective despite weekend rule. | Yes |
| Month boundary | Inclusive generation crosses months. | Yes |
| Leap year February | February 29 generated in leap year. | Yes |
| Invalid date | Throws before generating result. | Yes |
| Locked month | Keeps effective state but blocks writes. | Yes |
| Retroactive change | Recomputes output from changed input; no stored truth. | Yes |

## Risks

- `MEDIUM`: Backend parity must reproduce the same edge-case results when backend calendar engine is introduced.
- `LOW`: Current tests are unit tests only; browser UI wiring is intentionally out of scope for Phase 04.

## Safe next action

Phase 05 should use these cases as regression anchors when write/read rules are layered on top of calendar days.

## Blockers

None.

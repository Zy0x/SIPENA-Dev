# DEFAULT RULES: Attendance V2

## Objective
List baseline rules bundled with Attendance V2 and explain their priority, trigger, and output.

## Evidence from Actual Repo Files
- Default rules: `apps/frontend/src/features/attendance/v2/rules/defaultRules.ts`
- Evaluator: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.ts`
- Status helper: `apps/frontend/src/features/attendance/v2/rules/statusEngine.ts`
- Tests: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`

## Findings
Default bundled rules are evaluated before custom rules with deterministic priority.

| Rule ID | Scope | Priority | Trigger | Effect |
| --- | --- | --- | --- | --- |
| `rule-missing-calendar-context` | date | `HARD_BLOCK` | `calendarDay` is `null` | Block write with `MISSING_CALENDAR_CONTEXT` |
| `rule-invalid-status` | status | `HARD_BLOCK` | proposed status is not registered | Block write with `INVALID_STATUS_CODE` |
| `rule-status-requires-note` | status | `HARD_BLOCK` | proposed status has `REQUIRES_NOTE` and note is empty | Block write with `STATUS_REQUIRES_NOTE` |
| `rule-lock-period` | date | `LOCK` | calendar says writes are blocked | Block write with `LOCKED_PERIOD` or `ADMINISTRATIVE_CLOSURE` |
| `rule-non-effective-day` | date | `LOCK` | calendar day is not effective | Block write and resolve status to existing status or `L` |
| `rule-manual-status-assignment` | status | `MANUAL_OVERRIDE` | effective day with explicit proposed status | Allow write with proposed status |
| `rule-retroactive-update` | student | `MANUAL_OVERRIDE` | explicit retroactive edit with existing record | Allow write and mark audit metadata |
| `rule-event-effective-day` | date | `EVENT` | effective event day with no proposed status | Default to existing status or `H` |
| `rule-default-school-day` | school | `DEFAULT` | effective normal day with no proposed status | Default to existing status or `H` |

Default rules do not import UI, V1, export, OCR, import, Supabase, or storage code.

## Risks
- `HIGH`: `L` is a derived/read-only status. Persistence layers must not treat it as ordinary manual attendance unless explicitly allowed.
- `MEDIUM`: `ADMINISTRATIVE_CLOSURE` depends on calendar reason codes being supplied correctly.
- `LOW`: Rule names are English while UI copy may need Indonesian localization later.

## Safe Next Action
Phase 06 should consume these defaults through `evaluateAttendanceRules` only and should not duplicate default behavior in orchestration code.

## Blockers
None for isolated V2 orchestration.

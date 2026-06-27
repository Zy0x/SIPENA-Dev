# RULE DECISION TABLE: Attendance V2

## Objective
Provide a compact decision table for the baseline Attendance V2 rules so Phase 06 can orchestrate behavior without guessing.

## Evidence from Actual Repo Files
- Rule implementation: `apps/frontend/src/features/attendance/v2/rules/defaultRules.ts`
- Conflict resolution: `apps/frontend/src/features/attendance/v2/rules/conflictEngine.ts`
- Rule tests: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`

## Findings

| Scenario | Calendar Context | Proposed Input | Applied Rule | Status Output | Write | Reason Code |
| --- | --- | --- | --- | --- | --- | --- |
| Missing calendar | `calendarDay = null` | any | `rule-missing-calendar-context` | existing or `null` | no | `MISSING_CALENDAR_CONTEXT` |
| Normal effective day | effective, unlocked | no status | `rule-default-school-day` | existing or `H` | yes | `DEFAULT_WEEKDAY_HADIR` |
| Manual status | effective, unlocked | valid status with required note if needed | `rule-manual-status-assignment` | proposed status | yes | `MANUAL_STATUS_ASSIGNMENT` |
| Invalid status | effective, unlocked | unregistered status | `rule-invalid-status` | existing or `null` | no | `INVALID_STATUS_CODE` |
| Missing required note | effective, unlocked | `I`, `S`, or `D` without note | `rule-status-requires-note` | existing or `null` | no | `STATUS_REQUIRES_NOTE` |
| Locked period | `blockedWriteState = true` | any | `rule-lock-period` | existing or `null` | no | `LOCKED_PERIOD` |
| Administrative closure | blocked and reason includes closure | any | `rule-lock-period` | existing or `null` | no | `ADMINISTRATIVE_CLOSURE` |
| Non-effective day | `isEffective = false` | any | `rule-non-effective-day` | existing or `L` | no | `NON_EFFECTIVE_DAY` |
| Event day default | effective with event IDs | no status | `rule-event-effective-day` | existing or `H` | yes | `EVENT_DAY_DEFAULT_HADIR` |
| Retroactive edit | effective with existing record | retroactive context with status or note | `rule-retroactive-update` | proposed or existing | yes | `RETROACTIVE_UPDATE_ALLOWED` |
| Same-priority custom clash | any | custom policy conflict | highest specificity or rule id fallback | resolved rule output | resolved rule write state | resolved rule reason |

## Risks
- `HIGH`: Callers must pass the canonical calendar result. Missing context deliberately blocks writes.
- `MEDIUM`: Retroactive edits require `additionalContext.isRetroactiveEdit = true`; this must not be inferred silently.
- `LOW`: The table describes engine decisions, not final persistence behavior.

## Safe Next Action
Phase 06 should test each row through the V2 orchestration layer and compare against shadow output where V1 has equivalent behavior.

## Blockers
None.

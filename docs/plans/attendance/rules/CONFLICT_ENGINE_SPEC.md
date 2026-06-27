# CONFLICT ENGINE SPEC: Attendance V2

## Objective
Define deterministic conflict handling when more than one Attendance V2 rule matches the same canonical context.

## Evidence from Actual Repo Files
- Conflict resolver: `apps/frontend/src/features/attendance/v2/rules/conflictEngine.ts`
- Rule priorities/scopes: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.types.ts`
- Tests for specificity and duplicate clashes: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`

## Findings
Rules are ordered by:

1. `RulePriority.HARD_BLOCK`
2. `RulePriority.LOCK`
3. `RulePriority.MANUAL_OVERRIDE`
4. `RulePriority.SPECIFIC_POLICY`
5. `RulePriority.EVENT`
6. `RulePriority.DEFAULT`

Within the highest matching priority, specificity is:

| Scope | Score |
| --- | ---: |
| `student` | 5 |
| `class` | 4 |
| `status` | 3 |
| `date` | 2 |
| `school` | 1 |

Resolution rules:
- Empty matches return no effect.
- Any highest-priority blocking effect wins immediately.
- Same selected status outcomes are merged.
- Different status outcomes resolve by specificity.
- Same specificity clashes resolve by stable rule id and emit `RULE_CLASH_WARNING`.
- Rule effects that omit `selectedStatus` intentionally preserve the existing record status at the evaluator boundary.

## Risks
- `HIGH`: A high-priority custom blocking rule can prevent writes. Admin tooling must make this visible before production activation.
- `MEDIUM`: Same-priority same-specificity clashes are deterministic, but still indicate policy ambiguity.
- `LOW`: Conflict notes are strings today. A structured conflict object may be needed for future admin UI.

## Safe Next Action
Phase 06 should surface `conflictNotes` and `auditMetadata` in debug/shadow output, not in user-facing V1 UI.

## Blockers
None for Phase 06. No V1 or export dependency exists.

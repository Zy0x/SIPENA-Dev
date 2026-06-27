# RULE ENGINE SPEC: Attendance V2

## Objective
Define the isolated Attendance V2 Rule Engine that evaluates canonical murid, class, date, status, record, lock, and calendar context without importing V1, UI, export, or database code.

## Evidence from Actual Repo Files
- Implementation entrypoint: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.ts`
- Rule contract: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.types.ts`
- Default rule catalog: `apps/frontend/src/features/attendance/v2/rules/defaultRules.ts`
- Conflict resolution: `apps/frontend/src/features/attendance/v2/rules/conflictEngine.ts`
- Status registry: `apps/frontend/src/features/attendance/v2/rules/statusEngine.ts`
- Tests: `apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts`
- Calendar input contract: `apps/frontend/src/features/attendance/v2/calendar/calendarEngine.types.ts`
- Canonical input contract: `apps/frontend/src/features/attendance/canonical/canonical.types.ts`

## Findings
The engine is a pure function:

```ts
evaluateAttendanceRules(context: RuleEvaluationContext, customRules?: AttendanceRule[]): RuleEvaluationOutput
```

`RuleEvaluationContext` accepts:
- `student`, `classId`, and ISO `date`;
- proposed status and note;
- `calendarDay`, which may be `null` and is guarded by `rule-missing-calendar-context`;
- locks and existing canonical record;
- optional `additionalContext` for source and retroactive edit metadata.

Every rule has:
- stable `id` and readable `name`;
- `scope`: `school`, `class`, `student`, `date`, or `status`;
- numeric `priority`;
- deterministic `condition`;
- explainable `effect`;
- optional `conflictBehavior`: `priority`, `merge`, or `block`.

Every output includes:
- selected status or `null`;
- write permission;
- reason code;
- applied rule IDs;
- conflict notes;
- required audit metadata with matching rules, condition errors, validation issues, resolved priority, applied scopes, source, and retroactive marker.

Rule condition failures are captured in `auditMetadata.conditionErrors` and do not throw into UI/export.

## Risks
- `HIGH`: Custom rules can still encode policy mistakes. The conflict engine reports clashes, but a bad custom rule can still win if it has higher priority.
- `MEDIUM`: `RuleEffect.auditMetadata` is extensible. Consumers must not treat metadata as stable business data.
- `LOW`: Current Phase 05 engine is frontend-isolated. Backend parity is still a later phase concern.

## Safe Next Action
Phase 06 may call the rule engine only through the V2 orchestration layer and must continue to pass canonical calendar output into `calendarDay`. Do not call this engine from V1.

## Blockers
None for Phase 06. Backend parity and persistence integration remain outside Phase 05.

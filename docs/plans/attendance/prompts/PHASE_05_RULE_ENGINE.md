<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 05 — RULE ENGINE PROMPT

## PHASE
Build the V2 rule engine for attendance behavior in isolation.

## ROLE
You are a rules-engine architect for a real school attendance system. Your task is to build a clear, deterministic, explainable Rule Engine for Attendance V2.

## REQUIRED PRECONDITIONS
Read:
- `attendance/core-engines/RULE_ENGINE.md`
- `attendance/core-engines/STATUS_ENGINE.md`
- `attendance/core-engines/CONFLICT_ENGINE.md`
- `attendance/calendar/CALENDAR_ENGINE_SPEC.md`
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`
- `attendance/testing/EDGE_CASES.md`

## GOAL
Create a V2 Rule Engine that evaluates attendance rules based on canonical student/class/date/calendar context.

## HARD RULES
- No hardcoded holiday behavior inside rule evaluation; calendar engine provides day context.
- No direct V1 calls.
- No direct export calls.
- No direct UI logic.
- Rule outputs must be explainable with reason codes.
- Rules must be deterministic and testable.

## TASK
Implement or spec the Rule Engine in isolation.

Suggested files:
```txt
apps/frontend/src/features/attendance/v2/rules/ruleEngine.types.ts
apps/frontend/src/features/attendance/v2/rules/ruleEngine.ts
apps/frontend/src/features/attendance/v2/rules/statusEngine.ts
apps/frontend/src/features/attendance/v2/rules/conflictEngine.ts
apps/frontend/src/features/attendance/v2/rules/defaultRules.ts
apps/frontend/src/features/attendance/v2/rules/ruleEngine.test.ts
```

## REQUIRED RULE CONCEPTS
Define:
- rule id
- rule name
- rule scope: school/class/student/date/status
- priority
- condition
- effect
- conflict behavior
- reason code
- audit metadata
- enabled/disabled state

## STATUS REQUIREMENTS
Support current V1 statuses:
- `H` = Hadir
- `I` = Izin
- `S` = Sakit
- `A` = Alpha
- `D` = Dispensasi

Also design for future custom statuses with:
- label
- weight
- countsAsPresent
- countsAsAbsence
- exportCode
- color token
- behavior flags

## RULE OUTPUT
Every evaluation must produce:
- selected status or null
- whether write is allowed
- reason code
- applied rule ids
- conflict notes
- audit metadata

## REQUIRED SCENARIOS
Cover:
- normal school day default behavior
- non-effective day blocked from attendance
- locked date blocks mutation
- student-level override
- class-level event
- school-level closure
- retroactive note/status update
- invalid status rejection
- duplicate competing rules
- missing calendar context

## CONFLICT STRATEGY
Implement/document priority:
1. hard block rules
2. lock rules
3. explicit manual override
4. class/student-specific rule
5. event rule
6. default rule

Return conflict reports, not silent overrides.

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/rules/RULE_ENGINE_SPEC.md`
- `attendance/rules/STATUS_ENGINE_SPEC.md`
- `attendance/rules/CONFLICT_ENGINE_SPEC.md`
- `attendance/rules/DEFAULT_RULES.md`
- `attendance/rules/RULE_DECISION_TABLE.md`

## ACCEPTANCE CRITERIA
Phase 05 passes only if:
- Rule engine is isolated.
- Status engine supports V1 statuses.
- Future custom statuses are modeled safely.
- Conflicts are explainable.
- V1 remains untouched.
- Export remains untouched.
- Rule tests/specs exist.

## STOP CONDITIONS
Stop if:
- You need to insert new logic into V1.
- You need to change export output format.
- Rule behavior cannot be explained.
- Conflict priority is ambiguous.

## FINAL RESPONSE
Return:
- Rule/status/conflict files created.
- Default rules included.
- Test/spec coverage.
- Known limitations.
- Whether Phase 06 Core Attendance V2 can start.

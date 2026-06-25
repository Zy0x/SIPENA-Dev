<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 06 — CORE ATTENDANCE V2 PROMPT

## PHASE
Assemble Calendar + Rule + Status + Audit into a V2 engine. Still isolated/shadow-safe.

## ROLE
You are the lead engineer assembling Attendance V2 core. Your job is to connect the V2 engines into one deterministic service that produces canonical output.

## REQUIRED PRECONDITIONS
Read:
- `attendance/engines/V2_ARCHITECTURE.md`
- `attendance/core-engines/CALENDAR_ENGINE.md`
- `attendance/core-engines/RULE_ENGINE.md`
- `attendance/core-engines/STATUS_ENGINE.md`
- `attendance/core-engines/AUDIT_ENGINE.md`
- `attendance/calendar/CALENDAR_ENGINE_SPEC.md`
- `attendance/rules/RULE_ENGINE_SPEC.md`
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`

## GOAL
Create the isolated V2 attendance engine that can calculate attendance datasets, accept safe patches, produce canonical output, and run in shadow mode.

## HARD RULES
- V2 must not mutate V1 tables.
- V2 must not depend on V1 component internals.
- V2 must not directly call export.
- V2 must output canonical model only.
- V2 writes must be disabled unless explicitly running in a safe V2 storage layer.
- Shadow mode must never affect users.

## TASK
Implement V2 core orchestration.

Suggested files:
```txt
apps/frontend/src/features/attendance/v2/attendanceV2.types.ts
apps/frontend/src/features/attendance/v2/attendanceV2.engine.ts
apps/frontend/src/features/attendance/v2/attendanceV2.service.ts
apps/frontend/src/features/attendance/v2/attendanceV2.audit.ts
apps/frontend/src/features/attendance/v2/attendanceV2.validation.ts
apps/frontend/src/features/attendance/v2/attendanceV2.shadow.ts
apps/frontend/src/features/attendance/v2/attendanceV2.test.ts
```

Backend equivalent later:
```txt
apps/backend/src/modules/attendance/engines/v2/*
```

## REQUIRED ENGINE OPERATIONS
Expose safe operations:
- build dataset for class/date range
- get daily attendance
- get monthly attendance
- get yearly attendance
- apply attendance patch
- bulk apply attendance patch
- update note
- validate mutation
- compute summary
- produce audit event
- compare with V1 canonical result in shadow mode

## MUTATION SAFETY
Every write path must check:
- runtime mode
- lock state
- effective day
- valid status
- student belongs to class
- duplicate record risk
- conflict result
- audit payload completeness

## OUTPUT REQUIREMENTS
V2 must return:
- canonical dataset
- validation issues
- audit events
- rule explanation
- shadow comparison result when applicable

## SHADOW MODE REQUIREMENTS
When shadow mode is active:
- V1 remains source of truth.
- V2 computes same dataset independently.
- Compare canonical outputs.
- Record mismatch report.
- Do not show mismatch to normal users unless debug/admin flag is active.

## SUMMARY REQUIREMENTS
Implement summaries from canonical model:
- daily status breakdown
- monthly per-student recap
- monthly class recap
- yearly data for export
- percentage rows where current export requires them

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/v2/V2_ENGINE_IMPLEMENTATION.md`
- `attendance/v2/V2_MUTATION_SAFETY.md`
- `attendance/v2/V2_SHADOW_MODE.md`
- `attendance/v2/V2_SUMMARY_SPEC.md`
- `attendance/v2/V2_AUDIT_SPEC.md`

## ACCEPTANCE CRITERIA
Phase 06 passes only if:
- V2 core is isolated.
- V2 outputs canonical model.
- Mutations are guarded.
- Shadow mode exists or is fully specified.
- No V1 code changed.
- Export remains unchanged.
- Tests/specs cover core operations.

## STOP CONDITIONS
Stop if:
- You need to modify V1 internals.
- V2 tries to become default engine.
- V2 writes to V1 tables.
- Export must change to consume V2 directly.

## FINAL RESPONSE
Return:
- V2 core files created.
- Operations implemented.
- Safety checks implemented.
- Test results/limitations.
- Whether Phase 07 Backend can start.

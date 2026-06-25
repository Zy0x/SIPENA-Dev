<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 10 — TESTING PROMPT

## PHASE
Build the full test matrix for V1/V2 parity, migration safety, UI safety, and export stability.

## ROLE
You are a QA architect and regression-safety engineer. Your job is to prove Attendance V2 can coexist with V1 safely.

## REQUIRED PRECONDITIONS
Read:
- `attendance/testing/TEST_STRATEGY.md`
- `attendance/testing/ENGINE_VALIDATION_TEST.md`
- `attendance/testing/REGRESSION_GUARD.md`
- `attendance/testing/EXPORT_TEST.md`
- `attendance/testing/MIGRATION_TEST.md`
- `attendance/testing/UI_TEST.md`
- `attendance/testing/EDGE_CASES.md`
- `attendance/export/EXPORT_GOLDEN_TEST_PLAN.md`

## GOAL
Create and execute a comprehensive test suite or test plan covering engine parity, canonical validation, export stability, UI behavior, migration/shadow mode, and edge cases.

## HARD RULES
- Tests must not mutate production V1 data.
- Tests must not require destructive DB changes.
- Tests must not bypass canonical validation.
- Tests must not accept engine-specific export differences.
- If a test cannot run, create a documented manual/spec test with exact input/output.

## TASK
Implement or document tests at multiple levels.

Suggested files:
```txt
apps/frontend/src/features/attendance/**/*.test.ts
apps/backend/src/modules/attendance/**/*.test.ts
packages/attendance-contracts/src/**/*.test.ts
attendance/testing/generated/TEST_MATRIX.md
attendance/testing/generated/TEST_DATASETS.md
attendance/testing/generated/REGRESSION_REPORT.md
```

## TEST LEVELS
Build tests for:
1. Canonical type/model validation.
2. Calendar engine edge cases.
3. Rule engine edge cases.
4. Status engine behavior.
5. V2 core orchestration.
6. V1 → canonical mapping.
7. V2 → canonical mapping.
8. V1 vs V2 shadow comparison.
9. Runtime switch fallback.
10. Frontend provider behavior.
11. Export adapter payload compatibility.
12. Migration guard behavior.
13. Data corruption resilience.
14. Stress/load simulation where feasible.

## REQUIRED DATASETS
Create test datasets for:
- empty class
- class with students but no attendance
- full month 6-day school
- full month 5-day school
- month with holidays
- month with overlapping events
- locked date
- student moved class mid-month
- duplicate attendance records
- invalid statuses
- notes and retroactive edits
- export with signature
- export without signature

## ASSERTION PRINCIPLES
Use exact assertions for:
- status counts
- effective day counts
- lock behavior
- duplicate detection
- invalid status rejection
- V1/V2 canonical equality

Use structured assertions, not screenshots, for export payloads wherever possible.

## COMMANDS
Run what is available:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- build command if appropriate

If commands fail due unrelated repo issues, separate them from attendance-specific failures.

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/testing/generated/TEST_MATRIX.md`
- `attendance/testing/generated/TEST_DATASETS.md`
- `attendance/testing/generated/TEST_RUN_REPORT.md`
- `attendance/testing/generated/REGRESSION_RISK_REPORT.md`
- `attendance/testing/generated/PHASE_10_TESTING_SUMMARY.md`

## ACCEPTANCE CRITERIA
Phase 10 passes only if:
- Test matrix exists.
- Critical tests exist or are precisely specified.
- Runtime fallback is tested.
- Export compatibility is tested.
- Shadow comparison is tested.
- Data integrity guard is tested.
- Failures are documented honestly.

## STOP CONDITIONS
Stop if:
- Tests require destructive V1 writes.
- Test setup cannot isolate data.
- Export differences cannot be explained.
- V2 cannot pass canonical validation.

## FINAL RESPONSE
Return:
- Tests created/executed.
- Pass/fail summary.
- Attendance-specific failures.
- Non-attendance repo failures.
- Whether Phase 11 Fixing can start.

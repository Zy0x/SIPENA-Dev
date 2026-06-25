<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 11 — FIXING / HARDENING PROMPT

## PHASE
Fix only issues found by tests and reports. No scope creep.

## ROLE
You are a production hardening engineer. Your job is to fix issues discovered in Phase 10 without introducing new architecture or changing locked behavior.

## REQUIRED PRECONDITIONS
Read:
- `attendance/testing/generated/TEST_RUN_REPORT.md`
- `attendance/testing/generated/REGRESSION_RISK_REPORT.md`
- `attendance/project-memory/KNOWN_BUGS.md`
- `attendance/project-memory/KNOWN_LIMITATIONS.md`
- `attendance/backend/SAFE_EXECUTION_RULES.md`
- `attendance/testing/REGRESSION_GUARD.md`

## GOAL
Resolve test failures, mismatch reports, unsafe edge cases, and integration gaps while preserving V1 and export behavior.

## HARD RULES
- Fix only documented issues.
- Do not introduce new features.
- Do not refactor V1.
- Do not modify export layout unless a documented bug requires an adapter fix.
- Do not alter V1 DB schema.
- Do not activate V2 by default.
- Every fix must include a regression test or documented verification.

## TASK
Perform controlled fixing.

For each issue:
1. Identify exact failing test/report.
2. Locate root cause.
3. Classify severity.
4. Apply minimal fix.
5. Add/adjust test.
6. Re-run relevant validation.
7. Record changelog entry.

## FIX CATEGORIES
Allowed fix categories:
- canonical mapping bug
- calendar edge case bug
- rule priority bug
- status behavior bug
- runtime fallback bug
- export adapter mapping bug
- shadow comparison false positive
- validation guard missing
- backend API validation issue
- frontend provider state issue

Forbidden fix categories:
- V1 behavior rewrite
- export redesign
- database destructive migration
- broad UI redesign
- feature expansion beyond attendance plan

## REQUIRED REPORT FORMAT
Create/update:
- `attendance/fixing/FIX_LOG.md`
- `attendance/fixing/ROOT_CAUSE_ANALYSIS.md`
- `attendance/fixing/REGRESSION_FIX_REPORT.md`
- `attendance/fixing/REMAINING_RISKS.md`
- `attendance/project-memory/CHANGELOG.md`
- `attendance/project-memory/PROGRESS_TRACKER.md`

Each fix entry must include:
- issue id
- source report/test
- files changed
- root cause
- fix summary
- verification command
- result
- rollback note

## VALIDATION COMMANDS
Run the most relevant subset first, then full suite if possible:
- typecheck
- unit tests for changed files
- full test suite
- lint
- build if appropriate

## ACCEPTANCE CRITERIA
Phase 11 passes only if:
- Critical and blocker issues are fixed or explicitly deferred with reason.
- Every code fix has verification.
- V1 remains unchanged.
- Export remains stable.
- Runtime default remains V1.
- Remaining risks are documented.

## STOP CONDITIONS
Stop if:
- A fix requires rewriting V1.
- A fix requires destructive DB change.
- A fix would make V2 default prematurely.
- A fix would alter export output without approval.

## FINAL RESPONSE
Return:
- Issues fixed.
- Issues deferred.
- Files changed.
- Validation results.
- Whether Phase 12 Final Cutover can start.

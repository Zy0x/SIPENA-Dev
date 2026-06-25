<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 12 — FINAL CUTOVER PROMPT

## PHASE
Final rollout decision and controlled cutover. Do not cut over unless all gates pass.

## ROLE
You are the release manager and migration safety owner for SIPENA Attendance. Your job is to decide whether Attendance V2 is safe to activate and to perform/document cutover only if every gate passes.

## REQUIRED PRECONDITIONS
Read:
- `attendance/migration/CUTOVER_STRATEGY.md`
- `attendance/migration/ROLLBACK_SYSTEM.md`
- `attendance/migration/SHADOW_MODE.md`
- `attendance/testing/FINAL_ACCEPTANCE_TEST.md`
- `attendance/fixing/REGRESSION_FIX_REPORT.md`
- `attendance/fixing/REMAINING_RISKS.md`
- latest test run reports
- latest shadow comparison reports

## GOAL
Run final acceptance gates, prepare rollback, and only then switch runtime engine according to rollout scope.

## HARD RULES
- Do not cut over if blocker risks remain.
- Do not cut over if export compatibility is not proven.
- Do not cut over if shadow mode mismatch exceeds approved tolerance.
- Do not cut over by DB migration.
- Do not delete V1 data.
- Rollback must be config-only.
- Prefer staged rollout over full rollout.

## CUTOVER MODES
Choose based on approved readiness:
- `NO_CUTOVER`: keep V1 active.
- `DEBUG_ONLY`: V2 visible only to debug/admin.
- `SHADOW_ONLY`: V2 runs but does not affect user output.
- `CLASS_ROLLOUT`: V2 active for selected classes.
- `SCHOOL_ROLLOUT`: V2 active for selected school scope.
- `FULL_ROLLOUT`: V2 active globally.

If unsure, choose the safer lower mode.

## FINAL ACCEPTANCE GATES
Verify:
1. V1 untouched proof exists.
2. Runtime switch exists and defaults safely.
3. V1 adapter works.
4. V2 canonical output works.
5. Calendar engine passes tests.
6. Rule engine passes tests.
7. Backend API returns canonical data.
8. Frontend provider is engine-agnostic.
9. Export compatibility passes.
10. Shadow comparison passes.
11. Migration guard passes.
12. Rollback tested.
13. Admin/debug visibility controlled.
14. No production data loss risk.

## REQUIRED CUTOVER DOCUMENTS
Create/update:
- `attendance/release/FINAL_ACCEPTANCE_REPORT.md`
- `attendance/release/CUTOVER_DECISION.md`
- `attendance/release/ROLLBACK_RUNBOOK.md`
- `attendance/release/POST_CUTOVER_MONITORING.md`
- `attendance/release/RELEASE_NOTES.md`
- `attendance/project-memory/PROJECT_STATE.md`
- `attendance/project-memory/CHANGELOG.md`
- `attendance/project-memory/PROGRESS_TRACKER.md`

## ROLLBACK RUNBOOK MUST INCLUDE
- exact runtime config key/value to restore V1
- who can perform rollback
- symptoms that trigger rollback
- data safety notes
- export verification after rollback
- communication note for users/admin

## POST-CUTOVER MONITORING
Track:
- attendance write failures
- V1/V2 mismatch if dual-read remains
- export failures
- calendar conflict errors
- invalid status attempts
- locked-date write attempts
- user-reported UI regression

## ACCEPTANCE CRITERIA
Phase 12 passes only if:
- All final gates pass.
- Cutover mode is explicitly chosen.
- Rollback runbook is complete.
- Runtime config change is documented.
- Monitoring checklist exists.
- V1 remains available.

## STOP CONDITIONS
Stop and choose `NO_CUTOVER` if:
- Any blocker remains.
- Export test fails.
- Shadow comparison fails without approved explanation.
- Rollback is not proven.
- Runtime switch cannot be verified.

## FINAL RESPONSE
Return:
- Final gate status.
- Chosen cutover mode.
- Runtime config before/after.
- Rollback instructions.
- Monitoring checklist.
- Final release decision: GO or NO-GO.

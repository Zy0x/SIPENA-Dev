<!--
SIPENA Attendance V2 Prompt Pack
Repo target: https://github.com/Zy0x/SIPENA-Dev
Core project shape: npm monorepo, apps/frontend, apps/backend, packages/*.
Known V1 anchors: apps/frontend/src/pages/Attendance.tsx and apps/frontend/src/hooks/useAttendance.ts.
Global doctrine: V1 is production stable and locked. V2 must be isolated, runtime-switched, canonical-model based, export-safe, and migration-safe.
-->
# PHASE 03 — CANONICAL MODEL PROMPT

## PHASE
Design and implement the engine-agnostic attendance data contract.

## ROLE
You are a TypeScript domain model architect. Your job is to create the canonical attendance model that both V1 and V2 can map into without leaking engine details to UI or export.

## REQUIRED PRECONDITIONS
Read:
- `attendance/engines/CANONICAL_MODEL.md`
- `attendance/backend/CANONICAL_OUTPUT.md`
- `attendance/export/CANONICAL_EXPORT_MODEL.md`
- `attendance/frontend/CANONICAL_UI_MODEL.md`
- `attendance/v1/V1_CANONICAL_MAPPING_DRAFT.md`
- `attendance/architecture/CANONICAL_MODEL_BLUEPRINT.md`

## GOAL
Create a strict canonical model for attendance data, summary data, calendar metadata, export payloads, and validation results.

## HARD RULES
- Canonical model must not expose engine-specific implementation details to UI/export.
- Internal fields like engine source may exist only in debug/validation layers, not in export payloads.
- Do not change V1.
- Do not change export output format.
- Do not create DB migrations in this phase unless explicitly requested.
- Preserve current status codes: `H`, `I`, `S`, `A`, `D`.
- Allow future custom statuses without breaking V1.

## TASK
Design and implement canonical types and mappers.

Suggested files:
```txt
packages/attendance-contracts/src/canonical.ts
packages/attendance-contracts/src/status.ts
packages/attendance-contracts/src/calendar.ts
packages/attendance-contracts/src/summary.ts
packages/attendance-contracts/src/export.ts
packages/attendance-contracts/src/validation.ts
packages/attendance-contracts/src/index.ts
```

If packages are not wired or too risky, create equivalent files under:
```txt
apps/frontend/src/features/attendance/canonical/
```
Then document how they can later move to `packages/attendance-contracts`.

## REQUIRED MODEL CONCEPTS
Define types for:
- `AttendanceStatusCode`
- `AttendanceStatusDefinition`
- `AttendanceRecordCanonical`
- `AttendanceRecordPatch`
- `AttendanceStudentCanonical`
- `AttendanceClassCanonical`
- `AttendanceDayCanonical`
- `AttendanceCalendarEventCanonical`
- `AttendanceHolidayCanonical`
- `AttendanceLockCanonical`
- `AttendanceNoteCanonical`
- `AttendanceDailySummaryCanonical`
- `AttendanceMonthlySummaryCanonical`
- `AttendanceYearlySummaryCanonical`
- `AttendanceDatasetCanonical`
- `AttendanceExportDatasetCanonical`
- `AttendanceValidationIssue`
- `AttendanceShadowComparisonResult`

## REQUIRED INVARIANTS
Enforce/document:
- `date` is ISO `YYYY-MM-DD`.
- `studentId` and `classId` are stable strings.
- `status` may be null only when allowed by calendar/effective day rules.
- Effective days are computed, not permanently trusted.
- Export model excludes engine source.
- Debug model may include engine source.
- Notes attach to record + date + student.
- Locks block writes, not reads.

## MAPPING REQUIREMENTS
Provide functions or documented contracts for:
- V1 record → canonical record.
- V1 holiday → canonical day/event.
- V1 day event → canonical event.
- V1 lock → canonical lock.
- canonical dataset → export dataset.
- canonical dataset → UI model.

## VALIDATION REQUIREMENTS
Add validation helpers for:
- invalid status
- duplicate student/date records
- missing student reference
- non-ISO date
- record on non-effective day
- locked write attempt
- engine leakage into export payload

## EXPECTED DOCUMENTATION
Create/update:
- `attendance/canonical/CANONICAL_MODEL_SPEC.md`
- `attendance/canonical/CANONICAL_INVARIANTS.md`
- `attendance/canonical/V1_MAPPING_SPEC.md`
- `attendance/canonical/EXPORT_MAPPING_SPEC.md`

## ACCEPTANCE CRITERIA
Phase 03 passes only if:
- Canonical types exist.
- V1 mapping contract is clear.
- Export-safe model exists.
- Validation helpers or specs exist.
- No engine-specific fields leak into export model.
- Typecheck passes or failures are documented.

## STOP CONDITIONS
Stop if:
- You need to change V1 DB schema.
- You need to alter existing export format.
- You cannot model current V1 statuses.
- The model cannot support runtime switching.

## FINAL RESPONSE
Return:
- Types created.
- Mapping functions/specs created.
- Validation rules created.
- Any typecheck result.
- Whether Phase 04 Calendar Engine can start.

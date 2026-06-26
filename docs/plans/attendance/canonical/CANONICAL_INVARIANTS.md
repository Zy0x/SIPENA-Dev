# CANONICAL INVARIANTS: Attendance V2

## Objective

Document the rules that every canonical attendance dataset must satisfy before it is used by UI, export, import, shadow comparison, or future V2 engines.

## Evidence from actual repo files

- Runtime default remains V1 in `apps/frontend/src/features/attendance/runtime/`.
- V1 adapter helpers produce canonical records in `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.ts`.
- Validation helpers are implemented in `apps/frontend/src/features/attendance/canonical/canonical.validation.ts`.

## Findings

### Required invariants

1. `date` must be ISO `YYYY-MM-DD`.
2. `month` must be ISO `YYYY-MM`.
3. `studentId` and `classId` are stable strings, never display names.
4. A record must reference a known murid and the current class context when a dataset is validated.
5. `status` may be a V1 status, a derived display status, or an explicitly configured custom status.
6. Empty or day-off display states are represented as `-` and `L`, not as V1 write statuses.
7. Effective days are computed into `AttendanceDayCanonical`; records on non-effective days are warnings unless policy later makes them blockers.
8. Locks block writes, not reads.
9. Notes attach to record, murid, class, and date.
10. Export payloads must not contain `debug`, `metadata`, `engine`, `sourceEngine`, or source table fields.

### Validation issue levels

- `error`: invalid data or unsafe write.
- `warning`: suspicious but readable data, such as a record on a non-effective day.
- `info`: allowed diagnostic state, such as debug metadata before projection.
- `blocker`: reserved for future import or migration gates that must stop execution.

### Current validation coverage

- `NON_ISO_DATE`
- `NON_ISO_MONTH`
- `INVALID_STATUS_CODE`
- `MISSING_STUDENT_REFERENCE`
- `MISSING_CLASS_REFERENCE`
- `RECORD_ON_NON_EFFECTIVE_DAY`
- `LOCKED_WRITE_ATTEMPT`
- `DUPLICATE_STUDENT_DATE_RECORD`
- `DEBUG_METADATA_PRESENT`
- `ENGINE_LEAKAGE_IN_EXPORT_PAYLOAD`

## Risks

- `HIGH`: Skipping validation before export can hide invalid custom status values until print/export time.
- `HIGH`: Treating locks as read blockers would break existing V1 viewing behavior.
- `MEDIUM`: Non-effective-day records are warnings now; Phase 04 must decide if any calendar conflict becomes a hard block.

## Safe next action

Calendar work should produce `AttendanceDayCanonical[]` and feed it into `validateCanonicalDataset` instead of storing permanent effective-day truth in records.

## Blockers

None.

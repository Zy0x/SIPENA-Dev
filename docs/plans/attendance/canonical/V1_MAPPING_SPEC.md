# V1 MAPPING SPEC: Attendance V2

## Objective

Define how locked V1 Presensi data maps into the canonical model without rewriting V1 page logic, hook logic, import logic, export logic, or Supabase schema.

## Evidence from actual repo files

- V1 source types are imported from `apps/frontend/src/hooks/useAttendance.ts` through `apps/frontend/src/features/attendance/v1/attendanceV1.types.ts`.
- V1 wrapper and seam files are under `apps/frontend/src/features/attendance/v1/`.
- Phase 03 generic mappers are under `apps/frontend/src/features/attendance/canonical/canonical.mappers.ts`.
- V1 preservation tests are in `apps/frontend/src/features/attendance/v1/attendanceV1.canonical.test.ts`.

## Findings

### V1 record to canonical record

| V1 field | Canonical field | Rule |
| --- | --- | --- |
| `id` | `id` | If missing, derive from `class_id:student_id:date`. |
| `student_id` | `studentId` | Stable murid ID. |
| `class_id` | `classId` | Stable class ID. |
| `date` | `date` | Must validate as `YYYY-MM-DD`. |
| `status` | `status` | `H/I/S/A/D` pass through; null/empty becomes `-` in the V1 seam helper. |
| `note` | `note` | Null-safe. |
| V1 source context | `debug` | Allowed only before UI/export projection. |

### V1 calendar metadata

| V1 concept | Canonical concept |
| --- | --- |
| Holiday record | `AttendanceHolidayCanonical` |
| Day event record | `AttendanceCalendarEventCanonical` |
| Attendance lock | `AttendanceLockCanonical` |

Lock months are normalized to `YYYY-MM` because V1 data may provide either `YYYY-MM` or a month-start date.

### Dataset seam

`mapV1SeamInputToCanonicalDataset` returns a read-only canonical dataset with:

- class ID
- month
- murid list
- records
- empty `days` until the calendar engine computes effective days
- holidays
- day events
- locks

### Reverse write seam

`mapCanonicalToV1Record` maps `L` and `-` to `null`, so derived display states cannot be written as V1 statuses.

## Risks

- `HIGH`: V1 seam must remain read-only until Phase 04+ explicitly wires runtime consumers.
- `HIGH`: Directly editing `Attendance.tsx` or `useAttendance.ts` would violate the locked V1 rule.
- `MEDIUM`: V1 timestamp availability is inconsistent in some seam helpers; null timestamps are allowed in canonical records.

## Safe next action

Phase 04 may compute `days` from V1 holidays, day events, and month settings, then validate the dataset. It should not activate V2 rendering.

## Blockers

None.

# CANONICAL MODEL SPEC: Attendance V2

## Objective

Define the engine-agnostic attendance contract used by V1 adapters, future V2 engines, UI projections, validation, and export preparation. The model must preserve current V1 behavior while preventing engine-specific implementation details from leaking into UI/export payloads.

## Evidence from actual repo files

- Runtime and V1 seam live in `apps/frontend/src/features/attendance/runtime/` and `apps/frontend/src/features/attendance/v1/`.
- Canonical code is implemented in `apps/frontend/src/features/attendance/canonical/` because `packages/attendance-contracts` is not wired in this repo yet.
- V1 status values come from `apps/frontend/src/hooks/useAttendance.ts` through `apps/frontend/src/features/attendance/v1/attendanceV1.types.ts`.
- Phase 03 implementation files:
  - `canonical.types.ts`
  - `canonical.mappers.ts`
  - `canonical.validation.ts`
  - `canonical.test.ts`

## Findings

### Core status contract

`AttendanceStatusCode` preserves V1 codes and allows future custom statuses through validation:

- `H`: hadir
- `I`: izin
- `S`: sakit
- `A`: alfa
- `D`: dispensasi
- `L`: derived holiday/day-off display state
- `-`: empty display state
- future custom string codes are type-compatible but must be explicitly allowed by validation options.

### Canonical entities

The canonical model defines these public entities:

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
- `AttendanceUiModelCanonical`
- `AttendanceValidationIssue`
- `AttendanceShadowComparisonResult`

### Debug isolation

`AttendanceRecordCanonical` and `AttendanceDatasetCanonical` may carry optional `debug` metadata for shadow and validation diagnostics. UI/export projections must not expose it.

### Export-safe projection

`AttendanceExportDatasetCanonical` intentionally contains only class label, month label, murid rows, attendance records, totals, and notes. It does not include engine source, source table, raw database IDs, or debug metadata.

## Risks

- `HIGH`: Future code can accidentally pass canonical objects directly into export code instead of using `mapCanonicalDatasetToExport`.
- `MEDIUM`: Custom status codes are type-compatible by design, so validation must always run before UI/export.
- `LOW`: Canonical currently lives under frontend; it should move to `packages/attendance-contracts` after package wiring is approved.

## Safe next action

Phase 04 can build calendar/effective-day behavior on top of `AttendanceDayCanonical` and validation helpers without editing V1 internals.

## Blockers

None for Phase 04. Moving canonical to a shared package is intentionally deferred.

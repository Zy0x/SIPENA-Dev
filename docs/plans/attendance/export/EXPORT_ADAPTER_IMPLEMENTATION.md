# Export Adapter Implementation

## Objective
Document the Phase 09 Presensi export adapter that lets canonical attendance data feed the existing legacy export studio without changing PDF, Excel, PNG, or ZIP output formatting.

## Evidence from actual repo files
- Adapter public entry: `apps/frontend/src/features/attendance/export/attendanceExport.adapter.ts`.
- Legacy bridge: `apps/frontend/src/features/attendance/export/attendanceExportLegacyBridge.ts`.
- Bridge types: `apps/frontend/src/features/attendance/export/attendanceExportCanonical.types.ts`.
- Bridge validation: `apps/frontend/src/features/attendance/export/attendanceExport.validation.ts`.
- Golden structured tests: `apps/frontend/src/features/attendance/export/attendanceExportGolden.test.ts`.
- Legacy preview target: `apps/frontend/src/components/export/AttendanceExportPreviewV2.tsx`.
- Legacy print target: `apps/frontend/src/lib/attendancePrintLayout.ts`.

## Findings
- `buildAttendanceLegacyExportPayloadFromCanonical()` maps canonical data into `AttendanceExportPreviewDataV2`.
- `buildAttendancePrintDatasetFromLegacyPayload()` mirrors the existing preview-to-print dataset conversion without importing renderer internals.
- `createAttendanceExportLegacyBridge()` validates the bridge before returning a payload to callers.
- The adapter preserves:
  - class identity through explicit `className` setting;
  - murid order from canonical `students`;
  - day column order by ISO date;
  - status symbols `H`, `I`, `S`, `A`, `D`, `L`, and `-`;
  - event and holiday flags per day/cell;
  - notes in the legacy `Nama (d MMM): catatan` shape;
  - summary counts and configurable `Jumlah` behavior;
  - structured `holidayItems` and `eventItems` for print layout grouping.
- The adapter does not modify `AttendanceExportPreviewV2`, `attendancePrintLayout`, `attendancePdfExport`, Excel export code, or PNG export code.

## Risks
- `MEDIUM`: The adapter is not yet wired into V1 export UI; this phase provides the safe bridge and tests first.
- `MEDIUM`: Excel export remains V1 page-owned until a later phase routes it through this bridge.
- `LOW`: Default month/export time labels are deterministic enough for runtime use, but parity-sensitive tests should pass explicit labels.

## Safe next action
- Add a V1 read-only canonical export projection and compare it against the current `attendancePreviewStudioData` before wiring the adapter into the live studio.
- Keep all binary renderers unchanged until structured parity passes.

## Blockers
- None for Phase 10 testing.
- Live export cutover remains blocked until V1 parity comparison is implemented.

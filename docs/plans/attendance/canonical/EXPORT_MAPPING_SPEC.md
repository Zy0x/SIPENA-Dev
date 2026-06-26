# EXPORT MAPPING SPEC: Attendance V2

## Objective

Document the export-safe projection from canonical attendance data to stable export payloads without changing the existing V1 export format.

## Evidence from actual repo files

- Existing export code remains outside Phase 03 and is not modified.
- Canonical export projection is implemented by `mapCanonicalDatasetToExport` in `apps/frontend/src/features/attendance/canonical/canonical.mappers.ts`.
- Export leakage guard is implemented by `validateExportPayloadHasNoEngineLeakage` in `canonical.validation.ts`.

## Findings

### Export payload shape

`AttendanceExportDatasetCanonical` includes:

- `className`
- `monthLabel`
- ordered murid rows
- per-murid records with `date` and `status`
- totals for `H`, `S`, `I`, `A`, `D`, and absence `total`
- note strings formatted as `Nama: catatan`

### Explicit exclusions

The export payload must not include:

- engine type
- runtime mode
- source table
- raw database source metadata
- debug metadata
- validation-only metadata

### Totals behavior

- `H` is counted as present.
- `S`, `I`, `A`, and `D` are counted individually and also contribute to absence `total`.
- `L` and `-` are display/derived states and do not increment V1 attendance totals.

### Export stability rule

Existing V1 PDF/Excel/PNG export code must continue to receive its existing V1-shaped data until a later phase explicitly routes export through canonical data. Phase 03 only creates the export-safe contract and tests.

## Risks

- `HIGH`: If future code bypasses the export mapper and sends canonical records with `debug`, engine details can leak into export payloads.
- `MEDIUM`: Custom statuses need an agreed export behavior before they become writable in production.
- `LOW`: Current export projection is minimal and intentionally does not replace existing print layout logic yet.

## Safe next action

When export integration begins, add a guard that runs `validateExportPayloadHasNoEngineLeakage` before any generated PDF/Excel/PNG payload is handed to layout builders.

## Blockers

None for Phase 04. Export integration remains a later phase.

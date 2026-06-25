# EXPORT MAPPING SPECIFICATION: Attendance V2

Specifications for formatting canonical datasets into export payloads consumed by PDF/Excel/PNG layout builders.

## Rules

- **Engine Isolation**:
  - The export mapper `mapCanonicalDatasetToExport` strips record metadata and deletes references to internal engines.
  - Sizing calculations and margins consume only the standard output array.
  
- **Layout Calculations**:
  - Exposes flat structures mapping dates, status totals (H, S, I, A, D), and note strings (`name: note`).
  - Output format is compatible with `attendancePrintLayout.ts` and `attendancePdfExport.ts` layout algorithms.

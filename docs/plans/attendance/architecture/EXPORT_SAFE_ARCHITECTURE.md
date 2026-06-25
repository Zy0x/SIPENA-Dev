# EXPORT SAFE ARCHITECTURE: Attendance V2

This document defines the export isolation boundary and adapter contracts to guarantee that the PDF, Excel, and PNG export engines generate identical outputs regardless of whether V1 or V2 is active.

---

## 1. Export Isolation Boundary

The export pipeline is completely separated from the active attendance engine logic:

```txt
   +------------------+
   |  Active Engine   |
   |   (V1 or V2)     |
   +------------------+
            |
            v  (Returns Canonical models)
   +------------------+
   | Canonical Model  |
   +------------------+
            |
            v  (Export Adapter wraps records)
   +------------------+
   |  Export Adapter  | --> Resolves columns and cell coordinates
   +------------------+
            |
            v  (Feeds consistent structures)
   +------------------+
   |  Unified Export  | --> Generates PDF, Excel, PNG files
   |  Studio Engine   |
   +------------------+
```

---

## 2. Adapter Specifications

The `CanonicalExportAdapter` maps the list of `CanonicalRecord` and calendar settings to `AttendancePrintDataset`:

```typescript
export function transformCanonicalToPrintDataset(
  records: CanonicalRecord[],
  holidays: CanonicalHoliday[],
  dayEvents: CanonicalDayEvent[],
  className: string,
  monthLabel: string,
  workDayFormat: "5days" | "6days"
): AttendancePrintDataset {
  // Calculates columns, coordinates, stats and signature placements in an identical manner
  // returning the expected flat print dataset structure used by V1 export engine.
}
```

---

## 3. Backward Compatibility
- **Format Stability**: The export layouts in `attendancePdfExport.ts` and `attendancePrintLayout.ts` will not be altered.
- **Verification Gate**: Any V2 modifications will be tested against regression logs of PDF vectors to ensure that output files remain identical byte-for-byte in layout metrics.

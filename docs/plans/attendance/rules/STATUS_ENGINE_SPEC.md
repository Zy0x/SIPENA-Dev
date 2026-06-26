# STATUS ENGINE SPECIFICATION: Attendance V2

Dynamic status manager for predefined V1 codes and custom school status extensions.

## Core Schema
Every status (both default and custom) must conform to:
```typescript
interface AttendanceStatusDefinitionV2 {
  code: string;
  label: string;
  weight: number; // e.g., 1.0 = Present, 0.0 = Absent
  countsAsPresent: boolean;
  countsAsAbsence: boolean;
  exportCode: string;
  colorToken: string;
  behaviorFlags: string[]; // e.g., ['REQUIRES_NOTE', 'RETROACTIVE_ONLY']
}
```

## Predefined Defaults
- **`H`**: Hadir (weight: 1.0, countsAsPresent: true, countsAsAbsence: false)
- **`I`**: Izin (weight: 0.0, countsAsPresent: false, countsAsAbsence: true, flag: REQUIRES_NOTE)
- **`S`**: Sakit (weight: 0.0, countsAsPresent: false, countsAsAbsence: true, flag: REQUIRES_NOTE)
- **`A`**: Alpha (weight: 0.0, countsAsPresent: false, countsAsAbsence: true)
- **`D`**: Dispensasi (weight: 1.0, countsAsPresent: true, countsAsAbsence: false, flag: REQUIRES_NOTE)
- **`L`**: Libur (weight: 0.0, countsAsPresent: false, countsAsAbsence: false, flag: READ_ONLY)
- **`-`**: Belum Diisi (weight: 0.0, countsAsPresent: false, countsAsAbsence: false)

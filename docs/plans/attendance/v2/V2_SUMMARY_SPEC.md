# V2 Summary Computation Spec

## Purpose

V2 provides three canonical summary functions that aggregate attendance records without depending on V1 aggregation logic. These functions live in `attendanceV2.engine.ts`.

---

## Daily Summary

```ts
computeDailySummary(
  dataset: AttendanceDatasetCanonical,
  date: string
): AttendanceDailySummaryCanonical
```

### Logic
- Filters records for the given `date`.
- Counts statuses across students in `dataset.students`.
- `presentCount` = records where status is `H` or `D` (Dispensasi).
- `absentCount` = records where status is `A` (Alpha).
- `sickCount` = records where status is `S`.
- `permissionCount` = records where status is `I`.
- `lateCount` = records where status is `L`.
- `totalStudents` = total students in dataset.

### Output
```ts
interface AttendanceDailySummaryCanonical {
  date: string;
  classId: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  sickCount: number;
  permissionCount: number;
  lateCount: number;
}
```

---

## Monthly Summary

```ts
computeMonthlySummary(
  dataset: AttendanceDatasetCanonical,
  studentId: string
): AttendanceMonthlySummaryCanonical
```

### Logic
- Filters all records for the given `studentId`.
- `totalDays` = total records (one per school day with a record).
- `presentCount` = records with status `H`.
- `sickCount` = records with status `S`.
- `permissionCount` = records with status `I`.
- `absentCount` = records with status `A`.
- `lateCount` = records with status `L`.

---

## Yearly Summary

```ts
computeYearlySummary(
  datasets: AttendanceDatasetCanonical[],
  studentId: string
): AttendanceYearlySummaryCanonical
```

### Logic
- Aggregates all monthly present counts across all datasets (months).
- `yearlyPresentCount` = sum of presentCount per month.
- `totalDays` = sum of totalDays.
- `percentage` = `Math.round((yearlyPresentCount / totalDays) * 100)` or 0 if totalDays = 0.

---

## Principles

- No side effects. All functions are pure, deterministic.
- No V1 table access. Input is canonical-shaped datasets only.
- No formula duplication from V1 aggregation layer.

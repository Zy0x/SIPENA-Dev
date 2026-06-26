# V2 Shadow Mode Specification

## Purpose

Shadow mode allows V2 to run in parallel with V1 silently, comparing results without affecting production state. It is critical for safely validating V2 correctness before cutover.

---

## How It Works

1. V2's `AttendanceV2Service` is constructed with `{ enableShadow: true }`.
2. On each `applyPatch()` call, if optional `v1EquivalentRecords` is provided:
   - V2 maps V1 raw DB records to canonical format.
   - `compareWithV1CanonicalResult()` runs a field-by-field diff.
   - If a mismatch is detected, the `auditEvent.metadata.shadowClash` is annotated.
3. V2 does NOT write to V1 tables in shadow mode — it is purely read-compare.

---

## Shadow Comparison Logic

File: `attendanceV2.shadow.ts`

```ts
compareWithV1CanonicalResult(
  v1Records: AttendanceRecordCanonical[],
  v2Records: AttendanceRecordCanonical[]
): ShadowComparisonResult
```

### Output Shape

```ts
interface ShadowComparisonResult {
  match: boolean;
  mismatchCount: number;
  mismatches: Array<{
    studentId: string;
    date: string;
    v1Status: AttendanceStatus;
    v2Status: AttendanceStatus;
    field: string;
  }>;
}
```

---

## Enabling Shadow Mode in Practice

```ts
const service = new AttendanceV2Service({
  enableWrite: false,  // Read-only comparison
  enableShadow: true
});

const v1RawRecords = await fetchV1Records(classId, month);
service.applyPatch(dataset, patch, actorId, v1RawRecords);
```

---

## Mismatch Scenarios

| Scenario | Expected |
|---|---|
| Same status | `match = true`, no shadowClash |
| Different status for same student+date | `match = false`, mismatch logged |
| V2 has extra records not in V1 | Detected as mismatch |
| V1 has records not in V2 | Detected as mismatch |

---

## Safety Guarantees

- Shadow mode never writes to production tables.
- Mismatch metadata is appended only to in-memory audit logs.
- No V1 code paths are called or modified.

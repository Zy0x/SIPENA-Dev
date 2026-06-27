import { ShadowComparisonReport } from "./attendanceV2.types";
import { AttendanceRecordCanonical } from "../canonical/canonical.types";

/**
 * compareWithV1CanonicalResult
 * Compares two arrays of canonical attendance records from V1 and V2
 * to detect state drift, missing entries, or status clashes.
 */
export function compareWithV1CanonicalResult(
  v1CanonicalRecords: AttendanceRecordCanonical[],
  v2CanonicalRecords: AttendanceRecordCanonical[]
): ShadowComparisonReport {
  const mismatches: ShadowComparisonReport["mismatches"] = [];

  const recordKey = (record: AttendanceRecordCanonical) => `${record.studentId}:${record.date}`;

  // Index V2 records for fast lookup
  const v2Map = new Map<string, AttendanceRecordCanonical>();
  v2CanonicalRecords.forEach((r) => {
    v2Map.set(recordKey(r), r);
  });

  // Check for status mismatches or records missing in V2
  v1CanonicalRecords.forEach((v1) => {
    const key = recordKey(v1);
    const v2 = v2Map.get(key);

    if (!v2) {
      mismatches.push({
        studentId: v1.studentId,
        date: v1.date,
        v1Status: v1.status,
        v2Status: null,
        mismatchFields: ["record_missing_in_v2"]
      });
    } else if (v1.status !== v2.status) {
      mismatches.push({
        studentId: v1.studentId,
        date: v1.date,
        v1Status: v1.status,
        v2Status: v2.status,
        mismatchFields: ["status"]
      });
    }
  });

  // Index V1 records for reverse lookup
  const v1Map = new Map<string, AttendanceRecordCanonical>();
  v1CanonicalRecords.forEach((r) => {
    v1Map.set(recordKey(r), r);
  });

  // Check for records missing in V1
  v2CanonicalRecords.forEach((v2) => {
    const key = recordKey(v2);
    if (!v1Map.has(key)) {
      mismatches.push({
        studentId: v2.studentId,
        date: v2.date,
        v1Status: null,
        v2Status: v2.status,
        mismatchFields: ["record_missing_in_v1"]
      });
    }
  });

  const comparableLength = Math.min(v1CanonicalRecords.length, v2CanonicalRecords.length);
  for (let index = 0; index < comparableLength; index += 1) {
    const v1 = v1CanonicalRecords[index];
    const v2 = v2CanonicalRecords[index];
    if (!v1 || !v2 || recordKey(v1) === recordKey(v2)) continue;

    // Ordering matters for export/shadow parity. Do not silently pass a dataset
    // that has the same records but would render murid/day rows differently.
    if (v2Map.has(recordKey(v1)) && v1Map.has(recordKey(v2))) {
      mismatches.push({
        studentId: v1.studentId,
        date: v1.date,
        v1Status: v1.status,
        v2Status: v2Map.get(recordKey(v1))?.status ?? null,
        mismatchFields: ["record_order"]
      });
    }
  }

  return {
    match: mismatches.length === 0,
    dateChecked: new Date().toISOString(),
    mismatchCount: mismatches.length,
    mismatches
  };
}

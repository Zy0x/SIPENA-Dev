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

  // Index V2 records for fast lookup
  const v2Map = new Map<string, AttendanceRecordCanonical>();
  v2CanonicalRecords.forEach((r) => {
    v2Map.set(`${r.studentId}:${r.date}`, r);
  });

  // Check for status mismatches or records missing in V2
  v1CanonicalRecords.forEach((v1) => {
    const key = `${v1.studentId}:${v1.date}`;
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
    v1Map.set(`${r.studentId}:${r.date}`, r);
  });

  // Check for records missing in V1
  v2CanonicalRecords.forEach((v2) => {
    const key = `${v2.studentId}:${v2.date}`;
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

  return {
    match: mismatches.length === 0,
    dateChecked: new Date().toISOString(),
    mismatchCount: mismatches.length,
    mismatches
  };
}

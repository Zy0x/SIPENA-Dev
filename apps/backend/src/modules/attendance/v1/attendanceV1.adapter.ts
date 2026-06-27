import type { AttendanceDatasetCanonical, AttendanceDatasetQuery, AttendanceValidationIssue } from "../attendance.types";
import { createBackendPendingIssue, createEmptyAttendanceDataset } from "../canonical/attendanceCanonical";

export class AttendanceV1Adapter {
  getDataset(query: AttendanceDatasetQuery): { dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] } {
    return {
      dataset: createEmptyAttendanceDataset(query),
      issues: [createBackendPendingIssue()],
    };
  }
}

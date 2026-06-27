import type {
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceRecordPatch,
  AttendanceValidationIssue,
} from "../attendance.types";
import { createBackendPendingIssue, createEmptyAttendanceDataset } from "../canonical/attendanceCanonical";

export class AttendanceV2Adapter {
  getDataset(query: AttendanceDatasetQuery): { dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] } {
    return {
      dataset: createEmptyAttendanceDataset(query),
      issues: [createBackendPendingIssue()],
    };
  }

  applyPatch(_patch: AttendanceRecordPatch): never {
    throw new Error("ATTENDANCE_V2_PERSISTENCE_NOT_CONFIGURED");
  }
}

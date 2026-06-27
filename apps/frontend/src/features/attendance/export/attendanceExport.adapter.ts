import type { AttendanceDatasetCanonical } from "../canonical";
import type {
  AttendanceCanonicalExportBridgeResult,
  AttendanceCanonicalExportSettings,
} from "./attendanceExportCanonical.types";
import { buildAttendanceExportBridgeFromCanonical } from "./attendanceExportLegacyBridge";
import { validateAttendanceCanonicalExportBridge } from "./attendanceExport.validation";

export function createAttendanceExportLegacyBridge(
  dataset: AttendanceDatasetCanonical,
  settings: AttendanceCanonicalExportSettings = {}
): AttendanceCanonicalExportBridgeResult {
  const bridge = buildAttendanceExportBridgeFromCanonical(dataset, settings);
  const issues = validateAttendanceCanonicalExportBridge(bridge);
  const blockingIssue = issues.find((issue) => issue.severity === "error" || issue.severity === "blocker");

  if (blockingIssue) {
    throw new Error(`Attendance export canonical bridge invalid: ${blockingIssue.code}`);
  }

  return bridge;
}

import { validateExportPayloadHasNoEngineLeakage, type AttendanceValidationIssue } from "../canonical";
import type { AttendanceCanonicalExportBridgeResult } from "./attendanceExportCanonical.types";

function issue(
  code: string,
  message: string,
  severity: AttendanceValidationIssue["severity"] = "error",
  field?: string
): AttendanceValidationIssue {
  return { code, message, severity, field };
}

export function validateAttendanceCanonicalExportBridge(
  bridge: AttendanceCanonicalExportBridgeResult
): AttendanceValidationIssue[] {
  const issues: AttendanceValidationIssue[] = [
    ...validateExportPayloadHasNoEngineLeakage(bridge.previewData),
    ...validateExportPayloadHasNoEngineLeakage(bridge.printDataset),
  ];

  const rowDayCountMismatch = bridge.previewData.rows.find((row) => row.cells.length !== bridge.previewData.days.length);
  if (rowDayCountMismatch) {
    issues.push(issue(
      "EXPORT_ROW_DAY_COUNT_MISMATCH",
      `Row '${rowDayCountMismatch.id}' has ${rowDayCountMismatch.cells.length} cells but export has ${bridge.previewData.days.length} day columns.`,
      "error",
      "rows.cells"
    ));
  }

  if (bridge.printDataset.rows.length !== bridge.previewData.rows.length) {
    issues.push(issue(
      "EXPORT_PRINT_ROW_COUNT_MISMATCH",
      "Print dataset row count must match preview dataset row count.",
      "error",
      "printDataset.rows"
    ));
  }

  if (bridge.printDataset.days.length !== bridge.previewData.days.length) {
    issues.push(issue(
      "EXPORT_PRINT_DAY_COUNT_MISMATCH",
      "Print dataset day count must match preview dataset day count.",
      "error",
      "printDataset.days"
    ));
  }

  return issues;
}

import { validateExportPayloadHasNoEngineLeakage, type AttendanceValidationIssue } from "../canonical";
import type { AttendanceCanonicalExportBridgeResult } from "./attendanceExportCanonical.types";

const EXPORT_SAFE_CELL_VALUES = new Set(["H", "I", "S", "A", "D", "L", "-"]);

function issue(
  code: string,
  message: string,
  severity: AttendanceValidationIssue["severity"] = "error",
  field?: string
): AttendanceValidationIssue {
  return { code, message, severity, field };
}

function hasUsableSigner(bridge: AttendanceCanonicalExportBridgeResult): boolean {
  return Boolean(
    bridge.signature?.signers?.some((signer) => signer.name.trim() || signer.title.trim() || signer.nip.trim())
  );
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

  for (const row of bridge.previewData.rows) {
    const unmappedCell = row.cells.find((cell) => !EXPORT_SAFE_CELL_VALUES.has(String(cell.value)));
    if (unmappedCell) {
      issues.push(issue(
        "EXPORT_UNMAPPED_STATUS_CODE",
        `Status '${String(unmappedCell.value)}' has no approved legacy export mapping.`,
        "error",
        "rows.cells.value"
      ));
    }
  }

  if (bridge.includeSignature && !bridge.signature) {
    issues.push(issue(
      "EXPORT_SIGNATURE_SETTINGS_MISSING",
      "Signature export is enabled but signature settings were not supplied to the canonical export bridge.",
      "error",
      "signature"
    ));
  }

  if (bridge.includeSignature && bridge.signature && !hasUsableSigner(bridge)) {
    issues.push(issue(
      "EXPORT_SIGNATURE_SIGNER_MISSING",
      "Signature export is enabled but no usable signer is configured.",
      "error",
      "signature.signers"
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

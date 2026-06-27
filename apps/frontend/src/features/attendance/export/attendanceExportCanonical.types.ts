import type { AttendanceStatusCode } from "../canonical";
import type { AttendanceExportPreviewDataV2 } from "@/components/export/AttendanceExportPreviewV2";
import type { AttendancePrintDataset } from "@/lib/attendancePrintLayout";

export type AttendanceLegacyExportPayload = AttendanceExportPreviewDataV2;
export type AttendanceLegacyPrintDataset = AttendancePrintDataset;
export type AttendanceExportJumlahStatusCode = Extract<AttendanceStatusCode, "H" | "I" | "S" | "A" | "D">;

export interface AttendanceCanonicalExportSettings {
  className?: string;
  monthLabel?: string;
  exportTimeLabel?: string;
  workDayFormatLabel?: string;
  effectiveDays?: number;
  jumlahStatusCodes?: readonly AttendanceExportJumlahStatusCode[];
}

export interface AttendanceCanonicalExportBridgeResult {
  previewData: AttendanceLegacyExportPayload;
  printDataset: AttendanceLegacyPrintDataset;
}

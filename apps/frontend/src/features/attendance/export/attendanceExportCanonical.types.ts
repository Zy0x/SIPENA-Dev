import type { AttendanceStatusCode } from "../canonical";
import type { AttendanceExportPreviewDataV2 } from "@/components/export/AttendanceExportPreviewV2";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
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
  includeSignature?: boolean;
  signature?: SignatureSettingsConfig;
}

export interface AttendanceCanonicalExportBridgeResult {
  previewData: AttendanceLegacyExportPayload;
  printDataset: AttendanceLegacyPrintDataset;
  includeSignature: boolean;
  signature: SignatureSettingsConfig | null;
}

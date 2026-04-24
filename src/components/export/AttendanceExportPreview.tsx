/**
 * AttendanceExportPreviewV2 — thin preview shell (backward-compatible API).
 *
 * Delegates rendering to `AttendancePrintDocument` so that:
 *   preview ≡ print ≡ raster capture (PDF/PNG)
 *
 * Day-column widths are computed DYNAMICALLY in the layout engine to
 * guarantee all columns fit within one page width — no clipping.
 */

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
import type { ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import {
  buildAttendancePrintLayoutPlan,
  type AttendancePrintDataset,
} from "@/lib/attendancePrintLayout";
import type { AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";
import { AttendancePrintDocument } from "@/components/export/AttendancePrintDocument";

export interface AttendanceExportPreviewDataV2 {
  className: string;
  monthLabel: string;
  exportTimeLabel: string;
  workDayFormatLabel: string;
  effectiveDays: number;
  rows: Array<{
    id: string;
    number: number;
    name: string;
    nisn: string;
    cells: Array<{
      value: string;
      isHoliday: boolean;
      hasEvent: boolean;
    }>;
    totals: {
      H: number;
      S: number;
      I: number;
      A: number;
      D: number;
      total: number;
    };
  }>;
  days: Array<{
    key: string;
    dayName: string;
    dateLabel: string;
    isHoliday: boolean;
    hasEvent: boolean;
  }>;
  notes: string[];
  /** Legacy strings: "20 Mei: Cuti bersama..." */
  holidays: string[];
  /** Legacy strings: "21 Mei: Bakti Sosial — desc" */
  events: string[];
}

interface AttendanceExportPreviewV2Props {
  previewFormat: "pdf" | "png";
  draft: SignatureSettingsConfig;
  setDraft: Dispatch<SetStateAction<SignatureSettingsConfig>>;
  previewDate: string;
  includeSignature: boolean;
  data: AttendanceExportPreviewDataV2;
  paperSize: ReportPaperSize;
  documentStyle?: ReportDocumentStyle;
  autoFitOnePage?: boolean;
  visibleColumnKeys?: string[];
}

/** Parse legacy "20 Mei: Description" or "20: Description" string → structured item. */
function parseLegacyString(raw: string): AttendanceHolidayInputItem | null {
  // Try "DD Bulan: desc" or "DD: desc"
  const m = raw.match(/^(\d{1,2})(?:\s+\S+)?\s*[:\u2013\u2014-]\s*(.+)$/);
  if (!m) return null;
  const day = Number.parseInt(m[1], 10);
  if (Number.isNaN(day)) return null;
  return { date: "", dayNumber: day, description: m[2].trim() };
}

function toPrintDataset(data: AttendanceExportPreviewDataV2): AttendancePrintDataset {
  const holidayItems: AttendanceHolidayInputItem[] = data.holidays
    .map(parseLegacyString)
    .filter((x): x is AttendanceHolidayInputItem => x !== null);
  const eventItems: AttendanceHolidayInputItem[] = data.events
    .map(parseLegacyString)
    .filter((x): x is AttendanceHolidayInputItem => x !== null);

  return {
    className: data.className,
    monthLabel: data.monthLabel,
    exportTimeLabel: data.exportTimeLabel,
    workDayFormatLabel: data.workDayFormatLabel,
    effectiveDays: data.effectiveDays,
    rows: data.rows,
    days: data.days,
    notes: data.notes,
    holidayItems,
    eventItems,
  };
}

export function AttendanceExportPreviewV2({
  draft,
  setDraft,
  previewDate,
  includeSignature,
  data,
  paperSize,
  documentStyle,
  autoFitOnePage,
  visibleColumnKeys,
}: AttendanceExportPreviewV2Props) {
  const printDataset = useMemo(() => toPrintDataset(data), [data]);

  const plan = useMemo(
    () =>
      buildAttendancePrintLayoutPlan({
        data: printDataset,
        paperSize,
        documentStyle,
        visibleColumnKeys,
        includeSignature,
        signature: draft,
        forceSinglePage: !!autoFitOnePage,
        signatureOffsetYMm: draft.signatureOffsetY,
      }),
    [printDataset, paperSize, documentStyle, visibleColumnKeys, includeSignature, autoFitOnePage, draft, draft.signatureOffsetY],
  );

  return (
    <AttendancePrintDocument
      data={printDataset}
      plan={plan}
      signature={draft}
      setSignature={setDraft}
      includeSignature={includeSignature}
      previewDate={previewDate}
      mode="preview"
    />
  );
}

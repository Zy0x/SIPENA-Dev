/**
 * AttendanceExportPreviewV2 - thin preview shell (backward-compatible API).
 *
 * After the WYSIWYG refactor (v2.3.92), this component no longer computes
 * its own layout. It builds the layout plan via `buildAttendancePrintLayoutPlan`
 * and delegates rendering to the PDF canvas preview so that:
 *
 *   preview === exported PDF === exported PNG
 *
 * Existing callers (Attendance.tsx) keep the same props.
 */

import { useEffect, useMemo, type Dispatch, type SetStateAction } from "react";
import type { SignatureSettingsConfig } from "@/hooks/useSignatureSettings";
import type { ReportDocumentStyle, SignaturePlacement } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import {
  buildAttendancePrintLayoutPlan,
  type AttendanceAnnotationDisplayMode,
  type AttendanceInlineLabelStyle,
  type AttendancePrintDataset,
} from "@/lib/attendancePrintLayout";
import type { AttendanceHolidayInputItem } from "@/lib/attendanceHolidayGrouping";
import type { AttendanceExportTrace } from "@/lib/attendanceExportDebug";
import { AttendancePdfCanvasPreview } from "@/components/export/AttendancePdfCanvasPreview";
import { buildAttendancePdfDocument } from "@/lib/attendancePdfExport";
import type { ExportPreviewHighlightTarget } from "@/components/export/SignaturePreviewCanvas";

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
  holidays: string[];
  events: string[];
  holidayItems?: AttendanceHolidayInputItem[];
  eventItems?: AttendanceHolidayInputItem[];
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
  debugEnabled?: boolean;
  onTrace?: (trace: AttendanceExportTrace) => void;
  liveEditMode?: boolean;
  highlightTarget?: ExportPreviewHighlightTarget | null;
  onHighlightTargetHoverChange?: (target: ExportPreviewHighlightTarget | null) => void;
  onHighlightTargetSelect?: (target: ExportPreviewHighlightTarget | null) => void;
  onSignaturePlacementChange?: (placement: SignaturePlacement | null) => void;
  annotationDisplayMode?: AttendanceAnnotationDisplayMode;
  eventAnnotationDisplayMode?: AttendanceAnnotationDisplayMode;
  inlineLabelStyle?: AttendanceInlineLabelStyle;
}

function parseLegacyHolidayString(raw: string): AttendanceHolidayInputItem | null {
  const match = raw.match(/^(\d{1,2})\s+\S+\s*[:\u2013\u2014-]\s*(.+)$/);
  if (!match) return null;
  const day = Number.parseInt(match[1], 10);
  if (Number.isNaN(day)) return null;
  return {
    date: "",
    dayNumber: day,
    description: match[2].trim(),
  };
}

function toPrintDataset(data: AttendanceExportPreviewDataV2): AttendancePrintDataset {
  const holidayItems: AttendanceHolidayInputItem[] = data.holidayItems?.length
    ? data.holidayItems
    : data.holidays
      .map(parseLegacyHolidayString)
      .filter((item): item is AttendanceHolidayInputItem => item !== null);
  const eventItems: AttendanceHolidayInputItem[] = data.eventItems?.length
    ? data.eventItems
    : data.events
      .map(parseLegacyHolidayString)
      .filter((item): item is AttendanceHolidayInputItem => item !== null);

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
  previewFormat: _previewFormat,
  draft,
  setDraft,
  previewDate: _previewDate,
  includeSignature,
  data,
  paperSize,
  documentStyle,
  autoFitOnePage,
  visibleColumnKeys,
  debugEnabled = false,
  onTrace,
  liveEditMode = false,
  highlightTarget = null,
  onHighlightTargetHoverChange,
  onHighlightTargetSelect,
  onSignaturePlacementChange,
  annotationDisplayMode = "summary-card",
  eventAnnotationDisplayMode = "summary-card",
  inlineLabelStyle = "rotate-90",
}: AttendanceExportPreviewV2Props) {
  const printDataset = useMemo(() => toPrintDataset(data), [data]);

  const plan = useMemo(
    () => buildAttendancePrintLayoutPlan({
      data: printDataset,
      paperSize,
      documentStyle,
      visibleColumnKeys,
      includeSignature,
      signature: draft,
      forceSinglePage: !!autoFitOnePage,
      signatureOffsetYMm: draft.signatureOffsetY,
      annotationDisplayMode,
      eventAnnotationDisplayMode,
      inlineLabelStyle,
    }),
    [
      printDataset,
      paperSize,
      documentStyle,
      visibleColumnKeys,
      includeSignature,
      autoFitOnePage,
      draft,
      annotationDisplayMode,
      eventAnnotationDisplayMode,
      inlineLabelStyle,
    ],
  );

  const pdfBuild = useMemo(() => (
    buildAttendancePdfDocument({
      data: printDataset,
      plan,
      signature: draft,
      includeSignature,
    })
  ), [draft, includeSignature, plan, printDataset]);

  useEffect(() => {
    if (!debugEnabled || !onTrace) return;
    onTrace({
      kind: "attendance-export-trace",
      timestamp: new Date().toISOString(),
      input: {
        className: printDataset.className,
        monthLabel: printDataset.monthLabel,
        rowCount: plan.rows.length,
        visibleColumns: [...plan.visibleColumnKeys],
        visibleDayCount: plan.visibleDays.length,
        visibleRekapKeys: plan.visibleRekapKeys.map((key) => String(key)),
        paperSize,
        autoFitOnePage: !!autoFitOnePage,
        includeSignature,
      },
      planner: plan.debug.planner,
      preview: {
        renderedPageCount: plan.pages.length,
        rowHeightsByPage: plan.pages.map((page) => page.rowHeightsMm),
        logs: [
          {
            phase: "preview-plan-built",
            message: "Planner live preview berhasil dibangun dari dataset aktif.",
            timestamp: new Date().toISOString(),
            details: {
              pageCount: plan.pages.length,
              fitMode: plan.fit.mode,
              visibleColumnCount: plan.visibleColumnKeys.size,
            },
          },
          {
            phase: "preview-render-ready",
            message: "Renderer preview menerima plan final untuk dirender.",
            timestamp: new Date().toISOString(),
            details: {
              summaryHeightMm: plan.summaryLayout.contentHeightMm,
              signatureZoneHeightMm: plan.summaryLayout.signatureZoneHeightMm,
            },
          },
        ],
        summaryPlacement: {
          tableStartYMm: plan.summaryLayout.tableStartYMm,
          tableEndYMm: plan.summaryLayout.tableEndYMm,
          legendHeightMm: plan.summaryLayout.legendHeightMm,
          eventsHeightMm: plan.summaryLayout.eventsHeightMm,
          holidaysHeightMm: plan.summaryLayout.holidaysHeightMm,
          notesHeightMm: plan.summaryLayout.notesHeightMm,
          contentHeightMm: plan.summaryLayout.contentHeightMm,
          signatureZoneTopMm: plan.summaryLayout.signatureZoneTopMm,
          signatureZoneHeightMm: plan.summaryLayout.signatureZoneHeightMm,
        },
      },
      pdfRuntime: pdfBuild?.runtimeEntries ?? [],
      pngRuntime: [],
      downloads: [],
      mismatch: [
        ...(pdfBuild?.mismatches ?? []),
        ...(plan.debug.planner.pagePlans[0]?.rowCount === 0 ? [{
          kind: "blank_first_page_risk" as const,
          severity: "error" as const,
          message: "Planner mendeteksi halaman pertama berisiko kosong.",
          pageNumber: 1,
        }] : []),
        ...(plan.debug.planner.tableRightSlackMm < 2.6 ? [{
          kind: "table_right_slack_too_small" as const,
          severity: "warning" as const,
          message: `Slack kanan tabel hanya ${plan.debug.planner.tableRightSlackMm.toFixed(2)}mm.`,
        }] : []),
        ...plan.debug.planner.pagePlans
          .filter((page) => page.sliceOverflowBeforeRender)
          .map((page) => ({
            kind: "slice_overflow_before_render" as const,
            severity: "error" as const,
            message: `Halaman ${page.pageNumber} melebihi ruang body yang tersedia sebelum dirender.`,
            pageNumber: page.pageNumber,
          })),
      ],
    });
  }, [autoFitOnePage, debugEnabled, includeSignature, onTrace, paperSize, pdfBuild, plan, printDataset]);

  useEffect(() => {
    onSignaturePlacementChange?.(plan.signaturePlacement);
  }, [onSignaturePlacementChange, plan.signaturePlacement]);

  return (
    <AttendancePdfCanvasPreview
      data={printDataset}
      plan={plan}
      signature={draft}
      setSignature={setDraft}
      includeSignature={includeSignature}
      liveEditMode={liveEditMode}
      highlightTarget={highlightTarget}
      onHighlightTargetHoverChange={onHighlightTargetHoverChange}
      onHighlightTargetSelect={onHighlightTargetSelect}
    />
  );
}

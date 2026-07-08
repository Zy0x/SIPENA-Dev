import React, { useState, useCallback, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, FileSpreadsheet, Image as ImageIcon, Bookmark, 
  Loader2, CheckCircle2, Clock, ShieldAlert, XCircle, Info
} from "lucide-react";
import * as XLSX from "xlsx-js-style";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addSignatureBlockPDF, getSignatureRowsExcel, generateSignatureHTML, generateSignatureHTMLInline } from "@/lib/exportSignature";
import { buildAttendancePrintLayoutPlan, type AttendanceAnnotationDisplayMode, type AttendanceInlineLabelStyle, type AttendancePrintDataset } from "@/lib/attendancePrintLayout";
import { buildAttendancePdfDocument, exportAttendancePdf } from "@/lib/attendancePdfExport";
import {
  collectTraceMismatches,
  downloadAttendanceExportTrace,
  persistAttendanceExportTrace,
  serializeAttendanceExportTrace,
  type AttendanceExportMismatch,
  type AttendanceExportTrace,
  type AttendancePdfRuntimeTrace,
  type AttendancePngRuntimeTrace,
} from "@/lib/attendanceExportDebug";
import { createDefaultReportDocumentStyle, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import type { ExportColumnOption } from "@/components/export/UnifiedExportStudio";
import type { ReportPaperSize } from "@/lib/reportExportLayout";

interface Student {
  id: string;
  name: string;
  nisn?: string | null;
}

interface HolidayRecord {
  id?: string;
  date: string;
  description: string;
  class_id?: string | null;
}

interface DayEvent {
  id?: string;
  date: string;
  label: string;
  description?: string;
  color?: string;
}

interface UseAttendanceV2ExportParams {
  selectedClass: any;
  currentMonth: Date;
  setCurrentMonth: (date: Date) => void;
  setSelectedDate: (date: Date) => void;
  workDayFormat: "5days" | "6days";
  students: Student[];
  holidays: HolidayRecord[];
  dayEvents: DayEvent[];
  isHolidayCombined: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
  getAttendance: (studentId: string, date: Date) => string | null;
  getAttendanceNote: (studentId: string, date: Date) => string | null;
  runWithLoader: (fileName: string, fn: (progress: any) => Promise<any>) => Promise<any>;
  showSuccess: (title: string, message: string) => void;
  showWarning: (title: string, message: string) => void;
  dbAvailable: boolean;
  getYearlyData: (year: number) => Promise<{
    attendance: any[];
    holidays: any[];
    dayEvents: any[];
  }>;
  signatureConfig: any;
  saveSignature: (config: any) => Promise<any>;
  hasSignature: boolean;
  signatureLoading: boolean;
  signatureSaving: boolean;
  attendancePrintDataset: any;
  attendancePreviewStudioData: any;
  getHolidayDescription: (date: Date) => string | null;
  isNationalHoliday: (date: Date) => boolean;
  getNationalHolidayName: (date: Date) => string | null;
  getDayEvent: (date: Date) => DayEvent | undefined;
  setShowExportDialog: (open: boolean) => void;
}

const EXCEL_BORDER = {
  top: { style: "medium", color: { rgb: "94A3B8" } },
  right: { style: "medium", color: { rgb: "94A3B8" } },
  bottom: { style: "medium", color: { rgb: "94A3B8" } },
  left: { style: "medium", color: { rgb: "94A3B8" } },
} as const;

const SIPENA_FULL = "SIPENA — Sistem Informasi Penilaian Akademik";
const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function sanitizeFileNamePart(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

function downloadBlobFile(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
}

function getAttendancePngTargetWidthPx(quality: "hd" | "4k") {
  return quality === "4k" ? 3840 : 1920;
}


function styleAttendanceCell(ws: XLSX.WorkSheet, row: number, col: number, style: XLSX.CellStyle) {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  if (!ws[ref]) ws[ref] = { t: "s", v: "" };
  ws[ref].s = { ...(ws[ref].s || {}), ...style };
}

function styleAttendanceRange(ws: XLSX.WorkSheet, startRow: number, endRow: number, startCol: number, endCol: number, style: XLSX.CellStyle | ((row: number, col: number) => XLSX.CellStyle)) {
  for (let row = startRow; row <= endRow; row += 1) {
    for (let col = startCol; col <= endCol; col += 1) {
      styleAttendanceCell(ws, row, col, typeof style === "function" ? style(row, col) : style);
    }
  }
}

function statusFill(value: unknown) {
  const text = String(value ?? "");
  if (text === "H") return { fgColor: { rgb: "DCFCE7" } };
  if (text === "I") return { fgColor: { rgb: "DBEAFE" } };
  if (text === "S") return { fgColor: { rgb: "FEF9C3" } };
  if (text === "A") return { fgColor: { rgb: "FEE2E2" } };
  if (text === "D") return { fgColor: { rgb: "EDE9FE" } };
  if (text === "L") return { fgColor: { rgb: "FFF7ED" } };
  return undefined;
}

function polishAttendanceWorksheet(ws: XLSX.WorkSheet, options: {
  titleRow?: number;
  headerRowStart?: number;
  headerRowEnd?: number;
  dataRowStart?: number;
  dataRowEnd?: number;
  totalRow?: number;
  percentRow?: number;
  lastCol: number;
  dayStartCol?: number;
  dayEndCol?: number;
}) {
  const {
    titleRow = 0,
    headerRowStart,
    headerRowEnd,
    dataRowStart,
    dataRowEnd,
    totalRow,
    percentRow,
    lastCol,
    dayStartCol = -1,
    dayEndCol = -1,
  } = options;
  const merges = ws["!merges"] || [];
  if (lastCol > 0) merges.push({ s: { r: titleRow, c: 0 }, e: { r: titleRow, c: lastCol } });
  ws["!merges"] = merges;
  styleAttendanceRange(ws, titleRow, titleRow, 0, lastCol, {
    fill: { fgColor: { rgb: "2563EB" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 15 },
    alignment: { horizontal: "center", vertical: "center" },
    border: EXCEL_BORDER,
  });
  if (headerRowStart !== undefined && headerRowEnd !== undefined) {
    styleAttendanceRange(ws, headerRowStart, headerRowEnd, 0, lastCol, {
      fill: { fgColor: { rgb: "1D4ED8" } },
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 10 },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: EXCEL_BORDER,
    });
    ws["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: headerRowEnd, c: 0 }, e: { r: Math.max(headerRowEnd, dataRowEnd ?? headerRowEnd), c: lastCol } }) };
    (ws as XLSX.WorkSheet & { "!freeze"?: { xSplit?: number; ySplit?: number } })["!freeze"] = { xSplit: 3, ySplit: headerRowEnd + 1 };
  }
  if (dataRowStart !== undefined && dataRowEnd !== undefined) {
    styleAttendanceRange(ws, dataRowStart, dataRowEnd, 0, lastCol, (row, col) => {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      return {
        fill: col >= dayStartCol && col <= dayEndCol ? statusFill(cell?.v) : { fgColor: { rgb: row % 2 === 0 ? "FFFFFF" : "F8FAFC" } },
        font: { color: { rgb: "0F172A" }, sz: 10 },
        alignment: { horizontal: col === 1 ? "left" : "center", vertical: "center", wrapText: col === 1 || col === lastCol },
        border: EXCEL_BORDER,
      };
    });
  }
  if (totalRow !== undefined) {
    styleAttendanceRange(ws, totalRow, totalRow, 0, lastCol, {
      fill: { fgColor: { rgb: "E2E8F0" } },
      font: { bold: true, color: { rgb: "0F172A" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: EXCEL_BORDER,
    });
  }
  if (percentRow !== undefined) {
    styleAttendanceRange(ws, percentRow, percentRow, 0, lastCol, {
      fill: { fgColor: { rgb: "DBEAFE" } },
      font: { bold: true, color: { rgb: "1E40AF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: EXCEL_BORDER,
    });
  }
}

export function useAttendanceV2Export(params: UseAttendanceV2ExportParams) {
  const {
    selectedClass, currentMonth, setCurrentMonth, setSelectedDate, workDayFormat,
    students, holidays, dayEvents, isHolidayCombined, getHolidayDescriptionCombined,
    getAttendance, getAttendanceNote, runWithLoader, showSuccess, showWarning,
    dbAvailable, getYearlyData, signatureConfig, saveSignature, hasSignature,
    signatureLoading, signatureSaving, attendancePrintDataset, attendancePreviewStudioData,
    getHolidayDescription, isNationalHoliday, getNationalHolidayName, getDayEvent,
    setShowExportDialog
  } = params;

  // Local state for debug & annotations
  const [attendanceExportFormat, setAttendanceExportFormat] = useState<"pdf" | "excel" | "png-hd" | "png-4k">("pdf");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [paperSize, setPaperSize] = useState<ReportPaperSize>("a4");
  const [documentStyle, setDocumentStyle] = useState<ReportDocumentStyle>(() => createDefaultReportDocumentStyle());
  const [autoFitOnePage, setAutoFitOnePage] = useState(true);
  const [attendanceDebugEnabled, setAttendanceDebugEnabled] = useState(false);
  const [lastAttendanceExportTrace, setLastAttendanceExportTrace] = useState<AttendanceExportTrace | null>(null);

  // Column choices
  const [selectedAttendanceColumnKeys, setSelectedAttendanceColumnKeys] = useState<string[]>([]);

  // Default values
  const defaultAttendanceVisibleColumnKeys = useMemo(() => {
    const list: string[] = ["no", "name", "nisn"];
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    days.forEach((day) => {
      list.push(format(day, "yyyy-MM-dd"));
    });
    list.push("H", "S", "I", "A", "D", "total");
    return list;
  }, [currentMonth]);

  const defaultAttendanceColumnKeys = useMemo(() => {
    return new Set(defaultAttendanceVisibleColumnKeys);
  }, [defaultAttendanceVisibleColumnKeys]);

  const currentVisibleColumns = useMemo(() => {
    return selectedAttendanceColumnKeys.length > 0 ? selectedAttendanceColumnKeys : defaultAttendanceVisibleColumnKeys;
  }, [selectedAttendanceColumnKeys, defaultAttendanceVisibleColumnKeys]);

    const attendanceColumnOptions = useMemo<ExportColumnOption[]>(() => {
    const selectedSet = new Set(selectedAttendanceColumnKeys);
    
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    const dayChildren: ExportColumnOption[] = days.map((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const isSun = getDay(day) === 0;
      const isNat = isNationalHoliday(day);
      const isCustom = holidays.some((h) => h.date === dateStr);
      let label = format(day, "d");
      if (isSun) label += " (Min)";
      else if (isNat) label += " (Libur Nas)";
      else if (isCustom) label += " (Kustom)";
      
      return {
        key: dateStr,
        label,
        description: isSun || isNat || isCustom
          ? "Kolom hari libur. Nilai biasanya L atau kosong."
          : "Kolom presensi harian siswa.",
        checked: selectedSet.has(dateStr)
      };
    });

    const totalChildren: ExportColumnOption[] = [
      { key: "H", label: "Hadir (H)", description: "Jumlah hadir per siswa.", checked: selectedSet.has("H") },
      { key: "S", label: "Sakit (S)", description: "Jumlah sakit per siswa.", checked: selectedSet.has("S") },
      { key: "I", label: "Izin (I)", description: "Jumlah izin per siswa.", checked: selectedSet.has("I") },
      { key: "A", label: "Alpha (A)", description: "Jumlah alpha per siswa.", checked: selectedSet.has("A") },
      { key: "D", label: "Dispensasi (D)", description: "Jumlah dispensasi per siswa.", checked: selectedSet.has("D") },
      { key: "total", label: "Jumlah Total", description: "Total akumulasi ketidakhadiran/rekap.", checked: selectedSet.has("total") },
    ];

    return [
      {
        key: "days",
        label: "Kolom Hari",
        description: "Pilih tanggal mana saja yang ingin ikut tampil di preview dan file ekspor.",
        checked: dayChildren.length > 0 && dayChildren.every((child) => child.checked),
        groupMeta: {
          detailTitle: "Kolom presensi harian",
          activeSummaryLabel: "hari aktif",
          collapsedHint: "Daftar hari disembunyikan agar panel tetap ringkas. Tekan Detail untuk membuka pengaturan per hari presensi.",
        },
        children: dayChildren,
      },
      {
        key: "totals",
        label: "Rekap Status",
        description: "Atur kolom ringkasan kehadiran di sisi kanan tabel.",
        checked: totalChildren.every((child) => child.checked),
        groupMeta: {
          detailTitle: "Kolom rekap status",
          activeSummaryLabel: "status aktif",
          collapsedHint: "Gunakan Detail untuk memilih kategori rekap yang ditampilkan.",
        },
        children: totalChildren,
      },
      {
        key: "Catatan Siswa",
        label: "Catatan Presensi",
        description: "Tambahkan kolom kosong untuk catatan manual (hanya untuk PDF/Print/PNG).",
        checked: selectedSet.has("Catatan Siswa"),
      },
    ];
  }, [selectedAttendanceColumnKeys, currentMonth, holidays, isNationalHoliday]);

  const handleAttendanceColumnOptionChange = useCallback((key: string, checked: boolean) => {
    setSelectedAttendanceColumnKeys((prev) => {
      const currentKeys = prev.length > 0 ? prev : defaultAttendanceVisibleColumnKeys;
      if (checked) {
        // preserve natural order
        return defaultAttendanceVisibleColumnKeys.filter((k) => k === key || currentKeys.includes(k));
      } else {
        return currentKeys.filter((k) => k !== key);
      }
    });
  }, [defaultAttendanceVisibleColumnKeys]);

  const attendanceColumnTypographyOptions = useMemo(() => {
    return [
      { key: "no", label: "Kolom Nomor", align: "center" as const },
      { key: "name", label: "Nama Siswa", align: "left" as const },
      { key: "nisn", label: "Nomor Induk Siswa", align: "center" as const },
      { key: "date-columns", label: "Kolom Harian (Tanggal)", align: "center" as const },
      { key: "recap-columns", label: "Kolom Rekap (HSIAD)", align: "center" as const },
      { key: "Catatan Siswa", label: "Kolom Catatan", align: "left" as const },
    ];
  }, []);

  const [attendanceAnnotationDisplayMode, setAttendanceAnnotationDisplayMode] = useState<AttendanceAnnotationDisplayMode>("summary-card");
  const [attendanceEventAnnotationDisplayMode, setAttendanceEventAnnotationDisplayMode] = useState<AttendanceAnnotationDisplayMode>("summary-card");
  const [attendanceInlineLabelStyle, setAttendanceInlineLabelStyle] = useState<AttendanceInlineLabelStyle>("rotate-90");

  const normalizeAttendanceSignatureConfig = useCallback((
    config: any | null | undefined,
  ) => {
    if (!config) return config;
    return {
      ...config,
      placementMode: "adaptive" as const,
      manualXPercent: null,
      manualYPercent: null,
      signaturePageIndex: null,
      signatureOffsetX: 0,
      signatureOffsetY: 0,
    };
  }, []);

  const attendanceDefaultSignatureConfig = useMemo(
    () => normalizeAttendanceSignatureConfig(signatureConfig),
    [normalizeAttendanceSignatureConfig, signatureConfig],
  );

  const captureAttendanceStudioBaseline = useCallback(() => ({
    format: attendanceExportFormat,
    documentStyle: structuredClone(documentStyle),
    autoFitOnePage,
    paperSize,
    includeSignature,
    selectedAttendanceColumnKeys,
    signatureConfig: structuredClone(signatureConfig),
    annotationDisplayMode: attendanceAnnotationDisplayMode,
    eventAnnotationDisplayMode: attendanceEventAnnotationDisplayMode,
    inlineLabelStyle: attendanceInlineLabelStyle,
  }), [
    attendanceExportFormat,
    documentStyle,
    autoFitOnePage,
    paperSize,
    includeSignature,
    selectedAttendanceColumnKeys,
    signatureConfig,
    attendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    attendanceInlineLabelStyle,
  ]);

  const [attendanceStylePresetBaseline, setAttendanceStylePresetBaseline] = useState<any>(null);

  const openAttendanceExportMonthDialog = useCallback(() => {
    // sets baseline for restore mode
    const baseline = captureAttendanceStudioBaseline();
    setAttendanceStylePresetBaseline(baseline);
  }, [captureAttendanceStudioBaseline]);

  const resetAttendanceStudioDefaults = useCallback(() => {
    if (attendanceStylePresetBaseline) {
      setAttendanceExportFormat(attendanceStylePresetBaseline.format);
      setDocumentStyle(structuredClone(attendanceStylePresetBaseline.documentStyle));
      setAutoFitOnePage(attendanceStylePresetBaseline.autoFitOnePage);
      setPaperSize(attendanceStylePresetBaseline.paperSize);
      setIncludeSignature(attendanceStylePresetBaseline.includeSignature);
      setSelectedAttendanceColumnKeys(attendanceStylePresetBaseline.selectedAttendanceColumnKeys);
      setAttendanceAnnotationDisplayMode(attendanceStylePresetBaseline.annotationDisplayMode);
      setAttendanceEventAnnotationDisplayMode(attendanceStylePresetBaseline.eventAnnotationDisplayMode);
      setAttendanceInlineLabelStyle(attendanceStylePresetBaseline.inlineLabelStyle);
      showSuccess("Baseline Dipulihkan", "Pengaturan ekspor dikembalikan ke konfigurasi awal.");
    }
  }, [attendanceStylePresetBaseline, showSuccess]);

  const buildAttendanceTraceBase = useCallback((args: {
    plan: ReturnType<typeof buildAttendancePrintLayoutPlan>;
    exportPaperSize: ReportPaperSize;
    exportAutoFitOnePage: boolean;
    shouldIncludeSignature: boolean;
    exportVisibleColumnKeys: string[];
  }): AttendanceExportTrace => ({
    kind: "attendance-export-trace",
    timestamp: new Date().toISOString(),
    input: {
      className: attendancePrintDataset.className,
      monthLabel: attendancePrintDataset.monthLabel,
      rowCount: args.plan.rows.length,
      visibleColumns: args.exportVisibleColumnKeys,
      visibleDayCount: args.plan.visibleDays.length,
      visibleRekapKeys: args.plan.visibleRekapKeys.map((key) => String(key)),
      paperSize: args.exportPaperSize,
      autoFitOnePage: args.exportAutoFitOnePage,
      includeSignature: args.shouldIncludeSignature,
    },
    planner: args.plan.debug.planner,
    preview: {
      renderedPageCount: args.plan.pages.length,
      rowHeightsByPage: args.plan.pages.map((page) => page.rowHeightsMm),
      logs: [
        {
          phase: "preview-plan-built",
          message: "Planner final dibangun untuk preview/ekspor presensi.",
          timestamp: new Date().toISOString(),
          details: {
            pageCount: args.plan.pages.length,
            fitMode: args.plan.fit.mode,
            tableWidthMm: args.plan.table.tableWidthMm,
          },
        },
      ],
      summaryPlacement: {
        tableStartYMm: args.plan.summaryLayout.tableStartYMm,
        tableEndYMm: args.plan.summaryLayout.tableEndYMm,
        legendHeightMm: args.plan.summaryLayout.legendHeightMm,
        eventsHeightMm: args.plan.summaryLayout.eventsHeightMm,
        holidaysHeightMm: args.plan.summaryLayout.holidaysHeightMm,
        notesHeightMm: args.plan.summaryLayout.notesHeightMm,
        contentHeightMm: args.plan.summaryLayout.contentHeightMm,
        signatureZoneTopMm: args.plan.summaryLayout.signatureZoneTopMm,
        signatureZoneHeightMm: args.plan.summaryLayout.signatureZoneHeightMm,
      },
    },
    pdfRuntime: [],
    pngRuntime: [],
    downloads: [],
    mismatch: [],
  }), [attendancePrintDataset.className, attendancePrintDataset.monthLabel]);

  const commitAttendanceTrace = useCallback((trace: AttendanceExportTrace) => {
    const normalized = {
      ...trace,
      mismatch: collectTraceMismatches(trace),
    };
    setLastAttendanceExportTrace(normalized);
    persistAttendanceExportTrace(normalized);
    return normalized;
  }, []);

  const handleCopyAttendanceTrace = useCallback(async () => {
    if (!lastAttendanceExportTrace) return;
    const payload = serializeAttendanceExportTrace(lastAttendanceExportTrace);
    await navigator.clipboard.writeText(payload);
    showSuccess("Log Tersalin", "Trace ekspor presensi berhasil disalin ke clipboard.");
  }, [lastAttendanceExportTrace, showSuccess]);

  const handleDownloadAttendanceTrace = useCallback(() => {
    if (!lastAttendanceExportTrace) return;
    downloadAttendanceExportTrace(lastAttendanceExportTrace, `attendance-export-trace-${format(new Date(), "yyyyMMdd-HHmmss")}.json`);
  }, [lastAttendanceExportTrace]);

  const autoDownloadAttendanceTrace = useCallback((trace: AttendanceExportTrace, exportFileName: string) => {
    const traceFileName = exportFileName.replace(/\.(pdf|png|zip)$/i, ".trace.json");
    downloadAttendanceExportTrace({
      ...trace,
      downloads: [
        ...trace.downloads,
        {
          kind: "trace-json",
          fileName: traceFileName,
          timestamp: new Date().toISOString(),
        },
      ],
    }, traceFileName);
    return traceFileName;
  }, []);

  // EXPORT HANDLERS
  const handleExportExcel = useCallback(async (
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
    visibleColumnKeysOverride?: string[],
  ) => {
    if (!selectedClass) return;
    const exportSignature = signatureOverride ?? normalizeAttendanceSignatureConfig(signatureConfig);
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const exportVisibleColumnKeys = (visibleColumnKeysOverride && visibleColumnKeysOverride.length > 0)
      ? visibleColumnKeysOverride
      : (selectedAttendanceColumnKeys.length > 0 ? selectedAttendanceColumnKeys : defaultAttendanceVisibleColumnKeys);
    const visibleSet = new Set(exportVisibleColumnKeys);
    const fileName = `Presensi_${selectedClass.name}_${currentMonth.getFullYear()}.xlsx`;
    await runWithLoader(fileName, async (progress) => {
      progress.update({ percent: 8, phase: "Data", message: "Mengambil data presensi tahunan." });
      await progress.yieldFrame();
      const year = currentMonth.getFullYear();
      const yearlyData = await getYearlyData(year);
      progress.update({ percent: 22, phase: "Workbook", message: "Menyusun ringkasan dan sheet bulanan." });
      await progress.yieldFrame();
      const wb = XLSX.utils.book_new();
      const monthNamesList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

      const summaryRows: (string | number)[][] = [
        ["LAPORAN PRESENSI SISWA"],
        [SIPENA_FULL],
        [""],
        ["Kelas:", selectedClass.name],
        ["Tahun:", year],
        ["Format Hari Kerja:", workDayFormat === "5days" ? "5 Hari (Senin-Jumat)" : "6 Hari (Senin-Sabtu)"],
        ["Jumlah Siswa:", students.length],
        ["Tanggal Ekspor:", format(new Date(), "d MMMM yyyy HH:mm", { locale: idLocale })],
        [""],
        ["Keterangan Status:"],
        ["H = Hadir", "I = Izin", "S = Sakit", "A = Alpha", "D = Dispensasi", "L = Libur"],
        [""],
        ["Daftar Hari Libur Kustom:"],
      ];
      yearlyData.holidays.forEach(h => {
        summaryRows.push([format(new Date(h.date), "d MMMM yyyy", { locale: idLocale }), h.description]);
      });
      if (yearlyData.holidays.length === 0) summaryRows.push(["(Tidak ada hari libur kustom)"]);
      summaryRows.push([""]);
      summaryRows.push(["Daftar Kegiatan Khusus:"]);
      yearlyData.dayEvents.forEach(e => {
        summaryRows.push([format(new Date(e.date), "d MMMM yyyy", { locale: idLocale }), e.label, e.description || ""]);
      });
      if (yearlyData.dayEvents.length === 0) summaryRows.push(["(Tidak ada kegiatan khusus)"]);

      if (shouldIncludeSignature && exportSignature) {
        summaryRows.push(...getSignatureRowsExcel({
          city: exportSignature.city,
          signers: exportSignature.signers,
          useCustomDate: exportSignature.useCustomDate,
          customDate: exportSignature.customDate,
          fontSize: exportSignature.fontSize,
          showSignatureLine: exportSignature.showSignatureLine,
          signatureLinePosition: exportSignature.signatureLinePosition,
          signatureLineWidth: exportSignature.signatureLineWidth,
          signatureSpacing: exportSignature.signatureSpacing,
        }, 3));
      }

      const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
      wsSummary["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 30 }];
      polishAttendanceWorksheet(wsSummary, {
        titleRow: 0,
        lastCol: 2,
      });
      styleAttendanceRange(wsSummary, 3, Math.max(3, summaryRows.length - 1), 0, 2, {
        border: EXCEL_BORDER,
        alignment: { horizontal: "left", vertical: "center", wrapText: true },
        font: { color: { rgb: "0F172A" }, sz: 10 },
      });
      XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

      monthNamesList.forEach((monthName, monthIndex) => {
        progress.update({
          percent: 26 + Math.round((monthIndex / monthNamesList.length) * 44),
          phase: "Sheet Bulanan",
          message: `Menyusun sheet ${monthName}.`,
        });
        const monthStart = new Date(year, monthIndex, 1);
        const monthEnd2 = endOfMonth(monthStart);
        const days = eachDayOfInterval({ start: monthStart, end: monthEnd2 });
        const visibleDays = days.filter((day) => visibleSet.has(format(day, "yyyy-MM-dd")));
        const visibleSummaryKeys = ["H", "S", "I", "A", "D", "total"].filter((key) => visibleSet.has(key));

        const titleRow: (string | number)[] = [`REKAP PRESENSI BULAN ${monthName.toUpperCase()} ${year}`];
        const classRow: (string | number)[] = [`Kelas: ${selectedClass.name}`];
        const emptyRow: (string | number)[] = [""];

        const eventRow: (string | number)[] = ["Kegiatan:", "", ""];
        visibleDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const event = yearlyData.dayEvents.find(e => e.date === dateStr);
          eventRow.push(event ? event.label : "");
        });
        visibleSummaryKeys.forEach(() => eventRow.push(""));
        eventRow.push("");

        // Single merged header row
        const dayNameRow: (string | number)[] = ["No", "Nama Siswa", "NISN"];
        visibleDays.forEach(day => dayNameRow.push(dayNames[getDay(day)] || ""));
        visibleSummaryKeys.forEach((key) => {
          dayNameRow.push(key === "total" ? "Jml" : key);
        });
        dayNameRow.push("Catatan Siswa");

        const dayNumRow: (string | number)[] = ["", "", ""];
        visibleDays.forEach(day => dayNumRow.push(Number(format(day, "d"))));
        visibleSummaryKeys.forEach(() => dayNumRow.push(""));
        dayNumRow.push("");

        const monthEffDays = days.filter(day => {
          const dayNum = getDay(day);
          const isSunday = dayNum === 0;
          const isSaturday = workDayFormat === "5days" && dayNum === 6;
          const dateStr = format(day, "yyyy-MM-dd");
          const customHoliday = yearlyData.holidays.find(hol => hol.date === dateStr);
          
          if (customHoliday) {
            return customHoliday.description === "Hari Kerja";
          }
          
          return !isSunday && !isSaturday;
        }).length;

        const dataRows: (string | number)[][] = [];
        const colTotals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
        let grandJml = 0;

        students.forEach((student, idx) => {
          const row: (string | number)[] = [idx + 1, student.name, student.nisn || ""];
          let h = 0, i = 0, s = 0, a = 0, d = 0;
          const notes: string[] = [];
          days.forEach(day => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayNum = getDay(day);
            const isSunday = dayNum === 0;
            const isSaturday = workDayFormat === "5days" && dayNum === 6;
            const customHoliday = yearlyData.holidays.find(hol => hol.date === dateStr);
            if (isSunday || isSaturday || !!customHoliday) { row.push("L"); } else {
              const record = yearlyData.attendance.find(r => r.student_id === student.id && r.date === dateStr);
              const st = record?.status || "-";
              row.push(st);
              if (st === "H") h++; else if (st === "I") i++; else if (st === "S") s++; else if (st === "A") a++; else if (st === "D") d++;
              if (record?.note) notes.push(`Tgl ${format(day, "d")}: ${record.note}`);
            }
          });
          const jml = s + i + a + d;
          const dayValueMap = days.map((day) => {
            const dateStr = format(day, "yyyy-MM-dd");
            const dayNum = getDay(day);
            const isSunday = dayNum === 0;
            const isSaturday = workDayFormat === "5days" && dayNum === 6;
            const customHoliday = yearlyData.holidays.find(hol => hol.date === dateStr);
            if (isSunday || isSaturday || !!customHoliday) return "L";
            const record = yearlyData.attendance.find(r => r.student_id === student.id && r.date === dateStr);
            return record?.status || "-";
          });
          const visibleDayValues = days
            .map((day, index) => ({ key: format(day, "yyyy-MM-dd"), value: dayValueMap[index] }))
            .filter((item) => visibleSet.has(item.key))
            .map((item) => item.value);
          row.splice(3, row.length - 3, ...visibleDayValues);
          const summaryValues: Record<string, number> = { H: h, S: s, I: i, A: a, D: d, total: jml };
          visibleSummaryKeys.forEach((key) => row.push(summaryValues[key]));
          row.push(notes.join(" | "));
          dataRows.push(row);
          colTotals.H += h; colTotals.S += s; colTotals.I += i; colTotals.A += a; colTotals.D += d;
          grandJml += jml;
        });

        // Total row
        const totalRow: (string | number)[] = ["", "TOTAL", ""];
        visibleDays.forEach(() => totalRow.push(""));
        const totalSummaryValues: Record<string, number> = { H: colTotals.H, S: colTotals.S, I: colTotals.I, A: colTotals.A, D: colTotals.D, total: grandJml };
        visibleSummaryKeys.forEach((key) => totalRow.push(totalSummaryValues[key]));
        totalRow.push("");

        // Percentage row
        const pctRow: (string | number)[] = ["", "PERSENTASE KEHADIRAN", ""];
        visibleDays.forEach(() => pctRow.push(""));
        const denominator = students.length * monthEffDays;
        visibleSummaryKeys.forEach((key) => {
          if (key === "total") {
            const pct = denominator > 0 ? (grandJml / denominator) * 100 : 0;
            pctRow.push(`${pct.toFixed(1)}%`);
          } else {
            const count = totalSummaryValues[key] || 0;
            const pct = denominator > 0 ? (count / denominator) * 100 : 0;
            pctRow.push(`${pct.toFixed(1)}%`);
          }
        });
        pctRow.push("");

        const wsRows = [
          titleRow,
          classRow,
          emptyRow,
          eventRow,
          dayNameRow,
          dayNumRow,
          ...dataRows,
          totalRow,
          pctRow
        ];

        if (shouldIncludeSignature && exportSignature) {
          wsRows.push(
            emptyRow,
            ...getSignatureRowsExcel({
              city: exportSignature.city,
              signers: exportSignature.signers,
              useCustomDate: exportSignature.useCustomDate,
              customDate: exportSignature.customDate,
              fontSize: exportSignature.fontSize,
              showSignatureLine: exportSignature.showSignatureLine,
              signatureLinePosition: exportSignature.signatureLinePosition,
              signatureLineWidth: exportSignature.signatureLineWidth,
              signatureSpacing: exportSignature.signatureSpacing,
            }, 3)
          );
        }

        const ws = XLSX.utils.aoa_to_sheet(wsRows);
        ws["!cols"] = [
          { wch: 6 },
          { wch: 25 },
          { wch: 15 },
          ...visibleDays.map(() => ({ wch: 6 })),
          ...visibleSummaryKeys.map(() => ({ wch: 6 })),
          { wch: 30 }
        ];

        // Merge Header Info
        const headerMerges = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 4 + visibleDays.length } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 4 + visibleDays.length } },
          { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } }, // Kegiatan label merge
        ];

        // Merge No, Nama, NISN cells vertically
        headerMerges.push(
          { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
          { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
          { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
          { s: { r: 4, c: 4 + visibleDays.length + visibleSummaryKeys.length }, e: { r: 5, c: 4 + visibleDays.length + visibleSummaryKeys.length } } // Catatan
        );

        // Merge Rekap labels vertically
        visibleSummaryKeys.forEach((_, sIdx) => {
          headerMerges.push({
            s: { r: 4, c: 3 + visibleDays.length + sIdx },
            e: { r: 5, c: 3 + visibleDays.length + sIdx }
          });
        });

        // Merge Total & Percentage label row left cols
        const lastDataRow = 5 + dataRows.length;
        headerMerges.push(
          { s: { r: lastDataRow + 1, c: 1 }, e: { r: lastDataRow + 1, c: 2 } }, // Total label
          { s: { r: lastDataRow + 2, c: 1 }, e: { r: lastDataRow + 2, c: 2 } }  // Pct label
        );

        ws["!merges"] = headerMerges;
        polishAttendanceWorksheet(ws, {
          titleRow: 0,
          headerRowStart: 4,
          headerRowEnd: 5,
          dataRowStart: 6,
          dataRowEnd: lastDataRow,
          totalRow: lastDataRow + 1,
          percentRow: lastDataRow + 2,
          lastCol: 3 + visibleDays.length + visibleSummaryKeys.length,
          dayStartCol: 3,
          dayEndCol: 2 + visibleDays.length,
        });

        if (shouldIncludeSignature && exportSignature) {
          const sigStart = lastDataRow + 4;
          const sigEnd = sigStart + 6;
          styleAttendanceRange(ws, sigStart, sigEnd, 0, 3 + visibleDays.length + visibleSummaryKeys.length, {
            font: { sz: exportSignature.fontSize || 10 },
            alignment: { horizontal: "center", vertical: "center" },
          });
        }

        XLSX.utils.book_append_sheet(wb, ws, monthName.substring(0, 3));
      });

      progress.update({ percent: 92, phase: "Unduh", message: "Menghasilkan berkas Excel tahunan." });
      await progress.yieldFrame();
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      downloadBlobFile(blob, fileName);
    });

    showSuccess("Berhasil", "File Excel tahunan berhasil diunduh");
    setShowExportDialog(false);
  }, [students, selectedClass, currentMonth, getYearlyData, showSuccess, workDayFormat, signatureConfig, includeSignature, selectedAttendanceColumnKeys, defaultAttendanceVisibleColumnKeys, runWithLoader]);

  const handleExportPDFVector = useCallback(async (
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
    styleOverride?: ReportDocumentStyle,
    autoFitOverride?: boolean,
    paperSizeOverride?: ReportPaperSize,
    visibleColumnKeysOverride?: string[],
  ) => {
    if (!selectedClass) return;

    const exportSignature = signatureOverride ?? attendanceDefaultSignatureConfig;
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const exportStyle = styleOverride ?? documentStyle;
    const exportPaperSize = paperSizeOverride ?? paperSize;
    const exportAutoFitOnePage = autoFitOverride ?? autoFitOnePage;
    const exportVisibleColumnKeys = visibleColumnKeysOverride ?? selectedAttendanceColumnKeys;
    const fileName = `Presensi_${selectedClass.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}.pdf`;

    try {
      await runWithLoader(fileName, async (progress) => {
        progress.update({ percent: 12, phase: "Layout PDF", message: "Menghitung layout halaman presensi." });
        await progress.yieldFrame();
        const plan = buildAttendancePrintLayoutPlan({
          data: attendancePrintDataset,
          paperSize: exportPaperSize,
          documentStyle: exportStyle,
          visibleColumnKeys: exportVisibleColumnKeys,
          includeSignature: shouldIncludeSignature,
          signature: exportSignature,
          forceSinglePage: exportAutoFitOnePage,
          signatureOffsetYMm: exportSignature?.signatureOffsetY ?? 0,
          annotationDisplayMode: attendanceAnnotationDisplayMode,
          eventAnnotationDisplayMode: attendanceEventAnnotationDisplayMode,
          inlineLabelStyle: attendanceInlineLabelStyle,
        });
        progress.update({ percent: 34, phase: "Render PDF", message: "Menyusun dokumen PDF vektor." });
        await progress.yieldFrame();

        const runtimeEntries: AttendancePdfRuntimeTrace[] = [];
        const runtimeMismatches: AttendanceExportMismatch[] = [];
        const traceBase = buildAttendanceTraceBase({
          plan,
          exportPaperSize,
          exportAutoFitOnePage,
          shouldIncludeSignature,
          exportVisibleColumnKeys,
        });

        exportAttendancePdf({
          data: attendancePrintDataset,
          plan,
          signature: exportSignature,
          includeSignature: shouldIncludeSignature,
          fileName,
          debugCollector: (event) => {
            if (event.runtime) runtimeEntries.push(event.runtime);
            if (event.mismatch) runtimeMismatches.push(event.mismatch);
          },
        });
        progress.update({ percent: 92, phase: "Finalisasi", message: "Dokumen PDF selesai dibuat." });
        await progress.yieldFrame();
        if (attendanceDebugEnabled) {
          const finalTrace = commitAttendanceTrace({
            ...traceBase,
            pdfRuntime: runtimeEntries,
            downloads: [
              {
                kind: "pdf",
                fileName,
                timestamp: new Date().toISOString(),
              },
            ],
            mismatch: runtimeMismatches,
          });
          autoDownloadAttendanceTrace(finalTrace, fileName);
          if (finalTrace.mismatch.length > 0) {
            showWarning("Diagnostik ekspor", `Terdeteksi ${finalTrace.mismatch.length} mismatch pada jalur PDF presensi.`);
          }
        }
        progress.update({ percent: 100, phase: "Download", message: "File PDF siap, download dimulai." });
        await progress.yieldFrame();
      });

      showSuccess("Berhasil", "File PDF vektor berhasil diunduh");
      setShowExportDialog(false);
    } catch (error) {
      console.error("Attendance PDF vector export error:", error);
      showWarning("Gagal", "Tidak dapat mengekspor PDF presensi vektor.");
    }
  }, [
    attendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    attendanceDebugEnabled,
    attendanceDefaultSignatureConfig,
    attendanceInlineLabelStyle,
    attendancePrintDataset,
    autoDownloadAttendanceTrace,
    autoFitOnePage,
    buildAttendanceTraceBase,
    commitAttendanceTrace,
    currentMonth,
    documentStyle,
    includeSignature,
    paperSize,
    selectedAttendanceColumnKeys,
    selectedClass,
    runWithLoader,
    showSuccess,
    showWarning,
  ]);

  const handleExportPNGV2 = useCallback(async (
    quality: "4k" | "hd" = "hd",
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
    styleOverride?: ReportDocumentStyle,
    autoFitOverride?: boolean,
    paperSizeOverride?: ReportPaperSize,
    visibleColumnKeysOverride?: string[],
  ) => {
    if (!selectedClass) return;
    const exportSignature = signatureOverride ?? attendanceDefaultSignatureConfig;
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const exportStyle = styleOverride ?? documentStyle;
    const exportAutoFitOnePage = autoFitOverride ?? autoFitOnePage;
    const exportPaperSize = paperSizeOverride ?? paperSize;
    const exportVisibleColumnKeys = visibleColumnKeysOverride ?? selectedAttendanceColumnKeys;
    const baseFileName = [
      "Presensi",
      sanitizeFileNamePart(selectedClass.name),
      sanitizeFileNamePart(format(currentMonth, "MMMM_yyyy", { locale: idLocale })),
      quality === "4k" ? "PNG_4K" : "PNG_HD",
    ].join("_");

    try {
      const exportResult = await runWithLoader(`${baseFileName}.png`, async (progress) => {
        progress.update({ percent: 10, phase: "Layout", message: "Menghitung layout presensi untuk PNG." });
        await progress.yieldFrame();
        const plan = buildAttendancePrintLayoutPlan({
          data: attendancePrintDataset,
          paperSize: exportPaperSize,
          documentStyle: exportStyle,
          visibleColumnKeys: exportVisibleColumnKeys,
          includeSignature: shouldIncludeSignature,
          signature: exportSignature,
          forceSinglePage: exportAutoFitOnePage,
          signatureOffsetYMm: exportSignature?.signatureOffsetY ?? 0,
          annotationDisplayMode: attendanceAnnotationDisplayMode,
          eventAnnotationDisplayMode: attendanceEventAnnotationDisplayMode,
          inlineLabelStyle: attendanceInlineLabelStyle,
        });

        progress.update({ percent: 24, phase: "PDF Sumber", message: "Menyusun PDF sumber untuk raster PNG." });
        await progress.yieldFrame();
        const builtPdf = await buildAttendancePdfDocument({
          data: attendancePrintDataset,
          plan,
          signature: exportSignature,
          includeSignature: shouldIncludeSignature,
        });

        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
        GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
        progress.update({ percent: 34, phase: "Membaca PDF", message: "Memuat PDF sumber untuk dirender ke PNG." });
        await progress.yieldFrame();
        const pdf = await getDocument({ data: builtPdf.arrayBuffer() }).promise;
        const renderedPages: Array<{ canvas: HTMLCanvasElement; fileName: string; dataUrl: string }> = [];
        let resolvedRasterScale = 0;
        const targetWidthPx = getAttendancePngTargetWidthPx(quality);

        for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
          progress.update({
            percent: 36 + Math.round(((pageNumber - 1) / Math.max(pdf.numPages, 1)) * 40),
            phase: "Render PNG",
            message: `Merender halaman ${pageNumber} dari ${pdf.numPages}.`,
          });
          await progress.yieldFrame();
          const page = await pdf.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const rasterScale = Math.max(targetWidthPx / Math.max(baseViewport.width, 1), quality === "4k" ? 4 : 2);
          resolvedRasterScale = Math.max(resolvedRasterScale, rasterScale);
          const viewport = page.getViewport({ scale: rasterScale });
          const canvas = document.createElement("canvas");
          const context = canvas.getContext("2d");
          if (!context) {
            throw new Error("Canvas context PNG tidak tersedia.");
          }
          canvas.width = Math.ceil(viewport.width);
          canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, canvasContext: context, viewport }).promise;
          renderedPages.push({
            canvas,
            fileName: pdf.numPages === 1
              ? `${baseFileName}.png`
              : `${baseFileName}_hal-${String(pageNumber).padStart(2, "0")}.png`,
            dataUrl: canvas.toDataURL("image/png"),
          });
          progress.update({
            percent: 36 + Math.round((pageNumber / Math.max(pdf.numPages, 1)) * 40),
            phase: "Render PNG",
            message: `Halaman ${pageNumber} dari ${pdf.numPages} selesai.`,
          });
        }
        await pdf.destroy();

        let downloadedFileName = renderedPages[0]?.fileName ?? `${baseFileName}.png`;
        const downloadKind: "png" | "zip" = renderedPages.length > 1 ? "zip" : "png";
        progress.update({
          percent: 84,
          phase: downloadKind === "zip" ? "ZIP" : "Download",
          message: downloadKind === "zip" ? "Mengarsipkan halaman PNG ke ZIP." : "Menyiapkan file PNG.",
        });
        await progress.yieldFrame();

        if (renderedPages.length === 1) {
          const link = document.createElement("a");
          link.download = downloadedFileName;
          link.href = renderedPages[0].dataUrl;
          link.click();
        } else {
          const { default: JSZip } = await import("jszip");
          const archive = new JSZip();
          renderedPages.forEach((page) => {
            archive.file(page.fileName, page.dataUrl.split(",")[1], { base64: true });
          });
          downloadedFileName = `${baseFileName}_${exportPaperSize.toUpperCase()}_${renderedPages.length}hal.zip`;
          const zipBlob = await archive.generateAsync({ type: "blob" });
          downloadBlobFile(zipBlob, downloadedFileName);
        }

        if (attendanceDebugEnabled) {
          const traceBase = buildAttendanceTraceBase({
            plan,
            exportPaperSize,
            exportAutoFitOnePage,
            shouldIncludeSignature,
            exportVisibleColumnKeys,
          });
          const pngRuntime: AttendancePngRuntimeTrace = {
            format: quality === "4k" ? "png-4k" : "png-hd",
            scale: resolvedRasterScale,
            renderedPageCount: plan.pages.length,
            wrapperWidthPx: Math.max(...renderedPages.map((page) => page.canvas.width)),
            wrapperHeightPx: renderedPages.reduce((sum, page) => sum + page.canvas.height, 0),
            canvasWidthPx: Math.max(...renderedPages.map((page) => page.canvas.width)),
            canvasHeightPx: Math.max(...renderedPages.map((page) => page.canvas.height)),
            pageImageNames: renderedPages.map((page) => page.fileName),
            archiveFileName: downloadKind === "zip" ? downloadedFileName : null,
          };
          const finalTrace = commitAttendanceTrace({
            ...traceBase,
            pngRuntime: [pngRuntime],
            downloads: [
              {
                kind: downloadKind,
                fileName: downloadedFileName,
                timestamp: new Date().toISOString(),
              },
            ],
          });
          autoDownloadAttendanceTrace(finalTrace, downloadedFileName);
        }
        progress.update({ percent: 100, phase: "Download", message: "File PNG siap, download dimulai." });
        await progress.yieldFrame();
        return { pageCount: renderedPages.length };
      });

      showSuccess(
        "Berhasil",
        exportResult.pageCount > 1
          ? `${exportResult.pageCount} halaman PNG ${quality === "4k" ? "4K Ultra HD" : "HD"} berhasil diarsipkan ke ZIP`
          : `File PNG ${quality === "4k" ? "4K Ultra HD" : "HD"} berhasil diunduh`,
      );
      setShowExportDialog(false);
    } catch (e) {
      console.error(e);
      showWarning("Gagal", "Tidak dapat mengekspor PNG presensi.");
    }
  }, [
    attendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    attendanceDebugEnabled,
    attendanceDefaultSignatureConfig,
    attendanceInlineLabelStyle,
    attendancePrintDataset,
    autoDownloadAttendanceTrace,
    autoFitOnePage,
    buildAttendanceTraceBase,
    commitAttendanceTrace,
    currentMonth,
    documentStyle,
    includeSignature,
    paperSize,
    selectedAttendanceColumnKeys,
    selectedClass,
    runWithLoader,
    showSuccess,
    showWarning,
    setShowExportDialog,
  ]);

  const handlePrevMonth = () => {
    const prev = subMonths(currentMonth, 1);
    setCurrentMonth(prev);
    setSelectedDate(startOfMonth(prev));
  };

  const handleNextMonth = () => {
    const next = addMonths(currentMonth, 1);
    setCurrentMonth(next);
    setSelectedDate(startOfMonth(next));
  };

  // DEBUG PANELS
  const attendanceDebugPanel = (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-foreground">Diagnostik Ekspor Presensi</p>
          <p className="mt-1 text-[10px] text-muted-foreground">
            Simpan jejak planner dan runtime PDF agar investigasi mismatch berikutnya lebih akurat.
          </p>
        </div>
        <Switch checked={attendanceDebugEnabled} onCheckedChange={setAttendanceDebugEnabled} />
      </div>
      {attendanceDebugEnabled ? (
        <div className="space-y-2 rounded-xl border border-dashed border-border bg-muted/20 p-3">
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${lastAttendanceExportTrace?.mismatch.length ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
              {lastAttendanceExportTrace ? (lastAttendanceExportTrace.mismatch.length ? "Mismatch" : "OK") : "Menunggu trace"}
            </span>
            {lastAttendanceExportTrace ? (
              <>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                  Planned {lastAttendanceExportTrace.planner.plannedPageCount} halaman
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                  Runtime PDF {lastAttendanceExportTrace.pdfRuntime.length || 0}
                </span>
                <span className="rounded-full border border-border bg-background px-2 py-0.5 text-muted-foreground">
                  Runtime PNG {lastAttendanceExportTrace.pngRuntime.length || 0}
                </span>
              </>
            ) : null}
          </div>
          {lastAttendanceExportTrace ? (
            <>
              <div className="space-y-1 text-[10px] text-muted-foreground">
                <div>Slack kanan tabel: {lastAttendanceExportTrace.planner.tableRightSlackMm.toFixed(2)}mm</div>
                <div>Mode fit: {lastAttendanceExportTrace.planner.chosenStageMode}</div>
                <div>Mismatch: {lastAttendanceExportTrace.mismatch.length}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => void handleCopyAttendanceTrace()}>
                  Salin Log JSON
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-[10px]" onClick={handleDownloadAttendanceTrace}>
                  Unduh Log JSON
                </Button>
              </div>
              <div className="max-h-40 overflow-auto rounded-lg border border-border bg-background p-2 text-[10px]">
                <div className="font-medium text-foreground">Ringkasan mismatch</div>
                {lastAttendanceExportTrace.mismatch.length > 0 ? (
                  lastAttendanceExportTrace.mismatch.map((item, index) => (
                    <div key={`${item.kind}-${index}`} className="mt-1 text-muted-foreground">
                      {item.kind}: {item.message}
                    </div>
                  ))
                ) : (
                  <div className="mt-1 text-muted-foreground">Belum ada mismatch yang terdeteksi pada trace terakhir.</div>
                )}
              </div>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground">Trace akan muncul setelah preview atau ekspor PDF presensi dijalankan saat toggle ini aktif.</p>
          )}
        </div>
      ) : null}
    </div>
  );

  const attendanceDebugPreviewFooter = attendanceDebugEnabled ? (
    <div className="rounded-xl border border-border bg-background/90 p-3 text-[10px]">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 font-semibold ${lastAttendanceExportTrace?.mismatch.length ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
          {lastAttendanceExportTrace ? (lastAttendanceExportTrace.mismatch.length ? "Mismatch" : "OK") : "Preview trace aktif"}
        </span>
        {lastAttendanceExportTrace ? (
          <span className="text-muted-foreground">
            Planned {lastAttendanceExportTrace.planner.plannedPageCount} | Runtime PDF {lastAttendanceExportTrace.pdfRuntime.length || 0} | Runtime PNG {lastAttendanceExportTrace.pngRuntime.length || 0} | Slack kanan {lastAttendanceExportTrace.planner.tableRightSlackMm.toFixed(2)}mm
          </span>
        ) : (
          <span className="text-muted-foreground">Preview trace sedang dikumpulkan.</span>
        )}
      </div>
    </div>
  ) : null;

  const attendanceStylePanelExtra = (
    <div className="space-y-3">
      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3 dark:border-sky-900/60 dark:bg-sky-950/25">
        <p className="text-[11px] font-semibold text-foreground">Keterangan Libur & Presensi</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Atur keterangan hari libur agar tetap menjadi kartu ringkasan atau ditulis vertikal di dalam kolom tanggal tabel.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-sky-700 dark:border-sky-900/70 dark:bg-sky-950/70 dark:text-sky-200">
            {attendanceAnnotationDisplayMode === "summary-card" ? "Mode aktif: Kartu Ringkasan" : "Mode aktif: Vertikal di Tabel"}
          </span>
          {attendanceAnnotationDisplayMode === "inline-vertical" ? (
            <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-200">
              Style: {attendanceInlineLabelStyle === "rotate-90" ? "Rotate -90" : "Stacked Text"}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={attendanceAnnotationDisplayMode === "summary-card" ? "default" : "outline"}
            size="sm"
            className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
            onClick={() => setAttendanceAnnotationDisplayMode("summary-card")}
            title="Pertahankan keterangan sebagai kartu ringkasan di bawah tabel."
          >
            <span className="font-semibold">Kartu Ringkasan</span>
          </Button>
          <Button
            type="button"
            variant={attendanceAnnotationDisplayMode === "inline-vertical" ? "default" : "outline"}
            size="sm"
            className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
            onClick={() => setAttendanceAnnotationDisplayMode("inline-vertical")}
            title="Tulis keterangan langsung di area kolom tanggal pada tabel."
          >
            <span className="font-semibold">Vertikal di Tabel</span>
          </Button>
        </div>
        {attendanceAnnotationDisplayMode === "inline-vertical" ? (
          <div className="mt-3 rounded-xl border border-indigo-200/80 bg-indigo-50/80 p-3 dark:border-indigo-900/60 dark:bg-indigo-950/25">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-foreground">Style Label Vertikal</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Hanya tampil saat mode vertikal dipakai, agar pengaturan tetap satu konteks dan tidak membingungkan.
                </p>
              </div>
              <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-200">
                Dalam 1 kartu
              </span>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant={attendanceInlineLabelStyle === "rotate-90" ? "default" : "outline"}
                size="sm"
                className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
                onClick={() => setAttendanceInlineLabelStyle("rotate-90")}
                title="Putar label 90 derajat ke atas agar tetap hemat ruang."
              >
                <span className="font-semibold">Rotate -90</span>
              </Button>
              <Button
                type="button"
                variant={attendanceInlineLabelStyle === "stacked" ? "default" : "outline"}
                size="sm"
                className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
                onClick={() => setAttendanceInlineLabelStyle("stacked")}
                title="Tulis label per huruf atau per kata vertikal dengan jarak lebih rapi untuk frasa yang memiliki spasi."
              >
                <span className="font-semibold">Stacked Text</span>
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-sky-200/80 bg-white/70 p-3 text-[10px] leading-relaxed text-muted-foreground dark:border-sky-900/60 dark:bg-sky-950/20">
            Style Label Vertikal disembunyikan otomatis karena mode yang aktif adalah Kartu Ringkasan.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3 dark:border-amber-900/60 dark:bg-amber-950/25">
        <p className="text-[11px] font-semibold text-foreground">Kegiatan Khusus</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Pisahkan kegiatan khusus dari keterangan vertikal. Default tetap ringkasan, lalu masukkan ke tabel hanya bila memang dibutuhkan.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/70 dark:text-amber-200">
            {attendanceEventAnnotationDisplayMode === "summary-card" ? "Mode aktif: Kartu Ringkasan" : "Mode aktif: Masuk ke Tabel"}
          </span>
          {attendanceEventAnnotationDisplayMode === "inline-vertical" ? (
            <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700 dark:border-indigo-900/70 dark:bg-indigo-950/70 dark:text-indigo-200">
              Style mengikuti label vertikal: {attendanceInlineLabelStyle === "rotate-90" ? "Rotate -90" : "Stacked Text"}
            </span>
          ) : null}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Button
            type="button"
            variant={attendanceEventAnnotationDisplayMode === "summary-card" ? "default" : "outline"}
            size="sm"
            className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
            onClick={() => setAttendanceEventAnnotationDisplayMode("summary-card")}
            title="Simpan kegiatan khusus pada kartu ringkasan di bawah tabel."
          >
            <span className="font-semibold">Kartu Ringkasan</span>
          </Button>
          <Button
            type="button"
            variant={attendanceEventAnnotationDisplayMode === "inline-vertical" ? "default" : "outline"}
            size="sm"
            className="h-auto items-start justify-start rounded-xl px-3 py-2 text-left text-[10px]"
            onClick={() => setAttendanceEventAnnotationDisplayMode("inline-vertical")}
            title="Masukkan kegiatan khusus langsung ke tabel dengan style label vertikal yang sedang aktif."
          >
            <span className="font-semibold">Masukkan ke Tabel</span>
          </Button>
        </div>
        {attendanceEventAnnotationDisplayMode === "inline-vertical" ? (
          <div className="mt-3 rounded-xl border border-indigo-200/80 bg-white/80 p-3 text-[10px] leading-relaxed text-muted-foreground dark:border-indigo-900/60 dark:bg-indigo-950/25">
            Opsi cerdas aktif: kegiatan khusus ikut ditulis di tabel dan memakai style label vertikal yang sama agar hasil cetak tetap konsisten.
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-amber-200/80 bg-white/70 p-3 text-[10px] leading-relaxed text-muted-foreground dark:border-amber-900/60 dark:bg-amber-950/20">
            Kegiatan khusus tetap diringkas di kartu agar kolom tanggal tidak cepat penuh.
          </div>
        )}
      </div>
    </div>
  );

  return {
    attendanceExportFormat,
    setAttendanceExportFormat,
    includeSignature,
    setIncludeSignature,
    paperSize,
    setPaperSize,
    documentStyle,
    setDocumentStyle,
    autoFitOnePage,
    setAutoFitOnePage,
    attendanceDebugEnabled,
    setAttendanceDebugEnabled,
    lastAttendanceExportTrace,
    selectedAttendanceColumnKeys,
    setSelectedAttendanceColumnKeys,
    defaultAttendanceVisibleColumnKeys,
    defaultAttendanceColumnKeys,
    currentVisibleColumns,
    attendanceColumnOptions,
    handleAttendanceColumnOptionChange,
    attendanceColumnTypographyOptions,
    attendanceAnnotationDisplayMode,
    setAttendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    setAttendanceEventAnnotationDisplayMode,
    attendanceInlineLabelStyle,
    setAttendanceInlineLabelStyle,
    attendanceDefaultSignatureConfig,
    resetAttendanceStudioDefaults,
    openAttendanceExportMonthDialog,
    handleExportExcel,
    handleExportPDFVector,
    handleExportPNGV2,
    handlePrevMonth,
    handleNextMonth,
    commitAttendanceTrace,
    attendanceDebugPanel,
    attendanceDebugPreviewFooter,
    attendanceStylePanelExtra,
  };
}

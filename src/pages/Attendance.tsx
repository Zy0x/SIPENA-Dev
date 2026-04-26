import { useState, useMemo, useCallback, useRef, useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarDays, School, Check, X, Calendar as CalendarIcon, Download,
  FileSpreadsheet, ChevronLeft, ChevronRight, Users, BarChart3, Search,
  Sparkles, Loader2, Lock, Unlock, Sun, CalendarOff, UserCheck,
  Clock, CheckCircle2, XCircle, ShieldAlert, Settings2, MessageSquare, AlertCircle,
  FileText, Image as ImageIcon, Bookmark, Info, Upload, Camera, ChevronDown, Globe,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClasses } from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { useAttendance, type AttendanceStatusValue, type DayEvent } from "@/hooks/useAttendance";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { renderToStaticMarkup } from "react-dom/server";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import ImportAttendanceDialog from "@/components/import/ImportAttendanceDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";
import { PageHeader } from "@/components/layout/PageHeader";
import { createDefaultSignatureConfig, useSignatureSettings } from "@/hooks/useSignatureSettings";
import { SignatureExportPanel } from "@/components/export/SignatureExportPanel";
import { UnifiedExportStudio, type ExportColumnOption, type ExportColumnTypographyOption, type ExportStudioFormatOption } from "@/components/export/UnifiedExportStudio";
import { AttendanceExportPreviewV2, type AttendanceExportPreviewDataV2 } from "@/components/export/AttendanceExportPreviewV2";
import { addSignatureBlockPDF, getSignatureRowsExcel, generateSignatureHTML, generateSignatureHTMLInline } from "@/lib/exportSignature";
import { useIndonesianHolidays } from "@/hooks/useIndonesianHolidays";
import { NationalHolidaySync } from "@/components/attendance/NationalHolidaySync";
import { JumlahCalculationConfig, getJumlahConfig, calculateJumlah, type JumlahConfig } from "@/components/attendance/JumlahCalculationConfig";
import { PercentageRow } from "@/components/attendance/PercentageRow";
import { SmartScrollTable } from "@/components/attendance/SmartScrollTable";
import { createDefaultReportDocumentStyle, getNaturalColumnWidthMmV2, resolveReportPaperSize, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import { computeAttendanceColumnLayout } from "@/lib/attendanceExport";
import {
  buildAttendancePrintLayoutPlan,
  type AttendanceAnnotationDisplayMode,
  type AttendanceInlineLabelStyle,
  type AttendancePrintDataset,
} from "@/lib/attendancePrintLayout";
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
type AttendanceStatus = AttendanceStatusValue | null;
type AttendanceExportStudioBaseline = {
  format: "pdf" | "excel" | "png-hd" | "png-4k";
  documentStyle: ReportDocumentStyle;
  autoFitOnePage: boolean;
  paperSize: ReportPaperSize;
  includeSignature: boolean;
  selectedAttendanceColumnKeys: string[];
  signatureConfig: ReturnType<typeof createDefaultSignatureConfig>;
  annotationDisplayMode: AttendanceAnnotationDisplayMode;
  eventAnnotationDisplayMode: AttendanceAnnotationDisplayMode;
  inlineLabelStyle: AttendanceInlineLabelStyle;
};

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
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isAttendancePngFormat(formatId: string) {
  return formatId === "png-hd" || formatId === "png-4k";
}

function getAttendancePngTargetWidthPx(quality: "hd" | "4k") {
  return quality === "4k" ? 3840 : 1920;
}

const SIPENA_FULL = "SIPENA — Sistem Informasi Penilaian Akademik";

// ── Status config with FIXED colors for readability ──
const statusConfig: Record<string, { color: string; bg: string; bgActive: string; label: string; icon: React.ComponentType<{ className?: string }> }> = {
  H: { color: "text-grade-pass", bg: "bg-grade-pass/10", bgActive: "bg-grade-pass text-grade-pass-foreground", label: "Hadir", icon: CheckCircle2 },
  I: { color: "text-primary", bg: "bg-primary/10", bgActive: "bg-primary text-primary-foreground", label: "Izin", icon: Clock },
  S: { color: "text-grade-warning", bg: "bg-grade-warning/10", bgActive: "bg-grade-warning text-grade-warning-foreground", label: "Sakit", icon: ShieldAlert },
  A: { color: "text-grade-fail", bg: "bg-grade-fail/10", bgActive: "bg-grade-fail text-grade-fail-foreground", label: "Alpha", icon: XCircle },
  D: { color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10", bgActive: "bg-purple-600 text-white dark:bg-purple-500 dark:text-white", label: "Dispensasi", icon: Bookmark },
};

const allStatuses: AttendanceStatusValue[] = ["H", "S", "I", "A", "D"];

const statusLabels: Record<string, string> = {
  H: "Hadir", I: "Izin", S: "Sakit", A: "Alpha", D: "Dispensasi", null: "-",
};

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const ATTENDANCE_EXPORT_FORMATS: ExportStudioFormatOption[] = [
  {
    id: "pdf",
    label: "PDF",
    description: "Dokumen presensi siap cetak dengan layout rekap.",
    icon: FileText,
    badge: "Preview aktif",
    previewMode: "pdf",
  },
  {
    id: "excel",
    label: "Excel",
    description: "Workbook lengkap untuk rekap presensi tahunan.",
    icon: FileSpreadsheet,
    previewMode: null,
  },
  {
    id: "png-hd",
    label: "PNG HD",
    description: "Snapshot rekap presensi resolusi tinggi.",
    icon: ImageIcon,
    badge: "HD",
    previewMode: "png",
  },
  {
    id: "png-4k",
    label: "PNG 4K Ultra HD",
    description: "Snapshot rekap presensi kualitas maksimal.",
    icon: ImageIcon,
    badge: "4K",
    previewMode: "png",
  },
];

export default function Attendance() {
  const { success: showSuccess, warning: showWarning } = useEnhancedToast();
  const { classes } = useClasses();
  const lastNotificationRef = useRef<number>(0);
  const prefersReducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const { showLoader, overlay: exportOverlay } = useExportLoader();

  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [existingBulkStudents, setExistingBulkStudents] = useState<{ name: string; status: string }[]>([]);
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [showSettingsSheet, setShowSettingsSheet] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showImportAttendance, setShowImportAttendance] = useState(false);
  const [showOCRAttendance, setShowOCRAttendance] = useState(false);
  const [attendanceExportFormat, setAttendanceExportFormat] = useState<"pdf" | "excel" | "png-hd" | "png-4k">("pdf");
  const [documentStyle, setDocumentStyle] = useState<ReportDocumentStyle>(() => createDefaultReportDocumentStyle());
  // Presensi WAJIB termuat 1 halaman per bulan + tanda tangan (project knowledge).
  const [autoFitOnePage, setAutoFitOnePage] = useState(true);
  const [paperSize, setPaperSize] = useState<ReportPaperSize>("a4");
  const [attendanceAnnotationDisplayMode, setAttendanceAnnotationDisplayMode] = useState<AttendanceAnnotationDisplayMode>("summary-card");
  const [attendanceEventAnnotationDisplayMode, setAttendanceEventAnnotationDisplayMode] = useState<AttendanceAnnotationDisplayMode>("summary-card");
  const [attendanceInlineLabelStyle, setAttendanceInlineLabelStyle] = useState<AttendanceInlineLabelStyle>("rotate-90");
  const [attendanceDebugEnabled, setAttendanceDebugEnabled] = useState(false);
  const [lastAttendanceExportTrace, setLastAttendanceExportTrace] = useState<AttendanceExportTrace | null>(null);
  const [selectedAttendanceColumnKeys, setSelectedAttendanceColumnKeys] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("H");
  const [holidayDescription, setHolidayDescription] = useState("");
  const [selectedHolidayDates, setSelectedHolidayDates] = useState<Date[]>([]);
  const [activeView, setActiveView] = useState<"daily" | "monthly">("daily");
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{ studentId: string; studentName: string; date: Date } | null>(null);
  const [noteText, setNoteText] = useState("");
  const [showDayEventDialog, setShowDayEventDialog] = useState(false);
  const [selectedDayEventDates, setSelectedDayEventDates] = useState<Date[]>([]);
  const [dayEventLabel, setDayEventLabel] = useState("");
  const [dayEventDesc, setDayEventDesc] = useState("");
  const [dayEventColor, setDayEventColor] = useState("blue");
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);

  // Scroll handling is now fully managed by SmartScrollTable component


  const [workDayFormat, setWorkDayFormat] = useState<"5days" | "6days">(() => {
    const saved = localStorage.getItem("attendance_work_format");
    return (saved as "5days" | "6days") || "6days";
  });
  const [includeSignature, setIncludeSignature] = useState(false);
  const [attendanceStylePresetBaseline, setAttendanceStylePresetBaseline] = useState(() => ({
    documentStyle: structuredClone(createDefaultReportDocumentStyle()),
    autoFitOnePage: true,
  }));
  const {
    signatureConfig,
    hasSignature,
    isLoading: signatureLoading,
    isSaving: signatureSaving,
    saveSignature,
  } = useSignatureSettings();
  const attendanceStudioBaselineRef = useRef<AttendanceExportStudioBaseline | null>(null);

  const handleWorkDayFormatChange = useCallback((fmt: "5days" | "6days") => {
    setWorkDayFormat(fmt);
    localStorage.setItem("attendance_work_format", fmt);
    showSuccess("Format Diubah", `Format hari kerja diubah ke ${fmt === "5days" ? "5 hari (Senin-Jumat)" : "6 hari (Senin-Sabtu)"}`);
  }, [showSuccess]);

  const { students } = useStudents(selectedClassId);
  const selectedClass = classes.find((c) => c.id === selectedClassId);

  const {
    attendanceRecords, holidays, dayEvents, isLocked, dbAvailable,
    getAttendance, getAttendanceNote, getDayEvent, isHoliday, getHolidayDescription, getMonthStats, getDayStats, getYearlyData,
    setAttendance: setAttendanceDb, updateNote, bulkSetAttendance, toggleHoliday, upsertDayEvent, deleteDayEvent, toggleLock,
    isSaving, isLoading,
  } = useAttendance(selectedClassId, currentMonth, workDayFormat);

  // GSAP entrance
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (containerRef.current) {
      gsap.fromTo(containerRef.current, { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" });
    }
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || !statsRef.current) return;
    const cards = statsRef.current.querySelectorAll("[data-stat-card]");
    gsap.fromTo(cards, { opacity: 0, y: 10, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, duration: 0.3, stagger: 0.05, ease: "power2.out" });
  }, [selectedDate, selectedClassId, prefersReducedMotion]);

  useEffect(() => {
    if (!signatureLoading) setIncludeSignature(hasSignature);
  }, [signatureLoading, hasSignature]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(query) || s.nisn.toLowerCase().includes(query)
    );
  }, [students, searchQuery]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Indonesian national holidays
  const {
    nationalHolidays,
    isLoading: nationalHolidaysLoading,
    lastSynced: nationalHolidaysLastSynced,
    error: nationalHolidaysError,
    isNationalHoliday,
    getNationalHolidayName,
    getMonthNationalHolidays,
    refresh: refreshNationalHolidays,
  } = useIndonesianHolidays(currentMonth.getFullYear());

  const monthNationalHolidays = useMemo(
    () => getMonthNationalHolidays(currentMonth),
    [getMonthNationalHolidays, currentMonth]
  );

  // Jumlah column config
  const [jumlahConfig, setJumlahConfig] = useState<JumlahConfig>(getJumlahConfig);

  // Combined holiday check (user + national, but user customs are NOT overridden)
  const isHolidayCombined = useCallback(
    (date: Date): boolean => {
      const dateStr = format(date, "yyyy-MM-dd");
      const customHoliday = holidays.find((h) => h.date === dateStr);
      
      // Jika ada di custom holidays, cek deskripsinya.
      // Jika deskripsinya adalah 'Hari Kerja', maka kita paksa jadi hari kerja (return false).
      // Selain itu, jika ada di custom holidays, maka dianggap libur (return true).
      if (customHoliday) {
        return customHoliday.description !== "Hari Kerja";
      }

      // Jika tidak ada di custom, baru cek libur default (minggu/sabtu) atau nasional.
      return isHoliday(date) || isNationalHoliday(date);
    },
    [isHoliday, holidays, isNationalHoliday]
  );

  const getHolidayDescriptionCombined = useCallback(
    (date: Date): string | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      const customHoliday = holidays.find((h) => h.date === dateStr);
      
      // Jika custom holiday adalah 'Hari Kerja', maka tidak ada deskripsi libur
      if (customHoliday && customHoliday.description === "Hari Kerja") return null;
      
      // Prioritize user's description
      const userDesc = getHolidayDescription(date);
      if (userDesc) return userDesc;
      
      // Then check national
      return getNationalHolidayName(date);
    },
    [holidays, getHolidayDescription, getNationalHolidayName]
  );

  const getExistingEventForDate = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return dayEvents.find((event) => event.date === dateStr);
  }, [dayEvents]);

  const getExistingHolidayForDate = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return holidays.find((holiday) => holiday.date === dateStr);
  }, [holidays]);

  const dailyStats = useMemo(() => getDayStats(selectedDate), [getDayStats, selectedDate]);
  const monthlyStats = useMemo(() => getMonthStats(), [getMonthStats]);

  const effectiveDays = useMemo(() => {
    return monthDays.filter(day => !isHolidayCombined(day)).length;
  }, [monthDays, isHolidayCombined]);

  const attendancePreviewData = useMemo<AttendanceExportPreviewDataV2>(() => {
    // Resolve statuses counted toward the "Jumlah" column based on jumlahConfig.
    const jumlahStatuses = new Set<string>(
      jumlahConfig.mode === "default"
        ? ["S", "I", "A", "D"]
        : jumlahConfig.selectedStatuses
    );

    const rows = filteredStudents.map((student, index) => {
      const totals = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };
      const cells = monthDays.map((day) => {
        const holiday = isHolidayCombined(day);
        const event = !!getExistingEventForDate(day);
        if (holiday) {
          return { value: "L", isHoliday: true, hasEvent: event };
        }

        const value = getAttendance(student.id, day) || "-";
        if (value === "H" || value === "S" || value === "I" || value === "A" || value === "D") {
          totals[value] += 1;
          // "total" follows jumlahConfig, not hardcoded to non-hadir.
          if (jumlahStatuses.has(value)) {
            totals.total += 1;
          }
        }
        return { value, isHoliday: false, hasEvent: event };
      });

      return {
        id: student.id,
        number: index + 1,
        name: student.name,
        nisn: student.nisn,
        cells,
        totals,
      };
    });

    const monthNotes = filteredStudents.flatMap((student) => monthDays.flatMap((day) => {
      const note = getAttendanceNote(student.id, day);
      if (!note) return [];
      return [`${student.name} (${format(day, "d MMM", { locale: idLocale })}): ${note}`];
    }));

    const monthEventsPreview = dayEvents
      .filter((event) => {
        const eventDate = new Date(event.date);
        return eventDate.getMonth() === currentMonth.getMonth() && eventDate.getFullYear() === currentMonth.getFullYear();
      })
      .map((event) => `${format(new Date(event.date), "d MMM", { locale: idLocale })}: ${event.label}${event.description ? ` — ${event.description}` : ""}`);

    // User-set custom holidays (from DB).
    const customHolidayDateSet = new Set<string>();
    const monthHolidayItems: { dateStr: string; dayNumber: number; description: string }[] = [];

    holidays
      .filter((holiday) => {
        const holidayDate = new Date(holiday.date);
        return (
          holidayDate.getMonth() === currentMonth.getMonth() &&
          holidayDate.getFullYear() === currentMonth.getFullYear() &&
          holiday.description !== "Hari Kerja"
        );
      })
      .forEach((holiday) => {
        const d = new Date(holiday.date);
        customHolidayDateSet.add(holiday.date);
        monthHolidayItems.push({
          dateStr: holiday.date,
          dayNumber: d.getDate(),
          description: holiday.description,
        });
      });

    // Merge national holidays (skip if user already overrode that date).
    monthNationalHolidays.forEach((nh) => {
      if (!customHolidayDateSet.has(nh.date)) {
        const d = new Date(nh.date);
        if (
          d.getMonth() === currentMonth.getMonth() &&
          d.getFullYear() === currentMonth.getFullYear()
        ) {
          monthHolidayItems.push({
            dateStr: nh.date,
            dayNumber: d.getDate(),
            description: nh.name,
          });
        }
      }
    });

    // Sort by day number then format as legacy strings for downstream consumers.
    const monthHolidayPreview = monthHolidayItems
      .sort((a, b) => a.dayNumber - b.dayNumber)
      .map((item) => `${format(new Date(item.dateStr), "d MMM", { locale: idLocale })}: ${item.description}`);

    return {
      className: selectedClass?.name || "Belum memilih kelas",
      monthLabel: format(currentMonth, "MMMM yyyy", { locale: idLocale }),
      exportTimeLabel: format(new Date(), "d MMM yyyy HH:mm", { locale: idLocale }),
      workDayFormatLabel: workDayFormat === "5days" ? "5 Hari (Senin-Jumat)" : "6 Hari (Senin-Sabtu)",
      effectiveDays,
      rows,
      days: monthDays.map((day) => ({
        key: format(day, "yyyy-MM-dd"),
        dayName: dayNames[getDay(day)],
        dateLabel: format(day, "d"),
        isHoliday: isHolidayCombined(day),
        hasEvent: !!getExistingEventForDate(day),
      })),
      notes: monthNotes,
      holidays: monthHolidayPreview,
      events: monthEventsPreview,
    };
  }, [filteredStudents, monthDays, isHolidayCombined, getExistingEventForDate, getAttendance, getAttendanceNote, dayEvents, holidays, monthNationalHolidays, currentMonth, selectedClass?.name, workDayFormat, effectiveDays, jumlahConfig]);

  const attendancePrintDataset = useMemo<AttendancePrintDataset>(() => {
    // Build holidayItems directly from structured data — no string round-trip needed.
    const customHolidayDateSet = new Set<string>();
    const holidayItems: { date: string; dayNumber: number; description: string }[] = [];

    holidays
      .filter((holiday) => {
        const d = new Date(holiday.date);
        return (
          d.getMonth() === currentMonth.getMonth() &&
          d.getFullYear() === currentMonth.getFullYear() &&
          holiday.description !== "Hari Kerja"
        );
      })
      .forEach((holiday) => {
        customHolidayDateSet.add(holiday.date);
        holidayItems.push({ date: holiday.date, dayNumber: new Date(holiday.date).getDate(), description: holiday.description });
      });

    monthNationalHolidays.forEach((nh) => {
      if (!customHolidayDateSet.has(nh.date)) {
        const d = new Date(nh.date);
        if (d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear()) {
          holidayItems.push({ date: nh.date, dayNumber: d.getDate(), description: nh.name });
        }
      }
    });

    // Build eventItems directly from dayEvents.
    const eventItems: { date: string; dayNumber: number; description: string }[] = dayEvents
      .filter((event) => {
        const d = new Date(event.date);
        return d.getMonth() === currentMonth.getMonth() && d.getFullYear() === currentMonth.getFullYear();
      })
      .map((event) => ({
        date: event.date,
        dayNumber: new Date(event.date).getDate(),
        description: `${event.label}${event.description ? ` \u2014 ${event.description}` : ""}`,
      }));

    return {
      className: attendancePreviewData.className,
      monthLabel: attendancePreviewData.monthLabel,
      exportTimeLabel: attendancePreviewData.exportTimeLabel,
      workDayFormatLabel: attendancePreviewData.workDayFormatLabel,
      effectiveDays: attendancePreviewData.effectiveDays,
      rows: attendancePreviewData.rows,
      days: attendancePreviewData.days,
      notes: attendancePreviewData.notes,
      holidayItems,
      eventItems,
    };
  }, [attendancePreviewData, holidays, monthNationalHolidays, dayEvents, currentMonth]);

  const attendancePreviewStudioData = useMemo<AttendanceExportPreviewDataV2>(() => ({
    ...attendancePreviewData,
    holidayItems: attendancePrintDataset.holidayItems,
    eventItems: attendancePrintDataset.eventItems,
  }), [attendancePreviewData, attendancePrintDataset]);


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
    const downloadedTraceFile = downloadAttendanceExportTrace({
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
    return downloadedTraceFile || traceFileName;
  }, []);

  const normalizeAttendanceSignatureConfig = useCallback((
    config: typeof signatureConfig | null | undefined,
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
  const captureAttendanceStudioBaseline = useCallback((): AttendanceExportStudioBaseline => ({
    format: attendanceExportFormat,
    documentStyle: structuredClone(documentStyle),
    autoFitOnePage,
    paperSize,
    includeSignature,
    selectedAttendanceColumnKeys: [...selectedAttendanceColumnKeys],
    signatureConfig: structuredClone(attendanceDefaultSignatureConfig ?? createDefaultSignatureConfig()),
    annotationDisplayMode: attendanceAnnotationDisplayMode,
    eventAnnotationDisplayMode: attendanceEventAnnotationDisplayMode,
    inlineLabelStyle: attendanceInlineLabelStyle,
  }), [
    attendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    attendanceDefaultSignatureConfig,
    attendanceExportFormat,
    attendanceInlineLabelStyle,
    autoFitOnePage,
    documentStyle,
    includeSignature,
    paperSize,
    selectedAttendanceColumnKeys,
  ]);

  useEffect(() => {
    if (signatureLoading) return;
    if (!attendanceDefaultSignatureConfig) return;
    if (selectedAttendanceColumnKeys.length === 0) return;
    if (attendanceStudioBaselineRef.current) return;
    const capturedBaseline = captureAttendanceStudioBaseline();
    attendanceStudioBaselineRef.current = capturedBaseline;
    setAttendanceStylePresetBaseline({
      documentStyle: structuredClone(capturedBaseline.documentStyle),
      autoFitOnePage: capturedBaseline.autoFitOnePage,
    });
  }, [
    attendanceDefaultSignatureConfig,
    captureAttendanceStudioBaseline,
    selectedAttendanceColumnKeys,
    signatureLoading,
  ]);

  const renderAttendanceExportElement = useCallback((
    exportSignature: typeof signatureConfig,
    shouldIncludeSignature: boolean,
    exportStyle: ReportDocumentStyle,
    exportAutoFitOnePage: boolean,
    exportPaperSize: ReportPaperSize,
    visibleColumnKeys: string[],
    previewFormat: "pdf" | "png",
  ) => {
    const draftSignature = exportSignature ?? normalizeAttendanceSignatureConfig(signatureConfig) ?? createDefaultSignatureConfig();
    return renderToStaticMarkup(
      <AttendanceExportPreviewV2
        previewFormat={previewFormat}
        draft={draftSignature}
        setDraft={() => undefined}
        previewDate={
          draftSignature?.useCustomDate && draftSignature.customDate
            ? format(new Date(draftSignature.customDate), "d MMMM yyyy", { locale: idLocale })
            : format(new Date(), "d MMMM yyyy", { locale: idLocale })
        }
        includeSignature={shouldIncludeSignature}
        data={attendancePreviewStudioData}
        paperSize={exportPaperSize}
        documentStyle={exportStyle}
        autoFitOnePage={exportAutoFitOnePage}
        visibleColumnKeys={visibleColumnKeys}
        annotationDisplayMode={attendanceAnnotationDisplayMode}
        eventAnnotationDisplayMode={attendanceEventAnnotationDisplayMode}
        inlineLabelStyle={attendanceInlineLabelStyle}
      />
    );
  }, [
    attendanceAnnotationDisplayMode,
    attendanceEventAnnotationDisplayMode,
    attendanceInlineLabelStyle,
    attendancePreviewStudioData,
    normalizeAttendanceSignatureConfig,
    signatureConfig,
  ]);

  const handleAttendanceExportFormatChange = useCallback((value: string) => {
    const nextFormat = value as typeof attendanceExportFormat;
    const wasPngFormat = isAttendancePngFormat(attendanceExportFormat);
    const willBePngFormat = isAttendancePngFormat(nextFormat);
    setAttendanceExportFormat(nextFormat);
    if (willBePngFormat && !wasPngFormat && paperSize !== "full-page") {
      setPaperSize("full-page");
    }
  }, [attendanceExportFormat, paperSize]);

  const attendanceColumnTypographyOptions = useMemo<ExportColumnTypographyOption[]>(() => {
    const staticColumns = [
      { key: "no", label: "No", type: "index" },
      { key: "name", label: "Nama", type: "name" },
      { key: "nisn", label: "NISN", type: "nisn" },
    ];
    const dayColumns = attendancePreviewData.days.map((day) => ({
      key: day.key,
      label: `${day.dayName} ${day.dateLabel}`,
      type: "assignment",
    }));
    const totalColumns = ["H", "S", "I", "A", "D", "total"].map((key) => ({
      key,
      label: key === "total" ? "Jumlah" : key,
      type: "grandAvg",
    }));

    return [...staticColumns, ...dayColumns, ...totalColumns].map((column) => {
      const sampleValue = column.key === "name"
        ? attendancePreviewData.rows[0]?.name ?? "Nama siswa"
        : column.key === "nisn"
          ? attendancePreviewData.rows[0]?.nisn ?? "0000"
          : column.key === "no"
            ? String(attendancePreviewData.rows[0]?.number ?? 1)
            : column.key === "total"
              ? String(attendancePreviewData.rows[0]?.totals.total ?? 0)
              : ["H", "S", "I", "A", "D"].includes(column.key)
                ? String(attendancePreviewData.rows[0]?.totals[column.key as keyof typeof attendancePreviewData.rows[number]["totals"]] ?? 0)
                : attendancePreviewData.rows[0]?.cells[attendancePreviewData.days.findIndex((day) => day.key === column.key)]?.value ?? "-";

      return {
        key: column.key,
        label: column.label,
        type: column.type,
        description: column.key === "name"
          ? "Kolom identitas siswa"
          : column.key === "nisn"
            ? "Nomor induk siswa"
            : column.key === "no"
              ? "Nomor urut"
              : ["H", "S", "I", "A", "D", "total"].includes(column.key)
                ? "Kolom rekap presensi"
                : "Kolom hari presensi",
        sampleValue,
        suggestedHeaderFontSize: column.key === "name" ? 11 : 9,
        suggestedBodyFontSize: column.key === "name" ? 11 : 9,
        suggestedWidthMm: Number(getNaturalColumnWidthMmV2({
          key: column.key,
          label: column.label,
          type: column.type,
        }).toFixed(2)),
        suggestedHeaderAlignment: "center" as const,
        suggestedBodyAlignment: column.key === "name" || column.key === "nisn" ? "left" as const : "center" as const,
      };
    });
  }, [attendancePreviewData]);

  const defaultAttendanceVisibleColumnKeys = useMemo(
    () => ["no", "name", "nisn", ...attendancePreviewData.days.map((day) => day.key), "H", "S", "I", "A", "D", "total"],
    [attendancePreviewData.days],
  );

  // Sync visible column keys when the month (and thus its day-keys) changes.
  // Strategy: if the current selection has no overlap with the new day-keys
  // (i.e. user navigated to a different month), reset fully to defaults.
  // Otherwise keep user's custom selection with missing required cols added.
  const currentDayKeys = useMemo(
    () => new Set(attendancePreviewData.days.map((d) => d.key)),
    [attendancePreviewData.days],
  );
  useEffect(() => {
    setSelectedAttendanceColumnKeys((prev) => {
      if (prev.length === 0) return defaultAttendanceVisibleColumnKeys;
      // Check if ANY previously selected day-column key belongs to the new month
      const prevDayKeys = prev.filter((k) => k.match(/^\d{4}-\d{2}-\d{2}$/));
      const monthChanged = prevDayKeys.length > 0 && !prevDayKeys.some((k) => currentDayKeys.has(k));
      if (monthChanged) return defaultAttendanceVisibleColumnKeys;
      const valid = prev.filter((key) => defaultAttendanceVisibleColumnKeys.includes(key));
      const missingRequired = ["no", "name", "nisn"].filter((key) => !valid.includes(key));
      const next = [...valid, ...missingRequired];
      return next.length === prev.length && next.every((key, index) => key === prev[index]) ? prev : next;
    });
  }, [defaultAttendanceVisibleColumnKeys, currentDayKeys]);

  const attendanceColumnOptions = useMemo<ExportColumnOption[]>(() => {
    const selectedSet = new Set(selectedAttendanceColumnKeys);
    const dayChildren = attendancePreviewData.days.map((day) => ({
      key: day.key,
      label: `${day.dayName} ${day.dateLabel}`,
      description: day.isHoliday
        ? "Kolom hari libur. Nilai biasanya L atau kosong."
        : day.hasEvent
          ? "Kolom hari dengan kegiatan khusus."
          : "Kolom presensi harian siswa.",
      checked: selectedSet.has(day.key),
    }));
    const totalChildren = [
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
          activeSummaryLabel: "kolom rekap aktif",
          collapsedHint: "Detail rekap disembunyikan agar panel tetap bersih. Tekan Detail untuk membuka pengaturan per status.",
        },
        children: totalChildren,
      },
    ];
  }, [attendancePreviewData.days, selectedAttendanceColumnKeys]);

  const handleAttendanceColumnOptionChange = useCallback((key: string, checked: boolean) => {
    if (key === "days") {
      const dayKeys = attendancePreviewData.days.map((day) => day.key);
      setSelectedAttendanceColumnKeys((prev) => {
        const preserved = prev.filter((value) => !dayKeys.includes(value));
        return checked ? [...preserved, ...dayKeys] : preserved;
      });
      return;
    }
    if (key === "totals") {
      const totalKeys = ["H", "S", "I", "A", "D", "total"];
      setSelectedAttendanceColumnKeys((prev) => {
        const preserved = prev.filter((value) => !totalKeys.includes(value));
        return checked ? [...preserved, ...totalKeys] : preserved;
      });
      return;
    }
    if (["no", "name", "nisn"].includes(key)) return;
    setSelectedAttendanceColumnKeys((prev) => {
      const exists = prev.includes(key);
      if (checked && !exists) return [...prev, key];
      if (!checked && exists) return prev.filter((value) => value !== key);
      return prev;
    });
  }, [attendancePreviewData.days]);
  const resetAttendanceStudioDefaults = useCallback(() => {
    const baseline = attendanceStudioBaselineRef.current;
    if (!baseline) {
      setAttendanceExportFormat("pdf");
      setDocumentStyle(createDefaultReportDocumentStyle());
      setAutoFitOnePage(true);
      setIncludeSignature(hasSignature);
      setSelectedAttendanceColumnKeys(defaultAttendanceVisibleColumnKeys);
      setAttendanceAnnotationDisplayMode("summary-card");
      setAttendanceEventAnnotationDisplayMode("summary-card");
      setAttendanceInlineLabelStyle("rotate-90");
      return;
    }

    setAttendanceExportFormat(baseline.format);
    setDocumentStyle(structuredClone(baseline.documentStyle));
    setAutoFitOnePage(baseline.autoFitOnePage);
    setPaperSize(baseline.paperSize);
    setIncludeSignature(baseline.includeSignature);
    setSelectedAttendanceColumnKeys([...baseline.selectedAttendanceColumnKeys]);
    setAttendanceAnnotationDisplayMode(baseline.annotationDisplayMode);
    setAttendanceEventAnnotationDisplayMode(baseline.eventAnnotationDisplayMode);
    setAttendanceInlineLabelStyle(baseline.inlineLabelStyle);
  }, [defaultAttendanceVisibleColumnKeys, hasSignature]);

  const showThrottledNotification = useCallback((title: string, message: string) => {
    const now = Date.now();
    if (now - lastNotificationRef.current > 2000) {
      showSuccess(title, message);
      lastNotificationRef.current = now;
    }
  }, [showSuccess]);

  const handleSetAttendance = useCallback(async (studentId: string, date: Date, status: AttendanceStatus, silent = false) => {
    if (isHolidayCombined(date)) {
      showWarning("Hari Libur", `Tidak dapat input presensi: ${getHolidayDescriptionCombined(date)}`);
      return;
    }
    const dateStr = format(date, "yyyy-MM-dd");
    await setAttendanceDb({ studentId, date: dateStr, status });
    if (!silent) showThrottledNotification("Tersimpan", `Presensi ${statusLabels[status || 'null']}`);
  }, [isHolidayCombined, getHolidayDescriptionCombined, setAttendanceDb, showWarning, showThrottledNotification]);

  const handleSetMonthlyAttendance = useCallback(async (studentId: string, date: Date, status: AttendanceStatus) => {
    if (isLocked) { showWarning("Terkunci", "Buka kunci untuk mengedit rekap bulanan."); return; }
    if (isHolidayCombined(date)) { showWarning("Hari Libur", `Tidak dapat input presensi: ${getHolidayDescriptionCombined(date)}`); return; }
    const dateStr = format(date, "yyyy-MM-dd");
    await setAttendanceDb({ studentId, date: dateStr, status });
  }, [isLocked, isHolidayCombined, getHolidayDescriptionCombined, setAttendanceDb, showWarning]);

  const handleOpenNote = useCallback((studentId: string, studentName: string, date: Date) => {
    const existingNote = getAttendanceNote(studentId, date);
    setNoteTarget({ studentId, studentName, date });
    setNoteText(existingNote || "");
    setShowNoteDialog(true);
  }, [getAttendanceNote]);

  const handleSaveNote = useCallback(async () => {
    if (!noteTarget) return;
    const dateStr = format(noteTarget.date, "yyyy-MM-dd");
    await updateNote({ studentId: noteTarget.studentId, date: dateStr, note: noteText.trim() || null });
    setShowNoteDialog(false);
    showSuccess("Catatan Tersimpan", `Catatan untuk ${noteTarget.studentName} disimpan`);
  }, [noteTarget, noteText, updateNote, showSuccess]);

  const handleAddHoliday = useCallback(async () => {
    if (selectedHolidayDates.length === 0) return;
    const desc = holidayDescription || "Hari Libur";
    for (const date of selectedHolidayDates) {
      const dateStr = format(date, "yyyy-MM-dd");
      await toggleHoliday({ date: dateStr, description: desc });
    }
    setShowHolidayDialog(false);
    setHolidayDescription("");
    setSelectedHolidayDates([]);
    showSuccess("Berhasil", `${selectedHolidayDates.length} hari libur berhasil ditambahkan`);
  }, [selectedHolidayDates, holidayDescription, toggleHoliday, showSuccess]);

  const handleToggleHolidayDate = useCallback((date: Date) => {
    setSelectedHolidayDates(prev => {
      const exists = prev.some(d => isSameDay(d, date));
      if (exists) return prev.filter(d => !isSameDay(d, date));
      return [...prev, date];
    });
  }, []);

  const handleRemoveHoliday = useCallback(async (dateStr: string) => {
    await toggleHoliday({ date: dateStr });
    showSuccess("Berhasil", "Hari libur berhasil dihapus");
  }, [toggleHoliday, showSuccess]);

  const handleSaveDayEvent = useCallback(async () => {
    if (selectedDayEventDates.length === 0 || !dayEventLabel.trim()) return;
    for (const date of selectedDayEventDates) {
      const dateStr = format(date, "yyyy-MM-dd");
      await upsertDayEvent({ date: dateStr, label: dayEventLabel.trim(), description: dayEventDesc.trim() || undefined, color: dayEventColor });
    }
    setShowDayEventDialog(false);
    setDayEventLabel("");
    setDayEventDesc("");
    setSelectedDayEventDates([]);
    showSuccess("Berhasil", `${selectedDayEventDates.length} kegiatan khusus berhasil disimpan`);
  }, [selectedDayEventDates, dayEventLabel, dayEventDesc, dayEventColor, upsertDayEvent, showSuccess]);

  const handleRemoveDayEvent = useCallback(async (dateStr: string) => {
    await deleteDayEvent(dateStr);
    showSuccess("Berhasil", "Kegiatan khusus berhasil dihapus");
  }, [deleteDayEvent, showSuccess]);

  const handleBulkAttendance = useCallback(async () => {
    if (isHolidayCombined(selectedDate)) {
      showWarning("Hari Libur", `Tidak dapat input presensi: ${getHolidayDescriptionCombined(selectedDate)}`);
      setShowBulkDialog(false);
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
    // Check for existing attendance data on this date
    const existingStudents: { name: string; status: string }[] = [];
    for (const student of students) {
      const existing = getAttendance(student.id, selectedDate);
      if (existing) {
        existingStudents.push({ name: student.name, status: statusLabels[existing] || existing });
      }
    }
    
    if (existingStudents.length > 0 && !showBulkConfirm) {
      setExistingBulkStudents(existingStudents);
      setShowBulkConfirm(true);
      return;
    }
    
    await bulkSetAttendance({ studentIds: students.map((s) => s.id), date: dateStr, status: bulkStatus! });
    setShowBulkDialog(false);
    setShowBulkConfirm(false);
    setExistingBulkStudents([]);
    showSuccess("Berhasil", `Presensi ${statusLabels[bulkStatus!]} untuk semua siswa`);
  }, [selectedDate, students, bulkStatus, bulkSetAttendance, isHoliday, getHolidayDescription, getAttendance, showSuccess, showWarning, showBulkConfirm]);

  const handleBulkClear = useCallback(async () => {
    if (isHolidayCombined(selectedDate)) {
      showWarning("Hari Libur", `Tidak dapat mengosongkan presensi: ${getHolidayDescriptionCombined(selectedDate)}`);
      setShowBulkDialog(false);
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (selectedClassId) {
      const { supabaseExternal } = await import("@/lib/supabase-external");
      await (supabaseExternal as any).from("attendance_records").delete().eq("class_id", selectedClassId).eq("date", dateStr);
    }
    setShowBulkDialog(false);
    setShowBulkConfirm(false);
    showSuccess("Berhasil", `Presensi tanggal ${format(selectedDate, "d MMMM yyyy", { locale: idLocale })} dikosongkan`);
    window.location.reload();
  }, [selectedDate, isHoliday, getHolidayDescription, showSuccess, showWarning, selectedClassId]);

  // Export functions (handleExportExcel, handleExportPDF, handleExportPNG) - sama seperti sebelumnya
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
    await showLoader(fileName);
    const year = currentMonth.getFullYear();
    const yearlyData = await getYearlyData(year);
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
    XLSX.utils.book_append_sheet(wb, wsSummary, "Ringkasan");

    monthNamesList.forEach((monthName, monthIndex) => {
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

      // Single merged header row (No, Nama Siswa, NISN span both rows; day names on row1, day numbers on row2)
      const dayNameRow: (string | number)[] = ["No", "Nama Siswa", "NISN"];
      visibleDays.forEach(day => dayNameRow.push(dayNames[getDay(day)]));
      visibleSummaryKeys.forEach((key) => {
        dayNameRow.push(key === "total" ? "Jml" : key);
      });
      dayNameRow.push("Catatan Siswa");

      const dayNumRow: (string | number)[] = ["", "", ""];
      visibleDays.forEach(day => dayNumRow.push(Number(format(day, "d"))));
      visibleSummaryKeys.forEach(() => dayNumRow.push(""));
      dayNumRow.push("");

      const dataRows: (string | number)[][] = [];
      const colTotals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
      let grandJml = 0;
      const monthEffDays = days.filter(day => {
        const dayNum = getDay(day);
        const isSunday = dayNum === 0;
        const isSaturday = workDayFormat === "5days" && dayNum === 6;
        const dateStr = format(day, "yyyy-MM-dd");
        const customHoliday = yearlyData.holidays.find(hol => hol.date === dateStr);
        return !isSunday && !isSaturday && !customHoliday;
      }).length;

      students.forEach((student, idx) => {
        const row: (string | number)[] = [idx + 1, student.name, student.nisn];
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
      const pctRow: (string | number)[] = ["", "PERSENTASE (%)", ""];
      visibleDays.forEach(() => pctRow.push(""));
      const sc = students.length;
      visibleSummaryKeys.forEach((key) => {
        const value = key === "total" ? grandJml : colTotals[key as keyof typeof colTotals];
        const pct = (sc > 0 && monthEffDays > 0) ? ((value * 100) / (sc * monthEffDays)).toFixed(1) + "%" : "0%";
        pctRow.push(pct);
      });
      pctRow.push("");

      // Effective days info row
      const effDaysRow: (string | number)[] = ["", `Hari Efektif: ${monthEffDays} hari`, ""];

      const monthHolidays = yearlyData.holidays.filter(h => {
        const hDate = new Date(h.date);
        return hDate.getMonth() === monthIndex && hDate.getFullYear() === year;
      });
      const monthEvents = yearlyData.dayEvents.filter(e => {
        const eDate = new Date(e.date);
        return eDate.getMonth() === monthIndex && eDate.getFullYear() === year;
      });

      const bottomRows: (string | number)[][] = [[""]];
      bottomRows.push(effDaysRow);
      if (monthHolidays.length > 0) {
        bottomRows.push(["Hari Libur Kustom Bulan Ini:"]);
        monthHolidays.forEach(h => bottomRows.push(["", format(new Date(h.date), "d MMMM yyyy", { locale: idLocale }), h.description]));
      }
      if (monthEvents.length > 0) {
        bottomRows.push(["Kegiatan Khusus Bulan Ini:"]);
        monthEvents.forEach(e => bottomRows.push(["", format(new Date(e.date), "d MMMM yyyy", { locale: idLocale }), e.label, e.description || ""]));
      }
      bottomRows.push([""], ["Keterangan Status:"]);
      bottomRows.push(["H = Hadir", "I = Izin", "S = Sakit", "A = Alpha", "D = Dispensasi", "L = Libur"]);
      bottomRows.push([""], ["Rumus Persentase: (Total Status × 100) / (Jumlah Siswa × Hari Efektif)"]);
      bottomRows.push([""], [SIPENA_FULL]);

      const headerRowIdx = 4; // 0-indexed row of dayNameRow (titleRow=0, classRow=1, emptyRow=2, eventRow=3, dayNameRow=4)
      const headerRow2Idx = 5; // dayNumRow
      const numDayCols = visibleDays.length;
      const ws = XLSX.utils.aoa_to_sheet([titleRow, classRow, emptyRow, eventRow, dayNameRow, dayNumRow, ...dataRows, totalRow, pctRow, ...bottomRows]);

      // Merge header cells vertically where row 2 is empty (No, Nama Siswa, NISN, H, S, I, A, D, Jml, Catatan)
      const merges: XLSX.Range[] = [];
      // Cols 0,1,2 = No, Nama Siswa, NISN
      for (let c = 0; c <= 2; c++) {
        merges.push({ s: { r: headerRowIdx, c }, e: { r: headerRow2Idx, c } });
      }
      // Status cols + Jml + Catatan (after day columns)
      const statusStartCol = 3 + numDayCols;
      for (let c = statusStartCol; c <= statusStartCol + visibleSummaryKeys.length; c++) {
        merges.push({ s: { r: headerRowIdx, c }, e: { r: headerRow2Idx, c } });
      }
      ws["!merges"] = merges;

      // Apply background colors for Total and Percentage rows
      const totalRowIdx = 6 + dataRows.length; // 0-indexed
      const pctRowIdx = totalRowIdx + 1;
      const totalColCount = 3 + numDayCols + visibleSummaryKeys.length + 1;
      for (let c = 0; c < totalColCount; c++) {
        const totalAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
        const pctAddr = XLSX.utils.encode_cell({ r: pctRowIdx, c });
        if (ws[totalAddr]) {
          ws[totalAddr].s = { fill: { fgColor: { rgb: "E2E8F0" } }, font: { bold: true } };
        }
        if (ws[pctAddr]) {
          ws[pctAddr].s = { fill: { fgColor: { rgb: "DBEAFE" } }, font: { bold: true } };
        }
      }

      ws["!cols"] = [
        { wch: 5 }, { wch: 28 }, { wch: 15 },
        ...visibleDays.map(() => ({ wch: 4 })),
        ...visibleSummaryKeys.map(() => ({ wch: 5 })),
        { wch: 50 },
      ];
      XLSX.utils.book_append_sheet(wb, ws, monthName);
    });

    const yearlySummaryHeader = ["No", "Nama Siswa", "NISN", ...monthNamesList.map(m => `H-${m.slice(0,3)}`), "Total H", "Total I", "Total S", "Total A", "Total D", "% Kehadiran"];
    const yearlySummaryData: (string | number)[][] = [];
    students.forEach((student, idx) => {
      const row: (string | number)[] = [idx + 1, student.name, student.nisn];
      let totalH = 0, totalI = 0, totalS = 0, totalA = 0, totalD = 0, totalDays = 0;
      monthNamesList.forEach((_, mi) => {
        const mStart = new Date(year, mi, 1);
        const mEnd = endOfMonth(mStart);
        const mDays = eachDayOfInterval({ start: mStart, end: mEnd });
        let mH = 0;
        mDays.forEach(day => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayNum = getDay(day);
          if (dayNum === 0 || (workDayFormat === "5days" && dayNum === 6)) return;
          if (yearlyData.holidays.find(h => h.date === dateStr)) return;
          totalDays++;
          const rec = yearlyData.attendance.find(r => r.student_id === student.id && r.date === dateStr);
          if (rec?.status === "H") { mH++; totalH++; }
          else if (rec?.status === "I") totalI++;
          else if (rec?.status === "S") totalS++;
          else if (rec?.status === "A") totalA++;
          else if (rec?.status === "D") totalD++;
        });
        row.push(mH);
      });
      const pct = totalDays > 0 ? ((totalH / totalDays) * 100).toFixed(1) + "%" : "0%";
      row.push(totalH, totalI, totalS, totalA, totalD, pct);
      yearlySummaryData.push(row);
    });
    const wsYearly = XLSX.utils.aoa_to_sheet([yearlySummaryHeader, ...yearlySummaryData]);
    wsYearly["!cols"] = [{ wch: 5 }, { wch: 28 }, { wch: 15 }, ...monthNamesList.map(() => ({ wch: 8 })), { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }];
    XLSX.utils.book_append_sheet(wb, wsYearly, "Rekap Tahunan");

    XLSX.writeFile(wb, `Presensi_${selectedClass.name}_${year}.xlsx`);
    showSuccess("Berhasil", `File Excel lengkap dengan ${12 + 2} sheet berhasil diunduh`);
    setShowExportDialog(false);
  }, [students, selectedClass, currentMonth, getYearlyData, showSuccess, workDayFormat, signatureConfig, includeSignature, selectedAttendanceColumnKeys, defaultAttendanceVisibleColumnKeys]);

  const handleExportPDF = useCallback(async (
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
  ) => {
    if (!selectedClass) return;
    const exportSignature = signatureOverride ?? normalizeAttendanceSignatureConfig(signatureConfig);
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const fileName = `Presensi_${selectedClass.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}.pdf`;
    await showLoader(fileName);
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const monthStr = format(currentMonth, "MMMM yyyy", { locale: idLocale });

    doc.setFillColor(59, 130, 246);
    doc.rect(0, 0, pageW, 18, "F");
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text("REKAP PRESENSI BULANAN", pageW / 2, 8, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`${selectedClass.name} — ${monthStr}`, pageW / 2, 14, { align: "center" });

    doc.setTextColor(80, 80, 80);
    doc.setFontSize(8);
    doc.text(`Jumlah Siswa: ${students.length}`, 10, 24);
    doc.text(`Format: ${workDayFormat === "5days" ? "5 Hari" : "6 Hari"}  |  Hari Efektif: ${effectiveDays}`, 70, 24);
    doc.text(`Diekspor: ${format(new Date(), "d MMM yyyy HH:mm", { locale: idLocale })}`, pageW - 10, 24, { align: "right" });

    const dayHeaders = monthDays.map(d => format(d, "d"));
    const dayNameHeaders = monthDays.map(d => dayNames[getDay(d)]);
    // Single header row for columns that don't need day sub-row
    // Use columnStyles to handle vertical merge via didParseCell
    const head: string[][] = [
      ["No", "Nama Siswa", ...dayNameHeaders, "H", "S", "I", "A", "D", "Jml"],
      ["", "", ...dayHeaders, "", "", "", "", "", ""],
    ];
    // Track which head columns should be merged (empty in row 2)
    const mergedHeadCols = new Set([0, 1, ...Array.from({ length: 6 }, (_, i) => 2 + monthDays.length + i)]);

    const body: string[][] = [];
    const allNotes: { student: string; date: string; note: string }[] = [];
    const pdfTotals = { H: 0, S: 0, I: 0, A: 0, D: 0 };
    let pdfGrandJml = 0;
    filteredStudents.forEach((student, idx) => {
      const row: string[] = [String(idx + 1), student.name];
        const stats = { H: 0, S: 0, I: 0, A: 0, D: 0 };
      monthDays.forEach(day => {
        if (isHolidayCombined(day)) { row.push("L"); }
        else {
          const st = getAttendance(student.id, day);
          row.push(st || "-");
          if (st && stats.hasOwnProperty(st)) (stats as any)[st]++;
        }
        const note = getAttendanceNote(student.id, day);
        if (note) allNotes.push({ student: student.name, date: format(day, "d MMM", { locale: idLocale }), note });
      });
      const studentJml = stats.S + stats.I + stats.A + stats.D;
      row.push(String(stats.H), String(stats.S), String(stats.I), String(stats.A), String(stats.D), String(studentJml));
      body.push(row);
      pdfTotals.H += stats.H; pdfTotals.S += stats.S; pdfTotals.I += stats.I; pdfTotals.A += stats.A; pdfTotals.D += stats.D;
      pdfGrandJml += studentJml;
    });

    // Add total row
    const pdfTotalRow: string[] = ["", "TOTAL", ...monthDays.map(() => ""),
      String(pdfTotals.H), String(pdfTotals.S), String(pdfTotals.I), String(pdfTotals.A), String(pdfTotals.D), String(pdfGrandJml)];
    body.push(pdfTotalRow);

    // Add percentage row
    const sc2 = filteredStudents.length;
    const pdfPctRow: string[] = ["", "PERSENTASE", ...monthDays.map(() => "")];
    (["H", "S", "I", "A", "D"] as const).forEach(key => {
      const pct = (sc2 > 0 && effectiveDays > 0) ? ((pdfTotals[key] * 100) / (sc2 * effectiveDays)).toFixed(1) + "%" : "0%";
      pdfPctRow.push(pct);
    });
    const pdfTotalPct = (sc2 > 0 && effectiveDays > 0) ? ((pdfGrandJml * 100) / (sc2 * effectiveDays)).toFixed(1) + "%" : "0%";
    pdfPctRow.push(pdfTotalPct);
    body.push(pdfPctRow);

    const totalRowIndex = body.length - 2; // TOTAL row index in body
    const pctRowIndex = body.length - 1; // PERSENTASE row index in body

    autoTable(doc, {
      head,
      body,
      startY: 28,
      margin: { left: 5, right: 5 },
      styles: { fontSize: 5, cellPadding: 0.8, lineWidth: 0.1, lineColor: [200, 200, 200], halign: "center", valign: "middle" },
      headStyles: { fillColor: [59, 130, 246], textColor: [255, 255, 255], fontSize: 5, fontStyle: "bold", halign: "center", valign: "middle" },
      columnStyles: {
        0: { cellWidth: 6, halign: "center", valign: "middle" },
        1: { cellWidth: 28, halign: "left", valign: "middle", overflow: 'linebreak' as any },
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      didParseCell: (data) => {
        // Merge header cells vertically where row 2 is empty
        if (data.section === "head" && mergedHeadCols.has(data.column.index)) {
          if (data.row.index === 0) {
            data.cell.rowSpan = 2;
          } else if (data.row.index === 1) {
            data.cell.text = [];
          }
        }
        // Style Total row
        if (data.section === "body" && data.row.index === totalRowIndex) {
          data.cell.styles.fillColor = [226, 232, 240]; // slate-200
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 41, 59];
        }
        // Style Percentage row
        if (data.section === "body" && data.row.index === pctRowIndex) {
          data.cell.styles.fillColor = [219, 234, 254]; // blue-100
          data.cell.styles.fontStyle = "bold";
          data.cell.styles.textColor = [30, 64, 175];
        }
      },
      didDrawCell: (data) => {
        // Skip custom coloring for Total/Percentage rows (already handled by didParseCell)
        if (data.section === "body" && (data.row.index === totalRowIndex || data.row.index === pctRowIndex)) return;

        if (data.section === "body" && data.column.index >= 2 && data.column.index < 2 + monthDays.length) {
          const val = data.cell.text[0];
          const cx = data.cell.x;
          const cy = data.cell.y;
          const cw = data.cell.width;
          const ch = data.cell.height;
          if (val === "L") { doc.setFillColor(255, 243, 224); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(217, 119, 6); doc.setFontSize(5); doc.text("L", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
          else if (val === "H") { doc.setFillColor(220, 252, 231); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(22, 163, 74); doc.setFontSize(5); doc.text("H", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
          else if (val === "A") { doc.setFillColor(254, 226, 226); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(220, 38, 38); doc.setFontSize(5); doc.text("A", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
          else if (val === "S") { doc.setFillColor(254, 249, 195); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(180, 140, 0); doc.setFontSize(5); doc.text("S", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
          else if (val === "I") { doc.setFillColor(219, 234, 254); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(37, 99, 235); doc.setFontSize(5); doc.text("I", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
          else if (val === "D") { doc.setFillColor(237, 233, 254); doc.rect(cx, cy, cw, ch, "F"); doc.setTextColor(124, 58, 237); doc.setFontSize(5); doc.text("D", cx + cw / 2, cy + ch / 2 + 1, { align: "center" }); }
        }
        if (data.section === "body" && data.column.index >= 2 + monthDays.length) {
          const colIdx = data.column.index - 2 - monthDays.length;
          const colors: [number, number, number][] = [[220,252,231],[254,249,195],[219,234,254],[254,226,226],[237,233,254]];
          if (colIdx >= 0 && colIdx < colors.length) {
            doc.setFillColor(colors[colIdx][0], colors[colIdx][1], colors[colIdx][2]);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
            doc.setTextColor(50, 50, 50);
            doc.setFontSize(5);
            doc.text(data.cell.text[0], data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 1, { align: "center" });
          }
        }
      },
      didDrawPage: (data) => {
        doc.setFontSize(6);
        doc.setTextColor(150, 150, 150);
        doc.text(`Halaman ${data.pageNumber}`, pageW / 2, pageH - 4, { align: "center" });
        doc.text(SIPENA_FULL, 10, pageH - 4);
        doc.text(format(new Date(), "d MMM yyyy", { locale: idLocale }), pageW - 10, pageH - 4, { align: "right" });
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY || 170;
    let legendY = finalY + 5;
    if (legendY > pageH - 30) { doc.addPage(); legendY = 12; }

    doc.setFillColor(245, 247, 250);
    doc.roundedRect(8, legendY - 3, pageW - 16, 12, 2, 2, "F");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(50, 50, 50);
    doc.text("Keterangan Status:", 12, legendY + 1);
    const legendItems = [
      { label: "H = Hadir", color: [22, 163, 74] as [number, number, number] },
      { label: "I = Izin", color: [37, 99, 235] as [number, number, number] },
      { label: "S = Sakit", color: [180, 140, 0] as [number, number, number] },
      { label: "A = Alpha", color: [220, 38, 38] as [number, number, number] },
      { label: "D = Dispensasi", color: [124, 58, 237] as [number, number, number] },
      { label: "L = Libur", color: [217, 119, 6] as [number, number, number] },
    ];
    let legendX = 50;
    doc.setFont("helvetica", "normal");
    legendItems.forEach(({ label, color }) => {
      doc.setFillColor(color[0], color[1], color[2]);
      doc.circle(legendX + 1.5, legendY + 0.5, 1.2, "F");
      doc.setTextColor(60, 60, 60);
      doc.text(label, legendX + 4, legendY + 1);
      legendX += 30;
    });
    legendY += 12;

    const monthEventsForPDF = dayEvents.filter(e => {
      const eDate = new Date(e.date);
      return eDate.getMonth() === currentMonth.getMonth() && eDate.getFullYear() === currentMonth.getFullYear();
    });
    if (monthEventsForPDF.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(50, 50, 50);
      doc.text("Kegiatan Khusus:", 12, legendY);
      doc.setFont("helvetica", "normal");
      legendY += 3.5;
      monthEventsForPDF.forEach(ev => {
        if (legendY > pageH - 8) { doc.addPage(); legendY = 12; }
        doc.setFillColor(59, 130, 246);
        doc.circle(13, legendY - 0.8, 0.8, "F");
        doc.setTextColor(60, 60, 60);
        doc.text(`${format(new Date(ev.date), "d MMM", { locale: idLocale })}: ${ev.label}${ev.description ? ` — ${ev.description}` : ""}`, 16, legendY);
        legendY += 3;
      });
      legendY += 2;
    }

    const monthHolidaysForPDF = holidays.filter(h => {
      const hDate = new Date(h.date);
      return hDate.getMonth() === currentMonth.getMonth() && hDate.getFullYear() === currentMonth.getFullYear();
    });
    if (monthHolidaysForPDF.length > 0) {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(50, 50, 50);
      doc.text("Hari Libur Kustom:", 12, legendY);
      doc.setFont("helvetica", "normal");
      legendY += 3.5;
      monthHolidaysForPDF.forEach(h => {
        if (legendY > pageH - 8) { doc.addPage(); legendY = 12; }
        doc.setFillColor(217, 119, 6);
        doc.circle(13, legendY - 0.8, 0.8, "F");
        doc.setTextColor(60, 60, 60);
        doc.text(`${format(new Date(h.date), "d MMM", { locale: idLocale })}: ${h.description}`, 16, legendY);
        legendY += 3;
      });
      legendY += 2;
    }

    if (allNotes.length > 0) {
      if (legendY > pageH - 15) { doc.addPage(); legendY = 12; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(50, 50, 50);
      doc.text("Catatan Per Siswa:", 12, legendY);
      doc.setFont("helvetica", "normal");
      legendY += 3.5;
      allNotes.forEach(n => {
        if (legendY > pageH - 8) { doc.addPage(); legendY = 12; }
        doc.setTextColor(80, 80, 80);
        doc.text(`• ${n.student} (${n.date}): ${n.note}`, 14, legendY);
        legendY += 3;
      });
    }

    if (shouldIncludeSignature && exportSignature) {
      addSignatureBlockPDF(doc, {
        city: exportSignature.city,
        signers: exportSignature.signers,
        useCustomDate: exportSignature.useCustomDate,
        customDate: exportSignature.customDate,
        fontSize: exportSignature.fontSize,
        showSignatureLine: exportSignature.showSignatureLine,
        signatureLinePosition: exportSignature.signatureLinePosition,
        signatureLineWidth: exportSignature.signatureLineWidth,
        signatureSpacing: exportSignature.signatureSpacing,
        signatureAlignment: exportSignature.signatureAlignment,
        signatureOffsetX: exportSignature.signatureOffsetX,
        signatureOffsetY: exportSignature.signatureOffsetY,
      }, legendY);
    }

    doc.save(`Presensi_${selectedClass.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}.pdf`);
    showSuccess("Berhasil", "File PDF berhasil diunduh");
    setShowExportDialog(false);
  }, [selectedClass, currentMonth, monthDays, filteredStudents, students, isHoliday, getAttendance, getAttendanceNote, showSuccess, dayEvents, holidays, workDayFormat, includeSignature, signatureConfig, effectiveDays]);

  const handleExportPNG = useCallback(async (
    quality: "4k" | "hd" = "hd",
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
  ) => {
    if (!selectedClass) return;
    const exportSignature = signatureOverride ?? normalizeAttendanceSignatureConfig(signatureConfig);
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const fileName = `Presensi_${selectedClass.name}_${quality.toUpperCase()}.png`;
    await showLoader(fileName);
    const scale = quality === "4k" ? 5 : 2;
    const monthStr = format(currentMonth, "MMMM yyyy", { locale: idLocale });

    // Sanitize text to prevent XSS in innerHTML
    const sanitize = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c] || c));

    import("html2canvas").then(({ default: html2canvas }) => {
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;left:-9999px;top:0;background:#ffffff;font-family:'Segoe UI',system-ui,-apple-system,sans-serif;padding:0;width:max-content;min-width:900px;";

      const header = document.createElement("div");
      header.style.cssText = "background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:20px 28px;";
      header.innerHTML = `
        <div style="font-size:20px;font-weight:800;letter-spacing:0.5px;">REKAP PRESENSI BULANAN</div>
        <div style="font-size:13px;margin-top:6px;opacity:0.9;">${selectedClass.name} — ${monthStr}</div>
        <div style="font-size:10px;margin-top:3px;opacity:0.7;">${SIPENA_FULL}</div>
      `;
      wrapper.appendChild(header);

      const info = document.createElement("div");
      info.style.cssText = "display:flex;justify-content:space-between;padding:10px 28px;font-size:11px;color:#6b7280;background:#f1f5f9;border-bottom:2px solid #e2e8f0;";
      info.innerHTML = `<span>👥 Jumlah Siswa: <b>${students.length}</b></span><span>📅 Format: <b>${workDayFormat === "5days" ? "5 Hari" : "6 Hari"}</b></span><span>📊 Hari Efektif: <b>${effectiveDays} hari</b></span><span>🕐 Diekspor: <b>${format(new Date(), "d MMM yyyy HH:mm", { locale: idLocale })}</b></span><span>📐 Kualitas: <b>${quality === "4k" ? "4K Ultra HD" : "HD"}</b></span>`;
      wrapper.appendChild(info);

      const table = document.createElement("table");
      table.style.cssText = "border-collapse:collapse;width:100%;font-size:11px;";

      let headerRow1 = "<tr style='background:#2563eb;color:#fff;'>";
      headerRow1 += "<th rowspan='2' style='padding:6px 8px;text-align:center;border:1px solid #1d4ed8;min-width:30px;font-size:10px;vertical-align:middle;'>No</th>";
      headerRow1 += "<th rowspan='2' style='padding:6px 8px;text-align:left;border:1px solid #1d4ed8;min-width:120px;font-size:10px;vertical-align:middle;'>Nama Siswa</th>";
      monthDays.forEach(day => {
        const dayNum = getDay(day);
        const isSun = dayNum === 0;
        const ev = getExistingEventForDate(day);
        const hol = isHolidayCombined(day);
        let bgColor = "#2563eb";
        if (hol) bgColor = "#d97706";
        else if (isSun) bgColor = "#dc2626";
        else if (ev) bgColor = "#7c3aed";
        headerRow1 += `<th style='padding:4px 2px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:${bgColor};' title='${ev ? ev.label : ""}'>${dayNames[dayNum]}</th>`;
      });
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:#16a34a;vertical-align:middle;'>H</th>";
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:#ca8a04;vertical-align:middle;'>S</th>";
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:#2563eb;vertical-align:middle;'>I</th>";
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:#dc2626;vertical-align:middle;'>A</th>";
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:24px;font-size:9px;background:#7c3aed;vertical-align:middle;'>D</th>";
      headerRow1 += "<th rowspan='2' style='padding:4px 3px;text-align:center;border:1px solid #1d4ed8;min-width:28px;font-size:9px;background:#334155;vertical-align:middle;'>Jml</th>";
      headerRow1 += "</tr>";

      // Second header row - only day numbers
      let headerRow2 = "<tr style='background:#3b82f6;color:#fff;'>";
      monthDays.forEach(day => {
        headerRow2 += `<th style='padding:2px 2px;text-align:center;border:1px solid #1d4ed8;font-size:11px;font-weight:800;'>${format(day, "d")}</th>`;
      });
      headerRow2 += "</tr>";

      let bodyRows = "";
      const allNotes: { student: string; date: string; note: string }[] = [];
      const pngTotals = { H: 0, S: 0, I: 0, A: 0, D: 0 };
      let pngGrandJml = 0;
      filteredStudents.forEach((student, idx) => {
        const rowBg = idx % 2 === 0 ? "#ffffff" : "#f8fafc";
        let row = `<tr style='background:${rowBg};'>`;
        row += `<td style='padding:4px 8px;border:1px solid #e2e8f0;text-align:center;font-weight:600;color:#6b7280;font-size:10px;'>${idx + 1}</td>`;
        row += `<td style='padding:4px 8px;border:1px solid #e2e8f0;text-align:left;font-weight:500;font-size:11px;max-width:160px;word-wrap:break-word;overflow-wrap:break-word;white-space:normal;line-height:1.3;'>${sanitize(student.name)}</td>`;
        const stats = { H: 0, S: 0, I: 0, A: 0, D: 0 };
        monthDays.forEach(day => {
          const hol = isHolidayCombined(day);
          if (hol) {
            row += `<td style='padding:2px;border:1px solid #e2e8f0;text-align:center;background:#fff7ed;color:#d97706;font-weight:700;font-size:10px;'>L</td>`;
          } else {
            const st = getAttendance(student.id, day);
            const note = getAttendanceNote(student.id, day);
            if (note) allNotes.push({ student: student.name, date: format(day, "d MMM", { locale: idLocale }), note });
            let cellBg = "transparent";
            let cellColor = "#9ca3af";
            let cellText = st || "–";
            if (st === "H") { cellBg = "#dcfce7"; cellColor = "#16a34a"; stats.H++; }
            else if (st === "I") { cellBg = "#dbeafe"; cellColor = "#2563eb"; stats.I++; }
            else if (st === "S") { cellBg = "#fef9c3"; cellColor = "#ca8a04"; stats.S++; }
            else if (st === "A") { cellBg = "#fee2e2"; cellColor = "#dc2626"; stats.A++; }
            else if (st === "D") { cellBg = "#ede9fe"; cellColor = "#7c3aed"; stats.D++; }
            row += `<td style='padding:2px;border:1px solid #e2e8f0;text-align:center;background:${cellBg};color:${cellColor};font-weight:700;font-size:10px;'>${cellText}${note ? " 💬" : ""}</td>`;
          }
        });
        const studentJml = stats.S + stats.I + stats.A + stats.D;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#dcfce7;color:#16a34a;font-weight:700;font-size:10px;'>${stats.H}</td>`;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#fef9c3;color:#ca8a04;font-weight:700;font-size:10px;'>${stats.S}</td>`;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#dbeafe;color:#2563eb;font-weight:700;font-size:10px;'>${stats.I}</td>`;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#fee2e2;color:#dc2626;font-weight:700;font-size:10px;'>${stats.A}</td>`;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#ede9fe;color:#7c3aed;font-weight:700;font-size:10px;'>${stats.D}</td>`;
        row += `<td style='padding:2px 4px;border:1px solid #e2e8f0;text-align:center;background:#f1f5f9;color:#1e293b;font-weight:800;font-size:10px;'>${studentJml}</td>`;
        row += "</tr>";
        bodyRows += row;
        pngTotals.H += stats.H; pngTotals.S += stats.S; pngTotals.I += stats.I; pngTotals.A += stats.A; pngTotals.D += stats.D;
        pngGrandJml += studentJml;
      });

      // Total row
      let totalRowHtml = "<tr style='background:#e2e8f0;'>";
      totalRowHtml += `<td colspan='2' style='padding:4px 8px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:11px;color:#1e293b;'>TOTAL</td>`;
      monthDays.forEach(() => { totalRowHtml += `<td style='border:1px solid #cbd5e1;'></td>`; });
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:10px;color:#16a34a;'>${pngTotals.H}</td>`;
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:10px;color:#ca8a04;'>${pngTotals.S}</td>`;
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:10px;color:#2563eb;'>${pngTotals.I}</td>`;
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:10px;color:#dc2626;'>${pngTotals.A}</td>`;
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:800;font-size:10px;color:#7c3aed;'>${pngTotals.D}</td>`;
      totalRowHtml += `<td style='padding:2px 4px;border:1px solid #cbd5e1;text-align:center;font-weight:900;font-size:11px;color:#1e293b;'>${pngGrandJml}</td>`;
      totalRowHtml += "</tr>";

      // Percentage row
      const pngSc = filteredStudents.length;
      let pctRowHtml = "<tr style='background:#dbeafe;'>";
      pctRowHtml += `<td colspan='2' style='padding:4px 8px;border:1px solid #93c5fd;text-align:center;font-weight:800;font-size:10px;color:#1e40af;'>PERSENTASE (%)</td>`;
      monthDays.forEach(() => { pctRowHtml += `<td style='border:1px solid #93c5fd;'></td>`; });
      (["H", "S", "I", "A", "D"] as const).forEach(key => {
        const pct = (pngSc > 0 && effectiveDays > 0) ? ((pngTotals[key] * 100) / (pngSc * effectiveDays)).toFixed(1) + "%" : "0%";
        pctRowHtml += `<td style='padding:2px 4px;border:1px solid #93c5fd;text-align:center;font-weight:700;font-size:9px;color:#1e40af;'>${pct}</td>`;
      });
      const pngTotalPct = (pngSc > 0 && effectiveDays > 0) ? ((pngGrandJml * 100) / (pngSc * effectiveDays)).toFixed(1) + "%" : "0%";
      pctRowHtml += `<td style='padding:2px 4px;border:1px solid #93c5fd;text-align:center;font-weight:800;font-size:10px;color:#1e40af;'>${pngTotalPct}</td>`;
      pctRowHtml += "</tr>";

      table.innerHTML = `<thead>${headerRow1}${headerRow2}</thead><tbody>${bodyRows}${totalRowHtml}${pctRowHtml}</tbody>`;
      wrapper.appendChild(table);

      const legend = document.createElement("div");
      legend.style.cssText = "padding:12px 28px 10px;font-size:11px;color:#1e293b;";
      const legendHtml = `<div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <span style="font-weight:700;">Keterangan:</span>
        <span style="background:#dcfce7;padding:2px 8px;border-radius:4px;border:1px solid #bbf7d0;"><b style="color:#16a34a;">H</b> = Hadir</span>
        <span style="background:#dbeafe;padding:2px 8px;border-radius:4px;border:1px solid #bfdbfe;"><b style="color:#2563eb;">I</b> = Izin</span>
        <span style="background:#fef9c3;padding:2px 8px;border-radius:4px;border:1px solid #fde68a;"><b style="color:#ca8a04;">S</b> = Sakit</span>
        <span style="background:#fee2e2;padding:2px 8px;border-radius:4px;border:1px solid #fecaca;"><b style="color:#dc2626;">A</b> = Alpha</span>
        <span style="background:#ede9fe;padding:2px 8px;border-radius:4px;border:1px solid #ddd6fe;"><b style="color:#7c3aed;">D</b> = Dispensasi</span>
        <span style="background:#fff7ed;padding:2px 8px;border-radius:4px;border:1px solid #fed7aa;"><b style="color:#d97706;">L</b> = Libur</span>
      </div>`;
      legend.innerHTML = legendHtml;

      const monthEventsForPNG = dayEvents.filter(e => {
        const eDate = new Date(e.date);
        return eDate.getMonth() === currentMonth.getMonth() && eDate.getFullYear() === currentMonth.getFullYear();
      });
      if (monthEventsForPNG.length > 0) {
        const evDiv = document.createElement("div");
        evDiv.style.cssText = "padding:8px 0 6px;font-size:11px;color:#1e293b;border-top:1px solid #e2e8f0;margin-top:8px;";
        evDiv.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">📌 Kegiatan Khusus:</div>` +
          monthEventsForPNG.map(e => `<div style="padding:2px 0;margin-left:8px;"><span style="background:#dbeafe;padding:2px 8px;border-radius:4px;font-size:10px;border:1px solid #bfdbfe;">${format(new Date(e.date), "d MMM", { locale: idLocale })}: <b>${e.label}</b>${e.description ? ` — ${e.description}` : ""}</span></div>`).join("");
        legend.appendChild(evDiv);
      }

      const monthHolidaysForPNG = holidays.filter(h => {
        const hDate = new Date(h.date);
        return hDate.getMonth() === currentMonth.getMonth() && hDate.getFullYear() === currentMonth.getFullYear();
      });
      if (monthHolidaysForPNG.length > 0) {
        const holDiv = document.createElement("div");
        holDiv.style.cssText = "padding:6px 0 4px;font-size:11px;color:#1e293b;border-top:1px solid #e2e8f0;margin-top:6px;";
        holDiv.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">🔴 Hari Libur Kustom:</div>` +
          monthHolidaysForPNG.map(h => `<div style="padding:2px 0;margin-left:8px;"><span style="background:#fff7ed;padding:2px 8px;border-radius:4px;font-size:10px;border:1px solid #fed7aa;">${format(new Date(h.date), "d MMM", { locale: idLocale })}: <b>${h.description}</b></span></div>`).join("");
        legend.appendChild(holDiv);
      }

      if (allNotes.length > 0) {
        const noteDiv = document.createElement("div");
        noteDiv.style.cssText = "padding:8px 0 0;font-size:11px;color:#1e293b;border-top:1px solid #e2e8f0;margin-top:6px;";
        noteDiv.innerHTML = `<div style="font-weight:700;margin-bottom:4px;">💬 Catatan Per Siswa:</div>` +
          allNotes.map(n => `<div style="padding:1px 0;color:#4b5563;font-size:10px;margin-left:8px;">• <b>${n.student}</b> (${n.date}): ${n.note}</div>`).join("");
        legend.appendChild(noteDiv);
      }

      // ═══ Layout: Keterangan + Signature side-by-side jika ada TTD ═══
      if (shouldIncludeSignature && exportSignature) {
        // Buat container flex: keterangan di kiri, TTD di kanan
        const bottomSection = document.createElement("div");
        bottomSection.style.cssText = "display:flex;align-items:flex-start;gap:16px;padding:0 28px 8px;";

        // Keterangan di kiri (flex-grow)
        legend.style.cssText = "flex:1;min-width:0;font-size:11px;color:#1e293b;padding:12px 0 4px;";
        bottomSection.appendChild(legend);

        // TTD di kanan (flex-shrink-0)
        const sigBlock = document.createElement("div");
        sigBlock.style.cssText = "flex-shrink:0;padding-top:12px;";
        sigBlock.innerHTML = generateSignatureHTMLInline(exportSignature);
        bottomSection.appendChild(sigBlock);

        wrapper.appendChild(bottomSection);
      } else {
        // Tanpa TTD, keterangan biasa full width
        wrapper.appendChild(legend);
      }

      const footer = document.createElement("div");
      footer.style.cssText = "text-align:center;padding:10px 28px;font-size:10px;color:#94a3b8;border-top:2px solid #e2e8f0;background:#f8fafc;";
      footer.textContent = `${SIPENA_FULL} • Diekspor ${format(new Date(), "d MMMM yyyy HH:mm", { locale: idLocale })} • Kualitas: ${quality === "4k" ? "4K Ultra HD" : "HD"}`;
      wrapper.appendChild(footer);

      document.body.appendChild(wrapper);

      html2canvas(wrapper, { backgroundColor: "#ffffff", scale, useCORS: true, width: wrapper.scrollWidth, height: wrapper.scrollHeight }).then(canvas => {
        document.body.removeChild(wrapper);
        const link = document.createElement("a");
        const qualityLabel = quality === "4k" ? "_4K" : "_HD";
        link.download = `Presensi_${selectedClass?.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}${qualityLabel}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        showSuccess("Berhasil", `File PNG ${quality === "4k" ? "4K Ultra HD" : "HD"} berhasil diunduh`);
        setShowExportDialog(false);
      }).catch(() => {
        document.body.removeChild(wrapper);
        showWarning("Gagal", "Tidak dapat mengekspor PNG.");
      });
    }).catch(() => {
      showWarning("Gagal", "Tidak dapat mengekspor PNG.");
    });
  }, [selectedClass, currentMonth, showSuccess, showWarning, dayEvents, holidays, students, filteredStudents, monthDays, getAttendance, getAttendanceNote, isHoliday, getExistingEventForDate, workDayFormat, includeSignature, signatureConfig]);

  const handleExportPDFV2 = useCallback(async (
    signatureOverride?: typeof signatureConfig,
    includeSignatureOverride?: boolean,
    styleOverride?: ReportDocumentStyle,
    _autoFitOverride?: boolean,
    paperSizeOverride?: ReportPaperSize,
    visibleColumnKeysOverride?: string[],
  ) => {
    if (!selectedClass) return;
    const exportSignature = signatureOverride ?? attendanceDefaultSignatureConfig;
    const shouldIncludeSignature = includeSignatureOverride ?? includeSignature;
    const exportPaperSize = paperSizeOverride ?? paperSize;
    const exportStyle = styleOverride ?? documentStyle;
    const exportVisibleColumnKeys = visibleColumnKeysOverride ?? selectedAttendanceColumnKeys;
    const fileName = `Presensi_${selectedClass.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}.pdf`;
    await showLoader(fileName);

    try {
      // Resolve visible columns
      const visibleSet = new Set(
        exportVisibleColumnKeys.length > 0
          ? exportVisibleColumnKeys
          : ["no", "name", "nisn", ...attendancePreviewData.days.map((d) => d.key), "H", "S", "I", "A", "D", "total"],
      );

      const visibleDays = attendancePreviewData.days.filter((d) => visibleSet.has(d.key));
      const rekapKeys = (["H", "S", "I", "A", "D", "total"] as const).filter((k) => visibleSet.has(k));
      const totalCols = visibleDays.length + (visibleSet.has("no") ? 1 : 0) + (visibleSet.has("name") ? 1 : 0) + (visibleSet.has("nisn") ? 1 : 0) + rekapKeys.length;

      // Choose paper size
      const paper = resolveReportPaperSize(exportPaperSize, {
        orientation: "landscape",
        requiredContentWidthMm: totalCols * 6 + 40,
      });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: paper.pdfFormat });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const monthStr = format(currentMonth, "MMMM yyyy", { locale: idLocale });

      // ── Header ──
      doc.setFillColor(59, 130, 246);
      doc.rect(0, 0, pageW, 16, "F");
      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.text("REKAP PRESENSI BULANAN", pageW / 2, 7, { align: "center" });
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(`${selectedClass.name} — ${monthStr}`, pageW / 2, 12.5, { align: "center" });

      // ── Meta ──
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(7);
      doc.text(`Jumlah Siswa: ${filteredStudents.length}`, 8, 21);
      doc.text(`Format: ${workDayFormat === "5days" ? "5 Hari" : "6 Hari"}  |  Hari Efektif: ${effectiveDays}`, 60, 21);
      doc.text(`Diekspor: ${format(new Date(), "d MMM yyyy HH:mm", { locale: idLocale })}`, pageW - 8, 21, { align: "right" });

      // ── Build table data ──
      const headRow1: string[] = [];
      const headRow2: string[] = [];
      const mergedHeadCols = new Set<number>();
      let colIdx = 0;

      if (visibleSet.has("no")) { headRow1.push("No"); headRow2.push(""); mergedHeadCols.add(colIdx); colIdx++; }
      if (visibleSet.has("name")) { headRow1.push("Nama Siswa"); headRow2.push(""); mergedHeadCols.add(colIdx); colIdx++; }
      if (visibleSet.has("nisn")) { headRow1.push("NISN"); headRow2.push(""); mergedHeadCols.add(colIdx); colIdx++; }

      visibleDays.forEach((day) => {
        headRow1.push(day.dayName);
        headRow2.push(day.dateLabel);
        colIdx++;
      });

      rekapKeys.forEach((key) => {
        headRow1.push(key === "total" ? "Jml" : key);
        headRow2.push("");
        mergedHeadCols.add(colIdx);
        colIdx++;
      });

      const bodyData: string[][] = [];
      const pdfTotals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0, total: 0 };

      attendancePreviewData.rows.forEach((row) => {
        const rowData: string[] = [];
        if (visibleSet.has("no")) rowData.push(String(row.number));
        if (visibleSet.has("name")) rowData.push(row.name);
        if (visibleSet.has("nisn")) rowData.push(row.nisn);

        visibleDays.forEach((day) => {
          const dayIndex = attendancePreviewData.days.findIndex((d) => d.key === day.key);
          const cell = row.cells[dayIndex];
          rowData.push(cell?.value ?? "-");
        });

        rekapKeys.forEach((key) => {
          const val = row.totals[key as keyof typeof row.totals] ?? 0;
          rowData.push(String(val));
          pdfTotals[key] = (pdfTotals[key] || 0) + val;
        });

        bodyData.push(rowData);
      });

      // Total row
      const totalRow: string[] = [];
      if (visibleSet.has("no")) totalRow.push("");
      if (visibleSet.has("name")) totalRow.push("TOTAL");
      if (visibleSet.has("nisn")) totalRow.push("");
      visibleDays.forEach(() => totalRow.push(""));
      rekapKeys.forEach((key) => totalRow.push(String(pdfTotals[key] || 0)));
      bodyData.push(totalRow);

      // Percentage row
      const pctRow: string[] = [];
      if (visibleSet.has("no")) pctRow.push("");
      if (visibleSet.has("name")) pctRow.push("PERSENTASE");
      if (visibleSet.has("nisn")) pctRow.push("");
      visibleDays.forEach(() => pctRow.push(""));
      const sc = filteredStudents.length;
      rekapKeys.forEach((key) => {
        if (key === "total") {
          const pct = (sc > 0 && effectiveDays > 0) ? ((pdfTotals.total * 100) / (sc * effectiveDays)).toFixed(1) + "%" : "0%";
          pctRow.push(pct);
        } else {
          const pct = (sc > 0 && effectiveDays > 0) ? (((pdfTotals[key] || 0) * 100) / (sc * effectiveDays)).toFixed(1) + "%" : "0%";
          pctRow.push(pct);
        }
      });
      bodyData.push(pctRow);

      const totalRowIndex = bodyData.length - 2;
      const pctRowIndex = bodyData.length - 1;

      // ── Auto-scale font to fit 1 page ──
      const marginLR = 5;
      const tableStartY = 24;
      const signatureReserve = shouldIncludeSignature ? 38 : 0;
      const legendReserve = 14;
      const footerReserve = 8;
      const availableWidth = pageW - marginLR * 2;

      let fontSize = 5;
      const columnLayout = computeAttendanceColumnLayout({
        rows: attendancePreviewData.rows.map((row) => ({ name: row.name, nisn: row.nisn })),
        visibleDayCount: visibleDays.length,
        visibleRekapCount: rekapKeys.length,
        availableWidthMm: availableWidth,
        includeNo: visibleSet.has("no"),
        includeName: visibleSet.has("name"),
        includeNisn: visibleSet.has("nisn"),
        documentStyle: exportStyle,
      });
      const noColWidth = visibleSet.has("no") ? columnLayout.noWidthMm : 0;
      const nameColWidth = visibleSet.has("name") ? columnLayout.nameWidthMm : 0;
      const nisnColWidth = visibleSet.has("nisn") ? columnLayout.nisnWidthMm : 0;
      const rekapColWidth = columnLayout.rekapWidthMm;
      const dayColWidth = columnLayout.dayWidthMm;
      const dayColCount = visibleDays.length;

      // Build column styles
      const columnStyles: Record<number, object> = {};
      let ci = 0;
      if (visibleSet.has("no")) { columnStyles[ci] = { cellWidth: noColWidth, halign: "center" }; ci++; }
      if (visibleSet.has("name")) { columnStyles[ci] = { cellWidth: nameColWidth, halign: "left", overflow: "linebreak", cellPadding: { top: 0.6, right: 1.1, bottom: 0.6, left: 1.1 } }; ci++; }
      if (visibleSet.has("nisn")) { columnStyles[ci] = { cellWidth: nisnColWidth, halign: "center", overflow: "linebreak" }; ci++; }
      visibleDays.forEach(() => { columnStyles[ci] = { cellWidth: dayColWidth, halign: "center" }; ci++; });
      rekapKeys.forEach(() => { columnStyles[ci] = { cellWidth: rekapColWidth, halign: "center" }; ci++; });

      // Status cell colors
      const statusColors: Record<string, { fill: [number, number, number]; text: [number, number, number] }> = {
        L: { fill: [255, 243, 224], text: [217, 119, 6] },
        H: { fill: [220, 252, 231], text: [22, 163, 74] },
        A: { fill: [254, 226, 226], text: [220, 38, 38] },
        S: { fill: [254, 249, 195], text: [180, 140, 0] },
        I: { fill: [219, 234, 254], text: [37, 99, 235] },
        D: { fill: [237, 233, 254], text: [124, 58, 237] },
      };

      const fixedColCount = (visibleSet.has("no") ? 1 : 0) + (visibleSet.has("name") ? 1 : 0) + (visibleSet.has("nisn") ? 1 : 0);
      const dayStartIdx = fixedColCount;
      const dayEndIdx = dayStartIdx + dayColCount;
      const rekapStartIdx = dayEndIdx;

      autoTable(doc, {
        head: [headRow1, headRow2],
        body: bodyData,
        startY: tableStartY,
        margin: { left: marginLR, right: marginLR, bottom: signatureReserve + legendReserve + footerReserve },
        styles: {
          fontSize,
          cellPadding: 0.6,
          lineWidth: 0.1,
          lineColor: [200, 200, 200],
          halign: "center",
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontSize,
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
        },
        columnStyles,
        alternateRowStyles: { fillColor: [245, 247, 250] },
        pageBreak: "avoid",
        rowPageBreak: "avoid",
        didParseCell: (data) => {
          if (data.section === "head" && mergedHeadCols.has(data.column.index)) {
            if (data.row.index === 0) data.cell.rowSpan = 2;
            else if (data.row.index === 1) data.cell.text = [];
          }
          // Holiday header coloring
          if (data.section === "head" && data.column.index >= dayStartIdx && data.column.index < dayEndIdx) {
            const dayIdx = data.column.index - dayStartIdx;
            const day = visibleDays[dayIdx];
            if (day?.isHoliday) data.cell.styles.fillColor = [245, 158, 11];
            else if (day?.hasEvent) data.cell.styles.fillColor = [124, 58, 237];
          }
          if (data.section === "body" && data.row.index === totalRowIndex) {
            data.cell.styles.fillColor = [226, 232, 240];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [30, 41, 59];
          }
          if (data.section === "body" && data.row.index === pctRowIndex) {
            data.cell.styles.fillColor = [219, 234, 254];
            data.cell.styles.fontStyle = "bold";
            data.cell.styles.textColor = [30, 64, 175];
          }
        },
        didDrawCell: (data) => {
          if (data.section === "body" && (data.row.index === totalRowIndex || data.row.index === pctRowIndex)) return;
          if (data.section === "body" && data.column.index >= dayStartIdx && data.column.index < dayEndIdx) {
            const val = data.cell.text[0];
            const sc2 = statusColors[val];
            if (sc2) {
              doc.setFillColor(sc2.fill[0], sc2.fill[1], sc2.fill[2]);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              doc.setTextColor(sc2.text[0], sc2.text[1], sc2.text[2]);
              doc.setFontSize(fontSize);
              doc.text(val, data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 0.8, { align: "center" });
            }
          }
          // Rekap columns light color
          if (data.section === "body" && data.column.index >= rekapStartIdx) {
            const rekapIdx = data.column.index - rekapStartIdx;
            const rekapColors: [number, number, number][] = [[220,252,231],[254,249,195],[219,234,254],[254,226,226],[237,233,254],[240,240,240]];
            if (rekapIdx < rekapColors.length) {
              doc.setFillColor(rekapColors[rekapIdx][0], rekapColors[rekapIdx][1], rekapColors[rekapIdx][2]);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, "F");
              doc.setTextColor(50, 50, 50);
              doc.setFontSize(fontSize);
              doc.text(data.cell.text[0] || "", data.cell.x + data.cell.width / 2, data.cell.y + data.cell.height / 2 + 0.8, { align: "center" });
            }
          }
        },
        didDrawPage: (data) => {
          doc.setFontSize(6);
          doc.setTextColor(150, 150, 150);
          doc.text(`Halaman ${data.pageNumber}`, pageW / 2, pageH - 4, { align: "center" });
          doc.text(SIPENA_FULL, 8, pageH - 4);
        },
      });

      const finalY = (doc as any).lastAutoTable?.finalY || 170;
      let legendY = finalY + 4;

      // Legend
      doc.setFillColor(245, 247, 250);
      doc.roundedRect(6, legendY - 2, pageW - 12, 10, 1.5, 1.5, "F");
      doc.setFontSize(6);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(50, 50, 50);
      doc.text("Keterangan:", 10, legendY + 1);
      const legendItems = [
        { label: "H=Hadir", color: [22, 163, 74] as [number, number, number] },
        { label: "I=Izin", color: [37, 99, 235] as [number, number, number] },
        { label: "S=Sakit", color: [180, 140, 0] as [number, number, number] },
        { label: "A=Alpha", color: [220, 38, 38] as [number, number, number] },
        { label: "D=Dispensasi", color: [124, 58, 237] as [number, number, number] },
        { label: "L=Libur", color: [217, 119, 6] as [number, number, number] },
      ];
      let legendX = 30;
      doc.setFont("helvetica", "normal");
      legendItems.forEach(({ label, color }) => {
        doc.setFillColor(color[0], color[1], color[2]);
        doc.circle(legendX + 1, legendY + 0.5, 0.8, "F");
        doc.setTextColor(60, 60, 60);
        doc.text(label, legendX + 2.5, legendY + 1);
        legendX += 22;
      });
      legendY += 10;

      // Signature
      if (shouldIncludeSignature && exportSignature) {
        addSignatureBlockPDF(doc, {
          city: exportSignature.city,
          signers: exportSignature.signers,
          useCustomDate: exportSignature.useCustomDate,
          customDate: exportSignature.customDate,
          fontSize: exportSignature.fontSize,
          showSignatureLine: exportSignature.showSignatureLine,
          signatureLinePosition: exportSignature.signatureLinePosition,
          signatureLineWidth: exportSignature.signatureLineWidth,
          signatureSpacing: exportSignature.signatureSpacing,
          signatureAlignment: exportSignature.signatureAlignment,
          signatureOffsetX: exportSignature.signatureOffsetX,
          signatureOffsetY: exportSignature.signatureOffsetY,
        }, legendY);
      }

      doc.save(fileName);
      showSuccess("Berhasil", "File PDF berhasil diunduh");
      setShowExportDialog(false);
    } catch (error) {
      console.error("PDF export error:", error);
      showWarning("Gagal", "Tidak dapat mengekspor PDF presensi.");
    }
  }, [selectedAttendanceColumnKeys, selectedClass, signatureConfig, includeSignature, paperSize, documentStyle, currentMonth, showLoader, attendancePreviewData, filteredStudents, effectiveDays, workDayFormat, showSuccess, showWarning]);

  const handleExportPDFPreviewV2 = useCallback(async (
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
    const fileName = `Presensi_${selectedClass.name}_${format(currentMonth, "MMMM_yyyy", { locale: idLocale })}.pdf`;
    await showLoader(fileName);

    try {
      const visibleSet = new Set(
        exportVisibleColumnKeys.length > 0
          ? exportVisibleColumnKeys
          : ["no", "name", "nisn", ...attendancePreviewData.days.map((d) => d.key), "H", "S", "I", "A", "D", "total"],
      );
      const totalCols = attendancePreviewData.days.filter((d) => visibleSet.has(d.key)).length
        + (visibleSet.has("no") ? 1 : 0)
        + (visibleSet.has("name") ? 1 : 0)
        + (visibleSet.has("nisn") ? 1 : 0)
        + ["H", "S", "I", "A", "D", "total"].filter((k) => visibleSet.has(k)).length;

      const paper = resolveReportPaperSize(exportPaperSize, {
        orientation: "landscape",
        requiredContentWidthMm: totalCols * 6 + 40,
      });
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: paper.pdfFormat });
      const { default: html2canvasLib } = await import("html2canvas");

      const wrapper = document.createElement("div");
      wrapper.style.cssText = "position:absolute;left:-99999px;top:0;background:#f8fafc;padding:0;width:max-content;";
      wrapper.innerHTML = renderAttendanceExportElement(
        exportSignature,
        shouldIncludeSignature,
        exportStyle,
        exportAutoFitOnePage,
        exportPaperSize,
        exportVisibleColumnKeys,
        "pdf",
      );
      document.body.appendChild(wrapper);

      try {
        // Support both new (post-v2.3.92) and legacy page selectors so the export
        // keeps working regardless of which renderer is active.
        let pageElements = Array.from(
          wrapper.querySelectorAll<HTMLElement>('[data-attendance-print-page="true"]'),
        );
        if (pageElements.length === 0) {
          pageElements = Array.from(
            wrapper.querySelectorAll<HTMLElement>('[data-attendance-export-page="true"]'),
          );
        }
        if (pageElements.length === 0) {
          // Fallback: capture the whole wrapper as a single page (better than failing).
          pageElements = [wrapper];
        }

        for (let index = 0; index < pageElements.length; index += 1) {
          const pageElement = pageElements[index];
          const canvas = await html2canvasLib(pageElement, {
            backgroundColor: "#ffffff",
            scale: 2,
            useCORS: true,
            logging: false,
            width: pageElement.scrollWidth,
            height: pageElement.scrollHeight,
          });

          if (index > 0) {
            doc.addPage(paper.pdfFormat as any, "landscape");
          }

          doc.addImage(
            canvas.toDataURL("image/png"),
            "PNG",
            0,
            0,
            paper.pageWidthMm,
            paper.pageHeightMm,
            undefined,
            "FAST",
          );
        }
      } finally {
        document.body.removeChild(wrapper);
      }

      doc.save(fileName);
      showSuccess("Berhasil", "File PDF berhasil diunduh");
      setShowExportDialog(false);
    } catch (error) {
      console.error("PDF export WYSIWYG error:", error);
      showWarning("Gagal", "Tidak dapat mengekspor PDF presensi.");
    }
  }, [selectedAttendanceColumnKeys, selectedClass, signatureConfig, includeSignature, paperSize, documentStyle, autoFitOnePage, currentMonth, showLoader, renderAttendanceExportElement, attendancePreviewData.days, showSuccess, showWarning]);

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
    await showLoader(`${baseFileName}.png`);

    try {
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
      const builtPdf = buildAttendancePdfDocument({
        data: attendancePrintDataset,
        plan,
        signature: exportSignature,
        includeSignature: shouldIncludeSignature,
      });
      const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist/legacy/build/pdf.mjs");
      GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/legacy/build/pdf.worker.mjs", import.meta.url).toString();
      const pdf = await getDocument({ data: builtPdf.arrayBuffer() }).promise;
      const renderedPages: Array<{ canvas: HTMLCanvasElement; fileName: string; dataUrl: string }> = [];
      let resolvedRasterScale = 0;
      const targetWidthPx = getAttendancePngTargetWidthPx(quality);

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
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
      }
      await pdf.destroy();

      let downloadedFileName = renderedPages[0]?.fileName ?? `${baseFileName}.png`;
      const downloadKind: "png" | "zip" = renderedPages.length > 1 ? "zip" : "png";

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

      showSuccess(
        "Berhasil",
        renderedPages.length > 1
          ? `${renderedPages.length} halaman PNG ${quality === "4k" ? "4K Ultra HD" : "HD"} berhasil diarsipkan ke ZIP`
          : `File PNG ${quality === "4k" ? "4K Ultra HD" : "HD"} berhasil diunduh`,
      );
      setShowExportDialog(false);
    } catch (error) {
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
    showLoader,
    showSuccess,
    showWarning,
  ]);

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

    await showLoader(fileName);

    try {
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

      showSuccess("Berhasil", "File PDF vektor berhasil diunduh");
      setShowExportDialog(false);
    } catch (error) {
      console.error("Attendance PDF vector export error:", error);
      showWarning("Gagal", "Tidak dapat mengekspor PDF presensi vektor.");
    }
  }, [
    attendanceAnnotationDisplayMode,
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
    showLoader,
    showSuccess,
    showWarning,
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
  const handleToggleLock = async () => await toggleLock(!isLocked);
  const hasData = selectedClassId && students.length > 0;
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
      <div className="rounded-2xl border border-sky-200/80 bg-sky-50/70 p-3">
        <p className="text-[11px] font-semibold text-foreground">Keterangan Libur & Presensi</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Atur keterangan hari libur agar tetap menjadi kartu ringkasan atau ditulis vertikal di dalam kolom tanggal tabel.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-sky-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-sky-700">
            {attendanceAnnotationDisplayMode === "summary-card" ? "Mode aktif: Kartu Ringkasan" : "Mode aktif: Vertikal di Tabel"}
          </span>
          {attendanceAnnotationDisplayMode === "inline-vertical" ? (
            <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
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
          <div className="mt-3 rounded-xl border border-indigo-200/80 bg-indigo-50/80 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold text-foreground">Style Label Vertikal</p>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Hanya tampil saat mode vertikal dipakai, agar pengaturan tetap satu konteks dan tidak membingungkan.
                </p>
              </div>
              <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
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
          <div className="mt-3 rounded-xl border border-dashed border-sky-200/80 bg-white/70 p-3 text-[10px] leading-relaxed text-muted-foreground">
            Style Label Vertikal disembunyikan otomatis karena mode yang aktif adalah Kartu Ringkasan.
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/70 p-3">
        <p className="text-[11px] font-semibold text-foreground">Kegiatan Khusus</p>
        <p className="mt-1 text-[10px] text-muted-foreground">
          Pisahkan kegiatan khusus dari keterangan vertikal. Default tetap ringkasan, lalu masukkan ke tabel hanya bila memang dibutuhkan.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
            {attendanceEventAnnotationDisplayMode === "summary-card" ? "Mode aktif: Kartu Ringkasan" : "Mode aktif: Masuk ke Tabel"}
          </span>
          {attendanceEventAnnotationDisplayMode === "inline-vertical" ? (
            <span className="rounded-full border border-indigo-200/80 bg-white/85 px-2 py-0.5 text-[9px] font-semibold text-indigo-700">
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
          <div className="mt-3 rounded-xl border border-indigo-200/80 bg-white/80 p-3 text-[10px] leading-relaxed text-muted-foreground">
            Opsi cerdas aktif: kegiatan khusus ikut ditulis di tabel dan memakai style label vertikal yang sama agar hasil cetak tetap konsisten.
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-amber-200/80 bg-white/70 p-3 text-[10px] leading-relaxed text-muted-foreground">
            Kegiatan khusus tetap diringkas di kartu agar kolom tanggal tidak cepat penuh.
          </div>
        )}
      </div>
    </div>
  );
  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      // Sync currentMonth so attendance data is fetched for the selected date's month
      const dateMonth = startOfMonth(date);
      const current = startOfMonth(currentMonth);
      if (dateMonth.getTime() !== current.getTime()) {
        setCurrentMonth(date);
      }
      setIsDatePickerOpen(false);
    }
  };

  return (
    <>
      <div ref={containerRef} className="p-3 sm:p-4 lg:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4">

        <PageHeader
          icon={<CalendarDays className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
          title="Presensi"
          subtitle="Kelola kehadiran siswa"
          breadcrumbs={[{ label: "Presensi" }]}
          actions={
            <div className="flex items-center gap-1.5">
              {/* Mobile: all actions in single dropdown */}
              <div className="sm:hidden">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9">
                      <Settings2 className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => setShowSettingsSheet(true)} className="gap-2 min-h-[44px]">
                      <Settings2 className="w-4 h-4" />
                      Pengaturan Presensi
                    </DropdownMenuItem>
                    {selectedClassId && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setShowImportAttendance(true)} className="gap-2 min-h-[44px]">
                          <Upload className="w-4 h-4" />
                          Import dari Excel
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setShowOCRAttendance(true)} className="gap-2 min-h-[44px]">
                          <Camera className="w-4 h-4" />
                          Import dari Foto (OCR)
                        </DropdownMenuItem>
                      </>
                    )}
                    {hasData && (
                      <DropdownMenuSeparator />
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {hasData && (
                <div className="sm:hidden">
                  <UnifiedExportStudio
                    title="Studio Ekspor Presensi"
                    description="Pilih format ekspor presensi dan kelola signature dari satu panel yang lebih mudah dipahami."
                    triggerLabel="Ekspor"
                    triggerClassName="h-9 px-3 text-xs"
                    formats={ATTENDANCE_EXPORT_FORMATS}
                    selectedFormat={attendanceExportFormat}
                    onFormatChange={handleAttendanceExportFormatChange}
                    onExport={async ({ formatId, includeSignature: nextIncludeSignature, signatureConfig: nextSignatureConfig, paperSize: nextPaperSize, documentStyle: nextDocumentStyle, autoFitOnePage: nextAutoFitOnePage }) => {
                      if (formatId === "excel") {
                        await handleExportExcel(nextSignatureConfig, nextIncludeSignature, selectedAttendanceColumnKeys);
                        return;
                      }
                      if (formatId === "pdf") {
                        await handleExportPDFVector(nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                        return;
                      }
                      await handleExportPNGV2(formatId === "png-4k" ? "4k" : "hd", nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                    }}
                    includeSignature={includeSignature}
                    onIncludeSignatureChange={setIncludeSignature}
                    signatureConfig={attendanceDefaultSignatureConfig}
                    hasSignature={hasSignature}
                    isLoading={signatureLoading}
                    isSaving={signatureSaving}
                    onSaveSignature={saveSignature}
                    paperSize={paperSize}
                    onPaperSizeChange={setPaperSize}
                    documentStyle={documentStyle}
                    onDocumentStyleChange={setDocumentStyle}
                    autoFitOnePage={autoFitOnePage}
                    onAutoFitOnePageChange={setAutoFitOnePage}
                    showAutoFitPreset
                    formatPanelExtra={attendanceDebugPanel}
                    stylePanelExtra={attendanceStylePanelExtra}
                    previewFooter={attendanceDebugPreviewFooter}
                    columnOptions={attendanceColumnOptions}
                    onColumnOptionChange={handleAttendanceColumnOptionChange}
                    columnCount={selectedAttendanceColumnKeys.length}
                    columnTypographyOptions={attendanceColumnTypographyOptions}
                    onRestoreDefaultMode={resetAttendanceStudioDefaults}
                    defaultModeDescription="Reset semua pengaturan studio kembali ke baseline awal sambil mempertahankan ukuran kertas dan identitas signature."
                    stylePresetMode="attendance"
                    stylePresetBaseline={attendanceStylePresetBaseline}
                    renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFitOnePage, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect }) => (
                      <AttendanceExportPreviewV2
                        previewFormat={previewFormat}
                        draft={draft}
                        setDraft={setDraft}
                        previewDate={previewDate}
                        includeSignature={previewIncludeSignature}
                        data={attendancePreviewStudioData}
                        paperSize={previewPaperSize}
                        documentStyle={previewDocumentStyle ?? documentStyle}
                        autoFitOnePage={previewAutoFitOnePage ?? autoFitOnePage}
                        visibleColumnKeys={selectedAttendanceColumnKeys}
                        debugEnabled={attendanceDebugEnabled}
                        onTrace={(trace) => attendanceDebugEnabled && commitAttendanceTrace(trace)}
                        liveEditMode={liveEditMode}
                        highlightTarget={highlightTarget}
                        onHighlightTargetHoverChange={onHighlightTargetHoverChange}
                        onHighlightTargetSelect={onHighlightTargetSelect}
                        annotationDisplayMode={attendanceAnnotationDisplayMode}
                        eventAnnotationDisplayMode={attendanceEventAnnotationDisplayMode}
                        inlineLabelStyle={attendanceInlineLabelStyle}
                      />
                    )}
                  />
                </div>
              )}

              {/* Desktop: separate buttons */}
              <div className="hidden sm:flex items-center gap-1.5">
                <Button variant="ghost" size="sm" className="h-9 px-2.5 gap-1.5 text-xs" onClick={() => setShowSettingsSheet(true)}>
                  <Settings2 className="w-3.5 h-3.5" />
                  Pengaturan
                </Button>
                {selectedClassId && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-9 px-2.5 gap-1.5 text-xs">
                        <Upload className="w-3.5 h-3.5" />
                        Import
                        <ChevronDown className="w-3 h-3 opacity-60" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowImportAttendance(true)} className="gap-2">
                        <FileSpreadsheet className="w-4 h-4" />
                        Import dari Excel
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowOCRAttendance(true)} className="gap-2">
                        <Camera className="w-4 h-4" />
                        Import dari Foto (OCR)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                {hasData && (
                  <UnifiedExportStudio
                    title="Studio Ekspor Presensi"
                    description="Pilih format ekspor presensi, aktifkan signature bila diperlukan, lalu unduh file dari satu studio."
                    triggerLabel="Ekspor"
                    triggerClassName="h-9 px-2.5 text-xs"
                    formats={ATTENDANCE_EXPORT_FORMATS}
                    selectedFormat={attendanceExportFormat}
                    onFormatChange={handleAttendanceExportFormatChange}
                    onExport={async ({ formatId, includeSignature: nextIncludeSignature, signatureConfig: nextSignatureConfig, paperSize: nextPaperSize, documentStyle: nextDocumentStyle, autoFitOnePage: nextAutoFitOnePage }) => {
                      if (formatId === "excel") {
                        await handleExportExcel(nextSignatureConfig, nextIncludeSignature, selectedAttendanceColumnKeys);
                        return;
                      }
                      if (formatId === "pdf") {
                        await handleExportPDFVector(nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                        return;
                      }
                      await handleExportPNGV2(formatId === "png-4k" ? "4k" : "hd", nextSignatureConfig, nextIncludeSignature, nextDocumentStyle, nextAutoFitOnePage, nextPaperSize, selectedAttendanceColumnKeys);
                    }}
                    includeSignature={includeSignature}
                    onIncludeSignatureChange={setIncludeSignature}
                    signatureConfig={attendanceDefaultSignatureConfig}
                    hasSignature={hasSignature}
                    isLoading={signatureLoading}
                    isSaving={signatureSaving}
                    onSaveSignature={saveSignature}
                    paperSize={paperSize}
                    onPaperSizeChange={setPaperSize}
                    documentStyle={documentStyle}
                    onDocumentStyleChange={setDocumentStyle}
                    autoFitOnePage={autoFitOnePage}
                    onAutoFitOnePageChange={setAutoFitOnePage}
                    showAutoFitPreset
                    formatPanelExtra={attendanceDebugPanel}
                    stylePanelExtra={attendanceStylePanelExtra}
                    previewFooter={attendanceDebugPreviewFooter}
                    columnOptions={attendanceColumnOptions}
                    onColumnOptionChange={handleAttendanceColumnOptionChange}
                    columnCount={selectedAttendanceColumnKeys.length}
                    columnTypographyOptions={attendanceColumnTypographyOptions}
                    onRestoreDefaultMode={resetAttendanceStudioDefaults}
                    defaultModeDescription="Reset semua pengaturan studio kembali ke baseline awal sambil mempertahankan ukuran kertas dan identitas signature."
                    stylePresetMode="attendance"
                    stylePresetBaseline={attendanceStylePresetBaseline}
                    renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewDocumentStyle, autoFitOnePage: previewAutoFitOnePage, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect }) => (
                      <AttendanceExportPreviewV2
                        previewFormat={previewFormat}
                        draft={draft}
                        setDraft={setDraft}
                        previewDate={previewDate}
                        includeSignature={previewIncludeSignature}
                        data={attendancePreviewStudioData}
                        paperSize={previewPaperSize}
                        documentStyle={previewDocumentStyle ?? documentStyle}
                        autoFitOnePage={previewAutoFitOnePage ?? autoFitOnePage}
                        visibleColumnKeys={selectedAttendanceColumnKeys}
                        debugEnabled={attendanceDebugEnabled}
                        onTrace={(trace) => attendanceDebugEnabled && commitAttendanceTrace(trace)}
                        liveEditMode={liveEditMode}
                        highlightTarget={highlightTarget}
                        onHighlightTargetHoverChange={onHighlightTargetHoverChange}
                        onHighlightTargetSelect={onHighlightTargetSelect}
                        annotationDisplayMode={attendanceAnnotationDisplayMode}
                        eventAnnotationDisplayMode={attendanceEventAnnotationDisplayMode}
                        inlineLabelStyle={attendanceInlineLabelStyle}
                      />
                    )}
                  />
                )}
              </div>
            </div>
          }
        />

        <div className="rounded-2xl bg-card border border-border overflow-hidden divide-y divide-border">
          <div className="flex items-center gap-3 p-3 sm:p-3.5">
            <School className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Kelas</Label>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-7 border-0 px-0 py-0 shadow-none text-sm font-medium focus:ring-0">
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id} className="text-sm">{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3 p-3 sm:p-3.5">
            <CalendarIcon className="w-4 h-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Label className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Tanggal</Label>
              <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button className={cn("w-full text-left text-sm font-medium py-0.5 truncate", isHolidayCombined(selectedDate) && "text-grade-warning")}>
                        {format(selectedDate, "EEEE, d MMMM yyyy", { locale: idLocale })}
                        {isHolidayCombined(selectedDate) && " (Libur)"}
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  {isHolidayCombined(selectedDate) && (
                    <TooltipContent side="bottom" className="text-[10px] p-2 rounded-xl">
                      <p className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                        <CalendarOff className="w-3 h-3" /> {isNationalHoliday(selectedDate) ? "Libur Nasional" : "Hari Libur"}
                      </p>
                      <p className="text-muted-foreground">
                        {getHolidayDescription(selectedDate) || getNationalHolidayName(selectedDate) || (getDay(selectedDate) === 0 ? "Hari Minggu" : "Libur")}
                      </p>
                    </TooltipContent>
                  )}
                </Tooltip>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus className="pointer-events-auto"
                    modifiers={{ 
                      holiday: (date) => isHolidayCombined(date), 
                      sunday: (date) => getDay(date) === 0,
                      dayEvent: (date) => !!getDayEvent(date),
                      customHoliday: (date) => {
                        const dateStr = format(date, "yyyy-MM-dd");
                        return holidays.some((h) => h.date === dateStr);
                      },
                      nationalHoliday: (date) => isNationalHoliday(date),
                    }}
                    modifiersClassNames={{ 
                      holiday: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium", 
                      sunday: "text-amber-600 dark:text-amber-400",
                      dayEvent: "ring-2 ring-primary/50 ring-inset font-bold",
                      customHoliday: "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium",
                      nationalHoliday: "bg-red-50 dark:bg-red-950/30 text-red-500 dark:text-red-400 font-semibold",
                    }}
                  />
                  {/* Calendar Color Legend */}
                  <div className="px-3 pb-3 pt-2 border-t border-border/50 space-y-1.5">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Keterangan Warna Kalender:</p>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-[9px] font-bold flex items-center justify-center border border-amber-200 dark:border-amber-800/50">15</div>
                        <span className="text-[10px] text-muted-foreground">Hari Libur</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[9px] font-bold flex items-center justify-center border border-red-200 dark:border-red-800/50">17</div>
                        <span className="text-[10px] text-muted-foreground">Kustom (Libur/Kerja)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md text-amber-600 dark:text-amber-400 text-[9px] font-bold flex items-center justify-center">7</div>
                        <span className="text-[10px] text-muted-foreground">Hari Minggu</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md ring-2 ring-primary/50 ring-inset text-[9px] font-bold flex items-center justify-center">20</div>
                        <span className="text-[10px] text-muted-foreground">Kegiatan Khusus</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-red-50 dark:bg-red-950/30 text-red-500 text-[9px] font-bold flex items-center justify-center border border-red-200 dark:border-red-800/50">🇮🇩</div>
                        <span className="text-[10px] text-muted-foreground">Libur Nasional</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-md bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">{new Date().getDate()}</div>
                        <span className="text-[10px] text-muted-foreground">Tanggal Terpilih</span>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Holiday Banner */}
        {isHolidayCombined(selectedDate) && (
          <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-grade-warning/5 border border-grade-warning/20">
            <Sun className="w-4 h-4 text-grade-warning flex-shrink-0" />
            <p className="text-xs">
              <span className="font-semibold text-grade-warning">Hari Libur</span>
              <span className="text-muted-foreground ml-1.5">{getHolidayDescriptionCombined(selectedDate)}</span>
            </p>
          </div>
        )}

        {/* Day Event Banner */}
        {getDayEvent(selectedDate) && (
         <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/20">
            <Bookmark className="w-4 h-4 text-primary flex-shrink-0" />
            <p className="text-xs">
              <span className="font-semibold text-primary">{getDayEvent(selectedDate)!.label}</span>
              {getDayEvent(selectedDate)!.description && <span className="text-muted-foreground ml-1.5">— {getDayEvent(selectedDate)!.description}</span>}
            </p>
          </div>
        )}

        {/* Empty State */}
        {!selectedClassId && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-[20px] bg-muted/60 flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Pilih Kelas</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Pilih kelas di atas untuk mulai mencatat kehadiran siswa.</p>
          </div>
        )}

        {hasData && (
          <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
            {/* Tab Header Section */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/10">
              <div className="flex rounded-2xl bg-muted/30 p-1.5 gap-1.5 border-2 border-muted/50 shadow-inner">
                {([
                  { key: "daily" as const, label: "Harian", icon: UserCheck },
                  { key: "monthly" as const, label: "Rekap Bulanan", icon: BarChart3 },
                ]).map(({ key, label, icon: Icon }) => (
                  <button 
                    key={key} 
                    onClick={() => setActiveView(key)}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 touch-manipulation min-h-[44px]",
                      activeView === key 
                        ? "bg-primary text-primary-foreground shadow-md scale-[1.02] ring-2 ring-primary/20" 
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 sm:w-5 sm:h-5", activeView === key ? "animate-pulse" : "")} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Main Content Section */}
            <div className="p-4 sm:p-6 space-y-6">
              {/* Stats Cards */}
              <div ref={statsRef} className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {allStatuses.map((key) => {
                  const cfg = statusConfig[key];
                  const val = activeView === "daily" ? (dailyStats as any)[key] : (monthlyStats as any)[key];
                  const IconComp = cfg.icon;
                  return (
                    <div key={key} data-stat-card className="rounded-2xl p-2 sm:p-3 border border-border/60 bg-muted/20">
                      <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center mb-1", cfg.bg)}>
                        <IconComp className={cn("w-3 h-3 sm:w-4 sm:h-4", cfg.color)} />
                      </div>
                      <p className={cn("text-base sm:text-xl font-bold", cfg.color)}>{val}</p>
                      <p className="text-[8px] sm:text-xs text-muted-foreground">{cfg.label}</p>
                    </div>
                  );
                })}
              </div>

              {/* Legend Section */}
              <div className="rounded-2xl bg-card border-2 border-border shadow-sm overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b-2 border-border">
                  <p className="text-[10px] sm:text-xs font-bold text-foreground uppercase tracking-wide">📋 Keterangan Status</p>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
                    {allStatuses.map((key) => {
                      const cfg = statusConfig[key];
                      return (
                        <div key={key} className="flex items-center gap-1.5">
                          <div className={cn("w-4 h-4 rounded-md flex items-center justify-center text-[7px] font-bold shadow-sm", cfg.bgActive)}>{key}</div>
                          <span className="text-foreground font-medium">{cfg.label}</span>
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-1.5">
                      <div className="w-4 h-4 rounded-md bg-grade-warning/30 border border-grade-warning flex items-center justify-center text-[7px] font-bold text-grade-warning shadow-sm">L</div>
                      <span className="text-foreground font-medium">Libur</span>
                    </div>
                  </div>

                  {/* Hari Efektif - prominent */}
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border-2 border-primary/30 shadow-sm">
                    <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
                    <div>
                      <span className="text-sm sm:text-base font-extrabold text-primary">{effectiveDays} Hari Efektif</span>
                      <span className="text-[10px] sm:text-xs text-muted-foreground ml-2">
                        {format(currentMonth, "MMMM yyyy", { locale: idLocale })} • {workDayFormat === "5days" ? "Sen–Jum" : "Sen–Sab"}
                      </span>
                    </div>
                  </div>

                  {/* National Holiday Sync */}
                  <NationalHolidaySync
                    nationalHolidays={nationalHolidays}
                    isLoading={nationalHolidaysLoading}
                    lastSynced={nationalHolidaysLastSynced}
                    error={nationalHolidaysError}
                    onRefresh={refreshNationalHolidays}
                    monthNationalHolidays={monthNationalHolidays}
                  />

                  <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3 text-primary" />
                      <span>= Catatan siswa</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Bookmark className="w-3 h-3 text-primary" />
                      <span>= Kegiatan khusus</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Sun className="w-3 h-3 text-grade-warning" />
                      <span>= Hari libur kustom</span>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground/70 leading-relaxed">
                    Ketuk tombol status untuk mencatat kehadiran. Ketuk lagi untuk membatalkan. Tekan ikon 💬 untuk menambah catatan.
                  </p>
                </div>
              </div>

              {/* DAILY VIEW */}
              {activeView === "daily" && (
                <div className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden max-w-full">
                <div className="flex items-center justify-between gap-2 p-3 sm:p-3.5 border-b border-border">
                  <div className="flex items-center gap-2 min-w-0">
                    <Users className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold truncate">{selectedClass?.name}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">{format(selectedDate, "d MMM", { locale: idLocale })}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="relative">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
                      <Input placeholder="Cari siswa..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-7 h-8 text-xs w-24 sm:w-36 rounded-xl" />
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setShowBulkDialog(true)} disabled={isHolidayCombined(selectedDate)} className="text-xs h-8 px-2.5 gap-1 rounded-xl">
                          <Check className="w-3 h-3" /><span className="hidden xs:inline sm:inline">Semua</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent className="text-xs sm:hidden">Presensi Massal</TooltipContent>
                    </Tooltip>
                  </div>
                </div>

                {isHolidayCombined(selectedDate) && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-grade-warning/5 border-b border-grade-warning/10 text-xs">
                    <Sun className="w-3 h-3 text-grade-warning" />
                    <span className="text-grade-warning font-medium">{getHolidayDescriptionCombined(selectedDate)}</span>
                  </div>
                )}

                <ScrollArea 
                  className="h-[340px] sm:h-[420px] overscroll-auto" 
                >
                  <div className="divide-y divide-border/50">
                    {filteredStudents.map((student, index) => {
                      const status = getAttendance(student.id, selectedDate);
                      const note = getAttendanceNote(student.id, selectedDate);
                      const holidayActive = isHolidayCombined(selectedDate);

                      return (
                        <div key={student.id} className={cn("flex items-center gap-1 sm:gap-2 px-1.5 sm:px-4 py-1.5 sm:py-2.5 transition-colors", holidayActive ? "opacity-40" : "hover:bg-muted/30 active:bg-muted/50")}>
                          {/* Number badge */}
                          <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                            <span className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
                          </div>

                          {/* Name - wraps naturally, never pushes buttons off screen */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <p className="text-[11px] sm:text-sm font-medium text-foreground leading-snug break-words">{student.name}</p>
                              {note && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => handleOpenNote(student.id, student.name, selectedDate)} className="flex-shrink-0 touch-manipulation">
                                      <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top" className="max-w-[200px] text-xs">{note}</TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                          </div>

                          {/* Status buttons + Note - fixed width container */}
                          <div className="flex items-center gap-[2px] sm:gap-1.5 flex-shrink-0">
                            {allStatuses.map((s) => {
                              const isSelected = status === s;
                              const cfg = statusConfig[s];
                              return (
                                <button key={s}
                                  onClick={() => handleSetAttendance(student.id, selectedDate, isSelected ? null : s)}
                                  disabled={holidayActive || isSaving}
                                  className={cn(
                                    "flex items-center justify-center rounded-md sm:rounded-xl transition-all touch-manipulation",
                                    "w-[26px] h-7 sm:min-w-[38px] sm:min-h-[40px] sm:px-1 sm:py-1 sm:flex-col",
                                    isSelected ? cn(cfg.bgActive, "shadow-sm") : "bg-muted/50 text-muted-foreground hover:bg-muted active:bg-muted/80",
                                    (holidayActive || isSaving) && "cursor-not-allowed opacity-40"
                                  )}
                                  aria-label={cfg.label}>
                                  <span className="text-[9px] sm:text-xs font-bold leading-none">{s}</span>
                                  <span className={cn("text-[5px] sm:text-[7px] leading-none mt-0.5 font-medium hidden sm:block", isSelected ? "opacity-80" : "opacity-60")}>{cfg.label}</span>
                                </button>
                              );
                            })}
                            {/* Note button - always visible */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button onClick={() => handleOpenNote(student.id, student.name, selectedDate)}
                                  disabled={holidayActive}
                                  className={cn("flex w-[26px] h-7 sm:w-8 sm:h-8 rounded-md sm:rounded-lg items-center justify-center flex-shrink-0 transition-colors touch-manipulation",
                                    note ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground hover:bg-muted",
                                    holidayActive && "opacity-40 cursor-not-allowed"
                                  )}>
                                  <MessageSquare className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent className="text-xs">Catatan</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      );
                    })}
                    {filteredStudents.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Users className="w-8 h-8 mb-2 opacity-40" />
                        <p className="text-xs">Tidak ada siswa ditemukan</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

              {/* MONTHLY VIEW */}
              {activeView === "monthly" && (
                <div 
                  className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden" 
                  data-monthly-table 
                >
                  <div className="flex items-center justify-between gap-2 p-3 sm:p-3.5 border-b border-border">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span className="text-sm font-semibold text-foreground">Rekap Bulanan</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="flex items-center gap-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant={isLocked ? "default" : "outline"} size="sm" className="h-8 px-2.5 text-xs gap-1 rounded-xl" onClick={handleToggleLock}>
                            {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                            <span className="hidden sm:inline">{isLocked ? "Terkunci" : "Terbuka"}</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="text-xs sm:hidden">{isLocked ? "Kunci Aktif" : "Kunci Nonaktif"}</TooltipContent>
                      </Tooltip>
                      <JumlahCalculationConfig config={jumlahConfig} onConfigChange={setJumlahConfig} />
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                    <span className="text-xs font-medium min-w-[80px] sm:min-w-[100px] text-center text-foreground">{format(currentMonth, "MMM yyyy", { locale: idLocale })}</span>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                </div>

                {isLocked && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-b border-border text-xs text-muted-foreground">
                    <Lock className="w-3 h-3" />
                    <span>Rekap terkunci. Buka kunci untuk mengedit.</span>
                  </div>
                )}

                <SmartScrollTable>
                  <table className="w-full text-center border-collapse min-w-max">
                    <thead className="sticky top-0 z-10 bg-card">
                      <tr className="border-b border-border">
                        <th className="sticky left-0 z-20 bg-card px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-left text-foreground border-r border-border min-w-[120px] sm:min-w-[160px]">No. Nama Siswa</th>
                        {monthDays.map(day => {
                          const dayNum = getDay(day);
                          const isSun = dayNum === 0;
                          const isSat = workDayFormat === "5days" && dayNum === 6;
                          const ev = getDayEvent(day);
                          const holCustom = holidays.some(h => h.date === format(day, "yyyy-MM-dd"));
                          const isNatHol = isNationalHoliday(day);
                          return (
                            <th key={day.toISOString()} className={cn("px-0.5 py-1 min-w-[24px] border-l border-border/30",
                              isSun && "bg-grade-warning/5",
                              holCustom && "bg-red-50 dark:bg-red-900/10",
                              isNatHol && !holCustom && "bg-red-50/50 dark:bg-red-950/10",
                              ev && "bg-primary/5"
                            )}>
                            <Popover>
                                <PopoverTrigger asChild>
                                  <button className="w-full cursor-pointer focus:outline-none touch-manipulation min-h-[32px]">
                                    <p className={cn("text-[7px] sm:text-[8px] font-medium", isSun || isSat ? "text-grade-warning" : "text-muted-foreground")}>{dayNames[dayNum]}</p>
                                    <p className={cn("text-[9px] sm:text-[10px] font-bold leading-tight", isSun ? "text-grade-warning" : holCustom ? "text-red-500" : isNatHol ? "text-red-400" : "text-foreground")}>{format(day, "d")}</p>
                                    {ev && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-0.5" />}
                                    {holCustom && <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto mt-0.5" />}
                                    {isNatHol && !holCustom && <div className="w-1.5 h-1.5 rounded-full bg-red-400 mx-auto mt-0.5" />}
                                  </button>
                                </PopoverTrigger>
                                <PopoverContent side="bottom" className="text-[10px] max-w-[220px] p-2.5">
                                  <p className="font-semibold text-foreground">{format(day, "EEEE, d MMMM", { locale: idLocale })}</p>
                                  {ev && <p className="text-primary mt-1">📌 {ev.label}{ev.description ? `: ${ev.description}` : ""}</p>}
                                  {holCustom && <p className="text-red-500 mt-1">🔴 {getHolidayDescriptionCombined(day)}</p>}
                                  {isNatHol && <p className="text-red-400 mt-1">🇮🇩 {getNationalHolidayName(day)}</p>}
                                  {!ev && !holCustom && !isNatHol && !isSun && <p className="text-muted-foreground mt-1">Hari kerja biasa</p>}
                                  {isSun && !holCustom && !isNatHol && <p className="text-grade-warning mt-1">☀️ Hari Minggu</p>}
                                </PopoverContent>
                              </Popover>
                            </th>
                          );
                        })}
                        {allStatuses.map(s => (
                          <th key={s} className={cn("px-1 py-1 text-center text-[8px] sm:text-[9px] font-bold min-w-[24px] border-l border-border/50", statusConfig[s]?.color)}>{s}</th>
                        ))}
                        <th className="px-1 py-1 text-center text-[8px] sm:text-[9px] font-bold min-w-[28px] border-l-2 border-border bg-muted/30 text-foreground">
                          Jml
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStudents.map((student, idx) => {
                        const studentStats: Record<string, number> = { H: 0, I: 0, S: 0, A: 0, D: 0 };
                        monthDays.forEach(day => {
                          if (!isHolidayCombined(day)) {
                            const st = getAttendance(student.id, day);
                            if (st && studentStats.hasOwnProperty(st)) studentStats[st]++;
                          }
                        });
                        return (
                          <tr key={student.id} className={cn("border-b border-border/30", idx % 2 === 0 ? "bg-muted/5" : "bg-card")}>
                            <td className="sticky left-0 z-10 bg-card px-2 py-1 text-[10px] sm:text-xs border-r border-border min-w-[120px] sm:min-w-[160px] max-w-[160px] sm:max-w-[200px] text-left">
                              <div className="flex items-start gap-0.5">
                                <span className="text-muted-foreground font-medium flex-shrink-0">{idx + 1}.</span>
                                <span className="text-foreground break-words leading-tight">{student.name}</span>
                              </div>
                            </td>
                            {monthDays.map(day => {
                              const st = getAttendance(student.id, day);
                              const note = getAttendanceNote(student.id, day);
                              const holidayActive = isHolidayCombined(day);
                              const dayNum = getDay(day);
                              const isSunday = dayNum === 0;
                              return (
                                <td key={day.toISOString()} className={cn("p-0.5 text-center relative", holidayActive && "bg-grade-warning/5")}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <div
                                        className={cn("w-5 h-5 sm:w-6 sm:h-6 mx-auto flex items-center justify-center text-[8px] sm:text-[9px] font-bold rounded-md transition-colors",
                                          !isLocked && !holidayActive && "cursor-pointer",
                                          holidayActive ? "bg-grade-warning/10 text-grade-warning/60"
                                            : st ? statusConfig[st]?.bgActive || "bg-muted/20" : "bg-muted/20 text-muted-foreground/50 hover:bg-muted/40",
                                          isSunday && !st && "text-grade-warning/40"
                                        )}
                                        onClick={() => {
                                          if (!holidayActive) {
                                            const cycle: (AttendanceStatusValue | null)[] = ["H", "I", "S", "A", "D", null];
                                            const currIdx = cycle.indexOf(st);
                                            const nextStatus = cycle[(currIdx + 1) % cycle.length];
                                            handleSetMonthlyAttendance(student.id, day, nextStatus);
                                          }
                                        }}
                                      >
                                        {holidayActive ? "L" : st || "-"}
                                      </div>
                                    </TooltipTrigger>
                                    {holidayActive && (
                                      <TooltipContent side="top" className="text-[10px] p-2 rounded-xl">
                                        <p className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                                          <CalendarOff className="w-3 h-3" /> {isNationalHoliday(day) ? "Libur Nasional" : "Hari Libur"}
                                        </p>
                                        <p className="text-muted-foreground">
                                          {getHolidayDescription(day) || getNationalHolidayName(day) || (isSunday ? "Hari Minggu" : "Libur")}
                                        </p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                  {note && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                                          <MessageSquare className="w-1.5 h-1.5 text-primary-foreground" />
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                                        <p className="font-semibold text-foreground">{student.name}</p>
                                        <p className="text-muted-foreground">{note}</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </td>
                              );
                            })}
                            {allStatuses.map(s => (
                              <td key={s} className={cn("px-1 py-0.5 text-center text-[9px] sm:text-[10px] font-bold border-l border-border/30", statusConfig[s]?.color)}>
                                {studentStats[s]}
                              </td>
                            ))}
                            <td className="px-1 py-0.5 text-center text-[9px] sm:text-[10px] font-bold border-l-2 border-border bg-muted/10 text-foreground">
                              {calculateJumlah(studentStats, jumlahConfig)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {/* Total Row */}
                    <tfoot>
                      <tr className="border-t-2 border-border bg-[hsl(var(--muted))]/50" style={{ background: 'hsl(var(--muted) / 0.5)' }}>
                        <td className="sticky left-0 z-10 bg-muted/50 px-2 py-1.5 text-[10px] sm:text-xs font-bold text-foreground border-r border-border" colSpan={1}>
                          Total
                        </td>
                        {monthDays.map(day => {
                          const dayCounts: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                          filteredStudents.forEach(student => {
                            if (!isHolidayCombined(day)) {
                              const st = getAttendance(student.id, day);
                              if (st) dayCounts[st] = (dayCounts[st] || 0) + 1;
                            }
                          });
                          const dayTotal = dayCounts.H + dayCounts.S + dayCounts.I + dayCounts.A + dayCounts.D;
                          return (
                            <td key={day.toISOString()} className="p-0.5 text-center text-[9px] sm:text-[10px] font-bold">
                              {dayTotal || ""}
                            </td>
                          );
                        })}
                        {(() => {
                          const totals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                          let grandJumlah = 0;
                          filteredStudents.forEach(student => {
                            const studentStats: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                            monthDays.forEach(day => {
                              if (!isHolidayCombined(day)) {
                                const st = getAttendance(student.id, day);
                                if (st && totals.hasOwnProperty(st)) {
                                  totals[st]++;
                                  studentStats[st]++;
                                }
                              }
                            });
                            grandJumlah += calculateJumlah(studentStats, jumlahConfig);
                          });
                          return (
                            <>
                              {allStatuses.map(s => (
                                <td key={s} className={cn("px-1 py-1.5 text-center text-[9px] sm:text-[10px] font-bold border-l border-border/30", statusConfig[s]?.color)}>
                                  {totals[s]}
                                </td>
                              ))}
                              <td className="px-1 py-1.5 text-center text-[9px] sm:text-[10px] font-extrabold border-l-2 border-border text-foreground bg-muted/50">
                                {grandJumlah}
                              </td>
                            </>
                          );
                        })()}
                      </tr>
                      {/* Percentage Row */}
                      <PercentageRow
                        allStatuses={allStatuses}
                        filteredStudents={filteredStudents}
                        monthDays={monthDays}
                        effectiveDays={effectiveDays}
                        getAttendance={getAttendance}
                        isHoliday={isHolidayCombined}
                        statusConfig={statusConfig}
                        jumlahConfig={jumlahConfig}
                      />
                    </tfoot>
                  </table>
                </SmartScrollTable>
              </div>
            )}
            </div>
          </div>
        )}

        {/* Bulk Attendance Dialog */}
        <Dialog open={showBulkDialog} onOpenChange={(open) => { setShowBulkDialog(open); if (!open) { setShowBulkConfirm(false); setExistingBulkStudents([]); } }}>
          <DialogContent className="sm:max-w-md mx-3 rounded-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">Presensi Massal</DialogTitle>
              <DialogDescription className="text-xs">
                Set presensi untuk semua siswa pada {format(selectedDate, "d MMMM yyyy", { locale: idLocale })}
              </DialogDescription>
            </DialogHeader>
            
            {/* Confirmation overlay when existing data found */}
            {showBulkConfirm && existingBulkStudents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-xl bg-grade-warning/10 border border-grade-warning/30">
                  <AlertCircle className="w-4 h-4 text-grade-warning shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-grade-warning">Data presensi sudah ada!</p>
                    <p className="text-muted-foreground mt-0.5">
                      {existingBulkStudents.length} dari {students.length} siswa sudah memiliki data presensi pada tanggal ini.
                    </p>
                  </div>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Nama Siswa</th>
                        <th className="text-center px-2 py-1.5 font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {existingBulkStudents.map((s, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-3 py-1.5">{s.name}</td>
                          <td className="px-2 py-1.5 text-center font-medium">{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  Apakah Anda yakin ingin menimpa data presensi yang sudah ada dengan status <strong>{statusLabels[bulkStatus!]}</strong>?
                </p>
                
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => { setShowBulkConfirm(false); setExistingBulkStudents([]); }} size="sm" className="text-xs rounded-xl">
                    Batal
                  </Button>
                  <Button variant="destructive" onClick={handleBulkAttendance} disabled={isSaving} size="sm" className="text-xs rounded-xl">
                    {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    Timpa Semua ({students.length})
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 py-3">
                  {allStatuses.map((s) => {
                    const cfg = statusConfig[s];
                    const IconComp = cfg.icon;
                    return (
                      <button key={s} onClick={() => setBulkStatus(s)}
                        className={cn("flex items-center gap-3 p-3 rounded-2xl transition-all text-left touch-manipulation min-h-[52px]",
                          bulkStatus === s ? cn(cfg.bgActive, "shadow-md") : "bg-muted/50 text-foreground hover:bg-muted"
                        )}>
                        <IconComp className="w-5 h-5 flex-shrink-0" />
                        <div><p className="text-sm font-bold">{s}</p><p className="text-[10px] opacity-70">{cfg.label}</p></div>
                      </button>
                    );
                  })}
                  {/* Clear/Kosongkan option */}
                  <button
                    onClick={() => setBulkStatus(null)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-2xl transition-all text-left touch-manipulation min-h-[52px] col-span-2",
                      bulkStatus === null
                        ? "bg-muted-foreground text-background shadow-md"
                        : "bg-muted/50 text-foreground hover:bg-muted border border-dashed border-border"
                    )}
                  >
                    <X className="w-5 h-5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-bold">Kosongkan</p>
                      <p className="text-[10px] opacity-70">Hapus semua presensi di tanggal ini</p>
                    </div>
                  </button>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                  <Button variant="outline" onClick={() => setShowBulkDialog(false)} size="sm" className="text-xs rounded-xl">Batal</Button>
                  <Button
                    onClick={bulkStatus === null ? handleBulkClear : handleBulkAttendance}
                    disabled={isSaving}
                    size="sm"
                    className="text-xs rounded-xl"
                    variant={bulkStatus === null ? "destructive" : "default"}
                  >
                    {isSaving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                    {bulkStatus === null ? `Kosongkan (${students.length})` : `Terapkan (${students.length})`}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={showExportDialog} onOpenChange={setShowExportDialog}>
          <DialogContent
            className={cn(
              "w-[calc(100vw-1.5rem)] max-w-sm",
              "mx-auto rounded-2xl",
              "max-h-[90dvh]",
              "flex flex-col",
              "p-0 overflow-hidden"
            )}
          >

        {/* Note Dialog */}
        <Dialog open={showNoteDialog} onOpenChange={setShowNoteDialog}>
          <DialogContent className="sm:max-w-sm mx-3 rounded-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-primary" /> Catatan Presensi
              </DialogTitle>
              <DialogDescription className="text-xs">
                {noteTarget && `${noteTarget.studentName} — ${format(noteTarget.date, "d MMMM yyyy", { locale: idLocale })}`}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Contoh: Mengikuti lomba, terlambat 15 menit, dll."
              className="text-sm rounded-xl min-h-[80px]"
              maxLength={500}
            />
            <p className="text-[10px] text-muted-foreground text-right">{noteText.length}/500</p>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowNoteDialog(false)} size="sm" className="text-xs rounded-xl">Batal</Button>
              <Button onClick={handleSaveNote} disabled={isSaving} size="sm" className="text-xs rounded-xl">Simpan Catatan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Export Dialog — DIPERBAIKI untuk mobile */}
        
            {/* Header — fixed */}
            <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
                <Download className="w-4 h-4 text-primary flex-shrink-0" />
                Ekspor Presensi
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pilih format ekspor data presensi
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-auto px-4 py-3 space-y-2">

              <SignatureExportPanel
                includeSignature={includeSignature}
                onIncludeSignatureChange={setIncludeSignature}
                signatureConfig={attendanceDefaultSignatureConfig}
                hasSignature={hasSignature}
                isLoading={signatureLoading}
                isSaving={signatureSaving}
                onSaveSignature={saveSignature}
              />

              {/* Excel */}
              <button
                onClick={() => handleExportExcel()}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border hover:bg-muted/50 active:bg-muted/70 transition-colors text-left touch-manipulation min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl bg-grade-pass/10 flex items-center justify-center flex-shrink-0">
                  <FileSpreadsheet className="w-5 h-5 text-grade-pass" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">Excel (.xlsx)</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    14 sheet lengkap dengan catatan dan kegiatan
                  </p>
                </div>
              </button>

              {/* PDF */}
              <button
                onClick={() => handleExportPDFVector(signatureConfig, includeSignature, documentStyle, autoFitOnePage, paperSize, selectedAttendanceColumnKeys)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border hover:bg-muted/50 active:bg-muted/70 transition-colors text-left touch-manipulation min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl bg-grade-fail/10 flex items-center justify-center flex-shrink-0">
                  <FileText className="w-5 h-5 text-grade-fail" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">PDF (.pdf)</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Rekap berwarna siap cetak dengan keterangan lengkap
                  </p>
                </div>
              </button>

              {/* PNG HD */}
              <button
                onClick={() => handleExportPNGV2("hd", attendanceDefaultSignatureConfig, includeSignature, documentStyle, autoFitOnePage, "full-page", selectedAttendanceColumnKeys)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-border hover:bg-muted/50 active:bg-muted/70 transition-colors text-left touch-manipulation min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">PNG HD</p>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Gambar HD terkompresi, cocok untuk sharing (~1-3 MB)
                  </p>
                </div>
              </button>

              {/* PNG 4K */}
              <button
                onClick={() => handleExportPNGV2("4k", attendanceDefaultSignatureConfig, includeSignature, documentStyle, autoFitOnePage, "full-page", selectedAttendanceColumnKeys)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl border border-primary/30 hover:bg-primary/5 active:bg-primary/10 transition-colors text-left touch-manipulation min-h-[60px]"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <ImageIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5 flex-wrap">
                    PNG 4K Ultra HD
                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold flex-shrink-0">
                      BEST
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground leading-snug">
                    Kualitas tertinggi tanpa pecah, cocok cetak poster (~5-15 MB)
                  </p>
                </div>
              </button>

            </div>

            {/* Footer — fixed */}
            <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0">
              <Button
                variant="outline"
                onClick={() => setShowExportDialog(false)}
                size="sm"
                className="text-xs rounded-xl w-full"
              >
                Tutup
              </Button>
            </div>

          </DialogContent>
        </Dialog>

        {/* Settings Dialog - Mobile Responsive Fix */}
        <Dialog open={showSettingsSheet} onOpenChange={setShowSettingsSheet}>
          <DialogContent
            className={cn(
              // Lebar: di mobile pakai hampir full width dengan margin kecil
              "w-[calc(100vw-1.5rem)] max-w-md",
              // Posisi & tinggi
              "mx-auto rounded-2xl",
              "max-h-[90dvh] sm:max-h-[85vh]",
              // Layout flex untuk header + scrollable content + footer
              "flex flex-col p-0",
              // Pastikan tidak ada overflow horizontal
              "overflow-hidden"
            )}
          >
            {/* Header — fixed, tidak ikut scroll */}
            <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-primary flex-shrink-0" />
                Pengaturan Presensi
              </DialogTitle>
              <DialogDescription className="text-[10px] sm:text-xs text-muted-foreground">
                Atur format hari kerja, hari libur, dan kegiatan
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-auto">
              <div className="space-y-4 px-4 py-3">

                {/* Format Hari Kerja */}
                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-muted/30">
                    <p className="text-xs font-semibold text-foreground">Format Hari Kerja</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">Pilih jumlah hari aktif sekolah</p>
                  </div>
                  {(
                    [
                      { key: "5days" as const, label: "5 Hari", desc: "Senin – Jumat" },
                      { key: "6days" as const, label: "6 Hari", desc: "Senin – Sabtu" },
                    ] as const
                  ).map(({ key, label, desc }) => (
                    <button
                      key={key}
                      onClick={() => handleWorkDayFormatChange(key)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors touch-manipulation hover:bg-muted/50 active:bg-muted/70 min-h-[44px] border-b border-border/30 last:border-0"
                    >
                      <div>
                        <p className="font-medium text-xs text-foreground">{label}</p>
                        <p className="text-[10px] text-muted-foreground">{desc}</p>
                      </div>
                      {workDayFormat === key && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                    </button>
                  ))}
                </div>

                {/* Hari Libur Kustom */}
                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Hari Libur Kustom</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Tambahkan tanggal libur sekolah</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px] gap-1 rounded-lg flex-shrink-0"
                      onClick={() => {
                        setShowHolidayDialog(true);
                      }}
                    >
                      <CalendarOff className="w-3 h-3" />
                      Tambah
                    </Button>
                  </div>

                  {holidays.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Belum ada hari libur kustom
                    </p>
                  ) : (
                    // Tinggi fixed supaya tidak overflow modal
                    <div className="max-h-[160px] overflow-y-auto overscroll-auto">
                      {holidays.map((h) => {
                        const hDate = new Date(h.date);
                        const dayName = format(hDate, "EEEE", { locale: idLocale });
                        return (
                          <div
                            key={h.date}
                            className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className="text-xs font-medium text-foreground">
                                {dayName}, {format(hDate, "d MMM yyyy", { locale: idLocale })}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">{h.description}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:bg-destructive/10 flex-shrink-0"
                              onClick={() => handleRemoveHoliday(h.date)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Hari Libur Nasional - Editable */}
                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-red-50/50 dark:bg-red-950/20 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-red-500" />
                        Hari Libur Nasional
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        Sinkron otomatis • Ketuk untuk override menjadi hari kerja
                      </p>
                    </div>
                    <Badge variant="secondary" className="text-[8px] px-1.5 py-0 flex-shrink-0">
                      {monthNationalHolidays.length} bulan ini
                    </Badge>
                  </div>
                  {monthNationalHolidays.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Tidak ada libur nasional bulan ini
                    </p>
                  ) : (
                    <div className="max-h-[200px] overflow-y-auto overscroll-auto">
                      {monthNationalHolidays.map((nh) => {
                        const nhDate = new Date(nh.date);
                        const dayName = format(nhDate, "EEEE", { locale: idLocale });
                        const isOverridden = holidays.some(h => h.date === nh.date && h.description === "Hari Kerja");
                        return (
                          <div
                            key={nh.date}
                            className={cn(
                              "flex items-center justify-between px-3 py-2.5 border-b border-border/30 last:border-0 transition-colors",
                              isOverridden ? "bg-primary/5 opacity-60" : "hover:bg-muted/30"
                            )}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className={cn("text-xs font-medium", isOverridden ? "text-muted-foreground line-through" : "text-foreground")}>
                                {dayName}, {format(nhDate, "d MMM yyyy", { locale: idLocale })}
                              </p>
                              <p className="text-[10px] text-muted-foreground truncate">
                                🇮🇩 {nh.name}
                                {isOverridden && <span className="ml-1 text-primary font-medium">(Diubah jadi hari kerja)</span>}
                              </p>
                            </div>
                            <Button
                              variant={isOverridden ? "default" : "outline"}
                              size="sm"
                              className={cn("h-7 px-2 text-[9px] gap-1 rounded-lg flex-shrink-0", isOverridden && "bg-primary text-primary-foreground")}
                              onClick={async () => {
                                if (isOverridden) {
                                  // Restore: remove the "Hari Kerja" override
                                  await toggleHoliday({ date: nh.date });
                                  showSuccess("Dipulihkan", `${nh.name} kembali menjadi hari libur`);
                                } else {
                                  // Override: mark as working day
                                  await toggleHoliday({ date: nh.date, description: "Hari Kerja" });
                                  showSuccess("Diubah", `${nh.name} dijadikan hari kerja`);
                                }
                              }}
                            >
                              {isOverridden ? (
                                <><CalendarOff className="w-3 h-3" /> Pulihkan</>
                              ) : (
                                <><Check className="w-3 h-3" /> Jadikan Kerja</>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="px-3 py-2 bg-muted/20 border-t border-border">
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      💡 Ketuk "Jadikan Kerja" untuk mengubah hari libur nasional menjadi hari sekolah aktif (misalnya karena kebijakan sekolah). Ketuk "Pulihkan" untuk mengembalikannya.
                    </p>
                  </div>
                </div>

                {/* Weekend Override - Direct Toggle */}
                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sun className="w-3.5 h-3.5 text-grade-warning" />
                        Jadikan Sabtu/Minggu Hari Kerja
                      </p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        Pilih tanggal untuk dijadikan hari kerja
                      </p>
                    </div>
                  </div>
                  
                  {/* Weekend days in current month */}
                  {monthDays.filter(day => {
                    const dayOfWeek = getDay(day);
                    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
                  }).length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Tidak ada hari Sabtu/Minggu bulan ini
                    </p>
                  ) : (
                    <div className="max-h-[220px] overflow-y-auto overscroll-auto">
                      {monthDays.filter(day => {
                        const dayOfWeek = getDay(day);
                        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
                      }).map((day) => {
                        const dayOfWeek = getDay(day);
                        const dayName = dayOfWeek === 0 ? "Minggu" : "Sabtu";
                        const dateStr = format(day, "yyyy-MM-dd");
                        const isOverridden = holidays.some(h => h.date === dateStr && h.description === "Hari Kerja");
                        
                        return (
                          <div
                            key={dateStr}
                            className={cn(
                              "flex items-center justify-between px-3 py-2.5 border-b border-border/30 last:border-0 transition-colors",
                              isOverridden ? "bg-primary/5" : "hover:bg-muted/30"
                            )}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <p className={cn("text-xs font-medium", isOverridden ? "text-muted-foreground line-through" : "text-foreground")}>
                                {dayName}, {format(day, "d MMM yyyy", { locale: idLocale })}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {isOverridden ? "✓ Dijadikan hari kerja" : "Libur"}
                              </p>
                            </div>
                            <Button
                              variant={isOverridden ? "default" : "outline"}
                              size="sm"
                              className={cn("h-7 px-2.5 text-[9px] gap-1 rounded-lg flex-shrink-0", isOverridden && "bg-primary text-primary-foreground")}
                              onClick={async () => {
                                if (isOverridden) {
                                  // Remove override
                                  await toggleHoliday({ date: dateStr });
                                  showSuccess("Dipulihkan", `${dayName}, ${format(day, "d MMM")} kembali menjadi hari libur`);
                                } else {
                                  // Add override
                                  await toggleHoliday({ date: dateStr, description: "Hari Kerja" });
                                  showSuccess("Diubah", `${dayName}, ${format(day, "d MMM")} dijadikan hari kerja`);
                                }
                              }}
                            >
                              {isOverridden ? (
                                <><CalendarOff className="w-3 h-3" /> Pulihkan</>  
                              ) : (
                                <><Check className="w-3 h-3" /> Jadikan Kerja</>
                              )}
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  
                  <div className="px-3 py-2 bg-muted/20 border-t border-border">
                    <p className="text-[9px] text-muted-foreground leading-relaxed">
                      💡 Klik "Jadikan Kerja" untuk mengubah hari Sabtu/Minggu menjadi hari sekolah aktif (misalnya untuk kegiatan di akhir pekan). Klik "Pulihkan" untuk mengembalikannya.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-card border border-border overflow-hidden">
                  <div className="px-3 py-2.5 border-b border-border bg-muted/30 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Kegiatan Khusus</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Tandai tanggal khusus (ujian, study tour, dll)</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[10px] gap-1 rounded-lg flex-shrink-0"
                      onClick={() => {
                        setShowDayEventDialog(true);
                      }}
                    >
                      <Bookmark className="w-3 h-3" />
                      Tambah
                    </Button>
                  </div>

                  {dayEvents.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                      Belum ada kegiatan khusus
                    </p>
                  ) : (
                    <div className="max-h-[160px] overflow-y-auto overscroll-auto">
                      {dayEvents.map((e) => {
                        const eDate = new Date(e.date);
                        const dayName = format(eDate, "EEEE", { locale: idLocale });
                        return (
                          <div
                            key={e.date}
                            className="flex items-center justify-between px-3 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-2 min-w-0 flex-1 pr-2">
                              <div
                                className={cn(
                                  "w-2 h-2 rounded-full flex-shrink-0",
                                  e.color === "red"
                                    ? "bg-destructive"
                                    : e.color === "green"
                                    ? "bg-grade-pass"
                                    : e.color === "purple"
                                    ? "bg-purple-500"
                                    : "bg-primary"
                                )}
                              />
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-foreground">
                                  {dayName}, {format(eDate, "d MMM yyyy", { locale: idLocale })}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {e.label}
                                  {e.description ? ` — ${e.description}` : ""}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-destructive hover:bg-destructive/10 flex-shrink-0"
                              onClick={() => handleRemoveDayEvent(e.date)}
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Footer — fixed di bawah */}
            <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0">
              <Button
                onClick={() => setShowSettingsSheet(false)}
                size="sm"
                className="text-xs rounded-xl w-full"
              >
                Selesai
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Holiday Add Dialog (Batch) */}
        <Dialog
          open={showHolidayDialog}
          onOpenChange={(open) => {
            setShowHolidayDialog(open);
            if (!open) {
              setSelectedHolidayDates([]);
              setHolidayDescription("");
            }
          }}
        >
          <DialogContent
            className={cn(
              "w-[calc(100vw-1.5rem)] max-w-md",
              "mx-auto rounded-2xl",
              "max-h-[90dvh] sm:max-h-[85vh]",
              "flex flex-col p-0 overflow-hidden"
            )}
          >
            {/* Header — fixed */}
            <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
                <CalendarOff className="w-4 h-4 text-grade-warning flex-shrink-0" />
                Tambah Hari Libur
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pilih satu atau beberapa tanggal sekaligus untuk ditambahkan sebagai hari libur atau hari kerja kustom.
                <span className="block mt-1 text-grade-warning font-medium">
                  Gunakan keterangan <strong>"Hari Kerja"</strong> untuk mengubah hari Minggu/Libur Nasional menjadi hari sekolah aktif.
                </span>
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-auto px-4 py-3 space-y-3">

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Pilih Tanggal (bisa lebih dari satu)
                </Label>
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-amber-950/20">
                  <div className="px-3 py-1.5 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                    <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                      <CalendarOff className="w-3 h-3" /> Kalender Hari Libur
                    </p>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[280px] max-w-full mx-auto">
                      <Calendar
                        mode="multiple"
                        selected={selectedHolidayDates}
                        onSelect={(dates) => setSelectedHolidayDates(dates || [])}
                        className="pointer-events-auto mx-auto"
                        classNames={{
                          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                          month: "space-y-4 w-full",
                          caption: "flex justify-center pt-1 relative items-center",
                          caption_label: "text-xs sm:text-sm font-medium",
                          table: "w-full border-collapse",
                          head_row: "flex w-full",
                          head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.65rem] sm:text-[0.8rem]",
                          row: "flex w-full mt-2",
                          cell: "flex-1 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-amber-100 dark:[&:has([aria-selected])]:bg-amber-900/40 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-8 w-full sm:h-9 p-0 font-normal aria-selected:opacity-100 text-xs sm:text-sm",
                          day_selected: "bg-amber-500 text-white hover:bg-amber-600 focus:bg-amber-600",
                        }}
                        modifiers={{
                          holiday: (date) => isHolidayCombined(date),
                          sunday: (date) => getDay(date) === 0,
                          hasExisting: (date) => !!getExistingHolidayForDate(date),
                        }}
                        modifiersClassNames={{
                          holiday: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium",
                          sunday: "text-amber-600 dark:text-amber-400",
                          hasExisting: "ring-2 ring-amber-400 ring-inset font-bold",
                        }}
                        /* disabled={(date) => getDay(date) === 0} */
                      />
                    </div>
                  </div>
                </div>

                {selectedHolidayDates.length > 0 && (
                  <div className="max-h-[72px] overflow-y-auto overscroll-auto">
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedHolidayDates
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map(d => {
                          const existing = getExistingHolidayForDate(d);
                          return (
                            <Tooltip key={d.toISOString()}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={existing ? "destructive" : "secondary"}
                                  className="text-[9px] gap-1 px-1.5 py-0.5"
                                >
                                  {format(d, "d MMM", { locale: idLocale })}
                                  {existing && <AlertCircle className="w-2 h-2" />}
                                  <button onClick={() => handleToggleHolidayDate(d)} className="hover:text-destructive">
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </Badge>
                              </TooltipTrigger>
                              {existing && (
                                <TooltipContent className="text-[10px]">
                                  <p className="font-semibold text-grade-warning">⚠ Sudah ada hari libur:</p>
                                  <p>{existing.description}</p>
                                  <p className="text-muted-foreground mt-0.5">Akan ditimpa dengan keterangan baru.</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Keterangan (berlaku untuk semua tanggal terpilih)
                </Label>
                <Input
                  placeholder="Contoh: Hari Raya Idul Fitri"
                  value={holidayDescription}
                  onChange={(e) => setHolidayDescription(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                />
              </div>

            </div>

            {/* Footer — fixed */}
            <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedHolidayDates([]);
                  setHolidayDescription("");
                  setShowHolidayDialog(false);
                }}
                size="sm"
                className="text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={async () => {
                  await handleAddHoliday();
                }}
                disabled={selectedHolidayDates.length === 0}
                size="sm"
                className="text-xs rounded-xl"
              >
                <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
                Tambah{selectedHolidayDates.length > 0 ? ` (${selectedHolidayDates.length})` : ""} Libur
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Day Event Dialog (Batch) */}
        <Dialog
          open={showDayEventDialog}
          onOpenChange={(open) => {
            setShowDayEventDialog(open);
            if (!open) {
              setSelectedDayEventDates([]);
              setDayEventLabel("");
              setDayEventDesc("");
            }
          }}
        >
          <DialogContent
            className={cn(
              "w-[calc(100vw-1.5rem)] max-w-md",
              "mx-auto rounded-2xl",
              "max-h-[90dvh] sm:max-h-[85vh]",
              "flex flex-col p-0 overflow-hidden"
            )}
          >
            {/* Header — fixed */}
            <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
              <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-primary flex-shrink-0" />
                Tambah Kegiatan Khusus
              </DialogTitle>
              <DialogDescription className="text-xs">
                Pilih satu atau beberapa tanggal sekaligus untuk menandai kegiatan khusus
                (ujian, studi wisata, dll).
              </DialogDescription>
            </DialogHeader>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto overscroll-auto px-4 py-3 space-y-3">

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Pilih Tanggal (bisa lebih dari satu)
                </Label>
                <div className="border border-primary/30 dark:border-primary/40 rounded-xl overflow-hidden bg-primary/5 dark:bg-primary/10">
                  <div className="px-3 py-1.5 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 dark:border-primary/30">
                    <p className="text-[9px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                      <Bookmark className="w-3 h-3" /> Kalender Kegiatan
                    </p>
                  </div>
                  <div className="w-full overflow-x-auto">
                    <div className="min-w-[280px] max-w-full mx-auto">
                      <Calendar
                        mode="multiple"
                        selected={selectedDayEventDates}
                        onSelect={(dates) => setSelectedDayEventDates(dates || [])}
                        className="pointer-events-auto mx-auto"
                        classNames={{
                          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                          month: "space-y-4 w-full",
                          caption: "flex justify-center pt-1 relative items-center",
                          caption_label: "text-xs sm:text-sm font-medium",
                          table: "w-full border-collapse",
                          head_row: "flex w-full",
                          head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.65rem] sm:text-[0.8rem]",
                          row: "flex w-full mt-2",
                          cell: "flex-1 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/15 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                          day: "h-8 w-full sm:h-9 p-0 font-normal aria-selected:opacity-100 text-xs sm:text-sm",
                          day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90",
                        }}
                        modifiers={{
                          dayEvent: (date) => !!getDayEvent(date),
                          hasExisting: (date) => !!getExistingEventForDate(date),
                          holiday: (date) => isHolidayCombined(date),
                        }}
                        modifiersClassNames={{
                          dayEvent: "ring-2 ring-primary/50 ring-inset font-bold",
                          hasExisting: "ring-2 ring-primary/50 ring-inset",
                          holiday: "bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 line-through opacity-60",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {selectedDayEventDates.length > 0 && (
                  <div className="max-h-[72px] overflow-y-auto overscroll-auto">
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {selectedDayEventDates
                        .sort((a, b) => a.getTime() - b.getTime())
                        .map(d => {
                          const existing = getExistingEventForDate(d);
                          return (
                            <Tooltip key={d.toISOString()}>
                              <TooltipTrigger asChild>
                                <Badge
                                  variant={existing ? "default" : "secondary"}
                                  className="text-[9px] gap-1 px-1.5 py-0.5"
                                >
                                  {format(d, "d MMM", { locale: idLocale })}
                                  {existing && <Info className="w-2 h-2" />}
                                  <button
                                    onClick={() => setSelectedDayEventDates(prev => prev.filter(pd => !isSameDay(pd, d)))}
                                    className="hover:text-destructive"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </Badge>
                              </TooltipTrigger>
                              {existing && (
                                <TooltipContent className="text-[10px]">
                                  <p className="font-semibold text-primary">ℹ Sudah ada kegiatan:</p>
                                  <p>{existing.label}{existing.description ? ` — ${existing.description}` : ""}</p>
                                  <p className="text-muted-foreground mt-0.5">Akan ditimpa dengan kegiatan baru.</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Label Kegiatan <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder="Contoh: UTS, Study Tour, Class Meeting"
                  value={dayEventLabel}
                  onChange={(e) => setDayEventLabel(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                  maxLength={50}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  Deskripsi (opsional)
                </Label>
                <Input
                  placeholder="Keterangan tambahan..."
                  value={dayEventDesc}
                  onChange={(e) => setDayEventDesc(e.target.value)}
                  className="h-9 text-sm rounded-xl"
                  maxLength={200}
                />
              </div>

            </div>

            {/* Footer — fixed */}
            <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0 flex items-center justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSelectedDayEventDates([]);
                  setDayEventLabel("");
                  setDayEventDesc("");
                  setShowDayEventDialog(false);
                }}
                size="sm"
                className="text-xs rounded-xl"
              >
                Batal
              </Button>
              <Button
                onClick={async () => {
                  await handleSaveDayEvent();
                }}
                disabled={selectedDayEventDates.length === 0 || !dayEventLabel.trim()}
                size="sm"
                className="text-xs rounded-xl"
              >
                <Bookmark className="w-3.5 h-3.5 mr-1.5" />
                Simpan{selectedDayEventDates.length > 0 ? ` (${selectedDayEventDates.length})` : ""} Kegiatan
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {exportOverlay}

      {/* Import Attendance Dialog */}
      {selectedClassId && (
        <ImportAttendanceDialog
          open={showImportAttendance}
          onOpenChange={setShowImportAttendance}
          classId={selectedClassId}
          className={selectedClass?.name || ""}
          students={students.map(s => ({ id: s.id, name: s.name, nisn: s.nisn }))}
          onImportComplete={() => {
            // Refresh attendance data
            window.location.reload();
          }}
        />
      )}

      {/* OCR Import Attendance Dialog */}
      <OCRImportDialog
        open={showOCRAttendance}
        onOpenChange={setShowOCRAttendance}
        type="attendance"
        title="Import Presensi dari Foto"
        description="Foto daftar presensi lalu ketik data untuk di-import"
        onDataReady={async (rows) => {
          if (!selectedClassId) return;
          let imported = 0;
          for (const row of rows) {
            const studentName = (row[0] || "").trim().toLowerCase();
            const dateStr = row[1] || "";
            const status = (row[2] || "").trim().toUpperCase();
            
            const matchedStudent = students.find(s => 
              s.name.toLowerCase().includes(studentName) || studentName.includes(s.name.toLowerCase())
            );
            if (!matchedStudent) continue;
            if (!["H", "I", "S", "A", "D"].includes(status)) continue;
            
            await setAttendanceDb({ studentId: matchedStudent.id, date: dateStr, status: status as AttendanceStatusValue });
            imported++;
          }
          if (imported > 0) showSuccess("Berhasil", `${imported} data presensi berhasil diimport`);
        }}
      />
    </>
  );
}

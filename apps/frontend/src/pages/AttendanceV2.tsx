import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import gsap from "gsap";
import { 
  Loader2, MessageSquare, AlertCircle, X, CalendarDays, CheckCircle2,
  Users, UserCheck, BarChart3, ChevronLeft, ChevronRight, Bookmark 
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

import { useClasses, type Class } from "@/hooks/useClasses";
import { useStudents, type Student } from "@/hooks/useStudents";
import { useAttendanceV2, type AttendanceStatusValue, type DayEvent, type RecapProfile } from "@/hooks/useAttendanceV2";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import { cn } from "@/lib/utils";

// UI Components & Dialogs
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ProductTour } from "@/components/ui/product-tour";

import ImportAttendanceDialog from "@/components/import/ImportAttendanceDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";
import { normalizeAttendanceStatus, normalizeOcrDate } from "@/lib/ocrImport";

import { SettingsDashboard } from "@/components/attendance/v2/SettingsDashboard";
import { HolidayAddDialog } from "@/components/attendance/v2/HolidayAddDialog";
import { DayEventAddDialog } from "@/components/attendance/v2/DayEventAddDialog";
import { DelegationAddDialog } from "@/components/attendance/v2/DelegationAddDialog";
import { MergeV2toV1Dialog } from "@/components/attendance/v2/MergeV2toV1Dialog";
import { SnapshotReasonDialog } from "@/components/attendance/v2/SnapshotReasonDialog";

import { createDefaultReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { useIndonesianHolidays } from "@/hooks/useIndonesianHolidays";
import { getJumlahConfig, type JumlahConfig } from "@/components/attendance/JumlahCalculationConfig";

// Hooks & Sub-components V2
import { useAttendanceV2Export } from "@/hooks/useAttendanceV2Export";
import { AttendanceV2Controls } from "@/components/attendance/v2/AttendanceV2Controls";
import { AttendanceV2DailyView } from "@/components/attendance/v2/AttendanceV2DailyView";
import { AttendanceV2MonthlyView } from "@/components/attendance/v2/AttendanceV2MonthlyView";

type AttendanceStatus = AttendanceStatusValue | null;

type SupabaseDeleteFilter = {
  eq: (column: string, value: string) => SupabaseDeleteFilter;
};

type SupabaseDeleteClient = {
  from: (table: string) => {
    delete: () => SupabaseDeleteFilter;
  };
};

const statusLabels: Record<string, string> = {
  H: "Hadir",
  I: "Izin",
  S: "Sakit",
  A: "Alpha",
  D: "Dispensasi",
  null: "Dikosongkan",
};

const statusConfig = {
  H: {
    label: "Hadir",
    color: "text-grade-pass dark:text-emerald-400",
    bg: "bg-grade-pass/10 dark:bg-emerald-950/30",
    bgActive: "bg-grade-pass text-white border-none",
    icon: (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...props}><path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  I: {
    label: "Izin",
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/30",
    bgActive: "bg-blue-600 text-white border-none",
    icon: (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  S: {
    label: "Sakit",
    color: "text-grade-warning dark:text-amber-400",
    bg: "bg-grade-warning/10 dark:bg-amber-950/30",
    bgActive: "bg-grade-warning text-white border-none",
    icon: (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  A: {
    label: "Alpha",
    color: "text-grade-fail dark:text-red-400",
    bg: "bg-grade-fail/10 dark:bg-red-950/30",
    bgActive: "bg-grade-fail text-white border-none",
    icon: (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" {...props}><path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
  },
  D: {
    label: "Dispensasi",
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/30",
    bgActive: "bg-purple-600 text-white border-none",
    icon: (props: any) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" {...props}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" strokeLinecap="round" strokeLinejoin="round"/></svg>
  }
};

const allStatuses: ("H" | "I" | "S" | "A" | "D")[] = ["H", "S", "I", "A", "D"];

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

export default function AttendanceV2Page() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { success: showSuccess, warning: showWarning } = useEnhancedToast();
  const { runWithLoader, overlay: exportOverlay } = useExportLoader();

  const containerRef = useRef<HTMLDivElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);
  const lastNotificationRef = useRef<number>(0);

  const preTourClassIdRef = useRef<string | null>(null);
  const preTourActiveViewRef = useRef<"daily" | "monthly" | null>(null);

  // Global Page states
  const { classes } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentMonth, setCurrentMonth] = useState<Date>(startOfMonth(new Date()));
  const [activeView, setActiveView] = useState<"daily" | "monthly">("daily");
  const [searchQuery, setSearchQuery] = useState("");

  // Tour & Dummy Data states
  const [isTourDummyActive, setIsTourDummyActive] = useState(false);
  const [tourDummyClass, setTourDummyClass] = useState<Class | null>(null);
  const [tourDummyStudents, setTourDummyStudents] = useState<Student[]>([]);

  // Dialog & Modal states
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [showBulkDialog, setShowBulkDialog] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<AttendanceStatus>("H");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [existingBulkStudents, setExistingBulkStudents] = useState<{ name: string; status: string }[]>([]);

  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteTarget, setNoteTarget] = useState<{ studentId: string; studentName: string; date: Date } | null>(null);
  const [noteText, setNoteText] = useState("");

  const [showSettingsSheet, setShowSettingsSheet] = useState(false);

  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [selectedHolidayDates, setSelectedHolidayDates] = useState<Date[]>([]);
  const [holidayDescription, setHolidayDescription] = useState("");
  const [isHolidayGlobal, setIsHolidayGlobal] = useState(false);

  const [showDayEventDialog, setShowDayEventDialog] = useState(false);
  const [selectedDayEventDates, setSelectedDayEventDates] = useState<Date[]>([]);
  const [dayEventLabel, setDayEventLabel] = useState("");
  const [dayEventDesc, setDayEventDesc] = useState("");
  const [dayEventColor, setDayEventColor] = useState("#3b82f6");

  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showExportMonthDialog, setShowExportMonthDialog] = useState(false);
  const [exportPickerYear, setExportPickerYear] = useState<number>(new Date().getFullYear());

  const [showPromoteConfirm, setShowPromoteConfirm] = useState(false);
  const [showSnapshotReasonDialog, setShowSnapshotReasonDialog] = useState(false);
  const [snapshotReason, setSnapshotReason] = useState("");

  const [showDelegationDialog, setShowDelegationDialog] = useState(false);
  const [delegationTargetEmail, setDelegationTargetEmail] = useState("");
  const [delegationStartsAt, setDelegationStartsAt] = useState<Date>(() => new Date());
  const [delegationEndsAt, setDelegationEndsAt] = useState<Date>(() => addMonths(new Date(), 1));

  const [showImportAttendance, setShowImportAttendance] = useState(false);
  const [showOCRAttendance, setShowOCRAttendance] = useState(false);

  const [attendanceStylePresetBaseline, setAttendanceStylePresetBaseline] = useState(() => ({
    documentStyle: structuredClone(createDefaultReportDocumentStyle()),
    autoFitOnePage: true,
  }));

  // Calendar formats
  const [workDayFormat, setWorkDayFormat] = useState<"5days" | "6days">(() => {
    const saved = localStorage.getItem("attendance_work_format");
    return (saved as "5days" | "6days") || "6days";
  });

  const handleWorkDayFormatChange = useCallback((fmt: "5days" | "6days") => {
    setWorkDayFormat(fmt);
    localStorage.setItem("attendance_work_format", fmt);
    showSuccess("Format Diubah", `Format hari kerja diubah ke ${fmt === "5days" ? "5 hari (Senin-Jumat)" : "6 hari (Senin-Sabtu)"}`);
  }, [showSuccess]);

  // Load students & query V2 database
  const { students: dbStudents } = useStudents(selectedClassId === "tour-dummy-class" ? "" : selectedClassId);

  const students = useMemo(() => {
    if (isTourDummyActive && tourDummyStudents.length > 0) {
      return tourDummyStudents;
    }
    return dbStudents;
  }, [dbStudents, isTourDummyActive, tourDummyStudents]);

  const selectedClass = useMemo(() => {
    if (isTourDummyActive && tourDummyClass) return tourDummyClass;
    return classes.find((c) => c.id === selectedClassId);
  }, [classes, selectedClassId, isTourDummyActive, tourDummyClass]);

  const {
    attendanceRecords, holidays, dayEvents, isLocked, dbAvailable,
    getAttendance: dbGetAttendance, getAttendanceNote: dbGetAttendanceNote, getDayEvent, isHoliday, getHolidayDescription, getMonthStats: dbGetMonthStats, getDayStats: dbGetDayStats, getYearlyData,
    setAttendance: setAttendanceDb, updateNote, bulkSetAttendance, toggleHoliday, upsertDayEvent, deleteDayEvent, toggleLock,
    pendingAttendanceSaves, failedAttendanceSaves, retryFailedAttendanceSaves,
    isSaving, isLoading, promoteV2ToV1, isPromoting,
    recapProfile, snapshots, delegations,
    updateRecapProfile, createSnapshot, restoreSnapshot, createDelegation, revokeDelegation,
    isUpdatingRecapProfile, isCreatingSnapshot, isRestoringSnapshot, isCreatingDelegation, isRevokingDelegation,
  } = useAttendanceV2(selectedClassId === "tour-dummy-class" ? "" : selectedClassId, currentMonth, workDayFormat);

  const renderAttendanceSaveIndicator = useCallback(() => {
    if (failedAttendanceSaves > 0) {
      return (
        <button
          type="button"
          onClick={retryFailedAttendanceSaves}
          className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 text-[11px] font-semibold text-destructive touch-manipulation"
        >
          <AlertCircle className="h-3.5 w-3.5" />
          {failedAttendanceSaves} gagal, coba lagi
        </button>
      );
    }

    if (pendingAttendanceSaves > 0) {
      return (
        <Badge variant="secondary" className="min-h-8 gap-1.5 rounded-full px-3 text-[11px] font-semibold">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
          Menyimpan {pendingAttendanceSaves} perubahan
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="min-h-8 gap-1.5 rounded-full px-3 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Semua tersimpan
      </Badge>
    );
  }, [failedAttendanceSaves, pendingAttendanceSaves, retryFailedAttendanceSaves]);

  const {
    signatureConfig,
    hasSignature,
    isLoading: signatureLoading,
    isSaving: signatureSaving,
    saveSignature,
  } = useSignatureSettings();

  const getAttendance = useCallback((studentId: string, date: Date) => {
    if (isTourDummyActive) {
      const day = date.getDate();
      if (day % 7 === 0) return "S";
      if (day % 9 === 0) return "I";
      if (day % 11 === 0) return "A";
      if (day % 13 === 0) return "D";
      return "H";
    }
    return dbGetAttendance(studentId, date);
  }, [dbGetAttendance, isTourDummyActive]);

  const getAttendanceNote = useCallback((studentId: string, date: Date) => {
    if (isTourDummyActive) {
      const day = date.getDate();
      if (day % 7 === 0) return "Izin berobat ke dokter gigi";
      if (day % 11 === 0) return "Tanpa keterangan (Alpha)";
      return "";
    }
    return dbGetAttendanceNote(studentId, date);
  }, [dbGetAttendanceNote, isTourDummyActive]);

  const getDayStats = useCallback((date: Date) => {
    if (isTourDummyActive) {
      return { H: 4, S: 1, I: 0, A: 0, D: 0, total: 5 };
    }
    return dbGetDayStats(date);
  }, [dbGetDayStats, isTourDummyActive]);

  const getMonthStats = useCallback(() => {
    if (isTourDummyActive) {
      return { H: 85, S: 5, I: 2, A: 1, D: 2, total: 95 };
    }
    return dbGetMonthStats();
  }, [dbGetMonthStats, isTourDummyActive]);

  // Tour steps and lifecycle helpers
  const attendanceTourSteps = useMemo(() => {
    if (classes.length === 0) {
      return [
        {
          target: "[data-tour='attendance-no-classes']",
          title: "Buat Kelas Terlebih Dahulu",
          description: "Presensi memerlukan data kelas dan murid. Silakan buat kelas baru terlebih dahulu melalui halaman Kelas & Murid.",
        },
      ];
    }

    const baseSteps = [
      {
        target: "[data-tour='class-select']",
        title: "Pilih Kelas",
        description: "Pilih kelas yang akan dikelola presensinya. Data murid akan dimuat setelah kelas dipilih.",
      },
      {
        target: "[data-tour='view-switch']",
        title: "Pilih Tampilan",
        description: "Beralih antara tampilan Harian untuk mengisi presensi hari ini, atau Rekap Bulanan untuk melihat rekapitulasi kehadiran murid.",
      },
      {
        target: "[data-tour='date-select']",
        title: "Pilih Tanggal",
        description: "Gunakan kalender untuk memilih tanggal presensi harian atau melihat bulan rekapitulasi yang berbeda.",
      },
      {
        target: "[data-tour='calendar-settings']",
        title: "Pengaturan Kalender",
        description: "Atur format hari kerja (5 atau 6 hari kerja) serta kelola hari libur kustom dan libur nasional di sini.",
      },
      {
        target: "[data-tour='import-attendance']",
        title: "Import Presensi",
        description: "Import data kehadiran dari file Excel atau gunakan fitur OCR Kamera (BETA) untuk memindai dokumen fisik presensi.",
      },
    ];

    if (students.length === 0) {
      return [
        ...baseSteps,
        {
          target: "[data-tour='attendance-empty-cta']",
          title: "Mulai Tambah Murid",
          description: "Kelas ini belum memiliki murid. Silakan klik tombol di bawah untuk diarahkan ke halaman pengelolaan murid.",
        },
      ];
    }

    return [
      ...baseSteps,
      {
        target: "[data-tour='export-attendance']",
        title: "Ekspor Presensi",
        description: "Ekspor rekapitulasi kehadiran bulanan ke file PDF (siap cetak), Excel, atau gambar PNG resolusi tinggi.",
      },
      {
        target: "[data-tour='attendance-table']",
        title: "Tabel Presensi",
        description: "Klik status (H, S, I, A, D) pada murid untuk mengubah kehadiran, dan klik ikon teks di sebelah nama untuk menambahkan catatan/keterangan khusus.",
      },
    ];
  }, [classes.length, students.length]);

  const setupFullDummyData = () => {
    setIsTourDummyActive(true);
    const now = new Date().toISOString();

    const dummyClass: Class = {
      id: "tour-dummy-class",
      user_id: "tour-user",
      academic_year_id: "tour-year",
      semester_id: "tour-semester",
      name: "Contoh Kelas VIIA",
      description: "Kelas contoh untuk panduan interaktif SIPENA.",
      class_kkm: 75,
      created_at: now,
      updated_at: now,
      student_count: 5,
    };
    setTourDummyClass(dummyClass);
    setSelectedClassId("tour-dummy-class");

    const dummyStuds: Student[] = [
      { id: "tour-stud-1", class_id: "tour-dummy-class", name: "Ahmad Murid A", nisn: "1234567890", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-2", class_id: "tour-dummy-class", name: "Budi Murid B", nisn: "1234567891", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-3", class_id: "tour-dummy-class", name: "Citra Murid C", nisn: "1234567892", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-4", class_id: "tour-dummy-class", name: "Dina Murid D", nisn: "1234567893", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-5", class_id: "tour-dummy-class", name: "Eko Murid E", nisn: "1234567894", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
    ];
    setTourDummyStudents(dummyStuds);
  };

  const setupDummyStudents = (classId: string) => {
    setIsTourDummyActive(true);
    const now = new Date().toISOString();

    const dummyStuds: Student[] = [
      { id: "tour-stud-1", class_id: classId, name: "Ahmad Murid A", nisn: "1234567890", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-2", class_id: classId, name: "Budi Murid B", nisn: "1234567891", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-3", class_id: classId, name: "Citra Murid C", nisn: "1234567892", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-4", class_id: classId, name: "Dina Murid D", nisn: "1234567893", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
      { id: "tour-stud-5", class_id: classId, name: "Eko Murid E", nisn: "1234567894", is_bookmarked: false, created_at: now, updated_at: now, user_id: "tour-user" },
    ];
    setTourDummyStudents(dummyStuds);
  };

  const prepareAttendanceTour = async () => {
    preTourClassIdRef.current = selectedClassId;
    preTourActiveViewRef.current = activeView;
    setActiveView("daily");

    let activeClassId = selectedClassId;
    if (!activeClassId) {
      if (classes.length > 0) {
        activeClassId = classes[0].id;
        setSelectedClassId(activeClassId);
        await new Promise<void>((resolve) => setTimeout(resolve, 150));
      } else {
        setupFullDummyData();
        await new Promise<void>((resolve) => setTimeout(resolve, 300));
        return;
      }
    }

    if (students.length === 0) {
      setupDummyStudents(activeClassId);
      await new Promise<void>((resolve) => setTimeout(resolve, 300));
    }
  };

  const cleanupAttendanceTour = () => {
    setIsTourDummyActive(false);
    setTourDummyClass(null);
    setTourDummyStudents([]);

    if (preTourClassIdRef.current !== null) {
      setSelectedClassId(preTourClassIdRef.current);
      preTourClassIdRef.current = null;
    } else {
      if (selectedClassId === "tour-dummy-class") {
        setSelectedClassId("");
      }
    }

    if (preTourActiveViewRef.current !== null) {
      setActiveView(preTourActiveViewRef.current);
    }
  };

  const handlePromote = async () => {
    try {
      setShowPromoteConfirm(false);
      await promoteV2ToV1();
      showSuccess("Merge Berhasil", "Data hasil eksperimen V2 berhasil digabungkan ke produksi V1!");
    } catch (err: any) {
      showWarning("Merge Gagal", err.message || "Gagal menggabungkan data V2 ke V1.");
    }
  };

  // GSAP animations
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

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) => s.name.toLowerCase().includes(query) || (s.nisn && s.nisn.toLowerCase().includes(query))
    );
  }, [students, searchQuery]);

  const monthDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Indonesian holidays setup
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

  const [jumlahConfig, setJumlahConfig] = useState<JumlahConfig>(getJumlahConfig);

  const isHolidayCombined = useCallback(
    (date: Date): boolean => {
      const dateStr = format(date, "yyyy-MM-dd");
      const customHoliday = holidays.find((h) => h.date === dateStr);
      
      if (customHoliday) {
        return customHoliday.description !== "Hari Kerja";
      }

      return isHoliday(date) || isNationalHoliday(date);
    },
    [isHoliday, holidays, isNationalHoliday]
  );

  const getHolidayDescriptionCombined = useCallback(
    (date: Date): string | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      const customHoliday = holidays.find((h) => h.date === dateStr);
      
      if (customHoliday && customHoliday.description === "Hari Kerja") return null;
      
      const userDesc = getHolidayDescription(date);
      if (userDesc) return userDesc;
      
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

  const attendancePreviewData = useMemo(() => {
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

  const attendancePrintDataset = useMemo(() => {
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

  const attendancePreviewStudioData = useMemo(() => ({
    ...attendancePreviewData,
    holidayItems: attendancePrintDataset.holidayItems,
    eventItems: attendancePrintDataset.eventItems,
  }), [attendancePreviewData, attendancePrintDataset]);

  // Instantiate export hook
  const {
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
  } = useAttendanceV2Export({
    selectedClass,
    currentMonth,
    setCurrentMonth,
    setSelectedDate,
    workDayFormat,
    students,
    holidays,
    dayEvents,
    isHolidayCombined,
    getHolidayDescriptionCombined,
    getAttendance,
    getAttendanceNote,
    runWithLoader,
    showSuccess,
    showWarning,
    dbAvailable,
    getYearlyData,
    signatureConfig,
    saveSignature,
    hasSignature,
    signatureLoading,
    signatureSaving,
    attendancePrintDataset,
    attendancePreviewStudioData,
    getHolidayDescription,
    isNationalHoliday,
    getNationalHolidayName,
    getDayEvent,
    setShowExportDialog,
  });

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
      await toggleHoliday({ 
        date: dateStr, 
        description: desc, 
        classId: isHolidayGlobal ? null : selectedClassId 
      });
    }
    setShowHolidayDialog(false);
    setHolidayDescription("");
    setSelectedHolidayDates([]);
    setIsHolidayGlobal(false);
    showSuccess("Berhasil", `${selectedHolidayDates.length} hari libur berhasil ditambahkan`);
  }, [selectedHolidayDates, holidayDescription, isHolidayGlobal, selectedClassId, toggleHoliday, showSuccess]);

  const handleRemoveHoliday = useCallback(async (dateStr: string, classIdParam?: string | null) => {
    await toggleHoliday({ date: dateStr, classId: classIdParam !== undefined ? classIdParam : selectedClassId });
    showSuccess("Berhasil", "Hari libur berhasil dihapus");
  }, [toggleHoliday, selectedClassId, showSuccess]);

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

  const handleUpdateRecapProfile = useCallback(async (updates: Partial<RecapProfile>) => {
    if (!recapProfile) return;
    try {
      await updateRecapProfile({
        id: recapProfile.id,
        name: recapProfile.name,
        counted_statuses: updates.counted_statuses ?? recapProfile.counted_statuses,
        present_statuses: updates.present_statuses ?? recapProfile.present_statuses,
        absence_statuses: updates.absence_statuses ?? recapProfile.absence_statuses,
        denominator_policy: updates.denominator_policy ?? recapProfile.denominator_policy,
        display_order: updates.display_order ?? recapProfile.display_order,
      });
      showSuccess("Profil Diperbarui", "Konfigurasi rekapitulasi berhasil disimpan");
    } catch (e: any) {
      showWarning("Gagal", `Gagal memperbarui profil: ${e.message || e}`);
    }
  }, [recapProfile, updateRecapProfile, showSuccess, showWarning]);

  const handleToggleRecapStatus = useCallback(async (type: "present" | "absence" | "counted", status: AttendanceStatusValue) => {
    if (!recapProfile) return;
    
    let nextCounted = [...recapProfile.counted_statuses];
    let nextPresent = [...recapProfile.present_statuses];
    let nextAbsence = [...recapProfile.absence_statuses];

    if (type === "present") {
      if (nextPresent.includes(status)) {
        nextPresent = nextPresent.filter(s => s !== status);
      } else {
        nextPresent.push(status);
        nextAbsence = nextAbsence.filter(s => s !== status);
      }
    } else if (type === "absence") {
      if (nextAbsence.includes(status)) {
        nextAbsence = nextAbsence.filter(s => s !== status);
      } else {
        nextAbsence.push(status);
        nextPresent = nextPresent.filter(s => s !== status);
      }
    }

    const allStatuses = Array.from(new Set([...nextPresent, ...nextAbsence])) as AttendanceStatusValue[];
    nextCounted = allStatuses;

    await handleUpdateRecapProfile({
      present_statuses: nextPresent,
      absence_statuses: nextAbsence,
      counted_statuses: nextCounted,
    });
  }, [recapProfile, handleUpdateRecapProfile]);

  const handleCreateSnapshotAction = useCallback(async () => {
    try {
      await createSnapshot(snapshotReason.trim() || null);
      showSuccess("Snapshot Berhasil", "Snapshot bulanan berhasil disimpan dan dikunci.");
      setSnapshotReason("");
      setShowSnapshotReasonDialog(false);
    } catch (e: any) {
      showWarning("Gagal", `Gagal membuat snapshot: ${e.message || e}`);
    }
  }, [createSnapshot, snapshotReason, showSuccess, showWarning]);

  const handleRestoreSnapshotAction = useCallback(async (snapshotId: string) => {
    try {
      await restoreSnapshot(snapshotId);
      showSuccess("Data Dipulihkan", "Data presensi berhasil dipulihkan dari snapshot terpilih.");
    } catch (e: any) {
      showWarning("Gagal", `Gagal memulihkan data: ${e.message || e}`);
    }
  }, [restoreSnapshot, showSuccess, showWarning]);

  const handleCreateDelegationAction = useCallback(async () => {
    if (!delegationTargetEmail.trim()) {
      showWarning("Input Kurang", "Email guru pengganti wajib diisi");
      return;
    }
    try {
      const { data: profileData, error } = await (supabase as any)
        .from("team_profiles")
        .select("id, name")
        .eq("email", delegationTargetEmail.trim())
        .maybeSingle();

      if (error || !profileData) {
        showWarning("Tidak Ditemukan", "Guru dengan email tersebut tidak ditemukan di sistem.");
        return;
      }

      await createDelegation({
        granteeUserId: profileData.id,
        granteeLabel: profileData.name || delegationTargetEmail.trim(),
        startsAt: delegationStartsAt,
        endsAt: delegationEndsAt,
      });

      showSuccess("Delegasi Berhasil", `Akses didelegasikan kepada ${profileData.name || delegationTargetEmail}`);
      setDelegationTargetEmail("");
      setShowDelegationDialog(false);
    } catch (e: any) {
      showWarning("Gagal", `Gagal mendelegasikan akses: ${e.message || e}`);
    }
  }, [delegationTargetEmail, delegationStartsAt, delegationEndsAt, createDelegation, showSuccess, showWarning]);

  const handleRevokeDelegationAction = useCallback(async (id: string) => {
    try {
      await revokeDelegation(id);
      showSuccess("Delegasi Dicabut", "Akses guru pengganti berhasil dicabut.");
    } catch (e: any) {
      showWarning("Gagal", `Gagal mencabut delegasi: ${e.message || e}`);
    }
  }, [revokeDelegation, showSuccess, showWarning]);

  const handleBulkAttendance = useCallback(async () => {
    if (isHolidayCombined(selectedDate)) {
      showWarning("Hari Libur", `Tidak dapat input presensi: ${getHolidayDescriptionCombined(selectedDate)}`);
      setShowBulkDialog(false);
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    
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
  }, [selectedDate, students, bulkStatus, bulkSetAttendance, isHolidayCombined, getHolidayDescriptionCombined, getAttendance, showSuccess, showWarning, showBulkConfirm]);

  const handleBulkClear = useCallback(async () => {
    if (isHolidayCombined(selectedDate)) {
      showWarning("Hari Libur", `Tidak dapat mengosongkan presensi: ${getHolidayDescriptionCombined(selectedDate)}`);
      setShowBulkDialog(false);
      return;
    }
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    if (selectedClassId) {
      const { supabaseExternal } = await import("@/core/repositories/supabase-compat.repository");
      const deleteQuery = (supabaseExternal as unknown as SupabaseDeleteClient)
        .from("attendance_records")
        .delete()
        .eq("class_id", selectedClassId)
        .eq("date", dateStr);
      await Promise.resolve(deleteQuery as unknown);
    }
    setShowBulkDialog(false);
    setShowBulkConfirm(false);
    showSuccess("Berhasil", `Presensi tanggal ${format(selectedDate, "d MMMM yyyy", { locale: idLocale })} dikosongkan`);
    window.location.reload();
  }, [selectedDate, isHolidayCombined, getHolidayDescriptionCombined, showSuccess, showWarning, selectedClassId]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      const dateMonth = startOfMonth(date);
      const current = startOfMonth(currentMonth);
      if (dateMonth.getTime() !== current.getTime()) {
        setCurrentMonth(date);
      }
      setIsDatePickerOpen(false);
    }
  };

  const confirmAttendanceExportMonth = useCallback((monthIndex: number) => {
    const nextMonth = startOfMonth(new Date(exportPickerYear, monthIndex, 1));
    setCurrentMonth(nextMonth);
    setSelectedDate(nextMonth);
    setShowExportMonthDialog(false);
    window.setTimeout(() => setShowExportDialog(true), 180);
  }, [exportPickerYear, setCurrentMonth, setSelectedDate, setShowExportDialog]);

  const handleToggleLock = async () => await toggleLock(!isLocked);

  const hasData = selectedClassId && students.length > 0;

  return (
    <>
      <div ref={containerRef} className="app-page">
        <AttendanceV2Controls
          selectedClassId={selectedClassId}
          setSelectedClassId={setSelectedClassId}
          selectedClass={selectedClass}
          classes={classes}
          dbAvailable={dbAvailable}
          isPromoting={isPromoting}
          setShowPromoteConfirm={setShowPromoteConfirm}
          setShowImportAttendance={setShowImportAttendance}
          setShowOCRAttendance={setShowOCRAttendance}
          prepareAttendanceTour={prepareAttendanceTour}
          hasData={hasData}
          attendanceStudioOpen={showExportDialog}
          setAttendanceStudioOpen={setShowExportDialog}
          openAttendanceExportMonthDialog={openAttendanceExportMonthDialog}
          attendanceExportFormat={attendanceExportFormat}
          handleAttendanceExportFormatChange={setAttendanceExportFormat}
          selectedAttendanceColumnKeys={selectedAttendanceColumnKeys}
          includeSignature={includeSignature}
          setIncludeSignature={setIncludeSignature}
          attendanceDefaultSignatureConfig={attendanceDefaultSignatureConfig}
          hasSignature={hasSignature}
          signatureLoading={signatureLoading}
          signatureSaving={signatureSaving}
          saveSignature={saveSignature}
          paperSize={paperSize}
          setPaperSize={setPaperSize}
          documentStyle={documentStyle}
          setDocumentStyle={setDocumentStyle}
          autoFitOnePage={autoFitOnePage}
          setAutoFitOnePage={setAutoFitOnePage}
          attendanceDebugPanel={attendanceDebugPanel}
          attendanceStylePanelExtra={attendanceStylePanelExtra}
          attendanceDebugPreviewFooter={attendanceDebugPreviewFooter}
          attendanceColumnOptions={attendanceColumnOptions}
          handleAttendanceColumnOptionChange={handleAttendanceColumnOptionChange}
          attendanceColumnTypographyOptions={attendanceColumnTypographyOptions}
          resetAttendanceStudioDefaults={resetAttendanceStudioDefaults}
          attendanceStylePresetBaseline={attendanceStylePresetBaseline}
          attendancePreviewStudioData={attendancePreviewStudioData}
          attendancePrintDataset={attendancePrintDataset}
          isHolidayCombined={isHolidayCombined}
          selectedDate={selectedDate}
          isDatePickerOpen={isDatePickerOpen}
          setIsDatePickerOpen={setIsDatePickerOpen}
          handleDateSelect={handleDateSelect}
          isNationalHoliday={isNationalHoliday}
          getHolidayDescription={getHolidayDescription}
          getNationalHolidayName={getNationalHolidayName}
          holidays={holidays}
          workDayFormat={workDayFormat}
          setShowSettingsSheet={setShowSettingsSheet}
          getHolidayDescriptionCombined={getHolidayDescriptionCombined}
          getDayEvent={getDayEvent}
          handleExportExcel={handleExportExcel}
          handleExportPDFVector={handleExportPDFVector}
          handleExportPNGV2={handleExportPNGV2}
          attendanceAnnotationDisplayMode={attendanceAnnotationDisplayMode}
          attendanceEventAnnotationDisplayMode={attendanceEventAnnotationDisplayMode}
          attendanceInlineLabelStyle={attendanceInlineLabelStyle}
          attendanceDebugEnabled={attendanceDebugEnabled}
          commitAttendanceTrace={commitAttendanceTrace}
        />

        {/* Empty States */}
        {!selectedClassId && (
          <div data-tour={classes.length === 0 ? "attendance-no-classes" : undefined} className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-[20px] bg-muted/60 flex items-center justify-center mb-4">
              <CalendarDays className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground">Pilih Kelas</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">Pilih kelas di atas untuk mulai mencatat kehadiran murid.</p>
          </div>
        )}

        {selectedClassId && students.length === 0 && (
          <div data-tour="attendance-empty-cta" className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-[20px] bg-primary/10 flex items-center justify-center mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h3 className="mb-1 text-base font-semibold text-foreground">Belum Ada Murid</h3>
            <p className="mb-4 max-w-xs text-center text-xs text-muted-foreground">
              Kelas ini belum memiliki data murid. Silakan tambahkan murid terlebih dahulu.
            </p>
            <Button variant="outline" onClick={() => navigate("/classes")} className="h-9 rounded-xl text-xs gap-1.5">
              Kelola Murid
            </Button>
          </div>
        )}

        {hasData && (
          <div className="rounded-3xl bg-card border border-border shadow-sm overflow-hidden flex flex-col">
            {/* Tab Header Section */}
            <div className="p-4 sm:p-5 border-b border-border bg-muted/10">
              <div data-tour="view-switch" className="flex rounded-2xl bg-muted/30 p-1.5 gap-1.5 border-2 border-muted/50 shadow-inner">
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
              {activeView === "daily" ? (
                <>
                  {/* Daily View Stats Cards */}
                  <div ref={statsRef} className="grid grid-cols-5 gap-1.5 sm:gap-2">
                    {allStatuses.map((key) => {
                      const cfg = statusConfig[key];
                      const val = dailyStats[key];
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

                  <AttendanceV2DailyView
                    selectedClass={selectedClass}
                    selectedDate={selectedDate}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    setShowBulkDialog={setShowBulkDialog}
                    isHolidayCombined={isHolidayCombined}
                    getHolidayDescriptionCombined={getHolidayDescriptionCombined}
                    filteredStudents={filteredStudents}
                    getAttendance={getAttendance}
                    getAttendanceNote={getAttendanceNote}
                    handleOpenNote={handleOpenNote}
                    handleSetAttendance={handleSetAttendance}
                    allStatuses={allStatuses}
                    statusConfig={statusConfig}
                    saveIndicator={renderAttendanceSaveIndicator()}
                  />
                </>
              ) : (
                <AttendanceV2MonthlyView
                  isLocked={isLocked}
                  handleToggleLock={handleToggleLock}
                  jumlahConfig={jumlahConfig}
                  setJumlahConfig={setJumlahConfig}
                  handlePrevMonth={handlePrevMonth}
                  currentMonth={currentMonth}
                  handleNextMonth={handleNextMonth}
                  workDayFormat={workDayFormat}
                  holidays={holidays}
                  isHolidayCombined={isHolidayCombined}
                  isNationalHoliday={isNationalHoliday}
                  getDayEvent={getDayEvent}
                  getHolidayDescriptionCombined={getHolidayDescriptionCombined}
                  getNationalHolidayName={getNationalHolidayName}
                  getHolidayDescription={getHolidayDescription}
                  filteredStudents={filteredStudents}
                  getAttendance={getAttendance}
                  getAttendanceNote={getAttendanceNote}
                  handleSetMonthlyAttendance={handleSetMonthlyAttendance}
                  allStatuses={allStatuses}
                  statusConfig={statusConfig}
                  monthDays={monthDays}
                  effectiveDays={effectiveDays}
                  nationalHolidays={nationalHolidays}
                  nationalHolidaysLoading={nationalHolidaysLoading}
                  nationalHolidaysLastSynced={nationalHolidaysLastSynced}
                  nationalHolidaysError={nationalHolidaysError}
                  refreshNationalHolidays={refreshNationalHolidays}
                  monthNationalHolidays={monthNationalHolidays}
                  dailyStats={dailyStats}
                  monthlyStats={monthlyStats}
                  activeView={activeView}
                  saveIndicator={renderAttendanceSaveIndicator()}
                />
              )}
            </div>
          </div>
        )}

        {/* Bulk Attendance Dialog */}
        <Dialog open={showBulkDialog} onOpenChange={(open) => { setShowBulkDialog(open); if (!open) { setShowBulkConfirm(false); setExistingBulkStudents([]); } }}>
          <DialogContent className="sm:max-w-md mx-3 rounded-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm sm:text-base">Presensi Massal</DialogTitle>
              <DialogDescription>
                Set presensi untuk semua murid pada {format(selectedDate, "d MMMM yyyy", { locale: idLocale })}
              </DialogDescription>
            </DialogHeader>
            
            {showBulkConfirm && existingBulkStudents.length > 0 ? (
              <div className="space-y-3">
                <div className="flex items-start gap-2 p-3 rounded-xl bg-grade-warning/10 border border-grade-warning/30">
                  <AlertCircle className="w-4 h-4 text-grade-warning shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-semibold text-grade-warning">Data presensi sudah ada!</p>
                    <p className="text-muted-foreground mt-0.5">
                      {existingBulkStudents.length} dari {students.length} murid sudah memiliki data presensi pada tanggal ini.
                    </p>
                  </div>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto rounded-xl border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-1.5 font-medium">Nama Murid</th>
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

        {/* Settings Dialog */}
        <SettingsDashboard
          open={showSettingsSheet}
          onOpenChange={setShowSettingsSheet}
          selectedClass={selectedClass}
          currentMonth={currentMonth}
          effectiveDays={effectiveDays}
          monthDays={monthDays}
          isLocked={isLocked}
          workDayFormat={workDayFormat}
          handleWorkDayFormatChange={handleWorkDayFormatChange}
          monthNationalHolidays={monthNationalHolidays}
          holidays={holidays}
          toggleHoliday={toggleHoliday}
          dayEvents={dayEvents}
          handleRemoveHoliday={handleRemoveHoliday}
          handleRemoveDayEvent={handleRemoveDayEvent}
          recapProfile={recapProfile}
          handleUpdateRecapProfile={handleUpdateRecapProfile}
          handleToggleRecapStatus={handleToggleRecapStatus}
          delegations={delegations}
          handleRevokeDelegationAction={handleRevokeDelegationAction}
          isRevokingDelegation={isRevokingDelegation}
          snapshots={snapshots}
          handleRestoreSnapshotAction={handleRestoreSnapshotAction}
          isRestoringSnapshot={isRestoringSnapshot}
          isCreatingSnapshot={isCreatingSnapshot}
          onAddHolidayClick={() => setShowHolidayDialog(true)}
          onAddDayEventClick={() => setShowDayEventDialog(true)}
          onAddDelegationClick={() => setShowDelegationDialog(true)}
          onAddSnapshotClick={() => setShowSnapshotReasonDialog(true)}
          isHolidayCombined={isHolidayCombined}
          getHolidayDescriptionCombined={getHolidayDescriptionCombined}
        />

        <HolidayAddDialog
          open={showHolidayDialog}
          onOpenChange={setShowHolidayDialog}
          selectedHolidayDates={selectedHolidayDates}
          setSelectedHolidayDates={setSelectedHolidayDates}
          holidayDescription={holidayDescription}
          setHolidayDescription={setHolidayDescription}
          isHolidayGlobal={isHolidayGlobal}
          setIsHolidayGlobal={setIsHolidayGlobal}
          isHolidayCombined={isHolidayCombined}
          getExistingHolidayForDate={getExistingHolidayForDate}
          handleAddHoliday={handleAddHoliday}
        />

        <DayEventAddDialog
          open={showDayEventDialog}
          onOpenChange={setShowDayEventDialog}
          selectedDayEventDates={selectedDayEventDates}
          setSelectedDayEventDates={setSelectedDayEventDates}
          dayEventLabel={dayEventLabel}
          setDayEventLabel={setDayEventLabel}
          dayEventDesc={dayEventDesc}
          setDayEventDesc={setDayEventDesc}
          getDayEvent={getDayEvent}
          getExistingEventForDate={getExistingEventForDate}
          isHolidayCombined={isHolidayCombined}
          handleAddDayEvent={handleSaveDayEvent}
        />

        {/* Month Selector Popover */}
        <Dialog open={showExportMonthDialog} onOpenChange={setShowExportMonthDialog}>
          <DialogContent className="w-[calc(100vw-1.5rem)] max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-primary" />
                Pilih Bulan Ekspor
              </DialogTitle>
              <DialogDescription>
                Pilih bulan presensi yang akan dibuka di Studio Ekspor. Bulan aktif akan ikut disinkronkan.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-muted/30 p-2">
              <Button type="button" variant="ghost" size="icon" onClick={() => setExportPickerYear((year) => year - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-semibold">{exportPickerYear}</div>
              <Button type="button" variant="ghost" size="icon" onClick={() => setExportPickerYear((year) => year + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {monthNames.map((monthName, monthIndex) => {
                const now = new Date();
                const isCurrentSystemMonth = exportPickerYear === now.getFullYear() && monthIndex === now.getMonth();
                const isSelectedMonth = currentMonth.getFullYear() === exportPickerYear && currentMonth.getMonth() === monthIndex;
                return (
                  <Button
                    key={monthName}
                    type="button"
                    variant={isSelectedMonth ? "default" : "outline"}
                    className="h-auto min-h-14 flex-col items-start gap-1 rounded-xl px-3 py-2 text-left"
                    onClick={() => confirmAttendanceExportMonth(monthIndex)}
                  >
                    <span className="text-sm font-semibold">{monthName}</span>
                    <span className="flex min-h-4 items-center gap-1 text-[10px] opacity-80">
                      {isCurrentSystemMonth ? <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[9px]">Bulan ini</Badge> : null}
                      {isSelectedMonth ? "Aktif" : ""}
                    </span>
                  </Button>
                );
              })}
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
        description="Baca daftar presensi dari maksimal 5 foto, periksa tanggal and status, lalu konfirmasi data yang akan disimpan."
        context={{
          kind: "attendance",
          targetClassId: selectedClassId,
          targetClassName: selectedClass?.name,
          students: students.map((student) => ({ id: student.id, name: student.name, nisn: student.nisn })),
          existingAttendance: attendanceRecords.map((record) => ({
            studentId: record.student_id,
            date: record.date,
            status: record.status,
          })),
        }}
        onConfirmImport={async (plan) => {
          if (!selectedClassId) return { success: 0, skipped: plan.rows.length, failed: 0, message: "Pilih kelas terlebih dahulu." };
          const dateIndex = plan.columns.findIndex((column) => column.semantic === "date");
          const statusIndex = plan.columns.findIndex((column) => column.semantic === "attendance_status");
          const existing = new Set(attendanceRecords.map((record) => `${record.student_id}:${record.date}`));
          const candidateRows = plan.rows.filter((row) => row.included && row.targetStudentId && !row.issues.some((issue) => issue.severity === "error"));
          const candidateStudentIds = [...new Set(candidateRows.map((row) => row.targetStudentId as string))];
          const candidateDates = [...new Set(candidateRows.map((row) => normalizeOcrDate(row.values[dateIndex] || "")).filter(Boolean))];
          if (candidateStudentIds.length && candidateDates.length) {
            const { supabaseExternal } = await import("@/core/repositories/supabase-compat.repository");
            const { data: persistedRows } = await (supabaseExternal as any)
              .from("attendance_records")
              .select("student_id,date")
              .eq("class_id", selectedClassId)
              .in("student_id", candidateStudentIds)
              .in("date", candidateDates);
            (persistedRows || []).forEach((record: { student_id: string; date: string }) => existing.add(`${record.student_id}:${record.date}`));
          }
          let successCount = 0;
          let skippedCount = 0;
          let failedCount = 0;

          for (const row of plan.rows) {
            if (!row.included || !row.targetStudentId || row.issues.some((issue) => issue.severity === "error")) {
              skippedCount += 1;
              continue;
            }
            const date = normalizeOcrDate(row.values[dateIndex] || "");
            const status = normalizeAttendanceStatus(row.values[statusIndex] || "") as AttendanceStatusValue;
            if (!date || !status || existing.has(`${row.targetStudentId}:${date}`)) {
              skippedCount += 1;
              continue;
            }
            try {
              await setAttendanceDb({ studentId: row.targetStudentId, date, status });
              existing.add(`${row.targetStudentId}:${date}`);
              successCount += 1;
            } catch {
              failedCount += 1;
            }
          }
          return {
            success: successCount,
            skipped: skippedCount,
            failed: failedCount,
            message: `${successCount} presensi disimpan; data lama tetap dipertahankan.`,
          };
        }}
      />

      {/* Promotion V2 to V1 Confirmation Dialog */}
      <MergeV2toV1Dialog
        open={showPromoteConfirm}
        onOpenChange={setShowPromoteConfirm}
        selectedClass={selectedClass}
        currentMonth={currentMonth}
        handlePromote={handlePromote}
        isPromoting={isPromoting}
      />

      {/* Delegation Dialog */}
      <DelegationAddDialog
        open={showDelegationDialog}
        onOpenChange={setShowDelegationDialog}
        delegationTargetEmail={delegationTargetEmail}
        setDelegationTargetEmail={setDelegationTargetEmail}
        delegationStartsAt={delegationStartsAt}
        setDelegationStartsAt={setDelegationStartsAt}
        delegationEndsAt={delegationEndsAt}
        setDelegationEndsAt={setDelegationEndsAt}
        handleCreateDelegationAction={handleCreateDelegationAction}
        isCreatingDelegation={isCreatingDelegation}
      />

      {/* Snapshot Reason Dialog */}
      <SnapshotReasonDialog
        open={showSnapshotReasonDialog}
        onOpenChange={setShowSnapshotReasonDialog}
        snapshotReason={snapshotReason}
        setSnapshotReason={setSnapshotReason}
        handleCreateSnapshotAction={handleCreateSnapshotAction}
        isCreatingSnapshot={isCreatingSnapshot}
      />

      <ProductTour steps={attendanceTourSteps} tourKey="attendance" onComplete={cleanupAttendanceTour} />
    </>
  );
}

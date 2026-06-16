import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type TouchEvent as ReactTouchEvent,
  type UIEvent as ReactUIEvent,
  type WheelEvent as ReactWheelEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { useStudents } from "@/hooks/useStudents";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { ReportSemesterSelector, useReportSemesterFilter } from "@/components/reports/ReportSemesterSelector";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Search,
  School,
  BookOpen,
  Settings2,
  ArrowLeft,
  Calendar,
  Layers,
  RefreshCw,
  Maximize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronDown,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import { cn } from "@/lib/utils";
import { exportReportWithProgress, type ExportConfig } from "@/lib/exportReports";
import { createDefaultReportDocumentStyle, getNaturalColumnWidthMmV2, type ReportDocumentStyle } from "@/lib/reportExportLayoutV2";
import type { ReportPaperSize } from "@/lib/reportExportLayout";
import { useExportLoader } from "@/components/ExportLoaderOverlay";
import type { ExportProgressReporter } from "@/lib/exportProgress";
import { useSignatureSettings } from "@/hooks/useSignatureSettings";
import { useGradeFormulaSettings } from "@/hooks/useGradeFormulaSettings";
import { useGradeTableColorScheme } from "@/hooks/useGradeTableColorScheme";
import { calculateStudentSubjectReport } from "@/lib/gradeReportEngine";
import { UnifiedExportStudio, type ExportColumnTypographyOption, type ExportStudioFormatOption } from "@/components/export/UnifiedExportStudio";
import { ExportPreviewRenderer } from "@/components/export/ExportPreviewRenderer";
import {
  getGradeTableChapterTone,
  getGradeTableColumnBodyTone,
  getGradeTableColumnHeaderTone,
} from "@/lib/gradeTableColorSchemes";
import { isVerticalScrollBoundary, scrollPageBy } from "@/lib/scrollChaining";
import {
  applyViewportCssVariables,
  captureViewportTelemetrySnapshot,
  clearViewportCssVariables,
} from "@/lib/viewportTelemetry";

const REPORT_EXPORT_FORMATS: ExportStudioFormatOption[] = [
  {
    id: "pdf",
    label: "PDF",
    description: "Siap cetak dan cocok untuk dokumen laporan resmi.",
    icon: FileText,
    badge: "Preview aktif",
    previewMode: "pdf",
  },
  {
    id: "excel",
    label: "Excel",
    description: "Struktur tabel spreadsheet untuk pengolahan lanjutan.",
    icon: FileSpreadsheet,
    previewMode: null,
  },
  {
    id: "csv",
    label: "CSV",
    description: "Format data ringan untuk impor atau integrasi lain.",
    icon: FileSpreadsheet,
    previewMode: null,
  },
  {
    id: "png-hd",
    label: "PNG HD",
    description: "Gambar resolusi tinggi untuk dibagikan cepat.",
    icon: ImageIcon,
    badge: "HD",
    previewMode: "png",
  },
  {
    id: "png-4k",
    label: "PNG 4K Ultra HD",
    description: "Hasil gambar paling tajam untuk presentasi dan arsip visual.",
    icon: ImageIcon,
    badge: "4K",
    previewMode: "png",
  },
];

const reportsTourSteps = [
  {
    target: "[data-tour='filter-section']",
    title: "Filter Laporan",
    description: "Pilih kelas dan mata pelajaran untuk melihat laporan nilai.",
  },
  {
    target: "[data-tour='export-section']",
    title: "Ekspor Laporan",
    description: "Pilih format ekspor (PDF, Excel, CSV) lalu klik tombol ekspor.",
  },
];

interface ExportOptions {
  includeAssignments: boolean;
  assignmentVisibility: Record<string, boolean>;
  includeChapterAvg: boolean;
  includeSTS: boolean;
  includeSAS: boolean;
  includeRapor: boolean;
  includeStatus: boolean;
}

interface Chapter {
  id: string;
  name: string;
  subject_id: string;
  order_index: number;
  semester_id?: string | null;
}

interface Assignment {
  id: string;
  name: string;
  chapter_id: string;
  order_index?: number;
  semester_id?: string | null;
}

interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  grade_type: string;
  value: number | null;
  semester_id?: string | null;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
}

type ReportVisibleColumn = {
  key: string;
  label: string;
  type: string;
  chapterId?: string;
  assignmentId?: string;
  semester?: number;
};

type ReportHeaderGroup = {
  label: string;
  colSpan: number;
  bgClass: string;
  semester?: number;
  isChapter?: boolean;
};

const REPORT_INDEX_COL_WIDTH = 45;
const REPORT_NAME_COL_WIDTH = 168;
const REPORT_NISN_COL_WIDTH = 88;
const REPORT_GRADE_COL_WIDTH = 82;
const REPORT_AVERAGE_COL_WIDTH = 92;
const REPORT_STATUS_COL_WIDTH = 104;
const REPORT_GROUP_HEADER_HEIGHT = 32;
const REPORT_COLUMN_HEADER_HEIGHT = 40;
const REPORT_DEFAULT_ROW_HEIGHT = 44;
const REPORT_NAME_LINE_HEIGHT = 16;
const REPORT_ROW_VERTICAL_PADDING = 14;
const REPORT_ZOOM_MIN = 80;
const REPORT_ZOOM_MAX = 125;
const REPORT_ZOOM_STEP = 5;
const REPORT_SOLID_HEADER_SURFACE = "bg-background";
const REPORT_SOLID_FROZEN_SURFACE =
  "bg-background dark:bg-background";

function ReportFullscreenPortal({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  if (!enabled || typeof document === "undefined") {
    return <>{children}</>;
  }

  return createPortal(children, document.body);
}

function isReportFrozenColumn(column: ReportVisibleColumn) {
  return column.type === "index" || column.type === "name";
}

function getReportColumnWidth(column: ReportVisibleColumn) {
  if (column.type === "index") return REPORT_INDEX_COL_WIDTH;
  if (column.type === "name") return REPORT_NAME_COL_WIDTH;
  if (column.type === "nisn") return REPORT_NISN_COL_WIDTH;
  if (column.type === "status") return REPORT_STATUS_COL_WIDTH;
  if (column.type === "chapterAvg" || column.type === "grandAvg" || column.type === "avgRapor" || column.type === "rapor") {
    return REPORT_AVERAGE_COL_WIDTH;
  }
  return REPORT_GRADE_COL_WIDTH;
}

function estimateReportWrappedLineCount(text: string, width: number) {
  const words = text.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (words.length === 0) return 1;

  const charsPerLine = Math.max(8, Math.floor(Math.max(52, width - 20) / 7.2));
  let lines = 1;
  let currentLineLength = 0;

  words.forEach((word) => {
    const wordLength = word.length;
    if (currentLineLength === 0) {
      currentLineLength = Math.min(wordLength, charsPerLine);
      lines += Math.max(0, Math.ceil(wordLength / charsPerLine) - 1);
      return;
    }

    if (currentLineLength + 1 + wordLength <= charsPerLine) {
      currentLineLength += 1 + wordLength;
      return;
    }

    lines += 1;
    currentLineLength = Math.min(wordLength, charsPerLine);
    lines += Math.max(0, Math.ceil(wordLength / charsPerLine) - 1);
  });

  return Math.max(1, lines);
}

function clampReportZoom(value: number) {
  return Math.max(REPORT_ZOOM_MIN, Math.min(REPORT_ZOOM_MAX, value));
}

function buildReportPreviewHeaderGroups(groups: ReportHeaderGroup[]): ReportHeaderGroup[] {
  const [identityGroup, ...restGroups] = groups;
  if (!identityGroup || identityGroup.colSpan !== 3) return groups;

  return [
    { ...identityGroup, label: "Data Siswa", colSpan: 2 },
    { label: "", colSpan: 1, bgClass: "bg-background" },
    ...restGroups,
  ];
}

export default function GradeReports() {
  const { toast } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { runWithLoader, overlay: exportOverlay } = useExportLoader();
  const { activeYear, semestersForActiveYear, activeYearId } = useAcademicYear();
  const { semesterFilter, setSemesterFilter, isCombinedView } = useReportSemesterFilter();
  
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [exportFormat, setExportFormat] = useState<"pdf" | "excel" | "csv" | "png-hd" | "png-4k">("pdf");
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    includeAssignments: true,
    assignmentVisibility: {},
    includeChapterAvg: true,
    includeSTS: true,
    includeSAS: true,
    includeRapor: true,
    includeStatus: true,
  });
  const [documentStyle, setDocumentStyle] = useState<ReportDocumentStyle>(() => createDefaultReportDocumentStyle());
  const [autoFitOnePage, setAutoFitOnePage] = useState(false);
  const [paperSize, setPaperSize] = useState<ReportPaperSize>("a4");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [includeSignature, setIncludeSignature] = useState(false);
  const [reportScrollLeft, setReportScrollLeft] = useState(0);
  const [reportScrollTop, setReportScrollTop] = useState(0);
  const [reportZoom, setReportZoom] = useState(100);
  const [reportFullscreenMode, setReportFullscreenMode] = useState<"app" | "browser" | null>(null);
  const isReportFullscreen = reportFullscreenMode !== null;
  const reportFullscreenViewportHeight = reportFullscreenMode === "browser"
    ? "min(100dvh, var(--sipena-visual-viewport-height, 100dvh))"
    : "100dvh";
  const reportScrollRef = useRef<HTMLDivElement | null>(null);
  const reportFrozenTouchRef = useRef<{ x: number; y: number } | null>(null);
  const {
    signatureConfig,
    hasSignature,
    isLoading: signatureLoading,
    isSaving: signatureSaving,
    saveSignature,
  } = useSignatureSettings();
  const { colorScheme: gradeTableColorScheme } = useGradeTableColorScheme();

  useEffect(() => {
    if (!signatureLoading) {
      setIncludeSignature(hasSignature);
    }
  }, [hasSignature, signatureLoading]);

  const closeReportFullscreen = useCallback(async () => {
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Keep closing the app overlay even if the browser rejects exitFullscreen.
      }
    }

    setReportFullscreenMode(null);
  }, []);

  const openReportAppFullscreen = useCallback(() => {
    setReportFullscreenMode("app");
  }, []);

  const openReportBrowserFullscreen = useCallback(async () => {
    setReportFullscreenMode("browser");

    if (typeof document === "undefined") return;

    const target = document.documentElement;
    if (!target.requestFullscreen) {
      setReportFullscreenMode("app");
      toast({
        title: "Layar penuh native tidak tersedia",
        description: "Mode layar penuh panel tetap dibuka di dalam tab browser.",
      });
      return;
    }

    try {
      await target.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setReportFullscreenMode("app");
      toast({
        title: "Layar penuh native diblokir",
        description: "Browser tidak mengizinkan layar penuh perangkat. Mode layar penuh panel tetap aktif.",
      });
    }
  }, [toast]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      if (reportFullscreenMode === "browser" && !document.fullscreenElement) {
        setReportFullscreenMode(null);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [reportFullscreenMode]);

  useEffect(() => {
    if (!isReportFullscreen || typeof document === "undefined") return;

    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflow = html.style.overflow;
    const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
    const previousBodyOverflow = body.style.overflow;
    const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

    html.style.overflow = "hidden";
    html.style.overscrollBehavior = "contain";
    body.style.overflow = "hidden";
    body.style.overscrollBehavior = "contain";

    return () => {
      html.style.overflow = previousHtmlOverflow;
      html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
      body.style.overflow = previousBodyOverflow;
      body.style.overscrollBehavior = previousBodyOverscrollBehavior;
    };
  }, [isReportFullscreen]);

  useEffect(() => {
    if (!isReportFullscreen || reportFullscreenMode !== "browser" || typeof document === "undefined") return;

    const target = document.documentElement;
    const updateViewportMetrics = () => {
      applyViewportCssVariables(captureViewportTelemetrySnapshot(window.location.pathname || "/reports/grades"), target);
    };

    updateViewportMetrics();

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", updateViewportMetrics);
    window.addEventListener("orientationchange", updateViewportMetrics);
    visualViewport?.addEventListener("resize", updateViewportMetrics);
    visualViewport?.addEventListener("scroll", updateViewportMetrics);

    return () => {
      window.removeEventListener("resize", updateViewportMetrics);
      window.removeEventListener("orientationchange", updateViewportMetrics);
      visualViewport?.removeEventListener("resize", updateViewportMetrics);
      visualViewport?.removeEventListener("scroll", updateViewportMetrics);
      clearViewportCssVariables(target);
    };
  }, [isReportFullscreen, reportFullscreenMode]);

  const syncReportScrollState = useCallback((element: HTMLDivElement) => {
    setReportScrollLeft(element.scrollLeft);
    setReportScrollTop(element.scrollTop);
  }, []);

  const handleReportScroll = useCallback((event: ReactUIEvent<HTMLDivElement>) => {
    syncReportScrollState(event.currentTarget);
  }, [syncReportScrollState]);

  const scrollReportTableBy = useCallback((deltaX: number, deltaY: number) => {
    const element = reportScrollRef.current;
    if (!element) return false;

    element.scrollLeft += deltaX;
    element.scrollTop += deltaY;
    syncReportScrollState(element);
    return true;
  }, [syncReportScrollState]);

  const handleReportFrozenWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const element = reportScrollRef.current;
    if (!element) return;

    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    const isVerticalWheel = Math.abs(deltaY) > Math.abs(deltaX);

    if (isVerticalWheel && isVerticalScrollBoundary(element, deltaY)) {
      scrollPageBy(deltaY);
    } else {
      scrollReportTableBy(deltaX, deltaY);
    }

    event.preventDefault();
    event.stopPropagation();
  }, [scrollReportTableBy]);

  const handleReportFrozenTouchStart = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 1) {
      reportFrozenTouchRef.current = null;
      return;
    }

    reportFrozenTouchRef.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY,
    };
  }, []);

  const handleReportFrozenTouchMove = useCallback((event: ReactTouchEvent<HTMLDivElement>) => {
    const element = reportScrollRef.current;
    const previous = reportFrozenTouchRef.current;
    if (!element || !previous || event.touches.length !== 1) return;

    const touch = event.touches[0];
    const deltaX = previous.x - touch.clientX;
    const deltaY = previous.y - touch.clientY;
    const isMostlyVertical = Math.abs(deltaY) > Math.abs(deltaX);

    reportFrozenTouchRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };

    if (isMostlyVertical && isVerticalScrollBoundary(element, deltaY)) {
      scrollPageBy(deltaY);
    } else {
      scrollReportTableBy(deltaX, deltaY);
    }

    event.preventDefault();
    event.stopPropagation();
  }, [scrollReportTableBy]);

  const handleReportFrozenTouchEnd = useCallback(() => {
    reportFrozenTouchRef.current = null;
  }, []);

  // Get semester objects for combined view
  const semester1 = semestersForActiveYear.find(s => s.number === 1);
  const semester2 = semestersForActiveYear.find(s => s.number === 2);

  // IMPORTANT: Classes and Subjects filter by YEAR only (from sidebar)
  const { classes } = useClasses();
  const { subjects } = useSubjects(selectedClassId);
  const { students } = useStudents(selectedClassId);
  
  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);
  const kkm = selectedSubject?.kkm || 75;
  const { formula } = useGradeFormulaSettings(selectedSubjectId);

  // Query grades with correct semester filter - with refetch capabilities
  const { data: allGrades = [], refetch: refetchGrades } = useQuery({
    queryKey: ["report-grades-all", selectedSubjectId, activeYearId, semesterFilter, isCombinedView],
    queryFn: async (): Promise<Grade[]> => {
      if (!selectedSubjectId) return [];
      
      let query = supabase
        .from("grades")
        .select("*")
        .eq("subject_id", selectedSubjectId);
      
      if (activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      const grades = (data || []) as unknown as Grade[];
      const hasSemesterColumn = grades.length > 0 && 'semester_id' in grades[0];
      
      if (!hasSemesterColumn) {
        return grades;
      }
      
      if (isCombinedView) {
        const semesterIdsInYear = semestersForActiveYear.map(s => s.id);
        return grades.filter(g => !g.semester_id || semesterIdsInYear.includes(g.semester_id));
      }
      
      const targetSemester = semestersForActiveYear.find(s => s.number === parseInt(semesterFilter));
      if (targetSemester) {
        return grades.filter(g => g.semester_id === targetSemester.id || !g.semester_id);
      }
      
      return grades;
    },
    enabled: !!selectedSubjectId,
    staleTime: 1000 * 30, // 30 seconds - shorter for faster updates
    refetchOnWindowFocus: true,
  });

  // Query chapters with correct semester filter
  const { data: allChapters = [], refetch: refetchChapters } = useQuery({
    queryKey: ["report-chapters-all", selectedSubjectId, activeYearId, semesterFilter, isCombinedView],
    queryFn: async (): Promise<Chapter[]> => {
      if (!selectedSubjectId) return [];
      
      const { data, error } = await supabase
        .from("chapters")
        .select("*")
        .eq("subject_id", selectedSubjectId)
        .order("order_index");

      if (error) throw error;
      
      const chapters = (data || []) as unknown as Chapter[];
      const hasSemesterColumn = chapters.length > 0 && 'semester_id' in chapters[0];
      
      if (!hasSemesterColumn) {
        return chapters;
      }
      
      if (isCombinedView) {
        const semesterIdsInYear = semestersForActiveYear.map(s => s.id);
        return chapters.filter(c => !c.semester_id || semesterIdsInYear.includes(c.semester_id));
      }
      
      const targetSemester = semestersForActiveYear.find(s => s.number === parseInt(semesterFilter));
      if (targetSemester) {
        return chapters.filter(c => c.semester_id === targetSemester.id || !c.semester_id);
      }
      
      return chapters;
    },
    enabled: !!selectedSubjectId,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  // Fetch assignments for chapters
  const { data: allAssignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["report-assignments-all", selectedSubjectId, allChapters.map(c => c.id)],
    queryFn: async (): Promise<Assignment[]> => {
      if (!selectedSubjectId || allChapters.length === 0) return [];
      
      const chapterIds = allChapters.map(c => c.id);
      
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .in("chapter_id", chapterIds)
        .order("order_index");

      if (error) throw error;
      
      return (data || []) as Assignment[];
    },
    enabled: !!selectedSubjectId && allChapters.length > 0,
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });

  // Manual refresh function for quick sync
  const handleRefreshData = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchGrades(),
        refetchChapters(),
        refetchAssignments(),
      ]);
      toast({ title: "Data berhasil di-refresh", variant: "success" });
    } catch (error) {
      toast({ title: "Gagal me-refresh data", variant: "error" });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Auto refresh when subject/class changes
  useEffect(() => {
    if (selectedSubjectId) {
      queryClient.invalidateQueries({ queryKey: ["report-grades-all"] });
      queryClient.invalidateQueries({ queryKey: ["report-chapters-all"] });
      queryClient.invalidateQueries({ queryKey: ["report-assignments-all"] });
    }
  }, [selectedSubjectId, selectedClassId, semesterFilter, queryClient]);

  // Separate chapters by semester for combined view
  const chaptersBySemester = useMemo(() => {
    if (!isCombinedView) return { sem1: [], sem2: [] };
    
    const sem1Chapters = allChapters.filter(c => c.semester_id === semester1?.id);
    const sem2Chapters = allChapters.filter(c => c.semester_id === semester2?.id);
    
    if (sem1Chapters.length === 0 && sem2Chapters.length === 0) {
      return { sem1: allChapters, sem2: [] };
    }
    
    return { sem1: sem1Chapters, sem2: sem2Chapters };
  }, [allChapters, isCombinedView, semester1?.id, semester2?.id]);

  // Group assignments by chapter
  const assignmentsByChapter = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {};
    allChapters.forEach(ch => {
      grouped[ch.id] = allAssignments.filter(a => a.chapter_id === ch.id);
    });
    return grouped;
  }, [allChapters, allAssignments]);

  useEffect(() => {
    if (allAssignments.length === 0) return;
    setExportOptions((prev) => {
      const nextVisibility = { ...prev.assignmentVisibility };
      let changed = false;
      allAssignments.forEach((assignment) => {
        if (nextVisibility[assignment.id] === undefined) {
          nextVisibility[assignment.id] = true;
          changed = true;
        }
      });
      Object.keys(nextVisibility).forEach((assignmentId) => {
        if (!allAssignments.some((assignment) => assignment.id === assignmentId)) {
          delete nextVisibility[assignmentId];
          changed = true;
        }
      });
      if (!changed) return prev;
      return {
        ...prev,
        assignmentVisibility: nextVisibility,
      };
    });
  }, [allAssignments]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    return students.filter(
      (s) => s.name.toLowerCase().includes(searchQuery.toLowerCase()) || s.nisn.includes(searchQuery)
    );
  }, [students, searchQuery]);

  // Calculate semester data for a student
  const calculateSemesterData = (student: Student, semesterId?: string) => {
    const report = calculateStudentSubjectReport({
      studentId: student.id,
      subjectId: selectedSubjectId,
      grades: allGrades,
      chapters: allChapters,
      assignments: allAssignments,
      semesterId,
      formula,
    });

    const chapterAverages = Object.fromEntries(
      Object.entries(report.chapterDetails).map(([chapterId, value]) => [chapterId, value ?? 0]),
    );

    return {
      assignmentGrades: report.assignmentGrades,
      chapterAverages,
      sts: report.stsAvg ?? 0,
      sas: report.sasAvg ?? 0,
      grandAvg: report.chaptersAvg ?? 0,
      rapor: report.final ?? 0,
      raporValue: report.final,
    };
  };

  // Calculate student grades with multi-semester support
  const studentGrades = useMemo(() => {
    return filteredStudents.map((student) => {
      if (isCombinedView) {
        const sem1Data = calculateSemesterData(student, semester1?.id);
        const sem2Data = calculateSemesterData(student, semester2?.id);
        
        const validRapors = [sem1Data.raporValue, sem2Data.raporValue].filter((value): value is number => value !== null);
        const avgRapor = validRapors.length > 0 
          ? validRapors.reduce((sum, v) => sum + v, 0) / validRapors.length 
          : 0;
        
        return {
          student,
          sem1: sem1Data,
          sem2: sem2Data,
          avgRapor,
          isCombined: true,
        };
      } else {
        const targetSemester = semestersForActiveYear.find(s => s.number === parseInt(semesterFilter));
        const data = calculateSemesterData(student, targetSemester?.id);
        return {
          student,
          ...data,
          rapor: data.rapor,
          isCombined: false,
        };
      }
    });
  }, [filteredStudents, allGrades, allChapters, allAssignments, isCombinedView, semester1?.id, semester2?.id, semestersForActiveYear, semesterFilter, selectedSubjectId, formula]);

  const getStatusColor = (value: number) => {
    if (value < kkm) return "text-grade-fail bg-grade-fail/10";
    if (value <= kkm + 5) return "text-grade-warning bg-grade-warning/10";
    return "text-grade-pass bg-grade-pass/10";
  };

  const getStatusText = (value: number) => {
    if (value < kkm) return "Belum Lulus";
    if (value <= kkm + 5) return "Cukup";
    return "Lulus";
  };

  const formatGradeDisplay = (value: number): string => {
    if (value === 0) return "-";
    if (Number.isInteger(value)) {
      return value.toString();
    }
    const rounded = Math.round(value * 10) / 10;
    if (Number.isInteger(rounded)) {
      return rounded.toString();
    }
    return rounded.toString();
  };

  const formatForExportValue = (value: number): string | number => {
    if (Number.isInteger(value)) {
      return value;
    }
    return Math.round(value * 10) / 10;
  };

  // Build visible columns based on export options
  const visibleColumns = useMemo(() => {
    const cols: ReportVisibleColumn[] = [];
    
    // Always include No, Nama, NISN
    cols.push({ key: "no", label: "No", type: "index" });
    cols.push({ key: "nama", label: "Nama", type: "name" });
    cols.push({ key: "nisn", label: "NISN", type: "nisn" });

    if (isCombinedView) {
      // Semester 1 columns
      chaptersBySemester.sem1.forEach((chapter) => {
        if (exportOptions.includeAssignments) {
          const chapterAssignments = assignmentsByChapter[chapter.id] || [];
          chapterAssignments.forEach(assignment => {
            if (exportOptions.assignmentVisibility[assignment.id] === false) return;
            cols.push({ 
              key: `s1_assign_${assignment.id}`, 
              label: assignment.name, 
              type: "assignment",
              chapterId: chapter.id,
              assignmentId: assignment.id,
              semester: 1
            });
          });
        }
        if (exportOptions.includeChapterAvg) {
          cols.push({ 
            key: `s1_avg_${chapter.id}`, 
            label: `${chapter.name}`,  // Keep chapter name for combined view (groups by semester)
            type: "chapterAvg",
            chapterId: chapter.id,
            semester: 1
          });
        }
      });
      if (chaptersBySemester.sem1.length > 0 && exportOptions.includeChapterAvg) {
        cols.push({ key: "s1_grandAvg", label: "Rata-Rata", type: "grandAvg", semester: 1 });
      }
      if (exportOptions.includeSTS) {
        cols.push({ key: "s1_sts", label: "STS", type: "sts", semester: 1 });
      }
      if (exportOptions.includeSAS) {
        cols.push({ key: "s1_sas", label: "SAS", type: "sas", semester: 1 });
      }

      // Semester 2 columns
      chaptersBySemester.sem2.forEach((chapter) => {
        if (exportOptions.includeAssignments) {
          const chapterAssignments = assignmentsByChapter[chapter.id] || [];
          chapterAssignments.forEach(assignment => {
            if (exportOptions.assignmentVisibility[assignment.id] === false) return;
            cols.push({ 
              key: `s2_assign_${assignment.id}`, 
              label: assignment.name, 
              type: "assignment",
              chapterId: chapter.id,
              assignmentId: assignment.id,
              semester: 2
            });
          });
        }
        if (exportOptions.includeChapterAvg) {
          cols.push({ 
            key: `s2_avg_${chapter.id}`, 
            label: `${chapter.name}`,  // Keep chapter name for combined view
            type: "chapterAvg",
            chapterId: chapter.id,
            semester: 2
          });
        }
      });
      if (chaptersBySemester.sem2.length > 0 && exportOptions.includeChapterAvg) {
        cols.push({ key: "s2_grandAvg", label: "Rata-Rata", type: "grandAvg", semester: 2 });
      }
      if (exportOptions.includeSTS) {
        cols.push({ key: "s2_sts", label: "STS", type: "sts", semester: 2 });
      }
      if (exportOptions.includeSAS) {
        cols.push({ key: "s2_sas", label: "SAS", type: "sas", semester: 2 });
      }

      // Rekap columns
      if (exportOptions.includeRapor) {
        cols.push({ key: "rapor_s1", label: "Rapor S1", type: "rapor", semester: 1 });
        cols.push({ key: "rapor_s2", label: "Rapor S2", type: "rapor", semester: 2 });
        cols.push({ key: "avgRapor", label: "Rata-Rata Rapor", type: "avgRapor" });
      }
      if (exportOptions.includeStatus) {
        cols.push({ key: "status", label: "Status", type: "status" });
      }
    } else {
      // Single semester view
      allChapters.forEach((chapter) => {
        if (exportOptions.includeAssignments) {
          const chapterAssignments = assignmentsByChapter[chapter.id] || [];
          chapterAssignments.forEach(assignment => {
            if (exportOptions.assignmentVisibility[assignment.id] === false) return;
            cols.push({ 
              key: `assign_${assignment.id}`, 
              label: assignment.name, 
              type: "assignment",
              chapterId: chapter.id,
              assignmentId: assignment.id
            });
          });
        }
        if (exportOptions.includeChapterAvg) {
          cols.push({ 
            key: `avg_${chapter.id}`, 
            label: "Rata-Rata",  // Changed: Show "Rata-Rata" in Level 2, chapter name is in Level 1
            type: "chapterAvg",
            chapterId: chapter.id
          });
        }
      });
      if (allChapters.length > 0 && exportOptions.includeChapterAvg) {
        cols.push({ key: "grandAvg", label: "Rata-Rata BAB", type: "grandAvg" });
      }
      if (exportOptions.includeSTS) {
        cols.push({ key: "sts", label: "STS", type: "sts" });
      }
      if (exportOptions.includeSAS) {
        cols.push({ key: "sas", label: "SAS", type: "sas" });
      }
      if (exportOptions.includeRapor) {
        cols.push({ key: "rapor", label: "Rapor", type: "rapor" });
      }
      if (exportOptions.includeStatus) {
        cols.push({ key: "status", label: "Status", type: "status" });
      }
    }

    return cols;
  }, [exportOptions, isCombinedView, allChapters, chaptersBySemester, assignmentsByChapter]);

  // Get cell value for a column
  const getCellValue = (sg: any, col: any, index: number): string | number => {
    if (col.type === "index") return index + 1;
    if (col.type === "name") return sg.student.name;
    if (col.type === "nisn") return sg.student.nisn;
    
    if (isCombinedView && 'sem1' in sg && 'sem2' in sg) {
      const semData = col.semester === 1 ? sg.sem1 : col.semester === 2 ? sg.sem2 : null;
      
      if (col.type === "assignment" && semData && col.assignmentId) {
        return formatGradeDisplay(semData.assignmentGrades[col.assignmentId] || 0);
      }
      if (col.type === "chapterAvg" && semData && col.chapterId) {
        return formatGradeDisplay(semData.chapterAverages[col.chapterId] || 0);
      }
      if (col.type === "grandAvg" && semData) {
        return formatGradeDisplay(semData.grandAvg);
      }
      if (col.type === "sts" && semData) {
        return formatGradeDisplay(semData.sts);
      }
      if (col.type === "sas" && semData) {
        return formatGradeDisplay(semData.sas);
      }
      if (col.type === "rapor") {
        if (col.semester === 1) return formatGradeDisplay(sg.sem1.rapor);
        if (col.semester === 2) return formatGradeDisplay(sg.sem2.rapor);
      }
      if (col.type === "avgRapor") {
        return formatGradeDisplay(sg.avgRapor);
      }
      if (col.type === "status") {
        return getStatusText(sg.avgRapor);
      }
    } else if ('chapterAverages' in sg) {
      if (col.type === "assignment" && col.assignmentId) {
        return formatGradeDisplay(sg.assignmentGrades?.[col.assignmentId] || 0);
      }
      if (col.type === "chapterAvg" && col.chapterId) {
        return formatGradeDisplay(sg.chapterAverages[col.chapterId] || 0);
      }
      if (col.type === "grandAvg") {
        return formatGradeDisplay(sg.grandAvg);
      }
      if (col.type === "sts") {
        return formatGradeDisplay(sg.sts);
      }
      if (col.type === "sas") {
        return formatGradeDisplay(sg.sas);
      }
      if (col.type === "rapor") {
        return formatGradeDisplay(sg.rapor);
      }
      if (col.type === "status") {
        return getStatusText(sg.rapor);
      }
    }
    
    return "-";
  };

  const getDetailedExportData = () => {
    return studentGrades.map((sg, index) => {
      const row: Record<string, string | number> = {};
      
      visibleColumns.forEach(col => {
        // Use col.key for unique storage key to avoid label collisions
        row[col.key] = getCellValue(sg, col, index);
      });

      return row;
    });
  };

  const exportData = useMemo(() => getDetailedExportData(), [studentGrades, visibleColumns]);
  const exportColumns = useMemo(
    () => visibleColumns.map((column) => (
      column.type === "grandAvg"
        ? { ...column, label: "Rata-Rata\nBAB" }
        : column
    )),
    [visibleColumns],
  );

  const exportConfig = useMemo<ExportConfig>(() => ({
    className: selectedClass?.name || '',
    subjectName: selectedSubject?.name || '',
    kkm,
    periodLabel: isCombinedView ? "Semua Semester" : `Semester ${semesterFilter}`,
    isCombinedView,
    columns: exportColumns,
    headerGroups: getHeaderGroups(),
    chapterGroups: [],
    data: exportData,
    dateStr: new Date().toLocaleDateString('id-ID'),
    studentCount: studentGrades.length,
    chapterCount: allChapters.length,
    assignmentCount: allAssignments.length,
    paperSize,
    documentStyle,
    autoFitOnePage,
    signature: {
      city: signatureConfig.city,
      signers: signatureConfig.signers,
      useCustomDate: signatureConfig.useCustomDate,
      customDate: signatureConfig.customDate,
      fontSize: signatureConfig.fontSize,
      showSignatureLine: signatureConfig.showSignatureLine,
      signatureLinePosition: signatureConfig.signatureLinePosition,
      signatureLineWidth: signatureConfig.signatureLineWidth,
      signatureSpacing: signatureConfig.signatureSpacing,
      signatureAlignment: signatureConfig.signatureAlignment,
      signatureOffsetX: signatureConfig.signatureOffsetX,
      signatureOffsetY: signatureConfig.signatureOffsetY,
      placementMode: signatureConfig.placementMode,
      signaturePreset: signatureConfig.signaturePreset,
      manualXPercent: signatureConfig.manualXPercent,
      manualYPercent: signatureConfig.manualYPercent,
      snapToGrid: signatureConfig.snapToGrid,
      gridSizeMm: signatureConfig.gridSizeMm,
      lockSignaturePosition: signatureConfig.lockSignaturePosition,
      showDebugGuides: signatureConfig.showDebugGuides,
    },
    includeSignature: includeSignature && hasSignature,
  }), [
    selectedClass?.name,
    selectedSubject?.name,
    kkm,
    isCombinedView,
    semesterFilter,
    exportColumns,
    exportData,
    studentGrades.length,
    allChapters.length,
    allAssignments.length,
    paperSize,
    documentStyle,
    autoFitOnePage,
    signatureConfig,
    includeSignature,
    hasSignature,
  ]);

  const columnTypographyOptions = useMemo<ExportColumnTypographyOption[]>(() => {
    return exportColumns.map((column) => {
      const values = exportData
        .map((row) => row[column.key])
        .filter((value) => value !== undefined && value !== null)
        .map((value) => String(value));
      const sampleValue = values.find((value) => value.trim().length > 0) || "";
      const maxValueLength = values.reduce((max, value) => Math.max(max, value.length), 0);
      const headerLength = column.label.length;
      const suggestedHeaderFontSize = Math.max(7, Math.min(18, 15 - Math.max(0, headerLength - 8) * 0.25));
      const suggestedBodyFontSize = Math.max(
        6,
        Math.min(
          16,
          column.type === "name"
            ? 11.5
            : 12 - Math.max(0, maxValueLength - 8) * 0.18,
        ),
      );

      return {
        key: column.key,
        label: column.label,
        type: column.type,
        description: column.type === "name" ? "Kolom identitas utama" : column.type === "chapterAvg" ? "Kolom rata-rata BAB" : "Kolom data aktif",
        sampleValue,
        headerLength,
        maxValueLength,
        suggestedHeaderFontSize: Number(suggestedHeaderFontSize.toFixed(2)),
        suggestedBodyFontSize: Number(suggestedBodyFontSize.toFixed(2)),
        suggestedWidthMm: Number(getNaturalColumnWidthMmV2(column, documentStyle).toFixed(2)),
        suggestedHeaderAlignment: "center" as const,
        suggestedBodyAlignment: column.type === "name" || column.type === "status" ? "left" as const : "center" as const,
      };
    });
  }, [documentStyle, exportColumns, exportData]);

  const handleExport = async ({
    formatId,
    includeSignature: nextIncludeSignature,
    signatureConfig: nextSignatureConfig,
    paperSize: nextPaperSize,
    documentStyle: nextDocumentStyle,
    autoFitOnePage: nextAutoFitOnePage,
    downloadPreviewPng,
  }: {
    formatId: string;
    includeSignature: boolean;
    signatureConfig: typeof signatureConfig;
    paperSize: ReportPaperSize;
    documentStyle?: ReportDocumentStyle;
    autoFitOnePage?: boolean;
    downloadPreviewPng: (quality: "hd" | "4k", fileName?: string, progress?: ExportProgressReporter) => Promise<void>;
  }) => {
    if (!selectedClassId || !selectedSubjectId) {
      toast({ title: "Pilih kelas dan mapel terlebih dahulu", variant: "error" });
      return;
    }

    if (exportData.length === 0) {
      toast({ title: "Tidak ada data untuk diekspor", variant: "error" });
      return;
    }

    if (includeSignature && !hasSignature) {
      toast({
        title: "Signature belum diatur",
        description: "Klik tombol Edit pada opsi signature lalu lengkapi identitasnya.",
        variant: "error",
      });
      return;
    }

    const exportSignature = {
      city: nextSignatureConfig.city,
      signers: nextSignatureConfig.signers,
      useCustomDate: nextSignatureConfig.useCustomDate,
      customDate: nextSignatureConfig.customDate,
      fontSize: nextSignatureConfig.fontSize,
      showSignatureLine: nextSignatureConfig.showSignatureLine,
      signatureLinePosition: nextSignatureConfig.signatureLinePosition,
      signatureLineWidth: nextSignatureConfig.signatureLineWidth,
      signatureSpacing: nextSignatureConfig.signatureSpacing,
      signatureAlignment: nextSignatureConfig.signatureAlignment,
      signatureOffsetX: nextSignatureConfig.signatureOffsetX,
      signatureOffsetY: nextSignatureConfig.signatureOffsetY,
      placementMode: nextSignatureConfig.placementMode,
      signaturePreset: nextSignatureConfig.signaturePreset,
      manualXPercent: nextSignatureConfig.manualXPercent,
      manualYPercent: nextSignatureConfig.manualYPercent,
      snapToGrid: nextSignatureConfig.snapToGrid,
      gridSizeMm: nextSignatureConfig.gridSizeMm,
      lockSignaturePosition: nextSignatureConfig.lockSignaturePosition,
      showDebugGuides: nextSignatureConfig.showDebugGuides,
    };

    const exportConfigOverride = {
      ...exportConfig,
      paperSize: nextPaperSize,
      documentStyle: nextDocumentStyle || documentStyle,
      autoFitOnePage: nextAutoFitOnePage ?? autoFitOnePage,
      includeSignature: nextIncludeSignature && hasSignature,
      signature: exportSignature,
    };

    const fileBaseName = `Laporan_${selectedClass?.name}_${selectedSubject?.name}_${isCombinedView ? "Semua_Semester" : `Semester_${semesterFilter}`}`.replace(/\s+/g, "_");
    const fileName = formatId === "pdf"
      ? `${fileBaseName}.pdf`
      : formatId === "excel"
        ? `${fileBaseName}.xlsx`
        : formatId === "csv"
          ? `${fileBaseName}.csv`
          : `${fileBaseName}.png`;
    try {
      await runWithLoader(fileName, async (progress) => {
        if (formatId === "png-hd" || formatId === "png-4k") {
          await downloadPreviewPng(formatId === "png-4k" ? "4k" : "hd", fileName, progress);
          return;
        }
        await exportReportWithProgress(formatId as "pdf" | "excel" | "csv", exportConfigOverride, progress);
      });
      const formatLabel = REPORT_EXPORT_FORMATS.find((item) => item.id === formatId)?.label || formatId.toUpperCase();
      toast({ title: "Ekspor berhasil", description: `File ${formatLabel} telah diunduh` });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: "Gagal mengekspor", description: "Terjadi kesalahan saat mengekspor data", variant: "error" });
    }
  };

  const hasData = selectedClassId && selectedSubjectId && studentGrades.length > 0;

  // Calculate header groups for complex table layout - UNIFIED for both single and combined view
  function getHeaderGroups(): ReportHeaderGroup[] {
    const groups: ReportHeaderGroup[] = [];
    
    // Fixed columns (No, Nama, NISN)
    groups.push({ label: "", colSpan: 3, bgClass: "" });
    
    if (isCombinedView) {
      // COMBINED VIEW: Semester 1 + Semester 2 + Rekap
      
      // Semester 1 group
      let sem1Cols = 0;
      chaptersBySemester.sem1.forEach((chapter) => {
        if (exportOptions.includeAssignments) {
          sem1Cols += (assignmentsByChapter[chapter.id] || []).length;
        }
        if (exportOptions.includeChapterAvg) sem1Cols += 1;
      });
      if (chaptersBySemester.sem1.length > 0 && exportOptions.includeChapterAvg) sem1Cols += 1; // Grand avg
      if (exportOptions.includeSTS) sem1Cols += 1;
      if (exportOptions.includeSAS) sem1Cols += 1;
      if (sem1Cols > 0) {
        groups.push({ label: "Semester 1", colSpan: sem1Cols, bgClass: "bg-blue-50 dark:bg-blue-950/30", semester: 1 });
      }
      
      // Semester 2 group
      let sem2Cols = 0;
      chaptersBySemester.sem2.forEach((chapter) => {
        if (exportOptions.includeAssignments) {
          sem2Cols += (assignmentsByChapter[chapter.id] || []).length;
        }
        if (exportOptions.includeChapterAvg) sem2Cols += 1;
      });
      if (chaptersBySemester.sem2.length > 0 && exportOptions.includeChapterAvg) sem2Cols += 1;
      if (exportOptions.includeSTS) sem2Cols += 1;
      if (exportOptions.includeSAS) sem2Cols += 1;
      if (sem2Cols > 0) {
        groups.push({ label: "Semester 2", colSpan: sem2Cols, bgClass: "bg-green-50 dark:bg-green-950/30", semester: 2 });
      }
      
      // Rekap group
      let rekapCols = 0;
      if (exportOptions.includeRapor) rekapCols += 3;
      if (exportOptions.includeStatus) rekapCols += 1;
      if (rekapCols > 0) {
        groups.push({ label: "Rekap Akhir", colSpan: rekapCols, bgClass: "bg-primary/10" });
      }
    } else {
      // SINGLE SEMESTER VIEW: Per BAB groups + Nilai Akhir group
      
      // Per-chapter (BAB) groups
      allChapters.forEach((chapter) => {
        let chapterCols = 0;
        if (exportOptions.includeAssignments) {
          chapterCols += (assignmentsByChapter[chapter.id] || []).length;
        }
        if (exportOptions.includeChapterAvg) chapterCols += 1; // Avg per BAB
        if (chapterCols > 0) {
          groups.push({ 
            label: chapter.name, 
            colSpan: chapterCols, 
            bgClass: "bg-blue-50/50 dark:bg-blue-950/20",
            isChapter: true 
          });
        }
      });
      
      // Nilai Akhir group (STS, SAS, Rapor, Status)
      let finalCols = 0;
      if (allChapters.length > 0 && exportOptions.includeChapterAvg) finalCols += 1; // Grand Avg
      if (exportOptions.includeSTS) finalCols += 1;
      if (exportOptions.includeSAS) finalCols += 1;
      if (exportOptions.includeRapor) finalCols += 1;
      if (exportOptions.includeStatus) finalCols += 1;
      if (finalCols > 0) {
        groups.push({ label: "Nilai Akhir", colSpan: finalCols, bgClass: "bg-primary/10" });
      }
    }
    
    return groups;
  }

  // Calculate chapter sub-headers for second level (only for single semester view)
  const getChapterSubHeaders = () => {
    if (isCombinedView) return [];
    
    const subHeaders: { key: string; label: string; colSpan: number; chapterId: string }[] = [];
    
    allChapters.forEach((chapter) => {
      const chapterAssignments = assignmentsByChapter[chapter.id] || [];
      if (exportOptions.includeAssignments) {
        chapterAssignments.forEach(assignment => {
          subHeaders.push({
            key: `assign_${assignment.id}`,
            label: assignment.name,
            colSpan: 1,
            chapterId: chapter.id,
          });
        });
      }
      if (exportOptions.includeChapterAvg) {
        subHeaders.push({
          key: `avg_${chapter.id}`,
          label: "Rata-Rata",
          colSpan: 1,
          chapterId: chapter.id,
        });
      }
    });
    
    return subHeaders;
  };

  const getChapterIndexForColumn = (col: any) => {
    if (!col.chapterId) return 0;
    return allChapters.findIndex((chapter) => chapter.id === col.chapterId);
  };

  const getReportColumnToneType = (col: any) => {
    if (col.type === "assignment") return "assignment";
    if (col.type === "chapterAvg" || col.type === "grandAvg" || col.type === "avgRapor") return "chapter_avg";
    if (col.type === "sts") return "sts";
    if (col.type === "sas") return "sas";
    if (col.type === "rapor") return "final";
    if (col.type === "status") return "status";
    if (col.type === "index") return "index";
    return "name";
  };

  const getReportColumnHeaderTone = (col: any) => {
    return getGradeTableColumnHeaderTone(gradeTableColorScheme, {
      type: getReportColumnToneType(col),
      chapterIndex: Math.max(0, getChapterIndexForColumn(col)),
    });
  };

  const getReportColumnBodyTone = (col: any) => {
    return getGradeTableColumnBodyTone(gradeTableColorScheme, {
      type: getReportColumnToneType(col),
    });
  };

  const getReportGroupTone = (group: { isChapter?: boolean; semester?: number }, idx: number) => {
    if (group.isChapter) {
      return getGradeTableChapterTone(gradeTableColorScheme, Math.max(0, idx - 1)).header;
    }

    if (group.semester === 1 || group.semester === 2) {
      return getGradeTableChapterTone(gradeTableColorScheme, group.semester - 1).header;
    }

    return getGradeTableColumnHeaderTone(gradeTableColorScheme, { type: "final" });
  };

  const reportHeaderGroups = buildReportPreviewHeaderGroups(getHeaderGroups());
  const reportHasGroupHeader = reportHeaderGroups.length > 1;
  const reportZoomFactor = reportZoom / 100;
  const reportGroupHeaderHeight = reportHasGroupHeader
    ? Math.max(28, Math.round(REPORT_GROUP_HEADER_HEIGHT * reportZoomFactor))
    : 0;
  const reportColumnHeaderHeight = Math.max(34, Math.round(REPORT_COLUMN_HEADER_HEIGHT * reportZoomFactor));
  const reportHeaderHeight = reportGroupHeaderHeight + reportColumnHeaderHeight;
  const reportDefaultRowHeight = Math.max(36, Math.round(REPORT_DEFAULT_ROW_HEIGHT * reportZoomFactor));
  const reportNameLineHeight = Math.max(14, Math.round(REPORT_NAME_LINE_HEIGHT * reportZoomFactor));
  const reportRowVerticalPadding = Math.max(10, Math.round(REPORT_ROW_VERTICAL_PADDING * reportZoomFactor));
  const reportHeaderFontSize = Math.max(10, Number((11 * reportZoomFactor).toFixed(1)));
  const reportBodyFontSize = Math.max(10.5, Number((12 * reportZoomFactor).toFixed(1)));
  const reportStatusFontSize = Math.max(10, Number((10.5 * reportZoomFactor).toFixed(1)));

  const reportColumnWidths = useMemo(
    () => visibleColumns.map((column) => Math.round(getReportColumnWidth(column) * reportZoomFactor)),
    [reportZoomFactor, visibleColumns],
  );

  const reportColumnLayouts = useMemo(() => {
    let frozenLeft = 0;
    let nonFrozenLeft = 0;

    return visibleColumns.map((column, index) => {
      const width = reportColumnWidths[index] ?? REPORT_GRADE_COL_WIDTH;
      const frozen = isReportFrozenColumn(column);
      const layout = {
        column,
        index,
        width,
        frozen,
        left: frozen ? frozenLeft : nonFrozenLeft,
      };

      if (frozen) {
        frozenLeft += width;
      } else {
        nonFrozenLeft += width;
      }

      return layout;
    });
  }, [reportColumnWidths, visibleColumns]);

  const reportFrozenWidth = useMemo(
    () => reportColumnLayouts.filter((layout) => layout.frozen).reduce((sum, layout) => sum + layout.width, 0),
    [reportColumnLayouts],
  );

  const reportNonFrozenWidth = useMemo(
    () => reportColumnLayouts.filter((layout) => !layout.frozen).reduce((sum, layout) => sum + layout.width, 0),
    [reportColumnLayouts],
  );

  const reportGroupLayouts = useMemo(() => {
    let startIndex = 0;

    return reportHeaderGroups.flatMap((group, groupIndex) => {
      const start = startIndex;
      const end = Math.min(visibleColumns.length - 1, startIndex + group.colSpan - 1);
      const layouts = reportColumnLayouts.slice(start, end + 1);
      const frozenLayouts = layouts.filter((layout) => layout.frozen);
      const nonFrozenLayouts = layouts.filter((layout) => !layout.frozen);

      startIndex += group.colSpan;

      return [
        frozenLayouts.length > 0
          ? {
              ...group,
              groupIndex,
              part: "frozen" as const,
              width: frozenLayouts.reduce((sum, layout) => sum + layout.width, 0),
              frozen: true,
              left: frozenLayouts[0]?.left ?? 0,
            }
          : null,
        nonFrozenLayouts.length > 0
          ? {
              ...group,
              groupIndex,
              part: "scroll" as const,
              width: nonFrozenLayouts.reduce((sum, layout) => sum + layout.width, 0),
              frozen: false,
              left: nonFrozenLayouts[0]?.left ?? 0,
            }
          : null,
      ].filter(Boolean);
    });
  }, [reportColumnLayouts, reportHeaderGroups, visibleColumns.length]);

  const reportRowHeights = useMemo(() => {
    const nameWidth = reportColumnLayouts.find((layout) => layout.column.type === "name")?.width ?? Math.round(REPORT_NAME_COL_WIDTH * reportZoomFactor);

    return studentGrades.map((sg) => {
      const lineCount = estimateReportWrappedLineCount(String(sg.student?.name ?? ""), nameWidth);
      return Math.max(reportDefaultRowHeight, reportRowVerticalPadding + lineCount * reportNameLineHeight);
    });
  }, [reportColumnLayouts, reportDefaultRowHeight, reportNameLineHeight, reportRowVerticalPadding, reportZoomFactor, studentGrades]);

  const reportRowTops = useMemo(() => {
    let top = 0;
    return reportRowHeights.map((height) => {
      const currentTop = top;
      top += height;
      return currentTop;
    });
  }, [reportRowHeights]);

  const reportBodyHeight = useMemo(
    () => reportRowHeights.reduce((sum, height) => sum + height, 0),
    [reportRowHeights],
  );

  const updateReportZoom = (nextZoom: number) => {
    setReportZoom(clampReportZoom(nextZoom));
  };

  const getReportGroupClassName = (group: ReportHeaderGroup & { groupIndex: number }) => {
    if (group.label === "Data Siswa" || group.label === "") {
      return "border-border bg-background text-muted-foreground";
    }

    return getReportGroupTone(group, group.groupIndex);
  };

  const renderReportCellContent = (sg: any, col: ReportVisibleColumn, rowIndex: number) => {
    const value = getCellValue(sg, col, rowIndex);

    if (col.type === "status") {
      const statusValue = isCombinedView && "avgRapor" in sg
        ? sg.avgRapor
        : "rapor" in sg
          ? sg.rapor
          : 0;
      return (
        <Badge className={cn(getStatusColor(statusValue), "px-2 py-0.5")} style={{ fontSize: reportStatusFontSize }}>
          {value}
        </Badge>
      );
    }

    if (col.type === "name") {
      return (
        <span className="block w-full whitespace-normal break-words text-left font-medium leading-4 text-foreground" style={{ fontSize: reportBodyFontSize }}>
          {value}
        </span>
      );
    }

    if (col.type === "nisn") {
      return (
        <span className="block w-full text-center font-medium text-muted-foreground" style={{ fontSize: Math.max(10.5, reportBodyFontSize - 0.5) }}>
          {value || "-"}
        </span>
      );
    }

    if (col.type === "index") {
      return (
        <span className="block w-full text-center font-medium text-muted-foreground" style={{ fontSize: reportBodyFontSize }}>
          {value}
        </span>
      );
    }

    return value;
  };

  return (
    <>
      <div className="app-page">
        {/* Header - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 animate-fade-in">
          <div className="flex items-center gap-2 sm:gap-3 lg:gap-4 min-w-0">
            <Link to="/reports">
              <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8 sm:h-9 sm:w-9 lg:h-10 lg:w-10">
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            </Link>
            <div className="min-w-0 flex-1">
              <h1 className="text-base sm:text-lg lg:text-xl xl:text-2xl font-bold text-foreground truncate">
                Laporan Nilai
              </h1>
              <p className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground mt-0.5 truncate">
                Lihat dan ekspor laporan nilai detail
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={isRefreshing}
              className="gap-1.5 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm"
            >
              <RefreshCw className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", isRefreshing && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <ReportSemesterSelector
              value={semesterFilter}
              onChange={setSemesterFilter}
              showIndicator={false}
            />
            <TourButton tourKey="reports" />
          </div>
        </div>

        {/* Active Period Indicator - Responsive */}
        {activeYear && (
          <div className="flex items-center gap-2 text-xs sm:text-sm animate-fade-in overflow-x-auto pb-1">
            <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-primary/5 border border-primary/10 shrink-0">
              {isCombinedView ? (
                <Layers className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-primary shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 sm:h-3.5 sm:w-3.5 lg:h-4 lg:w-4 text-primary shrink-0" />
              )}
              <span className="text-muted-foreground text-[10px] sm:text-xs whitespace-nowrap">Data:</span>
              <Badge variant="secondary" className="font-medium text-[10px] sm:text-xs whitespace-nowrap">
                {activeYear.name} • {isCombinedView ? "Semua Semester" : `Sem ${semesterFilter}`}
              </Badge>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 animate-fade-in-up" data-tour="filter-section">
          <Select value={selectedClassId} onValueChange={setSelectedClassId}>
            <SelectTrigger className="h-10 sm:h-11">
              <School className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Pilih Kelas" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedSubjectId} onValueChange={setSelectedSubjectId} disabled={!selectedClassId}>
            <SelectTrigger className="h-10 sm:h-11">
              <BookOpen className="w-4 h-4 mr-2 text-muted-foreground shrink-0" />
              <SelectValue placeholder="Pilih Mapel" />
            </SelectTrigger>
            <SelectContent>
              {subjects.map((subj) => (
                <SelectItem key={subj.id} value={subj.id}>{subj.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Cari siswa..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-9 h-10 sm:h-11" 
            />
          </div>
        </div>

        {/* Empty State */}
        {(!selectedClassId || !selectedSubjectId) && (
          <Card className="animate-fade-in-up">
            <CardContent className="flex flex-col items-center justify-center py-10 sm:py-12">
              <BarChart3 className="w-10 h-10 sm:w-12 sm:h-12 text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground text-center">Pilih kelas dan mapel untuk melihat laporan</p>
            </CardContent>
          </Card>
        )}

        {/* Export Section */}
        {hasData && (
          <Card className="animate-fade-in-up" data-tour="export-section">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <Settings2 className="w-4 h-4 shrink-0" />
                Ekspor Laporan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-muted/20 p-3 sm:p-4">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-foreground">Studio Ekspor Laporan</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">
                      Pilih format, atur kolom, style dokumen, dan signature - semuanya di satu tempat dengan live preview.
                    </p>
                  </div>
                  <UnifiedExportStudio
                    title="Studio Ekspor Laporan Nilai"
                    description="Atur format, kolom, style dokumen, dan signature dari satu tempat agar hasil ekspor lebih jelas dan konsisten."
                    triggerLabel="Ekspor Laporan"
                    formats={REPORT_EXPORT_FORMATS}
                    selectedFormat={exportFormat}
                    onFormatChange={(value) => setExportFormat(value as typeof exportFormat)}
                    onExport={handleExport}
                    includeSignature={includeSignature}
                    onIncludeSignatureChange={setIncludeSignature}
                    signatureConfig={signatureConfig}
                    hasSignature={hasSignature}
                    isLoading={signatureLoading}
                    isSaving={signatureSaving}
                    onSaveSignature={saveSignature}
                    documentStyle={documentStyle}
                    paperSize={paperSize}
                    onDocumentStyleChange={setDocumentStyle}
                    onPaperSizeChange={setPaperSize}
                    autoFitOnePage={autoFitOnePage}
                    onAutoFitOnePageChange={setAutoFitOnePage}
                    showAutoFitPreset
                    columnOptions={[
                      {
                        key: "includeAssignments",
                        label: "Nilai Tugas",
                        description: "Nilai per tugas/assignment di setiap BAB. Anda bisa mengecualikan tugas tertentu di bawah ini.",
                        checked: exportOptions.includeAssignments,
                        children: allAssignments.map((assignment) => {
                          const chapter = allChapters.find((item) => item.id === assignment.chapter_id);
                          return {
                            key: `assignment:${assignment.id}`,
                            label: assignment.name,
                            description: chapter ? chapter.name : "Tugas tanpa BAB",
                            checked: exportOptions.assignmentVisibility[assignment.id] !== false,
                          };
                        }),
                      },
                      { key: "includeChapterAvg", label: "Rata-Rata BAB", description: "Rata-rata nilai per BAB/bab materi", checked: exportOptions.includeChapterAvg },
                      { key: "includeSTS", label: "STS", description: "Nilai Sumatif Tengah Semester", checked: exportOptions.includeSTS },
                      { key: "includeSAS", label: "SAS", description: "Nilai Sumatif Akhir Semester", checked: exportOptions.includeSAS },
                      { key: "includeRapor", label: "Nilai Rapor", description: "Nilai akhir rapor semester", checked: exportOptions.includeRapor },
                      { key: "includeStatus", label: "Status", description: "Status kelulusan berdasarkan KKM", checked: exportOptions.includeStatus },
                    ]}
                    onColumnOptionChange={(key, checked) => setExportOptions((prev) => {
                      if (key.startsWith("assignment:")) {
                        const assignmentId = key.replace("assignment:", "");
                        return {
                          ...prev,
                          assignmentVisibility: {
                            ...prev.assignmentVisibility,
                            [assignmentId]: checked,
                          },
                        };
                      }

                      if (key === "includeAssignments") {
                        const nextVisibility = { ...prev.assignmentVisibility };
                        allAssignments.forEach((assignment) => {
                          nextVisibility[assignment.id] = checked;
                        });
                        return {
                          ...prev,
                          includeAssignments: checked,
                          assignmentVisibility: nextVisibility,
                        };
                      }

                      return { ...prev, [key]: checked };
                    })}
                    columnCount={visibleColumns.length}
                    columnTypographyOptions={columnTypographyOptions}
                    renderPreview={({ previewFormat, draft, setDraft, previewDate, includeSignature: previewIncludeSignature, paperSize: previewPaperSize, documentStyle: previewStyle, autoFitOnePage: previewAutoFit, liveEditMode, highlightTarget, onHighlightTargetHoverChange, onHighlightTargetSelect }) => (
                      <ExportPreviewRenderer
                        previewFormat={previewFormat}
                        draft={draft}
                        setDraft={setDraft}
                        previewDate={previewDate}
                        liveEditMode={liveEditMode}
                        highlightTarget={highlightTarget}
                        onHighlightTargetHoverChange={onHighlightTargetHoverChange}
                        onHighlightTargetSelect={onHighlightTargetSelect}
                        previewData={{
                          ...exportConfig,
                          paperSize: previewPaperSize,
                          includeSignature: previewIncludeSignature,
                          documentStyle: previewStyle || documentStyle,
                          autoFitOnePage: previewAutoFit ?? autoFitOnePage,
                        }}
                      />
                    )}
                  />
                </div>

                <div className="grid gap-2 text-[10px] sm:grid-cols-3 sm:text-xs">
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="font-semibold text-foreground">Format aktif</p>
                    <p className="mt-1 text-muted-foreground">
                      {REPORT_EXPORT_FORMATS.find((item) => item.id === exportFormat)?.label || "PDF"}
                    </p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="font-semibold text-foreground">Kolom aktif</p>
                    <p className="mt-1 text-muted-foreground">{visibleColumns.length} kolom akan ikut diekspor.</p>
                  </div>
                  <div className="rounded-xl border border-border bg-background p-3">
                    <p className="font-semibold text-foreground">Signature</p>
                    <p className="mt-1 text-muted-foreground">
                      {includeSignature ? "Aktif dan bisa diatur di studio ekspor." : "Nonaktif, file akan diekspor tanpa blok signature."}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Table with Dynamic Columns */}
        {hasData && (
          <ReportFullscreenPortal enabled={isReportFullscreen}>
          <Card className={cn(
            "overflow-hidden",
            !isReportFullscreen && "animate-fade-in-up",
            isReportFullscreen && "fixed inset-0 z-[12000] flex flex-col rounded-none border-0 bg-background shadow-none",
            reportFullscreenMode === "browser" && "sipena-grade-browser-fullscreen",
          )} style={isReportFullscreen ? { height: reportFullscreenViewportHeight, maxHeight: reportFullscreenViewportHeight } : undefined}>
            <CardHeader className={isReportFullscreen
              ? "sipena-grade-toolbar sipena-grade-toolbar--fullscreen shrink-0 overflow-x-auto border-b bg-card p-2 sm:p-3"
              : "pb-2 sm:pb-3"
            }>
              <div className="sipena-grade-toolbar-format flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
                <CardTitle className="min-w-0 flex-[1_1_14rem] truncate text-sm sm:text-base">
                  {selectedClass?.name} - {selectedSubject?.name}
                  <span className="font-normal text-muted-foreground ml-2 text-xs sm:text-sm">KKM: {kkm}</span>
                </CardTitle>
                <Badge variant="outline" className="text-[10px] sm:text-xs">{studentGrades.length} siswa</Badge>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{allChapters.length} BAB</Badge>
                <Badge variant="secondary" className="text-[10px] sm:text-xs">{allAssignments.length} tugas</Badge>
                {isReportFullscreen && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    aria-label="Tutup fullscreen"
                    className="sipena-grade-close-button ml-auto h-9 w-9 shadow-md sm:hidden"
                    onClick={() => void closeReportFullscreen()}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="sipena-grade-toolbar-view flex min-w-0 flex-wrap items-center justify-start gap-1.5 sm:justify-end sm:gap-2">
                  <div className="ml-0 flex h-9 items-center overflow-hidden rounded-xl border border-border bg-background sm:ml-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-none"
                      aria-label="Perkecil tabel laporan"
                      onClick={() => updateReportZoom(reportZoom - REPORT_ZOOM_STEP)}
                      disabled={reportZoom <= REPORT_ZOOM_MIN}
                    >
                      <ZoomOut className="h-4 w-4" />
                    </Button>
                    <span className="min-w-12 px-2 text-center text-xs font-semibold tabular-nums text-muted-foreground">
                      {reportZoom}%
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-none"
                      aria-label="Perbesar tabel laporan"
                      onClick={() => updateReportZoom(reportZoom + REPORT_ZOOM_STEP)}
                      disabled={reportZoom >= REPORT_ZOOM_MAX}
                    >
                      <ZoomIn className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 gap-1.5 rounded-xl px-2 text-xs sm:px-3"
                    onClick={() => updateReportZoom(100)}
                    disabled={reportZoom === 100}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reset</span>
                  </Button>
                  {isReportFullscreen ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="sipena-grade-close-button hidden h-8 sm:flex"
                      onClick={() => void closeReportFullscreen()}
                    >
                      <X className="sipena-grade-close-icon h-3.5 w-3.5 mr-1" />
                      <span className="sipena-grade-close-text">Tutup</span>
                    </Button>
                  ) : (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 gap-1.5 rounded-xl px-2 text-xs sm:px-3"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">Fullscreen</span>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 max-w-[calc(100vw-1rem)]">
                        <DropdownMenuItem onClick={openReportAppFullscreen} className="min-h-[48px] items-start gap-2 py-2.5">
                          <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <p className="font-medium">Fullscreen Panel</p>
                            <p className="text-xs text-muted-foreground">Layar penuh di dalam tab browser.</p>
                          </div>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => void openReportBrowserFullscreen()} className="min-h-[48px] items-start gap-2 py-2.5">
                          <Maximize2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <div>
                            <p className="font-medium">Fullscreen Native</p>
                            <p className="text-xs text-muted-foreground">Memakai mode layar penuh perangkat.</p>
                          </div>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            </CardHeader>
            <CardContent className={cn("p-0", isReportFullscreen && "min-h-0 flex-1")}>
              <div className={cn(
                "sipena-report-grade-table-shell sipena-scroll-chain-page relative overflow-hidden bg-background",
                isReportFullscreen ? "h-full min-h-0" : "h-[70dvh] min-h-[420px]",
              )}>
                {reportHasGroupHeader && (
                  <div className="absolute inset-x-0 top-0 z-50 bg-background" style={{ height: reportGroupHeaderHeight }}>
                    {reportGroupLayouts
                      .filter((group) => group.frozen)
                      .map((group) => (
                        <div
                          key={`report-group-frozen-${group.groupIndex}-${group.part}`}
                          className="absolute top-0 flex items-center justify-center border-r border-b border-border bg-background px-2 text-center text-[11px] font-bold text-muted-foreground"
                          style={{ left: group.left, width: group.width, height: reportGroupHeaderHeight, fontSize: reportHeaderFontSize }}
                          title={group.label || "NISN"}
                          aria-label={group.label || "NISN"}
                        >
                          {group.label}
                        </div>
                      ))}

                    <div className="absolute top-0 overflow-hidden bg-background" style={{ left: reportFrozenWidth, right: 0, height: reportGroupHeaderHeight }}>
                      <div className="relative" style={{ width: reportNonFrozenWidth, transform: `translateX(-${reportScrollLeft}px)` }}>
                        {reportGroupLayouts
                          .filter((group) => !group.frozen && group.width > 0)
                          .map((group) => (
                            <div
                              key={`report-group-${group.groupIndex}-${group.part}`}
                              className={cn(
                                "absolute top-0 flex items-center justify-center border-r border-b px-2 text-center font-bold leading-tight",
                                getReportGroupClassName(group),
                              )}
                              style={{ left: group.left, width: group.width, height: reportGroupHeaderHeight, fontSize: reportHeaderFontSize }}
                              title={group.label}
                              aria-label={group.label}
                            >
                              <span className="line-clamp-2 whitespace-normal px-1">{group.label}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  </div>
                )}

                <div
                  className="absolute z-40 bg-background"
                  style={{
                    left: 0,
                    top: reportGroupHeaderHeight,
                    width: reportFrozenWidth,
                    height: reportColumnHeaderHeight,
                  }}
                >
                  {reportColumnLayouts
                    .filter((layout) => layout.frozen)
                    .map((layout) => (
                      <div
                        key={`report-header-frozen-${layout.column.key}`}
                        className="absolute flex items-center justify-center border border-border bg-background px-2 text-center font-bold text-muted-foreground ring-1 ring-inset ring-primary/20"
                        style={{ left: layout.left, width: layout.width, height: reportColumnHeaderHeight, fontSize: reportHeaderFontSize }}
                        title={layout.column.label}
                        aria-label={layout.column.label}
                      >
                        <span className="whitespace-normal text-center leading-tight">{layout.column.label}</span>
                      </div>
                    ))}
                </div>

                <div
                  className="absolute z-30 overflow-hidden bg-background"
                  style={{
                    left: reportFrozenWidth,
                    right: 0,
                    top: reportGroupHeaderHeight,
                    height: reportColumnHeaderHeight,
                  }}
                >
                  <div className="relative" style={{ width: reportNonFrozenWidth, transform: `translateX(-${reportScrollLeft}px)` }}>
                    {reportColumnLayouts
                      .filter((layout) => !layout.frozen)
                      .map((layout) => (
                        <div
                          key={`report-header-${layout.column.key}`}
                          className={cn(
                            "absolute flex items-center justify-center border border-border px-2 text-center font-bold leading-tight",
                            REPORT_SOLID_HEADER_SURFACE,
                            getReportColumnHeaderTone(layout.column),
                          )}
                          style={{ left: layout.left, width: layout.width, height: reportColumnHeaderHeight, fontSize: reportHeaderFontSize }}
                          title={layout.column.label}
                          aria-label={layout.column.label}
                        >
                          <span className="line-clamp-2 whitespace-normal text-center">{layout.column.label}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 z-[35] h-3 bg-gradient-to-b from-border/40 to-transparent"
                  style={{ top: Math.max(0, reportHeaderHeight - 1) }}
                />

                <div
                  ref={reportScrollRef}
                  className="sipena-grade-scroll sipena-scroll-chain-page absolute bottom-0 overflow-auto scrollbar-thin"
                  style={{
                    left: reportFrozenWidth,
                    right: 0,
                    top: reportHeaderHeight,
                    WebkitOverflowScrolling: "touch",
                    overscrollBehaviorX: "contain",
                    overscrollBehaviorY: "auto",
                    touchAction: "pan-x pan-y",
                  }}
                  onScroll={handleReportScroll}
                >
                  <div className="relative" style={{ width: reportNonFrozenWidth, height: reportBodyHeight, minHeight: "100%" }}>
                    {studentGrades.map((sg, rowIndex) =>
                      reportColumnLayouts
                        .filter((layout) => !layout.frozen)
                        .map((layout) => (
                          <div
                            key={`${sg.student.id}-${layout.column.key}`}
                            className={cn(
                              "absolute flex items-center justify-center border border-border/40 px-2 text-center text-[12px] transition-colors hover:border-fuchsia-300/80 hover:bg-fuchsia-50/90 dark:hover:border-fuchsia-700/70 dark:hover:bg-fuchsia-950/35",
                              getReportColumnBodyTone(layout.column) || (rowIndex % 2 === 0 ? "bg-background" : "bg-muted/20"),
                              (layout.column.type === "grandAvg" || layout.column.type === "avgRapor" || layout.column.type === "rapor") && "font-bold text-foreground",
                            )}
                            style={{
                              left: layout.left,
                              top: reportRowTops[rowIndex] ?? 0,
                              width: layout.width,
                              height: reportRowHeights[rowIndex] ?? reportDefaultRowHeight,
                              fontSize: reportBodyFontSize,
                            }}
                          >
                            {renderReportCellContent(sg, layout.column, rowIndex)}
                          </div>
                        )),
                    )}
                  </div>
                </div>

                <div
                  className="sipena-grade-frozen-layer sipena-report-frozen-layer absolute left-0 z-20 overflow-hidden border-r-2 border-primary bg-background shadow-[2px_0_8px_rgba(15,23,42,0.12)]"
                  onWheel={handleReportFrozenWheel}
                  onTouchStart={handleReportFrozenTouchStart}
                  onTouchMove={handleReportFrozenTouchMove}
                  onTouchEnd={handleReportFrozenTouchEnd}
                  onTouchCancel={handleReportFrozenTouchEnd}
                  style={{
                    top: reportHeaderHeight,
                    bottom: 0,
                    width: reportFrozenWidth,
                    pointerEvents: "none",
                    touchAction: "pan-x pan-y",
                  }}
                >
                  <div
                    className="relative"
                    style={{
                      width: reportFrozenWidth,
                      height: reportBodyHeight,
                      transform: `translate3d(0, -${reportScrollTop}px, 0)`,
                    }}
                  >
                    {studentGrades.map((sg, rowIndex) =>
                      reportColumnLayouts
                        .filter((layout) => layout.frozen)
                        .map((layout) => (
                          <div
                            key={`${sg.student.id}-${layout.column.key}-frozen`}
                            className={cn(
                              "absolute flex items-center border border-border/40 px-2 transition-colors hover:border-fuchsia-300/80 hover:bg-fuchsia-100/80 dark:hover:border-fuchsia-700/70 dark:hover:bg-fuchsia-950/40",
                              REPORT_SOLID_FROZEN_SURFACE,
                              layout.column.type === "name" ? "justify-start" : "justify-center",
                            )}
                            style={{
                              left: layout.left,
                              top: reportRowTops[rowIndex] ?? 0,
                              width: layout.width,
                              height: reportRowHeights[rowIndex] ?? reportDefaultRowHeight,
                              fontSize: reportBodyFontSize,
                            }}
                          >
                            {renderReportCellContent(sg, layout.column, rowIndex)}
                          </div>
                        )),
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </ReportFullscreenPortal>
        )}
      </div>

      <ProductTour steps={reportsTourSteps} tourKey="reports" />
      {exportOverlay}
    </>
  );
}

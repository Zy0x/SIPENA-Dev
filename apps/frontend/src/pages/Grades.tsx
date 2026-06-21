import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArchiveRestore,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  LogOut,
  Percent,
  Plus,
  RefreshCw,
  School,
  Settings,
  UserCheck,
  Users,
  Upload,
  X,
} from "lucide-react";

import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useClasses } from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { useSubjects } from "@/hooks/useSubjects";
import { useGradesWithUndo } from "@/hooks/useGradesWithUndo";
import type { Grade } from "@/hooks/useGrades";
import { useChapters, type Chapter } from "@/hooks/useChapters";
import { useAssignments, useAllAssignments, type Assignment } from "@/hooks/useAssignments";
import type { Student } from "@/hooks/useStudents";
import type { Class } from "@/hooks/useClasses";
import type { Subject } from "@/hooks/useSubjects";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useCoarsePointerTapGuard } from "@/hooks/useCoarsePointerTapGuard";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useGradeTableColorScheme } from "@/hooks/useGradeTableColorScheme";
import { fuzzySearchStudents } from "@/lib/fuzzySearch";
import { getScopedGradeValue } from "@/lib/gradeValueSelection";
import { useGradeFormulaSettings, type GradeFormulaSetting } from "@/hooks/useGradeFormulaSettings";
import { calculateStudentSubjectReport } from "@/lib/gradeReportEngine";
import {
  DEFAULT_FORMULA,
  getReportRoundingLabel,
  getReportRoundingTargetLabel,
  normalizeFormula,
  type CustomFormula,
} from "@/lib/gradeFormula";
import {
  downloadCurrentGradesExport,
  downloadFullGradeBackup,
  downloadOfficialGradeTemplate,
  type GradeExportContext,
  type GradeTarget,
  type ImportPlanContext,
} from "@/lib/gradeImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProductTour, TourButton, type TourStep } from "@/components/ui/product-tour";
import { SmartStudentSearch } from "@/components/grades/SmartStudentSearch";
import { ChapterStructure } from "@/components/grades/ChapterStructure";
import { SpreadsheetTable } from "@/components/grades/SpreadsheetTable";
import { EmptyStudentsState } from "@/components/grades/EmptyStudentsState";
import { lockGradeTabsMinHeight } from "@/components/grades/gradeTabViewportStability";
import GradeBackupRestoreDialog from "@/components/grades/GradeBackupRestoreDialog";
import GradeImportExportDialog, { type GradeImportExportTab } from "@/components/grades/GradeImportExportDialog";
import {
  FormulaSettings,
} from "@/components/grades/FormulaSettings";
import { ReportRoundingSettingsDialog } from "@/components/grades/ReportRoundingSettingsDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";

export type GradeInputMode = "owner" | "guest";

interface GradesProps {
  mode?: GradeInputMode;
}

function isGradeFullscreenHistoryState(state: unknown): state is { sipenaGradeFullscreen: true } {
  return typeof state === "object" && state !== null && (state as { sipenaGradeFullscreen?: unknown }).sipenaGradeFullscreen === true;
}

interface GuestSession {
  guestId: string;
  name: string;
  email: string;
  token: string;
  sharedLinkId: string;
  subjectId: string;
  classId: string;
  userId: string;
  isMainTeacher?: boolean;
  mainUserId?: string | null;
}

export interface GradeInputAccess {
  mode: GradeInputMode;
  ownerUserId?: string;
  classId: string;
  subjectId: string;
  sharedLinkId?: string;
  guest?: {
    id: string;
    name: string;
    email: string;
    isMainTeacher: boolean;
  };
  capabilities: {
    canSelectScope: boolean;
    canImport: boolean;
    canUpdateKkm: boolean;
    canManageStructure: boolean;
    canLogoutGuest: boolean;
  };
}

interface GuestGradeInputData {
  access: GradeInputAccess;
  classInfo: Class;
  subjectInfo: Subject;
  formulaSetting: GradeFormulaSetting | null;
  students: Student[];
  chapters: Chapter[];
  assignments: Assignment[];
  grades: Grade[];
}

interface StudentAverage {
  chaptersAvg: number | null;
  stsAvg: number | null;
  sasAvg: number | null;
  final: number | null;
  chapterDetails: Record<string, number | null>;
  hasEmptyValues: boolean;
}

interface GuestRawGradeInputData {
  access?: {
    ownerUserId?: string;
    classId?: string;
    subjectId?: string;
    sharedLinkId?: string;
  };
  classInfo?: Class;
  subjectInfo?: Subject;
  formulaSetting?: GradeFormulaSetting | null;
  students?: Student[];
  chapters?: Chapter[];
  assignments?: Assignment[];
  grades?: Grade[];
}

interface RpcResult<T = unknown> {
  data: T | null;
  error: unknown;
}

type RpcClient = {
  rpc: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<RpcResult<T>>;
};

const guestRpcClient = supabase as unknown as RpcClient;

const fullscreenGradesTourSteps: TourStep[] = [
  {
    target: ".sipena-grade-toolbar--fullscreen [data-tour='grade-freeze-control']",
    title: "Kolom Tetap Terlihat",
    description: "Pilih kolom yang tetap terlihat ketika tabel digeser ke samping.",
  },
  {
    target: ".sipena-grade-toolbar--fullscreen [data-tour='grade-protection-control']",
    title: "Proteksi dan Navigasi",
    description: "Pilih Proteksi Penuh, Kunci Tata Letak, atau Mode Navigasi sesuai pekerjaan Anda.",
  },
  {
    target: ".sipena-grade-toolbar--fullscreen [data-tour='grade-search-control']",
    title: "Cari Siswa",
    description: "Cari dan kunci perhatian pada satu siswa tanpa menggulir daftar panjang.",
  },
  {
    target: ".sipena-grade-toolbar--fullscreen [data-tour='grade-zoom-control']",
    title: "Atur Zoom",
    description: "Sesuaikan ukuran tabel tanpa mengubah nilai atau lebar asli kolom.",
  },
  {
    target: ".sipena-grade-toolbar--fullscreen",
    title: "Toolbar Responsif",
    description: "Pada layar sempit toolbar tersusun dua baris agar semua kontrol utama tetap dapat digunakan tanpa geser horizontal.",
  },
];

const ownerCapabilities: GradeInputAccess["capabilities"] = {
  canSelectScope: true,
  canImport: true,
  canUpdateKkm: false,
  canManageStructure: true,
  canLogoutGuest: false,
};

const guestCapabilities: GradeInputAccess["capabilities"] = {
  canSelectScope: false,
  canImport: false,
  canUpdateKkm: true,
  canManageStructure: true,
  canLogoutGuest: true,
};

function readGuestSession(token: string): GuestSession | null {
  const sessionData = sessionStorage.getItem("guest_session");
  if (!sessionData || !token) return null;

  try {
    const session = JSON.parse(sessionData) as GuestSession;
    return session.token === token ? session : null;
  } catch {
    return null;
  }
}

function normalizeGuestGradeInputData(raw: unknown, session: GuestSession): GuestGradeInputData {
  const data = (raw || {}) as GuestRawGradeInputData;

  return {
    access: {
      mode: "guest",
      ownerUserId: data.access?.ownerUserId || session.userId,
      classId: data.access?.classId || session.classId,
      subjectId: data.access?.subjectId || session.subjectId,
      sharedLinkId: data.access?.sharedLinkId || session.sharedLinkId,
      guest: {
        id: session.guestId,
        name: session.name,
        email: session.email,
        isMainTeacher: Boolean(session.isMainTeacher),
      },
      capabilities: guestCapabilities,
    },
    classInfo: data.classInfo as Class,
    subjectInfo: data.subjectInfo as Subject,
    formulaSetting: data.formulaSetting || null,
    students: data.students || [],
    chapters: data.chapters || [],
    assignments: data.assignments || [],
    grades: data.grades || [],
  };
}

function getRpcErrorMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = String((error as { message?: string }).message || "");
    if (message.includes("invalid_guest_token")) return "Sesi guru tamu tidak valid atau sudah berakhir";
    if (message.includes("guest_scope_violation")) return "Akses guru tamu tidak sesuai dengan link yang diberikan";
    if (message.includes("guest_invalid_grade_type")) return "Tipe nilai tidak valid";
    if (message.includes("guest_invalid_grade_value")) return "Nilai harus berada di rentang 0 sampai 100";
    if (message.trim()) return message;
  }
  return fallback;
}

export default function Grades({ mode = "owner" }: GradesProps) {
  const isGuestMode = mode === "guest";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { activeYear, activeSemester, activeSemesterId } = useAcademicYear();
  const { user } = useAuth();
  const { success, error: showError, warning: showWarning } = useEnhancedToast();
  const { shouldShowTours } = useUserPreferences();
  const { colorScheme: gradeTableColorScheme } = useGradeTableColorScheme();

  const token = searchParams.get("token") || "";
  const [guestSession, setGuestSession] = useState<GuestSession | null>(() =>
    isGuestMode ? readGuestSession(token) : null
  );
  const [guestSessionChecked, setGuestSessionChecked] = useState(!isGuestMode);
  const guestAccessNotifiedRef = useRef<string | null>(null);

  const initialClassId = isGuestMode ? "" : searchParams.get("classId") || "";
  const initialSubjectId = isGuestMode ? "" : searchParams.get("subjectId") || "";
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);
  const [savingGrades, setSavingGrades] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [lockedStudentId, setLockedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("input");
  const gradeTabsRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenMode, setFullscreenMode] = useState<"browser" | "maximal" | null>(null);
  const gradeFullscreenHistoryRef = useRef(false);
  const gradeOverlayOpenRef = useRef(false);
  const [showGradeImportExport, setShowGradeImportExport] = useState(false);
  const [gradeImportExportTab, setGradeImportExportTab] = useState<GradeImportExportTab>("import");
  const [showGradeBackupRestore, setShowGradeBackupRestore] = useState(false);
  const [showGradeBackupOptions, setShowGradeBackupOptions] = useState(false);
  const [protectGradeBackupMetadata, setProtectGradeBackupMetadata] = useState(false);
  const [showGradeManageMenu, setShowGradeManageMenu] = useState(false);
  const [showReportRoundingSettings, setShowReportRoundingSettings] = useState(false);
  const [isDownloadingOfficialTemplate, setIsDownloadingOfficialTemplate] = useState(false);
  const [isExportingCurrentGrades, setIsExportingCurrentGrades] = useState(false);
  const [isExportingGradeBackup, setIsExportingGradeBackup] = useState(false);
  const [showOCRGrades, setShowOCRGrades] = useState(false);
  const [showGuestKkmDialog, setShowGuestKkmDialog] = useState(false);
  const [guestKkm, setGuestKkm] = useState(75);

  const gradeOverlayOpen = showGradeImportExport ||
    showGradeBackupOptions ||
    showGradeBackupRestore ||
    showReportRoundingSettings ||
    showOCRGrades ||
    showGuestKkmDialog;

  useEffect(() => {
    gradeOverlayOpenRef.current = gradeOverlayOpen;
  }, [gradeOverlayOpen]);

  const handleActiveTabChange = useCallback((nextTab: string) => {
    if (nextTab === activeTab) return;

    lockGradeTabsMinHeight(gradeTabsRef.current);
    setActiveTab(nextTab);
  }, [activeTab]);

  useEffect(() => {
    if (!isGuestMode) {
      setGuestSession(null);
      setGuestSessionChecked(true);
      return;
    }

    const session = readGuestSession(token);
    if (!session) {
      sessionStorage.removeItem("guest_session");
      setGuestSession(null);
      setGuestSessionChecked(true);
      if (token) {
        navigate(`/share?token=${token}`, { replace: true });
      }
      return;
    }

    setGuestSession(session);
    setGuestSessionChecked(true);
  }, [isGuestMode, token, navigate]);

  const openAppFullscreen = useCallback(() => {
    setShowGradeManageMenu(false);
    setFullscreenMode("browser");
    setIsFullscreen(true);
  }, []);

  const openBrowserFullscreen = useCallback(async () => {
    setShowGradeManageMenu(false);
    setFullscreenMode("maximal");
    setIsFullscreen(true);

    if (typeof document === "undefined") return;

    const target = document.documentElement;
    if (!target.requestFullscreen) {
      setFullscreenMode("browser");
      showWarning("Layar penuh maksimal tidak tersedia", "Layar Penuh Browser tetap dibuka di dalam tampilan browser.");
      return;
    }

    try {
      await target.requestFullscreen({ navigationUI: "hide" });
    } catch {
      setFullscreenMode("browser");
      showWarning("Layar penuh maksimal diblokir", "Browser tidak mengizinkan layar penuh perangkat. Layar Penuh Browser tetap aktif.");
    }
  }, [showWarning]);

  const closeGradeFullscreen = useCallback(async (options?: { skipHistoryBack?: boolean }) => {
    setShowGradeManageMenu(false);
    if (typeof document !== "undefined" && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        // Keep closing the app overlay even if the browser rejects exitFullscreen.
      }
    }

    setIsFullscreen(false);
    setFullscreenMode(null);

    if (
      !options?.skipHistoryBack &&
      gradeFullscreenHistoryRef.current &&
      typeof window !== "undefined"
    ) {
      gradeFullscreenHistoryRef.current = false;
      window.history.back();
    }
  }, []);

  useEffect(() => {
    if (!isFullscreen || typeof window === "undefined") return;

    if (!gradeFullscreenHistoryRef.current) {
      window.history.pushState({ sipenaGradeFullscreen: true }, "", window.location.href);
      gradeFullscreenHistoryRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      if (!gradeFullscreenHistoryRef.current) return;
      // Dialog close inside fullscreen returns to this marker. Keep fullscreen active.
      if (isGradeFullscreenHistoryState(event.state)) return;
      gradeFullscreenHistoryRef.current = false;
      void closeGradeFullscreen({ skipHistoryBack: true });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [closeGradeFullscreen, isFullscreen]);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const handleFullscreenChange = () => {
      if (fullscreenMode === "maximal" && !document.fullscreenElement) {
        if (gradeOverlayOpenRef.current) {
          setFullscreenMode("browser");
          setIsFullscreen(true);
          return;
        }
        void closeGradeFullscreen();
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [closeGradeFullscreen, fullscreenMode]);

  const guestQuery = useQuery({
    queryKey: ["guest_grade_input", token, guestSession?.sharedLinkId],
    queryFn: async () => {
      if (!token || !guestSession) throw new Error("invalid_guest_token");
      const { data, error } = await guestRpcClient.rpc("get_guest_grade_input_data", {
        p_token: token,
      });
      if (error) throw error;
      return normalizeGuestGradeInputData(data, guestSession);
    },
    enabled: isGuestMode && !!token && !!guestSession,
    staleTime: 1000 * 30,
  });

  const { classes, isLoading: classesLoading } = useClasses();
  const { students: ownerStudents, isLoading: studentsLoading } = useStudents(
    isGuestMode ? "" : selectedClassId
  );
  const { subjects, isLoading: subjectsLoading } = useSubjects(
    isGuestMode ? "" : selectedClassId
  );
  const {
    grades: ownerGrades,
    isLoading: gradesLoading,
    saveGradeWithUndo,
    saveGradesBatchWithUndo,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useGradesWithUndo(isGuestMode ? "" : selectedSubjectId, isGuestMode ? "" : selectedClassId);
  const {
    chapters: ownerChapters,
    createBulkChapters,
    updateChapter,
    deleteChapter,
    isLoading: chaptersLoading,
  } = useChapters(isGuestMode ? "" : selectedSubjectId);
  const { assignments: ownerAssignments, isLoading: assignmentsLoading } = useAllAssignments(
    isGuestMode ? "" : selectedSubjectId
  );
  const { createBulkAssignments, updateAssignment, deleteAssignment } = useAssignments();

  const guestData = guestQuery.data;
  const classId = isGuestMode ? guestData?.access.classId || "" : selectedClassId;
  const subjectId = isGuestMode ? guestData?.access.subjectId || "" : selectedSubjectId;

  useEffect(() => {
    gradeTabsRef.current?.style.removeProperty("min-height");
  }, [classId, subjectId]);

  const {
    formula: ownerFormula,
    saveFormula,
    saveRoundingForSubjects,
    isLoading: formulaLoading,
    isSaving: formulaSaving,
    isSavingRoundingForSubjects,
  } = useGradeFormulaSettings(isGuestMode ? undefined : subjectId);
  const formula = useMemo(
    () => (isGuestMode ? normalizeFormula(guestData?.formulaSetting?.formula ?? DEFAULT_FORMULA) : ownerFormula),
    [guestData?.formulaSetting?.formula, isGuestMode, ownerFormula],
  );
  const students = useMemo(
    () => (isGuestMode ? guestData?.students || [] : ownerStudents),
    [guestData?.students, isGuestMode, ownerStudents]
  );
  const chapters = useMemo(
    () => (isGuestMode ? guestData?.chapters || [] : ownerChapters),
    [guestData?.chapters, isGuestMode, ownerChapters]
  );
  const allAssignments = useMemo(
    () => (isGuestMode ? guestData?.assignments || [] : ownerAssignments),
    [guestData?.assignments, isGuestMode, ownerAssignments]
  );
  const grades = useMemo(
    () => (isGuestMode ? guestData?.grades || [] : ownerGrades),
    [guestData?.grades, isGuestMode, ownerGrades]
  );
  const selectedClass = isGuestMode
    ? guestData?.classInfo
    : classes.find((c) => c.id === selectedClassId);
  const selectedSubject = isGuestMode
    ? guestData?.subjectInfo
    : subjects.find((s) => s.id === selectedSubjectId);
  const importChapterCacheRef = useRef<Chapter[]>([]);
  const importAssignmentCacheRef = useRef<Assignment[]>([]);

  useEffect(() => {
    importChapterCacheRef.current = chapters;
  }, [chapters]);

  useEffect(() => {
    importAssignmentCacheRef.current = allAssignments;
  }, [allAssignments]);

  const gradeImportContext = useMemo<ImportPlanContext>(() => ({
    students: students.map((student) => ({
      id: student.id,
      name: student.name,
      nisn: student.nisn,
    })),
    chapters: chapters.map((chapter) => ({
      id: chapter.id,
      name: chapter.name,
      order_index: chapter.order_index,
    })),
    assignments: allAssignments.map((assignment) => ({
      id: assignment.id,
      chapter_id: assignment.chapter_id,
      name: assignment.name,
      order_index: assignment.order_index,
    })),
    existingGrades: grades
      .filter((grade) => ["assignment", "sts", "sas"].includes(grade.grade_type))
      .map((grade) => ({
        student_id: grade.student_id,
        grade_type: grade.grade_type as "assignment" | "sts" | "sas",
        assignment_id: grade.assignment_id,
        value: grade.value,
        semester_id: grade.semester_id,
        academic_year_id: grade.academic_year_id,
      })),
    classId,
    subjectId,
    semesterId: activeSemesterId || selectedClass?.semester_id || null,
    academicYearId: activeYear?.id || selectedClass?.academic_year_id || selectedSubject?.academic_year_id || null,
  }), [
    activeSemesterId,
    activeYear?.id,
    allAssignments,
    chapters,
    classId,
    grades,
    selectedClass?.academic_year_id,
    selectedClass?.semester_id,
    selectedSubject?.academic_year_id,
    students,
    subjectId,
  ]);

  const buildGradeExportContext = useCallback((): GradeExportContext | null => {
    if (!selectedClass || !selectedSubject) {
      return null;
    }

    return {
      classId: selectedClass.id,
      className: selectedClass.name,
      subjectId: selectedSubject.id,
      subjectName: selectedSubject.name,
      semesterId: activeSemester?.id || selectedClass.semester_id || null,
      semesterName: activeSemester?.name || null,
      academicYearId: activeYear?.id || selectedClass.academic_year_id || selectedSubject.academic_year_id || null,
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        nisn: student.nisn,
      })),
      chapters: chapters.map((chapter) => ({
        id: chapter.id,
        name: chapter.name,
        order_index: chapter.order_index,
      })),
      assignments: allAssignments.map((assignment) => ({
        id: assignment.id,
        chapter_id: assignment.chapter_id,
        name: assignment.name,
        order_index: assignment.order_index,
      })),
      grades: grades
        .filter((grade) => ["assignment", "sts", "sas"].includes(grade.grade_type))
        .map((grade) => ({
          id: grade.id,
          student_id: grade.student_id,
          subject_id: grade.subject_id,
          assignment_id: grade.assignment_id,
          grade_type: grade.grade_type,
          value: grade.value,
          semester_id: grade.semester_id,
          academic_year_id: grade.academic_year_id,
          created_at: grade.created_at,
          updated_at: grade.updated_at,
        })),
    };
  }, [
    activeSemester?.id,
    activeSemester?.name,
    activeYear?.id,
    allAssignments,
    chapters,
    grades,
    selectedClass,
    selectedSubject,
    students,
  ]);
  const canDownloadGradeTemplate = Boolean(
    selectedClass
    && selectedSubject
    && (activeSemester?.id || selectedClass.semester_id)
    && (activeYear?.id || selectedClass.academic_year_id || selectedSubject.academic_year_id),
  );
  const gradeBackupRestoreContext = useMemo(
    () => buildGradeExportContext(),
    [buildGradeExportContext],
  );

  const handleDownloadOfficialTemplate = useCallback(() => {
    if (!selectedClass || !selectedSubject) {
      showError("Template belum siap", "Pilih kelas dan mata pelajaran terlebih dahulu.");
      return;
    }
    if (!(activeSemester?.id || selectedClass.semester_id) || !(activeYear?.id || selectedClass.academic_year_id || selectedSubject.academic_year_id)) {
      showError("Template belum siap", "Pilih semester dan tahun ajaran aktif terlebih dahulu.");
      return;
    }

    setIsDownloadingOfficialTemplate(true);
    try {
      downloadOfficialGradeTemplate({
        classId: selectedClass.id,
        className: selectedClass.name,
        subjectId: selectedSubject.id,
        subjectName: selectedSubject.name,
        semesterId: activeSemester?.id || selectedClass.semester_id || null,
        semesterName: activeSemester?.name || null,
        academicYearId: activeYear?.id || selectedClass.academic_year_id || selectedSubject.academic_year_id || null,
        generatedBy: user?.email || null,
        students: students.map((student) => ({
          id: student.id,
          name: student.name,
          nisn: student.nisn,
        })),
        chapters: chapters.map((chapter) => ({
          id: chapter.id,
          name: chapter.name,
          order_index: chapter.order_index,
        })),
        assignments: allAssignments.map((assignment) => ({
          id: assignment.id,
          chapter_id: assignment.chapter_id,
          name: assignment.name,
          order_index: assignment.order_index,
        })),
      });
      success("Template berhasil dibuat", "Template Resmi SIPENA sudah diunduh.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat workbook template.";
      showError("Gagal membuat template", message);
    } finally {
      setIsDownloadingOfficialTemplate(false);
    }
  }, [
    activeSemester?.id,
    activeSemester?.name,
    activeYear?.id,
    allAssignments,
    chapters,
    selectedClass,
    selectedSubject,
    showError,
    students,
    success,
    user?.email,
  ]);

  const handleDownloadCurrentGrades = useCallback(() => {
    const exportContext = buildGradeExportContext();
    if (!exportContext) {
      showError("Export belum siap", "Pilih kelas dan mata pelajaran terlebih dahulu.");
      return;
    }

    setIsExportingCurrentGrades(true);
    try {
      downloadCurrentGradesExport(exportContext);
      success("Export berhasil dibuat", "Export Nilai Saat Ini SIPENA sudah diunduh.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat workbook export nilai.";
      showError("Gagal membuat export", message);
    } finally {
      setIsExportingCurrentGrades(false);
    }
  }, [buildGradeExportContext, showError, success]);

  const handleOpenGradeBackupOptions = useCallback(() => {
    const exportContext = buildGradeExportContext();
    if (!exportContext) {
      showError("Backup belum siap", "Pilih kelas dan mata pelajaran terlebih dahulu.");
      return;
    }

    setProtectGradeBackupMetadata(false);
    setShowGradeBackupOptions(true);
  }, [buildGradeExportContext, showError]);

  const handleDownloadGradeBackup = useCallback(() => {
    const exportContext = buildGradeExportContext();
    if (!exportContext) {
      showError("Backup belum siap", "Pilih kelas dan mata pelajaran terlebih dahulu.");
      return;
    }

    setIsExportingGradeBackup(true);
    try {
      downloadFullGradeBackup(exportContext, { protectMetadata: protectGradeBackupMetadata });
      const incomplete = !exportContext.classId
        || !exportContext.subjectId
        || !exportContext.academicYearId
        || exportContext.students.length === 0
        || exportContext.chapters.length === 0
        || exportContext.assignments.length === 0;
      if (incomplete) {
        showWarning("Backup dibuat dengan catatan", "Sebagian data belum tersedia untuk export lengkap.");
      } else {
        success(
          "Backup berhasil dibuat",
          protectGradeBackupMetadata
            ? "Backup Lengkap Nilai SIPENA sudah diunduh dengan restore terkunci ke metadata."
            : "Backup Lengkap Nilai SIPENA sudah diunduh dan edit sheet Nilai dapat dipakai saat restore.",
        );
      }
      setShowGradeBackupOptions(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gagal membuat workbook backup.";
      showError("Gagal membuat backup", message);
    } finally {
      setIsExportingGradeBackup(false);
    }
  }, [buildGradeExportContext, protectGradeBackupMetadata, showError, showWarning, success]);

  const handleRestoreComplete = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["grades"] });
    queryClient.invalidateQueries({ queryKey: ["chapters"] });
    queryClient.invalidateQueries({ queryKey: ["assignments"] });
    queryClient.invalidateQueries({ queryKey: ["all_assignments"] });
  }, [queryClient]);

  const access: GradeInputAccess = isGuestMode
    ? guestData?.access || {
        mode: "guest",
        classId,
        subjectId,
        capabilities: guestCapabilities,
      }
    : {
        mode: "owner",
        classId,
        subjectId,
        capabilities: ownerCapabilities,
      };

  useEffect(() => {
    if (isGuestMode && selectedSubject?.kkm !== undefined) {
      setGuestKkm(selectedSubject.kkm);
    }
  }, [isGuestMode, selectedSubject?.kkm]);

  useEffect(() => {
    if (!isGuestMode || !subjectId) return;

    const invalidateGuestData = () => {
      queryClient.invalidateQueries({ queryKey: ["guest_grade_input", token] });
    };

    const channel = supabase
      .channel(`guest-grade-input-${subjectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grades", filter: `subject_id=eq.${subjectId}` },
        invalidateGuestData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chapters", filter: `subject_id=eq.${subjectId}` },
        invalidateGuestData
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subjects", filter: `id=eq.${subjectId}` },
        invalidateGuestData
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isGuestMode, queryClient, subjectId, token]);

  useEffect(() => {
    if (!isGuestMode || !guestData || !guestSession) return;
    if (guestAccessNotifiedRef.current === guestSession.sharedLinkId) return;

    guestAccessNotifiedRef.current = guestSession.sharedLinkId;
    supabase
      .from("notifications")
      .insert({
        user_id: guestData.access.ownerUserId,
        type: "guest_access",
        title: guestSession.isMainTeacher ? "Akses Guru Utama" : "Akses Guru Tamu",
        message: `${guestSession.name} mengakses halaman input nilai`,
        data: {
          guest_name: guestSession.name,
          guest_email: guestSession.email,
          is_main_teacher: Boolean(guestSession.isMainTeacher),
          shared_link_id: guestSession.sharedLinkId,
          subject_name: guestData.subjectInfo?.name,
          class_name: guestData.classInfo?.name,
        },
      })
      .then(({ error }) => {
        if (error) console.error("[Grades] Guest access notification error:", error);
      });
  }, [guestData, guestSession, isGuestMode]);

  const assignmentsByChapter = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {};
    chapters.forEach((chapter) => {
      grouped[chapter.id] = allAssignments.filter((assignment) => assignment.chapter_id === chapter.id);
    });
    return grouped;
  }, [chapters, allAssignments]);

  const filteredStudents = useMemo(() => {
    if (lockedStudentId) {
      const locked = students.find((s) => s.id === lockedStudentId);
      return locked ? [locked] : students;
    }

    if (!searchQuery.trim()) return students;

    const results = fuzzySearchStudents(students, searchQuery, {
      minScore: 55,
      limit: students.length,
    });
    return results.map((r) => r.item);
  }, [students, searchQuery, lockedStudentId]);

  const getGradeValue = useCallback(
    (studentId: string, gradeType: string, assignmentId?: string) => {
      return getScopedGradeValue(
        grades.filter((grade) => grade.student_id === studentId),
        {
          gradeType,
          assignmentId,
          semesterId: isGuestMode ? selectedClass?.semester_id : activeSemesterId,
        },
      );
    },
    [activeSemesterId, grades, isGuestMode, selectedClass?.semester_id]
  );

  const studentAverages = useMemo(() => {
    const averages: Record<string, StudentAverage> = {};
    const semesterId = isGuestMode ? selectedClass?.semester_id : activeSemesterId;

    students.forEach((student) => {
      const report = calculateStudentSubjectReport({
        studentId: student.id,
        subjectId,
        grades,
        chapters,
        assignments: allAssignments,
        semesterId,
        formula,
      });

      averages[student.id] = {
        chaptersAvg: report.chaptersAvg,
        stsAvg: report.stsAvg,
        sasAvg: report.sasAvg,
        final: report.final,
        chapterDetails: report.chapterDetails,
        hasEmptyValues: report.hasEmptyValues,
      };
    });

    return averages;
  }, [activeSemesterId, allAssignments, chapters, formula, grades, isGuestMode, selectedClass?.semester_id, students, subjectId]);

  const handleFormulaChange = useCallback(
    async (nextFormula: CustomFormula) => {
      if (isGuestMode) return;
      try {
        await saveFormula(nextFormula);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Rumus gagal disimpan";
        showError("Gagal menyimpan rumus", message);
      }
    },
    [isGuestMode, saveFormula, showError],
  );

  const handleReportRoundingChange = useCallback(
    async (nextFormula: CustomFormula) => {
      if (isGuestMode) return;
      try {
        await saveFormula(nextFormula);
        success(
          "Pembulatan diterapkan",
          `Aturan pembulatan diterapkan ke ${selectedSubject?.name || "mapel pilihan"}.`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pembulatan rapor gagal disimpan";
        showError("Gagal menyimpan pembulatan", message);
        throw err;
      }
    },
    [isGuestMode, saveFormula, selectedSubject?.name, showError, success],
  );

  const handleReportRoundingApplyToAllSubjects = useCallback(
    async (nextFormula: CustomFormula) => {
      if (isGuestMode) return;
      const subjectIds = subjects.map((subject) => subject.id);
      try {
        await saveRoundingForSubjects({
          subjectIds,
          reportRounding: nextFormula.reportRounding,
        });
        success(
          "Pembulatan diterapkan",
          `Aturan pembulatan diterapkan ke ${subjectIds.length} mapel pada kelas ini.`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : "Pembulatan gagal diterapkan ke seluruh mapel";
        showError("Gagal menyimpan pembulatan", message);
        throw err;
      }
    },
    [isGuestMode, saveRoundingForSubjects, showError, subjects, success],
  );

  const invalidateGuestData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["guest_grade_input", token] });
  }, [queryClient, token]);

  const runGuestRpc = useCallback(
    async (name: string, args: Record<string, unknown>, fallback: string) => {
      const { data, error } = await guestRpcClient.rpc(name, {
        p_token: token,
        ...args,
      });
      if (error) throw new Error(getRpcErrorMessage(error, fallback));
      invalidateGuestData();
      return data;
    },
    [invalidateGuestData, token]
  );

  const handleSaveGrade = async (
    studentId: string,
    gradeType: string,
    value: number | null,
    assignmentId?: string
  ) => {
    if (!subjectId) return;

    const key = `${studentId}-${gradeType}-${assignmentId || ""}`;
    setSavingGrades((prev) => new Set(prev).add(key));

    try {
      if (isGuestMode) {
        await runGuestRpc(
          "guest_upsert_grade",
          {
            p_student_id: studentId,
            p_grade_type: gradeType,
            p_value: value,
            p_assignment_id: assignmentId || null,
          },
          "Gagal menyimpan nilai"
        );
      } else {
        await saveGradeWithUndo(studentId, gradeType, value, assignmentId);
      }
    } catch (err) {
      showError("Gagal menyimpan", getRpcErrorMessage(err, "Terjadi kesalahan saat menyimpan nilai"));
    } finally {
      setSavingGrades((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAddChapters = async (names: string[]) => {
    if (!subjectId) return;

    try {
      if (isGuestMode) {
        await runGuestRpc("guest_create_chapters", { p_names: names }, "Gagal menambahkan BAB");
        return;
      }

      const existingCount = chapters.length;
      const newChapters = names.map((name, i) => ({
        subject_id: subjectId,
        name,
        order_index: existingCount + i + 1,
      }));
      await createBulkChapters.mutateAsync(newChapters);
    } catch (err) {
      if (isGuestMode) showError("Gagal menambahkan BAB", getRpcErrorMessage(err, "Gagal menambahkan BAB"));
    }
  };

  const handleAddAssignments = async (chapterId: string, names: string[]) => {
    try {
      if (isGuestMode) {
        await runGuestRpc(
          "guest_create_assignments",
          { p_chapter_id: chapterId, p_names: names },
          "Gagal menambahkan tugas"
        );
        return;
      }

      const existingCount = assignmentsByChapter[chapterId]?.length || 0;
      const newAssignments = names.map((name, i) => ({
        chapter_id: chapterId,
        name,
        order_index: existingCount + i + 1,
      }));
      await createBulkAssignments.mutateAsync(newAssignments);
    } catch (err) {
      if (isGuestMode) showError("Gagal menambahkan tugas", getRpcErrorMessage(err, "Gagal menambahkan tugas"));
    }
  };

  const handleEnsureImportAssignmentTarget = useCallback(async (target: GradeTarget): Promise<GradeTarget & { createdChapterId?: string; createdAssignmentId?: string }> => {
    if (target.gradeType !== "assignment") return target;
    if (target.assignmentId) return target;
    if (!subjectId) throw new Error("Pilih mata pelajaran terlebih dahulu.");

    const normalize = (value?: string | null) => (value || "").trim().toLowerCase().replace(/\s+/g, " ");
    const assignmentName = target.assignmentName?.trim();
    if (!assignmentName) throw new Error("Nama tugas baru belum diisi.");

    let chapterId = target.chapterId;
    let chapterName = target.chapterName?.trim();
    let createdChapterId: string | undefined;

    if (!chapterId) {
      const requestedChapterName = chapterName;
      if (!requestedChapterName) throw new Error("Nama BAB baru belum diisi.");

      const chapterCache = importChapterCacheRef.current;
      const existingChapter = chapterCache.find((chapter) => normalize(chapter.name) === normalize(requestedChapterName));
      if (existingChapter) {
        chapterId = existingChapter.id;
        chapterName = existingChapter.name;
      } else {
        const nextChapterOrder = chapterCache.reduce((max, chapter) => Math.max(max, chapter.order_index || 0), 0) + 1;
        const createdChapters = await createBulkChapters.mutateAsync([{
          subject_id: subjectId,
          name: requestedChapterName,
          order_index: nextChapterOrder,
        }]);
        const createdChapter = Array.isArray(createdChapters) ? createdChapters[0] as Chapter | undefined : undefined;
        if (!createdChapter?.id) throw new Error("BAB baru gagal dibuat.");
        importChapterCacheRef.current = [...importChapterCacheRef.current, createdChapter];
        chapterId = createdChapter.id;
        chapterName = createdChapter.name;
        createdChapterId = createdChapter.id;
      }
    } else if (!chapterName) {
      chapterName = importChapterCacheRef.current.find((chapter) => chapter.id === chapterId)?.name || chapterName;
    }

    const assignmentCache = importAssignmentCacheRef.current;
    const existingAssignment = assignmentCache.find((assignment) =>
      assignment.chapter_id === chapterId && normalize(assignment.name) === normalize(assignmentName),
    );
    if (existingAssignment) {
      return {
        ...target,
        chapterId,
        chapterName,
        assignmentId: existingAssignment.id,
        assignmentName: existingAssignment.name,
      };
    }

    const chapterAssignments = assignmentCache.filter((assignment) => assignment.chapter_id === chapterId);
    const nextAssignmentOrder = chapterAssignments.reduce((max, assignment) => Math.max(max, assignment.order_index || 0), 0) + 1;
    const createdAssignments = await createBulkAssignments.mutateAsync([{
      chapter_id: chapterId,
      name: assignmentName,
      order_index: nextAssignmentOrder,
    }]);
    const createdAssignment = Array.isArray(createdAssignments) ? createdAssignments[0] as Assignment | undefined : undefined;
    if (!createdAssignment?.id) throw new Error("Tugas baru gagal dibuat.");
    importAssignmentCacheRef.current = [...importAssignmentCacheRef.current, createdAssignment];
    const createdAssignmentId = createdAssignment.id;

    return {
      ...target,
      chapterId,
      chapterName,
      assignmentId: createdAssignment.id,
      assignmentName: createdAssignment.name,
      createdChapterId,
      createdAssignmentId,
    };
  }, [createBulkAssignments, createBulkChapters, subjectId]);

  const handleRollbackCreatedImportStructure = useCallback(async ({ assignmentIds, chapterIds }: { assignmentIds: string[]; chapterIds: string[] }) => {
    for (const assignmentId of assignmentIds) {
      await deleteAssignment.mutateAsync(assignmentId);
      importAssignmentCacheRef.current = importAssignmentCacheRef.current.filter((assignment) => assignment.id !== assignmentId);
    }
    for (const chapterId of chapterIds) {
      await deleteChapter.mutateAsync(chapterId);
      importChapterCacheRef.current = importChapterCacheRef.current.filter((chapter) => chapter.id !== chapterId);
    }
  }, [deleteAssignment, deleteChapter]);

  const handleUpdateChapter = async (id: string, name: string) => {
    try {
      if (isGuestMode) {
        await runGuestRpc(
          "guest_update_chapter",
          { p_chapter_id: id, p_name: name },
          "Gagal memperbarui BAB"
        );
        return;
      }
      await updateChapter.mutateAsync({ id, name });
    } catch (err) {
      if (isGuestMode) showError("Gagal memperbarui BAB", getRpcErrorMessage(err, "Gagal memperbarui BAB"));
    }
  };

  const handleUpdateAssignment = async (id: string, name: string) => {
    try {
      if (isGuestMode) {
        await runGuestRpc(
          "guest_update_assignment",
          { p_assignment_id: id, p_name: name },
          "Gagal memperbarui tugas"
        );
        return;
      }
      await updateAssignment.mutateAsync({ id, name });
    } catch (err) {
      if (isGuestMode) showError("Gagal memperbarui tugas", getRpcErrorMessage(err, "Gagal memperbarui tugas"));
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      if (isGuestMode) {
        await runGuestRpc(
          "guest_delete_assignment",
          { p_assignment_id: id },
          "Gagal menghapus tugas"
        );
        return;
      }
      await deleteAssignment.mutateAsync(id);
    } catch (err) {
      if (isGuestMode) showError("Gagal menghapus tugas", getRpcErrorMessage(err, "Gagal menghapus tugas"));
    }
  };

  const handleDeleteChapter = async (id: string) => {
    try {
      if (isGuestMode) {
        await runGuestRpc("guest_delete_chapter", { p_chapter_id: id }, "Gagal menghapus BAB");
        return;
      }
      await deleteChapter.mutateAsync(id);
    } catch (err) {
      if (isGuestMode) showError("Gagal menghapus BAB", getRpcErrorMessage(err, "Gagal menghapus BAB"));
    }
  };

  const handleUpdateGuestKkm = async () => {
    if (!access.capabilities.canUpdateKkm) return;
    if (Number.isNaN(guestKkm) || guestKkm < 0 || guestKkm > 100) {
      showError("KKM tidak valid", "KKM harus berada di rentang 0 sampai 100");
      return;
    }

    try {
      await runGuestRpc("guest_update_subject_kkm", { p_kkm: guestKkm }, "Gagal memperbarui KKM");
      setShowGuestKkmDialog(false);
      success("Berhasil", "KKM berhasil diperbarui");
    } catch (err) {
      showError("Gagal memperbarui KKM", getRpcErrorMessage(err, "Gagal memperbarui KKM"));
    }
  };

  const handleGuestLogout = () => {
    sessionStorage.removeItem("guest_session");
    navigate("/", { replace: true });
  };

  const refreshGuestData = async () => {
    await guestQuery.refetch();
    success("Berhasil", "Data berhasil dimuat ulang");
  };

  const isLoading = isGuestMode
    ? !guestSessionChecked || guestQuery.isLoading
    : classesLoading || studentsLoading || subjectsLoading || gradesLoading || chaptersLoading || assignmentsLoading || formulaLoading;
  const hasNoClasses = !isGuestMode && !classesLoading && classes.length === 0;
  const hasNoChapters = !chaptersLoading && chapters.length === 0 && subjectId;
  const kkm = selectedSubject?.kkm || 70;
  const hasChaptersWithAssignments = chapters.length > 0 && chapters.some(
    (chapter) => (assignmentsByChapter[chapter.id]?.length || 0) > 0
  );

  const prepareTourTab = useCallback((tab: "structure" | "input") => new Promise<void>((resolve) => {
    handleActiveTabChange(tab);
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }), [handleActiveTabChange]);

  const gradeTourSteps = useMemo<TourStep[]>(() => {
    const steps: TourStep[] = [];

    if (isGuestMode) {
      steps.push({
        target: "[data-tour='guest-info']",
        title: "Akses Guru Tamu",
        description: "Kelas, mata pelajaran, dan kemampuan Anda mengikuti link akses dari guru utama.",
      });
    } else {
      steps.push(
        {
          target: "[data-tour='class-select']",
          title: "Pilih Kelas",
          description: "Pilih kelas tujuan. Daftar siswa dan mata pelajaran akan mengikuti kelas ini.",
        },
        {
          target: "[data-tour='subject-select']",
          title: "Pilih Mata Pelajaran",
          description: "Pilih mata pelajaran beserta KKM yang akan digunakan dalam perhitungan nilai.",
        },
      );
    }

    steps.push({
      target: "[data-tour='structure-tab']",
      title: "Struktur BAB dan Tugas",
      description: "Atur BAB dan tugas terlebih dahulu agar kolom nilai tersusun dengan benar.",
      prepare: () => prepareTourTab("structure"),
    });

    if (chapters.length === 0) {
      steps.push({
        target: "[data-tour='grade-add-chapter']",
        title: "Tambahkan BAB",
        description: "Buat satu atau beberapa BAB, lalu tambahkan tugas pada BAB yang sesuai.",
        prepare: () => prepareTourTab("structure"),
      });
    } else {
      steps.push(
        {
          target: "[data-tour='grade-chapter-card']",
          title: "Identitas Setiap BAB",
          description: "Aksen dan label BAB membedakan kelompok materi beserta jumlah tugasnya.",
          prepare: () => prepareTourTab("structure"),
        },
        {
          target: "[data-tour='grade-chapter-actions']",
          title: "Aksi Khusus BAB",
          description: "Gunakan aksi ini hanya untuk mengganti nama atau menghapus seluruh BAB.",
          prepare: () => prepareTourTab("structure"),
        },
      );
    }

    steps.push({
      target: "[data-tour='input-tab']",
      title: "Input Nilai",
      description: "Nilai disimpan otomatis. Gunakan Enter untuk menyimpan dan berpindah ke siswa berikutnya.",
      prepare: () => prepareTourTab("input"),
    });

    if (students.length > 0) {
      steps.push(
        {
          target: "[data-tour='grade-table']",
          title: "Spreadsheet Nilai",
          description: "Geser tabel, ubah lebar kolom dari batas header, dan gunakan warna nilai untuk memeriksa ketuntasan.",
          prepare: () => prepareTourTab("input"),
        },
        {
          target: "[data-tour='grade-card-actions']",
          title: "Kelola dan Periksa Nilai",
          description: "Import, ekspor, rumus, pembulatan, dan pencarian siswa tersedia di area ini.",
          prepare: () => prepareTourTab("input"),
        },
        {
          target: "[data-tour='grade-fullscreen-control']",
          title: "Layar Penuh",
          description: "Pilih Layar Penuh Browser atau Layar Penuh Maksimal. Panduan khusus tersedia setelah fullscreen dibuka.",
          prepare: () => prepareTourTab("input"),
        },
      );
    }

    return steps;
  }, [chapters.length, isGuestMode, prepareTourTab, students.length]);

  const searchAction = (
    <SmartStudentSearch
      students={students}
      onFilter={() => {}}
      onSelectionChange={(student) => setLockedStudentId(student?.id ?? null)}
      onSearchQueryChange={(query) => setSearchQuery(query)}
      placeholder="Cari siswa AI..."
      showSuggestions={true}
      className="w-full min-w-0 sm:w-64 lg:w-60"
    />
  );

  const gradeManageDropdownTapGuard = useCoarsePointerTapGuard<HTMLButtonElement>({
    onValidTap: () => setShowGradeManageMenu((current) => !current),
  });

  const runAfterGradeManageMenuCloses = useCallback((action: () => void) => {
    setShowGradeManageMenu(false);
    if (typeof window === "undefined") {
      action();
      return;
    }
    window.requestAnimationFrame(action);
  }, []);

  const ownerToolbarActions = classId && subjectId ? (
    <>
      <div className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--manage min-w-0">
      <DropdownMenu open={showGradeManageMenu} onOpenChange={setShowGradeManageMenu}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="sipena-grade-action-button h-9 min-w-[44px] w-full sm:w-auto select-none gap-1.5 text-xs"
            aria-label="Kelola file nilai"
            onPointerDown={gradeManageDropdownTapGuard.onPointerDown}
            onPointerMove={gradeManageDropdownTapGuard.onPointerMove}
            onPointerCancel={gradeManageDropdownTapGuard.onPointerCancel}
            onPointerUp={gradeManageDropdownTapGuard.onPointerUp}
            onClick={gradeManageDropdownTapGuard.onClick}
            style={{ touchAction: "pan-x pan-y" }}
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="sipena-grade-action-text hidden sm:inline">Kelola Nilai</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">Import / Ekspor</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => runAfterGradeManageMenuCloses(() => {
              setGradeImportExportTab("import");
              setShowGradeImportExport(true);
            })}
            className="gap-2 min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Nilai
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAfterGradeManageMenuCloses(() => {
              setGradeImportExportTab("export");
              setShowGradeImportExport(true);
            })}
            className="gap-2 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Ekspor Nilai Saat Ini
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAfterGradeManageMenuCloses(() => void handleDownloadOfficialTemplate())}
            disabled={!canDownloadGradeTemplate || isDownloadingOfficialTemplate}
            className="gap-2 min-h-[44px]"
          >
            {isDownloadingOfficialTemplate ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
            Download Template Resmi
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => runAfterGradeManageMenuCloses(() => setShowOCRGrades(true))} className="gap-2 min-h-[44px]">
            <Camera className="w-4 h-4" />
            Import dari Foto (OCR) <Badge className="ml-auto bg-amber-500 text-amber-950">BETA</Badge>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">Backup / Restore</DropdownMenuLabel>
          <DropdownMenuItem
            onSelect={() => runAfterGradeManageMenuCloses(handleOpenGradeBackupOptions)}
            disabled={isExportingGradeBackup || !gradeBackupRestoreContext}
            className="gap-2 min-h-[44px]"
          >
            {isExportingGradeBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Buat Backup Lengkap
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() => runAfterGradeManageMenuCloses(() => setShowGradeBackupRestore(true))}
            disabled={!gradeBackupRestoreContext}
            className="gap-2 min-h-[44px]"
          >
            <ArchiveRestore className="w-4 h-4" />
            Restore dari Backup
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      </div>
      <div className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--formula min-w-0">
      <FormulaSettings
        formula={formula}
        onFormulaChange={handleFormulaChange}
        hasChapters={hasChaptersWithAssignments}
        triggerClassName="sipena-grade-action-button h-9 w-full sm:w-auto"
      />
      </div>
      <div className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--rounding min-w-0 col-span-2 sm:col-span-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowReportRoundingSettings(true)}
        disabled={formulaSaving}
        className="sipena-grade-action-button h-9 w-full sm:w-auto gap-2"
      >
        <Percent className="w-4 h-4" />
        <span className="sipena-grade-action-text">Pembulatan</span>
        <Badge variant="secondary" className="sipena-grade-rounding-badge ml-0.5 text-[10px]">
          {getReportRoundingLabel(formula.reportRounding.mode)} - {getReportRoundingTargetLabel(formula.reportRounding.target)}
        </Badge>
      </Button>
      </div>
      {formulaSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground col-span-2 sm:col-span-1" />}
      <div data-tour="grade-search-control" className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--search min-w-0 col-span-2 sm:col-span-1">{searchAction}</div>
    </>
  ) : null;

  const guestToolbarActions = (
    <>
      <div className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--secondary min-w-0">
      <Button variant="outline" size="sm" className="sipena-grade-action-button h-9 w-full sm:w-auto" onClick={refreshGuestData} disabled={guestQuery.isFetching}>
        <RefreshCw className={`w-4 h-4 mr-2 ${guestQuery.isFetching ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Muat Ulang</span>
      </Button>
      </div>
      <div className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--secondary min-w-0">
      <Button variant="outline" size="sm" className="sipena-grade-action-button h-9 w-full sm:w-auto" onClick={() => setShowGuestKkmDialog(true)}>
        <Settings className="w-4 h-4 mr-2" />
        KKM: {kkm}
      </Button>
      </div>
      <div data-tour="grade-search-control" className="sipena-grade-toolbar-slot sipena-grade-toolbar-slot--search min-w-0 col-span-2 sm:col-span-1">{searchAction}</div>
    </>
  );

  const gradeToolbarActions = isGuestMode ? guestToolbarActions : ownerToolbarActions;

  if (isGuestMode && guestSessionChecked && (!token || !guestSession)) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <X className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Akses Tidak Valid</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Sesi Anda tidak valid atau telah berakhir. Silakan minta link akses baru dari wali kelas.
            </p>
            <Button onClick={() => navigate("/", { replace: true })}>Kembali ke Beranda</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isGuestMode && guestQuery.isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <X className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle>Akses Tidak Valid</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              {getRpcErrorMessage(guestQuery.error, "Sesi Anda tidak valid atau telah berakhir.")}
            </p>
            <Button onClick={() => navigate(`/share?token=${token}`, { replace: true })}>
              Masuk Ulang
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <div className="app-page app-page-wide sipena-grade-page overflow-x-clip">
        <PageHeader
          icon={<FileSpreadsheet className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
          title={isGuestMode ? "Input Nilai Guru Tamu" : "Input Nilai"}
          subtitle={
            isGuestMode
              ? "Akses input nilai terbatas sesuai link guru tamu"
              : "Pilih kelas dan mata pelajaran untuk menginput nilai siswa"
          }
          breadcrumbs={[
            { label: "Input Nilai" },
            ...(isGuestMode ? [{ label: "Guru Tamu" }] : []),
            ...(selectedClass ? [{ label: selectedClass.name }] : []),
            ...(selectedSubject ? [{ label: selectedSubject.name }] : []),
          ]}
          actions={
            <div className="flex items-center gap-2">
              <TourButton tourKey={isGuestMode ? "guest-grades" : "grades"} />
              {isGuestMode && (
                <Button variant="outline" size="sm" onClick={handleGuestLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">Keluar</span>
                </Button>
              )}
            </div>
          }
        />

        {isGuestMode && selectedClass && selectedSubject && (
          <Alert data-tour="guest-info">
            <UserCheck className="h-4 w-4" />
            <AlertDescription>
              <div className="flex flex-wrap items-center gap-2">
                <span>Anda masuk sebagai</span>
                <Badge variant="secondary">{guestSession?.name || "Guru Tamu"}</Badge>
                <span>untuk</span>
                <Badge variant="secondary" className="gap-1">
                  <BookOpen className="w-3 h-3" />
                  <span className="truncate max-w-[160px]">{selectedSubject.name}</span>
                </Badge>
                <span>di kelas</span>
                <Badge variant="secondary" className="gap-1">
                  <Users className="w-3 h-3" />
                  {selectedClass.name}
                </Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {hasNoClasses && (
          <Alert className="animate-fade-in-up">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Buat kelas dan tambahkan siswa terlebih dahulu.</span>
              <Button variant="outline" size="sm" onClick={() => navigate("/classes")}>
                Buat Kelas <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {!isGuestMode && !hasNoClasses && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-fade-in-up delay-100">
            <div data-tour="class-select" className="rounded-2xl bg-card border border-border overflow-hidden p-3 sm:p-3.5">
              <Select
                value={selectedClassId}
                onValueChange={(value) => {
                  setSelectedClassId(value);
                  setSelectedSubjectId("");
                  setLockedStudentId(null);
                  setSearchQuery("");
                }}
              >
                <SelectTrigger className="h-10 sm:h-12 border-0 shadow-none">
                  <div className="flex items-center gap-2 text-sm sm:text-base">
                    <School className="w-4 h-4 text-muted-foreground" />
                    <SelectValue placeholder="Pilih Kelas" />
                  </div>
                </SelectTrigger>
                <SelectContent isEmpty={!classesLoading && classes.length === 0} emptyLabel="Tidak ada pilihan Kelas">
                  {classes.map((cls) => (
                    <SelectItem key={cls.id} value={cls.id}>
                      {cls.name} ({cls.student_count || 0} siswa)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div data-tour="subject-select" className="rounded-2xl bg-card border border-border overflow-hidden p-3 sm:p-3.5">
              <Select
                value={selectedSubjectId}
                onValueChange={(value) => {
                  if (value === "__add_new__") {
                    navigate(`/subjects?classId=${selectedClassId}`);
                  } else {
                    setSelectedSubjectId(value);
                  }
                }}
                disabled={!selectedClassId}
              >
                <SelectTrigger className="h-10 sm:h-12 border-0 shadow-none">
                  <div className="flex items-center gap-2 text-sm sm:text-base">
                    <BookOpen className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <SelectValue placeholder={subjects.length === 0 ? "Belum ada mapel" : "Pilih Mata Pelajaran"} />
                  </div>
                </SelectTrigger>
                <SelectContent isEmpty={!subjectsLoading && subjects.length === 0} emptyLabel="Tidak ada pilihan Mata Pelajaran">
                  {subjects.map((subject) => (
                    <SelectItem key={subject.id} value={subject.id}>
                      {subject.name} (KKM: {subject.kkm})
                    </SelectItem>
                  ))}
                  <SelectItem value="__add_new__" className="text-primary font-medium border-t mt-1 pt-2">
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4" />
                      Tambah Mapel Baru
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {subjectId && (
          <Tabs
            ref={gradeTabsRef}
            value={activeTab}
            onValueChange={handleActiveTabChange}
            data-active-tab={activeTab}
            className="sipena-grade-tabs animate-fade-in-up delay-200"
          >
            <TabsList aria-label="Mode halaman input nilai" className="sipena-grade-mode-tabs grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="structure" className="sipena-grade-mode-tab gap-2" data-tour="structure-tab">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Struktur</span> BAB
              </TabsTrigger>
              <TabsTrigger value="input" className="sipena-grade-mode-tab gap-2" data-tour="input-tab">
                <FileSpreadsheet className="w-4 h-4" />
                Input Nilai
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="sipena-grade-tab-panel mt-0">
              <ChapterStructure
                className="rounded-none border-0 shadow-none"
                chapters={chapters}
                assignments={assignmentsByChapter}
                subjectName={selectedSubject?.name || ""}
                onAddChapters={handleAddChapters}
                onAddAssignments={handleAddAssignments}
                onUpdateChapter={handleUpdateChapter}
                onUpdateAssignment={handleUpdateAssignment}
                onDeleteChapter={handleDeleteChapter}
                onDeleteAssignment={handleDeleteAssignment}
                isLoading={isGuestMode ? guestQuery.isLoading : chaptersLoading}
              />
            </TabsContent>

            <TabsContent value="input" className="sipena-grade-tab-panel mt-0 space-y-4">
              {hasNoChapters && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Tambahkan BAB dan tugas terlebih dahulu.</span>
                    <Button variant="outline" size="sm" onClick={() => handleActiveTabChange("structure")}>
                      Tambah BAB <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {classId && !studentsLoading && students.length === 0 && (
                <EmptyStudentsState isGuestMode={isGuestMode} classId={classId} />
              )}

              {students.length > 0 && (
                <Card className="w-full min-w-0 overflow-visible rounded-none border-0 shadow-none" data-tour="grade-table">
                  <CardHeader className="sipena-grade-card-header relative z-30 bg-card px-3 pb-3 sm:px-6 border-b border-border/50">
                    <div className="sipena-grade-card-header-grid flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                      <div className="sipena-grade-card-heading flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                        <CardTitle className="sipena-grade-card-title text-sm sm:text-base truncate">
                          {selectedClass?.name} - {selectedSubject?.name}
                        </CardTitle>
                        <Badge variant="pass" className="gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-Save
                        </Badge>
                      </div>
                      <div data-tour="grade-card-actions" className="sipena-grade-card-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:w-auto sm:justify-end w-full">
                        {!isFullscreen && gradeToolbarActions}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="relative z-0 min-w-0 overflow-hidden p-0">
                    <div className="sipena-grade-table-shell h-[70dvh] min-h-[420px] overflow-hidden">
                      <SpreadsheetTable
                        students={filteredStudents}
                        chapters={chapters}
                        assignmentsByChapter={assignmentsByChapter}
                        studentAverages={studentAverages}
                        kkm={kkm}
                        getGradeValue={getGradeValue}
                        onSaveGrade={handleSaveGrade}
                        savingGrades={savingGrades}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        isFullscreen={false}
                        onClose={() => {}}
                        className={selectedClass?.name || ""}
                        subjectName={selectedSubject?.name || ""}
                        canUndo={isGuestMode ? false : canUndo}
                        canRedo={isGuestMode ? false : canRedo}
                        onUndo={isGuestMode ? undefined : undo}
                        onRedo={isGuestMode ? undefined : redo}
                        onEnterFullscreen={openAppFullscreen}
                        onEnterBrowserFullscreen={openBrowserFullscreen}
                        toolbarExtra={null}
                        tableColorScheme={gradeTableColorScheme}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {isFullscreen && (
        <SpreadsheetTable
          students={filteredStudents}
          chapters={chapters}
          assignmentsByChapter={assignmentsByChapter}
          studentAverages={studentAverages}
          kkm={kkm}
          getGradeValue={getGradeValue}
          onSaveGrade={handleSaveGrade}
          savingGrades={savingGrades}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFullscreen={true}
          fullscreenMode={fullscreenMode}
          onClose={closeGradeFullscreen}
          className={selectedClass?.name || ""}
          subjectName={selectedSubject?.name || ""}
          canUndo={isGuestMode ? false : canUndo}
          canRedo={isGuestMode ? false : canRedo}
          onUndo={isGuestMode ? undefined : undo}
          onRedo={isGuestMode ? undefined : redo}
          toolbarExtra={gradeToolbarActions}
          fullscreenTourKey={isGuestMode ? "guest-grades-fullscreen" : "grades-fullscreen"}
          tableColorScheme={gradeTableColorScheme}
        />
      )}

      <ProductTour
        steps={gradeTourSteps}
        tourKey={isGuestMode ? "guest-grades" : "grades"}
        requireOnboarding={!isGuestMode}
        shouldAutoStart={isGuestMode ? false : shouldShowTours}
      />

      {isFullscreen && (
        <ProductTour
          steps={fullscreenGradesTourSteps}
          tourKey={isGuestMode ? "guest-grades-fullscreen" : "grades-fullscreen"}
          requireOnboarding
          shouldAutoStart={false}
        />
      )}

      {!isGuestMode && selectedSubjectId && selectedClassId && (
        <GradeImportExportDialog
          open={showGradeImportExport}
          onOpenChange={setShowGradeImportExport}
          activeTab={gradeImportExportTab}
          onTabChange={setGradeImportExportTab}
          classNameLabel={selectedClass?.name || ""}
          subjectName={selectedSubject?.name || ""}
          semesterName={activeSemester?.name || null}
          studentCount={students.length}
          chapterCount={chapters.length}
          assignmentCount={allAssignments.length}
          canDownloadOfficialTemplate={canDownloadGradeTemplate}
          isDownloadingTemplate={isDownloadingOfficialTemplate}
          onDownloadOfficialTemplate={handleDownloadOfficialTemplate}
          isExportingCurrentGrades={isExportingCurrentGrades}
          isExportingBackup={isExportingGradeBackup}
          onDownloadCurrentGrades={handleDownloadCurrentGrades}
          onDownloadBackup={handleOpenGradeBackupOptions}
          onSaveGrade={handleSaveGrade}
          onSaveGradesBatch={async (items) => saveGradesBatchWithUndo(items)}
          onEnsureAssignmentTarget={handleEnsureImportAssignmentTarget}
          onRollbackCreatedImportStructure={handleRollbackCreatedImportStructure}
          canUndoImport={canUndo}
          canRedoImport={canRedo}
          onUndoImport={undo}
          onRedoImport={redo}
          onImportComplete={handleRestoreComplete}
          importContext={gradeImportContext}
        />
      )}

      {!isGuestMode && (
        <Dialog open={showGradeBackupOptions} onOpenChange={(nextOpen) => {
          if (isExportingGradeBackup) return;
          setShowGradeBackupOptions(nextOpen);
        }}>
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle>Konfirmasi Backup Lengkap Nilai</DialogTitle>
              <DialogDescription>
                Tentukan cara file backup ini dipakai saat restore. Backup tetap menyimpan metadata siswa, struktur, konteks, dan nilai mentah web.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Jika perlindungan metadata aktif, perubahan manual pada sheet <span className="font-semibold">Nilai</span> di Excel tidak akan dipakai saat restore. SIPENA akan memakai nilai dari metadata <span className="font-semibold">_grades</span>.
                </AlertDescription>
              </Alert>
              <label className="flex cursor-pointer gap-3 rounded-xl border bg-muted/20 p-4 transition hover:bg-muted/40">
                <Checkbox
                  checked={protectGradeBackupMetadata}
                  onCheckedChange={(checked) => setProtectGradeBackupMetadata(checked === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1">
                  <span className="block font-semibold">Lindungi restore dengan metadata</span>
                  <span className="block text-sm text-muted-foreground">
                    Aktifkan jika backup ini harus menjadi arsip final yang tidak berubah walau nilai di sheet Nilai diedit. Nonaktifkan jika Anda ingin sheet Nilai bisa diedit lalu dipakai sebagai override saat restore.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3 text-sm text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-100">
                {protectGradeBackupMetadata
                  ? "Mode aktif: Restore memakai metadata _grades. Edit manual di sheet Nilai hanya menjadi catatan visual di Excel."
                  : "Mode aktif: Metadata tetap melindungi identitas dan struktur, tetapi nilai yang diedit di sheet Nilai akan dideteksi sebagai nilai restore."}
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setShowGradeBackupOptions(false)} disabled={isExportingGradeBackup}>
                Batal
              </Button>
              <Button type="button" onClick={handleDownloadGradeBackup} disabled={isExportingGradeBackup}>
                {isExportingGradeBackup ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                Download Backup
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {!isGuestMode && selectedSubjectId && selectedClassId && gradeBackupRestoreContext && (
        <GradeBackupRestoreDialog
          open={showGradeBackupRestore}
          onOpenChange={setShowGradeBackupRestore}
          restoreContext={gradeBackupRestoreContext}
          onRestoreBatch={async (items) => saveGradesBatchWithUndo(items)}
          canUndoRestore={canUndo}
          onUndoRestore={undo}
          onRestoreComplete={handleRestoreComplete}
        />
      )}

      {!isGuestMode && selectedSubjectId && selectedClassId && (
        <ReportRoundingSettingsDialog
          open={showReportRoundingSettings}
          onOpenChange={setShowReportRoundingSettings}
          formula={formula}
          onFormulaChange={handleReportRoundingChange}
          onApplyToAllSubjects={handleReportRoundingApplyToAllSubjects}
          isSaving={formulaSaving}
          isSavingAllSubjects={isSavingRoundingForSubjects}
          subjectName={selectedSubject?.name || "mapel pilihan"}
          subjectCount={subjects.length}
        />
      )}

      {!isGuestMode && (
        <OCRImportDialog
          open={showOCRGrades}
          onOpenChange={setShowOCRGrades}
          type="grades"
          title="Import Nilai dari Foto"
          description="Baca tabel nilai dari maksimal 5 foto, petakan kolom tugas, lalu periksa setiap nilai sebelum disimpan."
          context={{
            kind: "grades",
            targetClassId: selectedClassId,
            targetClassName: selectedClass?.name,
            targetSubjectId: selectedSubjectId,
            targetSubjectName: selectedSubject?.name,
            students: students.map((student) => ({ id: student.id, name: student.name, nisn: student.nisn })),
            assignments: allAssignments.map((assignment) => ({ id: assignment.id, name: assignment.name })),
            existingGrades: grades.flatMap((grade) => grade.assignment_id ? [{
              studentId: grade.student_id,
              assignmentId: grade.assignment_id,
              value: grade.value,
            }] : []),
          }}
          onConfirmImport={async (plan) => {
            if (!selectedSubjectId || !selectedClassId) return { success: 0, skipped: plan.rows.length, failed: 0, message: "Pilih kelas dan mata pelajaran terlebih dahulu." };
            const existing = new Set(grades.filter((grade) => grade.assignment_id && grade.value !== null).map((grade) => `${grade.student_id}:${grade.assignment_id}`));
            const gradeColumns = plan.columns.flatMap((column, index) => column.semantic === "grade" && column.targetId ? [{ ...column, index }] : []);
            const batch = plan.rows.flatMap((row) => {
              if (!row.included || !row.targetStudentId || row.issues.some((issue) => issue.severity === "error")) return [];
              return gradeColumns.flatMap((column) => {
                const rawValue = row.values[column.index]?.trim();
                if (!rawValue || existing.has(`${row.targetStudentId}:${column.targetId}`)) return [];
                const value = Number(rawValue.replace(",", "."));
                if (!Number.isFinite(value) || value < 0 || value > 100) return [];
                return [{
                  studentId: row.targetStudentId,
                  gradeType: "assignment",
                  assignmentId: column.targetId,
                  academicYearId: activeYear?.id || null,
                  semesterId: activeSemesterId || selectedClass?.semester_id || null,
                  value,
                }];
              });
            });
            const result = await saveGradesBatchWithUndo(batch);
            await queryClient.invalidateQueries({ queryKey: ["grades"] });
            return {
              success: result.savedCount,
              skipped: Math.max(0, plan.rows.length * Math.max(gradeColumns.length, 1) - result.savedCount),
              failed: 0,
              message: `${result.savedCount} nilai disimpan sebagai satu riwayat undo.`,
            };
          }}
        />
      )}

      {isGuestMode && (
        <Dialog open={showGuestKkmDialog} onOpenChange={setShowGuestKkmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Atur KKM</DialogTitle>
              <DialogDescription>Kriteria Ketuntasan Minimal untuk mata pelajaran ini</DialogDescription>
            </DialogHeader>
            <Input
              type="number"
              min={0}
              max={100}
              value={guestKkm}
              onChange={(event) => setGuestKkm(Number(event.target.value))}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowGuestKkmDialog(false)}>
                Batal
              </Button>
              <Button onClick={handleUpdateGuestKkm}>Simpan</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

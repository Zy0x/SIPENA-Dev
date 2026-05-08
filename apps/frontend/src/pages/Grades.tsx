import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Loader2,
  LogOut,
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
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { fuzzySearchStudents } from "@/lib/fuzzySearch";
import { getScopedGradeValue } from "@/lib/gradeValueSelection";
import { useGradeFormulaSettings, type GradeFormulaSetting } from "@/hooks/useGradeFormulaSettings";
import { calculateStudentSubjectReport } from "@/lib/gradeReportEngine";
import { DEFAULT_FORMULA, normalizeFormula, type CustomFormula } from "@/lib/gradeFormula";
import { downloadOfficialGradeTemplate, type ImportPlanContext } from "@/lib/gradeImport";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import { SmartStudentSearch } from "@/components/grades/SmartStudentSearch";
import { ChapterStructure } from "@/components/grades/ChapterStructure";
import { SpreadsheetTable } from "@/components/grades/SpreadsheetTable";
import { EmptyStudentsState } from "@/components/grades/EmptyStudentsState";
import GradeImportExportDialog, { type GradeImportExportTab } from "@/components/grades/GradeImportExportDialog";
import {
  FormulaSettings,
} from "@/components/grades/FormulaSettings";
import ImportGradesDialog from "@/components/import/ImportGradesDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";

export type GradeInputMode = "owner" | "guest";

interface GradesProps {
  mode?: GradeInputMode;
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

const gradesTourSteps = [
  {
    target: "[data-tour='class-select']",
    title: "Pilih Kelas",
    description: "Pilih kelas yang akan diinput nilainya.",
  },
  {
    target: "[data-tour='subject-select']",
    title: "Pilih Mata Pelajaran",
    description: "Pilih mata pelajaran setelah memilih kelas.",
  },
  {
    target: "[data-tour='structure-tab']",
    title: "Struktur BAB",
    description: "Buat struktur BAB dan tugas sebelum input nilai.",
  },
  {
    target: "[data-tour='input-tab']",
    title: "Input Nilai",
    description: "Tab untuk menginput nilai siswa. Nilai tersimpan otomatis.",
  },
];

const guestGradesTourSteps = [
  {
    target: "[data-tour='guest-info']",
    title: "Akses Guru Tamu",
    description: "Mata pelajaran dan kelas dikunci dari link akses.",
  },
  {
    target: "[data-tour='structure-tab']",
    title: "Struktur BAB",
    description: "Kelola BAB dan tugas untuk input nilai.",
  },
  {
    target: "[data-tour='input-tab']",
    title: "Input Nilai",
    description: "Input nilai siswa dengan tabel yang sama seperti guru utama.",
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
  const { success, error: showError } = useEnhancedToast();
  const { shouldShowTours } = useUserPreferences();

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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showGradeImportExport, setShowGradeImportExport] = useState(false);
  const [gradeImportExportTab, setGradeImportExportTab] = useState<GradeImportExportTab>("import");
  const [isDownloadingOfficialTemplate, setIsDownloadingOfficialTemplate] = useState(false);
  const [showImportGrades, setShowImportGrades] = useState(false);
  const [showOCRGrades, setShowOCRGrades] = useState(false);
  const [showGuestKkmDialog, setShowGuestKkmDialog] = useState(false);
  const [guestKkm, setGuestKkm] = useState(75);

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
    undo,
    redo,
    canUndo,
    canRedo,
  } = useGradesWithUndo(isGuestMode ? "" : selectedSubjectId);
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
  const {
    formula: ownerFormula,
    saveFormula,
    isLoading: formulaLoading,
    isSaving: formulaSaving,
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
      })),
    classId,
    subjectId,
    semesterId: activeSemesterId,
    academicYearId: activeYear?.id || selectedClass?.academic_year_id || selectedSubject?.academic_year_id || null,
  }), [
    activeSemesterId,
    activeYear?.id,
    allAssignments,
    chapters,
    classId,
    grades,
    selectedClass?.academic_year_id,
    selectedSubject?.academic_year_id,
    students,
    subjectId,
  ]);
  const handleDownloadOfficialTemplate = useCallback(() => {
    if (!selectedClass || !selectedSubject) {
      showError("Template belum siap", "Pilih kelas dan mata pelajaran terlebih dahulu.");
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

  const searchAction = (
    <SmartStudentSearch
      students={students}
      onFilter={() => {}}
      onSelectionChange={(student) => setLockedStudentId(student?.id ?? null)}
      onSearchQueryChange={(query) => setSearchQuery(query)}
      placeholder="Cari siswa AI..."
      showSuggestions={true}
      className="w-48 sm:w-56"
    />
  );

  const ownerToolbarActions = classId && subjectId ? (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 min-w-[44px]">
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Import/Export</span>
            <ChevronDown className="w-3 h-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setGradeImportExportTab("import");
              setShowGradeImportExport(true);
            }}
            className="gap-2 min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Import Nilai
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              setGradeImportExportTab("export");
              setShowGradeImportExport(true);
            }}
            className="gap-2 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            Export Nilai
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowImportGrades(true)} className="gap-2 min-h-[44px]">
            <FileSpreadsheet className="w-4 h-4" />
            Import dari Excel Lama
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setShowOCRGrades(true)} className="gap-2 min-h-[44px]">
            <Camera className="w-4 h-4" />
            Import dari Foto (OCR)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <FormulaSettings
        formula={formula}
        onFormulaChange={handleFormulaChange}
        hasChapters={hasChaptersWithAssignments}
      />
      {formulaSaving && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
      {searchAction}
    </>
  ) : null;

  const guestToolbarActions = (
    <>
      <Button variant="outline" size="sm" onClick={refreshGuestData} disabled={guestQuery.isFetching}>
        <RefreshCw className={`w-4 h-4 mr-2 ${guestQuery.isFetching ? "animate-spin" : ""}`} />
        <span className="hidden sm:inline">Muat Ulang</span>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowGuestKkmDialog(true)}>
        <Settings className="w-4 h-4 mr-2" />
        KKM: {kkm}
      </Button>
      {searchAction}
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
      <div className="app-page app-page-wide">
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
                <SelectContent>
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
                <SelectContent>
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
          <Tabs value={activeTab} onValueChange={setActiveTab} className="animate-fade-in-up delay-200">
            <TabsList className="grid w-full max-w-sm grid-cols-2">
              <TabsTrigger value="structure" className="gap-2" data-tour="structure-tab">
                <Settings className="w-4 h-4" />
                <span className="hidden sm:inline">Struktur</span> BAB
              </TabsTrigger>
              <TabsTrigger value="input" className="gap-2" data-tour="input-tab">
                <FileSpreadsheet className="w-4 h-4" />
                Input Nilai
              </TabsTrigger>
            </TabsList>

            <TabsContent value="structure" className="mt-4">
              <ChapterStructure
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

            <TabsContent value="input" className="mt-4 space-y-4">
              {hasNoChapters && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="flex items-center justify-between">
                    <span>Tambahkan BAB dan tugas terlebih dahulu.</span>
                    <Button variant="outline" size="sm" onClick={() => setActiveTab("structure")}>
                      Tambah BAB <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  </AlertDescription>
                </Alert>
              )}

              {classId && !studentsLoading && students.length === 0 && (
                <EmptyStudentsState isGuestMode={isGuestMode} classId={classId} />
              )}

              {students.length > 0 && (
                <Card className="border border-border shadow-sm" data-tour="grade-table">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <CardTitle className="text-sm sm:text-base truncate">
                          {selectedClass?.name} - {selectedSubject?.name}
                        </CardTitle>
                        <Badge variant="pass" className="gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-Save
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">{gradeToolbarActions}</div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="h-[70dvh] min-h-[420px] overflow-hidden">
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
                        onEnterFullscreen={() => setIsFullscreen(true)}
                        toolbarExtra={null}
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
          onClose={() => setIsFullscreen(false)}
          className={selectedClass?.name || ""}
          subjectName={selectedSubject?.name || ""}
          canUndo={isGuestMode ? false : canUndo}
          canRedo={isGuestMode ? false : canRedo}
          onUndo={isGuestMode ? undefined : undo}
          onRedo={isGuestMode ? undefined : redo}
          toolbarExtra={gradeToolbarActions}
        />
      )}

      <ProductTour
        steps={isGuestMode ? guestGradesTourSteps : gradesTourSteps}
        tourKey={isGuestMode ? "guest-grades" : "grades"}
        requireOnboarding={!isGuestMode}
        shouldAutoStart={isGuestMode ? false : shouldShowTours}
      />

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
          canDownloadOfficialTemplate={Boolean(selectedClass && selectedSubject)}
          isDownloadingTemplate={isDownloadingOfficialTemplate}
          onDownloadOfficialTemplate={handleDownloadOfficialTemplate}
          onSaveGrade={handleSaveGrade}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["grades"] });
          }}
          importContext={gradeImportContext}
          onOpenLegacyImport={() => {
            setShowGradeImportExport(false);
            setShowImportGrades(true);
          }}
        />
      )}

      {!isGuestMode && selectedSubjectId && selectedClassId && (
        <ImportGradesDialog
          open={showImportGrades}
          onOpenChange={setShowImportGrades}
          subjectId={selectedSubjectId}
          subjectName={selectedSubject?.name || ""}
          classId={selectedClassId}
          className={selectedClass?.name || ""}
          students={students.map((s) => ({ id: s.id, name: s.name, nisn: s.nisn }))}
          assignments={allAssignments.map((a) => ({ id: a.id, name: a.name, chapter_id: a.chapter_id }))}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["grades"] });
          }}
        />
      )}

      {!isGuestMode && (
        <OCRImportDialog
          open={showOCRGrades}
          onOpenChange={setShowOCRGrades}
          type="grades"
          title="Import Nilai dari Foto"
          description="Foto lembar nilai lalu ketik data untuk di-import"
          onDataReady={async (rows) => {
            if (!selectedSubjectId || !selectedClassId) return;
            for (const row of rows) {
              const studentName = (row[0] || "").trim().toLowerCase();
              const matchedStudent = students.find(
                (s) =>
                  s.name.toLowerCase().includes(studentName) ||
                  studentName.includes(s.name.toLowerCase())
              );
              if (!matchedStudent) continue;

              for (let i = 1; i < row.length && i - 1 < allAssignments.length; i++) {
                const val = parseFloat(row[i]);
                if (Number.isNaN(val) || val < 0 || val > 100) continue;
                await handleSaveGrade(matchedStudent.id, "assignment", val, allAssignments[i - 1].id);
              }
            }
            queryClient.invalidateQueries({ queryKey: ["grades"] });
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

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { SpreadsheetTable } from "@/components/grades/SpreadsheetTable";
import { EmptyStudentsState } from "@/components/grades/EmptyStudentsState";
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import {
  Loader2,
  LogOut,
  Plus,
  Trash2,
  BookOpen,
  Settings,
  Info,
  Users,
  GraduationCap,
  FileText,
  X,
  RefreshCw,
} from "lucide-react";

// Simple tour steps - only shown on first session
const guestTourSteps = [
  {
    target: "[data-tour='guest-info']",
    title: "Informasi Akses",
    description: "Menampilkan mata pelajaran dan kelas yang dapat Anda akses.",
  },
  {
    target: "[data-tour='kkm-setting']",
    title: "Pengaturan KKM",
    description: "Klik untuk mengubah Kriteria Ketuntasan Minimal.",
  },
  {
    target: "[data-tour='add-chapter']",
    title: "Tambah BAB",
    description: "Klik untuk menambahkan BAB/Materi baru.",
  },
  {
    target: "[data-tour='grade-table']",
    title: "Tabel Input Nilai",
    description: "Ketuk sel untuk mengedit. Nilai tersimpan otomatis.",
  },
];

// Interfaces
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
  mainUserId?: string;
}

interface Student {
  id: string;
  name: string;
  nisn: string;
  is_bookmarked?: boolean;
}

interface Chapter {
  id: string;
  name: string;
  order_index: number;
}

interface Assignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index: number;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Grade {
  id: string;
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  grade_type: string;
  value: number | null;
}

interface SubjectInfo {
  id: string;
  name: string;
  kkm: number;
  user_id: string;
}

interface ClassInfo {
  id: string;
  name: string;
}

export default function GuestGrades() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { success: showSuccess, error: showError } = useEnhancedToast();
  
  // Memoize token to prevent re-renders
  const token = useMemo(() => searchParams.get("token") || "", [searchParams]);
  
  // Refs for initialization tracking
  const initRef = useRef(false);
  const loadingRef = useRef(false);

  // State
  const [guestSession, setGuestSession] = useState<GuestSession | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isValidSession, setIsValidSession] = useState(true);
  const [savingGrades, setSavingGrades] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Dialog states
  const [showAddChapterDialog, setShowAddChapterDialog] = useState(false);
  const [showAddAssignmentDialog, setShowAddAssignmentDialog] = useState(false);
  const [showKKMDialog, setShowKKMDialog] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [newAssignmentName, setNewAssignmentName] = useState("");
  const [selectedChapterId, setSelectedChapterId] = useState("");
  const [newKKM, setNewKKM] = useState(75);

  // Initialize from session storage - run only once
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const sessionData = sessionStorage.getItem("guest_session");
    
    if (!sessionData) {
      if (token) {
        navigate(`/share?token=${token}`, { replace: true });
      } else {
        setIsValidSession(false);
        setIsLoading(false);
      }
      return;
    }

    try {
      const session: GuestSession = JSON.parse(sessionData);
      
      if (session.token !== token) {
        sessionStorage.removeItem("guest_session");
        if (token) {
          navigate(`/share?token=${token}`, { replace: true });
        } else {
          setIsValidSession(false);
          setIsLoading(false);
        }
        return;
      }
      
      setGuestSession(session);
    } catch {
      sessionStorage.removeItem("guest_session");
      setIsValidSession(false);
      setIsLoading(false);
    }
  }, [token, navigate]);

  // Load data when session is available
  useEffect(() => {
    if (!guestSession || loadingRef.current) return;
    loadingRef.current = true;

    const loadData = async () => {
      try {
        console.log("[GuestGrades] Loading data for session:", {
          subjectId: guestSession.subjectId,
          classId: guestSession.classId,
        });

        // Fetch all data in parallel with proper error handling
        const [subjectRes, classRes, studentsRes, chaptersRes, gradesRes] = await Promise.all([
          supabase.from("subjects").select("id, name, kkm, user_id").eq("id", guestSession.subjectId).maybeSingle(),
          supabase.from("classes").select("id, name").eq("id", guestSession.classId).maybeSingle(),
          supabase.from("students").select("id, name, nisn, is_bookmarked").eq("class_id", guestSession.classId).order("name"),
          supabase.from("chapters").select("id, name, order_index").eq("subject_id", guestSession.subjectId).order("order_index"),
          supabase.from("grades").select("*").eq("subject_id", guestSession.subjectId),
        ]);

        // Log all responses for debugging
        console.log("[GuestGrades] API Responses:", {
          subject: { data: subjectRes.data, error: subjectRes.error },
          class: { data: classRes.data, error: classRes.error },
          students: { data: studentsRes.data?.length || 0, error: studentsRes.error },
          chapters: { data: chaptersRes.data?.length || 0, error: chaptersRes.error },
          grades: { data: gradesRes.data?.length || 0, error: gradesRes.error },
        });

        // Handle subject data
        if (subjectRes.error) {
          console.error("[GuestGrades] Subject fetch error:", subjectRes.error);
        } else if (subjectRes.data) {
          setSubjectInfo(subjectRes.data);
          setNewKKM(subjectRes.data.kkm);
        }

        // Handle class data
        if (classRes.error) {
          console.error("[GuestGrades] Class fetch error:", classRes.error);
        } else if (classRes.data) {
          setClassInfo(classRes.data);
        }

        // Handle students data
        if (studentsRes.error) {
          console.error("[GuestGrades] Students fetch error:", studentsRes.error);
        } else if (studentsRes.data) {
          console.log("[GuestGrades] Students loaded:", studentsRes.data.length);
          setStudents(studentsRes.data);
        }

        // Handle chapters data
        if (chaptersRes.error) {
          console.error("[GuestGrades] Chapters fetch error:", chaptersRes.error);
        } else if (chaptersRes.data) {
          setChapters(chaptersRes.data);
        }

        // Handle grades data
        if (gradesRes.error) {
          console.error("[GuestGrades] Grades fetch error:", gradesRes.error);
        } else if (gradesRes.data) {
          setGrades(gradesRes.data);
        }

        // Fetch assignments if chapters exist
        if (chaptersRes.data && chaptersRes.data.length > 0) {
          const chapterIds = chaptersRes.data.map((c) => c.id);
          const { data: assignmentsData, error: assignmentsError } = await supabase
            .from("assignments")
            .select("*")
            .in("chapter_id", chapterIds)
            .order("order_index");
          
          if (assignmentsError) {
            console.error("[GuestGrades] Assignments fetch error:", assignmentsError);
          } else if (assignmentsData) {
            setAssignments(assignmentsData);
          }
        }

        // Log access notification (don't block on this)
        if (subjectRes.data && classRes.data) {
          supabase.from("notifications").insert({
            user_id: subjectRes.data.user_id,
            type: "guest_access",
            title: "Akses Guru Tamu",
            message: `${guestSession.name} mengakses halaman input nilai`,
            data: {
              guest_name: guestSession.name,
              guest_email: guestSession.email,
              subject_name: subjectRes.data.name,
              class_name: classRes.data.name,
            },
          }).then(({ error }) => {
            if (error) console.error("[GuestGrades] Notification insert error:", error);
          });
        }
      } catch (error) {
        console.error("[GuestGrades] Error loading data:", error);
        showError("Error", "Gagal memuat data. Silakan refresh halaman.");
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Setup realtime subscription for grades
    const channel = supabase
      .channel('guest-grades-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'grades',
          filter: `subject_id=eq.${guestSession.subjectId}`,
        },
        (payload) => {
          console.log("[GuestGrades] Realtime grade update:", payload);
          
          if (payload.eventType === 'INSERT') {
            setGrades((prev) => {
              // Check if already exists
              if (prev.some((g) => g.id === (payload.new as Grade).id)) return prev;
              return [...prev, payload.new as Grade];
            });
          } else if (payload.eventType === 'UPDATE') {
            setGrades((prev) =>
              prev.map((g) => (g.id === (payload.new as Grade).id ? (payload.new as Grade) : g))
            );
          } else if (payload.eventType === 'DELETE') {
            setGrades((prev) => prev.filter((g) => g.id !== (payload.old as Grade).id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [guestSession, showError]);

  // Refresh data handler
  const handleRefreshData = useCallback(async () => {
    if (!guestSession || isRefreshing) return;
    
    setIsRefreshing(true);
    
    try {
      const [studentsRes, chaptersRes, gradesRes] = await Promise.all([
        supabase.from("students").select("id, name, nisn, is_bookmarked").eq("class_id", guestSession.classId).order("name"),
        supabase.from("chapters").select("id, name, order_index").eq("subject_id", guestSession.subjectId).order("order_index"),
        supabase.from("grades").select("*").eq("subject_id", guestSession.subjectId),
      ]);

      if (studentsRes.data) setStudents(studentsRes.data);
      if (chaptersRes.data) {
        setChapters(chaptersRes.data);
        
        // Fetch assignments if chapters exist
        if (chaptersRes.data.length > 0) {
          const chapterIds = chaptersRes.data.map((c) => c.id);
          const { data: assignmentsData } = await supabase
            .from("assignments")
            .select("*")
            .in("chapter_id", chapterIds)
            .order("order_index");
          
          if (assignmentsData) setAssignments(assignmentsData);
        } else {
          setAssignments([]);
        }
      }
      if (gradesRes.data) setGrades(gradesRes.data);

      showSuccess("Berhasil", "Data berhasil dimuat ulang");
    } catch (error) {
      console.error("[GuestGrades] Error refreshing data:", error);
      showError("Error", "Gagal memuat ulang data");
    } finally {
      setIsRefreshing(false);
    }
  }, [guestSession, isRefreshing, showSuccess, showError]);

  // Computed values
  const assignmentsByChapter = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    chapters.forEach((ch) => {
      map[ch.id] = assignments.filter((a) => a.chapter_id === ch.id);
    });
    return map;
  }, [chapters, assignments]);

  // Use fuzzy search like main grades page
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    
    // Import fuzzy search logic inline for consistency
    const query = searchQuery.toLowerCase().trim();
    
    const results = students.map(student => {
      const nameLower = student.name.toLowerCase();
      const nisnLower = student.nisn.toLowerCase();
      
      let score = 0;
      
      // Exact match
      if (nameLower === query) score = 100;
      // NISN match
      else if (nisnLower.includes(query)) score = 100;
      // Name starts with query
      else if (nameLower.startsWith(query)) score = 98;
      // Name contains query
      else if (nameLower.includes(query)) score = 90;
      // Word starts with query
      else {
        const words = nameLower.split(/\s+/);
        if (words.some(w => w.startsWith(query))) score = 85;
        else if (words.some(w => w.includes(query))) score = 75;
        else {
          // Fuzzy match - basic similarity
          const maxLen = Math.max(query.length, ...words.map(w => w.length));
          for (const word of words) {
            let matches = 0;
            for (let i = 0; i < Math.min(query.length, word.length); i++) {
              if (query[i] === word[i]) matches++;
            }
            score = Math.max(score, (matches / maxLen) * 100);
          }
        }
      }
      
      return { student, score };
    });
    
    return results
      .filter(r => r.score >= 40)
      .sort((a, b) => b.score - a.score)
      .map(r => r.student);
  }, [students, searchQuery]);

  const getGradeValue = useCallback(
    (studentId: string, gradeType: string, assignmentId?: string) => {
      const grade = grades.find(
        (g) =>
          g.student_id === studentId &&
          g.grade_type === gradeType &&
          (assignmentId ? g.assignment_id === assignmentId : !g.assignment_id)
      );
      return grade?.value ?? null;
    },
    [grades]
  );

  const studentAverages = useMemo(() => {
    const averages: Record<string, any> = {};
    const hasChapters = chapters.length > 0 && chapters.some((ch) => (assignmentsByChapter[ch.id]?.length || 0) > 0);

    students.forEach((student) => {
      const chapterDetails: Record<string, number | null> = {};
      let chapterSum = 0;
      let chapterCount = 0;
      let hasEmptyValues = false;

      chapters.forEach((chapter) => {
        const chapterAssignments = assignmentsByChapter[chapter.id] || [];
        if (chapterAssignments.length === 0) {
          chapterDetails[chapter.id] = null;
          return;
        }

        let assignmentSum = 0;
        chapterAssignments.forEach((assignment) => {
          const value = getGradeValue(student.id, "assignment", assignment.id);
          if (value === null) hasEmptyValues = true;
          assignmentSum += value ?? 0;
        });

        const chapterAvg = assignmentSum / chapterAssignments.length;
        chapterDetails[chapter.id] = chapterAvg;
        chapterSum += chapterAvg;
        chapterCount++;
      });

      const chaptersAvg = chapterCount > 0 ? chapterSum / chapterCount : null;
      const stsRaw = getGradeValue(student.id, "sts");
      const sasRaw = getGradeValue(student.id, "sas");

      if (stsRaw === null || sasRaw === null) hasEmptyValues = true;

      const stsCalc = stsRaw ?? 0;
      const sasCalc = sasRaw ?? 0;
      const grandAvg = chaptersAvg ?? 0;

      let final: number | null = null;
      if (hasChapters) {
        final = (grandAvg + (stsCalc + sasCalc) / 2) / 2;
      } else if (stsRaw !== null || sasRaw !== null) {
        final = (stsCalc + sasCalc) / 2;
      }

      averages[student.id] = {
        chaptersAvg,
        stsAvg: stsRaw,
        sasAvg: sasRaw,
        final: stsRaw !== null || sasRaw !== null || chaptersAvg !== null ? final : null,
        chapterDetails,
        hasEmptyValues,
      };
    });

    return averages;
  }, [students, chapters, assignmentsByChapter, getGradeValue]);

  // Handlers
  const handleSaveGrade = useCallback(
    async (studentId: string, gradeType: string, value: number | null, assignmentId?: string) => {
      if (!guestSession || !subjectInfo) return;

      const key = `${studentId}-${gradeType}-${assignmentId || ""}`;
      setSavingGrades((prev) => new Set([...prev, key]));

      try {
        const existingGrade = grades.find(
          (g) =>
            g.student_id === studentId &&
            g.grade_type === gradeType &&
            (assignmentId ? g.assignment_id === assignmentId : !g.assignment_id)
        );

        if (existingGrade) {
          const { error } = await supabase.from("grades").update({ value }).eq("id", existingGrade.id);
          if (error) throw error;
          setGrades((prev) => prev.map((g) => (g.id === existingGrade.id ? { ...g, value } : g)));
        } else {
          const { data, error } = await supabase
            .from("grades")
            .insert({
              student_id: studentId,
              subject_id: subjectInfo.id,
              assignment_id: assignmentId || null,
              grade_type: gradeType,
              value,
              user_id: subjectInfo.user_id,
            })
            .select()
            .single();

          if (error) throw error;
          if (data) setGrades((prev) => [...prev, data]);
        }
      } catch (error) {
        console.error("Error saving grade:", error);
        showError("Error", "Gagal menyimpan nilai");
      } finally {
        setSavingGrades((prev) => {
          const newSet = new Set(prev);
          newSet.delete(key);
          return newSet;
        });
      }
    },
    [guestSession, subjectInfo, grades, showError]
  );

  const handleAddChapter = useCallback(async () => {
    if (!guestSession || !subjectInfo || !newChapterName.trim()) return;

    try {
      const maxOrder = Math.max(0, ...chapters.map((c) => c.order_index));

      const { data, error } = await supabase
        .from("chapters")
        .insert({
          subject_id: guestSession.subjectId,
          name: newChapterName.trim(),
          order_index: maxOrder + 1,
          user_id: subjectInfo.user_id,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setChapters((prev) => [...prev, data]);
        setNewChapterName("");
        setShowAddChapterDialog(false);
        showSuccess("Berhasil", "BAB berhasil ditambahkan");
      }
    } catch (error) {
      console.error("Error adding chapter:", error);
      showError("Error", "Gagal menambahkan BAB");
    }
  }, [guestSession, subjectInfo, newChapterName, chapters, showSuccess, showError]);

  const handleAddAssignment = useCallback(async () => {
    if (!guestSession || !subjectInfo || !selectedChapterId || !newAssignmentName.trim()) return;

    try {
      const chapterAssignments = assignmentsByChapter[selectedChapterId] || [];
      const maxOrder = Math.max(0, ...chapterAssignments.map((a) => a.order_index));

      const { data, error } = await supabase
        .from("assignments")
        .insert({
          chapter_id: selectedChapterId,
          name: newAssignmentName.trim(),
          order_index: maxOrder + 1,
          user_id: subjectInfo.user_id,
        })
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setAssignments((prev) => [...prev, data]);
        setNewAssignmentName("");
        setShowAddAssignmentDialog(false);
        showSuccess("Berhasil", "Tugas berhasil ditambahkan");
      }
    } catch (error) {
      console.error("Error adding assignment:", error);
      showError("Error", "Gagal menambahkan tugas");
    }
  }, [guestSession, subjectInfo, selectedChapterId, newAssignmentName, assignmentsByChapter, showSuccess, showError]);

  const handleUpdateKKM = useCallback(async () => {
    if (!subjectInfo || newKKM < 0 || newKKM > 100) return;

    try {
      const { error } = await supabase.from("subjects").update({ kkm: newKKM }).eq("id", subjectInfo.id);
      if (error) throw error;

      setSubjectInfo((prev) => (prev ? { ...prev, kkm: newKKM } : null));
      setShowKKMDialog(false);
      showSuccess("Berhasil", "KKM berhasil diperbarui");
    } catch (error) {
      console.error("Error updating KKM:", error);
      showError("Error", "Gagal memperbarui KKM");
    }
  }, [subjectInfo, newKKM, showSuccess, showError]);

  const handleDeleteChapter = useCallback(
    async (chapterId: string) => {
      try {
        const { error } = await supabase.from("chapters").delete().eq("id", chapterId);
        if (error) throw error;

        setChapters((prev) => prev.filter((c) => c.id !== chapterId));
        setAssignments((prev) => prev.filter((a) => a.chapter_id !== chapterId));
        showSuccess("Berhasil", "BAB berhasil dihapus");
      } catch (error) {
        console.error("Error deleting chapter:", error);
        showError("Error", "Gagal menghapus BAB");
      }
    },
    [showSuccess, showError]
  );

  const handleDeleteAssignment = useCallback(
    async (assignmentId: string) => {
      try {
        const { error } = await supabase.from("assignments").delete().eq("id", assignmentId);
        if (error) throw error;

        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
        showSuccess("Berhasil", "Tugas berhasil dihapus");
      } catch (error) {
        console.error("Error deleting assignment:", error);
        showError("Error", "Gagal menghapus tugas");
      }
    },
    [showSuccess, showError]
  );

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("guest_session");
    navigate("/", { replace: true });
  }, [navigate]);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  // Invalid session state
  if (!isValidSession || !guestSession) {
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

  // Fullscreen mode
  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-background z-50 overflow-hidden">
        <div className="h-full flex flex-col">
          <div className="flex items-center justify-between p-3 border-b bg-card">
            <div className="flex items-center gap-3">
              <Badge variant="outline">{classInfo?.name}</Badge>
              <span className="text-sm font-medium truncate max-w-[150px]">{subjectInfo?.name}</span>
              <Badge>KKM: {subjectInfo?.kkm}</Badge>
            </div>
            <Button variant="outline" size="sm" onClick={() => setIsFullscreen(false)}>
              <X className="w-4 h-4 mr-2" />
              Keluar
            </Button>
          </div>
          <div className="flex-1 overflow-hidden">
            <SpreadsheetTable
              students={filteredStudents}
              chapters={chapters}
              assignmentsByChapter={assignmentsByChapter}
              studentAverages={studentAverages}
              kkm={subjectInfo?.kkm || 75}
              getGradeValue={getGradeValue}
              onSaveGrade={handleSaveGrade}
              savingGrades={savingGrades}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              isFullscreen={true}
              onClose={() => setIsFullscreen(false)}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold">Mode Guru Tamu</h1>
              <p className="text-xs text-muted-foreground truncate max-w-[150px]">{guestSession.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TourButton tourKey="guest-grades" />
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Keluar</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Info Card */}
        <Alert data-tour="guest-info">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="flex flex-wrap items-center gap-2">
              <span>Anda mengakses sebagai guru tamu untuk</span>
              <Badge variant="secondary" className="gap-1">
                <BookOpen className="w-3 h-3" />
                <span className="truncate max-w-[120px]">{subjectInfo?.name}</span>
              </Badge>
              <span>di kelas</span>
              <Badge variant="secondary" className="gap-1">
                <Users className="w-3 h-3" />
                {classInfo?.name}
              </Badge>
            </div>
          </AlertDescription>
        </Alert>

        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefreshData}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Memuat...' : 'Muat Ulang'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowKKMDialog(true)} data-tour="kkm-setting">
            <Settings className="w-4 h-4 mr-2" />
            KKM: {subjectInfo?.kkm}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowAddChapterDialog(true)} data-tour="add-chapter">
            <Plus className="w-4 h-4 mr-2" />
            Tambah BAB
          </Button>
        </div>

        {/* Structure Management */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Struktur BAB & Tugas
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {chapters.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                <p>Belum ada BAB. Tambahkan BAB untuk mulai menginput nilai.</p>
              </div>
            ) : (
              <Accordion type="multiple" className="px-4 pb-4">
                {chapters.map((chapter) => (
                  <AccordionItem key={chapter.id} value={chapter.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{chapter.name}</Badge>
                        <span className="text-xs text-muted-foreground">
                          ({(assignmentsByChapter[chapter.id] || []).length} tugas)
                        </span>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-2 pl-4">
                        {(assignmentsByChapter[chapter.id] || []).map((assignment) => (
                          <div key={assignment.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                            <span className="text-sm truncate max-w-[200px]">{assignment.name}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive"
                              onClick={() => handleDeleteAssignment(assignment.id)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedChapterId(chapter.id);
                            setShowAddAssignmentDialog(true);
                          }}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Tambah Tugas
                        </Button>
                      </div>
                      <div className="mt-2 pt-2 border-t">
                        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDeleteChapter(chapter.id)}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Hapus BAB
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            )}
          </CardContent>
        </Card>

        {/* Grade Input Table */}
        <Card data-tour="grade-table">
          <CardHeader className="py-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-base">Input Nilai</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Cari siswa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-32 sm:w-40"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {students.length === 0 ? (
              <EmptyStudentsState 
                isGuestMode 
                classId={guestSession.classId}
              />
            ) : chapters.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">Tambahkan BAB terlebih dahulu untuk mulai input nilai.</div>
            ) : (
              <div className="h-[70dvh] min-h-[420px] overflow-hidden">
                <SpreadsheetTable
                  students={filteredStudents}
                  chapters={chapters}
                  assignmentsByChapter={assignmentsByChapter}
                  studentAverages={studentAverages}
                  kkm={subjectInfo?.kkm || 75}
                  getGradeValue={getGradeValue}
                  onSaveGrade={handleSaveGrade}
                  savingGrades={savingGrades}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  isFullscreen={false}
                  onClose={() => {}}
                  className={classInfo?.name || ""}
                  subjectName={subjectInfo?.name || ""}
                  onEnterFullscreen={() => setIsFullscreen(true)}
                />
              </div>
            )}
          </CardContent>
        </Card>

      </main>

      {/* Fullscreen Mode - rendered at top level for proper overlay */}
      {isFullscreen && (
        <SpreadsheetTable
          students={filteredStudents}
          chapters={chapters}
          assignmentsByChapter={assignmentsByChapter}
          studentAverages={studentAverages}
          kkm={subjectInfo?.kkm || 75}
          getGradeValue={getGradeValue}
          onSaveGrade={handleSaveGrade}
          savingGrades={savingGrades}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isFullscreen={true}
          onClose={() => setIsFullscreen(false)}
          className={classInfo?.name || ""}
          subjectName={subjectInfo?.name || ""}
        />
      )}

      {/* Dialogs */}
      <Dialog open={showAddChapterDialog} onOpenChange={setShowAddChapterDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah BAB Baru</DialogTitle>
            <DialogDescription>Masukkan nama BAB/Materi baru</DialogDescription>
          </DialogHeader>
          <Input placeholder="Nama BAB" value={newChapterName} onChange={(e) => setNewChapterName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddChapterDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleAddChapter} disabled={!newChapterName.trim()}>
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddAssignmentDialog} onOpenChange={setShowAddAssignmentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Tugas Baru</DialogTitle>
            <DialogDescription>Masukkan nama tugas baru untuk BAB ini</DialogDescription>
          </DialogHeader>
          <Input placeholder="Nama Tugas" value={newAssignmentName} onChange={(e) => setNewAssignmentName(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddAssignmentDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleAddAssignment} disabled={!newAssignmentName.trim()}>
              Tambah
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showKKMDialog} onOpenChange={setShowKKMDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur KKM</DialogTitle>
            <DialogDescription>Kriteria Ketuntasan Minimal untuk mata pelajaran ini</DialogDescription>
          </DialogHeader>
          <Input type="number" min={0} max={100} value={newKKM} onChange={(e) => setNewKKM(Number(e.target.value))} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowKKMDialog(false)}>
              Batal
            </Button>
            <Button onClick={handleUpdateKKM}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Product Tour */}
      <ProductTour steps={guestTourSteps} tourKey="guest-grades" />
    </div>
  );
}

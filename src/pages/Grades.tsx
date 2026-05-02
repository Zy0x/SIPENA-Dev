import { useState, useMemo, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FileSpreadsheet,
  School,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Settings,
  Plus,
  Upload,
  Camera,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useClasses } from "@/hooks/useClasses";
import { useStudents } from "@/hooks/useStudents";
import { useSubjects } from "@/hooks/useSubjects";
import { useGradesWithUndo } from "@/hooks/useGradesWithUndo";
import { useChapters } from "@/hooks/useChapters";
import { useAssignments, useAllAssignments } from "@/hooks/useAssignments";
import type { Assignment } from "@/hooks/useAssignments";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { SmartStudentSearch } from "@/components/grades/SmartStudentSearch";
import { fuzzySearchStudents } from "@/lib/fuzzySearch";
import { ChapterStructure } from "@/components/grades/ChapterStructure";
import { SpreadsheetTable } from "@/components/grades/SpreadsheetTable";
import { EmptyStudentsState } from "@/components/grades/EmptyStudentsState";
import { FormulaSettings, CustomFormula, DEFAULT_FORMULA, calculateReportGrade } from "@/components/grades/FormulaSettings";
import { ProductTour, TourButton } from "@/components/ui/product-tour";
import ImportGradesDialog from "@/components/import/ImportGradesDialog";
import OCRImportDialog from "@/components/import/OCRImportDialog";
import { PageHeader } from "@/components/layout/PageHeader";

// Tour steps for Grades page
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

export default function Grades() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { success, error: showError } = useEnhancedToast();
  const { classes, isLoading: classesLoading } = useClasses();
  const { needsOnboarding, shouldShowTours, createPreferences, completeOnboarding } = useUserPreferences();
  
  const initialClassId = searchParams.get("classId") || "";
  const initialSubjectId = searchParams.get("subjectId") || "";
  const [selectedClassId, setSelectedClassId] = useState<string>(initialClassId);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(initialSubjectId);
  const [savingGrades, setSavingGrades] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  // Saat siswa dipilih dari dropdown AI Search, kunci tabel hanya untuk siswa itu.
  const [lockedStudentId, setLockedStudentId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("input");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [formula, setFormula] = useState<CustomFormula>(DEFAULT_FORMULA);
  const [showImportGrades, setShowImportGrades] = useState(false);
  const [showOCRGrades, setShowOCRGrades] = useState(false);

  // Handle theme selection for new users
  const handleThemeSelection = useCallback(async (mode: "light" | "dark") => {
    await createPreferences(mode);
    
    // Apply theme
    if (mode === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", mode);
    
    // Mark onboarding as started (tours will complete it)
    success("Tema berhasil disimpan!", `Mode ${mode === "dark" ? "gelap" : "terang"} akan digunakan sebagai default.`);
  }, [createPreferences, success]);
  
  const { students, isLoading: studentsLoading } = useStudents(selectedClassId);
  const { subjects, isLoading: subjectsLoading } = useSubjects(selectedClassId);
  const { grades, isLoading: gradesLoading, saveGradeWithUndo, undo, redo, canUndo, canRedo } = useGradesWithUndo(selectedSubjectId);
  const { 
    chapters, 
    createBulkChapters, 
    updateChapter, 
    deleteChapter,
    isLoading: chaptersLoading 
  } = useChapters(selectedSubjectId);
  const { assignments: allAssignments, isLoading: assignmentsLoading } = useAllAssignments(selectedSubjectId);
  
  const selectedClass = classes.find(c => c.id === selectedClassId);
  const selectedSubject = subjects.find(s => s.id === selectedSubjectId);

  const assignmentsByChapter = useMemo(() => {
    const grouped: Record<string, Assignment[]> = {};
    chapters.forEach(ch => {
      grouped[ch.id] = allAssignments.filter(a => a.chapter_id === ch.id);
    });
    return grouped;
  }, [chapters, allAssignments]);

  const filteredStudents = useMemo(() => {
    // 1. Pilihan eksplisit dari AI search → kunci ke satu siswa.
    if (lockedStudentId) {
      const locked = students.find((s) => s.id === lockedStudentId);
      return locked ? [locked] : students;
    }

    // 2. Tidak ada query → semua siswa.
    if (!searchQuery.trim()) return students;

    // 3. Free-typing → gunakan fuzzy engine yang sama dengan dropdown
    //    agar hasil di tabel konsisten dengan saran AI.
    const results = fuzzySearchStudents(students, searchQuery, {
      minScore: 55,
      limit: students.length,
    });
    return results.map((r) => r.item);
  }, [students, searchQuery, lockedStudentId]);

  const getGradeValue = useCallback((studentId: string, gradeType: string, assignmentId?: string) => {
    const grade = grades.find(
      g => g.student_id === studentId && 
           g.grade_type === gradeType && 
           (assignmentId ? g.assignment_id === assignmentId : !g.assignment_id)
    );
    return grade?.value ?? null;
  }, [grades]);

  const studentAverages = useMemo(() => {
    const averages: Record<string, { 
      chaptersAvg: number | null;
      stsAvg: number | null;
      sasAvg: number | null;
      final: number | null;
      chapterDetails: Record<string, number | null>;
      hasEmptyValues: boolean;
    }> = {};
    
    const hasChapters = chapters.length > 0 && chapters.some(ch => 
      (assignmentsByChapter[ch.id]?.length || 0) > 0
    );
    
    students.forEach(student => {
      const chapterDetails: Record<string, number | null> = {};
      let chapterSum = 0;
      let chapterCount = 0;
      let hasEmptyValues = false;

      chapters.forEach(chapter => {
        const chapterAssignments = assignmentsByChapter[chapter.id] || [];
        if (chapterAssignments.length === 0) {
          chapterDetails[chapter.id] = null;
          return;
        }

        let assignmentSum = 0;
        chapterAssignments.forEach(assignment => {
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
      
      const stsAvg = stsRaw;
      const sasAvg = sasRaw;
      
      const stsCalc = stsRaw ?? 0;
      const sasCalc = sasRaw ?? 0;
      const grandAvg = chaptersAvg ?? 0;

      const final = calculateReportGrade(formula, grandAvg, stsCalc, sasCalc, hasChapters);

      averages[student.id] = {
        chaptersAvg,
        stsAvg,
        sasAvg,
        final: (stsRaw !== null || sasRaw !== null || chaptersAvg !== null) ? final : null,
        chapterDetails,
        hasEmptyValues,
      };
    });
    
    return averages;
  }, [students, chapters, assignmentsByChapter, getGradeValue, formula]);

  const handleSaveGrade = async (
    studentId: string, 
    gradeType: string, 
    value: number | null, 
    assignmentId?: string
  ) => {
    if (!selectedSubjectId) return;
    
    const key = `${studentId}-${gradeType}-${assignmentId || ""}`;
    setSavingGrades(prev => new Set(prev).add(key));
    
    try {
      await saveGradeWithUndo(studentId, gradeType, value, assignmentId);
    } catch (error) {
      showError("Gagal menyimpan", "Terjadi kesalahan saat menyimpan nilai");
    } finally {
      setSavingGrades(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleAddChapters = async (names: string[]) => {
    if (!selectedSubjectId) return;

    const existingCount = chapters.length;
    const newChapters = names.map((name, i) => ({
      subject_id: selectedSubjectId,
      name: name,
      order_index: existingCount + i + 1,
    }));

    try {
      await createBulkChapters.mutateAsync(newChapters);
    } catch (error) {
      // Error handled in hook
    }
  };

  const { createBulkAssignments } = useAssignments();
  
  const handleAddAssignments = async (chapterId: string, names: string[]) => {
    const existingCount = assignmentsByChapter[chapterId]?.length || 0;
    const newAssignments = names.map((name, i) => ({
      chapter_id: chapterId,
      name: name,
      order_index: existingCount + i + 1,
    }));

    try {
      await createBulkAssignments.mutateAsync(newAssignments);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleUpdateChapter = async (id: string, name: string) => {
    try {
      await updateChapter.mutateAsync({ id, name });
    } catch (error) {
      // Error handled in hook
    }
  };

  const { updateAssignment, deleteAssignment } = useAssignments();

  const handleUpdateAssignment = async (id: string, name: string) => {
    try {
      await updateAssignment.mutateAsync({ id, name });
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    try {
      await deleteAssignment.mutateAsync(id);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleDeleteChapter = async (id: string) => {
    try {
      await deleteChapter.mutateAsync(id);
    } catch (error) {
      // Error handled in hook
    }
  };

  const isLoading = classesLoading || studentsLoading || subjectsLoading || gradesLoading || chaptersLoading || assignmentsLoading;
  const hasNoClasses = !classesLoading && classes.length === 0;
  const hasNoChapters = !chaptersLoading && chapters.length === 0 && selectedSubjectId;
  const kkm = selectedSubject?.kkm || 70;

  return (
    <>
      <div className="p-3 sm:p-4 lg:p-8 max-w-[1600px] mx-auto space-y-3 sm:space-y-4 lg:space-y-6">
        {/* Header */}
        <PageHeader
          icon={<FileSpreadsheet className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />}
          title="Input Nilai"
          subtitle="Pilih kelas dan mata pelajaran untuk menginput nilai siswa"
          breadcrumbs={[
            { label: "Input Nilai" },
            ...(selectedClass ? [{ label: selectedClass.name }] : []),
            ...(selectedSubject ? [{ label: selectedSubject.name }] : []),
          ]}
          actions={<TourButton tourKey="grades" />}
        />

        {/* No Classes Alert */}
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

        {/* Selection Cards - Compact */}
        {!hasNoClasses && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 animate-fade-in-up delay-100">
            <div data-tour="class-select" className="rounded-2xl bg-card border border-border overflow-hidden p-3 sm:p-3.5">
              <Select 
                value={selectedClassId} 
                onValueChange={(v) => {
                  setSelectedClassId(v);
                  setSelectedSubjectId("");
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
                  if (value === '__add_new__') {
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

        {/* Tabs */}
        {selectedSubjectId && (
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

            {/* Structure Tab */}
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
                isLoading={chaptersLoading}
              />
            </TabsContent>

            {/* Input Tab */}
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

              {/* Empty Students State */}
              {selectedClassId && !studentsLoading && students.length === 0 && (
                <EmptyStudentsState classId={selectedClassId} />
              )}

              {/* Grade Input Table - Using SpreadsheetTable consistently */}
              {students.length > 0 && (
                <Card className="border border-border shadow-sm">
                  <CardHeader className="pb-3 border-b border-border/50">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-sm sm:text-base truncate">
                          {selectedClass?.name} - {selectedSubject?.name}
                        </CardTitle>
                        <Badge variant="pass" className="gap-1 text-xs">
                          <CheckCircle2 className="w-3 h-3" />
                          Auto-Save
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9 min-w-[44px]">
                              <Upload className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Import</span>
                              <ChevronDown className="w-3 h-3 opacity-60" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setShowImportGrades(true)} className="gap-2 min-h-[44px]">
                              <FileSpreadsheet className="w-4 h-4" />
                              Import dari Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setShowOCRGrades(true)} className="gap-2 min-h-[44px]">
                              <Camera className="w-4 h-4" />
                              Import dari Foto (OCR)
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <FormulaSettings 
                          formula={formula}
                          onFormulaChange={setFormula}
                          hasChapters={chapters.length > 0 && chapters.some(ch => 
                            (assignmentsByChapter[ch.id]?.length || 0) > 0
                          )}
                        />
                        <SmartStudentSearch
                          students={students}
                          onFilter={() => {
                            /* Filtering ditangani via searchQuery + lockedStudentId
                               agar konsisten antara dropdown dan tabel. */
                          }}
                          onSelectionChange={(student) => {
                            setLockedStudentId(student?.id ?? null);
                          }}
                          onSearchQueryChange={(query) => setSearchQuery(query)}
                          placeholder="Cari siswa AI..."
                          showSuggestions={true}
                          className="w-48 sm:w-56"
                        />
                      </div>
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
                        canUndo={canUndo}
                        canRedo={canRedo}
                        onUndo={undo}
                        onRedo={redo}
                        onEnterFullscreen={() => setIsFullscreen(true)}
                      />
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}
      </div>

      {/* Fullscreen Mode - rendered at top level for proper overlay */}
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
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={undo}
          onRedo={redo}
        />
      )}

      <ProductTour 
        steps={gradesTourSteps} 
        tourKey="grades" 
        requireOnboarding={true}
        shouldAutoStart={shouldShowTours}
      />

      {/* Theme Selection Dialog moved to Dashboard */}

      {/* Import Grades Dialog */}
      {selectedSubjectId && selectedClassId && (
        <ImportGradesDialog
          open={showImportGrades}
          onOpenChange={setShowImportGrades}
          subjectId={selectedSubjectId}
          subjectName={selectedSubject?.name || ""}
          classId={selectedClassId}
          className={selectedClass?.name || ""}
          students={students.map(s => ({ id: s.id, name: s.name, nisn: s.nisn }))}
          assignments={allAssignments.map(a => ({ id: a.id, name: a.name, chapter_id: a.chapter_id }))}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["grades"] });
          }}
        />
      )}

      {/* OCR Import Grades Dialog */}
      <OCRImportDialog
        open={showOCRGrades}
        onOpenChange={setShowOCRGrades}
        type="grades"
        title="Import Nilai dari Foto"
        description="Foto lembar nilai lalu ketik data untuk di-import"
        onDataReady={async (rows) => {
          if (!selectedSubjectId || !selectedClassId) return;
          // Match student names and save grades
          let imported = 0;
          for (const row of rows) {
            const studentName = (row[0] || "").trim().toLowerCase();
            const matchedStudent = students.find(s => s.name.toLowerCase().includes(studentName) || studentName.includes(s.name.toLowerCase()));
            if (!matchedStudent) continue;

            // Remaining columns are grade values mapped to assignments
            for (let i = 1; i < row.length && i - 1 < allAssignments.length; i++) {
              const val = parseFloat(row[i]);
              if (isNaN(val) || val < 0 || val > 100) continue;
              await handleSaveGrade(matchedStudent.id, "assignment", val, allAssignments[i - 1].id);
              imported++;
            }
          }
          queryClient.invalidateQueries({ queryKey: ["grades"] });
        }}
      />
    </>
  );
}

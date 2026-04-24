import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

export interface Grade {
  id: string;
  user_id: string;
  student_id: string;
  subject_id: string;
  assignment_id: string | null;
  academic_year_id?: string | null;
  semester_id?: string | null;
  grade_type: string;
  value: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGradeInput {
  student_id: string;
  subject_id: string;
  assignment_id?: string;
  grade_type: string;
  value: number;
  academic_year_id?: string;
  semester_id?: string;
}

export interface UpdateGradeInput {
  id: string;
  value: number | null;
}

export interface BulkGradeInput {
  student_id: string;
  subject_id: string;
  assignment_id?: string;
  grade_type: string;
  value: number | null;
  academic_year_id?: string;
  semester_id?: string;
}

/**
 * Hook untuk mengelola nilai siswa
 * 
 * FILTERING BEHAVIOR:
 * - Grades adalah data TRANSAKSIONAL, filter by YEAR + SEMESTER
 * - Ketika switch semester, data nilai akan "reset" (blank canvas)
 * - Ketika switch year, semua data (termasuk kelas, mapel) akan reset
 * 
 * @param subjectId - ID mata pelajaran untuk filter nilai
 * @param classId - ID kelas untuk filter nilai berdasarkan siswa di kelas
 * @param options - { filterByYear, filterBySemester, semesterOverride }
 */
export function useGrades(
  subjectId?: string, 
  classId?: string, 
  options: {
    filterByYear?: boolean;
    filterBySemester?: boolean;
    semesterOverride?: string | null; // For reports page with independent semester selector
  } = {}
) {
  const { 
    filterByYear = true, 
    filterBySemester = true,
    semesterOverride = null,
  } = options;
  
  const { user } = useAuth();
  const { error: showError, success } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeYearId, activeSemesterId } = useAcademicYear();

  // Determine which semester to use
  const effectiveSemesterId = semesterOverride !== null ? semesterOverride : activeSemesterId;

  const gradesQuery = useQuery({
    queryKey: [
      "grades", 
      subjectId, 
      filterByYear ? activeYearId : "all",
      filterBySemester ? effectiveSemesterId : "all"
    ],
    queryFn: async () => {
      if (!user || !subjectId) return [];
      
      let query = supabase
        .from("grades")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id);

      // Filter by academic year
      if (filterByYear && activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      // Filter by semester (for transactional data)
      if (filterBySemester && effectiveSemesterId) {
        query = query.or(`semester_id.eq.${effectiveSemesterId},semester_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Grade[];
    },
    enabled: !!user && !!subjectId,
  });

  const gradesByClassQuery = useQuery({
    queryKey: [
      "grades_by_class", 
      classId, 
      filterByYear ? activeYearId : "all",
      filterBySemester ? effectiveSemesterId : "all"
    ],
    queryFn: async () => {
      if (!user || !classId) return [];
      
      // Get all students in this class
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .eq("class_id", classId);

      if (!students || students.length === 0) return [];

      const studentIds = students.map(s => s.id);

      let query = supabase
        .from("grades")
        .select("*")
        .in("student_id", studentIds)
        .eq("user_id", user.id);

      // Filter by academic year
      if (filterByYear && activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      // Filter by semester
      if (filterBySemester && effectiveSemesterId) {
        query = query.or(`semester_id.eq.${effectiveSemesterId},semester_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Grade[];
    },
    enabled: !!user && !!classId,
  });

  const createGrade = useMutation({
    mutationFn: async (input: CreateGradeInput) => {
      if (!user) throw new Error("User not authenticated");

      // Auto-assign academic year and semester
      const yearId = input.academic_year_id || activeYearId;
      const semesterId = input.semester_id || activeSemesterId;

      const { data, error } = await supabase
        .from("grades")
        .insert({
          user_id: user.id,
          student_id: input.student_id,
          subject_id: input.subject_id,
          assignment_id: input.assignment_id || null,
          grade_type: input.grade_type,
          value: input.value,
          academic_year_id: yearId,
          semester_id: semesterId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["grades_by_class"] });
      queryClient.invalidateQueries({ queryKey: ["input_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
    },
    onError: (error: Error) => {
      showError("Gagal menyimpan nilai", error.message);
    },
  });

  const updateGrade = useMutation({
    mutationFn: async (input: UpdateGradeInput) => {
      const { id, value } = input;
      const { data, error } = await supabase
        .from("grades")
        .update({ value, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["grades_by_class"] });
      queryClient.invalidateQueries({ queryKey: ["input_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui nilai", error.message);
    },
  });

  const upsertGrade = useMutation({
    mutationFn: async (input: BulkGradeInput) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi. Silakan login kembali.");

      const gradeType = input.grade_type;
      
      // Validate grade_type
      if (!['assignment', 'sts', 'sas'].includes(gradeType)) {
        throw new Error(`Tipe nilai tidak valid: ${gradeType}. Gunakan: assignment, sts, atau sas`);
      }

      // Auto-assign academic year and semester
      const yearId = input.academic_year_id || activeYearId;
      const semesterId = input.semester_id || activeSemesterId;

      // Build query for checking existing grade
      let query = supabase
        .from("grades")
        .select("id")
        .eq("user_id", user.id)
        .eq("student_id", input.student_id)
        .eq("subject_id", input.subject_id)
        .eq("grade_type", gradeType);

      // Handle null assignment_id properly
      if (input.assignment_id) {
        query = query.eq("assignment_id", input.assignment_id);
      } else {
        query = query.is("assignment_id", null);
      }

      // Also filter by semester to allow same student to have different grades per semester
      if (semesterId) {
        query = (query as any).eq("semester_id", semesterId);
      }

      // Use .limit(1) to avoid "multiple rows returned" error
      const { data: existingRows, error: queryError } = await query.limit(1);

      if (queryError) {
        console.error("Query error:", queryError);
        throw new Error(`Gagal memeriksa data nilai: ${queryError.message}`);
      }

      const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;

      if (existing) {
        // Update existing
        const { data, error } = await supabase
          .from("grades")
          .update({ 
            value: input.value, 
            updated_at: new Date().toISOString() 
          })
          .eq("id", existing.id)
          .select()
          .single();

        if (error) {
          console.error("Update error:", error);
          if (error.code === '23514') {
            throw new Error(`Nilai gagal disimpan: tipe nilai "${gradeType}" tidak valid di database`);
          }
          throw new Error(`Gagal memperbarui nilai: ${error.message}`);
        }
        return data;
      } else {
        // Create new with academic_year_id and semester_id
        const { data, error } = await supabase
          .from("grades")
          .insert({
            user_id: user.id,
            student_id: input.student_id,
            subject_id: input.subject_id,
            assignment_id: input.assignment_id || null,
            grade_type: gradeType,
            value: input.value,
            academic_year_id: yearId,
            semester_id: semesterId,
          })
          .select()
          .single();

        if (error) {
          console.error("Insert error:", error);
          if (error.code === '23514') {
            throw new Error(`Nilai gagal disimpan: tipe nilai "${gradeType}" tidak valid di database`);
          }
          if (error.code === '23503') {
            throw new Error("Gagal menyimpan: siswa atau mata pelajaran tidak ditemukan");
          }
          throw new Error(`Gagal menyimpan nilai baru: ${error.message}`);
        }
        return data;
      }
    },
    onSuccess: (_, variables) => {
      // Invalidate specific subject grades for immediate recalculation
      queryClient.invalidateQueries({ queryKey: ["grades", variables.subject_id] });
      queryClient.invalidateQueries({ queryKey: ["grades_by_class"] });
      queryClient.invalidateQueries({ queryKey: ["input_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
    },
    onError: (error: Error) => {
      console.error("Upsert grade error:", error);
      showError("Gagal menyimpan nilai", error.message || "Terjadi kesalahan, coba lagi");
    },
  });

  const deleteGrade = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("grades").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["grades_by_class"] });
      queryClient.invalidateQueries({ queryKey: ["input_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Nilai telah dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal menghapus nilai", error.message);
    },
  });

  // Helper function to get grade value for a student
  const getGradeValue = (studentId: string, gradeType: string, assignmentId?: string): number | null => {
    const grades = gradesQuery.data || [];
    
    const grade = grades.find(
      (g) =>
        g.student_id === studentId &&
        g.grade_type === gradeType &&
        (assignmentId ? g.assignment_id === assignmentId : !g.assignment_id)
    );
    return grade?.value ?? null;
  };

  // Helper to get grade value as number (treats null as 0 for calculations)
  const getGradeValueAsNumber = (studentId: string, gradeType: string, assignmentId?: string): number => {
    const value = getGradeValue(studentId, gradeType, assignmentId);
    return value ?? 0;
  };

  return {
    grades: gradesQuery.data || [],
    gradesByClass: gradesByClassQuery.data || [],
    isLoading: gradesQuery.isLoading,
    error: gradesQuery.error,
    createGrade,
    updateGrade,
    upsertGrade,
    deleteGrade,
    getGradeValue,
    getGradeValueAsNumber,
    // Helper
    isFilteredByYear: filterByYear && !!activeYearId,
    isFilteredBySemester: filterBySemester && !!effectiveSemesterId,
    activeYearId,
    activeSemesterId: effectiveSemesterId,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { getScopedGradeValue } from "@/lib/gradeValueSelection";
import type { Json } from "@/infrastructure/supabase/supabase.types";

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

export interface GradeBatchChangedRow {
  gradeId?: string;
  studentId: string;
  subjectId: string;
  assignmentId?: string | null;
  academicYearId?: string | null;
  semesterId?: string | null;
  gradeType: string;
  oldValue: number | null;
  newValue: number | null;
}

export interface GradeBatchUpsertResult {
  savedCount: number;
  skippedUnchangedCount: number;
  changedRows: GradeBatchChangedRow[];
}

export type GradeBatchRpcItem = {
  studentId: string;
  subjectId: string;
  assignmentId: string | null;
  academicYearId: string | null;
  semesterId: string | null;
  gradeType: string;
  value: number | null;
};

const BATCH_GRADE_TYPES = new Set(["assignment", "sts", "sas"]);

type RpcErrorLike = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
};

type ImportGradesBatchRpcClient = {
  rpc: (
    fn: "import_grades_batch",
    args: { p_items: GradeBatchRpcItem[] },
  ) => Promise<{ data: Json; error: RpcErrorLike | null }>;
};

function parseNullableNumber(value: unknown): { isValid: boolean; value: number | null } {
  if (value === null || value === undefined || value === "") return { isValid: true, value: null };
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return { isValid: false, value: null };
  }
  return { isValid: true, value: numeric };
}

function parseOptionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseSafeCount(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
}

export function parseBatchChangedRows(value: unknown): GradeBatchChangedRow[] {
  if (!Array.isArray(value)) return [];
  return value
    .flatMap((item): GradeBatchChangedRow[] => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const record = item as Record<string, unknown>;
      const studentId = parseOptionalString(record.studentId);
      const subjectId = parseOptionalString(record.subjectId);
      const gradeType = parseOptionalString(record.gradeType);
      const oldValue = parseNullableNumber(record.oldValue);
      const newValue = parseNullableNumber(record.newValue);

      if (!studentId || !subjectId || !gradeType || !BATCH_GRADE_TYPES.has(gradeType)) return [];
      if (!oldValue.isValid || !newValue.isValid) return [];

      return [{
        gradeId: parseOptionalString(record.gradeId) || undefined,
        studentId,
        subjectId,
        assignmentId: parseOptionalString(record.assignmentId),
        academicYearId: parseOptionalString(record.academicYearId),
        semesterId: parseOptionalString(record.semesterId),
        gradeType,
        oldValue: oldValue.value,
        newValue: newValue.value,
      }];
    });
}

export function parseBatchUpsertResult(value: Json): GradeBatchUpsertResult {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  return {
    savedCount: parseSafeCount(record.savedCount),
    skippedUnchangedCount: parseSafeCount(record.skippedUnchangedCount),
    changedRows: parseBatchChangedRows(record.changedRows),
  };
}

export function gradeRpcErrorMessage(error: RpcErrorLike): string {
  const message = error.message || "";
  const normalizedMessage = message.toLowerCase();
  if (error.code === "PGRST202" || message.includes("import_grades_batch")) {
    return "Fungsi database import_grades_batch belum tersedia. Jalankan migration terbaru sebelum import nilai batch.";
  }
  if (normalizedMessage.includes("duplikat") || normalizedMessage.includes("duplicate")) {
    return "Data nilai duplikat ditemukan. Perlu perbaikan database sebelum menyimpan.";
  }
  if (error.code === "22P02" || normalizedMessage.includes("invalid input syntax for type uuid")) {
    return "Format data import tidak valid. Periksa ulang preview sebelum menyimpan.";
  }
  if (error.code === "22003" || normalizedMessage.includes("rentang 0 sampai 100")) {
    return "Ada nilai di luar rentang 0 sampai 100. Periksa item yang perlu dicek sebelum menyimpan.";
  }
  if (
    error.code === "42501" ||
    normalizedMessage.includes("tidak ditemukan") ||
    normalizedMessage.includes("bukan milik") ||
    normalizedMessage.includes("tidak valid")
  ) {
    return "Data import tidak sesuai dengan kelas, mapel, siswa, semester, atau tugas aktif. Periksa kembali pilihan import.";
  }
  if (normalizedMessage.includes("failed to fetch") || normalizedMessage.includes("network")) {
    return "Koneksi ke database terputus saat menyimpan. Muat ulang data untuk memastikan status terakhir sebelum mencoba lagi.";
  }
  return message || "Import nilai gagal. Periksa kembali data dan coba lagi.";
}

export function mapBulkGradesToRpcItems(
  inputs: BulkGradeInput[],
  activeYearId?: string | null,
  activeSemesterId?: string | null,
): GradeBatchRpcItem[] {
  return inputs.map((input) => ({
    studentId: input.student_id,
    subjectId: input.subject_id,
    assignmentId: input.assignment_id || null,
    academicYearId: input.academic_year_id || activeYearId || null,
    semesterId: input.semester_id || activeSemesterId || null,
    gradeType: input.grade_type,
    value: input.value,
  }));
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

      if (gradeType === "assignment" && !input.assignment_id) {
        throw new Error("Nilai tugas wajib memiliki assignment_id.");
      }
      if ((gradeType === "sts" || gradeType === "sas") && input.assignment_id) {
        throw new Error(`Nilai ${gradeType.toUpperCase()} tidak boleh memiliki assignment_id.`);
      }

      // Build query for checking existing grade
      let query = supabase
        .from("grades")
        .select("id,value")
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

      if (yearId) {
        query = query.eq("academic_year_id", yearId);
      } else {
        query = query.is("academic_year_id", null);
      }

      if (semesterId) {
        query = query.eq("semester_id", semesterId);
      } else {
        query = query.is("semester_id", null);
      }

      const { data: existingRows, error: queryError } = await query.limit(2);

      if (queryError) {
        console.error("Query error:", queryError);
        throw new Error(`Gagal memeriksa data nilai: ${queryError.message}`);
      }

      if ((existingRows?.length || 0) > 1) {
        throw new Error("Data nilai duplikat ditemukan. Perlu perbaikan database sebelum menyimpan.");
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

  const upsertGradesBatch = useMutation({
    mutationFn: async (inputs: BulkGradeInput[]): Promise<GradeBatchUpsertResult> => {
      if (!user) throw new Error("Pengguna tidak terautentikasi. Silakan login kembali.");
      if (inputs.length === 0) return { savedCount: 0, skippedUnchangedCount: 0, changedRows: [] };

      const rpcItems = mapBulkGradesToRpcItems(inputs, activeYearId, activeSemesterId);

      const rpcClient = supabase as unknown as ImportGradesBatchRpcClient;
      const { data, error } = await rpcClient.rpc("import_grades_batch", { p_items: rpcItems });

      if (error) {
        console.error("Batch grade import RPC error:", error);
        throw new Error(gradeRpcErrorMessage(error));
      }

      return parseBatchUpsertResult(data);
    },
    onSuccess: (_, variables) => {
      const subjectIds = new Set(variables.map((item) => item.subject_id).filter(Boolean));
      subjectIds.forEach((variableSubjectId) => {
        queryClient.invalidateQueries({ queryKey: ["grades", variableSubjectId] });
      });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["grades_by_class"] });
      queryClient.invalidateQueries({ queryKey: ["input_progress"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
    },
    onError: (error: Error) => {
      console.error("Batch upsert grade error:", error);
      showError("Gagal import nilai", error.message || "Import dibatalkan dan tidak ada nilai yang disimpan.");
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

    return getScopedGradeValue(
      grades.filter((grade) => grade.student_id === studentId),
      {
        gradeType,
        assignmentId,
        semesterId: filterBySemester ? effectiveSemesterId : null,
      },
    );
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
    upsertGradesBatch,
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

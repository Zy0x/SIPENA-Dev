import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { logActivity } from "@/lib/activityLogger";

export interface Class {
  id: string;
  user_id: string;
  academic_year_id: string | null;
  semester_id: string | null;
  name: string;
  description: string | null;
  class_kkm: number | null;
  created_at: string;
  updated_at: string;
  student_count?: number;
}

export interface CreateClassInput {
  name: string;
  description?: string;
  class_kkm: number;
  academic_year_id?: string;
  semester_id?: string;
}

export interface UpdateClassInput {
  id: string;
  name?: string;
  description?: string;
  class_kkm?: number | null;
}

/**
 * Hook untuk mengelola data kelas
 * 
 * @param filterByActiveYear - Default TRUE: filter kelas berdasarkan tahun ajaran aktif
 * Set ke false untuk melihat semua kelas (mode admin/historical)
 */
export function useClasses(filterByActiveYear: boolean = true) {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeYear, activeYearId } = useAcademicYear();

  const classesQuery = useQuery({
    queryKey: ["classes", user?.id, filterByActiveYear ? activeYearId : "all"],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("classes")
        .select("*")
        .eq("user_id", user.id);

      // Filter by active academic year if requested (DEFAULT behavior)
      if (filterByActiveYear && activeYearId) {
        query = query.eq("academic_year_id", activeYearId);
      }

      const { data: classes, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;

      // Get student counts for each class
      const classesWithCounts = await Promise.all(
        (classes || []).map(async (cls) => {
          const { count } = await supabase
            .from("students")
            .select("*", { count: "exact", head: true })
            .eq("class_id", cls.id);
          
          return { ...cls, student_count: count || 0 };
        })
      );

      return classesWithCounts as Class[];
    },
    enabled: !!user,
  });

  const createClass = useMutation({
    mutationFn: async (input: CreateClassInput) => {
      if (!user) throw new Error("User not authenticated");

      // ALWAYS assign active academic year if not specified
      const yearId = input.academic_year_id || activeYearId;
      
      if (!yearId) {
        throw new Error("Tidak ada tahun ajaran aktif. Buat tahun ajaran terlebih dahulu di Pengaturan.");
      }

      const { data, error } = await supabase
        .from("classes")
        .insert({
          user_id: user.id,
          name: input.name,
          description: input.description || null,
          class_kkm: input.class_kkm,
          academic_year_id: yearId,
          semester_id: input.semester_id || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      success("Berhasil!", "Kelas baru telah ditambahkan");
      if (user) logActivity({ userId: user.id, action: "menambahkan kelas baru", entityType: "class", entityId: data.id, entityName: data.name });
    },
    onError: (error: Error) => {
      showError("Gagal menambah kelas", error.message);
    },
  });

  const updateClass = useMutation({
    mutationFn: async (input: UpdateClassInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("classes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      success("Berhasil!", "Kelas telah diperbarui");
      if (user) logActivity({ userId: user.id, action: "memperbarui kelas", entityType: "class", entityId: data.id, entityName: data.name });
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui kelas", error.message);
    },
  });

  const deleteClass = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      success("Berhasil!", "Kelas telah dihapus");
      if (user) logActivity({ userId: user.id, action: "menghapus kelas", entityType: "class", entityId: id });
    },
    onError: (error: Error) => {
      showError("Gagal menghapus kelas", error.message);
    },
  });

  const duplicateClass = useMutation({
    mutationFn: async (classId: string) => {
      if (!user) throw new Error("User not authenticated");

      // Get the original class
      const { data: originalClass, error: classError } = await supabase
        .from("classes")
        .select("*")
        .eq("id", classId)
        .single();

      if (classError) throw classError;

      // Create new class with copied data - use CURRENT active year
      const { data: newClass, error: createError } = await supabase
        .from("classes")
        .insert({
          user_id: user.id,
          name: `${originalClass.name} (Copy)`,
          description: originalClass.description,
          class_kkm: originalClass.class_kkm,
          academic_year_id: activeYearId || originalClass.academic_year_id,
          semester_id: originalClass.semester_id,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Get and copy students
      const { data: students } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId);

      if (students && students.length > 0) {
        const newStudents = students.map((s) => ({
          user_id: user.id,
          class_id: newClass.id,
          name: s.name,
          nisn: s.nisn,
          is_bookmarked: s.is_bookmarked,
        }));

        await supabase.from("students").insert(newStudents);
      }

      return newClass;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      success("Berhasil!", "Kelas telah diduplikasi");
      if (user) logActivity({ userId: user.id, action: "menduplikasi kelas", entityType: "class", entityId: data.id, entityName: data.name });
    },
    onError: (error: Error) => {
      showError("Gagal menduplikasi kelas", error.message);
    },
  });

  return {
    classes: classesQuery.data || [],
    isLoading: classesQuery.isLoading,
    error: classesQuery.error,
    createClass,
    updateClass,
    deleteClass,
    duplicateClass,
    // Helper to check if filtering is active
    isFilteredByYear: filterByActiveYear && !!activeYearId,
    activeYearId,
  };
}

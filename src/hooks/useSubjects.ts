import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { logActivity } from "@/lib/activityLogger";

export interface Subject {
  id: string;
  user_id: string;
  class_id: string;
  academic_year_id: string | null;
  name: string;
  kkm: number;
  is_custom: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSubjectInput {
  class_id: string;
  name: string;
  kkm?: number;
  is_custom?: boolean;
  academic_year_id?: string;
}

export interface UpdateSubjectInput {
  id: string;
  name?: string;
  kkm?: number;
}

export const DEFAULT_SUBJECTS = [
  "Bahasa Indonesia",
  "Matematika",
  "IPAS",
  "Pendidikan Pancasila",
  "Bahasa Inggris",
  "Seni Budaya",
  "PJOK",
];

/**
 * Hook untuk mengelola mata pelajaran
 * 
 * @param classId - ID kelas untuk filter subjects
 * @param filterByActiveYear - Default TRUE: filter berdasarkan tahun ajaran aktif
 */
export function useSubjects(classId?: string, filterByActiveYear: boolean = true) {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeYearId } = useAcademicYear();

  // Subjects for specific class
  const subjectsQuery = useQuery({
    queryKey: ["subjects", classId, filterByActiveYear ? activeYearId : "all"],
    queryFn: async () => {
      if (!user || !classId) return [];
      
      let query = supabase
        .from("subjects")
        .select("*")
        .eq("class_id", classId);

      // Filter by academic year if column exists and filtering is enabled
      if (filterByActiveYear && activeYearId) {
        query = query.or(`academic_year_id.eq.${activeYearId},academic_year_id.is.null`);
      }

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;
      return data as Subject[];
    },
    enabled: !!user && !!classId,
  });

  // All subjects for current user (for reports, etc)
  const allSubjectsQuery = useQuery({
    queryKey: ["all_subjects", user?.id, filterByActiveYear ? activeYearId : "all"],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("subjects")
        .select("*, classes(name, academic_year_id)")
        .eq("user_id", user.id);

      const { data, error } = await query.order("name", { ascending: true });

      if (error) throw error;

      // Filter by active year (check both subject and class academic_year_id)
      let filteredData = data || [];
      if (filterByActiveYear && activeYearId) {
        filteredData = filteredData.filter((subject: any) => {
          const subjectYear = subject.academic_year_id;
          const classYear = subject.classes?.academic_year_id;
          return subjectYear === activeYearId || classYear === activeYearId || (!subjectYear && !classYear);
        });
      }

      return filteredData as (Subject & { classes: { name: string; academic_year_id: string | null } | null })[];
    },
    enabled: !!user,
  });

  const createSubject = useMutation({
    mutationFn: async (input: CreateSubjectInput) => {
      if (!user) throw new Error("User not authenticated");

      // Auto-assign academic year if not provided
      const yearId = input.academic_year_id || activeYearId;
      let resolvedKkm = input.kkm;

      if (resolvedKkm === undefined) {
        const { data: classData, error: classError } = await supabase
          .from("classes")
          .select("class_kkm")
          .eq("id", input.class_id)
          .single();

        if (classError) throw classError;
        resolvedKkm = classData?.class_kkm ?? 70;
      }

      const { data, error } = await supabase
        .from("subjects")
        .insert({
          user_id: user.id,
          class_id: input.class_id,
          name: input.name,
          kkm: resolvedKkm,
          is_custom: input.is_custom ?? false,
          academic_year_id: yearId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["all_subjects"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Mata pelajaran telah ditambahkan");
      if (user) logActivity({ userId: user.id, action: "menambahkan mata pelajaran", entityType: "subject", entityId: data.id, entityName: data.name });
    },
    onError: (error: Error) => {
      showError("Gagal menambah mata pelajaran", error.message);
    },
  });

  const updateSubject = useMutation({
    mutationFn: async (input: UpdateSubjectInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("subjects")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["all_subjects"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Mata pelajaran telah diperbarui");
      if (user) logActivity({ userId: user.id, action: "memperbarui mata pelajaran", entityType: "subject", entityId: data.id, entityName: data.name });
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui mata pelajaran", error.message);
    },
  });

  const deleteSubject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["all_subjects"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Mata pelajaran telah dihapus");
      if (user) logActivity({ userId: user.id, action: "menghapus mata pelajaran", entityType: "subject", entityId: id });
    },
    onError: (error: Error) => {
      showError("Gagal menghapus mata pelajaran", error.message);
    },
  });

  return {
    subjects: subjectsQuery.data || [],
    allSubjects: allSubjectsQuery.data || [],
    isLoading: subjectsQuery.isLoading || allSubjectsQuery.isLoading,
    error: subjectsQuery.error || allSubjectsQuery.error,
    createSubject,
    updateSubject,
    deleteSubject,
    // Helper
    isFilteredByYear: filterByActiveYear && !!activeYearId,
    activeYearId,
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

export interface Chapter {
  id: string;
  user_id: string;
  subject_id: string;
  name: string;
  order_index: number;
  semester_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateChapterInput {
  subject_id: string;
  name: string;
  order_index?: number;
  semester_id?: string;
}

export interface UpdateChapterInput {
  id: string;
  name?: string;
  order_index?: number;
}

/**
 * Hook untuk mengelola BAB pembelajaran
 * 
 * FILTERING BEHAVIOR:
 * - Chapters adalah data TRANSAKSIONAL, filter by SEMESTER
 * - Ketika switch semester, chapters akan "reset" (blank canvas untuk semester baru)
 * - Master data (subjects) tetap ada, hanya BAB yang berbeda per semester
 */
export function useChapters(
  subjectId?: string,
  options: {
    filterBySemester?: boolean;
    semesterOverride?: string | null; // For reports page with independent semester selector
  } = {}
) {
  const { filterBySemester = true, semesterOverride = null } = options;
  
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeSemesterId } = useAcademicYear();

  // Determine which semester to use
  const effectiveSemesterId = semesterOverride !== null ? semesterOverride : activeSemesterId;

  const chaptersQuery = useQuery({
    queryKey: ["chapters", subjectId, filterBySemester ? effectiveSemesterId : "all"],
    queryFn: async () => {
      if (!user || !subjectId) return [];
      
      let query = supabase
        .from("chapters")
        .select("*")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      // Filter by semester
      if (filterBySemester && effectiveSemesterId) {
        query = query.or(`semester_id.eq.${effectiveSemesterId},semester_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Chapter[];
    },
    enabled: !!user && !!subjectId,
  });

  const createChapter = useMutation({
    mutationFn: async (input: CreateChapterInput) => {
      if (!user) throw new Error("User not authenticated");

      // Auto-assign semester_id
      const semesterId = input.semester_id || activeSemesterId;

      const { data, error } = await supabase
        .from("chapters")
        .insert({
          user_id: user.id,
          subject_id: input.subject_id,
          name: input.name,
          order_index: input.order_index || 1,
          semester_id: semesterId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      success("Berhasil!", "BAB berhasil ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambahkan BAB", error.message);
    },
  });

  const createBulkChapters = useMutation({
    mutationFn: async (inputs: CreateChapterInput[]) => {
      if (!user) throw new Error("User not authenticated");

      const chaptersData = inputs.map((input, index) => ({
        user_id: user.id,
        subject_id: input.subject_id,
        name: input.name,
        order_index: input.order_index || index + 1,
        semester_id: input.semester_id || activeSemesterId,
      }));

      const { data, error } = await supabase
        .from("chapters")
        .insert(chaptersData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      success("Berhasil!", "BAB berhasil ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambahkan BAB", error.message);
    },
  });

  const updateChapter = useMutation({
    mutationFn: async (input: UpdateChapterInput) => {
      const { id, ...updateData } = input;
      const { data, error } = await supabase
        .from("chapters")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      success("Berhasil!", "BAB berhasil diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui BAB", error.message);
    },
  });

  const deleteChapter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chapters").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["chapters"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      success("Berhasil!", "BAB dan tugas terkait berhasil dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal menghapus BAB", error.message);
    },
  });

  return {
    chapters: chaptersQuery.data || [],
    isLoading: chaptersQuery.isLoading,
    error: chaptersQuery.error,
    createChapter,
    createBulkChapters,
    updateChapter,
    deleteChapter,
    // Helper
    isFilteredBySemester: filterBySemester && !!effectiveSemesterId,
    activeSemesterId: effectiveSemesterId,
  };
}

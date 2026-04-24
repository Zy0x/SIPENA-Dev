import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

export interface Assignment {
  id: string;
  user_id: string;
  chapter_id: string;
  name: string;
  order_index: number;
  semester_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAssignmentInput {
  chapter_id: string;
  name: string;
  order_index?: number;
  semester_id?: string;
}

export interface UpdateAssignmentInput {
  id: string;
  name?: string;
  order_index?: number;
}

/**
 * Hook untuk mengelola Tugas
 * 
 * FILTERING BEHAVIOR:
 * - Assignments adalah data TRANSAKSIONAL, filter by SEMESTER
 * - Ketika switch semester, assignments akan "reset" (blank canvas untuk semester baru)
 */
export function useAssignments(
  chapterId?: string,
  options: {
    filterBySemester?: boolean;
  } = {}
) {
  const { filterBySemester = true } = options;
  
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeSemesterId } = useAcademicYear();

  const assignmentsQuery = useQuery({
    queryKey: ["assignments", chapterId, filterBySemester ? activeSemesterId : "all"],
    queryFn: async () => {
      if (!user || !chapterId) return [];
      
      let query = supabase
        .from("assignments")
        .select("*")
        .eq("chapter_id", chapterId)
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      // Filter by semester
      if (filterBySemester && activeSemesterId) {
        query = query.or(`semester_id.eq.${activeSemesterId},semester_id.is.null`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!user && !!chapterId,
  });

  const createAssignment = useMutation({
    mutationFn: async (input: CreateAssignmentInput) => {
      if (!user) throw new Error("User not authenticated");

      // Auto-assign semester_id
      const semesterId = input.semester_id || activeSemesterId;

      const { data, error } = await supabase
        .from("assignments")
        .insert({
          user_id: user.id,
          chapter_id: input.chapter_id,
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
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all_assignments"] });
      success("Berhasil!", "Tugas berhasil ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambahkan tugas", error.message);
    },
  });

  const createBulkAssignments = useMutation({
    mutationFn: async (inputs: CreateAssignmentInput[]) => {
      if (!user) throw new Error("User not authenticated");

      const assignmentsData = inputs.map((input, index) => ({
        user_id: user.id,
        chapter_id: input.chapter_id,
        name: input.name,
        order_index: input.order_index || index + 1,
        semester_id: input.semester_id || activeSemesterId,
      }));

      const { data, error } = await supabase
        .from("assignments")
        .insert(assignmentsData)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all_assignments"] });
      success("Berhasil!", "Tugas berhasil ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambahkan tugas", error.message);
    },
  });

  const updateAssignment = useMutation({
    mutationFn: async (input: UpdateAssignmentInput) => {
      const { id, ...updateData } = input;
      const { data, error } = await supabase
        .from("assignments")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all_assignments"] });
      success("Berhasil!", "Tugas berhasil diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui tugas", error.message);
    },
  });

  const deleteAssignment = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      success("Berhasil!", "Tugas berhasil dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal menghapus tugas", error.message);
    },
  });

  return {
    assignments: assignmentsQuery.data || [],
    isLoading: assignmentsQuery.isLoading,
    error: assignmentsQuery.error,
    createAssignment,
    createBulkAssignments,
    updateAssignment,
    deleteAssignment,
    // Helper
    isFilteredBySemester: filterBySemester && !!activeSemesterId,
    activeSemesterId,
  };
}

/**
 * Hook to get all assignments for a subject (across all chapters)
 * Also filters by semester for transactional data
 */
export function useAllAssignments(
  subjectId?: string,
  options: {
    filterBySemester?: boolean;
    semesterOverride?: string | null; // For reports page with independent semester selector
  } = {}
) {
  const { filterBySemester = true, semesterOverride = null } = options;
  
  const { user } = useAuth();
  const { activeSemesterId } = useAcademicYear();

  // Determine which semester to use
  const effectiveSemesterId = semesterOverride !== null ? semesterOverride : activeSemesterId;

  const query = useQuery({
    queryKey: ["all_assignments", subjectId, filterBySemester ? effectiveSemesterId : "all"],
    queryFn: async () => {
      if (!user || !subjectId) return [];
      
      // First get all chapters for this subject
      let chaptersQuery = supabase
        .from("chapters")
        .select("id")
        .eq("subject_id", subjectId)
        .eq("user_id", user.id);

      // Filter chapters by semester
      if (filterBySemester && effectiveSemesterId) {
        chaptersQuery = chaptersQuery.or(`semester_id.eq.${effectiveSemesterId},semester_id.is.null`);
      }

      const { data: chapters, error: chaptersError } = await chaptersQuery;

      if (chaptersError) throw chaptersError;
      if (!chapters || chapters.length === 0) return [];

      const chapterIds = chapters.map(c => c.id);

      let assignmentsQuery = supabase
        .from("assignments")
        .select("*")
        .in("chapter_id", chapterIds)
        .eq("user_id", user.id)
        .order("order_index", { ascending: true });

      // Filter assignments by semester
      if (filterBySemester && effectiveSemesterId) {
        assignmentsQuery = assignmentsQuery.or(`semester_id.eq.${effectiveSemesterId},semester_id.is.null`);
      }

      const { data, error } = await assignmentsQuery;

      if (error) throw error;
      return data as Assignment[];
    },
    enabled: !!user && !!subjectId,
  });

  return {
    assignments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
  };
}

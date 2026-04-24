import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";

export interface Semester {
  id: string;
  user_id: string;
  academic_year_id: string;
  name: string;
  number: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSemesterInput {
  academic_year_id: string;
  name: string;
  number: number;
  is_active?: boolean;
}

/**
 * Hook untuk mengelola semester
 * 
 * @param academicYearId - Optional: filter semesters by specific year
 * @param filterByActiveYear - Default TRUE: if no academicYearId provided, use active year
 */
export function useSemesters(academicYearId?: string, filterByActiveYear: boolean = true) {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();
  const { activeYearId } = useAcademicYear();

  // Determine which year to filter by
  const filterYearId = academicYearId || (filterByActiveYear ? activeYearId : null);

  const semestersQuery = useQuery({
    queryKey: ["semesters", user?.id, filterYearId || "all"],
    queryFn: async () => {
      if (!user) return [];
      
      let query = supabase
        .from("semesters")
        .select("*")
        .eq("user_id", user.id)
        .order("number", { ascending: true });

      // Filter by year if provided
      if (filterYearId) {
        query = query.eq("academic_year_id", filterYearId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as Semester[];
    },
    enabled: !!user,
  });

  const activeSemester = semestersQuery.data?.find(s => s.is_active) || null;

  const createSemester = useMutation({
    mutationFn: async (input: CreateSemesterInput) => {
      if (!user) throw new Error("User not authenticated");

      // If setting as active, deactivate other semesters first
      if (input.is_active) {
        await supabase
          .from("semesters")
          .update({ is_active: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("semesters")
        .insert({
          user_id: user.id,
          academic_year_id: input.academic_year_id,
          name: input.name,
          number: input.number,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      success("Berhasil!", "Semester telah ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambah semester", error.message);
    },
  });

  const setActiveSemester = useMutation({
    mutationFn: async (semesterId: string) => {
      if (!user) throw new Error("User not authenticated");

      // Deactivate all semesters
      await supabase
        .from("semesters")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Activate selected semester
      const { data, error } = await supabase
        .from("semesters")
        .update({ is_active: true })
        .eq("id", semesterId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["semesters"] });
      success("Berhasil!", "Semester aktif diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui semester", error.message);
    },
  });

  return {
    semesters: semestersQuery.data || [],
    activeSemester,
    isLoading: semestersQuery.isLoading,
    error: semestersQuery.error,
    createSemester,
    setActiveSemester,
    // Helper
    isFilteredByYear: !!filterYearId,
    filterYearId,
  };
}

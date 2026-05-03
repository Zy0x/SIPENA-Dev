import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";

export interface AcademicYear {
  id: string;
  user_id: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAcademicYearInput {
  name: string;
  is_active?: boolean;
}

export interface UpdateAcademicYearInput {
  id: string;
  name?: string;
  is_active?: boolean;
}

export function useAcademicYears() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();

  const academicYearsQuery = useQuery({
    queryKey: ["academic_years", user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from("academic_years")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as AcademicYear[];
    },
    enabled: !!user,
  });

  const activeYear = academicYearsQuery.data?.find(y => y.is_active) || null;

  const createAcademicYear = useMutation({
    mutationFn: async (input: CreateAcademicYearInput) => {
      if (!user) throw new Error("User not authenticated");

      // If setting as active, deactivate other years first
      if (input.is_active) {
        await supabase
          .from("academic_years")
          .update({ is_active: false })
          .eq("user_id", user.id);
      }

      const { data, error } = await supabase
        .from("academic_years")
        .insert({
          user_id: user.id,
          name: input.name,
          is_active: input.is_active ?? true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      // Invalidate all related data when academic year changes
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      success("Berhasil!", "Tahun ajaran telah ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambah tahun ajaran", error.message);
    },
  });

  const updateAcademicYear = useMutation({
    mutationFn: async (input: UpdateAcademicYearInput) => {
      if (!user) throw new Error("User not authenticated");
      
      const { id, ...updates } = input;

      const { data, error } = await supabase
        .from("academic_years")
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      success("Berhasil!", "Tahun ajaran telah diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui tahun ajaran", error.message);
    },
  });

  const setActiveYear = useMutation({
    mutationFn: async (yearId: string) => {
      if (!user) throw new Error("User not authenticated");

      // Deactivate all years
      await supabase
        .from("academic_years")
        .update({ is_active: false })
        .eq("user_id", user.id);

      // Activate selected year
      const { data, error } = await supabase
        .from("academic_years")
        .update({ is_active: true })
        .eq("id", yearId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      // Invalidate all related data when academic year changes
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["grades"] });
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      success("Berhasil!", "Tahun ajaran aktif diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui tahun ajaran", error.message);
    },
  });

  const deleteAcademicYear = useMutation({
    mutationFn: async (yearId: string) => {
      if (!user) throw new Error("User not authenticated");

      // Check if this is the only year or is active
      const year = academicYearsQuery.data?.find(y => y.id === yearId);
      if (year?.is_active && (academicYearsQuery.data?.length || 0) > 1) {
        throw new Error("Tidak dapat menghapus tahun ajaran aktif. Aktifkan tahun ajaran lain terlebih dahulu.");
      }

      const { error } = await supabase
        .from("academic_years")
        .delete()
        .eq("id", yearId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic_years"] });
      success("Berhasil!", "Tahun ajaran telah dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal menghapus tahun ajaran", error.message);
    },
  });

  return {
    academicYears: academicYearsQuery.data || [],
    activeYear,
    isLoading: academicYearsQuery.isLoading,
    error: academicYearsQuery.error,
    createAcademicYear,
    updateAcademicYear,
    setActiveYear,
    deleteAcademicYear,
    refetch: academicYearsQuery.refetch,
  };
}

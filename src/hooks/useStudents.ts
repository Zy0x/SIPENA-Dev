import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";

export interface Student {
  id: string;
  user_id: string;
  class_id: string;
  name: string;
  nisn: string;
  is_bookmarked: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateStudentInput {
  class_id: string;
  name: string;
  nisn: string;
}

export interface UpdateStudentInput {
  id: string;
  name?: string;
  nisn?: string;
  is_bookmarked?: boolean;
}

export function useStudents(classId?: string) {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();

  const studentsQuery = useQuery({
    queryKey: ["students", classId],
    queryFn: async () => {
      if (!user || !classId) return [];
      
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("class_id", classId)
        .order("name", { ascending: true });

      if (error) throw error;
      return data as Student[];
    },
    enabled: !!user && !!classId,
  });

  const createStudent = useMutation({
    mutationFn: async (input: CreateStudentInput) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase
        .from("students")
        .insert({
          user_id: user.id,
          class_id: input.class_id,
          name: input.name,
          nisn: input.nisn,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Siswa baru telah ditambahkan");
    },
    onError: (error: Error) => {
      showError("Gagal menambah siswa", error.message);
    },
  });

  const createStudentsBatch = useMutation({
    mutationFn: async (students: CreateStudentInput[]) => {
      if (!user) throw new Error("User not authenticated");

      const studentsWithUserId = students.map((s) => ({
        ...s,
        user_id: user.id,
      }));

      const { data, error } = await supabase
        .from("students")
        .insert(studentsWithUserId)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", `${data.length} siswa telah ditambahkan`);
    },
    onError: (error: Error) => {
      showError("Gagal menambah siswa", error.message);
    },
  });

  const updateStudent = useMutation({
    mutationFn: async (input: UpdateStudentInput) => {
      const { id, ...updates } = input;
      const { data, error } = await supabase
        .from("students")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Data siswa telah diperbarui");
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui siswa", error.message);
    },
  });

  const deleteStudent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("students").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success("Berhasil!", "Siswa telah dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal menghapus siswa", error.message);
    },
  });

  const toggleBookmark = useMutation({
    mutationFn: async ({ id, is_bookmarked }: { id: string; is_bookmarked: boolean }) => {
      const { data, error } = await supabase
        .from("students")
        .update({ is_bookmarked })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success(
        data.is_bookmarked ? "Ditandai!" : "Tanda dihapus",
        data.is_bookmarked ? "Siswa ditambahkan ke favorit" : "Siswa dihapus dari favorit"
      );
    },
    onError: (error: Error) => {
      showError("Gagal memperbarui", error.message);
    },
  });

  return {
    students: studentsQuery.data || [],
    isLoading: studentsQuery.isLoading,
    error: studentsQuery.error,
    createStudent,
    createStudentsBatch,
    updateStudent,
    deleteStudent,
    toggleBookmark,
  };
}

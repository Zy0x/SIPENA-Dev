import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/contexts/AuthContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";

export interface SubjectImportSourceClass {
  id: string;
  name: string;
  academic_year_id: string | null;
  semester_id: string | null;
  class_kkm: number | null;
}

const SOURCE_CACHE_MS = 10 * 60 * 1000;

export function useSubjectImportSources(enabled: boolean) {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["subject-import-sources", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("classes")
        .select("id, name, academic_year_id, semester_id, class_kkm")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      return (data || []) as SubjectImportSourceClass[];
    },
    enabled: enabled && Boolean(user),
    staleTime: SOURCE_CACHE_MS,
    gcTime: SOURCE_CACHE_MS * 3,
  });

  return {
    sourceClasses: query.data || [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
  };
}

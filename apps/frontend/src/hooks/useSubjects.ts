import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { logActivity } from "@/lib/activityLogger";
import { buildSubjectBatchPlan, getReadySubjectCandidates } from "@/lib/subjectBatch";

export { DEFAULT_SUBJECT_GROUPS, DEFAULT_SUBJECTS } from "@/lib/defaultSubjects";

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

export interface CreateSubjectsBatchInput {
  class_id: string;
  subjects: Array<{
    name: string;
    kkm: number;
    is_custom?: boolean;
  }>;
  source?: "manual_batch" | "class_import";
  source_class_id?: string;
}

export interface ImportSubjectsFromClassInput {
  target_class_id: string;
  source_class_id: string;
  subject_ids: string[];
  source_semester_id?: string | null;
  target_semester_id?: string | null;
  include_structure: boolean;
}

export interface ImportSubjectsFromClassResult {
  created: number;
  skipped: number;
  chapters: number;
  assignments: number;
  formulas: number;
  links: number;
  subjects: Array<{
    sourceSubjectId: string;
    targetSubjectId: string;
    name: string;
  }>;
}

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

  const createSubjectsBatch = useMutation({
    mutationFn: async (input: CreateSubjectsBatchInput) => {
      if (!user) throw new Error("User not authenticated");
      if (input.subjects.length === 0) return { created: [] as Subject[], skipped: 0 };

      const { data: existingRows, error: existingError } = await supabase
        .from("subjects")
        .select("name")
        .eq("user_id", user.id)
        .eq("class_id", input.class_id);
      if (existingError) throw existingError;

      const plan = buildSubjectBatchPlan(
        input.subjects.map((subject, index) => ({
          id: `batch-${index}`,
          name: subject.name,
          kkm: subject.kkm,
          isCustom: subject.is_custom ?? false,
        })),
        (existingRows || []).map((subject) => subject.name),
      );
      const ready = getReadySubjectCandidates(plan);
      const skipped = plan.length - ready.length;

      if (ready.length === 0) return { created: [] as Subject[], skipped };
      if (!activeYearId) throw new Error("Tidak ada tahun ajaran aktif.");

      const { data, error } = await supabase
        .from("subjects")
        .insert(ready.map((subject) => ({
          user_id: user.id,
          class_id: input.class_id,
          academic_year_id: activeYearId,
          name: subject.name,
          kkm: subject.kkm,
          is_custom: subject.isCustom,
        })))
        .select();
      if (error) throw error;

      return { created: (data || []) as Subject[], skipped };
    },
    onSuccess: ({ created, skipped }, input) => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      queryClient.invalidateQueries({ queryKey: ["all_subjects"] });
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      success(
        "Mapel Berhasil Ditambahkan",
        skipped > 0
          ? `${created.length} mapel ditambahkan dan ${skipped} duplikat/data tidak valid dilewati.`
          : `${created.length} mapel ditambahkan ke kelas.`,
      );
      if (user && created.length > 0) {
        void logActivity({
          userId: user.id,
          action: input.source === "class_import" ? "mengimpor mata pelajaran" : "menambahkan mata pelajaran batch",
          entityType: "subject",
          entityName: `${created.length} mata pelajaran`,
          metadata: {
            count: created.length,
            skipped,
            source: input.source || "manual_batch",
            sourceClassId: input.source_class_id || null,
          },
        });
      }
    },
    onError: (error: Error) => {
      showError("Gagal menambahkan mata pelajaran", error.message);
    },
  });

  const importSubjectsFromClass = useMutation({
    mutationFn: async (input: ImportSubjectsFromClassInput) => {
      if (!user) throw new Error("User not authenticated");

      const { data, error } = await supabase.rpc("import_subjects_from_class", {
        p_target_class_id: input.target_class_id,
        p_source_class_id: input.source_class_id,
        p_subject_ids: input.subject_ids,
        p_source_semester_id: input.source_semester_id || null,
        p_target_semester_id: input.target_semester_id || null,
        p_include_structure: input.include_structure,
      });

      if (error) throw error;
      return data as unknown as ImportSubjectsFromClassResult;
    },
    onSuccess: (result, input) => {
      [
        "subjects",
        "all_subjects",
        "chapters",
        "assignments",
        "all_assignments",
        "grade_formula_settings",
        "shared_links",
        "activity_logs",
        "student-rankings",
      ].forEach((queryKey) => queryClient.invalidateQueries({ queryKey: [queryKey] }));

      success(
        "Import Mapel Selesai",
        result.skipped > 0
          ? `${result.created} mapel ditambahkan dan ${result.skipped} mapel yang sudah ada dilewati.`
          : `${result.created} mapel berhasil ditambahkan ke kelas tujuan.`,
      );

      void logActivity({
        userId: user.id,
        action: "mengimpor mata pelajaran dari kelas lain",
        entityType: "subject",
        entityName: `${result.created} mata pelajaran`,
        metadata: {
          sourceClassId: input.source_class_id,
          targetClassId: input.target_class_id,
          includeStructure: input.include_structure,
          created: result.created,
          skipped: result.skipped,
          chapters: result.chapters,
          assignments: result.assignments,
          formulas: result.formulas,
          links: result.links,
        },
      });
    },
    onError: (error: Error) => {
      const friendlyMessage = error.message.includes("semester_required")
        ? "Pilih semester sumber dan semester tujuan sebelum menyalin struktur."
        : error.message.includes("class_not_found") || error.message.includes("forbidden")
          ? "Kelas sumber atau tujuan tidak tersedia untuk akun ini."
          : error.message;
      showError("Import mapel gagal", friendlyMessage);
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
    createSubjectsBatch,
    importSubjectsFromClass,
    updateSubject,
    deleteSubject,
    // Helper
    isFilteredByYear: filterByActiveYear && !!activeYearId,
    activeYearId,
  };
}

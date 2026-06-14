import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import {
  DEFAULT_FORMULA,
  normalizeFormula,
  normalizeReportRounding,
  type CustomFormula,
  type ReportRoundingSetting,
} from "@/lib/gradeFormula";
import type { Json } from "@/infrastructure/supabase/supabase.types";

export interface GradeFormulaSetting {
  id: string;
  user_id: string;
  subject_id: string;
  formula: CustomFormula;
  created_at: string;
  updated_at: string;
}

const queryKey = (userId?: string, subjectId?: string) => ["grade_formula_settings", userId || "anonymous", subjectId || "none"];

export function useGradeFormulaSettings(subjectId?: string, fallbackFormula?: CustomFormula | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const formulaQuery = useQuery({
    queryKey: queryKey(user?.id, subjectId),
    queryFn: async () => {
      if (!user?.id || !subjectId) return null;

      const { data, error } = await (supabase as any)
        .from("grade_formula_settings")
        .select("*")
        .eq("user_id", user.id)
        .eq("subject_id", subjectId)
        .maybeSingle();

      if (error) {
        console.warn("[GradeFormulaSettings] Query error:", error.message);
        return null;
      }

      return data as (Omit<GradeFormulaSetting, "formula"> & { formula: unknown }) | null;
    },
    enabled: !!user?.id && !!subjectId,
    retry: false,
  });

  const formula = normalizeFormula(formulaQuery.data?.formula ?? fallbackFormula ?? DEFAULT_FORMULA);

  const saveFormulaMutation = useMutation({
    mutationFn: async (nextFormula: CustomFormula) => {
      if (!user?.id || !subjectId) throw new Error("Mata pelajaran belum dipilih");

      const normalized = normalizeFormula(nextFormula);
      const payload = {
        user_id: user.id,
        subject_id: subjectId,
        formula: normalized,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await (supabase as any)
        .from("grade_formula_settings")
        .upsert(payload, { onConflict: "user_id,subject_id" })
        .select("*")
        .single();

      if (error) throw error;
      return data as GradeFormulaSetting;
    },
    onMutate: async (nextFormula) => {
      if (!user?.id || !subjectId) return;
      const key = queryKey(user.id, subjectId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (current: any) => ({
        ...(current || {}),
        user_id: user.id,
        subject_id: subjectId,
        formula: normalizeFormula(nextFormula),
      }));
      return { previous, key };
    },
    onError: (_error, _variables, context) => {
      if (context?.key) {
        queryClient.setQueryData(context.key, context.previous);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grade_formula_settings"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["report-grades-all"] });
    },
  });

  const saveRoundingForSubjectsMutation = useMutation({
    mutationFn: async ({
      subjectIds,
      reportRounding,
    }: {
      subjectIds: string[];
      reportRounding: ReportRoundingSetting;
    }) => {
      if (!user?.id) throw new Error("User belum masuk");

      const uniqueSubjectIds = Array.from(new Set(subjectIds.filter(Boolean)));
      if (uniqueSubjectIds.length === 0) throw new Error("Tidak ada mata pelajaran yang dapat diperbarui");

      const normalizedRounding = normalizeReportRounding(reportRounding);
      const { data: existingRows, error: selectError } = await supabase
        .from("grade_formula_settings")
        .select("subject_id, formula")
        .eq("user_id", user.id)
        .in("subject_id", uniqueSubjectIds);

      if (selectError) throw selectError;

      const existingFormulaBySubject = new Map(
        ((existingRows || []) as Array<{ subject_id: string; formula: unknown }>).map((row) => [
          row.subject_id,
          normalizeFormula(row.formula),
        ]),
      );
      const updatedAt = new Date().toISOString();
      const payload = uniqueSubjectIds.map((targetSubjectId) => ({
        user_id: user.id,
        subject_id: targetSubjectId,
        formula: {
          ...normalizeFormula(existingFormulaBySubject.get(targetSubjectId) ?? DEFAULT_FORMULA),
          reportRounding: normalizedRounding,
        } as unknown as Json,
        updated_at: updatedAt,
      }));

      const { data, error } = await supabase
        .from("grade_formula_settings")
        .upsert(payload, { onConflict: "user_id,subject_id" })
        .select("*");

      if (error) throw error;
      return data as unknown as GradeFormulaSetting[];
    },
    onSuccess: (settings) => {
      settings.forEach((setting) => {
        queryClient.setQueryData(queryKey(setting.user_id, setting.subject_id), setting);
      });
      queryClient.invalidateQueries({ queryKey: ["grade_formula_settings"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["report-grades-all"] });
    },
  });

  useEffect(() => {
    if (!user?.id) return;

    const invalidateFormula = () => {
      queryClient.invalidateQueries({ queryKey: ["grade_formula_settings"] });
      queryClient.invalidateQueries({ queryKey: ["student-rankings"] });
      queryClient.invalidateQueries({ queryKey: ["report-grades-all"] });
    };

    const channel = supabase
      .channel(`grade-formula-settings:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grade_formula_settings", filter: `user_id=eq.${user.id}` },
        invalidateFormula,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user?.id]);

  return {
    formula,
    setting: formulaQuery.data,
    isLoading: formulaQuery.isLoading,
    isSaving: saveFormulaMutation.isPending || saveRoundingForSubjectsMutation.isPending,
    saveFormula: saveFormulaMutation.mutateAsync,
    saveRoundingForSubjects: saveRoundingForSubjectsMutation.mutateAsync,
    isSavingRoundingForSubjects: saveRoundingForSubjectsMutation.isPending,
  };
}

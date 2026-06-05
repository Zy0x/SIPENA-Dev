import { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import {
  applyGradeTableColorScheme,
  GRADE_TABLE_COLOR_SCHEME_EVENT,
  isSelectableGradeTableColorScheme,
  normalizeGradeTableColorScheme,
  readStoredGradeTableColorScheme,
  type GradeTableColorSchemeId,
} from "@/lib/gradeTableColorSchemes";

interface UserGradeTableColorPreferenceRow {
  grade_table_color_scheme?: string | null;
}

function isRecoverablePreferenceError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const message = "message" in error ? String((error as { message?: unknown }).message || "") : "";
  const code = "code" in error ? String((error as { code?: unknown }).code || "") : "";

  return (
    code === "42703"
    || code === "PGRST204"
    || message.includes("grade_table_color_scheme")
    || message.includes("schema cache")
  );
}

export function useGradeTableColorScheme() {
  const { user } = useAuth();
  const [colorScheme, setColorScheme] = useState<GradeTableColorSchemeId>(() => readStoredGradeTableColorScheme());
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(user?.id));

  const syncScheme = useCallback((value?: string | null) => {
    const normalized = normalizeGradeTableColorScheme(value);
    setColorScheme(normalized);
    applyGradeTableColorScheme(normalized);
    return normalized;
  }, []);

  useEffect(() => {
    const handleSchemeChange = (event: Event) => {
      const nextScheme = normalizeGradeTableColorScheme((event as CustomEvent<GradeTableColorSchemeId>).detail);
      setColorScheme(nextScheme);
    };

    window.addEventListener(GRADE_TABLE_COLOR_SCHEME_EVENT, handleSchemeChange);
    return () => window.removeEventListener(GRADE_TABLE_COLOR_SCHEME_EVENT, handleSchemeChange);
  }, []);

  useEffect(() => {
    if (!user?.id) {
      setIsLoading(false);
      syncScheme(readStoredGradeTableColorScheme());
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const loadPreference = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("grade_table_color_scheme")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted) return;

      if (error) {
        if (!isRecoverablePreferenceError(error)) {
          console.warn("Failed to load grade table color scheme:", error);
        }
        setIsLoading(false);
        return;
      }

      syncScheme((data as UserGradeTableColorPreferenceRow | null)?.grade_table_color_scheme);
      setIsLoading(false);
    };

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, [syncScheme, user?.id]);

  const selectColorScheme = useCallback(async (value: GradeTableColorSchemeId) => {
    if (!isSelectableGradeTableColorScheme(value)) {
      return colorScheme;
    }

    const normalized = syncScheme(value);
    if (!user?.id) return normalized;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("user_preferences")
        .upsert({
          user_id: user.id,
          grade_table_color_scheme: normalized,
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

      if (error) throw error;
      return normalized;
    } finally {
      setIsSaving(false);
    }
  }, [colorScheme, syncScheme, user?.id]);

  return {
    colorScheme,
    isLoading,
    isSaving,
    selectColorScheme,
  };
}

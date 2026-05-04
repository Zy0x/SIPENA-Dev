import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import {
  applyThemePreference,
  readStoredThemePreference,
  themePreferenceFromRow,
} from "@/hooks/useThemes";

interface UserThemePreferencePayload {
  theme_mode?: string | null;
  theme_palette?: string | null;
}

export function ThemePreferenceSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) {
      applyThemePreference(readStoredThemePreference(), { emit: false });
      return;
    }

    let isMounted = true;

    const applyUserPreference = (payload?: UserThemePreferencePayload | null) => {
      if (!payload) return;
      applyThemePreference(themePreferenceFromRow(payload));
    };

    const loadPreference = async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("theme_mode, theme_palette")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!isMounted || error) return;
      applyUserPreference(data);
    };

    loadPreference();

    const channel = supabase
      .channel(`theme-preference-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_preferences",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") {
            applyThemePreference(readStoredThemePreference());
            return;
          }

          applyUserPreference(payload.new as UserThemePreferencePayload);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return null;
}

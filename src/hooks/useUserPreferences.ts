import { useState, useEffect, useCallback } from "react";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";

export interface UserPreferences {
  id?: string;
  user_id: string;
  theme_mode: "light" | "dark";
  theme_palette: string;
  has_completed_onboarding: boolean;
  onboarding_completed_at?: string;
}

const DEFAULT_PREFERENCES: Omit<UserPreferences, "user_id"> = {
  theme_mode: "light",
  theme_palette: "default",
  has_completed_onboarding: false,
};

export function useUserPreferences() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Fetch preferences
  const fetchPreferences = useCallback(async () => {
    if (!user) {
      setPreferences(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching preferences:", error);
        return;
      }

      if (data) {
        setPreferences(data as UserPreferences);
      } else {
        // No preferences yet - user is new
        setPreferences(null);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
    } finally {
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  // Create initial preferences (for new users)
  const createPreferences = useCallback(
    async (themeMode: "light" | "dark") => {
      if (!user) return null;

      try {
        const newPrefs = {
          user_id: user.id,
          theme_mode: themeMode,
          theme_palette: "default",
          has_completed_onboarding: false,
        };

        const { data, error } = await supabase
          .from("user_preferences")
          .insert(newPrefs)
          .select()
          .single();

        if (error) {
          console.error("Error creating preferences:", error);
          return null;
        }

        setPreferences(data as UserPreferences);
        return data;
      } catch (error) {
        console.error("Error creating preferences:", error);
        return null;
      }
    },
    [user]
  );

  // Update preferences
  const updatePreferences = useCallback(
    async (updates: Partial<Omit<UserPreferences, "id" | "user_id">>) => {
      if (!user || !preferences?.id) return null;

      try {
        const { data, error } = await supabase
          .from("user_preferences")
          .update(updates)
          .eq("id", preferences.id)
          .select()
          .single();

        if (error) {
          console.error("Error updating preferences:", error);
          return null;
        }

        setPreferences(data as UserPreferences);
        return data;
      } catch (error) {
        console.error("Error updating preferences:", error);
        return null;
      }
    },
    [user, preferences]
  );

  // Mark onboarding as complete
  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    if (!preferences?.id) {
      // Create preferences first if they don't exist
      const newPrefs = await createPreferences("light");
      if (newPrefs) {
        await supabase
          .from("user_preferences")
          .update({
            has_completed_onboarding: true,
            onboarding_completed_at: new Date().toISOString(),
          })
          .eq("id", (newPrefs as UserPreferences).id);
      }
    } else {
      await updatePreferences({
        has_completed_onboarding: true,
        onboarding_completed_at: new Date().toISOString(),
      });
    }
  }, [user, preferences, createPreferences, updatePreferences]);

  // Check if user needs onboarding
  const needsOnboarding = !isLoading && isInitialized && user && preferences === null;

  // Check if tours should be shown (only for users who haven't completed onboarding)
  const shouldShowTours = preferences?.has_completed_onboarding === false;

  return {
    preferences,
    isLoading,
    isInitialized,
    needsOnboarding,
    shouldShowTours,
    createPreferences,
    updatePreferences,
    completeOnboarding,
    refetch: fetchPreferences,
  };
}

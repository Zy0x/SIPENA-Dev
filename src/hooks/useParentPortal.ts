import { useState, useCallback, useEffect } from "react";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";

export interface PortalConfig {
  id?: string;
  class_id: string;
  title: string;
  description: string;
  show_grades: boolean;
  show_attendance: boolean;
  show_rankings: boolean;
  show_assignments: boolean;
  show_predictions: boolean;
  subject_ids: string[];
  semester_filter: string;
  attendance_period: string;
  share_code: string;
  is_active: boolean;
  expires_at: string;
  view_count: number;
  created_at?: string;
}

export function useParentPortal() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<PortalConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConfigs = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("parent_portal_configs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (data && !error) {
        setConfigs(data as PortalConfig[]);
      }
    } catch (err) {
      console.error("Failed to load portal configs:", err);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  const createConfig = useCallback(async (config: Omit<PortalConfig, "id" | "share_code" | "view_count" | "created_at">) => {
    if (!user) return null;
    
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let code = "";
    for (let i = 0; i < 8; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    // Strip granular detail fields (tidak ada di schema PortalConfig interface)
    const { grades_detail, attendance_detail, rankings_detail, ...dbConfig } = config as any;

    try {
      const { data, error } = await (supabase as any)
        .from("parent_portal_configs")
        .insert({
          ...dbConfig,
          grades_detail: grades_detail ?? null,
          attendance_detail: attendance_detail ?? null,
          rankings_detail: rankings_detail ?? null,
          user_id: user.id,
          share_code: code,
          share_url: `${window.location.origin}/portal/${code}`,
          view_count: 0,
          // ✅ Konversi string kosong ke null untuk timestamp
          expires_at: dbConfig.expires_at || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Portal create error:", error.message, error.details, error.hint);
        throw error;
      }
      await fetchConfigs();
      return data as PortalConfig;
    } catch (err: any) {
      console.error("Failed to create portal config:", err);
      // Return the actual error message for better debugging
      throw new Error(err?.message || "Gagal membuat portal");
    }
  }, [user, fetchConfigs]);

  const updateConfig = useCallback(async (id: string, updates: Partial<PortalConfig>) => {
    try {
      const { error } = await (supabase as any)
        .from("parent_portal_configs")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error("Failed to update portal config:", err);
      return false;
    }
  }, [fetchConfigs]);

  const deleteConfig = useCallback(async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from("parent_portal_configs")
        .delete()
        .eq("id", id);

      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error("Failed to delete portal config:", err);
      return false;
    }
  }, [fetchConfigs]);

  const toggleActive = useCallback(async (id: string, isActive: boolean) => {
    return updateConfig(id, { is_active: isActive });
  }, [updateConfig]);

  return {
    configs,
    isLoading,
    createConfig,
    updateConfig,
    deleteConfig,
    toggleActive,
    refetch: fetchConfigs,
  };
}

/**
 * Hook for guest portal access (no auth required)
 */
export function usePortalData(shareCode: string) {
  const [config, setConfig] = useState<PortalConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareCode) return;

    const fetchPortal = async () => {
      setIsLoading(true);
      try {
        const { data, error: fetchError } = await (supabase as any)
          .from("parent_portal_configs")
          .select("*")
          .eq("share_code", shareCode)
          .eq("is_active", true)
          .maybeSingle();

        if (fetchError) throw fetchError;
        if (!data) {
          setError("Portal tidak ditemukan atau sudah tidak aktif");
          return;
        }

        // Check expiry
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setError("Link portal sudah kedaluwarsa");
          return;
        }

        setConfig(data as PortalConfig);

        // Increment view count
        await (supabase as any)
          .from("parent_portal_configs")
          .update({ view_count: (data.view_count || 0) + 1 })
          .eq("id", data.id);
      } catch (err) {
        console.error("Failed to fetch portal:", err);
        setError("Gagal memuat data portal");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPortal();
  }, [shareCode]);

  return { config, isLoading, error };
}

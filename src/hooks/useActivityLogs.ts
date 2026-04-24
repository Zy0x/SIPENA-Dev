import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";

export interface ActivityLog {
  id: string;
  user_id: string;
  actor_type: "owner" | "guest";
  actor_name: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface CreateActivityLogInput {
  user_id: string;
  actor_type: "owner" | "guest";
  actor_name?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_name?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export function useActivityLogs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const activityLogsQuery = useQuery({
    queryKey: ["activity_logs", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) {
        console.warn("Activity logs fetch error (table may not exist):", error.message);
        return [];
      }
      return data as ActivityLog[];
    },
    enabled: !!user?.id,
    refetchInterval: 15000, // Refetch every 15 seconds for near-realtime
    retry: 1,
    staleTime: 10000,
  });

  const createActivityLog = useMutation({
    mutationFn: async (input: CreateActivityLogInput) => {
      const { data, error } = await supabase
        .from("activity_logs")
        .insert([{
          user_id: input.user_id,
          actor_type: input.actor_type,
          actor_name: input.actor_name || null,
          action: input.action,
          entity_type: input.entity_type,
          entity_id: input.entity_id || null,
          entity_name: input.entity_name || null,
          metadata: input.metadata || {},
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });

  return {
    activityLogs: activityLogsQuery.data || [],
    isLoading: activityLogsQuery.isLoading,
    createActivityLog,
  };
}

// Hook for creating activity logs (can be used without auth - for guests)
export function useCreateActivityLog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateActivityLogInput) => {
      const { data, error } = await supabase
        .from("activity_logs")
        .insert([{
          user_id: input.user_id,
          actor_type: input.actor_type,
          actor_name: input.actor_name || null,
          action: input.action,
          entity_type: input.entity_type,
          entity_id: input.entity_id || null,
          entity_name: input.entity_name || null,
          metadata: input.metadata || {},
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity_logs"] });
    },
  });
}

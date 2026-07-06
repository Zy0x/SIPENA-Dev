import { useInfiniteQuery } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/app/providers/AuthProvider";

export interface AuditLogEntry {
  id: string;
  user_id: string;
  class_id: string;
  student_id: string | null;
  record_id: string | null;
  action: string;
  before_data: any;
  after_data: any;
  reason_code: string | null;
  applied_rule_ids: any;
  metadata: any;
  actor_id: string | null;
  actor_type: string;
  created_at: string;
  delegated_from?: string | null;
  
  // Joined fields if available
  students?: { name: string } | null;
  actor?: { email: string; user_metadata: any } | null;
  delegator?: { email: string; user_metadata: any } | null;
}

const PAGE_SIZE = 50;

export function useAuditLogs(classId: string | null) {
  const { user } = useAuth();

  return useInfiniteQuery({
    queryKey: ["attendance_v2_audit_logs", classId],
    queryFn: async ({ pageParam = 0 }) => {
      if (!user || !classId) return [];

      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await (supabase as any)
        .from("attendance_v2_audit_logs")
        .select(`
          *,
          students ( name )
        `)
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) {
        console.error("Failed to fetch audit logs:", error);
        throw error;
      }

      return data as AuditLogEntry[];
    },
    getNextPageParam: (lastPage, allPages) => {
      return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
    },
    initialPageParam: 0,
    enabled: !!user && !!classId,
  });
}

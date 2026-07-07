import { useEffect } from "react";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";

export function useAttendanceRealtime(
  classId: string | null,
  userId: string | undefined,
  onExternalUpdate: (payload: any) => void
) {
  useEffect(() => {
    if (!classId || !userId) return;

    const channel = (supabase as any)
      .channel(`public:attendance_v2_records:${classId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "attendance_v2_records",
          filter: `class_id=eq.${classId}`,
        },
        (payload: any) => {
          // Hanya peduli pada INSERT atau UPDATE
          if (payload.eventType === "INSERT" || payload.eventType === "UPDATE") {
            const newRecord = payload.new;
            // Jika yang mengubah adalah user lain ATAU jika source-nya delegated
            if (newRecord && newRecord.user_id !== userId) {
              onExternalUpdate(newRecord);
            }
          }
        }
      )
      .subscribe();

    return () => {
      (supabase as any).removeChannel(channel);
    };
  }, [classId, userId, onExternalUpdate]);
}

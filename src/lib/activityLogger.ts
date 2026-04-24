/**
 * Activity Logger Utility
 * Logs user actions to the activity_logs table in Supabase
 */
import { supabaseExternal as supabase } from "@/lib/supabase-external";

export interface ActivityLogInput {
  userId: string;
  actorType?: "owner" | "guest";
  actorName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  entityName?: string;
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Log an activity to the database.
 * Fire-and-forget — errors are silently caught to avoid disrupting user flow.
 */
export async function logActivity(input: ActivityLogInput): Promise<void> {
  try {
    await supabase.from("activity_logs").insert([{
      user_id: input.userId,
      actor_type: input.actorType || "owner",
      actor_name: input.actorName || null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId || null,
      entity_name: input.entityName || null,
      metadata: input.metadata || {},
    }]);
  } catch {
    // Silent fail — activity logging should never block user actions
  }
}

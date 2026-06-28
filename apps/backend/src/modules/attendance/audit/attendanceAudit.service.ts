import { supabaseAdmin } from "../../../database/supabase";

export interface AttendanceBackendAuditEvent {
  id: string;
  at: string;
  action: string;
  actor: string | null;
  metadata: Record<string, unknown>;
}

export class AttendanceAuditService {
  private events: AttendanceBackendAuditEvent[] = [];

  append(action: string, actor: string | null, metadata: Record<string, unknown>): AttendanceBackendAuditEvent {
    const event = {
      id: `attendance-backend-${Date.now()}-${this.events.length + 1}`,
      at: new Date().toISOString(),
      action,
      actor,
      metadata,
    };
    this.events.push(event);

    // Persist asynchronously in background to avoid blocking main path
    if (actor) {
      supabaseAdmin
        .from("activity_logs")
        .insert({
          user_id: actor,
          action,
          entity_type: "attendance",
          metadata,
        })
        .then(({ error }) => {
          if (error) {
            console.error("Failed to write activity_log:", error);
          }
        });
    }

    return event;
  }

  async logV2AuditEvent(params: {
    userId: string;
    classId: string;
    studentId?: string;
    recordId?: string;
    action: string;
    beforeData?: any;
    afterData?: any;
    reasonCode?: string;
    appliedRuleIds?: string[];
    metadata?: Record<string, any>;
  }) {
    const { error } = await supabaseAdmin
      .from("attendance_v2_audit_logs")
      .insert({
        user_id: params.userId,
        class_id: params.classId,
        student_id: params.studentId || null,
        record_id: params.recordId || null,
        action: params.action,
        before_data: params.beforeData || {},
        after_data: params.afterData || {},
        reason_code: params.reasonCode || null,
        applied_rule_ids: params.appliedRuleIds || [],
        metadata: params.metadata || {},
        actor_id: params.userId,
        actor_type: "owner",
      });

    if (error) {
      console.error("Failed to insert V2 audit log:", error);
    }
  }

  list(): AttendanceBackendAuditEvent[] {
    return this.events.map((event) => ({ ...event, metadata: { ...event.metadata } }));
  }
}

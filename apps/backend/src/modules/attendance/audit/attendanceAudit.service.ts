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
    return event;
  }

  list(): AttendanceBackendAuditEvent[] {
    return this.events.map((event) => ({ ...event, metadata: { ...event.metadata } }));
  }
}

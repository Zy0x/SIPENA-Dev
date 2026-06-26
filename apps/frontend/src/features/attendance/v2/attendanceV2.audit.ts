import { AttendanceAuditEventCanonical } from "./attendanceV2.types";

/**
 * createAuditEvent
 * Instantiates a structured canonical audit event log.
 */
export function createAuditEvent(
  actor: string,
  action: AttendanceAuditEventCanonical["action"],
  classId: string,
  studentId: string | undefined,
  date: string | undefined,
  beforeState: Record<string, any> | null,
  afterState: Record<string, any> | null,
  reasonCode: string,
  metadata?: Record<string, any>
): AttendanceAuditEventCanonical {
  return {
    id: `audit-${Math.random().toString(36).substring(2, 11)}`,
    timestamp: new Date().toISOString(),
    actor,
    action,
    classId,
    studentId,
    date,
    beforeState,
    afterState,
    reasonCode,
    metadata
  };
}

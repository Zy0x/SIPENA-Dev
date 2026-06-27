import type { AttendanceRecordCanonical } from "../canonical/canonical.types";
import type { AttendanceAuditEventCanonical, AttendanceV2AuditAction } from "./attendanceV2.types";

function createAuditId(): string {
  return `audit-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAuditEvent(
  actor: string,
  action: AttendanceV2AuditAction,
  classId: string,
  studentId: string | undefined,
  date: string | undefined,
  beforeState: AttendanceRecordCanonical | AttendanceRecordCanonical[] | null,
  afterState: AttendanceRecordCanonical | AttendanceRecordCanonical[] | null,
  reasonCode: string,
  metadata?: Record<string, unknown>
): AttendanceAuditEventCanonical {
  return {
    id: createAuditId(),
    timestamp: new Date().toISOString(),
    actor,
    action,
    classId,
    studentId,
    date,
    beforeState,
    afterState,
    reasonCode,
    metadata,
  };
}

import {
  AttendanceRecordCanonical,
  AttendanceStatusCode
} from "../canonical/canonical.types";

export interface AttendanceAuditEventCanonical {
  id: string;
  timestamp: string; // ISO format
  actor: string; // User ID / Name
  action: "CREATE" | "UPDATE" | "DELETE" | "BULK_UPDATE" | "NOTE_UPDATE";
  classId: string;
  studentId?: string;
  date?: string;
  beforeState: Record<string, any> | null;
  afterState: Record<string, any> | null;
  reasonCode: string;
  metadata?: Record<string, any>;
}

export interface ShadowComparisonReport {
  match: boolean;
  dateChecked: string;
  mismatchCount: number;
  mismatches: {
    studentId: string;
    date: string;
    v1Status: AttendanceStatusCode | null;
    v2Status: AttendanceStatusCode | null;
    mismatchFields: string[];
  }[];
}

export interface MutationValidationResult {
  valid: boolean;
  reasonCode: string;
  issues: string[];
}

export interface AttendanceV2PatchResult {
  success: boolean;
  reasonCode: string;
  appliedRuleIds: string[];
  updatedRecord: AttendanceRecordCanonical | null;
  auditEvent: AttendanceAuditEventCanonical | null;
  validationIssues: string[];
}

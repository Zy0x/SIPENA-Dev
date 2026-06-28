import { supabaseAdmin } from "../../../database/supabase";
import type { AttendanceShadowReport, AttendanceRecordPatch, AttendanceStatusCode, ShadowComparisonReport } from "../attendance.types";

export class AttendanceShadowService {
  async compareAndLog(
    patch: AttendanceRecordPatch,
    v1Status: AttendanceStatusCode | null,
    v2Status: AttendanceStatusCode | null,
    userId: string
  ): Promise<void> {
    const mismatch = v1Status !== v2Status;

    if (mismatch) {
      // 1. Log to activity_logs
      await supabaseAdmin.from("activity_logs").insert({
        user_id: userId,
        action: "PRESENSI_SHADOW_MISMATCH",
        entity_type: "attendance",
        metadata: {
          patch,
          v1Status,
          v2Status,
          mismatchFields: ["status"],
        },
      });

      // 2. Log to attendance_v2_audit_logs
      const report: ShadowComparisonReport = {
        match: false,
        dateChecked: new Date().toISOString(),
        mismatchCount: 1,
        mismatches: [
          {
            studentId: patch.studentId,
            date: patch.date,
            v1Status,
            v2Status,
            mismatchFields: ["status"],
          },
        ],
      };

      await supabaseAdmin.from("attendance_v2_audit_logs").insert({
        user_id: userId,
        class_id: patch.classId,
        student_id: patch.studentId,
        action: "PRESENSI_SHADOW_MISMATCH",
        before_data: { status: v1Status },
        after_data: { status: v2Status },
        reason_code: "SHADOW_DRIFT_DETECTED",
        metadata: { report },
        actor_id: userId,
        actor_type: "system",
      });
    }
  }

  async getReport(): Promise<AttendanceShadowReport> {
    const { data, error } = await supabaseAdmin
      .from("attendance_v2_audit_logs")
      .select("*")
      .eq("action", "PRESENSI_SHADOW_MISMATCH")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch shadow reports:", error);
      return { enabled: true, mismatchCount: 0, reports: [] };
    }

    const reports: any[] = (data || []).map((row: any) => row.metadata?.report).filter(Boolean);

    return {
      enabled: true,
      mismatchCount: reports.reduce((acc, r) => acc + r.mismatchCount, 0),
      reports,
    };
  }
}

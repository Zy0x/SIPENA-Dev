import type {
  AttendanceDailySummaryQuery,
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceExportDatasetCanonical,
  AttendanceRecordPatch,
  AttendanceRuntimeContext,
  AttendanceValidationIssue,
} from "./attendance.types";
import { createExportDataset, summarizeDaily } from "./canonical/attendanceCanonical";
import { AttendanceAuditService } from "./audit/attendanceAudit.service";
import { AttendanceShadowService } from "./shadow/attendanceShadow.service";
import { AttendanceV1Adapter } from "./v1/attendanceV1.adapter";
import { AttendanceV2Adapter } from "./v2/attendanceV2.adapter";
import { supabaseAdmin } from "../../database/supabase";

// Import reusable frontend V2 engine validation
import { validatePatchMutation } from "../../../../frontend/src/features/attendance/v2/attendanceV2.validation";

export class AttendanceService {
  private audit = new AttendanceAuditService();
  private shadow = new AttendanceShadowService();
  private v1 = new AttendanceV1Adapter();
  private v2 = new AttendanceV2Adapter();

  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    return runtime.engine === "v2" ? this.v2.getDataset(query, runtime) : this.v1.getDataset(query, runtime);
  }

  async getDailySummary(query: AttendanceDailySummaryQuery, runtime: AttendanceRuntimeContext) {
    const result = await this.getDataset(query, runtime);
    return {
      summary: summarizeDaily(result.dataset.records, query.date),
      issues: result.issues,
    };
  }

  async getMonthlySummary(query: AttendanceDatasetQuery, runtime: AttendanceRuntimeContext) {
    const result = await this.getDataset(query, runtime);
    return {
      summary: result.dataset.monthlySummary ?? [],
      issues: result.issues,
    };
  }

  async getExportDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ exportDataset: AttendanceExportDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    const result = await this.getDataset(query, runtime);
    return {
      exportDataset: createExportDataset(result.dataset),
      issues: result.issues,
    };
  }

  async applyPatch(
    patch: AttendanceRecordPatch,
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    const userId = runtime.user?.id;
    if (!userId) {
      return {
        statusCode: 401,
        error: { code: "UNAUTHORIZED", message: "User tidak terautentikasi." },
      };
    }

    // 1. Jalankan V2 validation jika runtime engine === "v2"
    if (runtime.engine === "v2") {
      // Dapatkan dataset V2 saat ini dari database
      const monthStr = patch.date.substring(0, 7); // "YYYY-MM"
      const { dataset, issues: fetchIssues } = await this.v2.getDataset(
        { classId: patch.classId, month: monthStr },
        runtime
      );

      if (fetchIssues.some((issue) => issue.severity === "error")) {
        return {
          statusCode: 400,
          error: {
            code: "ATTENDANCE_V2_VALIDATION_PRECONDITIONS_FAILED",
            message: "Gagal memuat prasyarat data untuk evaluasi aturan V2.",
            details: fetchIssues,
          },
        };
      }

      // Cari status hari kalender
      const day = dataset.days.find((d) => d.date === patch.date);
      const isLocked = dataset.locks.some((l) => l.isLocked);
      const calendarDay = day
        ? {
            date: day.date,
            dayOfWeek: day.dayOfWeek,
            isEffective: day.isEffective,
            isHoliday: !day.isEffective,
            isEffectiveDay: day.isEffective,
            holidayName: day.holidayName || null,
            eventName: day.eventName || null,
            blockedWriteState: isLocked,
            eventPriority: 7, // ConflictPriority.DEFAULT_WEEKDAY
            reasonCodes: [],
            metadata: {
              isLocked,
              lockInfo: null,
              appliedOverrideIds: [],
              appliedEventIds: [],
              appliedHolidayIds: [],
              uiHint: isLocked ? "locked" : "effective",
            },
          }
        : null;

      const validation = validatePatchMutation(dataset, patch as any, runtime.writesEnabled, calendarDay as any);
      if (!validation.valid) {
        this.audit.append("MUTATION_REJECTED", userId, { patch, reason: validation.reasonCode });
        return {
          statusCode: 400,
          error: {
            code: "ATTENDANCE_V2_RULE_VIOLATION",
            message: "Aturan bisnis presensi V2 menolak perubahan ini.",
            details: validation.validationIssues,
          },
        };
      }
    }

    // 2. Terapkan mutation write ke Supabase
    try {
      // Cari record yang ada di database
      const { data: existingData } = await supabaseAdmin
        .from("attendance_records")
        .select("id")
        .eq("class_id", patch.classId)
        .eq("student_id", patch.studentId)
        .eq("date", patch.date)
        .maybeSingle();

      const existing = existingData as { id: string } | null;

      if (patch.status === null) {
        // Hapus record jika status null
        if (existing) {
          const { error: deleteError } = await supabaseAdmin
            .from("attendance_records")
            .delete()
            .eq("id", existing.id);

          if (deleteError) throw deleteError;
          this.audit.append("RECORD_DELETED", userId, { patch, recordId: existing.id });
        }
        return { statusCode: 200, data: { success: true, action: "delete" } };
      }

      const updatePayload: Record<string, any> = {
        status: patch.status,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      };
      if (patch.note !== undefined) {
        updatePayload.note = patch.note;
      }

      if (existing) {
        // Update record yang ada
        const { data, error: updateError } = await supabaseAdmin
          .from("attendance_records")
          .update(updatePayload)
          .eq("id", existing.id)
          .select()
          .single();

        if (updateError) throw updateError;
        this.audit.append("RECORD_UPDATED", userId, { patch, recordId: existing.id });
        return { statusCode: 200, data };
      } else {
        // Insert record baru
        const { data, error: insertError } = await supabaseAdmin
          .from("attendance_records")
          .insert({
            class_id: patch.classId,
            student_id: patch.studentId,
            date: patch.date,
            status: patch.status,
            note: patch.note || null,
            created_at: new Date().toISOString(),
            created_by: userId,
            updated_at: new Date().toISOString(),
            updated_by: userId,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        this.audit.append("RECORD_INSERTED", userId, { patch, recordId: data.id });
        return { statusCode: 200, data };
      }
    } catch (err: any) {
      this.audit.append("DATABASE_WRITE_FAILED", userId, { patch, error: err.message || err });
      return {
        statusCode: 500,
        error: {
          code: "DATABASE_WRITE_FAILED",
          message: `Gagal menulis perubahan data ke database: ${err.message || err}`,
        },
      };
    }
  }

  getShadowReport(runtime: AttendanceRuntimeContext) {
    if (!runtime.isDebug && !runtime.isAdmin) {
      return {
        statusCode: 403,
        error: {
          code: "ATTENDANCE_SHADOW_FORBIDDEN",
          message: "Shadow report hanya tersedia untuk admin/debug.",
        },
      };
    }

    return { statusCode: 200, data: this.shadow.getReport() };
  }
}

export const attendanceService = new AttendanceService();

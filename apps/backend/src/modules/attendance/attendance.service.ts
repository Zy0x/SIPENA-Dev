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

export class AttendanceService {
  private audit = new AttendanceAuditService();
  private shadow = new AttendanceShadowService();
  private v1 = new AttendanceV1Adapter();
  private v2 = new AttendanceV2Adapter();

  getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): { dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] } {
    return runtime.engine === "v2" ? this.v2.getDataset(query) : this.v1.getDataset(query);
  }

  getDailySummary(query: AttendanceDailySummaryQuery, runtime: AttendanceRuntimeContext) {
    const result = this.getDataset(query, runtime);
    return {
      summary: summarizeDaily(result.dataset.records, query.date),
      issues: result.issues,
    };
  }

  getMonthlySummary(query: AttendanceDatasetQuery, runtime: AttendanceRuntimeContext) {
    const result = this.getDataset(query, runtime);
    return {
      summary: result.dataset.monthlySummary ?? [],
      issues: result.issues,
    };
  }

  getExportDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): { exportDataset: AttendanceExportDatasetCanonical; issues: AttendanceValidationIssue[] } {
    const result = this.getDataset(query, runtime);
    return {
      exportDataset: createExportDataset(result.dataset),
      issues: result.issues,
    };
  }

  applyPatch(_patch: AttendanceRecordPatch, runtime: AttendanceRuntimeContext) {
    if (!runtime.writesEnabled) {
      this.audit.append("WRITE_BLOCKED", null, { reason: "writes-disabled", engine: runtime.engine, mode: runtime.mode });
      return {
        statusCode: 423,
        error: {
          code: "ATTENDANCE_WRITE_DISABLED",
          message: "Backend write presensi dinonaktifkan sampai storage V2, RLS, dan cutover disetujui.",
        },
      };
    }

    return {
      statusCode: 501,
      error: {
        code: "ATTENDANCE_V2_PERSISTENCE_NOT_CONFIGURED",
        message: "V2 persistence belum dikonfigurasi. Tidak ada perubahan data disimpan.",
      },
    };
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

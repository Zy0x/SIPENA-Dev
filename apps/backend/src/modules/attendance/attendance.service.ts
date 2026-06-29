import type {
  AttendanceDailySummaryQuery,
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceExportDatasetCanonical,
  AttendanceRecordPatch,
  AttendanceRuntimeContext,
  AttendanceValidationIssue,
  AttendanceLockPatch,
  AttendanceHolidayPatch,
  AttendanceDayEventPatch,
  AttendanceNotePatchBody,
} from "./attendance.types";
import { createExportDataset, summarizeDaily } from "./canonical/attendanceCanonical";
import { AttendanceAuditService } from "./audit/attendanceAudit.service";
import { AttendanceShadowService } from "./shadow/attendanceShadow.service";
import { AttendanceV1Adapter } from "./v1/attendanceV1.adapter";
import { AttendanceV2Adapter } from "./v2/attendanceV2.adapter";
import { createSupabaseUserClient, supabaseAdmin } from "../../database/supabase";
import { parse, startOfMonth, endOfMonth, format } from "date-fns";



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

    // 1. V2 Active Mode Write
    if (runtime.engine === "v2" && runtime.mode === "active") {
      if (!runtime.writesEnabled) {
        return {
          statusCode: 403,
          error: { code: "ATTENDANCE_V2_WRITE_DISABLED", message: "Jalur penulisan V2 dimatikan." },
        };
      }

      // Verifikasi relasi murid-kelas untuk integritas akademik
      const { data: studentMatch, error: studentMatchError } = await supabaseAdmin
        .from("students")
        .select("class_id")
        .eq("id", patch.studentId)
        .maybeSingle();

      if (studentMatchError || !studentMatch || studentMatch.class_id !== patch.classId) {
        return {
          statusCode: 400,
          error: {
            code: "ATTENDANCE_STUDENT_CLASS_MISMATCH",
            message: "Siswa tidak terdaftar di kelas yang bersangkutan.",
          },
        };
      }

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

      // Validasi lock period
      const isLocked = dataset.locks.some((l) => l.isLocked);
      if (isLocked) {
        return {
          statusCode: 400,
          error: {
            code: "ATTENDANCE_LOCKED_PERIOD",
            message: "Periode presensi ini telah dikunci.",
          },
        };
      }

      try {
        const result = await this.v2.applyPatch(patch, runtime);
        return { statusCode: 200, data: result };
      } catch (err: any) {
        return {
          statusCode: 500,
          error: {
            code: "ATTENDANCE_PERSISTENCE_FAILED",
            message: `Gagal menyimpan presensi V2: ${err.message || err}`,
          },
        };
      }
    }

    // 2. V1 Legacy Mode Write with Shadow comparisons
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
      let finalData: any = null;

      if (patch.status === null) {
        if (existing) {
          const { error: deleteError } = await supabaseAdmin
            .from("attendance_records")
            .delete()
            .eq("id", existing.id);

          if (deleteError) throw deleteError;
          this.audit.append("RECORD_DELETED", userId, { patch, recordId: existing.id });
        }
        finalData = { success: true, action: "delete" };
      } else {
        const updatePayload: Record<string, any> = {
          status: patch.status,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        };
        if (patch.note !== undefined) {
          updatePayload.note = patch.note;
        }

        if (existing) {
          const { data, error: updateError } = await supabaseAdmin
            .from("attendance_records")
            .update(updatePayload)
            .eq("id", existing.id)
            .select()
            .single();

          if (updateError) throw updateError;
          this.audit.append("RECORD_UPDATED", userId, { patch, recordId: existing.id });
          finalData = data;
        } else {
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
          finalData = data;
        }
      }

      // V2 Shadow Comparison in background
      if (runtime.mode === "shadow") {
        const monthStr = patch.date.substring(0, 7);
        this.v2.getDataset({ classId: patch.classId, month: monthStr }, runtime).then(({ dataset }) => {
          const v2Rec = dataset.records.find((r) => r.studentId === patch.studentId && r.date === patch.date);
          const v2Status = v2Rec?.status || null;
          this.shadow.compareAndLog(patch, patch.status, v2Status, userId);
        }).catch(err => console.error("Error during shadow mode comparison:", err));
      }

      return { statusCode: 200, data: finalData };
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

  async applyBulkPatch(
    patches: AttendanceRecordPatch[],
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    const results = [];
    for (const patch of patches) {
      const res = await this.applyPatch(patch, runtime);
      if (res.statusCode !== 200) {
        return res; // fail fast on any error
      }
      results.push(res.data);
    }
    return { statusCode: 200, data: results };
  }

  async updateNote(
    body: AttendanceNotePatchBody,
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    if (runtime.engine === "v2") {
      try {
        const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;

        // 1. Verifikasi relasi murid-kelas untuk mencegah manipulasi data
        const { data: studentMatch, error: studentMatchError } = await supabaseAdmin
          .from("students")
          .select("class_id")
          .eq("id", body.studentId)
          .maybeSingle();

        if (studentMatchError || !studentMatch || studentMatch.class_id !== body.classId) {
          return {
            statusCode: 400,
            error: {
              code: "ATTENDANCE_STUDENT_CLASS_MISMATCH",
              message: "Siswa tidak terdaftar di kelas yang bersangkutan.",
            },
          };
        }

        // 2. Verifikasi status lock period
        const monthStr = body.date.substring(0, 7);
        const { dataset } = await this.v2.getDataset({ classId: body.classId, month: monthStr }, runtime);
        if (dataset.locks.some((l) => l.isLocked)) {
          return {
            statusCode: 400,
            error: {
              code: "ATTENDANCE_LOCKED_PERIOD",
              message: "Periode presensi ini telah dikunci.",
            },
          };
        }

        const { data, error } = await client
          .from("attendance_v2_records")
          .update({ note: body.note, updated_at: new Date().toISOString(), updated_by: runtime.user?.id })
          .eq("class_id", body.classId)
          .eq("student_id", body.studentId)
          .eq("date", body.date)
          .eq("user_id", runtime.user?.id)
          .select()
          .maybeSingle();

        if (error) throw error;
        return { statusCode: 200, data };
      } catch (err: any) {
        return {
          statusCode: 500,
          error: { code: "NOTE_UPDATE_FAILED", message: `Gagal memperbarui catatan V2: ${err.message}` },
        };
      }
    }

    // Fallback V1
    try {
      const { data, error } = await supabaseAdmin
        .from("attendance_records")
        .update({ note: body.note, updated_at: new Date().toISOString(), updated_by: runtime.user?.id })
        .eq("class_id", body.classId)
        .eq("student_id", body.studentId)
        .eq("date", body.date)
        .select()
        .maybeSingle();

      if (error) throw error;
      return { statusCode: 200, data };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "NOTE_UPDATE_FAILED", message: `Gagal memperbarui catatan V1: ${err.message}` },
      };
    }
  }

  async toggleLock(
    patch: AttendanceLockPatch,
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    try {
      const res = await this.v2.toggleLock(patch, runtime);
      return { statusCode: 200, data: res };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "LOCK_MUTATION_FAILED", message: `Gagal mengunci periode V2: ${err.message}` },
      };
    }
  }

  async toggleHoliday(
    patch: AttendanceHolidayPatch,
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    try {
      const res = await this.v2.toggleHoliday(patch, runtime);
      return { statusCode: 200, data: res };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "HOLIDAY_MUTATION_FAILED", message: `Gagal mengatur hari libur V2: ${err.message}` },
      };
    }
  }

  async upsertDayEvent(
    patch: AttendanceDayEventPatch,
    runtime: AttendanceRuntimeContext
  ): Promise<{ statusCode: number; data?: any; error?: any }> {
    try {
      const res = await this.v2.upsertDayEvent(patch, runtime);
      return { statusCode: 200, data: res };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "DAY_EVENT_MUTATION_FAILED", message: `Gagal memproses event hari V2: ${err.message}` },
      };
    }
  }

  async getAuditLogs(classId: string, runtime: AttendanceRuntimeContext) {
    try {
      const logs = await this.v2.getAuditLogs(classId, runtime);
      return { statusCode: 200, data: logs };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "AUDIT_FETCH_FAILED", message: `Gagal memuat log audit: ${err.message}` },
      };
    }
  }

  async getShadowReport(runtime: AttendanceRuntimeContext) {
    try {
      const report = await this.shadow.getReport();
      return { statusCode: 200, data: report };
    } catch (err: any) {
      return {
        statusCode: 500,
        error: { code: "SHADOW_FETCH_FAILED", message: `Gagal memuat shadow report: ${err.message}` },
      };
    }
  }

  async promoteV2ToV1(classId: string, month: string, runtime: AttendanceRuntimeContext) {
    const userId = runtime.user?.id;
    if (!userId) {
      return {
        statusCode: 401,
        error: { code: "UNAUTHORIZED", message: "User tidak terautentikasi." },
      };
    }

    try {
      const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;

      // 1. Ambil data dari V2 tables
      const parsedMonth = parse(month, "yyyy-MM", new Date());
      const monthStart = format(startOfMonth(parsedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(parsedMonth), "yyyy-MM-dd");

      const [recordsRes, holidaysRes, dayEventsRes, locksRes] = await Promise.all([
        client
          .from("attendance_v2_records")
          .select("*")
          .eq("class_id", classId)
          .eq("user_id", userId)
          .gte("date", monthStart)
          .lte("date", monthEnd),
        client
          .from("attendance_v2_holidays")
          .select("*")
          .eq("user_id", userId)
          .gte("date", monthStart)
          .lte("date", monthEnd),
        client
          .from("attendance_v2_day_events")
          .select("*")
          .eq("user_id", userId)
          .gte("date", monthStart)
          .lte("date", monthEnd)
          .then((res: any) => res, () => ({ data: [] })),
        client
          .from("attendance_v2_locks")
          .select("*")
          .eq("class_id", classId)
          .eq("month", month)
          .maybeSingle(),
      ]);

      const v2Records = recordsRes.data || [];
      const v2Holidays = holidaysRes.data || [];
      const v2DayEvents = dayEventsRes.data || [];
      const v2Lock = locksRes.data;

      // 2. Tulis data ke V1 tables (Upsert/Merge)
      // A. Records: hapus records V1 yang ada lalu masukkan records dari V2
      if (v2Records.length > 0) {
        // Hapus V1 records lama untuk class dan month ini
        const { error: deleteRecError } = await client
          .from("attendance_records")
          .delete()
          .eq("class_id", classId)
          .gte("date", monthStart)
          .lte("date", monthEnd);

        if (deleteRecError) throw deleteRecError;

        // Insert records baru
        const newRecords = v2Records.map(r => ({
          class_id: classId,
          student_id: r.student_id,
          date: r.date,
          status: r.status,
          note: r.note,
          created_by: userId,
          updated_by: userId,
        }));

        const { error: insertRecError } = await client
          .from("attendance_records")
          .insert(newRecords);

        if (insertRecError) throw insertRecError;
      }

      // B. Holidays: upsert per tanggal untuk user ini
      for (const holiday of v2Holidays) {
        const { data: existingHoliday } = await client
          .from("attendance_holidays")
          .select("id")
          .eq("user_id", userId)
          .eq("date", holiday.date)
          .maybeSingle();

        if (existingHoliday) {
          await client
            .from("attendance_holidays")
            .update({ description: holiday.description })
            .eq("id", existingHoliday.id);
        } else {
          await client
            .from("attendance_holidays")
            .insert({
              user_id: userId,
              date: holiday.date,
              description: holiday.description,
            });
        }
      }

      // C. Day Events: upsert per tanggal untuk user ini
      for (const event of v2DayEvents) {
        const { data: existingEvent } = await client
          .from("attendance_day_events")
          .select("id")
          .eq("user_id", userId)
          .eq("date", event.date)
          .maybeSingle();

        if (existingEvent) {
          await client
            .from("attendance_day_events")
            .update({
              label: event.label,
              description: event.description,
              color: event.color,
            })
            .eq("id", existingEvent.id);
        } else {
          await client
            .from("attendance_day_events")
            .insert({
              user_id: userId,
              date: event.date,
              label: event.label,
              description: event.description,
              color: event.color,
            });
        }
      }

      // D. Locks: upsert
      if (v2Lock) {
        const { data: existingLock } = await client
          .from("attendance_locks")
          .select("id")
          .eq("class_id", classId)
          .eq("month", month)
          .maybeSingle();

        if (existingLock) {
          await client
            .from("attendance_locks")
            .update({
              is_locked: v2Lock.is_locked,
              locked_at: v2Lock.locked_at,
              locked_by: v2Lock.locked_by,
            })
            .eq("id", existingLock.id);
        } else {
          await client
            .from("attendance_locks")
            .insert({
              class_id: classId,
              user_id: userId,
              month: month,
              is_locked: v2Lock.is_locked,
              locked_at: v2Lock.locked_at,
              locked_by: v2Lock.locked_by,
            });
        }
      }

      // Log audit
      this.audit.append("V2_PROMOTED_TO_V1", userId, { classId, month, recordsCount: v2Records.length });

      return { statusCode: 200, data: { success: true, recordsPromoted: v2Records.length } };
    } catch (err: any) {
      this.audit.append("V2_PROMOTION_FAILED", userId, { classId, month, error: err.message || err });
      return {
        statusCode: 500,
        error: {
          code: "PROMOTION_FAILED",
          message: `Gagal melakukan merge total V2 ke V1: ${err.message || err}`,
        },
      };
    }
  }
}

export const attendanceService = new AttendanceService();

import type {
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceRuntimeContext,
  AttendanceValidationIssue,
  AttendanceRecordCanonical,
  AttendanceStudentCanonical,
  AttendanceHolidayCanonical,
  AttendanceCalendarEventCanonical,
  AttendanceLockCanonical,
  AttendanceRecordPatch,
  AttendanceLockPatch,
  AttendanceHolidayPatch,
  AttendanceDayEventPatch,
} from "../attendance.types";
import { createSupabaseUserClient, supabaseAdmin } from "../../../database/supabase";
import { parse, startOfYear, endOfYear, format } from "date-fns";

export class AttendanceV2Adapter {
  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    const { classId, month } = query;
    const userId = runtime.user?.id;
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;

    if (!userId) {
      return {
        dataset: {
          classId,
          month,
          students: [],
          records: [],
          days: [],
          holidays: [],
          dayEvents: [],
          locks: [],
        },
        issues: [
          {
            severity: "error",
            code: "UNAUTHORIZED",
            message: "User tidak terautentikasi untuk mengambil data.",
          },
        ],
      };
    }

    try {
      // Hitung rentang tahun berdasarkan parameter month (YYYY-MM)
      const parsedMonth = parse(month, "yyyy-MM", new Date());
      const yearStart = format(startOfYear(parsedMonth), "yyyy-MM-dd");
      const yearEnd = format(endOfYear(parsedMonth), "yyyy-MM-dd");

      // Jalankan query paralel ke Supabase (menggunakan V2 tables)
      const [studentsRes, recordsRes, holidaysRes, dayEventsRes, locksRes] = await Promise.all([
        client
          .from("students")
          .select("id, name, nisn")
          .eq("class_id", classId),
        client
          .from("attendance_v2_records")
          .select("id, student_id, class_id, date, status, note, created_at, updated_at")
          .eq("class_id", classId)
          .eq("user_id", userId)
          .gte("date", yearStart)
          .lte("date", yearEnd),
        client
          .from("attendance_v2_holidays")
          .select("id, date, description, is_national, class_id")
          .eq("user_id", userId)
          .or(`class_id.eq.${classId},class_id.is.null`)
          .gte("date", yearStart)
          .lte("date", yearEnd),
        client
          .from("attendance_v2_day_events")
          .select("id, date, label, description, color")
          .eq("user_id", userId)
          .gte("date", yearStart)
          .lte("date", yearEnd)
          .then(
            (res: any) => res,
            () => ({ data: [] })
          ), // Graceful recovery jika table/kolom error
        client
          .from("attendance_v2_locks")
          .select("class_id, month, is_locked, locked_at, locked_by")
          .eq("class_id", classId)
          .eq("month", month)
          .maybeSingle()
          .then((res) => {
            if (res.error) return { data: null };
            return res;
          }),
      ]);

      const students = (studentsRes.data || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        nisn: s.nisn || "",
      })) as AttendanceStudentCanonical[];

      const records = (recordsRes.data || []).map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        classId: r.class_id,
        date: r.date,
        status: r.status,
        note: r.note || null,
        createdAt: r.created_at || null,
        updatedAt: r.updated_at || null,
      })) as AttendanceRecordCanonical[];

      const holidays = (holidaysRes.data || []).map((h: any) => ({
        id: h.id,
        date: h.date,
        description: h.description || "",
        isNational: h.is_national || false,
      })) as AttendanceHolidayCanonical[];

      const dayEvents = ((dayEventsRes as any).data || []).map((e: any) => ({
        id: e.id,
        date: e.date,
        label: e.label,
        description: e.description || null,
        color: e.color || "blue",
      })) as AttendanceCalendarEventCanonical[];

      const locks = locksRes.data
        ? [
            {
              classId: locksRes.data.class_id,
              month: locksRes.data.month,
              isLocked: locksRes.data.is_locked,
              lockedAt: locksRes.data.locked_at || null,
              lockedBy: locksRes.data.locked_by || null,
            } as AttendanceLockCanonical,
          ]
        : [];

      return {
        dataset: {
          classId,
          month,
          students,
          records,
          days: [], // Day types kosong sama persis seperti V1
          holidays,
          dayEvents,
          locks,
        },
        issues: [],
      };
    } catch (err: any) {
      return {
        dataset: {
          classId,
          month,
          students: [],
          records: [],
          days: [],
          holidays: [],
          dayEvents: [],
          locks: [],
        },
        issues: [
          {
            severity: "error",
            code: "DATABASE_FETCH_FAILED",
            message: `Gagal memuat data presensi dari database: ${err.message || err}`,
          },
        ],
      };
    }
  }

  // Mutasi tulis V2 replika V1 (menulis ke tabel V2 secara terisolasi)
  async applyPatch(patch: AttendanceRecordPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const userId = runtime.user?.id;

    if (!userId) throw new Error("User ID is required for V2 writes");

    const { data, error } = await client.rpc("upsert_attendance_record", {
      p_user_id: userId,
      p_class_id: patch.classId,
      p_student_id: patch.studentId,
      p_date: patch.date,
      p_status: patch.status,
      p_note: patch.note || null,
      p_source: "manual",
    });

    if (error) {
      throw new Error(`Supabase RPC Error: ${error.message}`);
    }

    const json = data as { success: boolean; error_code?: string; message?: string; action?: string; record_id?: string };
    if (!json.success) {
      throw new Error(json.message || `RPC Error: ${json.error_code}`);
    }

    return json;
  }

  async toggleLock(patch: AttendanceLockPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const userId = runtime.user?.id;

    if (!userId) throw new Error("User ID is required for V2 lock");

    const { data: existing } = await client
      .from("attendance_v2_locks")
      .select("id")
      .eq("class_id", patch.classId)
      .eq("month", patch.month)
      .maybeSingle();

    if (existing) {
      const { data, error } = await client
        .from("attendance_v2_locks")
        .update({
          is_locked: patch.isLocked,
          locked_at: patch.isLocked ? new Date().toISOString() : null,
          locked_by: patch.isLocked ? userId : null,
        })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    } else {
      const { data, error } = await client
        .from("attendance_v2_locks")
        .insert({
          user_id: userId,
          class_id: patch.classId,
          month: patch.month,
          is_locked: patch.isLocked,
          locked_at: patch.isLocked ? new Date().toISOString() : null,
          locked_by: patch.isLocked ? userId : null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    }
  }

  async toggleHoliday(patch: AttendanceHolidayPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const userId = runtime.user?.id;

    if (!userId) throw new Error("User ID is required for V2 holiday");

    const query = client
      .from("attendance_v2_holidays")
      .select("id")
      .eq("date", patch.date)
      .eq("user_id", userId);

    if (patch.classId) {
      query.eq("class_id", patch.classId);
    } else {
      query.is("class_id", null);
    }

    const { data: existing } = await query.maybeSingle();

    if (existing) {
      const { error } = await client
        .from("attendance_v2_holidays")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      return { success: true, action: "deleted" };
    } else {
      // Validasi: Batas maksimum 30 hari libur kustom per tahun ajaran
      const yearStart = `${new Date(patch.date).getFullYear()}-01-01`;
      const yearEnd = `${new Date(patch.date).getFullYear()}-12-31`;

      const { count } = await client
        .from("attendance_v2_holidays")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .gte("date", yearStart)
        .lte("date", yearEnd);

      if (count && count >= 30) {
        throw new Error("Batas maksimum 30 hari libur custom per tahun ajaran tercapai.");
      }

      const { data, error } = await client
        .from("attendance_v2_holidays")
        .insert({
          user_id: userId,
          date: patch.date,
          description: patch.description || "Hari Libur",
          is_national: false,
          class_id: patch.classId || null,
        })
        .select()
        .single();
      if (error) throw error;
      return { data, action: "added" };
    }
  }

  async upsertDayEvent(patch: AttendanceDayEventPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const userId = runtime.user?.id;

    if (!userId) throw new Error("User ID is required for V2 day event");

    if (patch.action === "delete") {
      const { error } = await client
        .from("attendance_v2_day_events")
        .delete()
        .eq("date", patch.date)
        .eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    } else {
      const { data: existing } = await client
        .from("attendance_v2_day_events")
        .select("id")
        .eq("date", patch.date)
        .eq("user_id", userId)
        .maybeSingle();

      if (existing) {
        const { data, error } = await client
          .from("attendance_v2_day_events")
          .update({
            label: patch.label,
            description: patch.description,
            color: patch.color,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await client
          .from("attendance_v2_day_events")
          .insert({
            user_id: userId,
            date: patch.date,
            label: patch.label,
            description: patch.description,
            color: patch.color,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    }
  }

  async getAuditLogs(classId: string, runtime: AttendanceRuntimeContext) {
    return [];
  }
}

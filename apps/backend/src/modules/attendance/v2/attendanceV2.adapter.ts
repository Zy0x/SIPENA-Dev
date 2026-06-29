import type {
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceRuntimeContext,
  AttendanceValidationIssue,
  AttendanceStudentCanonical,
  AttendanceRecordCanonical,
  AttendanceHolidayCanonical,
  AttendanceCalendarEventCanonical,
  AttendanceLockCanonical,
  AttendanceRecordPatch,
  AttendanceLockPatch,
  AttendanceHolidayPatch,
  AttendanceDayEventPatch,
} from "../attendance.types";
import { generateCalendarDays } from "../../../../../frontend/src/features/attendance/v2/calendar/calendarEngine";
import { evaluateAttendanceRules } from "../../../../../frontend/src/features/attendance/v2/rules/ruleEngine";
import { computeSummaryBundle } from "../../../../../frontend/src/features/attendance/v2/attendanceV2.engine";
import { createSupabaseUserClient, supabaseAdmin } from "../../../database/supabase";
import { parse, startOfMonth, endOfMonth, format, startOfYear, endOfYear } from "date-fns";

export class AttendanceV2Adapter {
  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    const { classId, month, workDayFormat } = query;
    const resolvedWorkDayFormat = (workDayFormat === "5days" || workDayFormat === "6days") ? workDayFormat : "6days";
    const userId = runtime.user?.id;
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;

    if (!userId) {
      return {
        dataset: { classId, month, students: [], records: [], days: [], holidays: [], dayEvents: [], locks: [], workDayFormat: resolvedWorkDayFormat },
        issues: [{ severity: "error", code: "UNAUTHORIZED", message: "User tidak terautentikasi untuk mengambil data." }],
      };
    }

    try {
      const parsedMonth = parse(month, "yyyy-MM", new Date());
      const yearStart = format(startOfYear(parsedMonth), "yyyy-MM-dd");
      const yearEnd = format(endOfYear(parsedMonth), "yyyy-MM-dd");

      // Query parallel to V2 database tables
      const [studentsRes, recordsRes, holidaysRes, dayEventsRes, locksRes] = await Promise.all([
        client.from("students").select("id, name, nisn").eq("class_id", classId),
        client.from("attendance_v2_records").select("id, student_id, class_id, date, status, note, created_at, updated_at").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd),
        client.from("attendance_v2_holidays").select("id, date, description, is_national").eq("user_id", userId).gte("date", yearStart).lte("date", yearEnd),
        client.from("attendance_v2_day_events").select("id, date, label, description, color, priority").eq("user_id", userId).gte("date", yearStart).lte("date", yearEnd).then(r => r, () => ({ data: [] })),
        client.from("attendance_v2_locks").select("class_id, month, is_locked, locked_at, locked_by").eq("class_id", classId).eq("month", month).maybeSingle(),
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
        priority: e.priority || 0,
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

      // 3. Generate Calendar Days using V2 Calendar Engine
      const startDate = format(startOfMonth(parsedMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(parsedMonth), "yyyy-MM-dd");

      const calendarDays = generateCalendarDays({
        startDate,
        endDate,
        classId,
        workDayFormat: resolvedWorkDayFormat,
        events: dayEvents.map((e: any) => ({ ...e, classId: null, schoolId: null })),
        holidays: holidays.map((h) => ({ ...h, isNational: h.isNational })),
        overrides: [],
        locks: locks.map((l) => ({ ...l })),
      });

      const mappedDays = calendarDays.map((day) => ({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        isWeekend: day.isWeekend,
        isEffective: day.isEffective,
        holidayName: day.holidayName || undefined,
        eventName: day.eventName || undefined,
        reasonCodes: day.reasonCodes || [],
        blockedWriteState: day.blockedWriteState || false,
      }));

      // 4. Evaluate attendance rules
      const evaluatedRecords = records.map((record) => {
        const student = students.find((s) => s.id === record.studentId) || {
          id: record.studentId,
          name: "Unknown Student",
          nisn: "",
        };
        const day = calendarDays.find((d) => d.date === record.date);

        const ruleOutput = evaluateAttendanceRules({
          student,
          classId: record.classId,
          date: record.date,
          proposedStatus: record.status,
          proposedNote: record.note,
          calendarDay: day || null,
          locks: locks.map((l) => ({ ...l })),
          existingRecord: record,
        });

        return {
          ...record,
          status: ruleOutput.selectedStatus ?? record.status,
          debug: {
            isHoliday: day ? day.isHoliday : false,
            holidayName: day ? day.holidayName : null,
            isEffective: day ? day.isEffective : true,
            rulesApplied: ruleOutput.appliedRuleIds,
            message: ruleOutput.reasonCode,
            isValid: ruleOutput.writeAllowed,
          },
        } as AttendanceRecordCanonical;
      });

      const processedDataset: AttendanceDatasetCanonical = {
        classId,
        month,
        students,
        records: evaluatedRecords,
        days: mappedDays,
        holidays,
        dayEvents,
        locks,
        workDayFormat: resolvedWorkDayFormat,
      };

      // 5. Compute summary bundles server-side
      const summaryBundle = computeSummaryBundle(processedDataset);
      processedDataset.dailySummary = summaryBundle.daily;
      processedDataset.monthlySummary = summaryBundle.monthly;

      return { dataset: processedDataset, issues: [] };
    } catch (err: any) {
      return {
        dataset: { classId, month, students: [], records: [], days: [], holidays: [], dayEvents: [], locks: [] },
        issues: [{ severity: "error", code: "DATABASE_FETCH_FAILED", message: `Gagal memuat data presensi dari database V2: ${err.message || err}` }],
      };
    }
  }

  async applyPatch(patch: AttendanceRecordPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data, error } = await client.rpc("upsert_attendance_record", {
      p_user_id: runtime.user?.id,
      p_class_id: patch.classId,
      p_student_id: patch.studentId,
      p_date: patch.date,
      p_status: patch.status,
      p_note: patch.note || null,
      p_source: "manual",
    });
    if (error) throw error;
    return data;
  }

  async toggleLock(patch: AttendanceLockPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data: existing } = await client
      .from("attendance_v2_locks")
      .select("id")
      .eq("class_id", patch.classId)
      .eq("month", patch.month)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from("attendance_v2_locks")
        .update({
          is_locked: patch.isLocked,
          locked_at: patch.isLocked ? new Date().toISOString() : null,
          locked_by: patch.isLocked ? runtime.user?.id : null,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await client
        .from("attendance_v2_locks")
        .insert({
          user_id: runtime.user?.id,
          class_id: patch.classId,
          month: patch.month,
          is_locked: patch.isLocked,
          locked_at: patch.isLocked ? new Date().toISOString() : null,
          locked_by: patch.isLocked ? runtime.user?.id : null,
        });
      if (error) throw error;
    }
    return { success: true };
  }

  async toggleHoliday(patch: AttendanceHolidayPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data: existing } = await client
      .from("attendance_v2_holidays")
      .select("id")
      .eq("user_id", runtime.user?.id)
      .eq("date", patch.date)
      .maybeSingle();

    if (existing) {
      const { error } = await client
        .from("attendance_v2_holidays")
        .delete()
        .eq("id", existing.id);
      if (error) throw error;
      return { action: "deleted" };
    } else {
      const { error } = await client
        .from("attendance_v2_holidays")
        .insert({
          user_id: runtime.user?.id,
          date: patch.date,
          description: patch.description || "Hari Libur",
        });
      if (error) throw error;
      return { action: "added" };
    }
  }

  async upsertDayEvent(patch: AttendanceDayEventPatch, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data: existing } = await client
      .from("attendance_v2_day_events")
      .select("id")
      .eq("user_id", runtime.user?.id)
      .eq("date", patch.date)
      .maybeSingle();

    if (existing) {
      if (patch.action === "delete") {
        const { error } = await client
          .from("attendance_v2_day_events")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "deleted" };
      } else {
        const { error } = await client
          .from("attendance_v2_day_events")
          .update({
            label: patch.label,
            description: patch.description || null,
            color: patch.color || "blue",
          })
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "updated" };
      }
    } else {
      if (patch.action === "delete") return { action: "ignored" };
      const { error } = await client
        .from("attendance_v2_day_events")
        .insert({
          user_id: runtime.user?.id,
          date: patch.date,
          label: patch.label || "Event",
          description: patch.description || null,
          color: patch.color || "blue",
        });
      if (error) throw error;
      return { action: "added" };
    }
  }

  async getAuditLogs(classId: string, runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data, error } = await client
      .from("attendance_v2_audit_logs")
      .select("*")
      .eq("class_id", classId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }

  async getShadowReport(runtime: AttendanceRuntimeContext) {
    const client = runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
    const { data, error } = await client
      .from("attendance_v2_audit_logs")
      .select("*")
      .eq("action", "PRESENSI_SHADOW_MISMATCH")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  }
}

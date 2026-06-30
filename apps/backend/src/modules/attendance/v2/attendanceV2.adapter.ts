import type {
  AttendanceCalendarEventPatch,
  AttendanceCalendarQuery,
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
import { endOfMonth, endOfYear, format, parse, startOfMonth, startOfYear } from "date-fns";
import { buildAttendanceV2Calendar } from "./calendar/calendarEngine";
import type {
  AttendanceV2CalendarContext,
  AttendanceV2CalendarEventDefinition,
  AttendanceV2EventEffect,
  AttendanceV2EventType,
  AttendanceV2RecurrenceRule,
} from "./calendar/calendarEngine.types";
import {
  DEFAULT_ATTENDANCE_V2_RECAP_PROFILE,
  computeDailySummaryFromProfile,
  computeMonthlySummaryFromProfile,
  type AttendanceV2RecapProfile,
} from "./summary/recapProfile";

const DEFAULT_TIMEZONE = "Asia/Makassar";
const DEFAULT_WORK_DAY_FORMAT: "5days" | "6days" = "6days";

function safeJsonArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function safeJsonObject<T extends Record<string, unknown>>(value: unknown): T | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as T) : null;
}

function normalizeEventRow(row: any, fallbackUserId: string): AttendanceV2CalendarEventDefinition {
  return {
    id: row.id,
    userId: row.user_id || fallbackUserId,
    calendarId: row.calendar_id || null,
    schoolId: row.school_id || null,
    classId: row.class_id || null,
    scopeType: row.scope_type || (row.class_id ? "class" : row.school_id ? "school" : "user"),
    eventType: row.event_type || "info",
    title: row.title || row.label || row.description || "Agenda Kalender",
    description: row.description || null,
    startDate: row.start_date || row.date,
    endDate: row.end_date || row.start_date || row.date,
    timezone: row.timezone || DEFAULT_TIMEZONE,
    recurrenceRule: safeJsonObject(row.recurrence_rule) as unknown as AttendanceV2RecurrenceRule | null,
    recurrenceExceptions: safeJsonArray(row.recurrence_exceptions),
    priority: Number(row.priority ?? 0),
    effectOnAttendance: row.effect_on_attendance || "info_only",
    color: row.color || "blue",
    source: row.source || "manual",
  };
}

function legacyHolidayToEvent(row: any, userId: string): AttendanceV2CalendarEventDefinition {
  return {
    id: `legacy-holiday-${row.id}`,
    userId,
    calendarId: null,
    schoolId: null,
    classId: row.class_id || null,
    scopeType: row.class_id ? "class" : "user",
    eventType: "holiday",
    title: row.description || "Hari Libur",
    description: row.description || null,
    startDate: row.date,
    endDate: row.date,
    timezone: DEFAULT_TIMEZONE,
    recurrenceRule: null,
    recurrenceExceptions: [],
    priority: row.is_national ? 40 : row.class_id ? 80 : 50,
    effectOnAttendance: "non_effective",
    color: row.is_national ? "red" : "amber",
    source: "legacy_holiday",
  };
}

function legacyDayEventToEvent(row: any, userId: string): AttendanceV2CalendarEventDefinition {
  return {
    id: `legacy-event-${row.id}`,
    userId,
    calendarId: null,
    schoolId: row.school_id || null,
    classId: row.class_id || null,
    scopeType: row.class_id ? "class" : row.school_id ? "school" : "user",
    eventType: "info",
    title: row.label || "Agenda",
    description: row.description || null,
    startDate: row.date,
    endDate: row.date,
    timezone: DEFAULT_TIMEZONE,
    recurrenceRule: null,
    recurrenceExceptions: [],
    priority: Number(row.priority ?? 10),
    effectOnAttendance: "info_only",
    color: row.color || "blue",
    source: "legacy_day_event",
  };
}

export class AttendanceV2Adapter {
  private client(runtime: AttendanceRuntimeContext) {
    return runtime.token ? createSupabaseUserClient(runtime.token) : supabaseAdmin;
  }

  private async getCalendarContext(
    classId: string,
    month: string,
    runtime: AttendanceRuntimeContext
  ): Promise<AttendanceV2CalendarContext> {
    const client = this.client(runtime);
    const parsedMonth = parse(month, "yyyy-MM", new Date());
    const fallbackStart = format(startOfYear(parsedMonth), "yyyy-MM-dd");
    const fallbackEnd = format(endOfYear(parsedMonth), "yyyy-MM-dd");

    const { data: classContext } = await client
      .from("attendance_v2_class_contexts")
      .select("school_id, calendar_id, timezone_override, work_day_format, effective_from, effective_to")
      .eq("class_id", classId)
      .lte("effective_from", fallbackEnd)
      .or(`effective_to.is.null,effective_to.gte.${fallbackStart}`)
      .order("effective_from", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then((res: any) => res, () => ({ data: null }));

    const calendarId = classContext?.calendar_id || null;
    const { data: calendar } = calendarId
      ? await client
          .from("attendance_v2_academic_calendars")
          .select("id, school_id, starts_on, ends_on, timezone, work_day_format")
          .eq("id", calendarId)
          .maybeSingle()
          .then((res: any) => res, () => ({ data: null }))
      : { data: null };

    return {
      classId,
      schoolId: calendar?.school_id || classContext?.school_id || null,
      calendarId: calendar?.id || calendarId,
      timezone: classContext?.timezone_override || calendar?.timezone || DEFAULT_TIMEZONE,
      workDayFormat: classContext?.work_day_format || calendar?.work_day_format || DEFAULT_WORK_DAY_FORMAT,
      academicStartsOn: calendar?.starts_on || classContext?.effective_from || fallbackStart,
      academicEndsOn: calendar?.ends_on || classContext?.effective_to || fallbackEnd,
    };
  }

  private async getRecapProfile(
    context: AttendanceV2CalendarContext,
    runtime: AttendanceRuntimeContext
  ): Promise<AttendanceV2RecapProfile> {
    const userId = runtime.user?.id;
    if (!userId) return DEFAULT_ATTENDANCE_V2_RECAP_PROFILE;
    const client = this.client(runtime);

    const { data } = await client
      .from("attendance_v2_recap_profiles")
      .select("id, name, counted_statuses, present_statuses, absence_statuses, denominator_policy, display_order")
      .eq("user_id", userId)
      .or(`class_id.eq.${context.classId},school_id.eq.${context.schoolId ?? "00000000-0000-0000-0000-000000000000"},class_id.is.null`)
      .order("class_id", { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
      .then((res: any) => res, () => ({ data: null }));

    if (!data) return DEFAULT_ATTENDANCE_V2_RECAP_PROFILE;
    return {
      id: data.id,
      name: data.name || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.name,
      countedStatuses: data.counted_statuses || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.countedStatuses,
      presentStatuses: data.present_statuses || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.presentStatuses,
      absenceStatuses: data.absence_statuses || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.absenceStatuses,
      denominatorPolicy: data.denominator_policy || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.denominatorPolicy,
      displayOrder: data.display_order || DEFAULT_ATTENDANCE_V2_RECAP_PROFILE.displayOrder,
    };
  }

  private async fetchCalendarEvents(
    context: AttendanceV2CalendarContext,
    rangeStart: string,
    rangeEnd: string,
    runtime: AttendanceRuntimeContext
  ): Promise<AttendanceV2CalendarEventDefinition[]> {
    const userId = runtime.user?.id;
    if (!userId) return [];
    const client = this.client(runtime);

    const { data: eventRows } = await client
      .from("attendance_v2_calendar_events")
      .select("*")
      .eq("user_id", userId)
      .lte("start_date", rangeEnd)
      .gte("end_date", rangeStart)
      .order("priority", { ascending: false })
      .then((res: any) => res, () => ({ data: [] }));

    const scopedEvents = (eventRows || [])
      .filter((row: any) => {
        if (row.class_id) return row.class_id === context.classId;
        if (row.school_id) return context.schoolId && row.school_id === context.schoolId;
        return row.scope_type === "national" || row.scope_type === "user" || row.scope_type === null;
      })
      .map((row: any) => normalizeEventRow(row, userId));

    const [legacyHolidays, legacyDayEvents] = await Promise.all([
      client
        .from("attendance_v2_holidays")
        .select("id, date, description, is_national, class_id")
        .eq("user_id", userId)
        .or(`class_id.eq.${context.classId},class_id.is.null`)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .then((res: any) => res, () => ({ data: [] })),
      client
        .from("attendance_v2_day_events")
        .select("id, date, label, description, color, priority, class_id, school_id")
        .eq("user_id", userId)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .then((res: any) => res, () => ({ data: [] })),
    ]);

    return [
      ...scopedEvents,
      ...(legacyHolidays.data || []).map((row: any) => legacyHolidayToEvent(row, userId)),
      ...(legacyDayEvents.data || [])
        .filter((row: any) => !row.class_id || row.class_id === context.classId)
        .filter((row: any) => !row.school_id || row.school_id === context.schoolId)
        .map((row: any) => legacyDayEventToEvent(row, userId)),
    ];
  }

  async getCalendar(
    query: AttendanceCalendarQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ calendar: any; issues: AttendanceValidationIssue[] }> {
    const context = await this.getCalendarContext(query.classId, query.startDate.slice(0, 7), runtime);
    const events = await this.fetchCalendarEvents(context, query.startDate, query.endDate, runtime);
    const result = buildAttendanceV2Calendar({ context, rangeStart: query.startDate, rangeEnd: query.endDate, events });
    return { calendar: { context, ...result }, issues: [] };
  }

  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    const { classId, month } = query;
    const userId = runtime.user?.id;
    const client = this.client(runtime);

    if (!userId) {
      return {
        dataset: { classId, month, students: [], records: [], days: [], holidays: [], dayEvents: [], locks: [] },
        issues: [{ severity: "error", code: "UNAUTHORIZED", message: "User tidak terautentikasi untuk mengambil data." }],
      };
    }

    try {
      const parsedMonth = parse(month, "yyyy-MM", new Date());
      const monthStart = format(startOfMonth(parsedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(parsedMonth), "yyyy-MM-dd");
      const context = await this.getCalendarContext(classId, month, runtime);

      const [studentsRes, recordsRes, locksRes] = await Promise.all([
        client.from("students").select("id, name, nisn").eq("class_id", classId),
        client
          .from("attendance_v2_records")
          .select("id, student_id, class_id, date, status, note, created_at, updated_at")
          .eq("class_id", classId)
          .eq("user_id", userId)
          .gte("date", monthStart)
          .lte("date", monthEnd),
        client
          .from("attendance_v2_locks")
          .select("class_id, month, is_locked, locked_at, locked_by")
          .eq("class_id", classId)
          .eq("month", month)
          .maybeSingle()
          .then((res) => (res.error ? { data: null } : res)),
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

      const eventDefinitions = await this.fetchCalendarEvents(context, monthStart, monthEnd, runtime);
      const calendar = buildAttendanceV2Calendar({
        context,
        rangeStart: monthStart,
        rangeEnd: monthEnd,
        events: eventDefinitions,
        lockedMonths: new Set(locks.filter((lock) => lock.isLocked).map((lock) => lock.month)),
      });

      const days = calendar.days.map((day) => ({
        date: day.date,
        isEffective: day.isEffective,
        dayOfWeek: day.dayOfWeek,
        isWeekend: day.isWeekend,
        holidayName: day.appliedEvents.find((event) => event.effectOnAttendance === "non_effective")?.title,
        eventName: day.appliedEvents[0]?.title,
        reasonCodes: day.reasonCodes,
      }));

      const holidays = calendar.events
        .filter((event) => event.effectOnAttendance === "non_effective" || event.eventType === "holiday")
        .map((event) => ({
          id: event.sourceEventId,
          date: event.date,
          description: event.title,
          isNational: event.scopeType === "national",
        })) as AttendanceHolidayCanonical[];

      const dayEvents = calendar.events.map((event) => ({
        id: event.id,
        date: event.date,
        label: event.title,
        description: event.description,
        color: event.color,
      })) as AttendanceCalendarEventCanonical[];

      const profile = await this.getRecapProfile(context, runtime);
      return {
        dataset: {
          classId,
          month,
          students,
          records,
          days,
          holidays,
          dayEvents,
          locks,
          workDayFormat: context.workDayFormat,
          monthlySummary: computeMonthlySummaryFromProfile(students, records, calendar.days, profile),
          dailySummary: calendar.days.map((day) => computeDailySummaryFromProfile(records, day.date)),
        },
        issues: [],
      };
    } catch (err: any) {
      return {
        dataset: { classId, month, students: [], records: [], days: [], holidays: [], dayEvents: [], locks: [] },
        issues: [{
          severity: "error",
          code: "DATABASE_FETCH_FAILED",
          message: `Gagal memuat data presensi V2: ${err.message || err}`,
        }],
      };
    }
  }

  async applyPatch(patch: AttendanceRecordPatch, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
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

    if (error) throw new Error(`Supabase RPC Error: ${error.message}`);
    const json = data as { success: boolean; error_code?: string; message?: string; action?: string; record_id?: string };
    if (!json.success) throw new Error(json.message || `RPC Error: ${json.error_code}`);
    return json;
  }

  async toggleLock(patch: AttendanceLockPatch, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
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
        .update({ is_locked: patch.isLocked, locked_at: patch.isLocked ? new Date().toISOString() : null, locked_by: patch.isLocked ? userId : null })
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from("attendance_v2_locks")
      .insert({ user_id: userId, class_id: patch.classId, month: patch.month, is_locked: patch.isLocked, locked_at: patch.isLocked ? new Date().toISOString() : null, locked_by: patch.isLocked ? userId : null })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async upsertCalendarEvent(patch: AttendanceCalendarEventPatch, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
    const userId = runtime.user?.id;
    if (!userId) throw new Error("User ID is required for V2 calendar event");

    const payload = {
      user_id: userId,
      calendar_id: patch.calendarId || null,
      school_id: patch.schoolId || null,
      class_id: patch.classId || null,
      scope_type: patch.scopeType || (patch.classId ? "class" : patch.schoolId ? "school" : "user"),
      event_type: patch.eventType || "info",
      title: patch.title,
      description: patch.description || null,
      start_date: patch.startDate,
      end_date: patch.endDate || patch.startDate,
      timezone: patch.timezone || DEFAULT_TIMEZONE,
      recurrence_rule: patch.recurrenceRule || null,
      recurrence_exceptions: patch.recurrenceExceptions || [],
      priority: patch.priority ?? 0,
      effect_on_attendance: patch.effectOnAttendance || "info_only",
      color: patch.color || "blue",
      source: patch.source || "manual",
      updated_by: userId,
    };

    if (patch.id) {
      const { data, error } = await client
        .from("attendance_v2_calendar_events")
        .update(payload)
        .eq("id", patch.id)
        .eq("user_id", userId)
        .select()
        .single();
      if (error) throw error;
      return data;
    }

    const { data, error } = await client
      .from("attendance_v2_calendar_events")
      .insert({ ...payload, created_by: userId })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async toggleHoliday(patch: AttendanceHolidayPatch, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
    const userId = runtime.user?.id;
    if (!userId) throw new Error("User ID is required for V2 holiday");

    const startDate = patch.startDate || patch.date;
    const endDate = patch.endDate || patch.date;
    const scopeType = patch.scopeType || (patch.classId ? "class" : "user");
    const query = client
      .from("attendance_v2_calendar_events")
      .select("id")
      .eq("user_id", userId)
      .eq("event_type", "holiday")
      .eq("start_date", startDate)
      .eq("end_date", endDate);

    if (patch.classId) query.eq("class_id", patch.classId);
    else query.is("class_id", null);

    const { data: existing } = await query.maybeSingle();
    if (existing) {
      const { error } = await client.from("attendance_v2_calendar_events").delete().eq("id", existing.id);
      if (error) throw error;
      return { success: true, action: "deleted" };
    }

    const data = await this.upsertCalendarEvent({
      classId: patch.classId || null,
      scopeType,
      eventType: "holiday",
      title: patch.description || "Hari Libur",
      description: patch.description || null,
      startDate,
      endDate,
      priority: patch.classId ? 80 : 50,
      effectOnAttendance: "non_effective",
      color: "amber",
      source: "manual_holiday",
    }, runtime);
    return { data, action: "added" };
  }

  async upsertDayEvent(patch: AttendanceDayEventPatch, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
    const userId = runtime.user?.id;
    if (!userId) throw new Error("User ID is required for V2 day event");

    if (patch.action === "delete") {
      const { error } = await client
        .from("attendance_v2_calendar_events")
        .delete()
        .eq("start_date", patch.startDate || patch.date)
        .eq("user_id", userId);
      if (error) throw error;
      return { success: true };
    }

    return this.upsertCalendarEvent({
      classId: patch.classId || null,
      schoolId: patch.schoolId || null,
      scopeType: patch.scopeType || (patch.classId ? "class" : "user"),
      eventType: (patch.eventType as AttendanceV2EventType) || "info",
      title: patch.label || "Agenda",
      description: patch.description || null,
      startDate: patch.startDate || patch.date,
      endDate: patch.endDate || patch.startDate || patch.date,
      recurrenceRule: patch.recurrenceRule || null,
      recurrenceExceptions: patch.recurrenceExceptions || [],
      priority: patch.priority ?? 10,
      effectOnAttendance: (patch.effectOnAttendance as AttendanceV2EventEffect) || "info_only",
      color: patch.color || "blue",
      source: "manual_day_event",
    }, runtime);
  }

  async getAuditLogs(classId: string, runtime: AttendanceRuntimeContext) {
    const client = this.client(runtime);
    const userId = runtime.user?.id;
    if (!userId) throw new Error("User ID is required for V2 audit");

    const { data, error } = await client
      .from("attendance_v2_audit_logs")
      .select("*")
      .eq("user_id", userId)
      .eq("class_id", classId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data || [];
  }
}

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
} from "../attendance.types";
import { supabaseAdmin } from "../../../database/supabase";
import { parse, startOfYear, endOfYear, format } from "date-fns";

export class AttendanceV1Adapter {
  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    const { classId, month } = query;
    const userId = runtime.user?.id;

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

      // Jalankan query paralel ke Supabase
      const [studentsRes, recordsRes, holidaysRes, dayEventsRes, locksRes] = await Promise.all([
        supabaseAdmin
          .from("students")
          .select("id, name, nisn")
          .eq("class_id", classId),
        supabaseAdmin
          .from("attendance_records")
          .select("id, student_id, class_id, date, status, note, created_at, updated_at")
          .eq("class_id", classId)
          .gte("date", yearStart)
          .lte("date", yearEnd),
        supabaseAdmin
          .from("attendance_holidays")
          .select("id, date, description, is_national")
          .eq("user_id", userId)
          .gte("date", yearStart)
          .lte("date", yearEnd),
        supabaseAdmin
          .from("attendance_day_events")
          .select("id, date, label, description, color")
          .eq("user_id", userId)
          .gte("date", yearStart)
          .lte("date", yearEnd)
          .then(
            (res: any) => res,
            () => ({ data: [] })
          ), // Graceful recovery jika table/kolom error
        supabaseAdmin
          .from("attendance_locks")
          .select("class_id, month, is_locked, locked_at, locked_by")
          .eq("class_id", classId)
          .eq("month", month)
          .single()
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
          days: [], // Day types akan dikalkulasi oleh V2 Engine/Service jika dijalankan di V2
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
}

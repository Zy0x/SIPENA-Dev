import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { format, startOfMonth, endOfMonth, getDay } from "date-fns";
import { useAttendanceRuntime } from "../runtime/useAttendanceRuntime";
import { AttendanceV2Service } from "./attendanceV2.service";
import {
  mapV1RecordToCanonical,
  mapV1HolidayToCanonical,
  mapV1DayEventToCanonical,
  mapV1LockToCanonical,
} from "../canonical/canonical.mappers";
import type {
  AttendanceDatasetCanonical,
  AttendanceRecordCanonical,
  AttendanceRecordPatch,
  AttendanceStatusCode,
} from "../canonical/canonical.types";
import type { V1Record, V1Holiday, V1DayEvent, V1Lock } from "../v1/attendanceV1.types";

export interface V2AdapterResult {
  attendanceRecords: V1Record[];
  holidays: V1Holiday[];
  dayEvents: V1DayEvent[];
  isLocked: boolean;
  dbAvailable: boolean;
  isLoading: boolean;
  isSaving: boolean;
  isTogglingHoliday: boolean;
  isTogglingLock: boolean;
  getAttendance: (studentId: string, date: Date) => AttendanceStatusCode | null;
  getAttendanceNote: (studentId: string, date: Date) => string | null;
  getDayEvent: (date: Date) => V1DayEvent | null;
  isHoliday: (date: Date) => boolean;
  getHolidayDescription: (date: Date) => string | null;
  getMonthStats: () => { H: number; S: number; I: number; A: number; D: number; total: number };
  getDayStats: (date: Date) => { H: number; S: number; I: number; A: number; D: number; total: number };
  getYearlyData: (year: number) => Promise<{ attendance: V1Record[]; holidays: V1Holiday[]; dayEvents: V1DayEvent[] }>;
  setAttendance: (args: { studentId: string; date: string; status: AttendanceStatusCode | null; note?: string | null }) => Promise<void>;
  updateNote: (args: { studentId: string; date: string; note: string | null }) => Promise<void>;
  bulkSetAttendance: (args: { studentIds: string[]; date: string; status: AttendanceStatusCode }) => Promise<void>;
  toggleHoliday: (args: { date: string; description?: string }) => Promise<{ action: "added" | "deleted" }>;
  upsertDayEvent: (args: { date: string; label: string; description?: string; color?: string }) => Promise<void>;
  deleteDayEvent: (date: string) => Promise<void>;
  toggleLock: (locked: boolean) => Promise<boolean>;
  refetch: () => void;
  v2Dataset: AttendanceDatasetCanonical | null;
}

export function useAttendanceV2Adapter(
  classId: string,
  month: Date,
  workDayFormat: "5days" | "6days" = "6days"
): V2AdapterResult {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const runtime = useAttendanceRuntime();

  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  const [localAttendance, setLocalAttendance] = useState<V1Record[]>([]);
  const [localHolidays, setLocalHolidays] = useState<V1Holiday[]>([]);
  const [localDayEvents, setLocalDayEvents] = useState<V1DayEvent[]>([]);
  const [localLocked, setLocalLocked] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);

  // V2 Service Initialization
  const v2Service = useMemo(() => {
    const isV2Active = runtime.engine === "v2" && runtime.mode === "active";
    const isV2Shadow = runtime.mode === "shadow";
    return new AttendanceV2Service({
      enableWrite: isV2Active,
      enableShadow: isV2Shadow,
      runtimeMode: runtime.mode,
    });
  }, [runtime.engine, runtime.mode]);

  useEffect(() => {
    const checkDbTables = async () => {
      if (!user) return;
      try {
        const { error } = await (supabase as any)
          .from("attendance_records")
          .select("id")
          .limit(1);
        if (!error || !error.message?.includes("does not exist")) {
          setDbAvailable(true);
        }
      } catch (e) {
        setDbAvailable(false);
      }
    };
    checkDbTables();
  }, [user]);

  // Query: Attendance records
  const attendanceQuery = useQuery({
    queryKey: ["attendance", classId, monthStart, dbAvailable],
    queryFn: async () => {
      if (!classId || !user || !dbAvailable) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .select("*")
        .eq("class_id", classId)
        .gte("date", monthStart)
        .lte("date", monthEnd);
      if (error) {
        console.error("Error fetching attendance:", error);
        return [];
      }
      return (data || []) as V1Record[];
    },
    enabled: !!classId && !!user && dbAvailable,
  });

  // Query: Holidays
  const holidaysQuery = useQuery({
    queryKey: ["attendance_holidays", user?.id, dbAvailable],
    queryFn: async () => {
      if (!user || !dbAvailable) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_holidays")
        .select("*")
        .eq("user_id", user.id);
      if (error) {
        console.error("Error fetching holidays:", error);
        return [];
      }
      return (data || []) as V1Holiday[];
    },
    enabled: !!user && dbAvailable,
  });

  // Query: Day Events
  const dayEventsQuery = useQuery({
    queryKey: ["attendance_day_events", user?.id, dbAvailable],
    queryFn: async () => {
      if (!user || !dbAvailable) return [];
      try {
        const { data, error } = await (supabase as any)
          .from("attendance_day_events")
          .select("*")
          .eq("user_id", user.id);
        if (error) return [];
        return (data || []) as V1DayEvent[];
      } catch {
        return [];
      }
    },
    enabled: !!user && dbAvailable,
  });

  // Query: Lock Status
  const lockQuery = useQuery({
    queryKey: ["attendance_lock", classId, monthStart, dbAvailable],
    queryFn: async () => {
      if (!classId || !user || !dbAvailable) return { is_locked: true };
      const { data, error } = await (supabase as any)
        .from("attendance_locks")
        .select("*")
        .eq("class_id", classId)
        .eq("user_id", user.id)
        .eq("month", monthStart)
        .maybeSingle();
      if (error) {
        console.error("Error fetching lock:", error);
        return { is_locked: true };
      }
      return data || { is_locked: true };
    },
    enabled: !!classId && !!user && dbAvailable,
  });

  const attendanceRecords = dbAvailable ? (attendanceQuery.data || []) : localAttendance;
  const holidays = dbAvailable ? (holidaysQuery.data || []) : localHolidays;
  const dayEvents = dbAvailable ? (dayEventsQuery.data || []) : localDayEvents;
  const isLocked = dbAvailable ? (lockQuery.data?.is_locked ?? true) : localLocked;

  // Build V2 canonical dataset dynamically
  const v2Dataset = useMemo(() => {
    if (!classId) return null;

    const studentsData = queryClient.getQueryData<any[]>(["students", classId]) || [];
    const canonicalStudents = studentsData.map((s) => ({
      id: s.id,
      name: s.name,
      nisn: s.nisn,
    }));

    const canonicalRecords = attendanceRecords.map(mapV1RecordToCanonical);
    const canonicalHolidays = holidays.map(mapV1HolidayToCanonical);
    const canonicalEvents = dayEvents.map(mapV1DayEventToCanonical);
    const canonicalLocks = [
      {
        classId,
        month: monthStart.slice(0, 7),
        isLocked,
        lockedAt: null,
        lockedBy: null,
      },
    ];

    return v2Service.buildDataset({
      classId,
      month: monthStart.slice(0, 7),
      students: canonicalStudents,
      records: canonicalRecords,
      holidays: canonicalHolidays,
      dayEvents: canonicalEvents,
      locks: canonicalLocks,
      workDayFormat,
    });
  }, [classId, attendanceRecords, holidays, dayEvents, isLocked, workDayFormat, monthStart, queryClient, v2Service]);

  // Read: get status in V2 format
  const getAttendance = useCallback(
    (studentId: string, date: Date): AttendanceStatusCode | null => {
      if (!v2Dataset) return null;
      const dateStr = format(date, "yyyy-MM-dd");
      const record = v2Dataset.records.find((r) => r.studentId === studentId && r.date === dateStr);
      return record?.status ?? null;
    },
    [v2Dataset]
  );

  // Read: get note in V2 format
  const getAttendanceNote = useCallback(
    (studentId: string, date: Date): string | null => {
      if (!v2Dataset) return null;
      const dateStr = format(date, "yyyy-MM-dd");
      const record = v2Dataset.records.find((r) => r.studentId === studentId && r.date === dateStr);
      return record?.note ?? null;
    },
    [v2Dataset]
  );

  // Read: get custom day event
  const getDayEvent = useCallback(
    (date: Date): V1DayEvent | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      return dayEvents.find((e) => e.date === dateStr) || null;
    },
    [dayEvents]
  );

  // Read: is date a holiday in V2
  const isHoliday = useCallback(
    (date: Date): boolean => {
      if (!v2Dataset) {
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 0) return true;
        if (workDayFormat === "5days" && dayOfWeek === 6) return true;
        const dateStr = format(date, "yyyy-MM-dd");
        return holidays.some((h) => h.date === dateStr);
      }
      const dateStr = format(date, "yyyy-MM-dd");
      const day = v2Dataset.days.find((d) => d.date === dateStr);
      return day ? !day.isEffective : false;
    },
    [v2Dataset, holidays, workDayFormat]
  );

  // Read: get holiday description in V2
  const getHolidayDescription = useCallback(
    (date: Date): string | null => {
      if (!v2Dataset) {
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 0) return "Hari Minggu";
        if (workDayFormat === "5days" && dayOfWeek === 6) return "Hari Sabtu (Libur)";
        const dateStr = format(date, "yyyy-MM-dd");
        const holiday = holidays.find((h) => h.date === dateStr);
        return holiday?.description || null;
      }
      const dateStr = format(date, "yyyy-MM-dd");
      const day = v2Dataset.days.find((d) => d.date === dateStr);
      if (!day) return null;
      if (day.holidayName) return day.holidayName;
      if (!day.isEffective) {
        const dayOfWeek = getDay(date);
        if (dayOfWeek === 0) return "Hari Minggu";
        if (workDayFormat === "5days" && dayOfWeek === 6) return "Hari Sabtu (Libur)";
        return "Libur Non-Efektif";
      }
      return null;
    },
    [v2Dataset, holidays, workDayFormat]
  );

  // Read: monthly stats from V2
  const getMonthStats = useCallback(() => {
    const stats = { H: 0, I: 0, S: 0, A: 0, D: 0, total: 0 };
    if (!v2Dataset) return stats;
    v2Dataset.records.forEach((record) => {
      const status = record.status;
      if (status === "H") { stats.H++; stats.total++; }
      else if (status === "I") { stats.I++; stats.total++; }
      else if (status === "S") { stats.S++; stats.total++; }
      else if (status === "A") { stats.A++; stats.total++; }
      else if (status === "D") { stats.D++; stats.total++; }
    });
    return stats;
  }, [v2Dataset]);

  // Read: daily stats from V2
  const getDayStats = useCallback(
    (date: Date) => {
      const stats = { H: 0, I: 0, S: 0, A: 0, D: 0, total: 0 };
      if (!v2Dataset) return stats;
      const dateStr = format(date, "yyyy-MM-dd");
      v2Dataset.records.forEach((record) => {
        if (record.date === dateStr) {
          const status = record.status;
          if (status === "H") { stats.H++; stats.total++; }
          else if (status === "I") { stats.I++; stats.total++; }
          else if (status === "S") { stats.S++; stats.total++; }
          else if (status === "A") { stats.A++; stats.total++; }
          else if (status === "D") { stats.D++; stats.total++; }
        }
      });
      return stats;
    },
    [v2Dataset]
  );

  // Read: yearly statistics
  const getYearlyData = useCallback(
    async (year: number) => {
      if (!user || !classId) return { attendance: [], holidays: [], dayEvents: [] };

      const yearStart = format(new Date(year, 0, 1), "yyyy-MM-dd");
      const yearEnd = format(new Date(year, 11, 31), "yyyy-MM-dd");

      if (!dbAvailable) {
        return {
          attendance: localAttendance.filter((a) => a.date >= yearStart && a.date <= yearEnd),
          holidays: localHolidays.filter((h) => h.date >= yearStart && h.date <= yearEnd),
          dayEvents: localDayEvents.filter((e) => e.date >= yearStart && e.date <= yearEnd),
        };
      }

      const [attendanceResult, holidaysResult, dayEventsResult] = await Promise.all([
        (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd),
        (supabase as any).from("attendance_holidays").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
        (supabase as any).from("attendance_day_events").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd).catch(() => ({ data: [] })),
      ]);

      return {
        attendance: (attendanceResult.data || []) as V1Record[],
        holidays: (holidaysResult.data || []) as V1Holiday[],
        dayEvents: (dayEventsResult.data || []) as V1DayEvent[],
      };
    },
    [user, classId, dbAvailable, localAttendance, localHolidays, localDayEvents]
  );

  // Helper: Persist audit log to DB
  const persistAuditLog = async (event: any) => {
    if (!user || !dbAvailable) return;
    try {
      await (supabase as any).from("activity_logs").insert({
        user_id: user.id,
        actor_type: "owner",
        actor_name: user.email,
        action: `PRESENSI_V2_${event.action}`,
        entity_type: "attendance_records",
        metadata: {
          reasonCode: event.reasonCode,
          beforeState: event.beforeState,
          afterState: event.afterState,
          ...event.metadata,
        },
      });
    } catch (e) {
      console.error("Failed to persist V2 audit event:", e);
    }
  };

  // Helper: Perform comparison diagnostic on V1 writes
  const runShadowComparison = async (v1Data: V1Record, patch: AttendanceRecordPatch) => {
    if (!v2Dataset) return;
    const v1Canonical = mapV1RecordToCanonical(v1Data);
    const comparison = v2Service.compareWithV1CanonicalResult([v1Canonical], v2Dataset);

    if (!comparison.match) {
      console.warn("[Presensi Shadow Mode] Drift detected between V1 and V2:", comparison);
      if (user && dbAvailable) {
        try {
          await (supabase as any).from("activity_logs").insert({
            user_id: user.id,
            actor_type: "owner",
            actor_name: user.email,
            action: "PRESENSI_SHADOW_MISMATCH",
            entity_type: "attendance_records",
            metadata: {
              patch,
              comparison,
            },
          });
        } catch (e) {
          console.error("Failed to persist shadow mismatch audit:", e);
        }
      }
    }
  };

  // Mutation: Set/mutate attendance record
  const setAttendanceMutation = useMutation({
    mutationFn: async ({
      studentId,
      date,
      status,
      note,
    }: {
      studentId: string;
      date: string;
      status: AttendanceStatusCode | null;
      note?: string | null;
    }) => {
      if (!user || !classId) throw new Error("User or class not set");

      const patch: AttendanceRecordPatch = { studentId, classId, date, status, note };

      // Case 1: V2 ACTIVE ENGINE
      if (runtime.engine === "v2" && runtime.mode === "active") {
        if (!v2Dataset) throw new Error("Dataset V2 belum siap");

        const result = v2Service.applyPatch(v2Dataset, patch, { actor: user.id });

        if (!result.success) {
          throw new Error(result.validationIssues[0] || result.reasonCode || "Validasi V2 menolak perubahan ini.");
        }

        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const existing = prev.findIndex((r) => r.student_id === studentId && r.date === date);
            if (status === null) {
              return existing >= 0 ? prev.filter((_, i) => i !== existing) : prev;
            }
            const newRecord: V1Record = {
              class_id: classId,
              student_id: studentId,
              date,
              status: status as any,
              note: note || null,
            };
            if (existing >= 0) {
              const list = [...prev];
              list[existing] = newRecord;
              return list;
            }
            return [...prev, newRecord];
          });
          return;
        }

        // Fetch DB single ID to update or insert
        const { data: existingData } = await (supabase as any)
          .from("attendance_records")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .eq("date", date)
          .maybeSingle();

        if (status === null) {
          if (existingData) {
            await (supabase as any).from("attendance_records").delete().eq("id", existingData.id);
          }
        } else {
          const payload = {
            class_id: classId,
            student_id: studentId,
            date,
            status,
            note: note !== undefined ? note : null,
            created_by: user.id,
          };
          if (existingData) {
            await (supabase as any).from("attendance_records").update(payload).eq("id", existingData.id);
          } else {
            await (supabase as any).from("attendance_records").insert(payload);
          }
        }

        if (result.auditEvent) {
          await persistAuditLog(result.auditEvent);
        }
      }
      // Case 2: V2 SHADOW MODE OR V1 MODE (fallback database write)
      else {
        // Runs standard V1 writes
        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const existing = prev.findIndex((r) => r.student_id === studentId && r.date === date);
            if (status === null) {
              return existing >= 0 ? prev.filter((_, i) => i !== existing) : prev;
            }
            const newRecord = { class_id: classId, student_id: studentId, date, status: status as any, note: note || null };
            if (existing >= 0) {
              const list = [...prev];
              list[existing] = newRecord;
              return list;
            }
            return [...prev, newRecord];
          });
          return;
        }

        const { data: existingData } = await (supabase as any)
          .from("attendance_records")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .eq("date", date)
          .maybeSingle();

        let persistedRecord: V1Record | null = null;

        if (status === null) {
          if (existingData) {
            await (supabase as any).from("attendance_records").delete().eq("id", existingData.id);
          }
        } else {
          const payload = {
            class_id: classId,
            student_id: studentId,
            date,
            status,
            note: note !== undefined ? note : null,
            created_by: user.id,
          };
          if (existingData) {
            const { data } = await (supabase as any).from("attendance_records").update(payload).eq("id", existingData.id).select().single();
            persistedRecord = data;
          } else {
            const { data } = await (supabase as any).from("attendance_records").insert(payload).select().single();
            persistedRecord = data;
          }
        }

        // If shadow mode, perform V2 validation diagnostic in the background and check for drift
        if (runtime.mode === "shadow" && persistedRecord) {
          await runShadowComparison(persistedRecord, patch);
        }
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Mutation: Update Note
  const updateNoteMutation = useMutation({
    mutationFn: async ({ studentId, date, note }: { studentId: string; date: string; note: string | null }) => {
      if (!user || !classId) throw new Error("User or class not set");

      // ACTIVE V2
      if (runtime.engine === "v2" && runtime.mode === "active") {
        if (!v2Dataset) throw new Error("Dataset V2 belum siap");

        const result = v2Service.updateNote(v2Dataset, studentId, date, note, { actor: user.id });

        if (!result.success) {
          throw new Error(result.validationIssues[0] || result.reasonCode || "Validasi V2 menolak penulisan catatan.");
        }

        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const idx = prev.findIndex((r) => r.student_id === studentId && r.date === date);
            if (idx >= 0) {
              const list = [...prev];
              list[idx] = { ...list[idx], note };
              return list;
            }
            return prev;
          });
          return;
        }

        const { data: existingData } = await (supabase as any)
          .from("attendance_records")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .eq("date", date)
          .maybeSingle();

        if (existingData) {
          await (supabase as any).from("attendance_records").update({ note }).eq("id", existingData.id);
        }

        if (result.auditEvent) {
          await persistAuditLog(result.auditEvent);
        }
      } else {
        // Fallback V1 note update
        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const idx = prev.findIndex((r) => r.student_id === studentId && r.date === date);
            if (idx >= 0) {
              const list = [...prev];
              list[idx] = { ...list[idx], note };
              return list;
            }
            return prev;
          });
          return;
        }

        const { data: existingData } = await (supabase as any)
          .from("attendance_records")
          .select("id")
          .eq("class_id", classId)
          .eq("student_id", studentId)
          .eq("date", date)
          .maybeSingle();

        if (existingData) {
          await (supabase as any).from("attendance_records").update({ note }).eq("id", existingData.id);
        }
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Mutation: Bulk Set Attendance
  const bulkSetAttendanceMutation = useMutation({
    mutationFn: async ({
      studentIds,
      date,
      status,
    }: {
      studentIds: string[];
      date: string;
      status: AttendanceStatusCode;
    }) => {
      if (!user || !classId) throw new Error("User or class not set");

      // ACTIVE V2
      if (runtime.engine === "v2" && runtime.mode === "active") {
        if (!v2Dataset) throw new Error("Dataset V2 belum siap");

        const patches = studentIds.map((studentId) => ({ studentId, classId, date, status }));
        const results = v2Service.bulkApplyPatch(v2Dataset, patches, { actor: user.id });

        const failed = results.find((r) => !r.success);
        if (failed) {
          throw new Error(failed.validationIssues[0] || failed.reasonCode || "Validasi V2 menolak perubahan massal.");
        }

        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const filtered = prev.filter((r) => r.date !== date);
            const newRecords = studentIds.map((studentId) => ({
              class_id: classId,
              student_id: studentId,
              date,
              status: status as any,
              note: null,
            }));
            return [...filtered, ...newRecords];
          });
          return;
        }

        await (supabase as any).from("attendance_records").delete().eq("class_id", classId).eq("date", date);

        const insertPayloads = studentIds.map((studentId) => ({
          class_id: classId,
          student_id: studentId,
          date,
          status,
          created_by: user.id,
        }));

        await (supabase as any).from("attendance_records").insert(insertPayloads);

        for (const res of results) {
          if (res.auditEvent) {
            await persistAuditLog(res.auditEvent);
          }
        }
      } else {
        // Fallback V1 bulk set
        if (!dbAvailable) {
          setLocalAttendance((prev) => {
            const filtered = prev.filter((r) => r.date !== date);
            const newRecords = studentIds.map((studentId) => ({
              class_id: classId,
              student_id: studentId,
              date,
              status: status as any,
              note: null,
            }));
            return [...filtered, ...newRecords];
          });
          return;
        }

        await (supabase as any).from("attendance_records").delete().eq("class_id", classId).eq("date", date);

        const records = studentIds.map((studentId) => ({
          class_id: classId,
          student_id: studentId,
          date,
          status,
          created_by: user.id,
        }));

        await (supabase as any).from("attendance_records").insert(records);
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Mutation: Toggle Holiday
  const toggleHolidayMutation = useMutation({
    mutationFn: async ({ date, description }: { date: string; description?: string }) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        const exists = localHolidays.some((h) => h.date === date);
        setLocalHolidays((prev) =>
          exists ? prev.filter((h) => h.date !== date) : [...prev, { date, description: description || "Hari Libur" }]
        );
        return { action: exists ? ("deleted" as const) : ("added" as const) };
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_holidays")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", date)
        .maybeSingle();

      if (existingData) {
        await (supabase as any).from("attendance_holidays").delete().eq("id", existingData.id);
        return { action: "deleted" as const };
      } else {
        await (supabase as any).from("attendance_holidays").insert({
          user_id: user.id,
          date,
          description: description || "Hari Libur",
        });
        return { action: "added" as const };
      }
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_holidays"] });
    },
  });

  // Mutation: Day Events CRUD
  const upsertDayEventMutation = useMutation({
    mutationFn: async (event: { date: string; label: string; description?: string; color?: string }) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        setLocalDayEvents((prev) => {
          const exists = prev.findIndex((e) => e.date === event.date);
          if (exists >= 0) {
            const updated = [...prev];
            updated[exists] = { ...updated[exists], ...event };
            return updated;
          }
          return [...prev, { ...event, user_id: user.id }];
        });
        return;
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_day_events")
        .select("id")
        .eq("user_id", user.id)
        .eq("date", event.date)
        .maybeSingle();

      if (existingData) {
        await (supabase as any)
          .from("attendance_day_events")
          .update({
            label: event.label,
            description: event.description,
            color: event.color,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingData.id);
      } else {
        await (supabase as any).from("attendance_day_events").insert({
          user_id: user.id,
          date: event.date,
          label: event.label,
          description: event.description,
          color: event.color || "blue",
        });
      }
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_day_events"] });
    },
  });

  const deleteDayEventMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        setLocalDayEvents((prev) => prev.filter((e) => e.date !== date));
        return;
      }

      await (supabase as any).from("attendance_day_events").delete().eq("user_id", user.id).eq("date", date);
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_day_events"] });
    },
  });

  // Mutation: Lock month period
  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      if (!user || !classId) throw new Error("User or class not set");
      if (!dbAvailable) {
        setLocalLocked(locked);
        return locked;
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_locks")
        .select("id")
        .eq("class_id", classId)
        .eq("user_id", user.id)
        .eq("month", monthStart)
        .maybeSingle();

      if (existingData) {
        await (supabase as any)
          .from("attendance_locks")
          .update({ is_locked: locked, locked_at: new Date().toISOString() })
          .eq("id", existingData.id);
      } else {
        await (supabase as any).from("attendance_locks").insert({
          class_id: classId,
          user_id: user.id,
          month: monthStart,
          is_locked: locked,
          locked_by: user.id,
        });
      }
      return locked;
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_lock", classId, monthStart] });
    },
  });

  const refetch = useCallback(() => {
    attendanceQuery.refetch();
    holidaysQuery.refetch();
    lockQuery.refetch();
    dayEventsQuery.refetch();
  }, [attendanceQuery, holidaysQuery, lockQuery, dayEventsQuery]);

  return {
    attendanceRecords,
    holidays,
    dayEvents,
    isLocked,
    dbAvailable,
    isLoading: attendanceQuery.isLoading || holidaysQuery.isLoading,
    isSaving: setAttendanceMutation.isPending || bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending,
    isTogglingHoliday: toggleHolidayMutation.isPending,
    isTogglingLock: toggleLockMutation.isPending,
    getAttendance,
    getAttendanceNote,
    getDayEvent,
    isHoliday,
    getHolidayDescription,
    getMonthStats,
    getDayStats,
    getYearlyData,
    setAttendance: async (params) => {
      await setAttendanceMutation.mutateAsync(params);
    },
    updateNote: async (params) => {
      await updateNoteMutation.mutateAsync(params);
    },
    bulkSetAttendance: async (params) => {
      await bulkSetAttendanceMutation.mutateAsync(params);
    },
    toggleHoliday: async (params) => {
      return await toggleHolidayMutation.mutateAsync(params);
    },
    upsertDayEvent: async (params) => {
      await upsertDayEventMutation.mutateAsync(params);
    },
    deleteDayEvent: async (date) => {
      await deleteDayEventMutation.mutateAsync(date);
    },
    toggleLock: async (locked) => {
      return await toggleLockMutation.mutateAsync(locked);
    },
    refetch,
    v2Dataset,
  };
}

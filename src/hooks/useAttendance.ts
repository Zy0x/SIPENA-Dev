import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, getDay } from "date-fns";

export interface AttendanceRecord {
  id?: string;
  class_id: string;
  student_id: string;
  date: string;
  status: "H" | "I" | "S" | "A" | "D";
  note?: string | null;
}

export interface HolidayRecord {
  id?: string;
  user_id?: string;
  date: string;
  description: string;
}

export interface DayEvent {
  id?: string;
  user_id?: string;
  date: string;
  label: string;
  description?: string;
  color?: string;
}

export interface AttendanceLock {
  id?: string;
  class_id: string;
  user_id?: string;
  month: string;
  is_locked: boolean;
}

export type WorkDayFormat = "5days" | "6days";
export type AttendanceStatusValue = "H" | "I" | "S" | "A" | "D";

export function useAttendance(classId: string, month: Date, workDayFormat: WorkDayFormat = "6days") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");

  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);
  const [localHolidays, setLocalHolidays] = useState<HolidayRecord[]>([]);
  const [localDayEvents, setLocalDayEvents] = useState<DayEvent[]>([]);
  const [localLocked, setLocalLocked] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);

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

  // Fetch attendance records
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
      if (error) { console.error("Error fetching attendance:", error); return []; }
      return (data || []) as AttendanceRecord[];
    },
    enabled: !!classId && !!user && dbAvailable,
  });

  // Fetch holidays
  const holidaysQuery = useQuery({
    queryKey: ["attendance_holidays", user?.id, dbAvailable],
    queryFn: async () => {
      if (!user || !dbAvailable) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_holidays")
        .select("*")
        .eq("user_id", user.id);
      if (error) { console.error("Error fetching holidays:", error); return []; }
      return (data || []) as HolidayRecord[];
    },
    enabled: !!user && dbAvailable,
  });

  // Fetch day events
  const dayEventsQuery = useQuery({
    queryKey: ["attendance_day_events", user?.id, dbAvailable],
    queryFn: async () => {
      if (!user || !dbAvailable) return [];
      try {
        const { data, error } = await (supabase as any)
          .from("attendance_day_events")
          .select("*")
          .eq("user_id", user.id);
        if (error) { return []; }
        return (data || []) as DayEvent[];
      } catch { return []; }
    },
    enabled: !!user && dbAvailable,
  });

  // Fetch lock status
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
      if (error) { console.error("Error fetching lock:", error); return { is_locked: true }; }
      return data || { is_locked: true };
    },
    enabled: !!classId && !!user && dbAvailable,
  });

  const attendanceRecords = dbAvailable ? (attendanceQuery.data || []) : localAttendance;
  const holidays = dbAvailable ? (holidaysQuery.data || []) : localHolidays;
  const dayEvents = dbAvailable ? (dayEventsQuery.data || []) : localDayEvents;
  const isLocked = dbAvailable ? (lockQuery.data?.is_locked ?? true) : localLocked;

  const getAttendance = useCallback(
    (studentId: string, date: Date): AttendanceStatusValue | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      const record = attendanceRecords.find(
        (r) => r.student_id === studentId && r.date === dateStr
      );
      return (record?.status as AttendanceStatusValue) ?? null;
    },
    [attendanceRecords]
  );

  const getAttendanceNote = useCallback(
    (studentId: string, date: Date): string | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      const record = attendanceRecords.find(
        (r) => r.student_id === studentId && r.date === dateStr
      );
      return record?.note ?? null;
    },
    [attendanceRecords]
  );

  const getDayEvent = useCallback(
    (date: Date): DayEvent | null => {
      const dateStr = format(date, "yyyy-MM-dd");
      return dayEvents.find((e) => e.date === dateStr) || null;
    },
    [dayEvents]
  );

  const isHoliday = useCallback(
    (date: Date): boolean => {
      const dayOfWeek = getDay(date);
      if (dayOfWeek === 0) return true;
      if (workDayFormat === "5days" && dayOfWeek === 6) return true;
      const dateStr = format(date, "yyyy-MM-dd");
      return holidays.some((h) => h.date === dateStr);
    },
    [holidays, workDayFormat]
  );

  const getHolidayDescription = useCallback(
    (date: Date): string | null => {
      const dayOfWeek = getDay(date);
      if (dayOfWeek === 0) return "Hari Minggu";
      if (workDayFormat === "5days" && dayOfWeek === 6) return "Hari Sabtu (Libur)";
      const dateStr = format(date, "yyyy-MM-dd");
      const holiday = holidays.find((h) => h.date === dateStr);
      return holiday?.description || null;
    },
    [holidays, workDayFormat]
  );

  // Set attendance mutation (supports D status + note)
  const setAttendanceMutation = useMutation({
    mutationFn: async ({
      studentId, date, status, note,
    }: {
      studentId: string;
      date: string;
      status: AttendanceStatusValue | null;
      note?: string | null;
    }) => {
      if (!user || !classId) throw new Error("User or class not set");

      if (!dbAvailable) {
        setLocalAttendance((prev) => {
          const existing = prev.findIndex(
            (r) => r.student_id === studentId && r.date === date
          );
          if (status === null) {
            return existing >= 0 ? prev.filter((_, i) => i !== existing) : prev;
          }
          if (existing >= 0) {
            const newRecords = [...prev];
            newRecords[existing] = { ...newRecords[existing], status, note: note !== undefined ? note : newRecords[existing].note };
            return newRecords;
          }
          return [...prev, { class_id: classId, student_id: studentId, date, status, note: note || null }];
        });
        return null;
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_records")
        .select("id")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("date", date)
        .maybeSingle();

      const existing = existingData as { id: string } | null;

      if (status === null) {
        if (existing) {
          await (supabase as any).from("attendance_records").delete().eq("id", existing.id);
        }
        return null;
      }

      const updatePayload: Record<string, unknown> = { status };
      if (note !== undefined) updatePayload.note = note;

      if (existing) {
        const { data, error } = await (supabase as any)
          .from("attendance_records")
          .update(updatePayload)
          .eq("id", existing.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from("attendance_records")
          .insert({
            class_id: classId, student_id: studentId, date, status,
            note: note || null, created_by: user.id,
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Update note only
  const updateNoteMutation = useMutation({
    mutationFn: async ({ studentId, date, note }: { studentId: string; date: string; note: string | null }) => {
      if (!user || !classId) throw new Error("User or class not set");

      if (!dbAvailable) {
        setLocalAttendance((prev) => {
          const idx = prev.findIndex(r => r.student_id === studentId && r.date === date);
          if (idx >= 0) {
            const newRecords = [...prev];
            newRecords[idx] = { ...newRecords[idx], note };
            return newRecords;
          }
          return prev;
        });
        return null;
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_records")
        .select("id")
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("date", date)
        .maybeSingle();

      if (existingData) {
        const { error } = await (supabase as any)
          .from("attendance_records")
          .update({ note })
          .eq("id", existingData.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Bulk set attendance
  const bulkSetAttendanceMutation = useMutation({
    mutationFn: async ({
      studentIds, date, status,
    }: {
      studentIds: string[];
      date: string;
      status: AttendanceStatusValue;
    }) => {
      if (!user || !classId) throw new Error("User or class not set");

      if (!dbAvailable) {
        setLocalAttendance((prev) => {
          const filtered = prev.filter((r) => r.date !== date);
          const newRecords = studentIds.map((studentId) => ({
            class_id: classId, student_id: studentId, date, status,
          }));
          return [...filtered, ...newRecords];
        });
        return null;
      }

      await (supabase as any).from("attendance_records").delete().eq("class_id", classId).eq("date", date);

      const records = studentIds.map((studentId) => ({
        class_id: classId, student_id: studentId, date, status, created_by: user.id,
      }));

      const { data, error } = await (supabase as any).from("attendance_records").insert(records).select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
      }
    },
  });

  // Toggle holiday
  const toggleHolidayMutation = useMutation({
    mutationFn: async ({ date, description }: { date: string; description?: string }) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        const exists = localHolidays.some((h) => h.date === date);
        setLocalHolidays((prev) => exists ? prev.filter((h) => h.date !== date) : [...prev, { date, description: description || "Hari Libur" }]);
        return { action: exists ? "deleted" : "added" };
      }

      const { data: existingData } = await (supabase as any)
        .from("attendance_holidays").select("id").eq("user_id", user.id).eq("date", date).maybeSingle();
      const existing = existingData as { id: string } | null;

      if (existing) {
        await (supabase as any).from("attendance_holidays").delete().eq("id", existing.id);
        return { action: "deleted" };
      } else {
        await (supabase as any).from("attendance_holidays").insert({ user_id: user.id, date, description: description || "Hari Libur" });
        return { action: "added" };
      }
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_holidays"] });
    },
  });

  // Day events CRUD
  const upsertDayEventMutation = useMutation({
    mutationFn: async (event: { date: string; label: string; description?: string; color?: string }) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        setLocalDayEvents((prev) => {
          const exists = prev.findIndex(e => e.date === event.date);
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
        .from("attendance_day_events").select("id").eq("user_id", user.id).eq("date", event.date).maybeSingle();

      if (existingData) {
        await (supabase as any).from("attendance_day_events")
          .update({ label: event.label, description: event.description, color: event.color, updated_at: new Date().toISOString() })
          .eq("id", existingData.id);
      } else {
        await (supabase as any).from("attendance_day_events")
          .insert({ user_id: user.id, date: event.date, label: event.label, description: event.description, color: event.color || "blue" });
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
        setLocalDayEvents(prev => prev.filter(e => e.date !== date));
        return;
      }

      await (supabase as any).from("attendance_day_events").delete().eq("user_id", user.id).eq("date", date);
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_day_events"] });
    },
  });

  // Toggle lock
  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      if (!user || !classId) throw new Error("User or class not set");
      if (!dbAvailable) { setLocalLocked(locked); return locked; }

      const { data: existingData } = await (supabase as any)
        .from("attendance_locks").select("id").eq("class_id", classId).eq("user_id", user.id).eq("month", monthStart).maybeSingle();
      const existing = existingData as { id: string } | null;

      if (existing) {
        await (supabase as any).from("attendance_locks").update({ is_locked: locked, locked_at: new Date().toISOString() }).eq("id", existing.id);
      } else {
        await (supabase as any).from("attendance_locks").insert({ class_id: classId, user_id: user.id, month: monthStart, is_locked: locked, locked_by: user.id });
      }
      return locked;
    },
    onSuccess: () => {
      if (dbAvailable) queryClient.invalidateQueries({ queryKey: ["attendance_lock", classId, monthStart] });
    },
  });

  // ✅ PERBAIKAN FINAL: Explicit conditionals untuk menghitung stats
  const getMonthStats = useCallback(() => {
    const stats = { H: 0, I: 0, S: 0, A: 0, D: 0, total: 0 };
    
    attendanceRecords.forEach((record) => {
      const status = record.status;
      
      // ✅ Explicit increment untuk setiap status
      if (status === "H") {
        stats.H++;
        stats.total++;
      } else if (status === "I") {
        stats.I++;
        stats.total++;
      } else if (status === "S") {
        stats.S++;
        stats.total++;
      } else if (status === "A") {
        stats.A++;
        stats.total++;
      } else if (status === "D") {
        stats.D++;
        stats.total++;
      }
    });
    
    return stats;
  }, [attendanceRecords]);

  const getDayStats = useCallback((date: Date) => {
    const stats = { H: 0, I: 0, S: 0, A: 0, D: 0, total: 0 };
    const dateStr = format(date, "yyyy-MM-dd");
    
    attendanceRecords.forEach((record) => {
      if (record.date === dateStr) {
        const status = record.status;
        
        // ✅ Explicit increment untuk setiap status
        if (status === "H") {
          stats.H++;
          stats.total++;
        } else if (status === "I") {
          stats.I++;
          stats.total++;
        } else if (status === "S") {
          stats.S++;
          stats.total++;
        } else if (status === "A") {
          stats.A++;
          stats.total++;
        } else if (status === "D") {
          stats.D++;
          stats.total++;
        }
      }
    });
    
    return stats;
  }, [attendanceRecords]);

  // Export data for the entire year
  const getYearlyData = useCallback(async (year: number) => {
    if (!user || !classId) return { attendance: [], holidays: [], dayEvents: [] };

    const yearStart = format(new Date(year, 0, 1), "yyyy-MM-dd");
    const yearEnd = format(new Date(year, 11, 31), "yyyy-MM-dd");

    if (!dbAvailable) {
      return {
        attendance: localAttendance.filter(a => a.date >= yearStart && a.date <= yearEnd),
        holidays: localHolidays.filter(h => h.date >= yearStart && h.date <= yearEnd),
        dayEvents: localDayEvents.filter(e => e.date >= yearStart && e.date <= yearEnd),
      };
    }

    const [attendanceResult, holidaysResult, dayEventsResult] = await Promise.all([
      (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd),
      (supabase as any).from("attendance_holidays").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
      (supabase as any).from("attendance_day_events").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd).then((r: any) => r).catch(() => ({ data: [] })),
    ]);

    return {
      attendance: (attendanceResult.data || []) as AttendanceRecord[],
      holidays: (holidaysResult.data || []) as HolidayRecord[],
      dayEvents: (dayEventsResult.data || []) as DayEvent[],
    };
  }, [user, classId, dbAvailable, localAttendance, localHolidays, localDayEvents]);

  return {
    attendanceRecords, holidays, dayEvents, isLocked, dbAvailable,
    getAttendance, getAttendanceNote, getDayEvent,
    isHoliday, getHolidayDescription, getMonthStats, getDayStats, getYearlyData,
    isLoading: attendanceQuery.isLoading || holidaysQuery.isLoading,
    isLoadingLock: lockQuery.isLoading,
    setAttendance: async (params: { studentId: string; date: string; status: AttendanceStatusValue | null; note?: string | null }) => {
      await setAttendanceMutation.mutateAsync(params);
    },
    updateNote: async (params: { studentId: string; date: string; note: string | null }) => {
      await updateNoteMutation.mutateAsync(params);
    },
    bulkSetAttendance: async (params: { studentIds: string[]; date: string; status: AttendanceStatusValue }) => {
      await bulkSetAttendanceMutation.mutateAsync(params);
    },
    toggleHoliday: async (params: { date: string; description?: string }) => {
      return await toggleHolidayMutation.mutateAsync(params);
    },
    upsertDayEvent: async (params: { date: string; label: string; description?: string; color?: string }) => {
      await upsertDayEventMutation.mutateAsync(params);
    },
    deleteDayEvent: async (date: string) => {
      await deleteDayEventMutation.mutateAsync(date);
    },
    toggleLock: async (locked: boolean) => {
      await toggleLockMutation.mutateAsync(locked);
    },
    isSaving: setAttendanceMutation.isPending || bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending,
    isTogglingHoliday: toggleHolidayMutation.isPending,
    isTogglingLock: toggleLockMutation.isPending,
    refetch: () => {
      attendanceQuery.refetch();
      holidaysQuery.refetch();
      lockQuery.refetch();
      dayEventsQuery.refetch();
    },
  };
}
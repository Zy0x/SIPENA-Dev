import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, getDay } from "date-fns";
import { useMemo } from "react";
import { useAttendanceRuntime } from "@/features/attendance/runtime/useAttendanceRuntime";
import { providerConfig } from "@/config/provider.config";
import type { AttendanceDatasetCanonical } from "@/features/attendance/canonical/canonical.types";

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

export function useAttendanceV2(classId: string, month: Date, workDayFormat: WorkDayFormat = "6days") {
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

  // Fetch unified V2 dataset from REST API
  const datasetQuery = useQuery({
    queryKey: ["attendance_v2_dataset", classId, monthStart, dbAvailable],
    queryFn: async () => {
      if (!classId || !user || !dbAvailable) return null;

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      // Ambil format YYYY-MM untuk query parameter month
      const monthStr = monthStart.substring(0, 7);
      const url = `${providerConfig.apiBaseUrl}/attendance/v2?classId=${classId}&month=${monthStr}`;

      const res = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      const json = await res.json();
      return json.data as AttendanceDatasetCanonical;
    },
    enabled: !!classId && !!user && dbAvailable,
  });

  const attendanceRecords = useMemo(() => {
    if (!dbAvailable) return localAttendance;
    const records = datasetQuery.data?.records || [];
    return records.map((r) => ({
      id: r.id,
      class_id: r.classId,
      student_id: r.studentId,
      date: r.date,
      status: r.status as AttendanceStatusValue,
      note: r.note,
    }));
  }, [dbAvailable, datasetQuery.data?.records, localAttendance]);

  const holidays = useMemo(() => {
    if (!dbAvailable) return localHolidays;
    const records = datasetQuery.data?.holidays || [];
    return records.map((h) => ({
      id: h.id,
      date: h.date,
      description: h.description,
    }));
  }, [dbAvailable, datasetQuery.data?.holidays, localHolidays]);

  const dayEvents = useMemo(() => {
    if (!dbAvailable) return localDayEvents;
    const records = datasetQuery.data?.dayEvents || [];
    return records.map((e) => ({
      id: e.id,
      date: e.date,
      label: e.label,
      description: e.description ?? undefined,
      color: e.color ?? undefined,
    }));
  }, [dbAvailable, datasetQuery.data?.dayEvents, localDayEvents]);

  const isLocked = useMemo(() => {
    if (!dbAvailable) return localLocked;
    const locks = datasetQuery.data?.locks || [];
    return locks.some((l) => l.isLocked);
  }, [dbAvailable, datasetQuery.data?.locks, localLocked]);

  const runtime = useAttendanceRuntime();

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

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/record`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          classId,
          studentId,
          date,
          status,
          note: note !== undefined ? note : null,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
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

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/note`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          classId,
          studentId,
          date,
          note,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
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

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          patches: studentIds.map(studentId => ({
            classId,
            studentId,
            date,
            status,
          })),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
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

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/holiday`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          date,
          description: description || "Hari Libur",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
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

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/day-event`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          date: event.date,
          label: event.label,
          description: event.description || null,
          color: event.color || "blue",
          action: "upsert",
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
    },
  });

  const deleteDayEventMutation = useMutation({
    mutationFn: async (date: string) => {
      if (!user) throw new Error("User not authenticated");

      if (!dbAvailable) {
        setLocalDayEvents(prev => prev.filter(e => e.date !== date));
        return;
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/day-event`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          date,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
    },
  });

  // Toggle lock
  const toggleLockMutation = useMutation({
    mutationFn: async (locked: boolean) => {
      if (!user || !classId) throw new Error("User or class not set");
      if (!dbAvailable) { setLocalLocked(locked); return locked; }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/lock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          classId,
          month: monthStart.substring(0, 7),
          isLocked: locked,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return locked;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
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
    getAttendance,
    getAttendanceNote,
    getDayEvent,
    isHoliday,
    getHolidayDescription,
    getMonthStats,
    getDayStats,
    getYearlyData,
    isLoading: datasetQuery.isLoading,
    isLoadingLock: datasetQuery.isLoading,
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
      datasetQuery.refetch();
    },
  };
}
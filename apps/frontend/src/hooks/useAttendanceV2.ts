import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, getDay, eachDayOfInterval } from "date-fns";
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
  is_national?: boolean;
  class_id?: string | null;
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

export interface RecapProfile {
  id?: string;
  name: string;
  counted_statuses: AttendanceStatusValue[];
  present_statuses: AttendanceStatusValue[];
  absence_statuses: AttendanceStatusValue[];
  denominator_policy: "effective_days" | "filled_days" | "custom";
  display_order: AttendanceStatusValue[];
}

export interface MonthSnapshot {
  id: string;
  class_id: string;
  month: string;
  snapshot_json: any;
  calendar_version: any;
  reason?: string | null;
  created_at: string;
}

export interface Delegation {
  id: string;
  class_id: string;
  grantee_user_id: string;
  grantee_label?: string | null;
  actor_role: "owner" | "teacher" | "substitute" | "guest" | "admin";
  permissions: string[];
  starts_at: string;
  ends_at: string;
  revoked_at?: string | null;
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

      try {
        const res = await fetch(url, {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`,
          },
        });

        if (res.ok) {
          const json = await res.json();
          if (json.data && !json.error) {
            return json.data as AttendanceDatasetCanonical;
          }
        }
      } catch (apiError) {
        console.warn("V2 API Fetch failed, falling back to direct Supabase queries:", apiError);
      }

      // Direct Supabase Fallback Fetch
      const [recordsRes, holidaysRes, dayEventsRes, locksRes, studentsRes] = await Promise.all([
        (supabase as any).from("attendance_v2_records").select("*").eq("class_id", classId).gte("date", monthStart).lte("date", monthEnd),
        (supabase as any).from("attendance_v2_holidays").select("*").or(`class_id.eq.${classId},class_id.is.null`).gte("date", monthStart).lte("date", monthEnd),
        (supabase as any).from("attendance_v2_day_events").select("*").eq("class_id", classId).gte("date", monthStart).lte("date", monthEnd),
        (supabase as any).from("attendance_v2_locks").select("*").eq("class_id", classId).eq("month", monthStr),
        (supabase as any).from("students").select("id, name").eq("class_id", classId)
      ]);

      const daysOfInterval = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
      const days = daysOfInterval.map(d => ({
        date: format(d, "yyyy-MM-dd"),
        dayOfWeek: getDay(d),
      }));

      return {
        classId,
        month: monthStr,
        students: (studentsRes.data || []).map((s: any) => ({ id: s.id, name: s.name })),
        records: (recordsRes.data || []).map((r: any) => ({
          id: r.id,
          classId: r.class_id,
          studentId: r.student_id,
          date: r.date,
          status: r.status,
          note: r.note,
        })),
        holidays: (holidaysRes.data || []).map((h: any) => ({
          id: h.id,
          date: h.date,
          description: h.description,
        })),
        dayEvents: (dayEventsRes.data || []).map((e: any) => ({
          id: e.id,
          date: e.date,
          label: e.label,
          description: e.description,
          color: e.color,
        })),
        locks: (locksRes.data || []).map((l: any) => ({
          isLocked: l.is_locked,
        })),
        days
      } as AttendanceDatasetCanonical;
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

  interface OfflineMutation {
    id: string;
    type: "setAttendance" | "updateNote" | "bulkSetAttendance" | "toggleHoliday" | "upsertDayEvent" | "deleteDayEvent" | "toggleLock";
    params: any;
    timestamp: number;
  }

  const syncInProgressRef = useRef(false);

  const addOfflineMutation = useCallback((type: OfflineMutation["type"], params: any) => {
    try {
      const key = `attendance_v2_pending_sync_${user?.id || "anon"}`;
      const existingRaw = localStorage.getItem(key);
      const queue: OfflineMutation[] = existingRaw ? JSON.parse(existingRaw) : [];
      queue.push({
        id: Math.random().toString(36).substring(7),
        type,
        params,
        timestamp: Date.now(),
      });
      localStorage.setItem(key, JSON.stringify(queue));
    } catch (e) {
      console.error("Error saving offline mutation:", e);
    }
  }, [user]);

  useEffect(() => {
    if (!dbAvailable || !user || syncInProgressRef.current) return;

    const key = `attendance_v2_pending_sync_${user.id}`;
    const rawQueue = localStorage.getItem(key);
    if (!rawQueue) return;

    let queue: OfflineMutation[] = [];
    try {
      queue = JSON.parse(rawQueue);
    } catch {
      return;
    }

    if (queue.length === 0) return;

    const performSync = async () => {
      syncInProgressRef.current = true;
      let successCount = 0;
      
      window.dispatchEvent(new CustomEvent("attendance_v2_sync_start", { detail: { count: queue.length } }));

      for (const item of queue) {
        try {
          if (item.type === "setAttendance") {
            await setAttendanceMutation.mutateAsync(item.params);
          } else if (item.type === "updateNote") {
            await updateNoteMutation.mutateAsync(item.params);
          } else if (item.type === "bulkSetAttendance") {
            await bulkSetAttendanceMutation.mutateAsync(item.params);
          } else if (item.type === "toggleHoliday") {
            await toggleHolidayMutation.mutateAsync(item.params);
          } else if (item.type === "upsertDayEvent") {
            await upsertDayEventMutation.mutateAsync(item.params);
          } else if (item.type === "deleteDayEvent") {
            await deleteDayEventMutation.mutateAsync(item.params);
          } else if (item.type === "toggleLock") {
            await toggleLockMutation.mutateAsync(item.params);
          }
          successCount++;
        } catch (err) {
          console.error(`Offline sync failed for mutation type ${item.type}:`, err);
        }
      }

      localStorage.removeItem(key);
      window.dispatchEvent(new CustomEvent("attendance_v2_sync_complete", { detail: { successCount, totalCount: queue.length } }));
      
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      syncInProgressRef.current = false;
    };

    performSync();
  }, [dbAvailable, user, classId, monthStart]);

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
        addOfflineMutation("setAttendance", { studentId, date, status, note });
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

      try {
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

        if (response.ok) {
          const json = await response.json();
          return json.data;
        }
      } catch (apiError) {
        console.warn("V2 API Record Save failed, falling back to direct Supabase RPC:", apiError);
      }

      // Fallback Direct Supabase RPC
      const { data, error } = await (supabase as any).rpc("upsert_attendance_record", {
        p_user_id: user.id,
        p_class_id: classId,
        p_student_id: studentId,
        p_date: date,
        p_status: status,
        p_note: note !== undefined ? note : null,
        p_source: "manual",
      });

      if (error) throw error;
      return data;
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
        addOfflineMutation("updateNote", { studentId, date, note });
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

      try {
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

        if (response.ok) return;
      } catch (apiError) {
        console.warn("V2 API Update Note failed, falling back to direct Supabase update:", apiError);
      }

      // Fallback Direct Supabase Call
      const { error } = await (supabase as any)
        .from("attendance_v2_records")
        .update({ note })
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("date", date);

      if (error) throw error;
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
        addOfflineMutation("bulkSetAttendance", { studentIds, date, status });
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

      try {
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

        if (response.ok) {
          const json = await response.json();
          return json.data;
        }
      } catch (apiError) {
        console.warn("V2 API Bulk Save failed, falling back to direct Supabase RPCs:", apiError);
      }

      // Fallback Direct Supabase RPC
      const results = [];
      for (const studentId of studentIds) {
        const { data, error } = await (supabase as any).rpc("upsert_attendance_record", {
          p_user_id: user.id,
          p_class_id: classId,
          p_student_id: studentId,
          p_date: date,
          p_status: status,
          p_note: null,
          p_source: "manual",
        });
        if (error) throw error;
        results.push(data);
      }
      return results;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
    },
  });

  // Toggle holiday
  const toggleHolidayMutation = useMutation({
    mutationFn: async ({ date, description, classId: targetClassId }: { date: string; description?: string; classId?: string | null }) => {
      if (!user) throw new Error("User not authenticated");

      const resolvedClassId = targetClassId !== undefined ? targetClassId : classId;

      if (!dbAvailable) {
        addOfflineMutation("toggleHoliday", { date, description, classId: resolvedClassId });
        const exists = localHolidays.some((h) => h.date === date && (resolvedClassId ? h.class_id === resolvedClassId : !h.class_id));
        setLocalHolidays((prev) => exists 
          ? prev.filter((h) => !(h.date === date && (resolvedClassId ? h.class_id === resolvedClassId : !h.class_id))) 
          : [...prev, { date, description: description || "Hari Libur", class_id: resolvedClassId || null } as any]
        );
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
          classId: resolvedClassId,
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
        addOfflineMutation("upsertDayEvent", event);
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
        addOfflineMutation("deleteDayEvent", date);
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
      if (!dbAvailable) {
        addOfflineMutation("toggleLock", locked);
        setLocalLocked(locked);
        return locked;
      }

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

  // Promote V2 dataset to V1 (Merge sandbox data to production)
  const promoteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !classId) throw new Error("User or class not set");
      if (!dbAvailable) throw new Error("Database not available for promotion");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/promote`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          classId,
          month: monthStart.substring(0, 7),
          workDayFormat,
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
        queryClient.invalidateQueries({ queryKey: ["attendance", classId, monthStart] });
        queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
      }
    },
  });

  // Recap Profile Query
  const recapProfileQuery = useQuery({
    queryKey: ["attendance_v2_recap_profile", classId],
    queryFn: async (): Promise<RecapProfile> => {
      if (!user || !classId || !dbAvailable) {
        return {
          name: "Default HSIAD",
          counted_statuses: ["H", "S", "I", "A", "D"],
          present_statuses: ["H", "D"],
          absence_statuses: ["S", "I", "A"],
          denominator_policy: "effective_days",
          display_order: ["H", "S", "I", "A", "D"],
        };
      }
      const { data, error } = await (supabase as any)
        .from("attendance_v2_recap_profiles")
        .select("*")
        .or(`class_id.eq.${classId},class_id.is.null`)
        .order("class_id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        return {
          name: "Default HSIAD",
          counted_statuses: ["H", "S", "I", "A", "D"],
          present_statuses: ["H", "D"],
          absence_statuses: ["S", "I", "A"],
          denominator_policy: "effective_days",
          display_order: ["H", "S", "I", "A", "D"],
        };
      }
      return {
        id: data.id,
        name: data.name,
        counted_statuses: data.counted_statuses,
        present_statuses: data.present_statuses,
        absence_statuses: data.absence_statuses,
        denominator_policy: data.denominator_policy,
        display_order: data.display_order,
      };
    },
    enabled: !!user && !!classId && dbAvailable,
  });

  const recapProfile = recapProfileQuery.data || {
    name: "Default HSIAD",
    counted_statuses: ["H", "S", "I", "A", "D"] as AttendanceStatusValue[],
    present_statuses: ["H", "D"] as AttendanceStatusValue[],
    absence_statuses: ["S", "I", "A"] as AttendanceStatusValue[],
    denominator_policy: "effective_days" as const,
    display_order: ["H", "S", "I", "A", "D"] as AttendanceStatusValue[],
  };

  // Upsert Recap Profile Mutation
  const upsertRecapProfileMutation = useMutation({
    mutationFn: async (profile: Omit<RecapProfile, "id"> & { id?: string }) => {
      if (!user || !classId || !dbAvailable) return;
      
      const payload = {
        user_id: user.id,
        class_id: classId,
        name: profile.name || "Custom Profile",
        counted_statuses: profile.counted_statuses,
        present_statuses: profile.present_statuses,
        absence_statuses: profile.absence_statuses,
        denominator_policy: profile.denominator_policy,
        display_order: profile.display_order,
      };

      let result;
      if (profile.id) {
        result = await (supabase as any)
          .from("attendance_v2_recap_profiles")
          .update(payload)
          .eq("id", profile.id);
      } else {
        result = await (supabase as any)
          .from("attendance_v2_recap_profiles")
          .insert([payload]);
      }

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_recap_profile", classId] });
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
    },
  });

  // Snapshots Query
  const snapshotsQuery = useQuery({
    queryKey: ["attendance_v2_snapshots", classId, monthStart.substring(0, 7)],
    queryFn: async (): Promise<MonthSnapshot[]> => {
      if (!user || !classId || !dbAvailable) return [];
      const currentMonthStr = monthStart.substring(0, 7);
      const { data, error } = await (supabase as any)
        .from("attendance_v2_month_snapshots")
        .select("*")
        .eq("class_id", classId)
        .eq("month", currentMonthStr)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any || []) as MonthSnapshot[];
    },
    enabled: !!user && !!classId && dbAvailable,
  });

  const snapshots = snapshotsQuery.data || [];

  // Create Snapshot Mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async (reason: string | null) => {
      if (!user || !classId || !dbAvailable) throw new Error("Connection or parameter missing");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/snapshots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({
          classId,
          month: monthStart.substring(0, 7),
          reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
      
      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_snapshots", classId, monthStart.substring(0, 7)] });
    },
  });

  // Restore Snapshot Mutation
  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!user || !dbAvailable) throw new Error("Connection or parameter missing");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${providerConfig.apiBaseUrl}/attendance/v2/restore`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token || ""}`,
        },
        body: JSON.stringify({ snapshotId }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const json = await response.json();
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStart] });
    },
  });

  // Delegations Query
  const delegationsQuery = useQuery({
    queryKey: ["attendance_v2_delegations", classId],
    queryFn: async (): Promise<Delegation[]> => {
      if (!user || !classId || !dbAvailable) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_v2_delegations")
        .select("*")
        .eq("class_id", classId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any || []) as Delegation[];
    },
    enabled: !!user && !!classId && dbAvailable,
  });

  const delegations = delegationsQuery.data || [];

  // Create Delegation Mutation
  const createDelegationMutation = useMutation({
    mutationFn: async (payload: { granteeUserId: string; granteeLabel: string; startsAt: Date; endsAt: Date }) => {
      if (!user || !classId || !dbAvailable) return;
      
      const { error } = await (supabase as any)
        .from("attendance_v2_delegations")
        .insert([{
          user_id: user.id,
          class_id: classId,
          granted_by: user.id,
          grantee_user_id: payload.granteeUserId,
          grantee_label: payload.granteeLabel,
          actor_role: "substitute",
          permissions: ["read", "write"],
          starts_at: payload.startsAt.toISOString(),
          ends_at: payload.endsAt.toISOString(),
        }]);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_delegations", classId] });
    },
  });

  // Revoke Delegation Mutation
  const revokeDelegationMutation = useMutation({
    mutationFn: async (delegationId: string) => {
      if (!user || !dbAvailable) return;

      const { error } = await (supabase as any)
        .from("attendance_v2_delegations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", delegationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_v2_delegations", classId] });
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
      (supabase as any).from("attendance_v2_records").select("*").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd),
      (supabase as any).from("attendance_v2_holidays").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
      (supabase as any).from("attendance_v2_day_events").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd).then((r: any) => r).catch(() => ({ data: [] })),
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
    toggleHoliday: async (params: { date: string; description?: string; classId?: string | null }) => {
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
    promoteV2ToV1: async () => {
      await promoteMutation.mutateAsync();
    },
    recapProfile,
    snapshots,
    delegations,
    updateRecapProfile: async (profile: Omit<RecapProfile, "id"> & { id?: string }) => {
      await upsertRecapProfileMutation.mutateAsync(profile);
    },
    createSnapshot: async (reason: string | null) => {
      await createSnapshotMutation.mutateAsync(reason);
    },
    restoreSnapshot: async (snapshotId: string) => {
      await restoreSnapshotMutation.mutateAsync(snapshotId);
    },
    createDelegation: async (params: { granteeUserId: string; granteeLabel: string; startsAt: Date; endsAt: Date }) => {
      await createDelegationMutation.mutateAsync(params);
    },
    revokeDelegation: async (delegationId: string) => {
      await revokeDelegationMutation.mutateAsync(delegationId);
    },
    isUpdatingRecapProfile: upsertRecapProfileMutation.isPending,
    isCreatingSnapshot: createSnapshotMutation.isPending,
    isRestoringSnapshot: restoreSnapshotMutation.isPending,
    isCreatingDelegation: createDelegationMutation.isPending,
    isRevokingDelegation: revokeDelegationMutation.isPending,
    isSaving: setAttendanceMutation.isPending || bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending,
    isTogglingHoliday: toggleHolidayMutation.isPending,
    isTogglingLock: toggleLockMutation.isPending,
    isPromoting: promoteMutation.isPending,
    refetch: () => {
      datasetQuery.refetch();
    },
  };
}
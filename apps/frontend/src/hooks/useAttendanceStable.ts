import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase, EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { format, startOfMonth, endOfMonth, getDay, eachDayOfInterval, addMonths } from "date-fns";
import { useMemo } from "react";
import { useAttendanceRuntime } from "@/features/attendance/runtime/useAttendanceRuntime";
import { providerConfig } from "@/config/provider.config";
import type { AttendanceDatasetCanonical } from "@/features/attendance/canonical/canonical.types";

const apiBaseUrl = (() => {
  const base = providerConfig.apiBaseUrl;
  const isApiLocal = base.includes("localhost") || base.includes("127.0.0.1");
  const isLocationLocal = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  if (isApiLocal && !isLocationLocal) {
    return "https://disabled-local-api.invalid";
  }
  return base;
})();

type AttendanceStorageMode = "legacy";

const getAttendanceStorageMode = (): AttendanceStorageMode => {
  return "legacy";
};

import {
  createAttendancePersistOutcome,
  useQueuedAttendanceSave,
} from "@/features/attendance/performance/useQueuedAttendanceSave";

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

type AttendanceMutationParams = {
  studentId: string;
  date: string;
  status: AttendanceStatusValue | null;
  note?: string | null;
  updatedAt?: string | null;
};
type QueuedAttendanceMutationParams = AttendanceMutationParams & { classId: string };

type AttendanceStats = Record<AttendanceStatusValue | "total", number>;
type AttendanceCellSnapshot = AttendanceRecord | AttendanceDatasetCanonical["records"][number] | null;

const createEmptyStats = (): AttendanceStats => ({ H: 0, I: 0, S: 0, A: 0, D: 0, total: 0 });
const buildAttendanceLookupKey = (studentId: string, date: string) => `${studentId}:${date}`;

const applyAttendancePatch = (
  records: AttendanceRecord[],
  classId: string,
  patch: AttendanceMutationParams,
  persistedRecord?: Partial<AttendanceRecord> | null
): AttendanceRecord[] => {
  const index = records.findIndex((record) => record.student_id === patch.studentId && record.date === patch.date);

  if (patch.status === null) {
    return index >= 0 ? records.filter((_, i) => i !== index) : records;
  }

  const existing = index >= 0 ? records[index] : undefined;
  const nextRecord: AttendanceRecord = {
    class_id: existing?.class_id ?? classId,
    student_id: patch.studentId,
    date: patch.date,
    status: patch.status,
    note: patch.note !== undefined ? patch.note : existing?.note ?? null,
    ...persistedRecord,
  };

  if (index >= 0) {
    const next = [...records];
    next[index] = { ...existing, ...nextRecord };
    return next;
  }

  return [...records, nextRecord];
};

const applyAttendanceDatasetPatch = (
  dataset: AttendanceDatasetCanonical | null | undefined,
  classId: string,
  patch: AttendanceMutationParams,
  persistedId?: string | null,
  persistedUpdatedAt?: string | null
): AttendanceDatasetCanonical | null | undefined => {
  if (!dataset) return dataset;

  const index = dataset.records.findIndex((record) => record.studentId === patch.studentId && record.date === patch.date);
  if (patch.status === null) {
    return {
      ...dataset,
      records: index >= 0 ? dataset.records.filter((_, i) => i !== index) : dataset.records,
    };
  }

  const existing = index >= 0 ? dataset.records[index] : undefined;
  const nowIso = new Date().toISOString();
  const nextRecord = {
    ...(existing ?? {}),
    id: persistedId ?? existing?.id ?? `optimistic-${patch.studentId}-${patch.date}`,
    classId: existing?.classId ?? classId,
    studentId: patch.studentId,
    date: patch.date,
    status: patch.status,
    note: patch.note !== undefined ? patch.note : existing?.note ?? null,
    createdAt: existing?.createdAt ?? nowIso,
    updatedAt: persistedUpdatedAt ?? existing?.updatedAt ?? nowIso,
  };

  const nextRecords = [...dataset.records];
  if (index >= 0) {
    nextRecords[index] = nextRecord;
  } else {
    nextRecords.push(nextRecord);
  }

  return { ...dataset, records: nextRecords };
};

const getPersistedRecordId = (data: unknown): string | null => {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (typeof obj.record_id === "string") return obj.record_id;
  if (typeof obj.id === "string") return obj.id;
  if (obj.data && typeof obj.data === "object") {
    const nested = obj.data as Record<string, unknown>;
    if (typeof nested.record_id === "string") return nested.record_id;
    if (typeof nested.id === "string") return nested.id;
  }
  return null;
};

export function useAttendanceStable(classId: string, month: Date, workDayFormat: WorkDayFormat = "6days") {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const monthStart = format(startOfMonth(month), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(month), "yyyy-MM-dd");
  const storageMode = useMemo(() => getAttendanceStorageMode(), []);
  const usesLegacyAttendanceStorage = storageMode === "legacy";

  const [localAttendance, setLocalAttendance] = useState<AttendanceRecord[]>([]);
  const [localHolidays, setLocalHolidays] = useState<HolidayRecord[]>([]);
  const [localDayEvents, setLocalDayEvents] = useState<DayEvent[]>([]);
  const [localLocked, setLocalLocked] = useState(true);
  const [dbAvailable, setDbAvailable] = useState(false);
  const attendanceRefreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateCacheRef = useRef<Map<number, string>>(new Map());
  const prevMonthStartRef = useRef(monthStart);
  if (prevMonthStartRef.current !== monthStart) {
    dateCacheRef.current.clear();
    prevMonthStartRef.current = monthStart;
  }

  const getFormattedDate = useCallback((date: Date) => {
    const time = date.getTime();
    let cached = dateCacheRef.current.get(time);
    if (!cached) {
      cached = format(date, "yyyy-MM-dd");
      dateCacheRef.current.set(time, cached);
    }
    return cached;
  }, [monthStart]);

  const attendanceDatasetQueryKey = useMemo(
    () => ["attendance_stable_dataset", storageMode, classId, monthStart, dbAvailable] as const,
    [storageMode, classId, monthStart, dbAvailable]
  );

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

  // Fetch stable attendance dataset from direct Supabase legacy tables
  const datasetQuery = useQuery({
    queryKey: attendanceDatasetQueryKey,
    queryFn: async () => {
      if (!classId || !user || !dbAvailable) return null;

      // Ambil format YYYY-MM untuk query parameter month
      const monthStr = monthStart.substring(0, 7);

      if (!usesLegacyAttendanceStorage) {
        const { data: { session } } = await (supabase as any).auth.getSession();
        const token = session?.access_token;
        const url = `${apiBaseUrl}/attendance/stable-api-disabled?classId=${classId}&month=${monthStr}`;

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
          console.warn("Stable API fetch skipped, falling back to direct Supabase queries:", apiError);
        }
      }

      // Direct Supabase Fallback Fetch
      const recordsQuery = usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", monthStart).lte("date", monthEnd)
        : (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", monthStart).lte("date", monthEnd);
      const holidaysQuery = usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_holidays").select("*").eq("user_id", user.id)
        : (supabase as any).from("attendance_holidays").select("*").or(`class_id.eq.${classId},class_id.is.null`).gte("date", monthStart).lte("date", monthEnd);
      const dayEventsQuery = usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_day_events").select("*").eq("user_id", user.id)
        : (supabase as any).from("attendance_day_events").select("*").eq("class_id", classId).gte("date", monthStart).lte("date", monthEnd);
      const locksQuery = usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_locks").select("*").eq("class_id", classId).eq("user_id", user.id).eq("month", monthStart)
        : (supabase as any).from("attendance_locks").select("*").eq("class_id", classId).eq("month", monthStr);

      const [recordsRes, holidaysRes, dayEventsRes, locksRes, studentsRes] = await Promise.all([
        recordsQuery,
        holidaysQuery,
        dayEventsQuery,
        locksQuery,
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
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
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
    return locks.some((l: any) => l.isLocked === true || l.is_locked === true);
  }, [dbAvailable, datasetQuery.data?.locks, localLocked]);

  const runtime = useAttendanceRuntime();

  const attendanceRecordMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((record) => {
      map.set(buildAttendanceLookupKey(record.student_id, record.date), record);
    });
    return map;
  }, [attendanceRecords]);

  const dayEventMap = useMemo(() => {
    const map = new Map<string, DayEvent>();
    dayEvents.forEach((event) => {
      map.set(event.date, event);
    });
    return map;
  }, [dayEvents]);

  const holidayMap = useMemo(() => {
    const map = new Map<string, HolidayRecord>();
    holidays.forEach((holiday) => {
      map.set(holiday.date, holiday);
    });
    return map;
  }, [holidays]);

  const { monthStats, dayStatsMap } = useMemo(() => {
    const nextMonthStats = createEmptyStats();
    const nextDayStats = new Map<string, AttendanceStats>();

    attendanceRecords.forEach((record) => {
      const status = record.status;
      if (!status) return;

      nextMonthStats[status] += 1;
      nextMonthStats.total += 1;

      const dayStats = nextDayStats.get(record.date) ?? createEmptyStats();
      dayStats[status] += 1;
      dayStats.total += 1;
      nextDayStats.set(record.date, dayStats);
    });

    return { monthStats: nextMonthStats, dayStatsMap: nextDayStats };
  }, [attendanceRecords]);

  const scheduleAttendanceRefresh = useCallback(() => {
    if (!dbAvailable) return;
    if (attendanceRefreshTimerRef.current) {
      clearTimeout(attendanceRefreshTimerRef.current);
    }
    attendanceRefreshTimerRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
      attendanceRefreshTimerRef.current = null;
    }, 1800);
  }, [attendanceDatasetQueryKey, dbAvailable, queryClient]);

  useEffect(() => () => {
    if (attendanceRefreshTimerRef.current) {
      clearTimeout(attendanceRefreshTimerRef.current);
    }
  }, []);

  const getAttendance = useCallback(
    (studentId: string, date: Date): AttendanceStatusValue | null => {
      const dateStr = getFormattedDate(date);
      const record = attendanceRecordMap.get(buildAttendanceLookupKey(studentId, dateStr));
      return (record?.status as AttendanceStatusValue) ?? null;
    },
    [attendanceRecordMap, getFormattedDate]
  );

  const getAttendanceNote = useCallback(
    (studentId: string, date: Date): string | null => {
      const dateStr = getFormattedDate(date);
      const record = attendanceRecordMap.get(buildAttendanceLookupKey(studentId, dateStr));
      return record?.note ?? null;
    },
    [attendanceRecordMap, getFormattedDate]
  );

  const getDayEvent = useCallback(
    (date: Date): DayEvent | null => {
      const dateStr = getFormattedDate(date);
      return dayEventMap.get(dateStr) || null;
    },
    [dayEventMap, getFormattedDate]
  );

  const isHoliday = useCallback(
    (date: Date): boolean => {
      const dayOfWeek = getDay(date);
      if (dayOfWeek === 0) return true;
      if (workDayFormat === "5days" && dayOfWeek === 6) return true;
      const dateStr = getFormattedDate(date);
      return holidayMap.has(dateStr);
    },
    [holidayMap, workDayFormat, getFormattedDate]
  );

  const getHolidayDescription = useCallback(
    (date: Date): string | null => {
      const dayOfWeek = getDay(date);
      if (dayOfWeek === 0) return "Hari Minggu";
      if (workDayFormat === "5days" && dayOfWeek === 6) return "Hari Sabtu (Libur)";
      const dateStr = getFormattedDate(date);
      const holiday = holidayMap.get(dateStr);
      return holiday?.description || null;
    },
    [holidayMap, workDayFormat, getFormattedDate]
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
      const key = `attendance_stable_pending_sync_${user?.id || "anon"}`;
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

    const key = `attendance_stable_pending_sync_${user.id}`;
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
      
      window.dispatchEvent(new CustomEvent("attendance_stable_sync_start", { detail: { count: queue.length } }));

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
      window.dispatchEvent(new CustomEvent("attendance_stable_sync_complete", { detail: { successCount, totalCount: queue.length } }));
      
      queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
      syncInProgressRef.current = false;
    };

    performSync();
  }, [attendanceDatasetQueryKey, dbAvailable, user, classId, monthStart]);

  const persistLegacyAttendancePatch = useCallback(async ({
    studentId,
    date,
    status,
    note,
    classId: patchClassId,
  }: QueuedAttendanceMutationParams): Promise<AttendanceRecord | null> => {
    if (!user || !patchClassId) throw new Error("User or class not set");
    if (!dbAvailable) return null;

    const { data: existingData } = await (supabase as any)
      .from("attendance_records")
      .select("id,note")
      .eq("class_id", patchClassId)
      .eq("student_id", studentId)
      .eq("date", date)
      .maybeSingle();

    const existing = existingData as { id: string; note?: string | null } | null;

    if (status === null) {
      if (existing) {
        const { error } = await (supabase as any).from("attendance_records").delete().eq("id", existing.id);
        if (error) throw error;
      }
      return null;
    }

    const payload: Record<string, unknown> = { status };
    payload.note = note !== undefined ? note : existing?.note ?? null;

    if (existing) {
      const { data, error } = await (supabase as any)
        .from("attendance_records")
        .update(payload)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return data as AttendanceRecord;
    }

    const { data, error } = await (supabase as any)
      .from("attendance_records")
      .insert({
        class_id: patchClassId,
        student_id: studentId,
        date,
        status,
        note: note ?? null,
        created_by: user.id,
      })
      .select()
      .single();
    if (error) throw error;
    return data as AttendanceRecord;
  }, [dbAvailable, user]);

  // Set attendance mutation (supports D status + note)
  const setAttendanceMutation = useMutation({
    mutationFn: async ({
      studentId, date, status, note,
    }: AttendanceMutationParams) => {
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

      if (usesLegacyAttendanceStorage) {
        return persistLegacyAttendancePatch({ classId, studentId, date, status, note });
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      try {
        const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/record`, {
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
        console.warn("Stable API record save skipped, falling back to direct Supabase RPC:", apiError);
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
      if (data && typeof data === "object" && "success" in data && (data as { success?: boolean }).success === false) {
        throw new Error(String((data as { message?: string; error_code?: string }).message || (data as { error_code?: string }).error_code || "Gagal menyimpan presensi"));
      }
      return data;
    },
    onMutate: async (params) => {
      if (!dbAvailable) return { previousDataset: undefined };

      await queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });
      const previousDataset = queryClient.getQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey);
      queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) =>
        applyAttendanceDatasetPatch(current, classId, params) as AttendanceDatasetCanonical | null
      );

      return { previousDataset };
    },
    onError: (_error, _params, context) => {
      if (dbAvailable && context) {
        queryClient.setQueryData(attendanceDatasetQueryKey, context.previousDataset ?? null);
      }
    },
    onSuccess: (data, params) => {
      if (!dbAvailable) return;

      const persistedId = getPersistedRecordId(data);
      queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) =>
        applyAttendanceDatasetPatch(current, classId, params, persistedId) as AttendanceDatasetCanonical | null
      );
      scheduleAttendanceRefresh();
    },
  });

  const getAttendanceCellSnapshot = useCallback((patch: QueuedAttendanceMutationParams): AttendanceCellSnapshot => {
    if (!dbAvailable) {
      return localAttendance.find((record) => record.student_id === patch.studentId && record.date === patch.date) ?? null;
    }

    const dataset = queryClient.getQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey);
    return dataset?.records.find((record) => record.studentId === patch.studentId && record.date === patch.date) ?? null;
  }, [attendanceDatasetQueryKey, dbAvailable, localAttendance, queryClient]);

  const applyOptimisticAttendancePatch = useCallback((patch: QueuedAttendanceMutationParams) => {
    if (!dbAvailable) {
      setLocalAttendance((current) => applyAttendancePatch(current, patch.classId, patch));
      return;
    }

    if (queryClient.isFetching({ queryKey: attendanceDatasetQueryKey }) > 0) {
      void queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });
    }
    queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) =>
      applyAttendanceDatasetPatch(current, patch.classId, patch) as AttendanceDatasetCanonical | null
    );
  }, [attendanceDatasetQueryKey, dbAvailable, queryClient]);

  const rollbackAttendancePatch = useCallback((patch: QueuedAttendanceMutationParams, snapshot: unknown) => {
    const previous = snapshot as AttendanceCellSnapshot;

    if (!dbAvailable) {
      const previousLocal = previous && "student_id" in previous ? previous : null;
      const rollbackPatch: AttendanceMutationParams = previousLocal
        ? { studentId: patch.studentId, date: patch.date, status: previousLocal.status, note: previousLocal.note ?? null }
        : { studentId: patch.studentId, date: patch.date, status: null };
      setLocalAttendance((current) =>
        previousLocal
          ? applyAttendancePatch(current, patch.classId, rollbackPatch, previousLocal)
          : applyAttendancePatch(current, patch.classId, rollbackPatch)
      );
      return;
    }

    const previousCanonical = previous && "studentId" in previous ? previous : null;
    const rollbackPatch: AttendanceMutationParams = previousCanonical
      ? { studentId: patch.studentId, date: patch.date, status: previousCanonical.status as AttendanceStatusValue, note: previousCanonical.note ?? null }
      : { studentId: patch.studentId, date: patch.date, status: null };

    queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) =>
      previousCanonical
        ? applyAttendanceDatasetPatch(current, patch.classId, rollbackPatch, previousCanonical.id) as AttendanceDatasetCanonical | null
        : applyAttendanceDatasetPatch(current, patch.classId, rollbackPatch) as AttendanceDatasetCanonical | null
    );
  }, [attendanceDatasetQueryKey, dbAvailable, queryClient]);

  const persistQueuedAttendancePatches = useCallback(async (
    entries: Array<{ key: string; patch: QueuedAttendanceMutationParams; sequence: number; previousSnapshot?: any }>
  ) => {
    const outcome = createAttendancePersistOutcome<any>();
    if (!user) {
      entries.forEach((entry) => outcome.failures.set(entry.key, new Error("User or class not set")));
      return outcome;
    }

    if (!dbAvailable) {
      entries.forEach((entry) => {
        addOfflineMutation("setAttendance", entry.patch);
        outcome.successes.set(entry.key, null);
      });
      return outcome;
    }

    const { data: { session } } = await (supabase as any).auth.getSession();
    const token = session?.access_token;

    let cursor = 0;
    const workerCount = Math.min(4, entries.length);
    const runWorker = async () => {
      while (cursor < entries.length) {
        const entry = entries[cursor];
        cursor += 1;
        try {
          const snapshot = entry.previousSnapshot;

          if (usesLegacyAttendanceStorage) {
            const result = await persistLegacyAttendancePatch(entry.patch);
            outcome.successes.set(entry.key, result ? { id: result.id, updatedAt: null } : null);
            continue;
          }

          const expectedUpdatedAt = snapshot && 'updatedAt' in snapshot ? snapshot.updatedAt : (snapshot && 'updated_at' in snapshot ? snapshot.updated_at : null);
          
          const { data, error } = await (supabase as any).rpc("upsert_attendance_record", {
            p_user_id: user.id,
            p_class_id: entry.patch.classId,
            p_student_id: entry.patch.studentId,
            p_date: entry.patch.date,
            p_status: entry.patch.status,
            p_note: entry.patch.note !== undefined ? entry.patch.note : (snapshot && 'note' in snapshot ? snapshot.note : null),
            p_expected_updated_at: expectedUpdatedAt,
            p_source: "manual",
          });
          if (error) {
            if (error.message?.includes("Conflict 409") || error.details?.includes("Conflict 409") || error.hint?.includes("Conflict 409")) {
              console.warn("Optimistic locking conflict detected, bypassing for rapid user clicks...");
              // Bypass optimistic locking for rapid self-edits by setting p_expected_updated_at to null
              const { data: retryData, error: retryError } = await (supabase as any).rpc("upsert_attendance_record", {
                p_user_id: user.id,
                p_class_id: entry.patch.classId,
                p_student_id: entry.patch.studentId,
                p_date: entry.patch.date,
                p_status: entry.patch.status,
                p_note: entry.patch.note !== undefined ? entry.patch.note : (snapshot && 'note' in snapshot ? snapshot.note : null),
                p_expected_updated_at: null,
                p_source: "manual",
              });
              if (retryError) throw retryError;
              
              outcome.successes.set(entry.key, {
                id: getPersistedRecordId(retryData),
                updatedAt: retryData?.updated_at || retryData?.updatedAt || null
              });
              continue;
            }

            console.warn("RPC upsert_attendance_record failed, attempting fallback:", error);
            if (!entry.patch.status || entry.patch.status === ("-" as any)) {
              const { error: delError } = await (supabase as any)
                .from("attendance_records")
                .delete()
                .eq("class_id", entry.patch.classId)
                .eq("student_id", entry.patch.studentId)
                .eq("date", entry.patch.date);
              if (delError) throw delError;
              outcome.successes.set(entry.key, null);
            } else {
              const fallbackData: any = {
                user_id: user.id,
                class_id: entry.patch.classId,
                student_id: entry.patch.studentId,
                date: entry.patch.date,
                status: entry.patch.status,
                source: "manual",
              };
              if (entry.patch.note !== undefined) {
                fallbackData.note = entry.patch.note;
              } else if (snapshot && 'note' in snapshot) {
                fallbackData.note = snapshot.note;
              }
              const { data: fbData, error: fbError } = await (supabase as any)
                .from("attendance_records")
                .upsert(fallbackData, { onConflict: 'user_id, class_id, student_id, date' })
                .select("updated_at")
                .single();
              if (fbError) throw fbError;
              outcome.successes.set(entry.key, fbData?.updated_at || null);
            }
          } else {
            outcome.successes.set(entry.key, {
              id: getPersistedRecordId(data),
              updatedAt: data?.updated_at || data?.updatedAt || null
            });
          }
        } catch (error) {
          outcome.failures.set(entry.key, error);
        }
      }
    };

    await Promise.all(Array.from({ length: workerCount }, runWorker));
    return outcome;
  }, [addOfflineMutation, dbAvailable, persistLegacyAttendancePatch, user, usesLegacyAttendanceStorage]);

  const attendanceSaveQueue = useQueuedAttendanceSave<QueuedAttendanceMutationParams, any>({
    debounceMs: 300,
    buildKey: (patch) => `${patch.classId}:${patch.studentId}:${patch.date}`,
    getSnapshot: getAttendanceCellSnapshot,
    applyOptimistic: applyOptimisticAttendancePatch,
    rollback: rollbackAttendancePatch,
    persist: persistQueuedAttendancePatches,
    reconcileSuccess: (patch, persistedData) => {
      if (!dbAvailable || patch.classId !== classId) return;
      queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) =>
        applyAttendanceDatasetPatch(current, patch.classId, patch, persistedData?.id, persistedData?.updatedAt) as AttendanceDatasetCanonical | null
      );
    },
    onDrain: scheduleAttendanceRefresh,
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

      if (usesLegacyAttendanceStorage) {
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
        return null;
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      try {
        const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/note`, {
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
        console.warn("Stable API note save skipped, falling back to direct Supabase update:", apiError);
      }

      // Fallback Direct Supabase Call
      const { error } = await (supabase as any)
        .from("attendance_records")
        .update({ note })
        .eq("class_id", classId)
        .eq("student_id", studentId)
        .eq("date", date);

      if (error) throw error;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
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

      if (usesLegacyAttendanceStorage) {
        const { error: deleteError } = await (supabase as any)
          .from("attendance_records")
          .delete()
          .eq("class_id", classId)
          .eq("date", date);
        if (deleteError) throw deleteError;

        const records = studentIds.map((studentId) => ({
          class_id: classId,
          student_id: studentId,
          date,
          status,
          created_by: user.id,
        }));

        const { data, error } = await (supabase as any).from("attendance_records").insert(records).select();
        if (error) throw error;
        return data;
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      try {
        const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/bulk`, {
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
        console.warn("Stable API bulk save skipped, falling back to direct Supabase RPCs:", apiError);
      }

      // Fallback Direct Supabase RPC
      const payload = studentIds.map(studentId => ({
        user_id: user.id,
        class_id: classId,
        student_id: studentId,
        date,
        status,
        note: null,
        source: "manual"
      }));

      const { data, error } = await (supabase as any).rpc("bulk_upsert_attendance_records", {
        p_records: payload,
      });

      if (error) {
        if (error.message?.includes("Conflict 409") || error.details?.includes("Conflict 409") || error.hint?.includes("Conflict 409")) {
          console.warn("Optimistic locking conflict detected in bulk action:", error);
          window.dispatchEvent(new CustomEvent("attendance_stable_conflict"));
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
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

      if (usesLegacyAttendanceStorage) {
        const { data: existingData } = await (supabase as any)
          .from("attendance_holidays")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", date)
          .maybeSingle();

        const existing = existingData as { id: string } | null;
        if (existing) {
          const { error } = await (supabase as any).from("attendance_holidays").delete().eq("id", existing.id);
          if (error) throw error;
          return { action: "deleted" };
        }

        const { error } = await (supabase as any)
          .from("attendance_holidays")
          .insert({ user_id: user.id, date, description: description || "Hari Libur" });
        if (error) throw error;
        return { action: "added" };
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/holiday`, {
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
    onMutate: async ({ date, description, classId: targetClassId }) => {
      const resolvedClassId = targetClassId !== undefined ? targetClassId : classId;
      await queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });
      
      const previousDataset = queryClient.getQueryData<AttendanceDatasetCanonical>(attendanceDatasetQueryKey);
      
      if (previousDataset && dbAvailable) {
        queryClient.setQueryData<AttendanceDatasetCanonical>(
          attendanceDatasetQueryKey,
          (old) => {
            if (!old) return old;
            
            // Check if holiday exists
            const exists = old.holidays.some(h => h.date === date);
            
            return {
              ...old,
              holidays: exists 
                ? old.holidays.filter(h => h.date !== date)
                : [...old.holidays, { id: `temp-${Date.now()}`, date, description: description || "Hari Libur", isNational: false }]
            };
          }
        );
      }
      
      return { previousDataset };
    },
    onError: (err, newHoliday, context) => {
      if (context?.previousDataset) {
        queryClient.setQueryData(attendanceDatasetQueryKey, context.previousDataset);
      }
    },
    onSettled: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
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

      if (usesLegacyAttendanceStorage) {
        const { data: existingData } = await (supabase as any)
          .from("attendance_day_events")
          .select("id")
          .eq("user_id", user.id)
          .eq("date", event.date)
          .maybeSingle();

        if (existingData) {
          const { error } = await (supabase as any)
            .from("attendance_day_events")
            .update({
              label: event.label,
              description: event.description,
              color: event.color,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existingData.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("attendance_day_events")
            .insert({
              user_id: user.id,
              date: event.date,
              label: event.label,
              description: event.description,
              color: event.color || "blue",
            });
          if (error) throw error;
        }
        return;
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/day-event`, {
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
    onMutate: async (event) => {
      await queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });
      const previousDataset = queryClient.getQueryData<AttendanceDatasetCanonical>(attendanceDatasetQueryKey);
      
      if (previousDataset && dbAvailable) {
        queryClient.setQueryData<AttendanceDatasetCanonical>(
          attendanceDatasetQueryKey,
          (old: any) => {
            if (!old) return old;
            const exists = old.dayEvents?.findIndex((e: any) => e.date === event.date) ?? -1;
            const dayEvents = old.dayEvents ? [...old.dayEvents] : [];
            
            const newEvent = {
              id: exists >= 0 ? dayEvents[exists].id : `temp-${Date.now()}`,
              date: event.date,
              label: event.label,
              description: event.description || null,
              color: event.color || "blue"
            };

            if (exists >= 0) {
              dayEvents[exists] = newEvent;
            } else {
              dayEvents.push(newEvent);
            }
            
            return { ...old, dayEvents };
          }
        );
      }
      
      return { previousDataset };
    },
    onError: (err, newEvent, context) => {
      if (context?.previousDataset) {
        queryClient.setQueryData(attendanceDatasetQueryKey, context.previousDataset);
      }
    },
    onSettled: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
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

      if (usesLegacyAttendanceStorage) {
        const { error } = await (supabase as any)
          .from("attendance_day_events")
          .delete()
          .eq("user_id", user.id)
          .eq("date", date);
        if (error) throw error;
        return;
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/day-event`, {
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
    onMutate: async (date) => {
      await queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });
      const previousDataset = queryClient.getQueryData<AttendanceDatasetCanonical>(attendanceDatasetQueryKey);
      
      if (previousDataset && dbAvailable) {
        queryClient.setQueryData<AttendanceDatasetCanonical>(
          attendanceDatasetQueryKey,
          (old: any) => {
            if (!old) return old;
            return {
              ...old,
              dayEvents: old.dayEvents ? old.dayEvents.filter((e: any) => e.date !== date) : []
            };
          }
        );
      }
      return { previousDataset };
    },
    onError: (err, date, context) => {
      if (context?.previousDataset) {
        queryClient.setQueryData(attendanceDatasetQueryKey, context.previousDataset);
      }
    },
    onSettled: () => {
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
      }
    },
  });

  const duplicateAgendaMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("User not authenticated");
      if (!dbAvailable) throw new Error("Fitur ini membutuhkan koneksi database online");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;
      
      const prevMonth = addMonths(new Date(monthStart), -1);
      const prevMonthStart = format(startOfMonth(prevMonth), "yyyy-MM-dd");
      const prevMonthEnd = format(endOfMonth(prevMonth), "yyyy-MM-dd");

      const [holidaysRes, dayEventsRes] = await Promise.all([
        (supabase as any).from("attendance_holidays").select("*").or(`class_id.eq.${classId},class_id.is.null`).gte("date", prevMonthStart).lte("date", prevMonthEnd),
        (supabase as any).from("attendance_day_events").select("*").eq("class_id", classId).gte("date", prevMonthStart).lte("date", prevMonthEnd)
      ]);

      const holidaysToCopy = holidaysRes.data || [];
      const eventsToCopy = dayEventsRes.data || [];

      if (holidaysToCopy.length === 0 && eventsToCopy.length === 0) {
        throw new Error("Tidak ada agenda atau libur kustom di bulan sebelumnya");
      }

      await Promise.all([
        ...holidaysToCopy.filter((h: any) => h.class_id === classId).map((h: any) => {
          const newDate = addMonths(new Date(h.date), 1);
          return fetch(`${apiBaseUrl}/attendance/stable-api-disabled/holiday`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token || ""}` },
            body: JSON.stringify({ date: format(newDate, "yyyy-MM-dd"), description: h.description, classId: h.class_id })
          });
        }),
        ...eventsToCopy.map((e: any) => {
          const newDate = addMonths(new Date(e.date), 1);
          return fetch(`${apiBaseUrl}/attendance/stable-api-disabled/day-event`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token || ""}` },
            body: JSON.stringify({ date: format(newDate, "yyyy-MM-dd"), label: e.label, description: e.description, color: e.color, action: "upsert" })
          });
        })
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
    }
  });

  const bulkApplyAgendaMutation = useMutation({
    mutationFn: async (targetClassIds: string[]) => {
      if (!user) throw new Error("User not authenticated");
      if (!dbAvailable) throw new Error("Fitur ini membutuhkan koneksi database online");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const currentHolidays = holidays.filter(h => h.description !== "Libur Nasional");
      const currentEvents = dayEvents;

      if (currentHolidays.length === 0 && currentEvents.length === 0) {
        throw new Error("Tidak ada agenda atau libur kustom di kelas ini untuk diterapkan");
      }

      await Promise.all([
        ...targetClassIds.flatMap(targetId => 
          currentHolidays.map((h: any) => 
            fetch(`${apiBaseUrl}/attendance/stable-api-disabled/holiday`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token || ""}` },
              body: JSON.stringify({ date: h.date, description: h.description, classId: targetId })
            })
          )
        ),
        ...targetClassIds.flatMap(targetId =>
          currentEvents.map((e: any) =>
            fetch(`${apiBaseUrl}/attendance/stable-api-disabled/day-event`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token || ""}` },
              body: JSON.stringify({ date: e.date, label: e.label, description: e.description, color: e.color, action: "upsert", classId: targetId })
            })
          )
        )
      ]);
    }
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

      const monthStr = monthStart.substring(0, 7);

      if (usesLegacyAttendanceStorage) {
        const { data: existingData } = await (supabase as any)
          .from("attendance_locks")
          .select("id")
          .eq("class_id", classId)
          .eq("user_id", user.id)
          .eq("month", monthStart)
          .maybeSingle();

        if (existingData) {
          const { error } = await (supabase as any)
            .from("attendance_locks")
            .update({ is_locked: locked, locked_at: new Date().toISOString() })
            .eq("id", existingData.id);
          if (error) throw error;
        } else {
          const { error } = await (supabase as any)
            .from("attendance_locks")
            .insert({
              class_id: classId,
              user_id: user.id,
              month: monthStart,
              is_locked: locked,
              locked_by: user.id,
            });
          if (error) throw error;
        }
        return locked;
      }

      try {
        const { data: { session } } = await (supabase as any).auth.getSession();
        const token = session?.access_token;

        const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/lock`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token || ""}`,
          },
          body: JSON.stringify({
            classId,
            month: monthStr,
            isLocked: locked,
          }),
        });

        if (response.ok) {
          return locked;
        } else {
          console.warn(`Stable API lock save skipped with status ${response.status}, falling back to direct Supabase upsert.`);
        }
      } catch (apiError) {
        console.warn("Stable API lock save skipped, falling back to direct Supabase upsert:", apiError);
      }

      // Fallback Direct Supabase Upsert
      const { error } = await (supabase as any)
        .from("attendance_locks")
        .upsert(
          {
            class_id: classId,
            month: monthStr,
            user_id: user.id,
            is_locked: locked,
            locked_at: locked ? new Date().toISOString() : null,
            locked_by: locked ? user.id : null,
          },
          {
            onConflict: "class_id,month",
          }
        );

      if (error) {
        console.error("Direct Supabase Upsert lock failed:", error);
        throw error;
      }

      return locked;
    },
    onMutate: async (locked: boolean) => {
      // Cancel active query refetches
      await queryClient.cancelQueries({ queryKey: attendanceDatasetQueryKey });

      const previousDataset = queryClient.getQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey);

      // Optimistically update query cache
      queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, (current) => {
        if (!current) return current;
        return {
          ...current,
          locks: [
            {
              classId: classId || "",
              month: monthStart.substring(0, 7),
              isLocked: locked,
              lockedAt: locked ? new Date().toISOString() : null,
              lockedBy: user?.id || null,
            }
          ]
        };
      });

      return { previousDataset };
    },
    onError: (err, locked, context) => {
      // Rollback cache to previous state on failure
      if (context?.previousDataset) {
        queryClient.setQueryData<AttendanceDatasetCanonical | null>(attendanceDatasetQueryKey, context.previousDataset);
      }
    },
    onSuccess: (locked) => {
      setLocalLocked(locked);
      if (dbAvailable) {
        queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
      }
    },
  });

  // Promotion from any experimental store to the stable attendance store is disabled.
  // Data migration must use the reviewed, idempotent database migration path instead.
  const promoteMutation = useMutation({
    mutationFn: async () => {
      throw new Error("Promosi data Presensi dinonaktifkan. Gunakan migrasi data yang sudah tervalidasi.");
    },
  });

  // Recap Profile Query
  const recapProfileQuery = useQuery({
    queryKey: ["attendance_stable_recap_profile", classId],
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
        .from("attendance_core_recap_profiles")
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
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
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
          .from("attendance_core_recap_profiles")
          .update(payload)
          .eq("id", profile.id);
      } else {
        result = await (supabase as any)
          .from("attendance_core_recap_profiles")
          .insert([payload]);
      }

      if (result.error) throw result.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_stable_recap_profile", classId] });
      queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
    },
  });

  // Snapshots Query
  const snapshotsQuery = useQuery({
    queryKey: ["attendance_core_month_snapshots", classId, monthStart.substring(0, 7)],
    queryFn: async (): Promise<MonthSnapshot[]> => {
      if (!user || !classId || !dbAvailable) return [];
      const currentMonthStr = monthStart.substring(0, 7);
      const { data, error } = await (supabase as any)
        .from("attendance_core_month_snapshots")
        .select("*")
        .eq("class_id", classId)
        .eq("month", currentMonthStr)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any || []) as MonthSnapshot[];
    },
    enabled: !!user && !!classId && dbAvailable,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const snapshots = snapshotsQuery.data || [];

  // Create Snapshot Mutation
  const createSnapshotMutation = useMutation({
    mutationFn: async (reason: string | null) => {
      if (!user || !classId || !dbAvailable) throw new Error("Connection or parameter missing");

      // Auto-purge: Keep maximum 5 snapshots per month per class
      if (snapshots && snapshots.length >= 5) {
        // Since snapshots are ordered by created_at descending (newest first),
        // we slice the ones that exceed our limit. We want to delete anything from index 4 onwards
        // because we are about to add 1, meaning we only want to keep the newest 4 to leave room for the new 1.
        const snapshotsToDelete = snapshots.slice(4);
        const idsToDelete = snapshotsToDelete.map(s => s.id);
        
        if (idsToDelete.length > 0) {
          const { error: purgeError } = await (supabase as any)
            .from("attendance_core_month_snapshots")
            .delete()
            .in("id", idsToDelete);
            
          if (purgeError) {
            console.error("Failed to auto-purge snapshots:", purgeError);
          }
        }
      }

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/snapshots`, {
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
      queryClient.invalidateQueries({ queryKey: ["attendance_core_month_snapshots", classId, monthStart.substring(0, 7)] });
    },
  });

  // Restore Snapshot Mutation
  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotId: string) => {
      if (!user || !dbAvailable) throw new Error("Connection or parameter missing");

      const { data: { session } } = await (supabase as any).auth.getSession();
      const token = session?.access_token;

      const response = await fetch(`${apiBaseUrl}/attendance/stable-api-disabled/restore`, {
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
      queryClient.invalidateQueries({ queryKey: attendanceDatasetQueryKey });
    },
  });

  // Delegations Query
  const delegationsQuery = useQuery({
    queryKey: ["attendance_core_delegations", classId],
    queryFn: async (): Promise<Delegation[]> => {
      if (!user || !classId || !dbAvailable) return [];
      const { data, error } = await (supabase as any)
        .from("attendance_core_delegations")
        .select("*")
        .eq("class_id", classId)
        .is("revoked_at", null)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data as any || []) as Delegation[];
    },
    enabled: !!user && !!classId && dbAvailable,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  const delegations = delegationsQuery.data || [];

  // Create Delegation Mutation
  const createDelegationMutation = useMutation({
    mutationFn: async (payload: { granteeUserId: string; granteeLabel: string; startsAt: Date; endsAt: Date }) => {
      if (!user || !classId || !dbAvailable) return;
      
      const { error } = await (supabase as any)
        .from("attendance_core_delegations")
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
      queryClient.invalidateQueries({ queryKey: ["attendance_core_delegations", classId] });
    },
  });

  // Revoke Delegation Mutation
  const revokeDelegationMutation = useMutation({
    mutationFn: async (delegationId: string) => {
      if (!user || !dbAvailable) return;

      const { error } = await (supabase as any)
        .from("attendance_core_delegations")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", delegationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance_core_delegations", classId] });
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

  const getMonthStatsFast = useCallback(() => {
    return { ...monthStats };
  }, [monthStats]);

  const getDayStatsFast = useCallback((date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return { ...(dayStatsMap.get(dateStr) ?? createEmptyStats()) };
  }, [dayStatsMap]);

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
      usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd)
        : (supabase as any).from("attendance_records").select("*").eq("class_id", classId).gte("date", yearStart).lte("date", yearEnd),
      usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_holidays").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd)
        : (supabase as any).from("attendance_holidays").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd),
      usesLegacyAttendanceStorage
        ? (supabase as any).from("attendance_day_events").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd).then((r: any) => r).catch(() => ({ data: [] }))
        : (supabase as any).from("attendance_day_events").select("*").eq("user_id", user.id).gte("date", yearStart).lte("date", yearEnd).then((r: any) => r).catch(() => ({ data: [] })),
    ]);

    return {
      attendance: (attendanceResult.data || []) as AttendanceRecord[],
      holidays: (holidaysResult.data || []) as HolidayRecord[],
      dayEvents: (dayEventsResult.data || []) as DayEvent[],
    };
  }, [user, classId, dbAvailable, localAttendance, localHolidays, localDayEvents, usesLegacyAttendanceStorage]);

  return {
    attendanceRecords, holidays, dayEvents, isLocked, dbAvailable,
    getAttendance,
    getAttendanceNote,
    getDayEvent,
    isHoliday,
    getHolidayDescription,
    getMonthStats: getMonthStatsFast,
    getDayStats: getDayStatsFast,
    getYearlyData,
    isLoading: datasetQuery.isLoading,
    isLoadingLock: datasetQuery.isLoading,
    setAttendance: async (params: { studentId: string; date: string; status: AttendanceStatusValue | null; note?: string | null }) => {
      attendanceSaveQueue.enqueue({ ...params, classId });
    },
    pendingAttendanceSaves: attendanceSaveQueue.pendingSaveCount,
    failedAttendanceSaves: attendanceSaveQueue.failedSaveCount,
    flushAttendanceSaves: attendanceSaveQueue.flushNow,
    retryFailedAttendanceSaves: attendanceSaveQueue.retryFailed,
    getAttendanceSaveState: attendanceSaveQueue.getSaveState,
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
    duplicateAgenda: async () => {
      await duplicateAgendaMutation.mutateAsync();
    },
    bulkApplyAgenda: async (targetClassIds: string[]) => {
      await bulkApplyAgendaMutation.mutateAsync(targetClassIds);
    },
    toggleLock: async (locked: boolean) => {
      await toggleLockMutation.mutateAsync(locked);
    },
    promoteExperimentalToStable: async () => {
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
    isDuplicatingAgenda: duplicateAgendaMutation.isPending,
    isBulkApplyingAgenda: bulkApplyAgendaMutation.isPending,
    isCreatingSnapshot: createSnapshotMutation.isPending,
    isRestoringSnapshot: restoreSnapshotMutation.isPending,
    isCreatingDelegation: createDelegationMutation.isPending,
    isRevokingDelegation: revokeDelegationMutation.isPending,
    isSaving: bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending,
    isTogglingHoliday: toggleHolidayMutation.isPending,
    isTogglingLock: toggleLockMutation.isPending,
    isPromoting: promoteMutation.isPending,
    refetch: () => {
      datasetQuery.refetch();
    },
  };
}

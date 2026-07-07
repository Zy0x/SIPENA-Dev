import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type AttendanceQueuedSaveState = "idle" | "queued" | "saving" | "failed";

export type QueuedAttendancePatch = {
  studentId: string;
  date: string;
  status: "H" | "I" | "S" | "A" | "D" | null;
  note?: string | null;
  updated_at?: string;
};

export type AttendancePersistOutcome<TResult> = {
  successes: Map<string, TResult | null>;
  failures: Map<string, unknown>;
};

type QueueEntry<TPatch extends QueuedAttendancePatch> = {
  key: string;
  patch: TPatch;
  sequence: number;
  previousSnapshot: unknown;
};

type UseQueuedAttendanceSaveOptions<TPatch extends QueuedAttendancePatch, TResult> = {
  debounceMs?: number;
  buildKey?: (patch: TPatch) => string;
  getSnapshot: (patch: TPatch) => unknown;
  applyOptimistic: (patch: TPatch) => void;
  reconcileSuccess?: (patch: TPatch, result: TResult | null) => void;
  rollback: (patch: TPatch, previousSnapshot: unknown) => void;
  persist: (entries: Array<{ key: string; patch: TPatch; sequence: number; previousSnapshot: unknown }>) => Promise<AttendancePersistOutcome<TResult>>;
  onDrain?: () => void;
};

const DEFAULT_DEBOUNCE_MS = 300;

const defaultBuildKey = <TPatch extends QueuedAttendancePatch>(patch: TPatch) =>
  `${patch.studentId}:${patch.date}`;

export function createAttendancePersistOutcome<TResult>(): AttendancePersistOutcome<TResult> {
  return {
    successes: new Map<string, TResult | null>(),
    failures: new Map<string, unknown>(),
  };
}

export function useQueuedAttendanceSave<TPatch extends QueuedAttendancePatch, TResult = unknown>(
  options: UseQueuedAttendanceSaveOptions<TPatch, TResult>
) {
  const optionsRef = useRef(options);
  const sequenceRef = useRef(0);
  const queuedRef = useRef(new Map<string, QueueEntry<TPatch>>());
  const savingRef = useRef(new Map<string, QueueEntry<TPatch>>());
  const failedRef = useRef(new Map<string, QueueEntry<TPatch>>());
  const latestSequenceRef = useRef(new Map<string, number>());
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushPromiseRef = useRef<Promise<void> | null>(null);
  const mountedRef = useRef(true);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const bump = useCallback(() => {
    if (!mountedRef.current) return;
    setVersion((current) => current + 1);
  }, []);

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
  }, []);

  const flushReadyEntries = useCallback(async () => {
    if (flushPromiseRef.current) {
      await flushPromiseRef.current;
      return;
    }

    const readyEntries = Array.from(queuedRef.current.values()).filter(
      (entry) => !savingRef.current.has(entry.key)
    );
    if (readyEntries.length === 0) return;

    for (const entry of readyEntries) {
      queuedRef.current.delete(entry.key);
      savingRef.current.set(entry.key, entry);
    }
    bump();

    flushPromiseRef.current = (async () => {
      let outcome: AttendancePersistOutcome<TResult>;
      try {
        outcome = await optionsRef.current.persist(
          readyEntries.map((entry) => ({
            key: entry.key,
            patch: entry.patch,
            sequence: entry.sequence,
            previousSnapshot: entry.previousSnapshot,
          }))
        );
      } catch (error) {
        outcome = createAttendancePersistOutcome<TResult>();
        readyEntries.forEach((entry) => outcome.failures.set(entry.key, error));
      }

      for (const entry of readyEntries) {
        savingRef.current.delete(entry.key);
        const latestSequence = latestSequenceRef.current.get(entry.key);
        const isLatest = latestSequence === entry.sequence;

        if (outcome.successes.has(entry.key)) {
          if (isLatest) {
            failedRef.current.delete(entry.key);
            optionsRef.current.reconcileSuccess?.(entry.patch, outcome.successes.get(entry.key) ?? null);
          }
          continue;
        }

        const error = outcome.failures.get(entry.key);
        if (error && isLatest) {
          optionsRef.current.rollback(entry.patch, entry.previousSnapshot);
          failedRef.current.set(entry.key, entry);
        }
      }

      bump();
      if (queuedRef.current.size > 0) {
        setTimeout(() => {
          void flushReadyEntries();
        }, 0);
      } else if (savingRef.current.size === 0) {
        optionsRef.current.onDrain?.();
      }
    })().finally(() => {
      flushPromiseRef.current = null;
    });

    await flushPromiseRef.current;
  }, [bump]);

  const scheduleFlush = useCallback((delayMs?: number) => {
    clearFlushTimer();
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      void flushReadyEntries();
    }, delayMs ?? optionsRef.current.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }, [clearFlushTimer, flushReadyEntries]);

  const enqueue = useCallback((patch: TPatch) => {
    const buildKey = optionsRef.current.buildKey ?? defaultBuildKey<TPatch>;
    const key = buildKey(patch);
    const sequence = sequenceRef.current + 1;
    sequenceRef.current = sequence;
    latestSequenceRef.current.set(key, sequence);

    const previousEntry =
      queuedRef.current.get(key) ??
      savingRef.current.get(key) ??
      failedRef.current.get(key);
    const previousSnapshot = previousEntry?.previousSnapshot ?? optionsRef.current.getSnapshot(patch);

    optionsRef.current.applyOptimistic(patch);
    failedRef.current.delete(key);
    queuedRef.current.set(key, { key, patch, sequence, previousSnapshot });
    bump();
    scheduleFlush();
  }, [bump, scheduleFlush]);

  const flushNow = useCallback(async () => {
    clearFlushTimer();
    await flushReadyEntries();
  }, [clearFlushTimer, flushReadyEntries]);

  const retryFailed = useCallback(() => {
    const failedEntries = Array.from(failedRef.current.values());
    if (failedEntries.length === 0) return;

    for (const entry of failedEntries) {
      const sequence = sequenceRef.current + 1;
      sequenceRef.current = sequence;
      latestSequenceRef.current.set(entry.key, sequence);
      failedRef.current.delete(entry.key);
      queuedRef.current.set(entry.key, { ...entry, sequence });
    }
    bump();
    scheduleFlush(0);
  }, [bump, scheduleFlush]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        void flushNow();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearFlushTimer();
      void flushNow();
    };
  }, [clearFlushTimer, flushNow]);

  return useMemo(() => {
    const pendingSaveCount = queuedRef.current.size + savingRef.current.size;
    const failedSaveCount = failedRef.current.size;

    const hasCellState = <TValue,>(entries: Map<string, TValue>, studentId: string, date: string) => {
      const key = `${studentId}:${date}`;
      if (entries.has(key)) return true;

      const suffix = `:${key}`;
      for (const entryKey of entries.keys()) {
        if (entryKey.endsWith(suffix)) return true;
      }
      return false;
    };

    const getSaveState = (studentId: string, date: string): AttendanceQueuedSaveState => {
      if (hasCellState(queuedRef.current, studentId, date)) return "queued";
      if (hasCellState(savingRef.current, studentId, date)) return "saving";
      if (hasCellState(failedRef.current, studentId, date)) return "failed";
      return "idle";
    };

    return {
      enqueue,
      flushNow,
      retryFailed,
      getSaveState,
      pendingSaveCount,
      failedSaveCount,
    };
  }, [enqueue, flushNow, retryFailed, version]);
}

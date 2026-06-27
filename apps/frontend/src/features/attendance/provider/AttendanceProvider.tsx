import React, { createContext, useContext, useMemo } from "react";
import {
  mapCanonicalDatasetToExport,
  mapCanonicalDatasetToUI,
  validateCanonicalDataset,
} from "../canonical";
import { useAttendanceRuntime } from "../runtime/useAttendanceRuntime";
import type {
  AttendanceCanonicalContextValue,
  AttendanceCanonicalSnapshot,
  AttendanceProviderProps,
} from "./attendanceProvider.types";

const AttendanceCanonicalContext = createContext<AttendanceCanonicalContextValue | null>(null);

function isDebugOverrideEnabled(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.get("attendanceDebug") === "1" ||
      window.localStorage.getItem("attendance_debug_panel") === "1"
    );
  } catch {
    return false;
  }
}

export function createAttendanceCanonicalSnapshot(
  dataset: AttendanceProviderProps["initialDataset"],
  source: AttendanceProviderProps["source"] = "none"
): AttendanceCanonicalSnapshot {
  if (!dataset) {
    return {
      dataset: null,
      uiModel: null,
      exportDataset: null,
      issues: [],
      source: "none",
      status: "idle",
    };
  }

  const issues = validateCanonicalDataset(dataset);

  return {
    dataset,
    uiModel: mapCanonicalDatasetToUI(dataset),
    exportDataset: mapCanonicalDatasetToExport(dataset, dataset.classId, dataset.month),
    issues,
    source,
    status: issues.some((issue) => issue.severity === "error" || issue.severity === "blocker") ? "error" : "ready",
  };
}

export const AttendanceProvider: React.FC<AttendanceProviderProps> = ({
  children,
  initialDataset = null,
  source = "none",
  debugEnabled,
}) => {
  const runtime = useAttendanceRuntime();
  const snapshot = useMemo(
    () => createAttendanceCanonicalSnapshot(initialDataset, source),
    [initialDataset, source]
  );
  const isDebugEnabled = debugEnabled ?? isDebugOverrideEnabled();

  const value = useMemo<AttendanceCanonicalContextValue>(
    () => ({
      ...snapshot,
      runtime,
      isCanonicalReady: snapshot.status === "ready",
      isDebugEnabled,
    }),
    [isDebugEnabled, runtime, snapshot]
  );

  return (
    <AttendanceCanonicalContext.Provider value={value}>
      {children}
    </AttendanceCanonicalContext.Provider>
  );
};

export function useAttendanceCanonicalContext(): AttendanceCanonicalContextValue {
  const context = useContext(AttendanceCanonicalContext);
  if (!context) {
    throw new Error("useAttendanceCanonical must be used inside AttendanceProvider.");
  }
  return context;
}

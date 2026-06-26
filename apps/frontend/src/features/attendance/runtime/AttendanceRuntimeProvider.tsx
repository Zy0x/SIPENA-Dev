import React, { createContext, useContext, useMemo } from "react";
import { AttendanceRuntimeContextValue } from "./attendanceRuntime.types";
import { getRuntimeConfig } from "./attendanceRuntime.config";
import { guardRuntimeConfig } from "./attendanceRuntimeGuard";

const AttendanceRuntimeContext = createContext<AttendanceRuntimeContextValue | null>(null);

export function createAttendanceRuntimeContextValue(): AttendanceRuntimeContextValue {
  const config = getRuntimeConfig();
  const guardResult = guardRuntimeConfig(config);

  return {
    engine: guardResult.forcedEngine,
    mode: guardResult.forcedMode,
    source: config.source,
    guardResult,
    config,
  };
}

export const AttendanceRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo<AttendanceRuntimeContextValue>(() => createAttendanceRuntimeContextValue(), []);

  return (
    <AttendanceRuntimeContext.Provider value={value}>
      {children}
    </AttendanceRuntimeContext.Provider>
  );
};

export function useAttendanceRuntimeContext(): AttendanceRuntimeContextValue {
  const context = useContext(AttendanceRuntimeContext);
  return context ?? createAttendanceRuntimeContextValue();
}

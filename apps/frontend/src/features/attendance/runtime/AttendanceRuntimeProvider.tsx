import React, { createContext, useContext, useMemo } from "react";
import { AttendanceRuntimeContextValue } from "./attendanceRuntime.types";
import { getRuntimeConfig, resolveRuntimeConfig } from "./attendanceRuntime.config";
import { guardRuntimeConfig } from "./attendanceRuntimeGuard";
import type { AttendanceRuntimeConfigInput } from "./attendanceRuntime.types";

const AttendanceRuntimeContext = createContext<AttendanceRuntimeContextValue | null>(null);

export function createAttendanceRuntimeContextValue(input?: AttendanceRuntimeConfigInput): AttendanceRuntimeContextValue {
  const config = input ? resolveRuntimeConfig(input) : getRuntimeConfig();
  const guardResult = guardRuntimeConfig(config);

  return {
    engine: guardResult.forcedEngine,
    mode: guardResult.forcedMode,
    source: config.source,
    guardResult,
    config,
  };
}

export const AttendanceRuntimeProvider: React.FC<{
  children: React.ReactNode;
  configInput?: AttendanceRuntimeConfigInput;
}> = ({ children, configInput }) => {
  const value = useMemo<AttendanceRuntimeContextValue>(
    () => createAttendanceRuntimeContextValue(configInput),
    [configInput?.envEngine, configInput?.localStorageEngine, configInput?.mode, configInput?.remoteEngine],
  );

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

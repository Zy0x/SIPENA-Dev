import React, { createContext, useContext, useMemo } from "react";
import { AttendanceRuntimeContextValue } from "./attendanceRuntime.types";
import { getRuntimeConfig } from "./attendanceRuntime.config";
import { guardRuntimeConfig } from "./attendanceRuntimeGuard";

const AttendanceRuntimeContext = createContext<AttendanceRuntimeContextValue | null>(null);

export const AttendanceRuntimeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useMemo<AttendanceRuntimeContextValue>(() => {
    const config = getRuntimeConfig();
    const guardResult = guardRuntimeConfig(config);
    
    // Resolve final active engine based on guard result
    const activeEngine = guardResult.forcedEngine;
    
    return {
      engine: activeEngine,
      mode: activeEngine === "v1" ? "active" : config.mode,
      source: config.source,
      guardResult,
      config,
    };
  }, []);

  return (
    <AttendanceRuntimeContext.Provider value={value}>
      {children}
    </AttendanceRuntimeContext.Provider>
  );
};

export function useAttendanceRuntimeContext(): AttendanceRuntimeContextValue {
  const context = useContext(AttendanceRuntimeContext);
  if (!context) {
    // Graceful fallback to default config if used outside the provider
    const config = getRuntimeConfig();
    const guardResult = guardRuntimeConfig(config);
    const activeEngine = guardResult.forcedEngine;
    
    return {
      engine: activeEngine,
      mode: activeEngine === "v1" ? "active" : config.mode,
      source: config.source,
      guardResult,
      config,
    };
  }
  return context;
}

import React from "react";
import { AttendanceDebugPanel } from "./AttendanceDebugPanel";

export const AttendanceRuntimeBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      {children}
      <AttendanceDebugPanel />
    </>
  );
};

export default AttendanceRuntimeBoundary;

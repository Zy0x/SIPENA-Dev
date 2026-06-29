import React from "react";
import { AttendanceV2LegacyMirror } from "../v2/AttendanceV2LegacyMirror";
import { AttendanceV2Wrapper } from "../v2/AttendanceV2Wrapper";
import { useAttendanceRuntime } from "../runtime/useAttendanceRuntime";

export const AttendanceV2: React.FC = () => {
  const runtime = useAttendanceRuntime();

  if (runtime.engine === "v2" && runtime.mode === "active") {
    return <AttendanceV2Wrapper />;
  }

  return <AttendanceV2LegacyMirror />;
};

export default AttendanceV2;

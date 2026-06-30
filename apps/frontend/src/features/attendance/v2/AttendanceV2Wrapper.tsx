import React from "react";
import { AttendanceV2ControlCenter } from "./AttendanceV2ControlCenter";

/**
 * AttendanceV2Wrapper
 * Owns the V2-only workspace. V1 remains available through AttendanceV2LegacyMirror
 * and is not imported or modified here.
 */
export const AttendanceV2Wrapper: React.FC = () => {
  return <AttendanceV2ControlCenter />;
};

export default AttendanceV2Wrapper;

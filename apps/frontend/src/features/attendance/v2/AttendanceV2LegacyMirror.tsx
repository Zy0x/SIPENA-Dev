import React from "react";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";

/**
 * Presensi V2 currently mirrors V1 exactly.
 * Engine V2 work must happen behind this boundary without changing V1 files.
 */
export const AttendanceV2LegacyMirror: React.FC = () => {
  return <AttendanceV1Wrapper />;
};

export default AttendanceV2LegacyMirror;

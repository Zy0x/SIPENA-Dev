import React from "react";
import AttendanceStablePage from "@/pages/AttendanceStable";

/**
 * Stable Attendance UI boundary.
 *
 * This renders the standalone stable attendance copy. It must not import the
 * experimental page or component tree, so `/attendance` remains safe even if
 * the experimental route is removed later.
 */
export const AttendanceStable: React.FC = () => {
  return <AttendanceStablePage />;
};

export default AttendanceStable;

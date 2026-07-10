import React from "react";
import AttendanceV2Page from "@/pages/AttendanceV2";

/**
 * Stable Attendance UI boundary.
 *
 * This intentionally starts from the matured Attendance V2 implementation while
 * keeping `/attendance-v2` available for future experimental work. The app route
 * only enters this component when the stable cutover config is enabled.
 */
export const AttendanceStable: React.FC = () => {
  return <AttendanceV2Page />;
};

export default AttendanceStable;

import AttendanceV1Wrapper from "@/features/attendance/v1/AttendanceV1Wrapper";
import AttendanceStable from "./AttendanceStable";

const isStableCutoverEnabled = () => {
  return import.meta.env.VITE_ATTENDANCE_STABLE_CUTOVER === "true";
};

export function AttendanceStableRoute() {
  if (!isStableCutoverEnabled()) {
    return <AttendanceV1Wrapper />;
  }

  return <AttendanceStable />;
}

export default AttendanceStableRoute;

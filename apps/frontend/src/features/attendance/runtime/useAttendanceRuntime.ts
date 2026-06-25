import { useAttendanceRuntimeContext } from "./AttendanceRuntimeProvider";

export function useAttendanceRuntime() {
  return useAttendanceRuntimeContext();
}

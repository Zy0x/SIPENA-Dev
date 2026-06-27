import { AttendanceRuntimeProvider } from "./AttendanceRuntimeProvider";
import { useAttendanceRuntime } from "./useAttendanceRuntime";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";
import { AttendanceProvider } from "../provider/AttendanceProvider";
import { AttendanceRuntimeBoundary } from "../ui/AttendanceRuntimeBoundary";

function ResolvedAttendanceRuntime() {
  const runtime = useAttendanceRuntime();

  if (runtime.engine !== "v1" && import.meta.env.DEV) {
    console.warn(
      "[Attendance Runtime Switch] Non-V1 runtime reached Phase 01 route. Rendering V1 fallback."
    );
  }

  return <AttendanceV1Wrapper />;
}

export function AttendanceRuntimeRoute() {
  return (
    <AttendanceRuntimeProvider>
      <AttendanceProvider>
        <AttendanceRuntimeBoundary>
          <ResolvedAttendanceRuntime />
        </AttendanceRuntimeBoundary>
      </AttendanceProvider>
    </AttendanceRuntimeProvider>
  );
}

export default AttendanceRuntimeRoute;

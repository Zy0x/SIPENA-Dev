import { AttendanceRuntimeProvider } from "./AttendanceRuntimeProvider";
import { useAttendanceRuntime } from "./useAttendanceRuntime";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";
import { AttendanceProvider } from "../provider/AttendanceProvider";
import { AttendanceRuntimeBoundary } from "../ui/AttendanceRuntimeBoundary";

import { AttendanceV2Visualizer } from "../ui/AttendanceV2Visualizer";

function ResolvedAttendanceRuntime() {
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

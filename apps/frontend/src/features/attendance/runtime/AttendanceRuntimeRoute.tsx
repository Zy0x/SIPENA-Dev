import { AttendanceRuntimeProvider } from "./AttendanceRuntimeProvider";
import { useAttendanceRuntime } from "./useAttendanceRuntime";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";
import { AttendanceProvider } from "../provider/AttendanceProvider";
import { AttendanceRuntimeBoundary } from "../ui/AttendanceRuntimeBoundary";
import AttendanceV2 from "../ui/AttendanceV2";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";

function ResolvedAttendanceRuntime() {
  const runtime = useAttendanceRuntime();
  if (runtime.engine === "v2") {
    return <AttendanceV2 />;
  }
  return <AttendanceV1Wrapper />;
}

export function AttendanceRuntimeRoute() {
  const { resolveRuntime } = useFeatureFlags();
  const remoteEngine = resolveRuntime(FEATURE_KEYS.attendanceV2Runtime);

  return (
    <AttendanceRuntimeProvider configInput={{ remoteEngine, mode: "active" }}>
      <AttendanceProvider>
        <AttendanceRuntimeBoundary>
          <ResolvedAttendanceRuntime />
        </AttendanceRuntimeBoundary>
      </AttendanceProvider>
    </AttendanceRuntimeProvider>
  );
}

export default AttendanceRuntimeRoute;

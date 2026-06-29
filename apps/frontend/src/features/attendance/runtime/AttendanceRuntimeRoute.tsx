import { AttendanceRuntimeProvider } from "./AttendanceRuntimeProvider";
import { useAttendanceRuntime } from "./useAttendanceRuntime";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";
import { AttendanceProvider } from "../provider/AttendanceProvider";
import { AttendanceRuntimeBoundary } from "../ui/AttendanceRuntimeBoundary";
import AttendanceV2 from "../ui/AttendanceV2";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";
import { Loader2 } from "lucide-react";

function ResolvedAttendanceRuntime() {
  const runtime = useAttendanceRuntime();
  if (runtime.engine === "v2") {
    return <AttendanceV2 />;
  }
  return <AttendanceV1Wrapper />;
}

export function AttendanceRuntimeRoute() {
  const { getAccessStatus, resolveRuntime } = useFeatureFlags();
  const runtimeAccessStatus = getAccessStatus(FEATURE_KEYS.attendanceV2Runtime);

  if (runtimeAccessStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-8 text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memeriksa runtime presensi...
        </div>
      </div>
    );
  }

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

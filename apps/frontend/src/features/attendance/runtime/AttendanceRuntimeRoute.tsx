import { AttendanceRuntimeProvider } from "./AttendanceRuntimeProvider";
import { useAttendanceRuntime } from "./useAttendanceRuntime";
import AttendanceV1Wrapper from "../v1/AttendanceV1Wrapper";
import { AttendanceProvider } from "../provider/AttendanceProvider";
import { AttendanceRuntimeBoundary } from "../ui/AttendanceRuntimeBoundary";
import AttendanceV2 from "../ui/AttendanceV2";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { FEATURE_KEYS } from "@/app/providers/featureAccess";
import { Loader2 } from "lucide-react";

interface AttendanceRuntimeRouteProps {
  forcedEngine?: "v1" | "v2";
}

function ResolvedAttendanceRuntime({ forcedEngine }: { forcedEngine?: "v1" | "v2" }) {
  const runtime = useAttendanceRuntime();
  const activeEngine = forcedEngine || runtime.engine;
  if (activeEngine === "v2") {
    return <AttendanceV2 />;
  }
  return <AttendanceV1Wrapper />;
}

export function AttendanceRuntimeRoute({ forcedEngine }: AttendanceRuntimeRouteProps) {
  const { getAccessStatus, resolveRuntime } = useFeatureFlags();
  const runtimeAccessStatus = getAccessStatus(FEATURE_KEYS.attendanceV2Runtime);

  if (!forcedEngine && runtimeAccessStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-8 text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memeriksa runtime presensi...
        </div>
      </div>
    );
  }

  const remoteEngine = forcedEngine || resolveRuntime(FEATURE_KEYS.attendanceV2Runtime);

  return (
    <AttendanceRuntimeProvider configInput={{ remoteEngine, mode: "active" }}>
      <AttendanceProvider>
        <AttendanceRuntimeBoundary>
          <ResolvedAttendanceRuntime forcedEngine={forcedEngine} />
        </AttendanceRuntimeBoundary>
      </AttendanceProvider>
    </AttendanceRuntimeProvider>
  );
}

export default AttendanceRuntimeRoute;

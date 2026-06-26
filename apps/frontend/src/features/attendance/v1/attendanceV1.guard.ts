import type { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";
import type { V1SafetyGuardResult } from "./attendanceV1.types";

/**
 * checkV1SafetyGuard
 * Verifies that it is safe to run the V1 execution engine.
 */
export function checkV1SafetyGuard(runtime: AttendanceRuntimeContextValue): V1SafetyGuardResult {
  if (runtime.engine !== "v1") {
    return {
      isSafe: false,
      reason: "non-v1-runtime",
      message: "V1 wrapper guard expected V1 runtime; runtime route must fallback before rendering.",
    };
  }

  return {
    isSafe: true,
    reason: "v1-active",
    message: "V1 wrapper may render the locked Attendance page unchanged.",
  };
}

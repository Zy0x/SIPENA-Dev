import type { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";
import type { V2SafetyGuardResult } from "./attendanceV2.types";

/**
 * checkV2SafetyGuard
 * Verifies that it is safe to run the V2 execution engine.
 */
export function checkV2SafetyGuard(runtime: AttendanceRuntimeContextValue): V2SafetyGuardResult {
  if (runtime.engine !== "v2") {
    return {
      isSafe: false,
      reason: "non-v2-runtime",
      message: "V2 wrapper guard expected V2 runtime; runtime route must fallback before rendering.",
    };
  }

  return {
    isSafe: true,
    reason: "v2-active",
    message: "V2 wrapper may render the Attendance V2 page.",
  };
}

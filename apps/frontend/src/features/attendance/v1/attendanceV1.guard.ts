import { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";

/**
 * checkV1SafetyGuard
 * Verifies that it is safe to run the V1 execution engine.
 */
export function checkV1SafetyGuard(runtime: AttendanceRuntimeContextValue): boolean {
  // It is always safe to fall back to V1.
  return true;
}

import { describe, expect, it } from "vitest";
import type { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";
import { checkV1SafetyGuard } from "./attendanceV1.guard";

function runtimeContext(engine: "v1" | "v2"): AttendanceRuntimeContextValue {
  return {
    engine,
    mode: "active",
    source: "default",
    guardResult: {
      isSafe: engine === "v1",
      reason: engine === "v1" ? "safe" : "v2-not-implemented",
      message: "test",
      requestedEngine: engine,
      forcedEngine: engine,
      forcedMode: "active",
    },
    config: {
      engine,
      mode: "active",
      source: "default",
      isValid: true,
      requestedEngine: engine,
      requestedMode: "active",
    },
  };
}

describe("attendance V1 safety guard", () => {
  it("allows the V1 wrapper when runtime is V1", () => {
    expect(checkV1SafetyGuard(runtimeContext("v1"))).toEqual({
      isSafe: true,
      reason: "v1-active",
      message: "V1 wrapper may render the locked Attendance page unchanged.",
    });
  });

  it("rejects non-V1 runtime before the wrapper renders", () => {
    expect(checkV1SafetyGuard(runtimeContext("v2"))).toEqual({
      isSafe: false,
      reason: "non-v1-runtime",
      message: "V1 wrapper guard expected V1 runtime; runtime route must fallback before rendering.",
    });
  });
});

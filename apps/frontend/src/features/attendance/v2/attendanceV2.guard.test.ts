import { describe, expect, it } from "vitest";
import type { AttendanceRuntimeContextValue } from "../runtime/attendanceRuntime.types";
import { checkV2SafetyGuard } from "./attendanceV2.guard";

function runtimeContext(engine: "v1" | "v2"): AttendanceRuntimeContextValue {
  return {
    engine,
    mode: "active",
    source: "default",
    guardResult: {
      isSafe: engine === "v2",
      reason: engine === "v2" ? "safe" : "fallback",
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

describe("attendance V2 safety guard", () => {
  it("allows the V2 wrapper when runtime is V2", () => {
    expect(checkV2SafetyGuard(runtimeContext("v2"))).toEqual({
      isSafe: true,
      reason: "v2-active",
      message: "V2 wrapper may render the Attendance V2 page.",
    });
  });

  it("rejects non-V2 runtime before the wrapper renders", () => {
    expect(checkV2SafetyGuard(runtimeContext("v1"))).toEqual({
      isSafe: false,
      reason: "non-v2-runtime",
      message: "V2 wrapper guard expected V2 runtime; runtime route must fallback before rendering.",
    });
  });
});

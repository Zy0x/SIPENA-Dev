import { describe, expect, it } from "vitest";
import { checkAttendanceFrontendImport, isAttendanceEngineInternalPath } from "./frontendImportGuard";

describe("attendance frontend import guard", () => {
  it("allows attendance runtime/provider boundary files to import internal wrappers", () => {
    const result = checkAttendanceFrontendImport(
      "apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx",
      "../v1/AttendanceV1Wrapper"
    );

    expect(result.allowed).toBe(true);
    expect(result.reason).toBe("engine-internal");
  });

  it("blocks general UI files from directly importing V1 page or hook", () => {
    const pageImport = checkAttendanceFrontendImport(
      "apps/frontend/src/features/attendance/ui/FutureToolbar.tsx",
      "@/pages/Attendance"
    );
    const hookImport = checkAttendanceFrontendImport(
      "apps/frontend/src/components/attendance/FutureWidget.tsx",
      "@/hooks/useAttendance"
    );

    expect(pageImport.allowed).toBe(false);
    expect(pageImport.reason).toBe("forbidden-direct-import");
    expect(hookImport.allowed).toBe(false);
  });

  it("normalizes Windows paths while checking internal engine folders", () => {
    expect(isAttendanceEngineInternalPath("apps\\frontend\\src\\features\\attendance\\provider\\AttendanceProvider.tsx")).toBe(true);
  });
});

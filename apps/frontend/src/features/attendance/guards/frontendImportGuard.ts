export const ATTENDANCE_PROVIDER_ALLOWED_ENGINE_IMPORTERS = [
  "apps/frontend/src/features/attendance/runtime/",
  "apps/frontend/src/features/attendance/provider/",
  "apps/frontend/src/features/attendance/v1/",
  "apps/frontend/src/features/attendance/v2/",
] as const;

export const ATTENDANCE_FRONTEND_FORBIDDEN_IMPORTS = [
  "@/pages/Attendance",
  "@/hooks/useAttendance",
  "../v1/",
  "../v2/",
  "@features/attendance/v1/",
  "@features/attendance/v2/",
] as const;

export interface AttendanceFrontendImportGuardResult {
  allowed: boolean;
  reason: "allowed-wrapper" | "engine-internal" | "forbidden-direct-import";
  message: string;
}

export function isAttendanceEngineInternalPath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return ATTENDANCE_PROVIDER_ALLOWED_ENGINE_IMPORTERS.some((prefix) => normalized.includes(prefix));
}

export function checkAttendanceFrontendImport(
  importerPath: string,
  importPath: string
): AttendanceFrontendImportGuardResult {
  if (isAttendanceEngineInternalPath(importerPath)) {
    return {
      allowed: true,
      reason: "engine-internal",
      message: "Attendance runtime/provider/engine boundary may use internal attendance imports.",
    };
  }

  const isForbidden = ATTENDANCE_FRONTEND_FORBIDDEN_IMPORTS.some((pattern) => importPath.includes(pattern));
  if (isForbidden) {
    return {
      allowed: false,
      reason: "forbidden-direct-import",
      message: "UI must use attendance provider/canonical hooks instead of direct V1/V2 imports.",
    };
  }

  return {
    allowed: true,
    reason: "allowed-wrapper",
    message: "Import does not bypass the attendance runtime/provider boundary.",
  };
}

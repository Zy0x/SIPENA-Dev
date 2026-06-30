import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../../..");

const readSource = (relativePath: string) => {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return readFileSync(direct, "utf8");
  const fromRepoRoot = resolve(repoRoot, relativePath);
  if (existsSync(fromRepoRoot)) return readFileSync(fromRepoRoot, "utf8");
  return readFileSync(resolve(process.cwd(), "../..", relativePath), "utf8");
};

describe("attendance input performance guard", () => {
  it("keeps V1 attendance lookup map-based and save optimistic", () => {
    const hook = readSource("apps/frontend/src/hooks/useAttendance.ts");

    expect(hook).toContain("attendanceRecordMap");
    expect(hook).toContain("buildAttendanceLookupKey(studentId, dateStr)");
    expect(hook).not.toContain("attendanceRecords.find");
    expect(hook).toContain("queryClient.setQueryData<AttendanceRecord[]>");
    expect(hook).toContain("scheduleAttendanceRefresh()");
    expect(hook).toContain("isSaving: bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending");
    expect(hook).not.toContain("isSaving: setAttendanceMutation.isPending");
  });

  it("keeps V2 attendance lookup map-based and dataset save optimistic", () => {
    const hook = readSource("apps/frontend/src/hooks/useAttendanceV2.ts");

    expect(hook).toContain("attendanceRecordMap");
    expect(hook).toContain("buildAttendanceLookupKey(studentId, dateStr)");
    expect(hook).not.toContain("attendanceRecords.find");
    expect(hook).toContain("applyAttendanceDatasetPatch");
    expect(hook).toContain("queryClient.setQueryData<AttendanceDatasetCanonical | null>");
    expect(hook).toContain("scheduleAttendanceRefresh()");
    expect(hook).toContain("isSaving: bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending");
    expect(hook).not.toContain("isSaving: setAttendanceMutation.isPending");
  });
});

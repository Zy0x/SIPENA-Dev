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
    expect(hook).toContain("useQueuedAttendanceSave<QueuedAttendanceMutationParams");
    expect(hook).toContain("attendanceSaveQueue.enqueue({ ...params, classId })");
    expect(hook).toContain("pendingAttendanceSaves: attendanceSaveQueue.pendingSaveCount");
    expect(hook).toContain("failedAttendanceSaves: attendanceSaveQueue.failedSaveCount");
    expect(hook).toContain("retryFailedAttendanceSaves: attendanceSaveQueue.retryFailed");
    expect(hook).toContain("queryClient.setQueryData<AttendanceRecord[]>");
    expect(hook).toContain("onDrain: scheduleAttendanceRefresh");
    expect(hook).toContain("isSaving: bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending");
    expect(hook).not.toContain("isSaving: setAttendanceMutation.isPending");
    expect(hook).not.toContain("await setAttendanceMutation.mutateAsync(params)");
  });

  it("keeps V2 attendance lookup map-based and dataset save optimistic", () => {
    const hook = readSource("apps/frontend/src/hooks/useAttendanceV2.ts");

    expect(hook).toContain("attendanceRecordMap");
    expect(hook).toContain("buildAttendanceLookupKey(studentId, dateStr)");
    expect(hook).not.toContain("attendanceRecords.find");
    expect(hook).toContain("useQueuedAttendanceSave<QueuedAttendanceMutationParams");
    expect(hook).toContain("attendanceSaveQueue.enqueue({ ...params, classId })");
    expect(hook).toContain("pendingAttendanceSaves: attendanceSaveQueue.pendingSaveCount");
    expect(hook).toContain("failedAttendanceSaves: attendanceSaveQueue.failedSaveCount");
    expect(hook).toContain("retryFailedAttendanceSaves: attendanceSaveQueue.retryFailed");
    expect(hook).toContain("applyAttendanceDatasetPatch");
    expect(hook).toContain("queryClient.setQueryData<AttendanceDatasetCanonical | null>");
    expect(hook).toContain("onDrain: scheduleAttendanceRefresh");
    expect(hook).toContain("isSaving: bulkSetAttendanceMutation.isPending || updateNoteMutation.isPending");
    expect(hook).not.toContain("isSaving: setAttendanceMutation.isPending");
    expect(hook).not.toContain("await setAttendanceMutation.mutateAsync(params)");
    expect(hook).toContain("attendance/v2/bulk");
  });

  it("keeps queued save helper coalesced and stale-response safe", () => {
    const helper = readSource("apps/frontend/src/features/attendance/performance/useQueuedAttendanceSave.ts");

    expect(helper).toContain("queuedRef.current.set(key");
    expect(helper).toContain("latestSequenceRef.current.set(key, sequence)");
    expect(helper).toContain("const isLatest = latestSequence === entry.sequence");
    expect(helper).toContain("optionsRef.current.rollback(entry.patch, entry.previousSnapshot)");
    expect(helper).toContain("failedRef.current.set(entry.key, entry)");
    expect(helper).toContain("debounceMs ?? DEFAULT_DEBOUNCE_MS");
    expect(helper).toContain("entryKey.endsWith(suffix)");
  });

  it("surfaces non-blocking save status in V1 and V2 attendance pages", () => {
    const v1Page = readSource("apps/frontend/src/pages/Attendance.tsx");
    const v2Page = readSource("apps/frontend/src/pages/AttendanceV2.tsx");

    for (const page of [v1Page, v2Page]) {
      expect(page).toContain("pendingAttendanceSaves");
      expect(page).toContain("failedAttendanceSaves");
      expect(page).toContain("retryFailedAttendanceSaves");
      expect(page).toContain("Menyimpan {pendingAttendanceSaves} perubahan");
      expect(page).toContain("gagal, coba lagi");
    }
  });
});

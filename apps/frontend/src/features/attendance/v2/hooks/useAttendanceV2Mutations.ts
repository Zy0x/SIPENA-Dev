import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { attendanceV2Api } from "../api/attendanceV2Api";
import type { AttendanceRecordPatch } from "../../canonical/canonical.types";
import type {
  AttendanceLockPatch,
  AttendanceHolidayPatch,
  AttendanceDayEventPatch,
  AttendanceNotePatchBody,
} from "../attendanceV2.types";

export function useAttendanceV2Mutations(classId: string, monthStr: string) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const queryClient = useQueryClient();
  const { toast: showToast } = useEnhancedToast();

  const invalidateDataset = () => {
    queryClient.invalidateQueries({ queryKey: ["attendance_v2_dataset", classId, monthStr] });
  };

  const applyPatchMutation = useMutation({
    mutationFn: async (patch: AttendanceRecordPatch) => {
      const res = await attendanceV2Api.applyPatch(patch, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Menyimpan", description: err.message, variant: "error" });
    },
  });

  const applyBulkPatchMutation = useMutation({
    mutationFn: async (patches: AttendanceRecordPatch[]) => {
      const res = await attendanceV2Api.applyBulkPatch(patches, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Menyimpan Massal", description: err.message, variant: "error" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async (notePatch: AttendanceNotePatchBody) => {
      const res = await attendanceV2Api.updateNote(notePatch, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Menyimpan Catatan", description: err.message, variant: "error" });
    },
  });

  const toggleHolidayMutation = useMutation({
    mutationFn: async (holidayPatch: AttendanceHolidayPatch) => {
      const res = await attendanceV2Api.toggleHoliday(holidayPatch, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Mengubah Libur", description: err.message, variant: "error" });
    },
  });

  const upsertDayEventMutation = useMutation({
    mutationFn: async (dayEventPatch: AttendanceDayEventPatch) => {
      const res = await attendanceV2Api.upsertDayEvent(dayEventPatch, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Mengubah Event", description: err.message, variant: "error" });
    },
  });

  const deleteDayEventMutation = useMutation({
    mutationFn: async (date: string) => {
      const res = await attendanceV2Api.deleteDayEvent(date, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Menghapus Event", description: err.message, variant: "error" });
    },
  });

  const toggleLockMutation = useMutation({
    mutationFn: async (lockPatch: AttendanceLockPatch) => {
      const res = await attendanceV2Api.toggleLock(lockPatch, token);
      if ((res as any).error) throw new Error((res as any).error.message);
      return res.data;
    },
    onSuccess: () => {
      invalidateDataset();
    },
    onError: (err: any) => {
      showToast({ title: "Gagal Mengubah Status Kunci", description: err.message, variant: "error" });
    },
  });

  return {
    applyPatch: applyPatchMutation.mutateAsync,
    applyBulkPatch: applyBulkPatchMutation.mutateAsync,
    updateNote: updateNoteMutation.mutateAsync,
    toggleHoliday: toggleHolidayMutation.mutateAsync,
    upsertDayEvent: upsertDayEventMutation.mutateAsync,
    deleteDayEvent: deleteDayEventMutation.mutateAsync,
    toggleLock: toggleLockMutation.mutateAsync,
    isMutating:
      applyPatchMutation.isPending ||
      applyBulkPatchMutation.isPending ||
      updateNoteMutation.isPending ||
      toggleHolidayMutation.isPending ||
      upsertDayEventMutation.isPending ||
      deleteDayEventMutation.isPending ||
      toggleLockMutation.isPending,
  };
}

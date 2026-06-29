import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { attendanceV2Api } from "../api/attendanceV2Api";
import { format } from "date-fns";
import type { AttendanceDatasetCanonical } from "../../canonical/canonical.types";

export function useAttendanceV2Dataset(classId: string, month: Date) {
  const { session } = useAuth();
  const token = session?.access_token ?? "";
  const monthStr = format(month, "yyyy-MM");

  const query = useQuery({
    queryKey: ["attendance_v2_dataset", classId, monthStr, !!token],
    queryFn: async () => {
      if (!classId || !token) {
        return null;
      }
      const response = await attendanceV2Api.getDataset(classId, monthStr, token);
      return response.data;
    },
    enabled: !!classId && !!token,
  });

  return {
    dataset: query.data ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

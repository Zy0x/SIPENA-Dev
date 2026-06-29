import { useAttendanceV2 } from "@/hooks/useAttendanceV2";

/**
 * useAttendanceV2Adapter
 * Seam hook wrapping legacy useAttendanceV2.ts and returning V2-compatible interface.
 */
export function useAttendanceV2Adapter(
  classId: string,
  month: Date,
  workDayFormat: "5days" | "6days" = "6days"
) {
  const v2 = useAttendanceV2(classId, month, workDayFormat);
  return v2;
}

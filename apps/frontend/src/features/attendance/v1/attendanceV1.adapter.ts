import { useAttendance } from "@/hooks/useAttendance";

/**
 * useAttendanceV1Adapter
 * Seam hook wrapping legacy useAttendance.ts and returning V1-compatible interface.
 * Can be extended in future phases to map to the Canonical Model format.
 */
export function useAttendanceV1Adapter(
  classId: string,
  month: Date,
  workDayFormat: "5days" | "6days" = "6days"
) {
  // Call V1 hook directly to preserve state and query lifecycle
  const v1 = useAttendance(classId, month, workDayFormat);

  // Return exactly the V1 hook results
  return v1;
}

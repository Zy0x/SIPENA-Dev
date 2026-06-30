import type {
  AttendanceDailySummaryCanonical,
  AttendanceMonthlySummaryCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceStudentCanonical,
} from "../../attendance.types";
import type { AttendanceV2CalendarDay } from "../calendar/calendarEngine.types";

export interface AttendanceV2RecapProfile {
  id: string | null;
  name: string;
  countedStatuses: AttendanceStatusCode[];
  presentStatuses: AttendanceStatusCode[];
  absenceStatuses: AttendanceStatusCode[];
  denominatorPolicy: "effective_days" | "filled_days" | "custom";
  displayOrder: AttendanceStatusCode[];
}

export const DEFAULT_ATTENDANCE_V2_RECAP_PROFILE: AttendanceV2RecapProfile = {
  id: null,
  name: "Default HSIAD",
  countedStatuses: ["H", "S", "I", "A", "D"],
  presentStatuses: ["H", "D"],
  absenceStatuses: ["S", "I", "A"],
  denominatorPolicy: "effective_days",
  displayOrder: ["H", "S", "I", "A", "D"],
};

function countStatus(records: AttendanceRecordCanonical[], status: AttendanceStatusCode): number {
  return records.filter((record) => record.status === status).length;
}

export function computeMonthlySummaryFromProfile(
  students: AttendanceStudentCanonical[],
  records: AttendanceRecordCanonical[],
  days: AttendanceV2CalendarDay[],
  profile: AttendanceV2RecapProfile = DEFAULT_ATTENDANCE_V2_RECAP_PROFILE
): AttendanceMonthlySummaryCanonical[] {
  const effectiveDays = days.filter((day) => day.isEffective).length;

  return students.map((student) => {
    const studentRecords = records.filter((record) => record.studentId === student.id);
    const filledDays = new Set(studentRecords.map((record) => record.date)).size;
    const totalDays = profile.denominatorPolicy === "filled_days" ? filledDays : effectiveDays;

    return {
      studentId: student.id,
      presentCount: countStatus(studentRecords, "H"),
      sickCount: countStatus(studentRecords, "S"),
      permissionCount: countStatus(studentRecords, "I"),
      absentCount: countStatus(studentRecords, "A"),
      dispensationCount: countStatus(studentRecords, "D"),
      leaveCount: countStatus(studentRecords, "L"),
      totalDays,
    };
  });
}

export function computeDailySummaryFromProfile(
  records: AttendanceRecordCanonical[],
  date: string,
): AttendanceDailySummaryCanonical {
  const dailyRecords = records.filter((record) => record.date === date);
  return {
    date,
    presentCount: countStatus(dailyRecords, "H"),
    sickCount: countStatus(dailyRecords, "S"),
    permissionCount: countStatus(dailyRecords, "I"),
    absentCount: countStatus(dailyRecords, "A"),
    dispensationCount: countStatus(dailyRecords, "D"),
    leaveCount: countStatus(dailyRecords, "L"),
    totalCount: dailyRecords.length,
  };
}

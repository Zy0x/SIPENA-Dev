import {
  AttendanceDatasetCanonical,
  AttendanceDailySummaryCanonical,
  AttendanceMonthlySummaryCanonical,
  AttendanceYearlySummaryCanonical
} from "../canonical/canonical.types";

/**
 * computeDailySummary
 * Computes status counts (presents vs absences) for a single day.
 */
export function computeDailySummary(
  dataset: AttendanceDatasetCanonical,
  dateStr: string
): AttendanceDailySummaryCanonical {
  const dayRecords = dataset.records.filter((r) => r.date === dateStr);
  let presentCount = 0;
  let sickCount = 0;
  let permissionCount = 0;
  let absentCount = 0;
  let dispensationCount = 0;
  let leaveCount = 0;

  dayRecords.forEach((r) => {
    switch (r.status) {
      case "H":
        presentCount++;
        break;
      case "D":
        dispensationCount++;
        presentCount++;
        break;
      case "S":
        sickCount++;
        break;
      case "I":
        permissionCount++;
        break;
      case "A":
        absentCount++;
        break;
      case "L":
        leaveCount++;
        break;
    }
  });

  return {
    date: dateStr,
    presentCount,
    sickCount,
    permissionCount,
    absentCount,
    dispensationCount,
    leaveCount,
    totalCount: dayRecords.length
  };
}

/**
 * computeMonthlySummary
 * Summarizes monthly attendance records for a single student.
 */
export function computeMonthlySummary(
  dataset: AttendanceDatasetCanonical,
  studentId: string
): AttendanceMonthlySummaryCanonical {
  const studentRecords = dataset.records.filter((r) => r.studentId === studentId);
  
  let present = 0;
  let sick = 0;
  let permission = 0;
  let alpha = 0;
  let dispensation = 0;
  let leave = 0;

  studentRecords.forEach((r) => {
    switch (r.status) {
      case "H":
        present++;
        break;
      case "S":
        sick++;
        break;
      case "I":
        permission++;
        break;
      case "A":
        alpha++;
        break;
      case "D":
        dispensation++;
        present++; // dispensation counts as presence
        break;
    }
  });

  return {
    studentId,
    presentCount: present,
    sickCount: sick,
    permissionCount: permission,
    absentCount: alpha,
    dispensationCount: dispensation,
    leaveCount: leave,
    totalDays: studentRecords.length
  };
}

/**
 * computeYearlySummary
 * Compiles monthly datasets to compute a student's yearly attendance percentage.
 */
export function computeYearlySummary(
  monthlyDatasets: AttendanceDatasetCanonical[],
  studentId: string
): AttendanceYearlySummaryCanonical {
  const byMonth: Record<string, { presentCount: number; totalDays: number }> = {};
  let yearlyPresent = 0;
  let yearlyTotal = 0;

  monthlyDatasets.forEach((dataset) => {
    const summary = computeMonthlySummary(dataset, studentId);
    byMonth[dataset.month] = {
      presentCount: summary.presentCount,
      totalDays: summary.totalDays
    };
    yearlyPresent += summary.presentCount;
    yearlyTotal += summary.totalDays;
  });

  return {
    studentId,
    byMonth,
    yearlyPresentCount: yearlyPresent,
    yearlyTotalDays: yearlyTotal,
    percentage: yearlyTotal > 0 ? Math.round((yearlyPresent / yearlyTotal) * 100) : 0
  };
}

import type {
  AttendanceDatasetCanonical,
  AttendanceDailySummaryCanonical,
  AttendanceMonthlySummaryCanonical,
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceYearlySummaryCanonical,
} from "../canonical/canonical.types";
import type { AttendanceV2SummaryBundle } from "./attendanceV2.types";

function countRecord(
  status: AttendanceStatusCode,
  counts: Omit<AttendanceDailySummaryCanonical, "date" | "totalCount">
): void {
  switch (status) {
    case "H":
      counts.presentCount += 1;
      break;
    case "D":
      counts.dispensationCount += 1;
      counts.presentCount += 1;
      break;
    case "S":
      counts.sickCount += 1;
      break;
    case "I":
      counts.permissionCount += 1;
      break;
    case "A":
      counts.absentCount += 1;
      break;
    case "L":
      counts.leaveCount += 1;
      break;
    default:
      break;
  }
}

function emptyCounts(): Omit<AttendanceDailySummaryCanonical, "date" | "totalCount"> {
  return {
    presentCount: 0,
    sickCount: 0,
    permissionCount: 0,
    absentCount: 0,
    dispensationCount: 0,
    leaveCount: 0,
  };
}

export function computeDailySummary(
  dataset: AttendanceDatasetCanonical,
  dateStr: string
): AttendanceDailySummaryCanonical {
  const counts = emptyCounts();
  const dayRecords = dataset.records.filter((record) => record.date === dateStr);
  dayRecords.forEach((record) => countRecord(record.status, counts));

  return {
    date: dateStr,
    ...counts,
    totalCount: dayRecords.length,
  };
}

export function computeMonthlySummary(
  dataset: AttendanceDatasetCanonical,
  studentId: string
): AttendanceMonthlySummaryCanonical {
  const counts = emptyCounts();
  const studentRecords = dataset.records.filter((record) => record.studentId === studentId);
  studentRecords.forEach((record) => countRecord(record.status, counts));

  return {
    studentId,
    presentCount: counts.presentCount,
    sickCount: counts.sickCount,
    permissionCount: counts.permissionCount,
    absentCount: counts.absentCount,
    dispensationCount: counts.dispensationCount,
    leaveCount: counts.leaveCount,
    totalDays: studentRecords.length,
  };
}

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
      totalDays: summary.totalDays,
    };
    yearlyPresent += summary.presentCount;
    yearlyTotal += summary.totalDays;
  });

  return {
    studentId,
    byMonth,
    yearlyPresentCount: yearlyPresent,
    yearlyTotalDays: yearlyTotal,
    percentage: yearlyTotal > 0 ? Math.round((yearlyPresent / yearlyTotal) * 100) : 0,
  };
}

export function computeMonthlyClassRecap(dataset: AttendanceDatasetCanonical): AttendanceV2SummaryBundle["classRecap"] {
  const counts = emptyCounts();
  dataset.records.forEach((record) => countRecord(record.status, counts));

  return {
    ...counts,
    totalCount: dataset.records.length,
  };
}

export function computeSummaryBundle(
  dataset: AttendanceDatasetCanonical,
  yearlyDatasets: AttendanceDatasetCanonical[] = []
): AttendanceV2SummaryBundle {
  const dates = dataset.days.length > 0
    ? dataset.days.map((day) => day.date)
    : [...new Set(dataset.records.map((record) => record.date))].sort();

  return {
    daily: dates.map((date) => computeDailySummary(dataset, date)),
    monthly: dataset.students.map((student) => computeMonthlySummary(dataset, student.id)),
    yearly: yearlyDatasets.length > 0
      ? dataset.students.map((student) => computeYearlySummary(yearlyDatasets, student.id))
      : undefined,
    classRecap: computeMonthlyClassRecap(dataset),
  };
}

export function getDailyRecords(dataset: AttendanceDatasetCanonical, date: string): AttendanceRecordCanonical[] {
  return dataset.records.filter((record) => record.date === date);
}

export function getMonthlyRecords(dataset: AttendanceDatasetCanonical, studentId?: string): AttendanceRecordCanonical[] {
  return studentId ? dataset.records.filter((record) => record.studentId === studentId) : [...dataset.records];
}

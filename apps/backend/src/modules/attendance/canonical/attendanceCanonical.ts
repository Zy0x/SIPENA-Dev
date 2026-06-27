import type {
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceExportDatasetCanonical,
  AttendanceRecordCanonical,
  AttendanceValidationIssue,
} from "../attendance.types";

export function createEmptyAttendanceDataset(query: AttendanceDatasetQuery): AttendanceDatasetCanonical {
  return {
    classId: query.classId,
    month: query.month,
    students: [],
    records: [],
    days: [],
    holidays: [],
    dayEvents: [],
    locks: [],
    dailySummary: [],
    monthlySummary: [],
  };
}

export function createBackendPendingIssue(): AttendanceValidationIssue {
  return {
    severity: "warning",
    code: "BACKEND_ATTENDANCE_ADAPTER_PENDING",
    message:
      "Backend presensi sudah memiliki kontrak canonical, tetapi pembacaan data nyata masih menunggu adapter database yang aman.",
  };
}

export function summarizeDaily(records: AttendanceRecordCanonical[], date: string) {
  const dailyRecords = records.filter((record) => record.date === date);
  return {
    date,
    presentCount: dailyRecords.filter((record) => record.status === "H").length,
    sickCount: dailyRecords.filter((record) => record.status === "S").length,
    permissionCount: dailyRecords.filter((record) => record.status === "I").length,
    absentCount: dailyRecords.filter((record) => record.status === "A").length,
    dispensationCount: dailyRecords.filter((record) => record.status === "D").length,
    leaveCount: dailyRecords.filter((record) => record.status === "L").length,
    totalCount: dailyRecords.length,
  };
}

export function createExportDataset(dataset: AttendanceDatasetCanonical): AttendanceExportDatasetCanonical {
  return {
    className: dataset.classId,
    monthLabel: dataset.month,
    students: dataset.students.map((student, index) => {
      const records = dataset.records.filter((record) => record.studentId === student.id);
      return {
        number: index + 1,
        name: student.name,
        nisn: student.nisn,
        records: records.map((record) => ({ date: record.date, status: record.status })),
        totals: {
          H: records.filter((record) => record.status === "H").length,
          S: records.filter((record) => record.status === "S").length,
          I: records.filter((record) => record.status === "I").length,
          A: records.filter((record) => record.status === "A").length,
          D: records.filter((record) => record.status === "D").length,
          total: records.length,
        },
      };
    }),
    notes: dataset.records.map((record) => record.note).filter((note): note is string => !!note),
  };
}

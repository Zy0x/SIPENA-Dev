import type {
  AttendanceDatasetCanonical,
  AttendanceDatasetQuery,
  AttendanceRuntimeContext,
  AttendanceValidationIssue,
  AttendanceStudentCanonical,
  AttendanceRecordCanonical,
  AttendanceHolidayCanonical,
  AttendanceCalendarEventCanonical,
  AttendanceLockCanonical,
} from "../attendance.types";
import { AttendanceV1Adapter } from "../v1/attendanceV1.adapter";
import { generateCalendarDays } from "../../../../../frontend/src/features/attendance/v2/calendar/calendarEngine";
import { evaluateAttendanceRules } from "../../../../../frontend/src/features/attendance/v2/rules/ruleEngine";
import { computeSummaryBundle } from "../../../../../frontend/src/features/attendance/v2/attendanceV2.engine";
import { parse, startOfMonth, endOfMonth, format } from "date-fns";

export class AttendanceV2Adapter {
  private v1Adapter = new AttendanceV1Adapter();

  async getDataset(
    query: AttendanceDatasetQuery,
    runtime: AttendanceRuntimeContext
  ): Promise<{ dataset: AttendanceDatasetCanonical; issues: AttendanceValidationIssue[] }> {
    // 1. Fetch raw dataset dari database via V1 Adapter
    const { dataset: rawDataset, issues: fetchIssues } = await this.v1Adapter.getDataset(query, runtime);

    if (fetchIssues.some((issue) => issue.severity === "error")) {
      return { dataset: rawDataset, issues: fetchIssues };
    }

    try {
      const { classId, month } = query;

      // 2. Tentukan range tanggal untuk calendar engine
      const parsedMonth = parse(month, "yyyy-MM", new Date());
      const startDate = format(startOfMonth(parsedMonth), "yyyy-MM-dd");
      const endDate = format(endOfMonth(parsedMonth), "yyyy-MM-dd");

      // 3. Generate Calendar Days menggunakan V2 Calendar Engine
      // Kita konversi types agar compatible dengan CalendarEngineInputs di frontend
      const calendarDays = generateCalendarDays({
        startDate,
        endDate,
        classId,
        workDayFormat: "5days",
        events: rawDataset.dayEvents.map((e) => ({
          ...e,
          classId: null,
          schoolId: null,
          priority: null,
        })),
        holidays: rawDataset.holidays.map((h) => ({
          ...h,
          isNational: h.isNational,
        })),
        overrides: [],
        locks: rawDataset.locks.map((l) => ({
          classId: l.classId,
          month: l.month,
          isLocked: l.isLocked,
          lockedAt: l.lockedAt,
          lockedBy: l.lockedBy,
        })),
      });

      const mappedDays = calendarDays.map((day) => ({
        date: day.date,
        dayOfWeek: day.dayOfWeek,
        isWeekend: day.dayOfWeek === 0 || day.dayOfWeek === 6,
        isEffective: day.isEffective,
        holidayName: day.holidayName || undefined,
        eventName: day.eventName || undefined,
      }));

      // 4. Evaluasi aturan presensi & tambahkan flag evaluasi per record
      const evaluatedRecords = rawDataset.records.map((record) => {
        const student = rawDataset.students.find((s) => s.id === record.studentId) || {
          id: record.studentId,
          name: "Unknown Student",
          nisn: "",
        };
        const day = calendarDays.find((d) => d.date === record.date);

        const ruleOutput = evaluateAttendanceRules({
          student,
          classId: record.classId,
          date: record.date,
          proposedStatus: record.status,
          proposedNote: record.note,
          calendarDay: day || null,
          locks: rawDataset.locks.map((l) => ({
            classId: l.classId,
            month: l.month,
            isLocked: l.isLocked,
            lockedAt: l.lockedAt,
            lockedBy: l.lockedBy,
          })),
          existingRecord: record,
        });

        return {
          ...record,
          status: ruleOutput.selectedStatus ?? record.status,
          debug: {
            isHoliday: day ? day.isHoliday : false,
            holidayName: day ? day.holidayName : null,
            isEffective: day ? day.isEffective : true,
            rulesApplied: ruleOutput.appliedRuleIds,
            message: ruleOutput.reasonCode,
            isValid: ruleOutput.writeAllowed,
          },
        } as AttendanceRecordCanonical;
      });

      const processedDataset: AttendanceDatasetCanonical = {
        ...rawDataset,
        days: mappedDays,
        records: evaluatedRecords,
      };

      // 5. Hitung ringkasan Summary Bundle secara server-side
      const summaryBundle = computeSummaryBundle(processedDataset);

      processedDataset.dailySummary = summaryBundle.daily;
      processedDataset.monthlySummary = summaryBundle.monthly;

      return {
        dataset: processedDataset,
        issues: fetchIssues,
      };
    } catch (err: any) {
      return {
        dataset: rawDataset,
        issues: [
          ...fetchIssues,
          {
            severity: "error",
            code: "V2_COMPUTATION_FAILED",
            message: `Gagal memproses V2 dataset: ${err.message || err}`,
          },
        ],
      };
    }
  }
}

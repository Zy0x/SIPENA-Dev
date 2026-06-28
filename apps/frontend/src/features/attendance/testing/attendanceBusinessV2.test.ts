import { describe, expect, it } from "vitest";
import { generateCalendarDays } from "../v2/calendar/calendarEngine";
import { resolveConflictForDate } from "../v2/calendar/calendarConflictResolver";
import { getStatusDefinition } from "../v2/rules/statusEngine";
import { evaluateAttendanceRules } from "../v2/rules/ruleEngine";
import {
  computeDailySummary,
  computeMonthlySummary,
  computeYearlySummary,
} from "../v2/attendanceV2.engine";
import { mapV1SeamInputToCanonicalDataset } from "../v1/attendanceV1.canonical";
import type { AttendanceDatasetCanonical, AttendanceRecordCanonical } from "../canonical/canonical.types";
import { ConflictPriority } from "../v2/calendar/calendarEngine.types";

describe("Attendance V2 Calendar Engine Unit Tests", () => {
  it("generates calendar days correctly for 5-day format (weekend Saturday & Sunday)", () => {
    const days = generateCalendarDays({
      startDate: "2026-06-01", // Monday
      endDate: "2026-06-07", // Sunday
      classId: "class-1",
      workDayFormat: "5days",
      events: [],
      holidays: [],
      overrides: [],
      locks: [],
    });

    expect(days).toHaveLength(7);
    // Saturday
    expect(days[5].date).toBe("2026-06-06");
    expect(days[5].isEffective).toBe(false);
    expect(days[5].holidayName).toBe("Hari Sabtu (Libur)");

    // Sunday
    expect(days[6].date).toBe("2026-06-07");
    expect(days[6].isEffective).toBe(false);
    expect(days[6].holidayName).toBe("Hari Minggu");
  });

  it("generates calendar days correctly for 6-day format (weekend only Sunday)", () => {
    const days = generateCalendarDays({
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      classId: "class-1",
      workDayFormat: "6days",
      events: [],
      holidays: [],
      overrides: [],
      locks: [],
    });

    expect(days).toHaveLength(7);
    // Saturday should be effective
    expect(days[5].date).toBe("2026-06-06");
    expect(days[5].isEffective).toBe(true);

    // Sunday is weekend
    expect(days[6].date).toBe("2026-06-07");
    expect(days[6].isEffective).toBe(false);
  });
});

describe("Attendance V2 Conflict Resolver Unit Tests", () => {
  it("resolves conflicts based on priority order: closure > override > event > holiday > weekend", () => {
    const dateStr = "2026-06-01"; // Monday
    const classId = "class-1";

    // 1. Holiday vs Weekend (Holiday wins)
    const holidays = [{ id: "h1", date: dateStr, description: "Hari Raya", isNational: true }];
    const resHoliday = resolveConflictForDate(dateStr, classId, "6days", [], holidays, []);
    expect(resHoliday.holidayName).toBe("Hari Raya");
    expect(resHoliday.priority).toBe(ConflictPriority.HOLIDAY);

    // 2. School Event vs Holiday (School Event wins - makes day effective)
    const events = [{ id: "e1", date: dateStr, label: "Classmeeting", color: "blue", description: "" }];
    const resEvent = resolveConflictForDate(dateStr, classId, "6days", events, holidays, []);
    expect(resEvent.eventName).toBe("Classmeeting");
    expect(resEvent.isEffective).toBe(true);
    expect(resEvent.priority).toBe(ConflictPriority.SCHOOL_EVENT);

    // 3. Forced Holiday Override vs Event (Forced Holiday wins - makes day non-effective)
    const overrides = [{ id: "o1", date: dateStr, type: "FORCED_HOLIDAY" as const, description: "Jembatan Libur" }];
    const resOverride = resolveConflictForDate(dateStr, classId, "6days", events, holidays, overrides);
    expect(resOverride.holidayName).toBe("Jembatan Libur");
    expect(resOverride.isEffective).toBe(false);
    expect(resOverride.priority).toBe(ConflictPriority.SCHOOL_OVERRIDE);

    // 4. Administrative Closure vs Forced Effective Override (Closure wins)
    const overridesWithClosure = [
      { id: "o1", date: dateStr, type: "FORCED_EFFECTIVE" as const, description: "Masuk Pengganti" },
      { id: "o2", date: dateStr, type: "ADMINISTRATIVE_CLOSURE" as const, description: "Sekolah Diliburkan Darurat" },
    ];
    const resClosure = resolveConflictForDate(dateStr, classId, "6days", [], [], overridesWithClosure);
    expect(resClosure.holidayName).toBe("Sekolah Diliburkan Darurat");
    expect(resClosure.isEffective).toBe(false);
    expect(resClosure.priority).toBe(ConflictPriority.LOCK_OR_CLOSURE);
  });
});

describe("Attendance V2 Status Engine Unit Tests", () => {
  it("defines standard codes and behavior flags accurately", () => {
    // Hadir
    const h = getStatusDefinition("H");
    expect(h).toBeDefined();
    expect(h?.countsAsPresent).toBe(true);
    expect(h?.behaviorFlags).not.toContain("REQUIRES_NOTE");

    // Sakit
    const s = getStatusDefinition("S");
    expect(s?.countsAsPresent).toBe(false);
    expect(s?.behaviorFlags).toContain("REQUIRES_NOTE");

    // Dispensasi
    const d = getStatusDefinition("D");
    expect(d?.countsAsPresent).toBe(true); // counts as present!
    expect(d?.behaviorFlags).toContain("REQUIRES_NOTE"); // requires note!
  });
});

describe("Attendance V2 Rule Engine Unit Tests", () => {
  it("blocks status mutations when locked or non-effective", () => {
    const student = { id: "std-1", name: "Murid A", nisn: "123" };
    const classId = "class-1";
    const date = "2026-06-01";

    // Non-effective day validation
    const nonEffectiveDay = {
      date,
      dayOfWeek: 0,
      isWeekend: true,
      isHoliday: true,
      isEffective: false,
      isEffectiveDay: false,
      eventPriority: ConflictPriority.WEEKEND_RULE,
      blockedWriteState: false,
      reasonCodes: ["WEEKEND_SUNDAY" as const],
      metadata: {
        isLocked: false,
        lockInfo: null,
        appliedOverrideIds: [],
        appliedEventIds: [],
        appliedHolidayIds: [],
        uiHint: "holiday" as const,
      },
    };

    const resNonEffective = evaluateAttendanceRules({
      student,
      classId,
      date,
      proposedStatus: "H",
      proposedNote: null,
      calendarDay: nonEffectiveDay,
      locks: [],
      existingRecord: null,
    });
    expect(resNonEffective.writeAllowed).toBe(false);
    expect(resNonEffective.reasonCode).toBe("NON_EFFECTIVE_DAY");

    // Locked period validation
    const lockedDay = {
      ...nonEffectiveDay,
      isEffective: true,
      isEffectiveDay: true,
      blockedWriteState: true,
    };
    const resLocked = evaluateAttendanceRules({
      student,
      classId,
      date,
      proposedStatus: "H",
      proposedNote: null,
      calendarDay: lockedDay,
      locks: [{ classId, month: "2026-06", isLocked: true, lockedAt: null, lockedBy: null }],
      existingRecord: null,
    });
    expect(resLocked.writeAllowed).toBe(false);
    expect(resLocked.reasonCode).toBe("LOCKED_PERIOD");
  });
});

describe("Attendance V2 Summary Engine Unit Tests", () => {
  it("calculates daily, monthly, and yearly summaries with status D counted as present", () => {
    const dataset: AttendanceDatasetCanonical = {
      classId: "class-1",
      month: "2026-06",
      students: [
        { id: "std-1", name: "Murid A", nisn: "123" },
        { id: "std-2", name: "Murid B", nisn: "456" },
      ],
      records: [
        { id: "r1", studentId: "std-1", classId: "class-1", date: "2026-06-01", status: "H", note: null, createdAt: null, updatedAt: null },
        { id: "r2", studentId: "std-1", classId: "class-1", date: "2026-06-02", status: "D", note: "Lomba", createdAt: null, updatedAt: null },
        { id: "r3", studentId: "std-1", classId: "class-1", date: "2026-06-03", status: "S", note: "Demam", createdAt: null, updatedAt: null },
        { id: "r4", studentId: "std-2", classId: "class-1", date: "2026-06-01", status: "A", note: null, createdAt: null, updatedAt: null },
      ],
      days: [
        { date: "2026-06-01", isEffective: true, dayOfWeek: 1 },
        { date: "2026-06-02", isEffective: true, dayOfWeek: 2 },
        { date: "2026-06-03", isEffective: true, dayOfWeek: 3 },
      ],
      holidays: [],
      dayEvents: [],
      locks: [],
    };

    // Daily summary check
    const daily = computeDailySummary(dataset, "2026-06-01");
    expect(daily.presentCount).toBe(1); // Murid A (H)
    expect(daily.absentCount).toBe(1); // Murid B (A)

    const dailyD = computeDailySummary(dataset, "2026-06-02");
    expect(dailyD.presentCount).toBe(1); // Murid A (D)
    expect(dailyD.dispensationCount).toBe(1);

    // Monthly summary check
    const monthlyA = computeMonthlySummary(dataset, "std-1");
    expect(monthlyA.presentCount).toBe(2); // H (1) + D (1)
    expect(monthlyA.sickCount).toBe(1); // S (1)

    // Yearly summary check
    const yearly = computeYearlySummary([dataset], "std-1");
    expect(yearly.yearlyPresentCount).toBe(2);
    expect(yearly.percentage).toBe(67); // 2/3 * 100
  });
});

describe("Attendance V1 vs V2 Canonical Output Regression Tests", () => {
  it("guarantees matching formats for shared calendar properties and student mapping", () => {
    const rawV1Input = {
      classInfo: { id: "class-1", name: "Kelas 1", classKkm: null },
      month: "2026-06",
      students: [
        { id: "s-1", name: "Budi", nisn: "100" },
      ],
      attendanceRecords: [
        { id: "r-1", student_id: "s-1", class_id: "class-1", date: "2026-06-01", status: "H" as const, note: null, created_at: "", updated_at: "" },
      ],
      holidays: [],
      dayEvents: [],
      locks: [],
    };

    const canonicalFromV1Seam = mapV1SeamInputToCanonicalDataset(rawV1Input);

    expect(canonicalFromV1Seam.classId).toBe(rawV1Input.classInfo.id);
    expect(canonicalFromV1Seam.students[0].name).toBe("Budi");
    expect(canonicalFromV1Seam.records[0].status).toBe("H");
  });
});

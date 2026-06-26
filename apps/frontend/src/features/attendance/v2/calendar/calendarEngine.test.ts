import { describe, expect, it } from "vitest";
import type { AttendanceHolidayCanonical, AttendanceLockCanonical } from "../../canonical/canonical.types";
import { resolveConflictForDate } from "./calendarConflictResolver";
import { generateCalendarDays } from "./calendarEngine";
import { CalendarOverride, CalendarScopedEvent, ConflictPriority } from "./calendarEngine.types";
import { computeEffectiveDay } from "./effectiveDayEngine";

const classId = "class-1";
const otherClassId = "class-2";

function holiday(overrides: Partial<AttendanceHolidayCanonical> = {}): AttendanceHolidayCanonical {
  return {
    id: "holiday-1",
    date: "2026-06-01",
    description: "Libur Nasional",
    isNational: true,
    ...overrides,
  };
}

function event(overrides: Partial<CalendarScopedEvent> = {}): CalendarScopedEvent {
  return {
    id: "event-1",
    date: "2026-06-01",
    label: "Kegiatan Sekolah",
    description: null,
    color: "blue",
    ...overrides,
  };
}

describe("V2 calendar conflict priority", () => {
  it("marks default weekdays as effective days", () => {
    const resolved = resolveConflictForDate("2026-06-01", classId, "6days", [], [], []);

    expect(resolved).toMatchObject({
      isEffective: true,
      isHoliday: false,
      priority: ConflictPriority.DEFAULT_WEEKDAY,
      reasonCodes: ["DEFAULT_SCHOOL_DAY"],
    });
  });

  it("marks Sunday as non-effective by weekend rule", () => {
    const resolved = resolveConflictForDate("2026-06-07", classId, "6days", [], [], []);

    expect(resolved).toMatchObject({
      isEffective: false,
      isHoliday: true,
      holidayName: "Hari Minggu",
      priority: ConflictPriority.WEEKEND_RULE,
      reasonCodes: ["WEEKEND_SUNDAY"],
    });
  });

  it("uses holiday priority and label when a holiday falls on Sunday", () => {
    const resolved = resolveConflictForDate(
      "2026-06-07",
      classId,
      "6days",
      [],
      [holiday({ id: "holiday-sunday", date: "2026-06-07", description: "Idul Adha" })],
      []
    );

    expect(resolved).toMatchObject({
      isEffective: false,
      isHoliday: true,
      holidayName: "Idul Adha",
      priority: ConflictPriority.HOLIDAY,
      reasonCodes: ["HOLIDAY_RECORD"],
    });
  });

  it("handles Saturday inactive in 5-day format and active in 6-day format", () => {
    const fiveDay = resolveConflictForDate("2026-06-06", classId, "5days", [], [], []);
    const sixDay = resolveConflictForDate("2026-06-06", classId, "6days", [], [], []);

    expect(fiveDay).toMatchObject({
      isEffective: false,
      isHoliday: true,
      reasonCodes: ["WEEKEND_SATURDAY"],
    });
    expect(sixDay).toMatchObject({
      isEffective: true,
      isHoliday: false,
      reasonCodes: ["DEFAULT_SCHOOL_DAY"],
    });
  });

  it("lets custom holidays override normal school days", () => {
    const resolved = resolveConflictForDate(
      "2026-06-01",
      classId,
      "6days",
      [],
      [holiday({ description: "Libur Yayasan", isNational: false })],
      []
    );

    expect(resolved).toMatchObject({
      isEffective: false,
      isHoliday: true,
      holidayName: "Libur Yayasan",
      priority: ConflictPriority.HOLIDAY,
    });
  });

  it("lets events on holidays make the day effective while keeping holiday ids for UI hints", () => {
    const resolved = resolveConflictForDate(
      "2026-06-01",
      classId,
      "6days",
      [event({ label: "Ujian Akhir" })],
      [holiday({ description: "Hari Raya" })],
      []
    );

    expect(resolved).toMatchObject({
      isEffective: true,
      isHoliday: false,
      eventName: "Ujian Akhir",
      priority: ConflictPriority.SCHOOL_EVENT,
      reasonCodes: ["SCHOOL_WIDE_EVENT"],
      appliedHolidayIds: ["holiday-1"],
    });
  });

  it("selects multiple events deterministically by priority then id", () => {
    const resolved = resolveConflictForDate(
      "2026-06-01",
      classId,
      "6days",
      [
        event({ id: "event-low", label: "Kegiatan B", priority: 1 }),
        event({ id: "event-high-b", label: "Kegiatan C", priority: 10 }),
        event({ id: "event-high-a", label: "Kegiatan A", priority: 10 }),
      ],
      [],
      []
    );

    expect(resolved.eventName).toBe("Kegiatan A");
    expect(resolved.appliedEventIds).toEqual(["event-high-a", "event-high-b", "event-low"]);
  });

  it("prioritizes class-specific event over school-wide event for matching class only", () => {
    const events = [
      event({ id: "event-school", label: "Rapat Sekolah" }),
      event({ id: "event-class", label: "Kegiatan Kelas", classId }),
      event({ id: "event-other-class", label: "Kegiatan Kelas Lain", classId: otherClassId, priority: 100 }),
    ];

    const resolved = resolveConflictForDate("2026-06-01", classId, "6days", events, [], []);

    expect(resolved).toMatchObject({
      isEffective: true,
      eventName: "Kegiatan Kelas",
      priority: ConflictPriority.CLASS_EVENT,
      reasonCodes: ["CLASS_SPECIFIC_EVENT"],
    });
  });

  it("filters school-scoped events by school scope", () => {
    const resolved = resolveConflictForDate(
      "2026-06-01",
      classId,
      "6days",
      [
        event({ id: "wrong-school", label: "Sekolah Lain", schoolId: "school-b", priority: 100 }),
        event({ id: "right-school", label: "Sekolah Ini", schoolId: "school-a" }),
      ],
      [],
      [],
      { schoolId: "school-a" }
    );

    expect(resolved.eventName).toBe("Sekolah Ini");
    expect(resolved.appliedEventIds).toEqual(["right-school"]);
  });

  it("enforces administrative closure over class events", () => {
    const override: CalendarOverride = {
      id: "closure-1",
      date: "2026-06-01",
      type: "ADMINISTRATIVE_CLOSURE",
      description: "Penutupan Darurat",
    };

    const resolved = resolveConflictForDate(
      "2026-06-01",
      classId,
      "6days",
      [event({ label: "Ujian Sekolah", classId })],
      [],
      [override]
    );

    expect(resolved).toMatchObject({
      isEffective: false,
      isHoliday: true,
      holidayName: "Penutupan Darurat",
      priority: ConflictPriority.LOCK_OR_CLOSURE,
      reasonCodes: ["ADMINISTRATIVE_CLOSURE"],
      appliedOverrideIds: ["closure-1"],
    });
  });

  it("lets forced effective overrides make Sunday effective", () => {
    const override: CalendarOverride = {
      id: "forced-effective-1",
      date: "2026-06-07",
      type: "FORCED_EFFECTIVE",
      description: "Kegiatan Pengganti",
    };

    const resolved = resolveConflictForDate("2026-06-07", classId, "5days", [], [], [override]);

    expect(resolved).toMatchObject({
      isEffective: true,
      isHoliday: false,
      eventName: "Kegiatan Pengganti",
      priority: ConflictPriority.SCHOOL_OVERRIDE,
      reasonCodes: ["FORCED_EFFECTIVE_OVERRIDE"],
    });
  });
});

describe("V2 calendar range and effective-day output", () => {
  it("generates days across month boundary and leap year February", () => {
    const days = generateCalendarDays({
      startDate: "2024-02-28",
      endDate: "2024-03-02",
      classId,
      workDayFormat: "6days",
      events: [],
      holidays: [],
      overrides: [],
      locks: [],
    });

    expect(days.map((day) => day.date)).toEqual(["2024-02-28", "2024-02-29", "2024-03-01", "2024-03-02"]);
  });

  it("returns empty range when start date is after end date", () => {
    expect(
      generateCalendarDays({
        startDate: "2026-07-01",
        endDate: "2026-06-01",
        classId,
        workDayFormat: "6days",
        events: [],
        holidays: [],
        overrides: [],
        locks: [],
      })
    ).toEqual([]);
  });

  it("rejects invalid ISO dates before generating a range", () => {
    expect(() =>
      generateCalendarDays({
        startDate: "2026-02-31",
        endDate: "2026-03-01",
        classId,
        workDayFormat: "6days",
        events: [],
        holidays: [],
        overrides: [],
        locks: [],
      })
    ).toThrow("Invalid start or end date format");
  });

  it("sets blocked write state and canonical lock context when the month is locked", () => {
    const locks: AttendanceLockCanonical[] = [
      {
        classId,
        month: "2026-06",
        isLocked: true,
        lockedAt: null,
        lockedBy: null,
      },
    ];

    const day = computeEffectiveDay("2026-06-15", classId, "6days", [], [], [], locks);

    expect(day.isEffective).toBe(true);
    expect(day.blockedWriteState).toBe(true);
    expect(day.lock).toBe(locks[0]);
    expect(day.reasonCodes).toContain("LOCKED_PERIOD");
    expect(day.metadata.uiHint).toBe("locked");
  });

  it("computes retroactive changes from input events without storing derived results", () => {
    const before = computeEffectiveDay("2026-06-06", classId, "5days", [], [], [], []);
    const after = computeEffectiveDay(
      "2026-06-06",
      classId,
      "5days",
      [event({ id: "retroactive-event", date: "2026-06-06", label: "Kegiatan Susulan" })],
      [],
      [],
      []
    );

    expect(before).toMatchObject({
      isEffective: false,
      reasonCodes: ["WEEKEND_SATURDAY"],
    });
    expect(after).toMatchObject({
      isEffective: true,
      eventName: "Kegiatan Susulan",
      reasonCodes: ["SCHOOL_WIDE_EVENT"],
    });
  });
});

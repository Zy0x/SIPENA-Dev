import { describe, expect, it } from "vitest";
import { generateCalendarDays } from "./calendarEngine";
import { computeEffectiveDay } from "./effectiveDayEngine";
import { resolveConflictForDate } from "./calendarConflictResolver";
import { ConflictPriority, CalendarOverride } from "./calendarEngine.types";
import {
  AttendanceCalendarEventCanonical,
  AttendanceHolidayCanonical,
  AttendanceLockCanonical
} from "../../canonical/canonical.types";

describe("V2 Calendar Engine - Conflict Resolver & Priority", () => {
  const dummyClassId = "class-1";
  
  it("should default weekday to effective day", () => {
    // 2026-06-01 is a Monday
    const resolved = resolveConflictForDate(
      "2026-06-01",
      dummyClassId,
      "6days",
      [],
      [],
      []
    );
    expect(resolved.isEffective).toBe(true);
    expect(resolved.isHoliday).toBe(false);
    expect(resolved.priority).toBe(ConflictPriority.DEFAULT_WEEKDAY);
    expect(resolved.reasonCodes).toContain("DEFAULT_SCHOOL_DAY");
  });

  it("should mark Sunday as holiday (Weekend Rule)", () => {
    // 2026-06-07 is a Sunday
    const resolved = resolveConflictForDate(
      "2026-06-07",
      dummyClassId,
      "6days",
      [],
      [],
      []
    );
    expect(resolved.isEffective).toBe(false);
    expect(resolved.isHoliday).toBe(true);
    expect(resolved.holidayName).toBe("Hari Minggu");
    expect(resolved.priority).toBe(ConflictPriority.WEEKEND_RULE);
    expect(resolved.reasonCodes).toContain("WEEKEND_SUNDAY");
  });

  it("should handle Saturday inactive in 5-day format", () => {
    // 2026-06-06 is a Saturday
    const resolved = resolveConflictForDate(
      "2026-06-06",
      dummyClassId,
      "5days",
      [],
      [],
      []
    );
    expect(resolved.isEffective).toBe(false);
    expect(resolved.isHoliday).toBe(true);
    expect(resolved.holidayName).toBe("Hari Sabtu (Libur)");
    expect(resolved.priority).toBe(ConflictPriority.WEEKEND_RULE);
  });

  it("should handle Saturday active in 6-day format", () => {
    // 2026-06-06 is a Saturday
    const resolved = resolveConflictForDate(
      "2026-06-06",
      dummyClassId,
      "6days",
      [],
      [],
      []
    );
    expect(resolved.isEffective).toBe(true);
    expect(resolved.isHoliday).toBe(false);
    expect(resolved.priority).toBe(ConflictPriority.DEFAULT_WEEKDAY);
  });

  it("should resolve national holiday overriding normal school day", () => {
    // 2026-06-01 (Monday) with holiday
    const holiday: AttendanceHolidayCanonical = {
      id: "hol-1",
      date: "2026-06-01",
      description: "Hari Lahir Pancasila",
      isNational: true
    };
    const resolved = resolveConflictForDate(
      "2026-06-01",
      dummyClassId,
      "6days",
      [],
      [holiday],
      []
    );
    expect(resolved.isEffective).toBe(false);
    expect(resolved.isHoliday).toBe(true);
    expect(resolved.holidayName).toBe("Hari Lahir Pancasila");
    expect(resolved.priority).toBe(ConflictPriority.HOLIDAY);
  });

  it("should resolve school-wide event overriding holiday (Event on Holiday)", () => {
    // Event scheduled on a holiday should make the day effective
    const holiday: AttendanceHolidayCanonical = {
      id: "hol-1",
      date: "2026-06-01",
      description: "Hari Raya",
      isNational: true
    };
    const event: AttendanceCalendarEventCanonical = {
      id: "evt-1",
      date: "2026-06-01",
      label: "Ujian Akhir",
      description: "Ujian utama",
      color: "red"
    };

    const resolved = resolveConflictForDate(
      "2026-06-01",
      dummyClassId,
      "6days",
      [event],
      [holiday],
      []
    );
    expect(resolved.isEffective).toBe(true);
    expect(resolved.isHoliday).toBe(false);
    expect(resolved.eventName).toBe("Ujian Akhir");
    expect(resolved.priority).toBe(ConflictPriority.CLASS_EVENT); // event priority > holiday priority
  });

  it("should resolve class-specific event vs school-wide event on same day", () => {
    // Class-specific events take precedence
    const events: AttendanceCalendarEventCanonical[] = [
      {
        id: "evt-school",
        date: "2026-06-01",
        label: "Rapat Guru",
        description: null,
        color: "blue"
      },
      {
        id: "evt-class",
        date: "2026-06-01",
        label: "Study Tour Kelas 10",
        description: null,
        color: "green",
        classId: dummyClassId // class-scoped event
      } as any
    ];

    const resolved = resolveConflictForDate(
      "2026-06-01",
      dummyClassId,
      "6days",
      events,
      [],
      []
    );
    expect(resolved.isEffective).toBe(true);
    expect(resolved.eventName).toBe("Study Tour Kelas 10");
    expect(resolved.reasonCodes).toContain("CLASS_SPECIFIC_EVENT");
  });

  it("should enforce administrative closure as highest priority", () => {
    const override: CalendarOverride = {
      id: "closure-1",
      date: "2026-06-01",
      type: "ADMINISTRATIVE_CLOSURE",
      description: "Penutupan Darurat Asap"
    };
    // Even if there is a class event scheduled
    const event: AttendanceCalendarEventCanonical = {
      id: "evt-1",
      date: "2026-06-01",
      label: "Ujian Sekolah",
      description: null,
      color: "red"
    };

    const resolved = resolveConflictForDate(
      "2026-06-01",
      dummyClassId,
      "6days",
      [event],
      [],
      [override]
    );
    expect(resolved.isEffective).toBe(false);
    expect(resolved.isHoliday).toBe(true);
    expect(resolved.holidayName).toBe("Penutupan Darurat Asap");
    expect(resolved.priority).toBe(ConflictPriority.LOCK_OR_CLOSURE);
  });
});

describe("V2 Calendar Engine - Range Generator & Leap Years", () => {
  const dummyClassId = "class-1";

  it("should generate calendar day array over month boundary and leap year February", () => {
    // 2024 is a leap year, February has 29 days
    const inputs = {
      startDate: "2024-02-28",
      endDate: "2024-03-02",
      classId: dummyClassId,
      workDayFormat: "6days" as const,
      events: [],
      holidays: [],
      overrides: [],
      locks: []
    };

    const days = generateCalendarDays(inputs);
    expect(days).toHaveLength(4); // Feb 28, Feb 29, Mar 1, Mar 2
    expect(days[0].date).toBe("2024-02-28");
    expect(days[1].date).toBe("2024-02-29");
    expect(days[2].date).toBe("2024-03-01");
    expect(days[3].date).toBe("2024-03-02");
  });

  it("should set blockedWriteState when lock is present for the period", () => {
    const locks: AttendanceLockCanonical[] = [
      {
        classId: dummyClassId,
        month: "2026-06",
        isLocked: true,
        lockedAt: null,
        lockedBy: null
      }
    ];

    const day = computeEffectiveDay(
      "2026-06-15",
      dummyClassId,
      "6days",
      [],
      [],
      [],
      locks
    );

    expect(day.blockedWriteState).toBe(true);
    expect(day.reasonCodes).toContain("LOCKED_PERIOD");
    expect(day.metadata?.isLocked).toBe(true);
  });
});

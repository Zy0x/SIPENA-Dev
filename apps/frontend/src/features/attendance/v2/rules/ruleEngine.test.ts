import { describe, expect, it, beforeEach } from "vitest";
import { evaluateAttendanceRules } from "./ruleEngine";
import { registerCustomStatus, resetToDefaults } from "./statusEngine";
import { RuleEvaluationContext, RulePriority, AttendanceRule } from "./ruleEngine.types";
import { ConflictPriority, V2CalendarDay } from "../calendar/calendarEngine.types";

describe("V2 Rules Engine - Core Evaluations", () => {
  const dummyStudent = { id: "student-1", name: "Budi", nisn: "12345" };
  const dummyClassId = "class-1";
  
  const baseCalendarDay: V2CalendarDay = {
    date: "2026-06-01",
    dayOfWeek: 1, // Monday
    isEffective: true,
    isEffectiveDay: true,
    isHoliday: false,
    eventPriority: ConflictPriority.DEFAULT_WEEKDAY,
    blockedWriteState: false,
    reasonCodes: ["DEFAULT_SCHOOL_DAY"],
    metadata: {
      isLocked: false,
      lockInfo: null,
      appliedOverrideIds: [],
      appliedEventIds: [],
      appliedHolidayIds: [],
      uiHint: "effective"
    }
  };

  const baseContext: RuleEvaluationContext = {
    student: dummyStudent,
    classId: dummyClassId,
    date: "2026-06-01",
    proposedStatus: null,
    proposedNote: null,
    calendarDay: baseCalendarDay,
    locks: [],
    existingRecord: null
  };

  beforeEach(() => {
    resetToDefaults();
  });

  it("should evaluate a normal school day default to Hadir (H)", () => {
    const output = evaluateAttendanceRules(baseContext);
    expect(output.selectedStatus).toBe("H");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("DEFAULT_WEEKDAY_HADIR");
    expect(output.appliedRuleIds).toContain("rule-default-school-day");
  });

  it("should allow writing manual proposed status on effective days", () => {
    const context = {
      ...baseContext,
      proposedStatus: "S" as const,
      proposedNote: "Sakit demam"
    };
    const output = evaluateAttendanceRules(context);
    expect(output.selectedStatus).toBe("S");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
  });

  it("should reject invalid status codes", () => {
    const context = {
      ...baseContext,
      proposedStatus: "XYZ"
    };
    const output = evaluateAttendanceRules(context);
    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("INVALID_STATUS_CODE");
    expect(output.appliedRuleIds).toContain("rule-invalid-status");
  });

  it("should block writes on locked periods", () => {
    const lockedDay: V2CalendarDay = {
      ...baseCalendarDay,
      blockedWriteState: true,
      reasonCodes: ["DEFAULT_SCHOOL_DAY", "LOCKED_PERIOD"]
    };
    const context = {
      ...baseContext,
      proposedStatus: "H" as const,
      calendarDay: lockedDay
    };
    const output = evaluateAttendanceRules(context);
    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("LOCKED_PERIOD");
    expect(output.appliedRuleIds).toContain("rule-lock-period");
  });

  it("should block writes and default to Libur (L) on non-effective days", () => {
    const holidayDay: V2CalendarDay = {
      date: "2026-06-07",
      dayOfWeek: 0, // Sunday
      isEffective: false,
      isEffectiveDay: false,
      isHoliday: true,
      eventPriority: ConflictPriority.WEEKEND_RULE,
      blockedWriteState: false,
      reasonCodes: ["WEEKEND_SUNDAY"],
      metadata: {
        isLocked: false,
        lockInfo: null,
        appliedOverrideIds: [],
        appliedEventIds: [],
        appliedHolidayIds: [],
        uiHint: "holiday"
      }
    };
    const context = {
      ...baseContext,
      date: "2026-06-07",
      proposedStatus: "H" as const,
      calendarDay: holidayDay
    };
    const output = evaluateAttendanceRules(context);
    expect(output.writeAllowed).toBe(false);
    expect(output.selectedStatus).toBe("L");
    expect(output.reasonCode).toBe("NON_EFFECTIVE_DAY");
    expect(output.appliedRuleIds).toContain("rule-non-effective-day");
  });

  it("should accept custom status codes once registered", () => {
    // Register custom status code 'T' (Terlambat)
    registerCustomStatus({
      code: "T",
      label: "Terlambat",
      weight: 1.0,
      countsAsPresent: true,
      countsAsAbsence: false,
      exportCode: "T",
      colorToken: "yellow",
      behaviorFlags: []
    });

    const context = {
      ...baseContext,
      proposedStatus: "T"
    };
    const output = evaluateAttendanceRules(context);
    expect(output.selectedStatus).toBe("T");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
  });

  it("should resolve student-level override rule over default rule", () => {
    // suspension rule for student-1
    const suspensionRule: AttendanceRule = {
      id: "rule-student-suspension",
      name: "Student Suspension Rule",
      scope: "student",
      priority: RulePriority.MANUAL_OVERRIDE,
      enabled: true,
      condition: (ctx) => ctx.student.id === "student-1",
      effect: () => ({
        selectedStatus: "A",
        writeAllowed: false,
        reasonCode: "STUDENT_SUSPENDED"
      })
    };

    const output = evaluateAttendanceRules(baseContext, [suspensionRule]);
    expect(output.selectedStatus).toBe("A");
    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("STUDENT_SUSPENDED");
    expect(output.appliedRuleIds).toContain("rule-student-suspension");
  });

  it("should flag conflict reports when competing rules of same priority clash", () => {
    // Define two clashing rules with same priority
    const ruleA: AttendanceRule = {
      id: "rule-clash-a",
      name: "Clashing Rule A",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({
        selectedStatus: "I",
        writeAllowed: true,
        reasonCode: "CLASH_A"
      })
    };

    const ruleB: AttendanceRule = {
      id: "rule-clash-b",
      name: "Clashing Rule B",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({
        selectedStatus: "S",
        writeAllowed: true,
        reasonCode: "CLASH_B"
      })
    };

    const output = evaluateAttendanceRules(baseContext, [ruleA, ruleB]);
    expect(output.conflictNotes).toHaveLength(1);
    expect(output.conflictNotes[0]).toContain("RULE_CLASH_WARNING");
    expect(output.conflictNotes[0]).toContain("Clashing Rule A");
    expect(output.conflictNotes[0]).toContain("Clashing Rule B");
  });
});

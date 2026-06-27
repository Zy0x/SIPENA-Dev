import { beforeEach, describe, expect, it } from "vitest";
import type {
  AttendanceRecordCanonical,
  AttendanceStatusCode,
  AttendanceStudentCanonical,
} from "../../canonical/canonical.types";
import { ConflictPriority, type V2CalendarDay } from "../calendar/calendarEngine.types";
import { evaluateAttendanceRules } from "./ruleEngine";
import type { AttendanceRule, RuleEvaluationContext } from "./ruleEngine.types";
import { RulePriority } from "./ruleEngine.types";
import { registerCustomStatus, resetToDefaults } from "./statusEngine";

const dummyStudent: AttendanceStudentCanonical = { id: "student-1", name: "Budi", nisn: "12345" };

type CalendarDayOverrides = Omit<Partial<V2CalendarDay>, "metadata"> & {
  metadata?: Partial<V2CalendarDay["metadata"]>;
};

function createCalendarDay(overrides: CalendarDayOverrides = {}): V2CalendarDay {
  const { metadata, ...dayOverrides } = overrides;

  return {
    date: "2026-06-01",
    dayOfWeek: 1,
    isEffective: true,
    isEffectiveDay: true,
    isHoliday: false,
    eventPriority: ConflictPriority.DEFAULT_WEEKDAY,
    blockedWriteState: false,
    reasonCodes: ["DEFAULT_SCHOOL_DAY"],
    ...dayOverrides,
    metadata: {
      isLocked: false,
      lockInfo: null,
      appliedOverrideIds: [],
      appliedEventIds: [],
      appliedHolidayIds: [],
      uiHint: "effective",
      ...(metadata ?? {}),
    },
  };
}

function createRecord(overrides: Partial<AttendanceRecordCanonical> = {}): AttendanceRecordCanonical {
  return {
    id: "record-1",
    studentId: dummyStudent.id,
    classId: "class-1",
    date: "2026-06-01",
    status: "H",
    note: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

function createContext(overrides: Partial<RuleEvaluationContext> = {}): RuleEvaluationContext {
  return {
    student: dummyStudent,
    classId: "class-1",
    date: "2026-06-01",
    proposedStatus: null,
    proposedNote: null,
    calendarDay: createCalendarDay(),
    locks: [],
    existingRecord: null,
    ...overrides,
  };
}

describe("V2 Rules Engine - Core Evaluations", () => {
  beforeEach(() => {
    resetToDefaults();
  });

  it("defaults a normal effective school day to Hadir", () => {
    const output = evaluateAttendanceRules(createContext());

    expect(output.selectedStatus).toBe("H");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("DEFAULT_WEEKDAY_HADIR");
    expect(output.appliedRuleIds).toEqual(["rule-default-school-day"]);
    expect(output.auditMetadata.resolvedPriority).toBe(RulePriority.DEFAULT);
  });

  it("allows manual status writes on effective days when status requirements are satisfied", () => {
    const output = evaluateAttendanceRules(createContext({ proposedStatus: "S", proposedNote: "Sakit demam" }));

    expect(output.selectedStatus).toBe("S");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
    expect(output.appliedRuleIds).toContain("rule-manual-status-assignment");
  });

  it("rejects invalid status codes", () => {
    const output = evaluateAttendanceRules(createContext({ proposedStatus: "XYZ" }));

    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("INVALID_STATUS_CODE");
    expect(output.appliedRuleIds).toEqual(["rule-invalid-status"]);
    expect(output.auditMetadata.validationIssues).toContain("Status code 'XYZ' is not registered in the system.");
  });

  it("blocks note-required statuses when note is empty", () => {
    const output = evaluateAttendanceRules(createContext({ proposedStatus: "S", proposedNote: " " }));

    expect(output.writeAllowed).toBe(false);
    expect(output.selectedStatus).toBeNull();
    expect(output.reasonCode).toBe("STATUS_REQUIRES_NOTE");
    expect(output.appliedRuleIds).toEqual(["rule-status-requires-note"]);
  });

  it("blocks writes on locked periods", () => {
    const output = evaluateAttendanceRules(
      createContext({
        proposedStatus: "H",
        calendarDay: createCalendarDay({
          blockedWriteState: true,
          reasonCodes: ["DEFAULT_SCHOOL_DAY", "LOCKED_PERIOD"],
        }),
      })
    );

    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("LOCKED_PERIOD");
    expect(output.appliedRuleIds).toEqual(["rule-lock-period"]);
  });

  it("distinguishes administrative closure from ordinary lock periods", () => {
    const output = evaluateAttendanceRules(
      createContext({
        proposedStatus: "H",
        calendarDay: createCalendarDay({
          blockedWriteState: true,
          reasonCodes: ["ADMINISTRATIVE_CLOSURE"],
        }),
      })
    );

    expect(output.writeAllowed).toBe(false);
    expect(output.reasonCode).toBe("ADMINISTRATIVE_CLOSURE");
    expect(output.auditMetadata.calendarReasonCodes).toEqual(["ADMINISTRATIVE_CLOSURE"]);
  });

  it("blocks writes and resolves to Libur on non-effective days", () => {
    const output = evaluateAttendanceRules(
      createContext({
        date: "2026-06-07",
        proposedStatus: "H",
        calendarDay: createCalendarDay({
          date: "2026-06-07",
          dayOfWeek: 0,
          isEffective: false,
          isEffectiveDay: false,
          isHoliday: true,
          eventPriority: ConflictPriority.WEEKEND_RULE,
          reasonCodes: ["WEEKEND_SUNDAY"],
          metadata: { uiHint: "holiday" },
        }),
      })
    );

    expect(output.writeAllowed).toBe(false);
    expect(output.selectedStatus).toBe("L");
    expect(output.reasonCode).toBe("NON_EFFECTIVE_DAY");
    expect(output.appliedRuleIds).toEqual(["rule-non-effective-day"]);
  });

  it("accepts valid custom status definitions", () => {
    registerCustomStatus({
      code: "T",
      label: "Terlambat",
      weight: 1,
      countsAsPresent: true,
      countsAsAbsence: false,
      exportCode: "T",
      colorToken: "yellow",
      behaviorFlags: ["COUNTS_AS_PRESENT"],
    });

    const output = evaluateAttendanceRules(createContext({ proposedStatus: "T" }));

    expect(output.selectedStatus).toBe("T");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("MANUAL_STATUS_ASSIGNMENT");
  });

  it("rejects unsafe custom status definitions", () => {
    expect(() =>
      registerCustomStatus({
        code: "X",
        label: "Bentrok",
        weight: 1,
        countsAsPresent: true,
        countsAsAbsence: true,
        exportCode: "X",
        colorToken: "red",
        behaviorFlags: [],
      })
    ).toThrow("STATUS_CANNOT_COUNT_AS_PRESENT_AND_ABSENCE");
  });

  it("uses event default behavior on effective class event days", () => {
    const output = evaluateAttendanceRules(
      createContext({
        calendarDay: createCalendarDay({
          eventName: "Kegiatan Kelas",
          eventPriority: ConflictPriority.CLASS_EVENT,
          reasonCodes: ["CLASS_SPECIFIC_EVENT"],
          metadata: { appliedEventIds: ["event-1"] },
        }),
      })
    );

    expect(output.selectedStatus).toBe("H");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("EVENT_DAY_DEFAULT_HADIR");
    expect(output.appliedRuleIds).toEqual(["rule-event-effective-day"]);
    expect(output.auditMetadata.eventName).toBe("Kegiatan Kelas");
  });

  it("allows retroactive note or status updates when explicitly requested", () => {
    const output = evaluateAttendanceRules(
      createContext({
        proposedStatus: "I",
        proposedNote: "Surat izin terlambat diterima",
        existingRecord: createRecord({ status: "A" }),
        additionalContext: { isRetroactiveEdit: true, source: "manual" },
      })
    );

    expect(output.selectedStatus).toBe("I");
    expect(output.writeAllowed).toBe(true);
    expect(output.reasonCode).toBe("RETROACTIVE_UPDATE_ALLOWED");
    expect(output.auditMetadata.isRetroactiveEdit).toBe(true);
    expect(output.auditMetadata.existingRecordId).toBe("record-1");
  });

  it("resolves student-level rules over class-level rules at the same priority", () => {
    const classRule: AttendanceRule = {
      id: "rule-class-event",
      name: "Class Event Rule",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({ selectedStatus: "I", writeAllowed: true, reasonCode: "CLASS_EVENT_RULE" }),
    };
    const studentRule: AttendanceRule = {
      id: "rule-student-override",
      name: "Student Override Rule",
      scope: "student",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({ selectedStatus: "A", writeAllowed: true, reasonCode: "STUDENT_OVERRIDE_RULE" }),
    };

    const output = evaluateAttendanceRules(createContext(), [classRule, studentRule]);

    expect(output.selectedStatus).toBe("A");
    expect(output.reasonCode).toBe("STUDENT_OVERRIDE_RULE");
    expect(output.conflictNotes[0]).toContain("by specificity");
  });

  it("reports duplicate competing rules with deterministic rule id fallback", () => {
    const ruleA: AttendanceRule = {
      id: "rule-clash-a",
      name: "Clashing Rule A",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({ selectedStatus: "I", writeAllowed: true, reasonCode: "CLASH_A" }),
    };
    const ruleB: AttendanceRule = {
      id: "rule-clash-b",
      name: "Clashing Rule B",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({ selectedStatus: "S", writeAllowed: true, reasonCode: "CLASH_B" }),
    };

    const output = evaluateAttendanceRules(createContext(), [ruleB, ruleA]);

    expect(output.selectedStatus).toBe("I");
    expect(output.conflictNotes).toHaveLength(1);
    expect(output.conflictNotes[0]).toContain("RULE_CLASH_WARNING");
    expect(output.conflictNotes[0]).toContain("Clashing Rule A");
    expect(output.conflictNotes[0]).toContain("Clashing Rule B");
  });

  it("blocks evaluation when calendar context is missing", () => {
    const output = evaluateAttendanceRules(createContext({ calendarDay: null }));

    expect(output.writeAllowed).toBe(false);
    expect(output.selectedStatus).toBeNull();
    expect(output.reasonCode).toBe("MISSING_CALENDAR_CONTEXT");
    expect(output.appliedRuleIds).toEqual(["rule-missing-calendar-context"]);
  });

  it("captures rule condition errors without throwing or logging through UI/export", () => {
    const brokenRule: AttendanceRule = {
      id: "rule-broken-condition",
      name: "Broken Condition",
      scope: "student",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => {
        throw new Error("Condition failed");
      },
      effect: () => ({ selectedStatus: "A", writeAllowed: false, reasonCode: "BROKEN_RULE" }),
    };

    const output = evaluateAttendanceRules(createContext(), [brokenRule]);

    expect(output.reasonCode).toBe("DEFAULT_WEEKDAY_HADIR");
    expect(output.auditMetadata.conditionErrors).toEqual([
      { ruleId: "rule-broken-condition", message: "Condition failed" },
    ]);
  });

  it("keeps existing status when no rule supplies a selected status", () => {
    const keepExistingRule: AttendanceRule = {
      id: "rule-keep-existing",
      name: "Keep Existing",
      scope: "student",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({ writeAllowed: true, reasonCode: "KEEP_EXISTING" }),
    };

    const output = evaluateAttendanceRules(
      createContext({ existingRecord: createRecord({ status: "D" }), proposedStatus: null }),
      [keepExistingRule]
    );

    expect(output.selectedStatus).toBe("D");
    expect(output.reasonCode).toBe("KEEP_EXISTING");
  });

  it("allows custom rule effects to use future status codes through canonical status typing", () => {
    const customRule: AttendanceRule = {
      id: "rule-custom-future-status",
      name: "Custom Future Status",
      scope: "class",
      priority: RulePriority.SPECIFIC_POLICY,
      enabled: true,
      condition: () => true,
      effect: () => ({
        selectedStatus: "K" as AttendanceStatusCode,
        writeAllowed: true,
        reasonCode: "CUSTOM_STATUS_FROM_POLICY",
      }),
    };

    const output = evaluateAttendanceRules(createContext(), [customRule]);

    expect(output.selectedStatus).toBe("K");
    expect(output.reasonCode).toBe("CUSTOM_STATUS_FROM_POLICY");
  });
});

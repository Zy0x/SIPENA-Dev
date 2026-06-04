import { describe, expect, it } from "vitest";

import {
  applyReportGradeRounding,
  calculateReportGrade,
  DEFAULT_FORMULA,
  normalizeFormula,
  normalizeReportRounding,
  type CustomFormula,
  type ReportRoundingMode,
} from "./gradeFormula";

const formulaWithRounding = (mode: ReportRoundingMode): CustomFormula => ({
  ...DEFAULT_FORMULA,
  reportRounding: { mode },
});

describe("gradeFormula report rounding", () => {
  it("normalizes legacy formulas without report rounding settings", () => {
    const normalized = normalizeFormula({
      enabled: false,
      components: DEFAULT_FORMULA.components,
    });

    expect(normalized.reportRounding).toEqual({ mode: "default" });
  });

  it("falls back to default rounding for invalid settings", () => {
    expect(normalizeReportRounding({ mode: "bad-mode" })).toEqual({ mode: "default" });
  });

  it("keeps the raw calculated report value in default mode", () => {
    const result = calculateReportGrade(DEFAULT_FORMULA, 82.5, 90, 85, true);

    expect(result).toBe(85);
  });

  it("supports one-decimal report rounding", () => {
    expect(applyReportGradeRounding(86.25, { mode: "one_decimal" })).toBe(86.3);
  });

  it("supports integer rounding modes for report grades", () => {
    expect(calculateReportGrade(formulaWithRounding("nearest_integer"), 82.5, 91, 86, true)).toBe(86);
    expect(calculateReportGrade(formulaWithRounding("floor_integer"), 82.5, 91, 86, true)).toBe(85);
    expect(calculateReportGrade(formulaWithRounding("ceil_integer"), 82.5, 91, 86, true)).toBe(86);
  });
});

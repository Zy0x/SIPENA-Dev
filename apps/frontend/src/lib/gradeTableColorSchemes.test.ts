import { describe, expect, it } from "vitest";

import {
  DEFAULT_GRADE_TABLE_COLOR_SCHEME,
  GRADE_TABLE_COLOR_SCHEMES,
  getGradeTableAverageCellTone,
  getGradeTableColumnHeaderTone,
  isSelectableGradeTableColorScheme,
  normalizeGradeTableColorScheme,
} from "./gradeTableColorSchemes";

describe("grade table color schemes", () => {
  it("uses classic as the safe default", () => {
    expect(DEFAULT_GRADE_TABLE_COLOR_SCHEME).toBe("classic");
    expect(normalizeGradeTableColorScheme(null)).toBe("classic");
    expect(normalizeGradeTableColorScheme(undefined)).toBe("classic");
    expect(normalizeGradeTableColorScheme("unknown")).toBe("classic");
  });

  it("allows classic and current, but keeps disabled future from becoming active", () => {
    expect(normalizeGradeTableColorScheme("classic")).toBe("classic");
    expect(normalizeGradeTableColorScheme("current")).toBe("current");
    expect(normalizeGradeTableColorScheme("future")).toBe("classic");
    expect(isSelectableGradeTableColorScheme("classic")).toBe(true);
    expect(isSelectableGradeTableColorScheme("current")).toBe(true);
    expect(isSelectableGradeTableColorScheme("future")).toBe(false);
  });

  it("keeps current scheme equal to the existing colorful table palette", () => {
    expect(getGradeTableColumnHeaderTone("current", { type: "assignment", chapterIndex: 0 })).toContain("bg-sky-100");
    expect(getGradeTableColumnHeaderTone("current", { type: "sts" })).toContain("bg-indigo-100");
    expect(getGradeTableColumnHeaderTone("current", { type: "sas" })).toContain("bg-purple-100");
    expect(getGradeTableAverageCellTone("current")).toContain("bg-slate-300/55");
  });

  it("keeps classic scheme close to the original SIPENA table tone", () => {
    expect(getGradeTableColumnHeaderTone("classic", { type: "assignment", chapterIndex: 4 })).toContain("bg-primary/10");
    expect(getGradeTableColumnHeaderTone("classic", { type: "sts" })).toContain("bg-primary/10");
    expect(getGradeTableColumnHeaderTone("classic", { type: "final" })).toContain("bg-muted");
    expect(getGradeTableAverageCellTone("classic")).toContain("bg-primary/10");
  });

  it("keeps Setting C as a visible disabled placeholder", () => {
    expect(GRADE_TABLE_COLOR_SCHEMES.future.label).toBe("Setting C");
    expect(GRADE_TABLE_COLOR_SCHEMES.future.selectable).toBe(false);
  });
});

import { describe, expect, it } from "vitest";

import {
  buildSubjectBatchPlan,
  getReadySubjectCandidates,
  isValidSubjectKkm,
  normalizeSubjectName,
} from "./subjectBatch";

describe("subject batch planning", () => {
  it("normalizes whitespace and Indonesian case for duplicate checks", () => {
    expect(normalizeSubjectName("  Bahasa   Indonesia ")).toBe("bahasa indonesia");
  });

  it("marks target and source duplicates without changing the first new subject", () => {
    const plan = buildSubjectBatchPlan([
      { id: "1", name: "Matematika", kkm: 75, isCustom: false },
      { id: "2", name: "  IPA ", kkm: 70, isCustom: false },
      { id: "3", name: "ipa", kkm: 80, isCustom: true },
    ], ["MATEMATIKA"]);

    expect(plan.map((item) => item.status)).toEqual(["existing", "ready", "duplicate_source"]);
    expect(getReadySubjectCandidates(plan).map((item) => item.name)).toEqual(["IPA"]);
  });

  it("preserves custom KKM and custom subject status", () => {
    const plan = buildSubjectBatchPlan([
      { id: "custom", name: "Robotika", kkm: 82, isCustom: true },
      { id: "default", name: "Biologi", kkm: 76, isCustom: false },
    ], []);

    expect(getReadySubjectCandidates(plan)).toMatchObject([
      { name: "Robotika", kkm: 82, isCustom: true },
      { name: "Biologi", kkm: 76, isCustom: false },
    ]);
  });

  it("rejects empty names and non-integer or out-of-range KKM", () => {
    expect(isValidSubjectKkm(0)).toBe(true);
    expect(isValidSubjectKkm(100)).toBe(true);
    expect(isValidSubjectKkm(75.5)).toBe(false);

    const plan = buildSubjectBatchPlan([
      { id: "empty", name: " ", kkm: 75, isCustom: true },
      { id: "high", name: "Kimia", kkm: 101, isCustom: false },
    ], []);
    expect(plan.every((item) => item.status === "invalid")).toBe(true);
  });
});

import { describe, expect, it } from "vitest";

import { DEFAULT_SUBJECT_GROUPS, DEFAULT_SUBJECTS } from "./defaultSubjects";

describe("default subjects", () => {
  it("groups default subject presets by school level", () => {
    expect(DEFAULT_SUBJECT_GROUPS.map((group) => group.id)).toEqual(["sd", "smp", "sma"]);
    expect(DEFAULT_SUBJECT_GROUPS.map((group) => group.label)).toEqual(["SD / MI", "SMP / MTs", "SMA / MA"]);
  });

  it("includes complete SMA science and advanced math subjects", () => {
    expect(DEFAULT_SUBJECTS).toEqual(expect.arrayContaining([
      "Biologi",
      "Fisika",
      "Kimia",
      "Matematika Tingkat Lanjut",
      "Matematika Wajib",
      "Bahasa Indonesia Tingkat Lanjut",
      "Bahasa Inggris Tingkat Lanjut",
    ]));
  });

  it("keeps the flattened helper unique for legacy callers", () => {
    expect(new Set(DEFAULT_SUBJECTS).size).toBe(DEFAULT_SUBJECTS.length);
  });
});

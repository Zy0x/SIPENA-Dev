import { describe, expect, it } from "vitest";

import {
  buildOfficialGradeTemplateWorkbook,
  getOfficialGradeTemplateFileName,
  normalizeName,
  normalizeNisn,
  normalizeRomanNumeralChapter,
  normalizeText,
  normalizeWhitespace,
  parseGradeHeader,
  parseGradeValue,
  removeZeroWidthChars,
} from "./index";

describe("gradeImport text normalizer", () => {
  it("normalizes whitespace, punctuation, non-breaking spaces, and zero-width chars", () => {
    expect(removeZeroWidthChars("A\u200BB")).toBe("AB");
    expect(normalizeWhitespace("  A\u00A0\u00A0B   C  ")).toBe("A B C");
    expect(normalizeText("  BAB  1 -- Tugas!!! 2  ")).toBe("bab 1 tugas 2");
  });

  it("normalizes NISN and keeps risk warnings", () => {
    const decimal = normalizeNisn("1234567890.0");
    expect(decimal.normalized).toBe("1234567890");
    expect(decimal.warnings.map((item) => item.code)).toContain("NISN_TRAILING_DECIMAL_REMOVED");

    const leadingZero = normalizeNisn("0012345678");
    expect(leadingZero.normalized).toBe("0012345678");
    expect(leadingZero.warnings.map((item) => item.code)).toContain("NISN_LEADING_ZERO");

    const scientific = normalizeNisn("1.23457E+09");
    expect(scientific.normalized).toBe("1.23457E+09");
    expect(scientific.warnings.map((item) => item.code)).toContain("NISN_SCIENTIFIC_NOTATION");
  });

  it("creates Muhammad alias candidates without making them exact", () => {
    const result = normalizeName("Muh. Rizki A");

    expect(result.normalized).toBe("muh rizki a");
    expect(result.candidates).toContain("muhammad rizki a");
    expect(result.warnings.map((item) => item.code)).toContain("NAME_MUHAMMAD_ALIAS_CANDIDATE");
  });

  it("creates roman numeral chapter candidates", () => {
    const result = normalizeRomanNumeralChapter("Bab IV - LKPD");

    expect(result.normalized).toBe("bab iv lkpd");
    expect(result.candidates).toContain("bab 4");
    expect(result.warnings.map((item) => item.code)).toContain("CHAPTER_ROMAN_NUMERAL_CANDIDATE");
  });
});

describe("gradeImport header parser", () => {
  it.each([
    ["BAB 1 - Tugas 2", "BAB 1", "Tugas 2"],
    ["BAB 1: Tugas 2", "BAB 1", "Tugas 2"],
    ["BAB 1 / Tugas 2", "BAB 1", "Tugas 2"],
    ["BAB 1 | Tugas 2", "BAB 1", "Tugas 2"],
    ["Bab I - UH 1", "BAB 1", "UH 1"],
    ["BAB 3 - Proyek", "BAB 3", "Proyek"],
    ["Unit 1 - Quiz 1", "Unit 1", "Quiz 1"],
    ["Materi 2 - Praktik", "Materi 2", "Praktik"],
  ])("parses explicit assignment header %s", (header, chapterName, assignmentName) => {
    const parsed = parseGradeHeader(header);

    expect(parsed.headerType).toBe("assignment");
    expect(parsed.target?.chapterName).toBe(chapterName);
    expect(parsed.target?.assignmentName).toBe(assignmentName);
    expect(parsed.confidence).toBeGreaterThanOrEqual(90);
  });

  it.each(["STS", "UTS", "PTS", "Sumatif Tengah Semester"])("parses STS alias %s", (header) => {
    const parsed = parseGradeHeader(header);

    expect(parsed.headerType).toBe("sts");
    expect(parsed.target?.gradeType).toBe("sts");
  });

  it.each(["SAS", "UAS", "PAS", "Sumatif Akhir Semester"])("parses SAS alias %s", (header) => {
    const parsed = parseGradeHeader(header);

    expect(parsed.headerType).toBe("sas");
    expect(parsed.target?.gradeType).toBe("sas");
  });

  it.each(["No", "Nomor", "NISN", "Nama Peserta Didik", "Keterangan"])("marks reserved column %s", (header) => {
    const parsed = parseGradeHeader(header);

    expect(parsed.headerType).toBe("reserved");
    expect(parsed.reserved).toBe(true);
  });

  it.each(["Predikat", "Rata-rata", "Nilai Akhir", "Rapor", "Ranking", "KKM"])("marks derived column %s", (header) => {
    const parsed = parseGradeHeader(header);

    expect(parsed.headerType).toBe("derived");
    expect(parsed.derived).toBe(true);
  });
});

describe("gradeImport value parser", () => {
  it("treats zero as a valid grade", () => {
    expect(parseGradeValue(0)).toMatchObject({ status: "valid", value: 0 });
    expect(parseGradeValue("0")).toMatchObject({ status: "valid", value: 0 });
  });

  it("treats empty values as skip", () => {
    expect(parseGradeValue("")).toMatchObject({ status: "empty", value: null });
    expect(parseGradeValue(null)).toMatchObject({ status: "empty", value: null });
    expect(parseGradeValue(undefined)).toMatchObject({ status: "empty", value: null });
  });

  it("parses numeric values and safe normalizations", () => {
    expect(parseGradeValue(85)).toMatchObject({ status: "valid", value: 85 });
    expect(parseGradeValue(85.5)).toMatchObject({ status: "valid", value: 85.5 });

    const comma = parseGradeValue("85,5");
    expect(comma).toMatchObject({ status: "valid", value: 85.5 });
    expect(comma.warnings.map((item) => item.code)).toContain("GRADE_VALUE_DECIMAL_COMMA");

    const percent = parseGradeValue("85%");
    expect(percent).toMatchObject({ status: "valid", value: 85 });
    expect(percent.warnings.map((item) => item.code)).toContain("GRADE_VALUE_PERCENT");

    const fullScale = parseGradeValue("90/100");
    expect(fullScale).toMatchObject({ status: "valid", value: 90 });
    expect(fullScale.warnings.map((item) => item.code)).toContain("GRADE_VALUE_FRACTION_100");
  });

  it("suggests scaled fractions but requires confirmation", () => {
    const parsed = parseGradeValue("18/20");

    expect(parsed.status).toBe("needs_confirmation");
    expect(parsed.value).toBeNull();
    expect(parsed.suggestedValue).toBe(90);
    expect(parsed.warnings.map((item) => item.code)).toContain("GRADE_VALUE_FRACTION_SCALED");
  });

  it.each(["#N/A", "#VALUE!", "#DIV/0!", "nilai bagus"])("blocks invalid value %s", (value) => {
    const parsed = parseGradeValue(value);

    expect(parsed.status).toBe("invalid");
    expect(parsed.conflicts.length).toBeGreaterThan(0);
  });

  it.each(["Tuntas", "Remedial", "A", "B", "C"])("blocks textual value %s", (value) => {
    const parsed = parseGradeValue(value);

    expect(parsed.status).toBe("textual");
    expect(parsed.value).toBeNull();
    expect(parsed.conflicts.map((item) => item.code)).toContain("GRADE_VALUE_TEXTUAL_BLOCKED");
  });
});

describe("official SIPENA grade template exporter", () => {
  const context = {
    classId: "class-1",
    className: "Kelas 5 A",
    subjectId: "subject-1",
    subjectName: "Matematika",
    semesterId: "semester-1",
    semesterName: "Semester 1",
    academicYearId: "year-1",
    generatedBy: "guru@example.com",
    generatedAt: "2026-05-08T00:00:00.000Z",
    students: [
      { id: "student-1", name: "Muh. Rizki", nisn: "0012345678" },
      { id: "student-2", name: "Siti Aminah", nisn: "9876543210" },
    ],
    chapters: [
      { id: "chapter-2", name: "BAB 2", order_index: 2 },
      { id: "chapter-1", name: "BAB I", order_index: 1 },
    ],
    assignments: [
      { id: "assignment-2", chapter_id: "chapter-1", name: "Tugas 2", order_index: 2 },
      { id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 },
      { id: "assignment-3", chapter_id: "chapter-2", name: "LKPD", order_index: 1 },
    ],
  };

  it("builds official workbook sheets and hides metadata sheets", () => {
    const workbook = buildOfficialGradeTemplateWorkbook(context);

    expect(workbook.SheetNames).toEqual(["Panduan", "Isi_Nilai", "_manifest", "_students", "_structure", "_column_map"]);
    expect(workbook.Workbook?.Sheets?.filter((sheet) => sheet.Hidden === 1).map((sheet) => sheet.name)).toEqual([
      "_manifest",
      "_students",
      "_structure",
      "_column_map",
    ]);
  });

  it("creates Isi_Nilai headers from web structure plus STS and SAS", () => {
    const workbook = buildOfficialGradeTemplateWorkbook(context);
    const sheet = workbook.Sheets["Isi_Nilai"];

    expect(sheet.A1?.v).toBe("No");
    expect(sheet.B1?.v).toBe("NISN");
    expect(sheet.C1?.v).toBe("Nama Siswa");
    expect(sheet.D1?.v).toBe("BAB 1 - Tugas 1");
    expect(sheet.E1?.v).toBe("BAB 1 - Tugas 2");
    expect(sheet.F1?.v).toBe("BAB 2 - LKPD");
    expect(sheet.G1?.v).toBe("STS");
    expect(sheet.H1?.v).toBe("SAS");
    expect(sheet.B2?.v).toBe("0012345678");
    expect(sheet.C2?.v).toBe("Muh. Rizki");
    expect(sheet.D2?.v ?? "").toBe("");
  });

  it("stores manifest hashes and unsigned template status", () => {
    const workbook = buildOfficialGradeTemplateWorkbook(context);
    const manifest = workbook.Sheets._manifest;

    expect(manifest.A2?.v).toBe("app");
    expect(manifest.B2?.v).toBe("SIPENA");
    expect(manifest.A16?.v).toBe("signature_status");
    expect(manifest.B16?.v).toBe("unsigned_client_template");
    expect(String(manifest.B13?.v)).toMatch(/^fnv1a32:/);
    expect(String(manifest.B14?.v)).toMatch(/^fnv1a32:/);
    expect(String(manifest.B15?.v)).toMatch(/^fnv1a32:/);
  });

  it("creates production-safe SIPENA filename", () => {
    expect(getOfficialGradeTemplateFileName(context)).toBe("Template_Nilai_SIPENA_Kelas_5_A_Matematika_Semester_1.xlsx");
  });
});

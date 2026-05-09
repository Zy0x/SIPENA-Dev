import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  analyzeOfficialTemplateWorkbook,
  analyzeFreeExcelWorkbook,
  buildImportPlan,
  buildCurrentGradesExportWorkbook,
  buildFullGradeBackupWorkbook,
  buildOfficialGradeTemplateWorkbook,
  getOfficialGradeTemplateFileName,
  matchColumns,
  matchStudents,
  matchStudentsFromWorkbookRows,
  normalizeName,
  normalizeNisn,
  normalizeRomanNumeralChapter,
  normalizeText,
  normalizeWhitespace,
  parseGradeHeader,
  parseGradeValue,
  readWorkbookBuffer,
  removeZeroWidthChars,
  type GradeExportContext,
} from "./index";

const exportContext: GradeExportContext = {
  classId: "class-1",
  className: "Kelas 7A",
  subjectId: "subject-1",
  subjectName: "Matematika",
  semesterId: "semester-1",
  semesterName: "Semester 1",
  academicYearId: "year-1",
  students: [
    { id: "student-1", name: "Ahmad", nisn: "00123" },
    { id: "student-2", name: "Budi", nisn: "00456" },
  ],
  chapters: [{ id: "chapter-1", name: "BAB 1", order_index: 1 }],
  assignments: [{ id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 }],
  grades: [
    {
      id: "grade-1",
      student_id: "student-1",
      subject_id: "subject-1",
      assignment_id: "assignment-1",
      grade_type: "assignment",
      value: 85,
      semester_id: "semester-1",
      academic_year_id: "year-1",
    },
    {
      id: "grade-2",
      student_id: "student-1",
      subject_id: "subject-1",
      assignment_id: null,
      grade_type: "sts",
      value: 90,
      semester_id: "semester-1",
      academic_year_id: "year-1",
    },
  ],
};

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

describe("SIPENA current grades and backup exporters", () => {
  it("exports current grades with guide and visible Nilai sheet only", () => {
    const workbook = buildCurrentGradesExportWorkbook(exportContext);
    const nilaiRows = XLSX.utils.sheet_to_json(workbook.Sheets.Nilai, { header: 1 }) as unknown[][];

    expect(workbook.SheetNames).toEqual(["Panduan", "Nilai"]);
    expect(nilaiRows[0]).toEqual(["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1", "STS", "SAS"]);
    expect(nilaiRows[1]).toEqual([1, "00123", "Ahmad", 85, 90, ""]);
    expect(nilaiRows[2]).toEqual([2, "00456", "Budi", "", "", ""]);
  });

  it("exports full backup sheets with hidden metadata and available grade rows", () => {
    const workbook = buildFullGradeBackupWorkbook(exportContext);
    const hiddenSheets = workbook.Workbook?.Sheets?.filter((sheet) => sheet.Hidden === 1).map((sheet) => sheet.name);
    const gradeRows = XLSX.utils.sheet_to_json(workbook.Sheets._grades, { header: 1 }) as unknown[][];

    expect(workbook.SheetNames).toEqual(["Panduan", "Nilai", "_manifest", "_students", "_structure", "_grades"]);
    expect(hiddenSheets).toEqual(["_manifest", "_students", "_structure", "_grades"]);
    expect(gradeRows[0]).toEqual(["grade_id", "student_id", "subject_id", "assignment_id", "grade_type", "value", "semester_id", "academic_year_id"]);
    expect(gradeRows[1]).toContain("grade-1");
  });
});

describe("gradeImport workbook reader", () => {
  it("reads xlsx sheets as primitive rows and keeps zero values", () => {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Nama", "Nilai"],
      ["Aisyah", 0],
    ]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Nilai");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;

    const result = readWorkbookBuffer(buffer, "nilai.xlsx");

    expect(result.ok).toBe(true);
    expect(result.sheetNames).toEqual(["Nilai"]);
    expect(result.sheets[0].rows[1][1]).toBe(0);
    expect(result.sheets[0].addressedRows[1].cells[1]).toMatchObject({
      value: 0,
      originalRowIndex: 2,
      originalColumnIndex: 2,
    });
  });

  it("reads csv input when extension is csv", () => {
    const buffer = new TextEncoder().encode("No,NISN,Nama Siswa\n1,0012345678,Siti").buffer;
    const result = readWorkbookBuffer(buffer, "nilai.csv");

    expect(result.ok).toBe(true);
    expect(result.sheets[0].rows[0]).toEqual(["No", "NISN", "Nama Siswa"]);
    expect(result.sheets[0].addressedRows[1].cells[1]).toMatchObject({
      value: "0012345678",
      originalRowIndex: 2,
      originalColumnIndex: 2,
    });
  });

  it("keeps original row and column indexes with title rows and blank workbook rows", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["KOP SEKOLAH"],
      [],
      ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
      [1, "0012345678", "Siti Aminah", 88],
      [],
      [2, "1234567890", "Muhammad Rizki", 91],
    ]), "Nilai");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const result = readWorkbookBuffer(buffer, "nilai.xlsx");

    expect(result.ok).toBe(true);
    expect(result.sheets[0].rows).toHaveLength(4);
    expect(result.sheets[0].addressedRows.map((row) => row.originalRowIndex)).toEqual([1, 3, 4, 6]);
    expect(result.sheets[0].addressedRows[1].cells[3]).toMatchObject({
      value: "BAB 1 - Tugas 1",
      originalRowIndex: 3,
      originalColumnIndex: 4,
    });
    expect(result.sheets[0].addressedRows[3].cells[3]).toMatchObject({
      value: 91,
      originalRowIndex: 6,
      originalColumnIndex: 4,
    });
  });

  it("returns clear errors for empty and unsupported files", () => {
    expect(readWorkbookBuffer(new ArrayBuffer(0), "nilai.xlsx")).toMatchObject({
      ok: false,
      error: { code: "IMPORT_FILE_EMPTY" },
    });
    expect(readWorkbookBuffer(new TextEncoder().encode("abc").buffer, "nilai.txt")).toMatchObject({
      ok: false,
      error: { code: "IMPORT_UNSUPPORTED_FILE_TYPE" },
    });
  });

  it("returns sheet empty error without crashing", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([]), "Kosong");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    const result = readWorkbookBuffer(buffer, "kosong.xlsx");

    expect(result.ok).toBe(false);
    expect("error" in result ? result.error.code : undefined).toBe("IMPORT_SHEET_EMPTY");
    expect(result.sheetNames).toEqual(["Kosong"]);
  });
});

describe("official SIPENA template reader", () => {
  const context = {
    classId: "class-1",
    subjectId: "subject-1",
    semesterId: "semester-1",
    academicYearId: "year-1",
  };
  const templateContext = {
    ...context,
    className: "Kelas 5 A",
    subjectName: "Matematika",
    semesterName: "Semester 1",
    generatedAt: "2026-05-08T00:00:00.000Z",
    students: [{ id: "student-1", name: "Siti Aminah", nisn: "0012345678" }],
    chapters: [{ id: "chapter-1", name: "BAB 1", order_index: 1 }],
    assignments: [{ id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 }],
  };

  function readTemplate(workbook: XLSX.WorkBook) {
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return readWorkbookBuffer(buffer, "template.xlsx");
  }

  it("detects official exact template and unsigned warning", () => {
    const result = analyzeOfficialTemplateWorkbook(readTemplate(buildOfficialGradeTemplateWorkbook(templateContext)), context);

    expect(result.sourceType).toBe("official_exact");
    expect(result.manifest?.app).toBe("SIPENA");
    expect(result.sheetPresence).toMatchObject({ input: true, manifest: true, students: true, structure: true, columnMap: true });
    expect(result.inputSheet?.addressedRows[0].originalRowIndex).toBe(1);
    expect(result.headers[3]).toMatchObject({
      columnIndex: 4,
      originalColumnIndex: 4,
      rawHeader: "BAB 1 - Tugas 1",
    });
    expect(result.warnings.map((item) => item.code)).toContain("IMPORT_UNSIGNED_TEMPLATE");
  });

  it("detects context mismatch and classifies as official modified", () => {
    const result = analyzeOfficialTemplateWorkbook(readTemplate(buildOfficialGradeTemplateWorkbook(templateContext)), {
      ...context,
      semesterId: "semester-2",
    });

    expect(result.sourceType).toBe("official_modified");
    expect(result.warnings.map((item) => item.code)).toContain("IMPORT_SEMESTER_MISMATCH");
  });

  it("detects added grade headers in official templates", () => {
    const workbook = buildOfficialGradeTemplateWorkbook(templateContext);
    const sheet = workbook.Sheets["Isi_Nilai"];
    sheet.G1 = { t: "s", v: "BAB 3 - Proyek" };
    sheet["!ref"] = "A1:G2";
    const result = analyzeOfficialTemplateWorkbook(readTemplate(workbook), context);

    expect(result.sourceType).toBe("official_modified");
    expect(result.headers.find((header) => header.rawHeader === "BAB 3 - Proyek")?.status).toBe("added");
    expect(result.warnings.map((item) => item.code)).toContain("IMPORT_ADDED_HEADER_DETECTED");
  });

  it("falls back to free structured when manifest is missing but input shape matches", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 2"],
      [1, "0012345678", "Siti Aminah", 90],
    ]), "Isi_Nilai");
    const result = analyzeOfficialTemplateWorkbook(readTemplate(workbook), context);

    expect(result.sourceType).toBe("free_structured");
    expect(result.warnings.map((item) => item.code)).toContain("IMPORT_MANIFEST_MISSING");
  });

  it("detects damaged official metadata", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["key", "value"],
      ["app", "SIPENA"],
    ]), "_manifest");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
      ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
      [1, "0012345678", "Siti Aminah", ""],
    ]), "Isi_Nilai");
    const result = analyzeOfficialTemplateWorkbook(readTemplate(workbook), context);

    expect(result.sourceType).toBe("official_damaged");
    expect(result.warnings.map((item) => item.code)).toContain("IMPORT_METADATA_SHEET_MISSING");
  });
});

describe("SIPENA student matcher", () => {
  const students = [
    { id: "student-1", name: "Siti Aminah", nisn: "0012345678" },
    { id: "student-2", name: "Muhammad Rizki", nisn: "1234567890" },
    { id: "student-3", name: "Ahmad Fauzi", nisn: "5555555555" },
  ];

  it("matches student_id exact and warns when name or NISN changed", () => {
    const result = matchStudents([
      { rowIndex: 2, studentId: "student-1", name: "Siti Berubah", nisn: "0099999999" },
    ], students);

    expect(result.mappings[0]).toMatchObject({
      studentId: "student-1",
      status: "warning",
      matchedBy: "student_id",
    });
    expect(result.mappings[0].warnings.map((item) => item.code)).toEqual(
      expect.arrayContaining(["STUDENT_ID_NAME_CHANGED", "STUDENT_ID_NISN_CHANGED"]),
    );
  });

  it("matches by NISN exact and normalized", () => {
    const exact = matchStudents([{ rowIndex: 2, name: "Siti", nisn: "0012345678" }], students);
    expect(exact.mappings[0]).toMatchObject({ studentId: "student-1", status: "safe", matchedBy: "nisn_exact" });

    const normalized = matchStudents([{ rowIndex: 2, name: "Muhammad Rizki", nisn: "1234567890.0" }], students);
    expect(normalized.mappings[0]).toMatchObject({ studentId: "student-2", status: "warning", matchedBy: "nisn_normalized" });
  });

  it("does not safe-match duplicate web NISN or duplicate normalized names", () => {
    const duplicateNisn = matchStudents([{ rowIndex: 2, name: "A", nisn: "123" }], [
      { id: "a", name: "Siswa A", nisn: "123" },
      { id: "b", name: "Siswa B", nisn: "123" },
    ]);
    expect(duplicateNisn.mappings[0].status).toBe("ambiguous");

    const duplicateName = matchStudents([{ rowIndex: 2, name: "Muh Rizki" }], [
      { id: "a", name: "Muh. Rizki", nisn: "1" },
      { id: "b", name: "Muh Rizki", nisn: "2" },
    ]);
    expect(duplicateName.mappings[0].status).toBe("ambiguous");
  });

  it("blocks duplicate Excel rows matched to one web student", () => {
    const result = matchStudents([
      { rowIndex: 2, name: "Siti Aminah", nisn: "0012345678" },
      { rowIndex: 3, name: "Siti Aminah", nisn: "0012345678" },
    ], students);

    expect(result.mappings.filter((mapping) => mapping.status === "blocked")).toHaveLength(2);
    expect(result.conflicts.map((item) => item.code)).toContain("STUDENT_DUPLICATE_EXCEL_MATCH");
  });

  it("reports missing_in_web and missing_in_excel without auto-creating students", () => {
    const result = matchStudents([{ rowIndex: 2, name: "Siswa Baru", nisn: "777" }], students);

    expect(result.mappings.find((mapping) => mapping.rowIndex === 2)?.status).toBe("missing_in_web");
    expect(result.mappings.filter((mapping) => mapping.status === "missing_in_excel")).toHaveLength(students.length);
  });

  it("extracts workbook rows and matches students", () => {
    const result = matchStudentsFromWorkbookRows([
      ["No", "NISN", "Nama Siswa"],
      [1, "0012345678", "Siti Aminah"],
    ], students);

    expect(result.mappings[0]).toMatchObject({ rowIndex: 2, studentId: "student-1", status: "safe" });
  });
});

describe("SIPENA column matcher", () => {
  const chapters = [
    { id: "chapter-1", name: "BAB 1", order_index: 1 },
    { id: "chapter-2", name: "BAB 2", order_index: 2 },
  ];
  const assignments = [
    { id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 },
    { id: "assignment-2", chapter_id: "chapter-1", name: "Tugas 2", order_index: 2 },
    { id: "assignment-3", chapter_id: "chapter-2", name: "Tugas 1", order_index: 1 },
  ];

  it("maps explicit BAB and task headers to existing assignments", () => {
    const result = matchColumns([{ columnIndex: 4, rawHeader: "BAB 1 - Tugas 2" }], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({
      targetType: "existing_assignment",
      status: "safe",
      target: { assignmentId: "assignment-2", chapterId: "chapter-1" },
    });
  });

  it("maps STS/SAS aliases and ignores reserved/derived columns", () => {
    const result = matchColumns([
      { columnIndex: 1, rawHeader: "Nama Siswa" },
      { columnIndex: 2, rawHeader: "Rapor" },
      { columnIndex: 3, rawHeader: "UTS" },
      { columnIndex: 4, rawHeader: "PAS" },
    ], chapters, assignments);

    expect(result.mappings.map((mapping) => mapping.targetType)).toEqual(["ignore", "ignore", "sts", "sas"]);
  });

  it("suggests create_assignment when BAB exists but task is new", () => {
    const result = matchColumns([{ columnIndex: 4, rawHeader: "BAB 1 - Proyek" }], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({ targetType: "create_assignment", status: "needs_confirmation" });
    expect(result.structureSuggestions[0]).toMatchObject({ type: "create_assignment", chapterName: "BAB 1", assignmentName: "Proyek" });
  });

  it("suggests create_chapter_and_assignment when BAB is new", () => {
    const result = matchColumns([{ columnIndex: 4, rawHeader: "BAB 3 - Proyek" }], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({ targetType: "create_chapter_and_assignment", status: "needs_confirmation" });
    expect(result.structureSuggestions[0]).toMatchObject({ type: "create_chapter_and_assignment", chapterName: "BAB 3", assignmentName: "Proyek" });
  });

  it("requires confirmation for similar task or chapter names", () => {
    const task = matchColumns([{ columnIndex: 4, rawHeader: "BAB 1 - Tugas 22" }], chapters, assignments);
    expect(task.mappings[0]).toMatchObject({ targetType: "existing_assignment", status: "needs_confirmation" });

    const chapter = matchColumns([{ columnIndex: 4, rawHeader: "BAB I - Tugas 2" }], chapters, assignments);
    expect(chapter.mappings[0].targetType).toBe("existing_assignment");
  });

  it("marks assignment-only headers as ambiguous when found in many chapters", () => {
    const result = matchColumns([{ columnIndex: 4, rawHeader: "Tugas 1" }], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({ targetType: "unresolved", status: "ambiguous" });
    expect(result.conflicts.map((item) => item.code)).toContain("COLUMN_ASSIGNMENT_AMBIGUOUS");
  });

  it("uses valid official metadata and warns when header changed", () => {
    const result = matchColumns([
      {
        columnIndex: 4,
        rawHeader: "Header Diubah",
        metadata: {
          columnIndex: 4,
          visibleHeader: "BAB 1 - Tugas 1",
          gradeType: "assignment",
          chapterId: "chapter-1",
          assignmentId: "assignment-1",
        },
      },
    ], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({
      targetType: "existing_assignment",
      status: "warning",
      target: { assignmentId: "assignment-1" },
    });
    expect(result.warnings.map((item) => item.code)).toContain("COLUMN_METADATA_VS_HEADER_CHANGED");
  });

  it("falls back to clear header when official metadata is invalid", () => {
    const result = matchColumns([
      {
        columnIndex: 4,
        rawHeader: "BAB 1 - Tugas 2",
        metadata: {
          columnIndex: 4,
          visibleHeader: "BAB 1 - Tugas 2",
          gradeType: "assignment",
          assignmentId: "missing-assignment",
        },
      },
    ], chapters, assignments);

    expect(result.mappings[0]).toMatchObject({ targetType: "unresolved", status: "needs_confirmation" });
    expect(result.warnings.map((item) => item.code)).toContain("COLUMN_METADATA_INVALID_HEADER_CLEAR");
  });
});

describe("SIPENA free Excel analyzer and ImportPlan builder", () => {
  const students = [
    { id: "student-1", name: "Siti Aminah", nisn: "0012345678" },
    { id: "student-2", name: "Muhammad Rizki", nisn: "1234567890" },
  ];
  const chapters = [{ id: "chapter-1", name: "BAB 1", order_index: 1 }];
  const assignments = [{ id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 }];

  function workbookResult(sheets: Record<string, unknown[][]>) {
    const workbook = XLSX.utils.book_new();
    Object.entries(sheets).forEach(([name, rows]) => {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
    });
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
    return readWorkbookBuffer(buffer, "nilai.xlsx");
  }

  it("scores the best free Excel sheet and ignores footer rows", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Catatan: [["Bukan nilai"]],
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1", "STS"],
        [1, "0012345678", "Siti Aminah", 90, 88],
        [2, "1234567890", "Muhammad Rizki", 0, 75],
        ["Rata-rata", "", "", 45, 81.5],
        ["Mengetahui", "", "", "", ""],
      ],
    }));

    expect(analysis.sourceType).toBe("free_structured");
    expect(analysis.bestRegion?.sheetName).toBe("Nilai");
    expect(analysis.bestRegion?.dataRows).toHaveLength(2);
    expect(analysis.bestRegion?.gradeColumns.map((column) => column.rawHeader)).toEqual(["BAB 1 - Tugas 1", "STS"]);
  });

  it("carries original coordinates from free Excel workbooks with title and blank rows", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["KOP SEKOLAH"],
        [],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [],
        [2, "1234567890", "Muhammad Rizki", 91],
      ],
    }), { students });

    expect(analysis.bestRegion?.headerRowIndex).toBe(3);
    expect(analysis.bestRegion?.dataStartRowIndex).toBe(4);
    expect(analysis.bestRegion?.dataEndRowIndex).toBe(6);
    expect(analysis.bestRegion?.addressedDataRows.map((row) => row.originalRowIndex)).toEqual([4, 6]);
    expect(analysis.bestRegion?.gradeColumns[0]).toMatchObject({
      columnIndex: 4,
      originalColumnIndex: 4,
      sourceRowIndexes: [3],
      sourceOriginalRowIndexes: [3],
    });
  });

  it("recognizes common teacher identity headers and prioritizes sheets that match active students", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai_Multi_Header: [
        ["Data Siswa", "", "", "BAB 1", "", "Ujian"],
        ["No", "NISN", "Nama Siswa", "Ide Pokok", "Tugas 4", "UTS"],
        [1, "0012345678", "Siti Aminah", 80, 82, 90],
      ],
      Nilai_Smart_Test: [
        ["Daftar Nilai Bahasa Indonesia"],
        ["Kelas VI-B"],
        ["Diisi dari file guru"],
        ["No", "NISN / NIS", "Peserta Didik", "UH 1", "BAB 1 - Kalimat Fakta", "PTS", "PAS", "Rata-rata"],
        [1, "0012345678", "Siti Aminah", 82, 86, 90, 91, 87.25],
        [2, "1234567890", "Muhammad Rizki", 75, 80, 84, 85, 81],
        ["Rata-rata", "", "", 78.5, 83, 87, 88, 84],
      ],
    }), { students });

    expect(analysis.bestRegion?.sheetName).toBe("Nilai_Smart_Test");
    expect(analysis.bestRegion?.headerRowIndex).toBe(4);
    expect(analysis.bestRegion?.nameColumnIndex).toBe(3);
    expect(analysis.bestRegion?.nisnColumnIndex).toBe(2);
    expect(analysis.bestRegion?.matchedStudentCount).toBe(2);
    expect(analysis.bestRegion?.gradeColumns.map((column) => column.rawHeader)).toEqual([
      "UH 1",
      "BAB 1 - Kalimat Fakta",
      "PTS",
      "PAS",
    ]);
  });

  it("supports simple multi-row headers and warns about multi-region workbooks", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai1: [
        ["", "", "", "BAB 1", "BAB 1"],
        ["No", "NISN", "Nama Siswa", "Tugas 1", "Tugas 2"],
        [1, "0012345678", "Siti Aminah", 80, 81],
      ],
      Nilai2: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "1234567890", "Muhammad Rizki", 75],
      ],
    }));

    expect(analysis.bestRegion?.headerRowCount).toBe(2);
    expect(analysis.bestRegion?.gradeColumns[0].rawHeader).toBe("BAB 1 - Tugas 1");
    expect(analysis.regions.length).toBeGreaterThan(1);
    expect(analysis.requiresRegionSelection).toBe(true);
    expect(analysis.bestRegion?.id).toBe("Nilai1:2:3:3");
    expect(analysis.warnings.map((item) => item.code)).toContain("FREE_EXCEL_MULTI_REGION_DETECTED");
  });

  it("carries sparse multi-row group headers into grade columns", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["Data Siswa", "", "", "BAB 1", "", "", "Ujian", "", "Rekap", ""],
        ["No", "NISN / NIS", "Peserta Didik", "Ide Pokok", "Fiksi Non Fiksi", "Tugas 4", "UTS", "UAS", "Total", "Status"],
        [1, "0012345678", "Siti Aminah", 80, 82, 83, 84, 85, 414, "Tuntas"],
      ],
    }));

    expect(analysis.bestRegion?.headerRowCount).toBe(2);
    expect(analysis.bestRegion?.gradeColumns.map((column) => column.rawHeader)).toEqual([
      "BAB 1 - Ide Pokok",
      "BAB 1 - Fiksi Non Fiksi",
      "BAB 1 - Tugas 4",
      "UTS",
      "UAS",
    ]);
  });

  it("builds a safe preview plan and skips existing values by default", () => {
    const freeAnalysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1", "STS"],
        [1, "0012345678", "Siti Aminah", 90, 88],
        [2, "1234567890", "Muhammad Rizki", 0, ""],
      ],
    }));
    const plan = buildImportPlan(freeAnalysis, {
      students,
      chapters,
      assignments,
      existingGrades: [{ student_id: "student-1", grade_type: "assignment", assignment_id: "assignment-1", value: 80 }],
    });

    expect(plan.sourceType).toBe("free_structured");
    expect(plan.summary.matchedStudentCount).toBe(2);
    expect(plan.summary.gradeColumnCount).toBe(2);
    expect(plan.gradeOperations.find((operation) => operation.studentId === "student-1" && operation.target.assignmentId === "assignment-1")?.action).toBe("skip_existing");
    expect(plan.gradeOperations.find((operation) => operation.studentId === "student-2" && operation.target.assignmentId === "assignment-1")?.value).toBe(0);
  });

  it("blocks final plan when free Excel has multiple regions and no region is selected", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "1234567890", "Muhammad Rizki", 75],
      ],
    }), { students });

    const plan = buildImportPlan(analysis, { students, chapters, assignments });

    expect(analysis.regions).toHaveLength(2);
    expect(analysis.requiresRegionSelection).toBe(true);
    expect(plan.gradeOperations).toHaveLength(0);
    expect(plan.summary.readyImportCount).toBe(0);
    expect(plan.conflicts.map((item) => item.code)).toContain("IMPORT_REGION_SELECTION_REQUIRED");
  });

  it("uses selectedRegionId when building an ImportPlan from multi-region free Excel", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [],
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "1234567890", "Muhammad Rizki", 75],
      ],
    }), { students });
    const secondRegion = analysis.regions.find((region) => region.headerRowIndex === 4);
    const plan = buildImportPlan(analysis, { students, chapters, assignments }, { selectedRegionId: secondRegion?.id });

    expect(secondRegion?.id).toBe("Nilai:4:5:5");
    expect(plan.conflicts.map((item) => item.code)).not.toContain("IMPORT_REGION_SELECTION_REQUIRED");
    expect(plan.studentMappings.filter((mapping) => mapping.status !== "missing_in_excel").map((mapping) => mapping.rowIndex)).toEqual([5]);
    expect(plan.gradeOperations).toHaveLength(1);
    expect(plan.gradeOperations[0]).toMatchObject({
      rowIndex: 5,
      originalRowIndex: 5,
      studentId: "student-2",
      value: 75,
    });
  });

  it("keeps original row indexes in ImportPlan operations after blank workbook rows", () => {
    const freeAnalysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [],
        [2, "1234567890", "Muhammad Rizki", 91],
      ],
    }), { students });
    const plan = buildImportPlan(freeAnalysis, { students, chapters, assignments });

    expect(plan.studentMappings.filter((mapping) => mapping.status !== "missing_in_excel").map((mapping) => mapping.rowIndex)).toEqual([2, 4]);
    expect(plan.gradeOperations.find((operation) => operation.studentId === "student-2")).toMatchObject({
      rowIndex: 4,
      originalRowIndex: 4,
      columnIndex: 4,
      originalColumnIndex: 4,
      value: 91,
    });
  });

  it("skips Excel rows that are missing in web instead of blocking every value", () => {
    const freeAnalysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [2, "9999999999", "Siswa Dari File Lain", 75],
      ],
    }), { students });
    const plan = buildImportPlan(freeAnalysis, { students, chapters, assignments });
    const skippedRowOperation = plan.gradeOperations.find((operation) => operation.rowIndex === 3);

    expect(plan.studentMappings.find((mapping) => mapping.rowIndex === 3)?.status).toBe("missing_in_web");
    expect(skippedRowOperation?.action).toBe("skip_existing");
    expect(skippedRowOperation?.conflicts.map((item) => item.code)).not.toContain("IMPORT_STUDENT_NOT_SAFE_FOR_VALUE");
    expect(plan.conflicts.map((item) => item.code)).not.toContain("IMPORT_STUDENT_NOT_SAFE_FOR_VALUE");
  });

  it("blocks new BAB/task suggestions and invalid values in strict mode", () => {
    const freeAnalysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 2 - Proyek", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90, "#N/A"],
      ],
    }));
    const plan = buildImportPlan(freeAnalysis, { students, chapters, assignments });

    expect(plan.structureSuggestions[0]).toMatchObject({ type: "create_chapter_and_assignment" });
    expect(plan.conflicts.map((item) => item.code)).toEqual(
      expect.arrayContaining(["IMPORT_NEW_STRUCTURE_NOT_CONFIRMED", "IMPORT_INVALID_VALUE_STRICT"]),
    );
    expect(plan.summary.invalidValueCount).toBeGreaterThan(0);
  });
});

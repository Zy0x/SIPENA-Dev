import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  analyzeFreeExcelWorkbook,
  analyzeOfficialTemplateWorkbook,
  buildExecutableImportOperations,
  buildImportPlan,
  buildOfficialGradeTemplateWorkbook,
  parseGradeValue,
  readWorkbookBuffer,
  type ImportPlanContext,
  type OfficialGradeTemplateContext,
} from "./index";

const students = [
  { id: "student-1", name: "Siti Aminah", nisn: "0012345678" },
  { id: "student-2", name: "Muhammad Rizki", nisn: "1234567890" },
];

const chapters = [{ id: "chapter-1", name: "BAB 1", order_index: 1 }];
const assignments = [{ id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1", order_index: 1 }];

const templateContext: OfficialGradeTemplateContext = {
  classId: "class-1",
  className: "Kelas 7A",
  subjectId: "subject-1",
  subjectName: "Matematika",
  semesterId: "semester-1",
  semesterName: "Semester 1",
  academicYearId: "year-1",
  students,
  chapters,
  assignments,
};

const importContext: ImportPlanContext = { students, chapters, assignments };

function readWorkbook(workbook: XLSX.WorkBook, fileName = "nilai.xlsx") {
  const buffer = XLSX.write(workbook, { bookType: fileName.endsWith(".csv") ? "csv" : "xlsx", type: "array" }) as ArrayBuffer;
  return readWorkbookBuffer(buffer, fileName);
}

function workbookResult(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return readWorkbook(workbook);
}

function officialWorkbookWithValue(value: unknown = 88) {
  const workbook = buildOfficialGradeTemplateWorkbook(templateContext);
  workbook.Sheets.Isi_Nilai.D2 = typeof value === "number"
    ? { t: "n", v: value }
    : { t: "s", v: String(value) };
  return workbook;
}

describe("official template import safety regression", () => {
  it("builds a ready plan from an exact official template", () => {
    const analysis = analyzeOfficialTemplateWorkbook(readWorkbook(officialWorkbookWithValue()), templateContext);
    const plan = buildImportPlan(analysis, importContext);
    const executable = buildExecutableImportOperations({ plan });

    expect(analysis.sourceType).toBe("official_exact");
    expect(plan.summary.readyImportCount).toBe(1);
    expect(plan.summary.blockedOperations).toBe(0);
    expect(executable.summary.executableCount).toBe(1);
  });

  it.each([
    ["class", { classId: "class-lain" }, "File ini dibuat untuk kelas lain."],
    ["subject", { subjectId: "subject-lain" }, "File ini dibuat untuk mata pelajaran lain."],
    ["semester", { semesterId: "semester-lain" }, "File ini dibuat untuk semester lain."],
    ["academic year", { academicYearId: "year-lain" }, "File ini dibuat untuk tahun ajaran lain."],
  ])("blocks official template context mismatch for %s", (_label, override, message) => {
    const analysis = analyzeOfficialTemplateWorkbook(readWorkbook(officialWorkbookWithValue()), {
      ...templateContext,
      ...override,
    });
    const plan = buildImportPlan(analysis, importContext);
    const executable = buildExecutableImportOperations({ plan });

    expect(analysis.sourceType).toBe("official_modified");
    expect(analysis.warnings.map((item) => item.message)).toContain(message);
    expect(plan.conflicts).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "IMPORT_CONTEXT_MISMATCH_BLOCKED", severity: "blocked", message }),
    ]));
    expect(executable.summary.executableCount).toBe(0);
  });

  it("warns when an official header changes and never imports a changed-context template silently", () => {
    const workbook = officialWorkbookWithValue();
    workbook.Sheets.Isi_Nilai.D1 = { t: "s", v: "Header Diubah" };

    const changedHeader = analyzeOfficialTemplateWorkbook(readWorkbook(workbook), templateContext);
    const otherSubject = analyzeOfficialTemplateWorkbook(readWorkbook(officialWorkbookWithValue()), {
      ...templateContext,
      subjectId: "subject-lain",
    });
    const otherSemester = analyzeOfficialTemplateWorkbook(readWorkbook(officialWorkbookWithValue()), {
      ...templateContext,
      semesterId: "semester-lain",
    });

    expect(changedHeader.sourceType).toBe("official_modified");
    expect(changedHeader.warnings.map((item) => item.code)).toContain("IMPORT_HEADER_CHANGED");
    expect(buildImportPlan(otherSubject, importContext).summary.readyImportCount).toBe(0);
    expect(buildImportPlan(otherSemester, importContext).summary.readyImportCount).toBe(0);
  });
});

describe("free Excel import safety regression", () => {
  it("selects the best table across sheets without requiring selection when there is only one valid table", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Catatan: [["Daftar catatan"], ["Tidak ada nilai"]],
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90],
        [2, "1234567890", "Muhammad Rizki", 88],
      ],
    }), { students });

    expect(analysis.sourceType).toBe("free_structured");
    expect(analysis.regions).toHaveLength(1);
    expect(analysis.requiresRegionSelection).toBe(false);
    expect(analysis.bestRegion?.sheetName).toBe("Nilai");
  });

  it("detects merged-like multi-row headers and keeps grade columns readable", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["Data Siswa", "", "", "BAB 1", "BAB 1"],
        ["No", "NISN", "Nama Siswa", "Tugas 1", ""],
        [1, "0012345678", "Siti Aminah", 80, 81],
      ],
    }), { students });

    expect(analysis.bestRegion?.headerRowCount).toBe(2);
    expect(analysis.warnings.map((item) => item.code)).toEqual(expect.arrayContaining([
      "FREE_EXCEL_MULTI_ROW_HEADER_DETECTED",
      "FREE_EXCEL_MERGED_CELLS_LIMITED",
    ]));
  });

  it("treats a workbook without a clear grade table as free_unstructured", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Catatan: [["Ini bukan tabel nilai"], ["Hanya catatan guru"]],
    }), { students });

    expect(analysis.sourceType).toBe("free_unstructured");
    expect(analysis.regions).toHaveLength(0);
    expect(buildImportPlan(analysis, importContext).summary.readyImportCount).toBe(0);
  });
});

describe("import plan fail-closed regression", () => {
  it("blocks ambiguous students, unresolved columns, and create-structure columns before execution", () => {
    const ambiguousPlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "Siti Amin", 90],
      ],
    })), {
      students: [
        { id: "student-a", name: "Siti Amina", nisn: "1" },
        { id: "student-b", name: "Siti Amino", nisn: "2" },
      ],
      chapters,
      assignments,
    });
    const duplicateTargetPlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1", "BAB I - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 90, 91],
      ],
    }), { students }), importContext);
    const createStructurePlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 2 - Proyek"],
        [1, "0012345678", "Siti Aminah", 90],
      ],
    }), { students }), importContext);

    expect(ambiguousPlan.gradeOperations[0]?.action).toMatch(/blocked|needs_confirmation/);
    expect(buildExecutableImportOperations({ plan: ambiguousPlan }).summary.executableCount).toBe(0);
    expect(duplicateTargetPlan.conflicts.map((item) => item.code)).toContain("IMPORT_DUPLICATE_COLUMN_TARGET");
    expect(buildExecutableImportOperations({ plan: duplicateTargetPlan }).summary.executableCount).toBe(0);
    expect(createStructurePlan.structureSuggestions[0]?.type).toBe("create_chapter_and_assignment");
    expect(createStructurePlan.summary.readyImportCount).toBe(0);
    expect(buildExecutableImportOperations({ plan: createStructurePlan }).summary.executableCount).toBe(0);
  });

  it("keeps skipped and invalid value counts separate from ready operations", () => {
    const plan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", ""],
        [2, "1234567890", "Muhammad Rizki", "Tuntas"],
      ],
    }), { students }), importContext);

    expect(plan.summary.readyImportCount).toBe(0);
    expect(plan.summary.skippedValueCount).toBe(1);
    expect(plan.summary.invalidValueCount).toBe(1);
    expect(plan.gradeOperations.map((operation) => operation.action)).toEqual(["skip_empty", "blocked"]);
  });

  it("allows resolver choices only when student, column, and value are all safe", () => {
    const missingStudentPlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "9999999999", "Siswa File Lain", 90],
      ],
    }), { students }), importContext);
    const invalidValuePlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "9999999999", "Siswa File Lain", 101],
      ],
    }), { students }), importContext);
    const fractionPlan = buildImportPlan(analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", "8/10"],
      ],
    }), { students }), importContext);

    expect(buildExecutableImportOperations({
      plan: missingStudentPlan,
      resolverState: { studentOverrides: { 2: "student-1" } },
    }).summary.executableCount).toBe(1);
    expect(buildExecutableImportOperations({
      plan: invalidValuePlan,
      resolverState: { studentOverrides: { 2: "student-1" } },
    }).summary.executableCount).toBe(0);
    expect(buildExecutableImportOperations({
      plan: missingStudentPlan,
      resolverState: { ignoredRows: [2] },
    }).summary.skippedManualCount).toBe(1);
    expect(buildExecutableImportOperations({
      plan: missingStudentPlan,
      resolverState: { ignoredColumns: [4] },
    }).summary.skippedManualCount).toBe(1);
    expect(buildExecutableImportOperations({ plan: fractionPlan }).summary.executableCount).toBe(0);
    expect(buildExecutableImportOperations({
      plan: fractionPlan,
      selectionState: {
        columnSettings: {},
        cellSettings: {
          "row-2:excel-col-4": {
            cellId: "row-2:excel-col-4",
            rowId: "row-2",
            columnId: "excel-col-4",
            include: true,
            valueMode: "inherit_column",
            acceptedSuggestedValue: true,
            resolvedValue: 80,
          },
        },
      },
    }).summary.executableCount).toBe(1);
  });

  it("matches existing grades only inside the active semester and academic year scope", () => {
    const analysis = analyzeFreeExcelWorkbook(workbookResult({
      Nilai: [
        ["No", "NISN", "Nama Siswa", "BAB 1 - Tugas 1"],
        [1, "0012345678", "Siti Aminah", 80],
      ],
    }), { students });
    const scopedContext: ImportPlanContext = {
      ...importContext,
      semesterId: "semester-1",
      academicYearId: "year-1",
    };

    const legacyExisting = buildImportPlan(analysis, {
      ...scopedContext,
      existingGrades: [{ student_id: "student-1", grade_type: "assignment", assignment_id: "assignment-1", value: 80, semester_id: null, academic_year_id: null }],
    });
    const activeExisting = buildImportPlan(analysis, {
      ...scopedContext,
      existingGrades: [{ student_id: "student-1", grade_type: "assignment", assignment_id: "assignment-1", value: 80, semester_id: "semester-1", academic_year_id: "year-1" }],
    });

    expect(legacyExisting.gradeOperations[0]?.action).toBe("fill_empty");
    expect(activeExisting.gradeOperations[0]?.action).toBe("skip_existing");
  });

  it.each([
    ["", "empty"],
    ["   ", "empty"],
    ["-", "empty"],
    ["N/A", "empty"],
    ["NA", "empty"],
    ["belum dinilai", "empty"],
    ["Tuntas", "textual"],
    ["Remedial", "textual"],
    ["A", "textual"],
    ["101", "invalid"],
    ["-1", "invalid"],
    ["#VALUE!", "invalid"],
    ["#DIV/0!", "invalid"],
  ])("keeps value parser status for %s as %s", (raw, status) => {
    const parsed = parseGradeValue(raw);

    expect(parsed.status).toBe(status);
    if (status !== "valid") expect(parsed.value).toBeNull();
  });
});

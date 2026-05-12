import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

import {
  analyzeOfficialTemplateWorkbook,
  buildExecutableImportOperations,
  buildImportPlan,
  buildOfficialGradeTemplateWorkbook,
  parseGradeHeader,
  parseGradeValue,
  readWorkbookBuffer,
  type ImportPlanContext,
  type OfficialGradeTemplateContext,
} from "@/lib/gradeImport";

import { resolveImportDecisionGraphWithAi } from "./aiResolutionAgent";
import { buildFinalReviewModel } from "./finalReviewBuilder";
import { buildImportDecisionGraph } from "./importDecisionGraph";
import { buildFinalImportPayload } from "./importExecutor";
import { detectGradeImportSource } from "./sourceDetector";

const students = [
  { id: "student-1", name: "Siti Aminah", nisn: "0012345678" },
  { id: "student-2", name: "Muhammad Rizki", nisn: "1234567890" },
];
const chapters = [{ id: "chapter-1", name: "BAB 1", order_index: 1 }];
const assignments = [{ id: "assignment-1", chapter_id: "chapter-1", name: "UH 1", order_index: 1 }];

const templateContext: OfficialGradeTemplateContext = {
  classId: "class-1",
  className: "Kelas 7A",
  subjectId: "subject-1",
  subjectName: "Matematika",
  semesterId: "semester-1",
  semesterName: "Semester 1",
  academicYearId: "year-1",
  generatedBy: "tester",
  students,
  chapters,
  assignments,
  generatedAt: "2026-05-12T00:00:00.000Z",
};

const importContext: ImportPlanContext = {
  students,
  chapters,
  assignments,
  classId: "class-1",
  subjectId: "subject-1",
  semesterId: "semester-1",
  academicYearId: "year-1",
};

function readWorkbook(workbook: XLSX.WorkBook) {
  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" }) as ArrayBuffer;
  return readWorkbookBuffer(buffer, "nilai.xlsx");
}

function officialWorkbookWithValue(value: unknown = 88) {
  const workbook = buildOfficialGradeTemplateWorkbook(templateContext);
  workbook.Sheets.Isi_Nilai.D2 = typeof value === "number"
    ? { t: "n", v: value }
    : { t: "s", v: String(value) };
  return workbook;
}

describe("grade import agent official golden path", () => {
  it("exports the complete SIPENA v2 official template contract", () => {
    const workbook = buildOfficialGradeTemplateWorkbook(templateContext);
    expect(workbook.SheetNames).toEqual([
      "Panduan",
      "Isi_Nilai",
      "_manifest",
      "_students",
      "_structure",
      "_column_map",
      "_rules",
      "_examples",
    ]);

    const studentsRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets._students);
    const structureRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets._structure);
    const columnRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets._column_map);

    expect(studentsRows[0]).toEqual(expect.objectContaining({
      student_id: "student-1",
      nisn: "0012345678",
      name: "Siti Aminah",
      row_number: 2,
    }));
    expect(structureRows[0]).toEqual(expect.objectContaining({
      chapter_id: "chapter-1",
      chapter_order: 1,
      assignment_id: "assignment-1",
      assignment_order: 1,
      grade_type: "assignment",
    }));
    expect(columnRows[0]).toEqual(expect.objectContaining({
      column_index: 4,
      grade_type: "assignment",
      target_key: "assignment:assignment-1",
      locked: "true",
    }));
  });

  it("routes a valid official template straight to final review without AI or manual mapping", () => {
    const workbook = readWorkbook(officialWorkbookWithValue(90));
    const detected = detectGradeImportSource(workbook, importContext);
    const analysis = analyzeOfficialTemplateWorkbook(workbook, importContext);
    const plan = buildImportPlan(analysis, importContext);
    const executable = buildExecutableImportOperations({ plan });
    const graph = buildImportDecisionGraph(plan, executable);
    const review = buildFinalReviewModel(graph);

    expect(detected.route).toBe("official");
    expect(detected.aiAllowed).toBe(false);
    expect(analysis.sourceType).toBe("official_exact");
    expect(plan.studentMappings.every((mapping) => mapping.matchedBy === "student_id")).toBe(true);
    expect(plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved).every((mapping) => mapping.target?.assignmentId === "assignment-1" || mapping.target?.gradeType === "sts" || mapping.target?.gradeType === "sas")).toBe(true);
    expect(graph.officialGoldenPath).toBe(true);
    expect(graph.aiAllowed).toBe(false);
    expect(review.summary.save).toBe(1);
    expect(review.canExecute).toBe(true);
  });

  it("keeps official metadata as target when visible header changes", () => {
    const workbook = officialWorkbookWithValue(90);
    workbook.Sheets.Isi_Nilai.D1 = { t: "s", v: "Header Diganti Guru" };
    const analysis = analyzeOfficialTemplateWorkbook(readWorkbook(workbook), importContext);
    const plan = buildImportPlan(analysis, importContext);

    expect(analysis.sourceType).toBe("official_modified");
    expect(plan.columnMappings.find((mapping) => mapping.columnIndex === 4)?.target?.assignmentId).toBe("assignment-1");
    expect(plan.columnMappings.find((mapping) => mapping.columnIndex === 4)?.status).toBe("warning");
  });

  it("downgrades tampered official metadata and does not trust it as exact", () => {
    const workbook = officialWorkbookWithValue(90);
    workbook.Sheets._column_map.B2 = { t: "s", v: "Kolom Diubah" };
    const analysis = analyzeOfficialTemplateWorkbook(readWorkbook(workbook), importContext);

    expect(analysis.sourceType).toBe("official_damaged");
    expect(analysis.warnings.map((warning) => warning.code)).toContain("IMPORT_COLUMNS_HASH_MISMATCH");
  });
});

describe("grade import agent decisions", () => {
  it("recognizes header aliases and keeps unclear remedial headers out of executor", () => {
    expect(parseGradeHeader("PTS").target?.gradeType).toBe("sts");
    expect(parseGradeHeader("UAS").target?.gradeType).toBe("sas");
    expect(parseGradeHeader("UH 1").target?.assignmentName).toBe("UH 1");
    expect(parseGradeHeader("Remedial A").warnings.map((warning) => warning.code)).toContain("HEADER_REMEDIAL_NEEDS_TARGET");
  });

  it("classifies conversion and invalid value cases for final decisions", () => {
    expect(parseGradeValue("90%").value).toBe(90);
    expect(parseGradeValue("90/100").value).toBe(90);
    expect(parseGradeValue("7/10").suggestedValue).toBe(70);
    expect(parseGradeValue("87,5").value).toBe(87.5);
    expect(parseGradeValue("Tuntas").status).toBe("textual");
    expect(parseGradeValue("#VALUE!").status).toBe("invalid");
    expect(parseGradeValue(120).status).toBe("invalid");
  });

  it("AI handle-all resolves unclear items to safe skip instead of leaving blocked", () => {
    const workbook = officialWorkbookWithValue("Tuntas");
    const plan = buildImportPlan(analyzeOfficialTemplateWorkbook(readWorkbook(workbook), importContext), importContext);
    const graph = buildImportDecisionGraph(plan, buildExecutableImportOperations({ plan }));
    const resolved = resolveImportDecisionGraphWithAi({ ...graph, officialGoldenPath: false, aiAllowed: true }, {
      suggestions: [],
      summary: {
        confidence: 0,
        riskLevel: "high",
        notes: ["manual fallback"],
      },
    }, { mode: "aggressive", handleAll: true });

    expect(resolved.summary.blocked).toBe(0);
    expect(resolved.summary.skip).toBeGreaterThan(0);
  });

  it("executor accepts only final executable decisions", () => {
    const plan = buildImportPlan(analyzeOfficialTemplateWorkbook(readWorkbook(officialWorkbookWithValue(90)), importContext), importContext);
    const graph = buildImportDecisionGraph(plan, buildExecutableImportOperations({ plan }));
    const payload = buildFinalImportPayload(graph);

    expect(payload).toEqual([expect.objectContaining({
      studentId: "student-1",
      gradeType: "assignment",
      assignmentId: "assignment-1",
      value: 90,
    })]);
  });
});

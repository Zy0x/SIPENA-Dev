import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/core/repositories/supabase-compat.repository", () => ({
  supabaseExternal: {},
}));

import {
  gradeRpcErrorMessage,
  mapBulkGradesToRpcItems,
  parseBatchUpsertResult,
} from "./useGrades";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

describe("grade batch import helpers", () => {
  it("returns a migration message when the batch RPC is missing", () => {
    expect(gradeRpcErrorMessage({
      code: "PGRST202",
      message: "Could not find the function public.import_grades_batch(p_items)",
    })).toContain("migration terbaru");
  });

  it("returns a human message for duplicate grade rows", () => {
    expect(gradeRpcErrorMessage({
      code: "P0001",
      message: "Data nilai duplikat ditemukan. Perlu perbaikan database sebelum menyimpan.",
    })).toContain("Data nilai duplikat");
  });

  it("maps unique constraint errors to the duplicate repair message", () => {
    expect(gradeRpcErrorMessage({
      code: "23505",
      message: "duplicate key value violates unique constraint \"grades_unique_owner_scope\"",
    })).toContain("Data nilai duplikat");
  });

  it("returns a human message for invalid ownership or context errors", () => {
    expect(gradeRpcErrorMessage({
      code: "42501",
      message: "Siswa pada item ke-1 tidak valid untuk mata pelajaran ini.",
    })).toContain("kelas, mapel, siswa");
  });

  it("parses a valid batch upsert result", () => {
    expect(parseBatchUpsertResult({
      savedCount: 2,
      skippedUnchangedCount: 1,
      changedRows: [
        {
          gradeId: "grade-1",
          studentId: "student-1",
          subjectId: "subject-1",
          assignmentId: "assignment-1",
          academicYearId: "year-1",
          semesterId: "semester-1",
          gradeType: "assignment",
          oldValue: 75,
          newValue: 85,
        },
      ],
    })).toEqual({
      savedCount: 2,
      skippedUnchangedCount: 1,
      changedRows: [
        {
          gradeId: "grade-1",
          studentId: "student-1",
          subjectId: "subject-1",
          assignmentId: "assignment-1",
          academicYearId: "year-1",
          semesterId: "semester-1",
          gradeType: "assignment",
          oldValue: 75,
          newValue: 85,
        },
      ],
    });
  });

  it("ignores invalid changedRows instead of trusting malformed RPC data", () => {
    const result = parseBatchUpsertResult({
      savedCount: "not-a-number",
      skippedUnchangedCount: -1,
      changedRows: [
        { studentId: "student-1", subjectId: "subject-1", gradeType: "other", newValue: 90 },
        { studentId: "student-2", subjectId: "subject-1", gradeType: "sts", newValue: 101 },
        { studentId: "student-3", subjectId: "subject-1", gradeType: "sas", newValue: 88 },
      ],
    });

    expect(result.savedCount).toBe(0);
    expect(result.skippedUnchangedCount).toBe(0);
    expect(result.changedRows).toEqual([
      {
        gradeId: undefined,
        studentId: "student-3",
        subjectId: "subject-1",
        assignmentId: null,
        academicYearId: null,
        semesterId: null,
        gradeType: "sas",
        oldValue: null,
        newValue: 88,
      },
    ]);
  });

  it("maps batch inputs with null assignment handling and active context fallback", () => {
    expect(mapBulkGradesToRpcItems([
      {
        student_id: "student-1",
        subject_id: "subject-1",
        assignment_id: "",
        grade_type: "sts",
        value: 80,
      },
      {
        student_id: "student-2",
        subject_id: "subject-1",
        assignment_id: "assignment-1",
        academic_year_id: "input-year",
        semester_id: "input-semester",
        grade_type: "assignment",
        value: null,
      },
    ], "active-year", "active-semester")).toEqual([
      {
        studentId: "student-1",
        subjectId: "subject-1",
        assignmentId: null,
        academicYearId: "active-year",
        semesterId: "active-semester",
        gradeType: "sts",
        value: 80,
      },
      {
        studentId: "student-2",
        subjectId: "subject-1",
        assignmentId: "assignment-1",
        academicYearId: "input-year",
        semesterId: "input-semester",
        gradeType: "assignment",
        value: null,
      },
    ]);
  });

  it("keeps empty batch input as an empty RPC payload", () => {
    expect(mapBulkGradesToRpcItems([], "active-year", "active-semester")).toEqual([]);
  });

  it("keeps single-cell saves on the atomic batch RPC path", () => {
    const source = readFileSync(repoPath("apps/frontend/src/hooks/useGrades.ts"), "utf8");
    const upsertSection = source.slice(
      source.indexOf("const upsertGrade = useMutation"),
      source.indexOf("const upsertGradesBatch = useMutation"),
    );

    expect(upsertSection).toContain('rpc("import_grades_batch"');
    expect(upsertSection).toContain("gradeRpcErrorMessage");
    expect(upsertSection).not.toContain('.from("grades")');
    expect(upsertSection).not.toContain(".insert({");
  });
});

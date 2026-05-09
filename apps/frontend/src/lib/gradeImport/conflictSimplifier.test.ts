import { describe, expect, it } from "vitest";

import { parseGradeHeader, simplifyImportConflicts, type ColumnMapping, type ImportPlan, type StudentMapping } from "./index";

function studentMapping(overrides: Partial<StudentMapping> = {}): StudentMapping {
  return {
    rowIndex: 2,
    excelName: "Ahmad",
    excelNisn: "001",
    studentId: "student-1",
    webName: "Ahmad",
    webNisn: "001",
    matchedBy: "student_id",
    confidence: 100,
    status: "safe",
    warnings: [],
    conflicts: [],
    ...overrides,
  };
}

function columnMapping(header: string, overrides: Partial<ColumnMapping> = {}): ColumnMapping {
  const parsedHeader = parseGradeHeader(header);
  return {
    columnIndex: 4,
    rawHeader: header,
    parsedHeader,
    target: parsedHeader.target,
    confidence: parsedHeader.confidence,
    status: "safe",
    warnings: [],
    conflicts: [],
    ...overrides,
  };
}

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    sourceType: "official_exact",
    updateMode: "fill_empty_only",
    studentMappings: [studentMapping()],
    missingInExcelStudents: [],
    columnMappings: [columnMapping("BAB 1 - Tugas 1", {
      target: {
        gradeType: "assignment",
        chapterId: "chapter-1",
        chapterName: "BAB 1",
        assignmentId: "assignment-1",
        assignmentName: "Tugas 1",
      },
    })],
    structureSuggestions: [],
    gradeOperations: [],
    warnings: [],
    conflicts: [],
    summary: {
      totalRows: 1,
      matchedStudents: 1,
      mappedColumns: 1,
      safeOperations: 0,
      blockedOperations: 0,
      needsConfirmation: 0,
    },
    ...overrides,
  };
}

describe("gradeImport conflict simplifier", () => {
  it("groups derived columns as auto fixable", () => {
    const result = simplifyImportConflicts({
      plan: plan({ columnMappings: [columnMapping("Rapor")] }),
    });

    expect(result.autoFixableCount).toBeGreaterThan(0);
    expect(result.groups[0].items.some((item) => item.title.includes("Rapor"))).toBe(true);
    expect(result.isReadyForPreview).toBe(true);
  });

  it("groups STS and SAS aliases as auto fixable", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        columnMappings: [
          columnMapping("UTS", { target: { gradeType: "sts" } }),
          columnMapping("PAS", { columnIndex: 5, target: { gradeType: "sas" } }),
        ],
      }),
    });

    expect(result.groups[0].items.some((item) => item.title.includes("UTS"))).toBe(true);
    expect(result.groups[0].items.some((item) => item.title.includes("PAS"))).toBe(true);
  });

  it("uses web student data when student_id matches but name changed", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        studentMappings: [studentMapping({
          status: "warning",
          excelName: "Ahmad Lama",
          warnings: [{ code: "STUDENT_ID_NAME_CHANGED", severity: "warning", message: "Nama berubah.", rowIndex: 2 }],
        })],
        warnings: [{ code: "STUDENT_ID_NAME_CHANGED", severity: "warning", message: "Nama berubah.", rowIndex: 2 }],
      }),
    });

    expect(result.groups[0].items.some((item) => item.recommendedActionLabel === "Gunakan data siswa dari web")).toBe(true);
  });

  it("treats students missing in web as safe row skips", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        studentMappings: [studentMapping({
          rowIndex: 3,
          studentId: undefined,
          webName: undefined,
          webNisn: undefined,
          excelName: "Siswa Dari File Lain",
          excelNisn: "999",
          matchedBy: "manual",
          status: "missing_in_web",
          warnings: [{ code: "STUDENT_MISSING_IN_WEB", severity: "warning", message: "Tidak ada di web.", rowIndex: 3 }],
        })],
        warnings: [{ code: "STUDENT_MISSING_IN_WEB", severity: "warning", message: "Tidak ada di web.", rowIndex: 3 }],
      }),
    });

    expect(result.manualRequiredCount).toBe(0);
    expect(result.groups[0].items.some((item) => item.recommendedActionLabel === "Lewati baris ini")).toBe(true);
    expect(result.isReadyForPreview).toBe(true);
  });

  it("groups explicit new assignment suggestion as needs confirmation", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        columnMappings: [columnMapping("BAB 1 - Tugas 2", {
          status: "needs_confirmation",
          target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas 2" },
        })],
        warnings: [{
          code: "COLUMN_CREATE_ASSIGNMENT_SUGGESTED",
          severity: "warning",
          message: "Tugas baru perlu konfirmasi.",
          columnIndex: 4,
        }],
      }),
    });

    expect(result.needsConfirmationCount).toBe(1);
    expect(result.headline).toBe("Hampir siap diimport");
  });

  it("groups task without BAB across many BAB as manual required", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        conflicts: [{
          code: "COLUMN_ASSIGNMENT_AMBIGUOUS",
          severity: "blocked",
          type: "column",
          message: "Tugas cocok ke banyak BAB.",
          columnIndex: 4,
          options: ["BAB 1 - Tugas 1", "BAB 2 - Tugas 1"],
        }],
      }),
    });

    expect(result.manualRequiredCount).toBe(1);
    expect(result.groups[2].items[0].title).toContain("BAB");
  });

  it("groups duplicate target as manual required", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        conflicts: [{
          code: "IMPORT_DUPLICATE_COLUMN_TARGET",
          severity: "blocked",
          type: "column",
          message: "Target dobel.",
          columnIndex: 4,
          options: ["BAB 1 - Tugas 1", "BAB 1 - Tugas 1 Copy"],
        }],
      }),
    });

    expect(result.manualRequiredCount).toBe(1);
    expect(result.groups[2].items[0].title).toBe("Ada 2 kolom menuju tugas yang sama");
  });

  it("groups context mismatch as manual required", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        conflicts: [{
          code: "IMPORT_CONTEXT_MISMATCH_BLOCKED",
          severity: "blocked",
          type: "context",
          message: "Mapel berbeda.",
        }],
      }),
    });

    expect(result.manualRequiredCount).toBe(1);
    expect(result.groups[2].items[0].title).toBe("File berbeda kelas/mapel/semester");
  });

  it("groups invalid values as manual required", () => {
    const result = simplifyImportConflicts({
      plan: plan({
        conflicts: [{
          code: "IMPORT_INVALID_VALUE_STRICT",
          severity: "blocked",
          type: "grade_value",
          message: "Nilai invalid.",
          rowIndex: 2,
          columnIndex: 4,
        }],
      }),
    });

    expect(result.manualRequiredCount).toBe(1);
    expect(result.groups[2].items[0].title).toBe("Nilai tidak valid");
  });

  it("marks ready when there is no blocking item", () => {
    const result = simplifyImportConflicts({ plan: plan() });

    expect(result.blockingCount).toBe(0);
    expect(result.isReadyForPreview).toBe(true);
    expect(result.headline).toBe("Siap diimport");
  });
});

import { describe, expect, it } from "vitest";

import {
  buildSpreadsheetPreviewModel,
  parseGradeHeader,
  type ColumnMapping,
  type GradeOperation,
  type ImportPlan,
  type StudentMapping,
} from "./index";

function student(overrides: Partial<StudentMapping> = {}): StudentMapping {
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

function column(header: string, overrides: Partial<ColumnMapping> = {}): ColumnMapping {
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

function operation(overrides: Partial<GradeOperation> = {}): GradeOperation {
  return {
    id: "op-1",
    rowIndex: 2,
    columnIndex: 4,
    studentId: "student-1",
    target: {
      gradeType: "assignment",
      chapterId: "chapter-1",
      chapterName: "BAB 1",
      assignmentId: "assignment-1",
      assignmentName: "Tugas 1",
    },
    value: 80,
    existingValue: null,
    updateMode: "fill_empty_only",
    action: "fill_empty",
    warnings: [],
    conflicts: [],
    ...overrides,
  };
}

function plan(overrides: Partial<ImportPlan> = {}): ImportPlan {
  return {
    sourceType: "official_exact",
    updateMode: "fill_empty_only",
    studentMappings: [student()],
    columnMappings: [column("BAB 1 - Tugas 1", {
      target: {
        gradeType: "assignment",
        chapterId: "chapter-1",
        chapterName: "BAB 1",
        assignmentId: "assignment-1",
        assignmentName: "Tugas 1",
      },
    })],
    structureSuggestions: [],
    gradeOperations: [operation()],
    warnings: [],
    conflicts: [],
    summary: {
      totalRows: 1,
      matchedStudents: 1,
      mappedColumns: 1,
      safeOperations: 1,
      blockedOperations: 0,
      needsConfirmation: 0,
    },
    ...overrides,
  };
}

function firstGradeCell(model: ReturnType<typeof buildSpreadsheetPreviewModel>) {
  return model.rows[0].cells.find((cell) => cell.columnId === "excel-col-4");
}

describe("spreadsheet preview builder", () => {
  it("marks explicit new assignment columns as new_column", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        columnMappings: [column("BAB 1 - Tugas 2", {
          status: "needs_confirmation",
          target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas 2" },
          warnings: [{ code: "COLUMN_CREATE_ASSIGNMENT_SUGGESTED", severity: "warning", message: "Tugas baru.", columnIndex: 4 }],
        })],
      }),
    });

    expect(model.columns.find((item) => item.id === "excel-col-4")?.status).toBe("new_column");
    expect(model.summary.newColumns).toBe(1);
  });

  it("marks changed cells when overwrite mode would replace old value", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        updateMode: "overwrite_existing",
        gradeOperations: [operation({ existingValue: 70, value: 85, updateMode: "overwrite_existing", action: "overwrite" })],
      }),
      updateMode: "overwrite_existing",
    });

    expect(firstGradeCell(model)?.status).toBe("changed");
    expect(model.summary.changedCells).toBe(1);
  });

  it("marks empty existing value filled from Excel as new_value", () => {
    const model = buildSpreadsheetPreviewModel({ plan: plan() });

    expect(firstGradeCell(model)?.status).toBe("new_value");
    expect(model.summary.newValueCells).toBe(1);
  });

  it("marks ambiguous student rows as manual_required", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        studentMappings: [student({
          status: "ambiguous",
          conflicts: [{ code: "STUDENT_MATCH_AMBIGUOUS", severity: "blocked", type: "student", message: "Siswa ambigu.", rowIndex: 2 }],
        })],
      }),
    });

    expect(model.rows[0].status).toBe("manual_required");
    expect(model.summary.manualRequired).toBeGreaterThan(0);
  });

  it("marks invalid values as invalid", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        gradeOperations: [operation({
          value: null,
          action: "blocked",
          conflicts: [{ code: "IMPORT_INVALID_VALUE_STRICT", severity: "blocked", type: "grade_value", message: "Invalid.", rowIndex: 2, columnIndex: 4 }],
        })],
      }),
    });

    expect(firstGradeCell(model)?.status).toBe("invalid");
    expect(model.summary.invalidCells).toBe(1);
  });

  it("marks derived columns as ignored", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        columnMappings: [column("Rapor")],
        gradeOperations: [],
      }),
    });

    expect(model.columns.find((item) => item.id === "excel-col-4")?.status).toBe("ignored");
    expect(firstGradeCell(model)?.status).toBe("ignored");
  });

  it("counts preview summary values", () => {
    const model = buildSpreadsheetPreviewModel({
      plan: plan({
        columnMappings: [
          column("BAB 1 - Tugas 1", {
            target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentId: "assignment-1", assignmentName: "Tugas 1" },
          }),
          column("Rapor", { columnIndex: 5 }),
        ],
        gradeOperations: [operation()],
      }),
    });

    expect(model.summary.totalRows).toBe(1);
    expect(model.summary.totalColumns).toBe(5);
    expect(model.summary.newValueCells).toBe(1);
    expect(model.summary.ignoredCells).toBeGreaterThan(0);
  });
});

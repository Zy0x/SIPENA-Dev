import { describe, expect, it } from "vitest";

import {
  buildExecutableImportOperations,
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
    target: {
      gradeType: "assignment",
      chapterId: "chapter-1",
      chapterName: "BAB 1",
      assignmentId: "assignment-1",
      assignmentName: "Tugas 1",
    },
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
    missingInExcelStudents: [],
    columnMappings: [column("BAB 1 - Tugas 1")],
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

describe("executable import builder", () => {
  it("auto-skips values that are already the same in SIPENA", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        updateMode: "overwrite_existing",
        gradeOperations: [operation({ existingValue: 80, value: 80, updateMode: "overwrite_existing", action: "overwrite" })],
      }),
      updateMode: "overwrite_existing",
      selectionState: {
        columnSettings: {
          "excel-col-4": { columnId: "excel-col-4", columnIndex: 4, include: true, valueMode: "overwrite_existing", overwriteConfirmed: true },
        },
        cellSettings: {},
      },
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.skippedExistingCount).toBe(1);
    expect(result.skippedItems[0]?.message).toContain("sama");
  });

  it("skips every operation in a skipped column", () => {
    const result = buildExecutableImportOperations({
      plan: plan(),
      selectionState: {
        columnSettings: {
          "excel-col-4": { columnId: "excel-col-4", columnIndex: 4, include: false, valueMode: "fill_empty_only" },
        },
        cellSettings: {},
      },
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.skippedManualCount).toBe(1);
  });

  it("honors ignoredColumns and ignore column overrides", () => {
    const ignoredColumn = buildExecutableImportOperations({
      plan: plan(),
      resolverState: { ignoredColumns: [4] },
    });
    const ignoredByOverride = buildExecutableImportOperations({
      plan: plan(),
      resolverState: { columnOverrides: { 4: { kind: "ignore" } } },
    });

    expect(ignoredColumn.summary.skippedManualCount).toBe(1);
    expect(ignoredByOverride.summary.skippedManualCount).toBe(1);
  });

  it("skips a manually skipped cell", () => {
    const result = buildExecutableImportOperations({
      plan: plan(),
      selectionState: {
        columnSettings: {},
        cellSettings: {
          "row-2:excel-col-4": {
            cellId: "row-2:excel-col-4",
            rowId: "row-2",
            columnId: "excel-col-4",
            include: false,
            valueMode: "inherit_column",
          },
        },
      },
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.skippedItems[0]?.reason).toBe("manual_skip");
  });

  it("skips all cells in ignored rows", () => {
    const result = buildExecutableImportOperations({
      plan: plan(),
      resolverState: { ignoredRows: [2] },
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.skippedManualCount).toBe(1);
  });

  it("treats explicit manual skip actions as manual skips, not existing-value skips", () => {
    const skippedRow = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ action: "manual_skip_row" })] }),
    });
    const skippedColumn = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ action: "manual_skip_column" })] }),
    });
    const skippedCell = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ action: "manual_skip_cell" })] }),
    });

    expect(skippedRow.summary.skippedManualCount).toBe(1);
    expect(skippedRow.summary.skippedExistingCount).toBe(0);
    expect(skippedColumn.summary.skippedManualCount).toBe(1);
    expect(skippedCell.summary.skippedManualCount).toBe(1);
  });

  it("skips existing values in fill_empty_only mode", () => {
    const result = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ existingValue: 70, action: "skip_existing" })] }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.skippedExistingCount).toBe(1);
  });

  it("does not make skip_empty or skip_existing operations executable", () => {
    const skippedEmpty = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ value: null, action: "skip_empty" })] }),
    });
    const skippedExisting = buildExecutableImportOperations({
      plan: plan({ gradeOperations: [operation({ action: "skip_existing" })] }),
    });

    expect(skippedEmpty.summary.executableCount).toBe(0);
    expect(skippedEmpty.summary.skippedEmptyCount).toBe(1);
    expect(skippedExisting.summary.executableCount).toBe(0);
    expect(skippedExisting.summary.skippedExistingCount).toBe(1);
  });

  it("blocks overwrite without confirmation", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        updateMode: "overwrite_existing",
        gradeOperations: [operation({ existingValue: 70, updateMode: "overwrite_existing", action: "overwrite" })],
      }),
      updateMode: "overwrite_existing",
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.overwriteNeedsConfirmationCount).toBe(1);
  });

  it("executes confirmed overwrites", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        updateMode: "overwrite_existing",
        gradeOperations: [operation({ existingValue: 70, updateMode: "overwrite_existing", action: "overwrite" })],
      }),
      updateMode: "overwrite_existing",
      selectionState: {
        columnSettings: {
          "excel-col-4": {
            columnId: "excel-col-4",
            columnIndex: 4,
            include: true,
            valueMode: "overwrite_existing",
            overwriteConfirmed: true,
          },
        },
        cellSettings: {},
      },
    });

    expect(result.summary.executableCount).toBe(1);
    expect(result.summary.overwriteCount).toBe(1);
  });

  it("honors overwrite_selected_columns only for selected and confirmed columns", () => {
    const selected = buildExecutableImportOperations({
      plan: plan({
        updateMode: "overwrite_selected_columns",
        gradeOperations: [operation({ existingValue: 70, updateMode: "overwrite_selected_columns", action: "overwrite" })],
      }),
      updateMode: "overwrite_selected_columns",
      selectionState: {
        columnSettings: {
          "excel-col-4": {
            columnId: "excel-col-4",
            columnIndex: 4,
            include: true,
            valueMode: "overwrite_existing",
            overwriteConfirmed: true,
          },
        },
        cellSettings: {},
      },
    });
    const unselected = buildExecutableImportOperations({
      plan: plan({
        updateMode: "overwrite_selected_columns",
        gradeOperations: [operation({ existingValue: 70, updateMode: "overwrite_selected_columns", action: "skip_existing" })],
      }),
      updateMode: "overwrite_selected_columns",
    });

    expect(selected.summary.overwriteCount).toBe(1);
    expect(unselected.summary.skippedExistingCount).toBe(1);
  });

  it("blocks invalid values", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        gradeOperations: [operation({
          value: null,
          action: "blocked",
          conflicts: [{ code: "IMPORT_INVALID_VALUE_STRICT", severity: "blocked", type: "grade_value", message: "Invalid.", rowIndex: 2, columnIndex: 4 }],
        })],
      }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.invalidCount).toBe(1);
  });

  it("blocks suggested values until the user accepts them", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        gradeOperations: [operation({
          value: null,
          suggestedValue: 90,
          action: "needs_confirmation",
          warnings: [{ code: "GRADE_VALUE_FRACTION_SCALED", severity: "warning", message: "Scale to 90.", field: "value" }],
        })],
      }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.blockedCount).toBe(1);
    expect(result.blockedItems[0]?.message).toContain("Nilai saran perlu disetujui");
  });

  it("blocks needs-confirmation operations until the user confirms them", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        gradeOperations: [operation({ action: "needs_confirmation" })],
      }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.blockedCount).toBe(1);
  });

  it("uses accepted suggested values as executable values", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        gradeOperations: [operation({
          value: null,
          suggestedValue: 90,
          action: "needs_confirmation",
          warnings: [{ code: "GRADE_VALUE_FRACTION_SCALED", severity: "warning", message: "Scale to 90.", field: "value" }],
        })],
      }),
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
            resolvedValue: 90,
          },
        },
      },
    });

    expect(result.summary.executableCount).toBe(1);
    expect(result.operations[0]?.value).toBe(90);
  });

  it("returns suggested values to blocked after the cell selection is reset", () => {
    const suggestedPlan = plan({
      gradeOperations: [operation({
        rawValue: "18/20",
        value: null,
        suggestedValue: 90,
        action: "needs_confirmation",
        warnings: [{ code: "GRADE_VALUE_FRACTION_SCALED", severity: "warning", message: "Scale to 90.", field: "value" }],
      })],
    });
    const accepted = buildExecutableImportOperations({
      plan: suggestedPlan,
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
            resolvedValue: 90,
          },
        },
      },
    });
    const reset = buildExecutableImportOperations({ plan: suggestedPlan, selectionState: { columnSettings: {}, cellSettings: {} } });

    expect(accepted.summary.executableCount).toBe(1);
    expect(reset.summary.executableCount).toBe(0);
    expect(reset.summary.blockedCount).toBe(1);
  });

  it("blocks missing students that still have values", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        studentMappings: [student({ studentId: undefined, status: "missing_in_web" })],
        gradeOperations: [operation({ studentId: undefined })],
      }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.unresolvedStudentCount).toBe(1);
  });

  it("honors studentOverrides for missing students with values", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        studentMappings: [student({ studentId: undefined, status: "missing_in_web" })],
        gradeOperations: [operation({ studentId: undefined })],
      }),
      resolverState: { studentOverrides: { 2: "student-1" } },
    });

    expect(result.summary.executableCount).toBe(1);
    expect(result.operations[0]?.studentId).toBe("student-1");
  });

  it("only skips missing students with values after the row is explicitly ignored", () => {
    const missingStudentPlan = plan({
      studentMappings: [student({ studentId: undefined, status: "missing_in_web" })],
      gradeOperations: [operation({ studentId: undefined })],
    });
    const blocked = buildExecutableImportOperations({ plan: missingStudentPlan });
    const ignored = buildExecutableImportOperations({
      plan: missingStudentPlan,
      resolverState: { ignoredRows: [2] },
    });

    expect(blocked.summary.unresolvedStudentCount).toBe(1);
    expect(ignored.summary.executableCount).toBe(0);
    expect(ignored.summary.skippedManualCount).toBe(1);
  });

  it("executes confirmed create-structure operations before the assignment is created", () => {
    const createPlan = plan({
      columnMappings: [column("BAB 1 - Tugas Baru", {
        status: "needs_confirmation",
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
      gradeOperations: [operation({
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
    });
    const blocked = buildExecutableImportOperations({ plan: createPlan });
    const confirmed = buildExecutableImportOperations({
      plan: createPlan,
      resolverState: {
        columnOverrides: {
          4: { kind: "create_assignment", chapterId: "chapter-1", assignmentName: "Tugas Baru", confirmed: true },
        },
      },
    });

    expect(blocked.summary.unresolvedColumnCount).toBe(1);
    expect(confirmed.summary.executableCount).toBe(1);
    expect(confirmed.summary.unresolvedColumnCount).toBe(0);
    expect(confirmed.operations[0]?.target).toMatchObject({
      gradeType: "assignment",
      chapterId: "chapter-1",
      assignmentName: "Tugas Baru",
    });
  });

  it("treats confirmed new assignment targets as empty even when the original target had a value", () => {
    const createPlan = plan({
      gradeOperations: [operation({
        existingValue: 70,
        action: "skip_existing",
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
      columnMappings: [column("BAB 1 - Tugas Baru", {
        status: "needs_confirmation",
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
    });

    const result = buildExecutableImportOperations({
      plan: createPlan,
      resolverState: {
        columnOverrides: {
          4: { kind: "create_assignment", chapterId: "chapter-1", assignmentName: "Tugas Baru", confirmed: true },
        },
      },
    });

    expect(result.summary.executableCount).toBe(1);
    expect(result.summary.fillEmptyCount).toBe(1);
    expect(result.summary.skippedExistingCount).toBe(0);
  });

  it("does not make skipped create-structure columns executable", () => {
    const createPlan = plan({
      columnMappings: [column("BAB 1 - Tugas Baru", {
        status: "needs_confirmation",
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
      gradeOperations: [operation({
        target: { gradeType: "assignment", chapterId: "chapter-1", chapterName: "BAB 1", assignmentName: "Tugas Baru" },
      })],
    });
    const result = buildExecutableImportOperations({
      plan: createPlan,
      selectionState: {
        columnSettings: {
          "excel-col-4": { columnId: "excel-col-4", columnIndex: 4, include: false, valueMode: "fill_empty_only" },
        },
        cellSettings: {},
      },
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.unresolvedColumnCount).toBe(0);
    expect(result.summary.skippedManualCount).toBe(1);
  });

  it("keeps STS and SAS executable targets free of assignmentId", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        columnMappings: [column("STS", { target: { gradeType: "sts" } })],
        gradeOperations: [operation({ target: { gradeType: "sts" } })],
      }),
      resolverState: { columnOverrides: { 4: { kind: "sts" } } },
    });

    expect(result.summary.executableCount).toBe(1);
    expect(result.operations[0]?.target).toEqual({ gradeType: "sts" });
  });

  it("blocks STS and SAS targets that still carry an assignmentId", () => {
    const result = buildExecutableImportOperations({
      plan: plan({
        columnMappings: [column("STS", { target: { gradeType: "sts", assignmentId: "assignment-1" } })],
        gradeOperations: [operation({ target: { gradeType: "sts", assignmentId: "assignment-1" } })],
      }),
    });

    expect(result.summary.executableCount).toBe(0);
    expect(result.summary.unresolvedColumnCount).toBe(1);
  });

  it("executes safe new values as fill empty", () => {
    const result = buildExecutableImportOperations({ plan: plan() });

    expect(result.summary.executableCount).toBe(1);
    expect(result.summary.fillEmptyCount).toBe(1);
    expect(result.operations[0]).toMatchObject({ studentId: "student-1", value: 80, action: "fill_empty" });
  });

  it("keeps preview included cells aligned with executable count for a simple case", () => {
    const basePlan = plan();
    const executable = buildExecutableImportOperations({ plan: basePlan });
    const preview = buildSpreadsheetPreviewModel({ plan: basePlan });

    expect(preview.summary.includedCells).toBe(executable.summary.executableCount);
  });

  it("marks unaccepted suggested values as blocked in preview", () => {
    const basePlan = plan({
      gradeOperations: [operation({
        rawValue: "18/20",
        value: null,
        suggestedValue: 90,
        action: "needs_confirmation",
        warnings: [{ code: "GRADE_VALUE_FRACTION_SCALED", severity: "warning", message: "Scale to 90.", field: "value" }],
      })],
    });
    const preview = buildSpreadsheetPreviewModel({ plan: basePlan });
    const gradeCell = preview.rows[0]?.cells.find((cell) => cell.columnId === "excel-col-4");

    expect(preview.summary.includedCells).toBe(0);
    expect(gradeCell).toMatchObject({
      status: "blocked",
      displayValue: "18/20 -> Saran 90",
      rawValue: "18/20",
      suggestedValue: 90,
      resolvedValue: null,
      requiresConfirmation: true,
    });
  });
});

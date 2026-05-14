import { describe, expect, it } from "vitest";

import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { buildHeaderConfigurationQueue, buildInvalidIssueQueue, getActiveHeaderConfigurationIssues, getActiveImportIssues } from "./importIssueQueue";

const columns: SpreadsheetPreviewColumn[] = [
  { id: "identity-no", header: "No", type: "identity", status: "unchanged" },
  { id: "identity-nisn", header: "NISN", type: "identity", status: "unchanged" },
  { id: "identity-name", header: "Nama", type: "identity", status: "unchanged" },
  { id: "excel-col-4", header: "UH 1", type: "assignment", status: "unchanged" },
  { id: "excel-col-5", header: "Tugas 1", type: "assignment", status: "manual_required" },
];

function gradeCell(rowId: string, columnId: string, overrides: Partial<SpreadsheetPreviewCell>): SpreadsheetPreviewCell {
  return {
    id: `${rowId}:${columnId}`,
    rowId,
    columnId,
    displayValue: "80",
    status: "new_value",
    effectiveInclude: true,
    ...overrides,
  };
}

function previewRow(id: string, overrides: Partial<SpreadsheetPreviewRow>): SpreadsheetPreviewRow {
  const row: SpreadsheetPreviewRow = {
    id,
    rowIndex: Number(id.replace("row-", "")),
    studentName: "Siswa",
    status: "unchanged",
    cells: [
      gradeCell(id, "identity-no", { status: "unchanged" }),
      gradeCell(id, "identity-nisn", { status: "unchanged" }),
      gradeCell(id, "identity-name", { status: "unchanged" }),
      gradeCell(id, "excel-col-4", {}),
      gradeCell(id, "excel-col-5", {}),
    ],
    ...overrides,
  };
  return row;
}

function model(rows: SpreadsheetPreviewRow[]): SpreadsheetPreviewModel {
  return {
    columns,
    rows,
    summary: {
      totalRows: rows.length,
      totalColumns: columns.length,
      readyCells: 0,
      newValueCells: 0,
      changedCells: 0,
      newColumns: 0,
      needsCheck: 0,
      manualRequired: 0,
      ignoredCells: 0,
      invalidCells: 0,
      includedCells: 0,
      skippedCells: 0,
      manualIncludedCells: 0,
      manualSkippedCells: 0,
      overwriteCells: 0,
      blockedCells: 0,
      overwriteNeedsConfirmation: 0,
      missingInExcelStudents: 0,
    },
  };
}

describe("invalid issue queue", () => {
  it("prioritizes invalid values before row issues", () => {
    const invalidRow = previewRow("row-5", {
      studentName: "Ahmad",
      cells: [
        gradeCell("row-5", "identity-no", { status: "unchanged" }),
        gradeCell("row-5", "identity-nisn", { status: "unchanged" }),
        gradeCell("row-5", "identity-name", { status: "unchanged" }),
        gradeCell("row-5", "excel-col-4", { status: "invalid", displayValue: "105" }),
        gradeCell("row-5", "excel-col-5", { status: "new_value" }),
      ],
    });
    const duplicateRow = previewRow("row-6", {
      status: "manual_required",
      studentName: "M. Rafi",
      message: "Baris ini duplicate dengan baris lain.",
      conflictIds: ["student:STUDENT_DUPLICATE_EXCEL_MATCH:6::"],
      cells: [
        gradeCell("row-6", "identity-no", { status: "manual_required" }),
        gradeCell("row-6", "identity-nisn", { status: "manual_required" }),
        gradeCell("row-6", "identity-name", { status: "manual_required" }),
        gradeCell("row-6", "excel-col-4", { status: "blocked", isBlockedByRow: true, effectiveInclude: false }),
        gradeCell("row-6", "excel-col-5", { status: "blocked", isBlockedByRow: true, effectiveInclude: false }),
      ],
    });

    const issues = buildInvalidIssueQueue(model([duplicateRow, invalidRow]));

    expect(issues[0]).toMatchObject({ kind: "cell", rootCause: "invalid_value" });
    expect(issues[0]).toMatchObject({ fixKind: "cell" });
    expect(issues.some((issue) => issue.kind === "row" && issue.rootCause === "student_duplicate")).toBe(true);
    expect(issues.some((issue) => issue.fixKind === "student" && issue.row?.id === "row-6")).toBe(true);
    expect(issues.filter((issue) => issue.kind === "row" && issue.row?.id === "row-6")).toHaveLength(1);
  });

  it("groups duplicate student rows into one issue with comparable rows", () => {
    const duplicateRowA = previewRow("row-6", {
      status: "manual_required",
      studentId: "student-rafi",
      studentName: "M. Rafi",
      message: "Baris ini duplicate dengan baris lain.",
      conflictIds: ["student:STUDENT_DUPLICATE_EXCEL_MATCH:6::"],
    });
    const duplicateRowB = previewRow("row-9", {
      status: "manual_required",
      studentId: "student-rafi",
      studentName: "M. Rafi",
      message: "Baris ini duplicate dengan baris lain.",
      conflictIds: ["student:STUDENT_DUPLICATE_EXCEL_MATCH:9::"],
    });

    const issues = buildInvalidIssueQueue(model([duplicateRowA, duplicateRowB]));
    const duplicateIssues = issues.filter((issue) => issue.rootCause === "student_duplicate");

    expect(duplicateIssues).toHaveLength(1);
    expect(duplicateIssues[0]).toMatchObject({ title: "Nama siswa redundan", primaryActionLabel: "Pilih baris" });
    expect(duplicateIssues[0].relatedRows?.map((row) => row.id)).toEqual(["row-6", "row-9"]);
  });

  it("keeps missing students as one row issue and omits ignored rows", () => {
    const missingRow = previewRow("row-7", {
      status: "manual_required",
      studentName: "Siswa Baru Uji",
      message: "Siswa belum ada di kelas aktif.",
      conflictIds: ["student:IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE:7:4:"],
      cells: [
        gradeCell("row-7", "identity-no", { status: "manual_required" }),
        gradeCell("row-7", "identity-nisn", { status: "manual_required" }),
        gradeCell("row-7", "identity-name", { status: "manual_required" }),
        gradeCell("row-7", "excel-col-4", { status: "blocked", isBlockedByRow: true, effectiveInclude: false }),
        gradeCell("row-7", "excel-col-5", { status: "blocked", isBlockedByRow: true, effectiveInclude: false }),
      ],
    });
    const ignoredRow = previewRow("row-8", {
      status: "ignored",
      studentName: "Siswa Dilewati",
      cells: [gradeCell("row-8", "excel-col-4", { status: "ignored", effectiveInclude: false })],
    });

    const issues = buildInvalidIssueQueue(model([missingRow, ignoredRow]));

    expect(issues.filter((issue) => issue.rootCause === "student_missing")).toHaveLength(1);
    expect(issues.filter((issue) => issue.row?.id === "row-7" && issue.kind === "cell")).toHaveLength(0);
    expect(issues.some((issue) => issue.row?.id === "row-8")).toBe(false);
  });

  it("does not create a student row issue when only column target blocks the row", () => {
    const targetBlockedRow = previewRow("row-9", {
      status: "manual_required",
      studentName: "Siswa Benar",
      message: "Target kolom belum aman.",
      conflictIds: [],
      cells: [
        gradeCell("row-9", "identity-no", { status: "unchanged" }),
        gradeCell("row-9", "identity-nisn", { status: "unchanged" }),
        gradeCell("row-9", "identity-name", { status: "unchanged" }),
        gradeCell("row-9", "excel-col-4", { status: "blocked", isBlockedByTarget: true, effectiveInclude: false }),
        gradeCell("row-9", "excel-col-5", { status: "blocked", isBlockedByTarget: true, effectiveInclude: false }),
      ],
    });

    const issues = buildInvalidIssueQueue(model([targetBlockedRow]));

    expect(issues.some((issue) => issue.kind === "row" && issue.row?.id === "row-9")).toBe(false);
  });

  it("does not create a row issue from generic student copy", () => {
    const valueBlockedRow = previewRow("row-10", {
      status: "manual_required",
      studentName: "Siswa Benar",
      message: "Siswa sudah cocok, tetapi ada nilai yang perlu dicek.",
      conflictIds: [],
      cells: [
        gradeCell("row-10", "identity-no", { status: "unchanged" }),
        gradeCell("row-10", "identity-nisn", { status: "unchanged" }),
        gradeCell("row-10", "identity-name", { status: "unchanged" }),
        gradeCell("row-10", "excel-col-4", { status: "invalid", displayValue: "A", effectiveInclude: true }),
        gradeCell("row-10", "excel-col-5", { status: "new_value" }),
      ],
    });

    const issues = buildInvalidIssueQueue(model([valueBlockedRow]));

    expect(issues.some((issue) => issue.kind === "row" && issue.row?.id === "row-10")).toBe(false);
    expect(issues.some((issue) => issue.kind === "cell" && issue.row?.id === "row-10")).toBe(true);
  });

  it("keeps target column issues out of Daftar Bermasalah", () => {
    const issues = buildInvalidIssueQueue(model([]));

    expect(issues.filter((issue) => issue.kind === "column" && issue.column?.id === "excel-col-5")).toHaveLength(0);
  });

  it("moves target column issues to Konfigurasi Header", () => {
    const headerIssues = buildHeaderConfigurationQueue(model([]));
    const activeHeaderIssues = getActiveHeaderConfigurationIssues(model([]));

    expect(headerIssues.filter((issue) => issue.column.id === "excel-col-5")).toHaveLength(1);
    expect(headerIssues.find((issue) => issue.column.id === "excel-col-5")).toMatchObject({ category: "target_required", isResolved: false });
    expect(activeHeaderIssues.map((issue) => issue.column.id)).toContain("excel-col-5");
  });

  it("requires an explicit header decision for overwrite columns", () => {
    const overwriteRow = previewRow("row-11", {
      studentName: "Siswa Lama",
      cells: [
        gradeCell("row-11", "identity-no", { status: "unchanged" }),
        gradeCell("row-11", "identity-nisn", { status: "unchanged" }),
        gradeCell("row-11", "identity-name", { status: "unchanged" }),
        gradeCell("row-11", "excel-col-4", { status: "changed", oldValue: 75, newValue: 82, requiresConfirmation: true }),
        gradeCell("row-11", "excel-col-5", { status: "new_value" }),
      ],
    });
    const preview = model([overwriteRow]);

    expect(buildHeaderConfigurationQueue(preview).find((issue) => issue.column.id === "excel-col-4")).toMatchObject({
      category: "overwrite",
      isResolved: false,
    });
    expect(buildHeaderConfigurationQueue(preview, {
      columnSettings: {
        "excel-col-4": {
          columnId: "excel-col-4",
          include: true,
          valueMode: "skip_existing",
          overwriteConfirmed: false,
        },
      },
      cellSettings: {},
    }).find((issue) => issue.column.id === "excel-col-4")).toMatchObject({
      category: "overwrite",
      isResolved: true,
    });
  });

  it("uses active issues instead of stale summary counts for step gating", () => {
    const staleModel = {
      ...model([]),
      columns: columns.map((column) => column.id === "excel-col-5" ? { ...column, status: "ignored" as const, effectiveInclude: false, isIgnored: true } : column),
      summary: {
        ...model([]).summary,
        manualRequired: 3,
        invalidCells: 2,
      },
    } satisfies SpreadsheetPreviewModel;

    expect(getActiveImportIssues(staleModel)).toHaveLength(0);
  });
});

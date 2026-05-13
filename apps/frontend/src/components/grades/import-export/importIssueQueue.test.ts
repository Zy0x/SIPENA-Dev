import { describe, expect, it } from "vitest";

import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { buildInvalidIssueQueue } from "./importIssueQueue";

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
  it("prioritizes invalid values before row and column issues", () => {
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
    expect(issues.some((issue) => issue.kind === "row" && issue.rootCause === "student_duplicate")).toBe(true);
    expect(issues.filter((issue) => issue.kind === "row" && issue.row?.id === "row-6")).toHaveLength(1);
  });

  it("keeps missing students as one row issue and omits ignored rows", () => {
    const missingRow = previewRow("row-7", {
      status: "manual_required",
      studentName: "Siswa Baru Uji",
      message: "Siswa belum ada di kelas aktif.",
      conflictIds: ["student:IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE:7:4:"],
    });
    const ignoredRow = previewRow("row-8", {
      status: "ignored",
      studentName: "Siswa Dilewati",
      cells: [gradeCell("row-8", "excel-col-4", { status: "ignored", effectiveInclude: false })],
    });

    const issues = buildInvalidIssueQueue(model([missingRow, ignoredRow]));

    expect(issues.filter((issue) => issue.rootCause === "student_missing")).toHaveLength(1);
    expect(issues.some((issue) => issue.row?.id === "row-8")).toBe(false);
  });

  it("adds target column issues once", () => {
    const issues = buildInvalidIssueQueue(model([]));

    expect(issues.filter((issue) => issue.kind === "column" && issue.column?.id === "excel-col-5")).toHaveLength(1);
    expect(issues[0]).toMatchObject({ rootCause: "column_target", scope: "column" });
  });
});

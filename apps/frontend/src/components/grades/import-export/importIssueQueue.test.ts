import { describe, expect, it } from "vitest";

import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { buildCellDetailCopy, buildColumnDetailCopy, buildInvalidIssueQueue, buildRowDetailCopy } from "./importIssueQueue";

const identityColumn: SpreadsheetPreviewColumn = {
  id: "excel-col-0",
  header: "Nama Siswa",
  type: "identity",
  status: "unchanged",
};

const gradeColumn: SpreadsheetPreviewColumn = {
  id: "excel-col-4",
  header: "BAB 1 - Tugas 1",
  type: "assignment",
  status: "unchanged",
  targetLabel: "BAB 1 - Tugas 1",
};

function cell(overrides: Partial<SpreadsheetPreviewCell>): SpreadsheetPreviewCell {
  return {
    id: `row-2:${overrides.columnId || "excel-col-4"}`,
    rowId: "row-2",
    columnId: "excel-col-4",
    displayValue: "82",
    rawValue: "82",
    status: "new_value",
    effectiveInclude: true,
    ...overrides,
  };
}

function row(overrides: Partial<SpreadsheetPreviewRow> = {}): SpreadsheetPreviewRow {
  return {
    id: "row-2",
    rowIndex: 2,
    studentName: "Alya",
    status: "unchanged",
    cells: [
      cell({ id: "row-2:excel-col-0", columnId: "excel-col-0", displayValue: "Alya", status: "unchanged" }),
      cell({}),
    ],
    ...overrides,
  };
}

function model(overrides: Partial<SpreadsheetPreviewModel> = {}): SpreadsheetPreviewModel {
  return {
    columns: [identityColumn, gradeColumn],
    rows: [row()],
    summary: {
      totalRows: 1,
      totalColumns: 2,
      readyCells: 1,
      newValueCells: 1,
      changedCells: 0,
      newColumns: 0,
      needsCheck: 0,
      manualRequired: 0,
      ignoredCells: 0,
      invalidCells: 0,
      includedCells: 1,
      skippedCells: 0,
      manualIncludedCells: 0,
      manualSkippedCells: 0,
      overwriteCells: 0,
      blockedCells: 0,
      overwriteNeedsConfirmation: 0,
      missingInExcelStudents: 0,
    },
    ...overrides,
  };
}

describe("import issue queue", () => {
  it("prioritizes invalid values before blocked targets", () => {
    const invalidCell = cell({ id: "row-2:excel-col-4", status: "invalid", rawValue: "A" });
    const blockedCell = cell({ id: "row-3:excel-col-4", rowId: "row-3", status: "blocked", isBlockedByTarget: true });
    const preview = model({
      rows: [
        row({ id: "row-3", rowIndex: 3, studentName: "Bima", cells: [cell({ id: "row-3:excel-col-0", columnId: "excel-col-0" }), blockedCell] }),
        row({ cells: [cell({ id: "row-2:excel-col-0", columnId: "excel-col-0" }), invalidCell] }),
      ],
    });

    const issues = buildInvalidIssueQueue(preview);

    expect(issues[0]?.cell?.status).toBe("invalid");
    expect(issues[1]?.cell?.status).toBe("blocked");
  });

  it("does not include manually skipped invalid cells", () => {
    const preview = model({
      rows: [row({ cells: [cell({ id: "row-2:excel-col-0", columnId: "excel-col-0" }), cell({ status: "invalid", effectiveInclude: false, isManuallySkipped: true })] })],
    });

    expect(buildInvalidIssueQueue(preview)).toHaveLength(0);
  });

  it("explains duplicate student names specifically", () => {
    const detail = buildRowDetailCopy(row({
      status: "manual_required",
      message: "Nama exact di data web duplikat, sehingga nama saja tidak boleh dipakai otomatis.",
    }));

    expect(detail.title).toBe("Nama siswa perlu dipilih");
    expect(detail.bullets.join(" ")).toContain("Pilih satu siswa");
  });

  it("explains invalid value details with the raw Excel value", () => {
    const detail = buildCellDetailCopy(cell({ status: "invalid", rawValue: "A", displayValue: "A" }), row(), gradeColumn);

    expect(detail.title).toBe("Nilai tidak valid");
    expect(detail.bullets.join(" ")).toContain('Excel berisi "A"');
  });

  it("explains duplicate column target specifically", () => {
    const detail = buildColumnDetailCopy({
      ...gradeColumn,
      status: "manual_required",
      targetLabel: "Target dobel.",
    });

    expect(detail.title).toBe("Target kolom ganda");
    expect(detail.bullets.join(" ")).toContain("target yang sama");
  });
});

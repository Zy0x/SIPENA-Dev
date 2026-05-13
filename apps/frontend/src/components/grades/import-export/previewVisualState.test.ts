import { describe, expect, it } from "vitest";

import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { getCellPreviewVisualState } from "./previewVisualState";

const gradeColumn: SpreadsheetPreviewColumn = {
  id: "excel-col-4",
  header: "UH 1",
  type: "assignment",
  status: "unchanged",
};

const identityColumn: SpreadsheetPreviewColumn = {
  id: "identity-name",
  header: "Nama",
  type: "identity",
  status: "unchanged",
};

function cell(overrides: Partial<SpreadsheetPreviewCell>): SpreadsheetPreviewCell {
  return {
    id: "row-1:excel-col-4",
    rowId: "row-1",
    columnId: "excel-col-4",
    displayValue: "80",
    status: "new_value",
    effectiveInclude: true,
    ...overrides,
  };
}

function row(overrides: Partial<SpreadsheetPreviewRow> = {}): SpreadsheetPreviewRow {
  return {
    id: "row-1",
    rowIndex: 5,
    studentName: "Siti Aminah",
    status: "unchanged",
    cells: [],
    ...overrides,
  };
}

describe("preview visual state", () => {
  it("uses red only for invalid values and identity row problems", () => {
    expect(getCellPreviewVisualState(cell({ status: "invalid" }), gradeColumn).tone).toBe("danger");
    expect(getCellPreviewVisualState(
      cell({ columnId: "identity-name", status: "manual_required" }),
      identityColumn,
      row({
        status: "manual_required",
        conflictIds: ["student:STUDENT_DUPLICATE_EXCEL_MATCH:6::Nama siswa ganda."],
      }),
    ).tone).toBe("danger");
  });

  it("uses amber for changed or overwrite candidates", () => {
    expect(getCellPreviewVisualState(cell({
      status: "skipped",
      oldValue: 75,
      newValue: 82,
      effectiveInclude: false,
    }), gradeColumn).tone).toBe("change");
  });

  it("uses green for new values", () => {
    expect(getCellPreviewVisualState(cell({ status: "new_value", newValue: 82 }), gradeColumn).tone).toBe("new");
  });

  it("does not paint row-blocked valid grade values red", () => {
    expect(getCellPreviewVisualState(cell({
      status: "blocked",
      isBlockedByRow: true,
      effectiveInclude: false,
      newValue: 82,
    }), gradeColumn, row({ status: "manual_required" })).tone).toBe("blocked");
  });

  it("keeps identity cells neutral when the row is blocked by value or column issues", () => {
    expect(getCellPreviewVisualState(
      cell({ columnId: "identity-name", status: "unchanged", displayValue: "Siti Aminah" }),
      identityColumn,
      row({ status: "manual_required", message: "Target kolom belum aman." }),
    ).tone).toBe("neutral");
  });

  it("does not mark identity cells red from generic student copy", () => {
    expect(getCellPreviewVisualState(
      cell({ columnId: "identity-name", status: "unchanged", displayValue: "Siti Aminah" }),
      identityColumn,
      row({ status: "manual_required", message: "Siswa sudah cocok, tetapi ada nilai yang perlu dicek." }),
    ).tone).toBe("neutral");
  });

  it("uses amber when a matched student only needs confirmation", () => {
    expect(getCellPreviewVisualState(
      cell({ columnId: "identity-name", status: "manual_required", displayValue: "Abdul Hamid" }),
      identityColumn,
      row({
        status: "manual_required",
        conflictIds: ["student:IMPORT_STUDENT_NOT_SAFE_FOR_VALUE:5:4:Baris siswa belum cocok aman tetapi memiliki nilai yang akan diimport."],
      }),
    ).tone).toBe("change");
  });
});

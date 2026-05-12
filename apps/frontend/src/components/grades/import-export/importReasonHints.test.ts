import { describe, expect, it } from "vitest";

import type {
  SmartImportAssistResponse,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { buildCellReasonHint, buildColumnReasonHint } from "./importReasonHints";

const baseColumn: SpreadsheetPreviewColumn = {
  id: "excel-col-4",
  header: "BAB 1 - Tugas 1",
  type: "assignment",
  status: "unchanged",
  targetLabel: "BAB 1 - Tugas 1",
  stats: {
    validValues: 3,
    willImport: 2,
    willFill: 2,
    skippedExisting: 1,
    skippedManual: 0,
    invalid: 0,
    overwrite: 0,
    blocked: 0,
  },
};

const baseRow: SpreadsheetPreviewRow = {
  id: "row-2",
  rowIndex: 2,
  studentName: "Alya",
  status: "unchanged",
  cells: [],
};

function cell(overrides: Partial<SpreadsheetPreviewCell>): SpreadsheetPreviewCell {
  return {
    id: "row-2:excel-col-4",
    rowId: "row-2",
    columnId: "excel-col-4",
    displayValue: "82",
    rawValue: "82",
    oldValue: null,
    newValue: 82,
    resolvedValue: 82,
    status: "new_value",
    effectiveInclude: true,
    ...overrides,
  };
}

describe("import reason hints", () => {
  it("explains new values clearly", () => {
    const hint = buildCellReasonHint(cell({ status: "new_value", oldValue: null }), baseRow, baseColumn);

    expect(hint.label).toBe("Nilai kosong akan diisi");
    expect(hint.description).toContain("SIPENA masih kosong");
    expect(hint.tone).toBe("safe");
  });

  it("explains changed existing values without auto-overwrite", () => {
    const hint = buildCellReasonHint(
      cell({ status: "changed", oldValue: 75, rawValue: 82, displayValue: "82", effectiveInclude: false }),
      baseRow,
      baseColumn,
    );

    expect(hint.label).toBe("Nilai lama berbeda");
    expect(hint.description).toContain("Nilai SIPENA 75, Excel 82");
    expect(hint.actionLabel).toBe("Konfirmasi timpa");
  });

  it("explains invalid values", () => {
    const hint = buildCellReasonHint(
      cell({ status: "invalid", rawValue: 101, displayValue: "101", resolvedValue: null }),
      baseRow,
      baseColumn,
    );

    expect(hint.label).toBe("Nilai di luar aturan");
    expect(hint.tone).toBe("danger");
  });

  it("explains new columns", () => {
    const hint = buildColumnReasonHint({
      ...baseColumn,
      status: "new_column",
      isNewStructure: true,
      targetLabel: "BAB Baru - Tugas Baru",
    });

    expect(hint.label).toBe("Kolom baru");
    expect(hint.actionLabel).toBe("Konfirmasi target");
  });

  it("explains unclear column targets", () => {
    const hint = buildColumnReasonHint({
      ...baseColumn,
      status: "manual_required",
      targetLabel: undefined,
    });

    expect(hint.label).toBe("Kolom belum jelas");
    expect(hint.tone).toBe("danger");
  });

  it("explains suggested fraction values", () => {
    const hint = buildCellReasonHint(
      cell({
        status: "needs_check",
        rawValue: "8/10",
        displayValue: "8/10 -> Saran 80",
        suggestedValue: 80,
        resolvedValue: null,
      }),
      baseRow,
      baseColumn,
    );

    expect(hint.label).toBe("Nilai perlu konfirmasi");
    expect(hint.actionLabel).toBe("Pakai saran 80");
  });

  it("adds AI reason without replacing the local safety reason", () => {
    const aiResponse: SmartImportAssistResponse = {
      suggestions: [{
        type: "value",
        rowIndex: 2,
        columnIndex: 4,
        suggestedAction: "Cek perbedaan nilai",
        targetType: "value",
        suggestedValue: 82,
        confidence: 0.8,
        reason: "Nilai Excel terlihat sebagai revisi dari nilai lama.",
        requiresConfirmation: true,
      }],
      summary: { confidence: 0.8, riskLevel: "medium", notes: [] },
    };

    const hint = buildCellReasonHint(
      cell({ status: "changed", oldValue: 75 }),
      baseRow,
      baseColumn,
      aiResponse,
    );

    expect(hint.source).toBe("hybrid");
    expect(hint.description).toContain("Default aman");
    expect(hint.description).toContain("Saran AI");
  });
});

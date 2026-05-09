import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import type {
  CellValueMode,
  ColumnValueMode,
  ImportSelectionState,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
  UpdateMode,
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { PreviewCellBadge } from "./PreviewCellBadge";
import { PreviewFixPanel } from "./PreviewFixPanel";
import { PreviewLegend } from "./PreviewLegend";
import { PreviewQuickActions } from "./PreviewQuickActions";
import { PreviewSummaryBanner } from "./PreviewSummaryBanner";

type Selection =
  | { kind: "cell"; cell: SpreadsheetPreviewCell; row: SpreadsheetPreviewRow; column: SpreadsheetPreviewColumn }
  | { kind: "column"; column: SpreadsheetPreviewColumn }
  | { kind: "row"; row: SpreadsheetPreviewRow }
  | null;

function previewStatusClass(status: string): string {
  return `sipena-preview-cell--${status.replace(/_/g, "-")}`;
}

function stickyStyle(index: number): CSSProperties | undefined {
  if (index === 0) return { left: 0 };
  if (index === 1) return { left: 52 };
  if (index === 2) return { left: 164 };
  return undefined;
}

export function SmartSpreadsheetPreview({
  model,
  updateMode,
  onUpdateModeChange,
  onApplySafeFixes,
  onApproveSuggestions,
  onIgnoreNonGradeColumns,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  selectionState,
  onSetColumnInclude,
  onSetColumnValueMode,
  onBulkColumnAction,
  onResetColumnSelection,
  onSetCellInclude,
  onSetCellValueMode,
  onResetCellSelection,
}: {
  model: SpreadsheetPreviewModel;
  updateMode: UpdateMode;
  selectionState: ImportSelectionState;
  onUpdateModeChange: (mode: UpdateMode) => void;
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onIgnoreNonGradeColumns: () => void;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onSetColumnInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const firstManual = useMemo(() => {
    for (const row of model.rows) {
      const cell = row.cells.find((item) => item.status === "manual_required" || item.status === "invalid");
      if (cell) {
        const column = model.columns.find((item) => item.id === cell.columnId);
        if (column) return { kind: "cell" as const, cell, row, column };
      }
    }
    const column = model.columns.find((item) => item.status === "manual_required");
    return column ? { kind: "column" as const, column } : null;
  }, [model]);

  const primarySummaryAction = () => {
    if (model.summary.manualRequired > 0 && firstManual) {
      setSelection(firstManual);
      return;
    }
    if (model.summary.needsCheck > 0) {
      onApproveSuggestions();
      return;
    }
    onApplySafeFixes();
  };

  return (
    <div className="sipena-preview-shell">
      <PreviewSummaryBanner model={model} onPrimaryAction={primarySummaryAction} />
      <PreviewQuickActions
        onApplySafeFixes={onApplySafeFixes}
        onApproveSuggestions={onApproveSuggestions}
        onIgnoreNonGradeColumns={onIgnoreNonGradeColumns}
        onPickManualItems={() => firstManual && setSelection(firstManual)}
      />
      <PreviewLegend />

      <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="sipena-preview-grid-wrap">
          <div className="sipena-preview-scroll">
            <table className="sipena-preview-table">
              <thead>
                <tr>
                  {model.columns.map((column, index) => (
                    <th
                      key={column.id}
                      className={cn(
                        index < 3 && "sipena-preview-sticky-left",
                        previewStatusClass(column.status),
                      )}
                      style={stickyStyle(index)}
                    >
                      <button
                        type="button"
                        className="block max-w-[220px] truncate text-left"
                        title={column.targetLabel || column.header}
                        onClick={() => setSelection({ kind: "column", column })}
                      >
                        {column.header}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.rows.length ? model.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => {
                      const column = model.columns[index];
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "sipena-preview-cell",
                            previewStatusClass(cell.status),
                            cell.isManuallyIncluded && "sipena-import-cell-manual-include",
                            cell.isManuallySkipped && "sipena-import-cell-manual-skip",
                            cell.status === "overwrite" && "sipena-import-cell-overwrite-confirmed",
                            cell.isBlockedByColumn && "sipena-import-cell-blocked-by-column",
                            index < 3 && "sipena-preview-sticky-left",
                          )}
                          style={stickyStyle(index)}
                          onClick={() => setSelection({ kind: "cell", cell, row, column })}
                          title={cell.message || cell.displayValue}
                        >
                          <div className="sipena-preview-cell-main">
                            <span className="sipena-preview-cell-value">{cell.displayValue || "-"}</span>
                            <PreviewCellBadge status={cell.status} />
                            {cell.isManuallyIncluded ? <span className="sipena-import-cell-mini-badge">Dipilih</span> : null}
                            {cell.isManuallySkipped ? <span className="sipena-import-cell-mini-badge">Dilewati</span> : null}
                            {cell.status === "overwrite" ? <span className="sipena-import-cell-mini-badge">Timpa</span> : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={model.columns.length} className="sipena-preview-cell sipena-preview-cell--ignored">
                      Belum ada baris siswa untuk dipreview.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <PreviewFixPanel
          model={model}
          selection={selection}
          updateMode={updateMode}
          selectionState={selectionState}
          onUpdateModeChange={onUpdateModeChange}
          onApproveColumn={onApproveColumn}
          onIgnoreColumn={onIgnoreColumn}
          onIgnoreCell={onIgnoreCell}
          onIgnoreRow={onIgnoreRow}
          onApplySafeFixes={onApplySafeFixes}
          onApproveSuggestions={onApproveSuggestions}
          onSetColumnInclude={onSetColumnInclude}
          onSetColumnValueMode={onSetColumnValueMode}
          onBulkColumnAction={onBulkColumnAction}
          onResetColumnSelection={onResetColumnSelection}
          onSetCellInclude={onSetCellInclude}
          onSetCellValueMode={onSetCellValueMode}
          onResetCellSelection={onResetCellSelection}
        />
      </div>
    </div>
  );
}

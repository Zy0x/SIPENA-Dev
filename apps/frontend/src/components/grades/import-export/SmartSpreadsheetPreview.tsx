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
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import {
  ColumnSettingsOverlay,
  type ColumnSettingsAssignmentOption,
  type ColumnSettingsChapterOption,
  type ColumnTargetDraft,
} from "./ColumnSettingsOverlay";
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
  if (index === 1) return { left: "var(--sipena-preview-sticky-2)" };
  if (index === 2) return { left: "var(--sipena-preview-sticky-3)" };
  return undefined;
}

function formatPreviewValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function previewCellDisplayValue(cell: SpreadsheetPreviewCell, column: SpreadsheetPreviewColumn): string {
  if (column.type === "identity") return cell.displayValue || "-";
  if (cell.effectiveInclude === false || cell.isManuallySkipped) return cell.displayValue || "-";
  return formatPreviewValue(cell.resolvedValue ?? cell.newValue ?? cell.suggestedValue ?? cell.displayValue);
}

function previewCellDetailLines(cell: SpreadsheetPreviewCell, column: SpreadsheetPreviewColumn): string[] {
  if (column.type === "identity") return [];

  const details: string[] = [];
  const raw = formatPreviewValue(cell.rawValue ?? cell.displayValue);
  if (raw !== "-") details.push(`Excel: ${raw}`);

  const oldValue = formatPreviewValue(cell.oldValue);
  if (oldValue !== "-") details.push(`Lama: ${oldValue}`);

  if (cell.suggestedValue !== undefined && cell.suggestedValue !== null) {
    details.push(`Saran: ${cell.suggestedValue}`);
  }

  if (cell.message) details.push(cell.message);
  if (cell.effectiveInclude === false || cell.isManuallySkipped) details.push("Tidak akan disimpan");
  if (cell.status === "overwrite") details.push("Nilai lama akan ditimpa");

  return Array.from(new Set(details)).slice(0, 3);
}

function columnTargetDetail(column: SpreadsheetPreviewColumn): string {
  if (column.type === "identity") return "Identitas siswa";
  if (column.effectiveInclude === false || column.isIgnored) return "Kolom dilewati";
  return column.targetLabel || column.sourceHeader || "Target belum jelas";
}

function columnStatsDetail(column: SpreadsheetPreviewColumn): string {
  if (column.type === "identity" || !column.stats) return "";

  const stats = column.stats;
  const parts = [
    `${stats.willImport} dipakai`,
    `${stats.skippedManual + stats.skippedExisting} dilewati`,
  ];
  if (stats.overwrite > 0) parts.push(`${stats.overwrite} timpa`);
  if (stats.invalid + stats.blocked > 0) parts.push(`${stats.invalid + stats.blocked} perlu dicek`);
  return parts.join(" / ");
}

function needsCompactCellActions(cell: SpreadsheetPreviewCell, column: SpreadsheetPreviewColumn): boolean {
  if (column.type === "identity") return false;
  return cell.status === "invalid"
    || cell.status === "blocked"
    || cell.status === "manual_required"
    || cell.status === "needs_check"
    || cell.status === "overwrite"
    || cell.requiresConfirmation
    || typeof cell.suggestedValue === "number";
}

export function SmartSpreadsheetPreview({
  model,
  onApplySafeFixes,
  onApproveSuggestions,
  onIgnoreNonGradeColumns,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  selectionState,
  assignments,
  chapters,
  onSetColumnInclude,
  onSetColumnHeader,
  onSetColumnTarget,
  onSetColumnValueMode,
  onBulkColumnAction,
  onResetColumnSelection,
  onSetCellInclude,
  onSetCellValueMode,
  onAcceptSuggestedValue,
  onResetCellSelection,
}: {
  model: SpreadsheetPreviewModel;
  selectionState: ImportSelectionState;
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onIgnoreNonGradeColumns: () => void;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onSetColumnInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetColumnHeader: (column: SpreadsheetPreviewColumn, header: string) => void;
  onSetColumnTarget: (column: SpreadsheetPreviewColumn, target: ColumnTargetDraft) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onAcceptSuggestedValue: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const firstManual = useMemo(() => {
    for (const row of model.rows) {
      const cell = row.cells.find((item) =>
        item.status === "manual_required"
        || item.status === "needs_check"
        || item.status === "invalid"
        || item.status === "blocked"
        || item.requiresConfirmation
      );
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

  const showFixPanel = Boolean(selection && selection.kind !== "column");

  const toggleCellInclude = (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => {
    if (column.type === "identity") {
      setSelection({ kind: "row", row });
      return;
    }
    if (!cell.canToggleInclude || cell.status === "invalid" || cell.status === "blocked" || cell.status === "manual_required" || cell.requiresConfirmation) {
      setSelection({ kind: "cell", cell, row, column });
      return;
    }
    onSetCellInclude(cell, row, column, cell.effectiveInclude === false);
  };

  const headerHint = (column: SpreadsheetPreviewColumn) => {
    if (column.type === "identity") return "Klik untuk memilih baris.";
    if (column.isNewStructure) return "Klik untuk setujui atau ubah BAB/tugas baru.";
    if (column.effectiveInclude === false) return "Klik untuk mengatur kolom yang dilewati.";
    return "Klik header untuk atur kolom, target tugas, dan mode nilai.";
  };

  return (
    <div className="sipena-preview-shell">
      <PreviewSummaryBanner model={model} onPrimaryAction={primarySummaryAction} />
      <PreviewQuickActions
        onApplySafeFixes={onApplySafeFixes}
        onApproveSuggestions={() => firstManual && setSelection(firstManual)}
        onIgnoreNonGradeColumns={onIgnoreNonGradeColumns}
        onPickManualItems={() => firstManual && setSelection(firstManual)}
      />
      <PreviewLegend />

      <div className={cn("grid min-w-0 gap-4", showFixPanel && "xl:grid-cols-[minmax(0,1fr)_420px]")}>
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
                        className="sipena-preview-header-button"
                        title={headerHint(column)}
                        onClick={() => setSelection({ kind: "column", column })}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{column.header}</span>
                          {column.type !== "identity" ? (
                            <>
                              <span className="sipena-preview-header-target" title={columnTargetDetail(column)}>
                                {columnTargetDetail(column)}
                              </span>
                              {columnStatsDetail(column) ? (
                                <span className="sipena-preview-header-stats" title={columnStatsDetail(column)}>
                                  {columnStatsDetail(column)}
                                </span>
                              ) : null}
                            </>
                          ) : null}
                        </span>
                        {column.type !== "identity" ? (
                          <span className="sipena-preview-header-meta">
                            {column.isNewStructure ? <span className="sipena-import-cell-mini-badge">Kolom baru</span> : null}
                            <span className="sipena-import-cell-mini-badge">
                              {column.effectiveInclude === false ? "Dilewati" : "Dipakai"}
                            </span>
                            <span className="sipena-preview-header-action">Atur</span>
                          </span>
                        ) : null}
                      </button>
                      {column.type !== "identity" ? (
                        <span className="sipena-preview-header-hint">{headerHint(column)}</span>
                      ) : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {model.rows.length ? model.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => {
                      const column = model.columns[index];
                      const detailLines = previewCellDetailLines(cell, column);
                      const showCellActions = needsCompactCellActions(cell, column);
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
                          onClick={() => toggleCellInclude(cell, row, column)}
                          onDoubleClick={() => setSelection({ kind: "cell", cell, row, column })}
                          title={column.type === "identity" ? cell.displayValue : detailLines.join(" / ") || "Klik sel untuk pakai/lewati. Klik dua kali untuk detail."}
                        >
                          <div className="sipena-preview-cell-main">
                            <span className="min-w-0 flex-1">
                              <span className="sipena-preview-cell-value">{previewCellDisplayValue(cell, column)}</span>
                              {detailLines.length ? (
                                <span className="sipena-preview-cell-details">
                                  {detailLines.map((detail) => (
                                    <span key={detail} className="sipena-preview-cell-detail-line">{detail}</span>
                                  ))}
                                </span>
                              ) : null}
                            </span>
                            <span className="sipena-preview-cell-badges">
                              <PreviewCellBadge status={cell.status} />
                              {cell.isManuallyIncluded ? <span className="sipena-import-cell-mini-badge">Dipilih</span> : null}
                              {cell.isManuallySkipped ? <span className="sipena-import-cell-mini-badge">Dilewati</span> : null}
                              {cell.status === "overwrite" ? <span className="sipena-import-cell-mini-badge">Timpa</span> : null}
                              {cell.requiresConfirmation ? <span className="sipena-import-cell-mini-badge">Perlu cek</span> : null}
                            </span>
                          </div>
                          {showCellActions ? (
                            <div className="sipena-preview-cell-actions">
                              <button
                                type="button"
                                className="sipena-preview-cell-action"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelection({ kind: "cell", cell, row, column });
                                }}
                              >
                                Atur
                              </button>
                              {cell.effectiveInclude ? (
                                <button
                                  type="button"
                                  className="sipena-preview-cell-action sipena-preview-cell-action-muted"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onIgnoreCell(cell);
                                  }}
                                >
                                  Skip
                                </button>
                              ) : null}
                              {typeof cell.suggestedValue === "number" ? (
                                <button
                                  type="button"
                                  className="sipena-preview-cell-action sipena-preview-cell-action-safe"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onAcceptSuggestedValue(cell, row, column);
                                  }}
                                >
                                  Saran
                                </button>
                              ) : null}
                            </div>
                          ) : null}
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

        {showFixPanel ? (
          <PreviewFixPanel
            model={model}
            selection={selection?.kind === "column" ? null : selection}
            selectionState={selectionState}
            onApproveColumn={onApproveColumn}
            onIgnoreColumn={onIgnoreColumn}
            onIgnoreCell={onIgnoreCell}
            onIgnoreRow={onIgnoreRow}
            onApplySafeFixes={onApplySafeFixes}
            onApproveSuggestions={() => firstManual && setSelection(firstManual)}
            onSetColumnInclude={onSetColumnInclude}
            onSetColumnValueMode={onSetColumnValueMode}
            onBulkColumnAction={onBulkColumnAction}
            onResetColumnSelection={onResetColumnSelection}
            onSetCellInclude={onSetCellInclude}
            onSetCellValueMode={onSetCellValueMode}
            onAcceptSuggestedValue={onAcceptSuggestedValue}
            onResetCellSelection={onResetCellSelection}
          />
        ) : null}
      </div>

      {selection?.kind === "column" && selection.column.type !== "identity" ? (
        <ColumnSettingsOverlay
          column={selection.column}
          assignments={assignments}
          chapters={chapters}
          onClose={() => setSelection(null)}
          onSetInclude={onSetColumnInclude}
          onSetHeader={onSetColumnHeader}
          onSetTarget={onSetColumnTarget}
          onSetValueMode={onSetColumnValueMode}
          onBulkColumnAction={onBulkColumnAction}
          onResetColumnSelection={onResetColumnSelection}
        />
      ) : null}
    </div>
  );
}

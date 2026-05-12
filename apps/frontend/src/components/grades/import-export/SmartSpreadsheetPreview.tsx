import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import type {
  CellValueMode,
  ColumnValueMode,
  ImportSelectionState,
  SmartImportAssistResponse,
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

type PreviewMode = "quick" | "detail";

function previewStatusClass(status: string): string {
  return `sipena-preview-cell--${status.replace(/_/g, "-")}`;
}

function previewStatusTone(status: string, include = true): "ready" | "skip" | "check" | "danger" | "neutral" {
  if (!include || ["ignored", "skipped", "manual_skipped"].includes(status)) return "skip";
  if (["invalid", "blocked", "manual_required"].includes(status)) return "danger";
  if (["changed", "overwrite", "needs_check", "new_column"].includes(status)) return "check";
  if (["new_value", "included", "manual_included"].includes(status)) return "ready";
  return "neutral";
}

function previewStatusLabel(status: string, include = true): string {
  if (!include || ["ignored", "skipped", "manual_skipped"].includes(status)) return "Dilewati";
  if (["invalid", "blocked", "manual_required"].includes(status)) return "Perlu dicek";
  if (status === "overwrite" || status === "changed") return "Timpa";
  if (status === "needs_check" || status === "new_column") return "Perlu dicek";
  if (status === "new_value" || status === "included" || status === "manual_included") return "Dipakai";
  return "Info";
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
    || cell.isManuallyIncluded
    || cell.isManuallySkipped
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
  onResetRowSelection,
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
  aiAssist,
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
  onResetRowSelection: (row: SpreadsheetPreviewRow) => void;
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
  aiAssist?: SmartImportAssistResponse | null;
}) {
  const [selection, setSelection] = useState<Selection>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("quick");
  const isDetailMode = previewMode === "detail";
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
    <div className={cn("sipena-preview-shell", `sipena-preview-shell--${previewMode}`)} data-preview-mode={previewMode}>
      <PreviewSummaryBanner model={model} onPrimaryAction={primarySummaryAction} />
      <div className="sipena-preview-modebar" aria-label="Mode tampilan tabel import">
        <div className="min-w-0">
          <p className="sipena-preview-modebar-title">Tampilan tabel</p>
          <p className="sipena-preview-modebar-desc">
            Mode Cepat lebih ringkas. Mode Detail menampilkan alasan, target, dan tombol per sel.
          </p>
        </div>
        <div className="sipena-preview-mode-toggle" role="group" aria-label="Pilih mode tampilan tabel">
          <button
            type="button"
            className={cn("sipena-preview-mode-button", previewMode === "quick" && "sipena-preview-mode-button-active")}
            aria-pressed={previewMode === "quick"}
            onClick={() => setPreviewMode("quick")}
          >
            Mode Cepat
          </button>
          <button
            type="button"
            className={cn("sipena-preview-mode-button", previewMode === "detail" && "sipena-preview-mode-button-active")}
            aria-pressed={previewMode === "detail"}
            onClick={() => setPreviewMode("detail")}
          >
            Mode Detail
          </button>
        </div>
      </div>
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
                          {column.type !== "identity" && isDetailMode ? (
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
                            <span className={cn(
                              "sipena-preview-status-pill",
                              `sipena-preview-status-pill--${previewStatusTone(column.status, column.effectiveInclude !== false)}`,
                            )}>
                              {column.isNewStructure ? "Kolom baru" : previewStatusLabel(column.status, column.effectiveInclude !== false)}
                            </span>
                            <span className="sipena-preview-header-action">Atur</span>
                          </span>
                        ) : null}
                      </button>
                      {column.type !== "identity" && isDetailMode ? (
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
                              {isDetailMode && detailLines.length ? (
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
                          {isDetailMode && showCellActions ? (
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
                              {(cell.isManuallySkipped || cell.isManuallyIncluded) ? (
                                <button
                                  type="button"
                                  className="sipena-preview-cell-action"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    onResetCellSelection(cell);
                                  }}
                                >
                                  Kembalikan
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
            onResetRowSelection={onResetRowSelection}
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
            aiAssist={aiAssist}
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
          aiAssist={aiAssist}
        />
      ) : null}
    </div>
  );
}

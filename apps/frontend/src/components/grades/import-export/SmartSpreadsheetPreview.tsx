import type { CSSProperties } from "react";
import { useMemo, useState } from "react";

import type {
  CellValueMode,
  ColumnValueMode,
  ImportSelectionState,
  ImportWebStudent,
  SmartImportAssistResponse,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
import { PreviewSummaryBanner } from "./PreviewSummaryBanner";
import { buildInvalidIssueQueue } from "./importIssueQueue";
import { getCellPreviewVisualState, getColumnPreviewVisualState } from "./previewVisualState";

type Selection =
  | { kind: "cell"; cell: SpreadsheetPreviewCell; row: SpreadsheetPreviewRow; column: SpreadsheetPreviewColumn }
  | { kind: "column"; column: SpreadsheetPreviewColumn }
  | { kind: "row"; row: SpreadsheetPreviewRow }
  | null;

function previewStatusTone(tone: string): "ready" | "skip" | "check" | "danger" | "neutral" {
  if (tone === "skip" || tone === "blocked") return "skip";
  if (tone === "danger") return "danger";
  if (tone === "change") return "check";
  if (tone === "new") return "ready";
  return "neutral";
}

function MiniStatusBadge({ label, description }: { label: string; description: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="sipena-import-cell-mini-badge">{label}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-xs leading-5">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

function shouldShowStatusBadge(cell: SpreadsheetPreviewCell, column: SpreadsheetPreviewColumn): boolean {
  if (column.type === "identity") return !["unchanged", "included"].includes(cell.status);
  if (cell.status === "blocked" && !cell.requiresConfirmation && (cell.isBlockedByRow || cell.isBlockedByColumn || cell.isBlockedByTarget)) {
    return false;
  }
  return !["unchanged", "included"].includes(cell.status);
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
  if (cell.convertedValue !== undefined && cell.conversionLabel) details.push(cell.conversionLabel);
  if (cell.isAutoSkippedSameValue) details.push("Sama dengan nilai SIPENA, otomatis dilewati");

  if (cell.message) details.push(cell.message);
  if (cell.effectiveInclude === false || cell.isManuallySkipped) details.push("Tidak akan disimpan");
  if (cell.status === "overwrite") details.push("Nilai lama akan ditimpa");
  if ((cell.isBlockedByRow || cell.isBlockedByColumn || cell.isBlockedByTarget) && cell.status !== "invalid") {
    details.push("Menunggu pilihan siswa atau target kolom");
  }

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

export function SmartSpreadsheetPreview({
  model,
  onApplySafeFixes,
  onApproveSuggestions,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  onResetRowSelection,
  selectionState,
  students,
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
  onChooseStudent,
  onMarkRowUnresolved,
  onOpenIssueStep,
  aiAssist,
}: {
  model: SpreadsheetPreviewModel;
  selectionState: ImportSelectionState;
  students: ImportWebStudent[];
  assignments: ColumnSettingsAssignmentOption[];
  chapters: ColumnSettingsChapterOption[];
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onResetRowSelection: (row: SpreadsheetPreviewRow) => void;
  onChooseStudent: (row: SpreadsheetPreviewRow, studentId: string) => void;
  onMarkRowUnresolved: (row: SpreadsheetPreviewRow) => void;
  onOpenIssueStep?: () => void;
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
  const isDetailMode = true;
  const invalidIssues = useMemo(() => buildInvalidIssueQueue(model), [model]);
  const hasActiveIssues = invalidIssues.length > 0 || model.summary.manualRequired > 0 || model.summary.needsCheck > 0;

  const primarySummaryAction = () => {
    if (invalidIssues.length > 0 || model.summary.manualRequired > 0 || model.summary.needsCheck > 0) {
      onOpenIssueStep?.();
      return;
    }
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
    <div className="sipena-preview-shell sipena-preview-shell--detail" data-preview-mode="detail">
      {hasActiveIssues ? (
        <PreviewSummaryBanner model={model} invalidIssueCount={invalidIssues.length} onPrimaryAction={primarySummaryAction} />
      ) : null}
      <PreviewLegend />

      <div className={cn("grid min-w-0 gap-4", showFixPanel && "xl:grid-cols-[minmax(0,1fr)_420px]")}>
        <section className="sipena-preview-grid-wrap">
          <div className="sipena-preview-scroll">
            <table className="sipena-preview-table">
              <thead>
                <tr>
                  {model.columns.map((column, index) => {
                    const visual = getColumnPreviewVisualState(column);
                    return (
                    <th
                      key={column.id}
                      className={cn(
                        index < 3 && "sipena-preview-sticky-left",
                        visual.className,
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
                              `sipena-preview-status-pill--${previewStatusTone(visual.tone)}`,
                            )}>
                              {visual.label}
                            </span>
                          </span>
                        ) : null}
                      </button>
                    </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {model.rows.length ? model.rows.map((row) => (
                  <tr key={row.id}>
                    {row.cells.map((cell, index) => {
                      const column = model.columns[index];
                      const detailLines = previewCellDetailLines(cell, column);
                      const visual = getCellPreviewVisualState(cell, column, row);
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            "sipena-preview-cell",
                            visual.className,
                            cell.isManuallyIncluded && "sipena-import-cell-manual-include",
                            cell.isManuallySkipped && "sipena-import-cell-manual-skip",
                            cell.status === "overwrite" && "sipena-import-cell-overwrite-confirmed",
                            (cell.isBlockedByColumn || cell.isBlockedByRow || cell.isBlockedByTarget) && cell.status !== "invalid" && "sipena-import-cell-blocked-by-scope",
                            index < 3 && "sipena-preview-sticky-left",
                          )}
                          style={stickyStyle(index)}
                          onClick={() => toggleCellInclude(cell, row, column)}
                          onDoubleClick={() => setSelection({ kind: "cell", cell, row, column })}
                          title={column.type === "identity" ? cell.displayValue : detailLines.join(" / ") || `${visual.description} Klik sel untuk pakai/lewati. Klik dua kali untuk detail.`}
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
                              {shouldShowStatusBadge(cell, column) ? <PreviewCellBadge status={cell.status} /> : null}
                              {cell.isManuallyIncluded ? <MiniStatusBadge label="Dipilih" description="Nilai ini dipilih manual untuk ikut diproses." /> : null}
                              {cell.isManuallySkipped ? <MiniStatusBadge label="Dilewati" description="Nilai ini dipilih manual untuk dilewati." /> : null}
                              {cell.convertedValue !== undefined ? <MiniStatusBadge label="Dikonversi" description="Nilai pecahan atau format khusus dikonversi menjadi angka 0-100." /> : null}
                              {cell.isAutoSkippedSameValue ? <MiniStatusBadge label="Sama" description="Nilai Excel sama dengan nilai SIPENA, jadi otomatis dilewati." /> : null}
                              {cell.status === "overwrite" ? <MiniStatusBadge label="Timpa" description="Nilai Excel akan mengganti nilai SIPENA setelah konfirmasi." /> : null}
                              {cell.requiresConfirmation ? <MiniStatusBadge label="Perlu cek" description="Nilai valid, tetapi keputusan target atau aksi masih perlu dicek." /> : null}
                            </span>
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

        {showFixPanel ? (
          <PreviewFixPanel
            model={model}
            selection={selection?.kind === "column" ? null : selection}
            selectionState={selectionState}
            students={students}
            onApproveColumn={onApproveColumn}
            onIgnoreColumn={onIgnoreColumn}
            onIgnoreCell={onIgnoreCell}
            onIgnoreRow={onIgnoreRow}
            onResetRowSelection={onResetRowSelection}
            onChooseStudent={onChooseStudent}
            onMarkRowUnresolved={onMarkRowUnresolved}
            onApplySafeFixes={onApplySafeFixes}
            onApproveSuggestions={onApproveSuggestions}
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
          onResetColumnSelection={onResetColumnSelection}
          aiAssist={aiAssist}
        />
      ) : null}
    </div>
  );
}

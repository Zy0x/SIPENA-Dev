import type { ReactNode } from "react";
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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import { buildCellReasonHint, buildColumnReasonHint, reasonToneClass } from "./importReasonHints";

type Selection =
  | { kind: "cell"; cell: SpreadsheetPreviewCell; row: SpreadsheetPreviewRow; column: SpreadsheetPreviewColumn }
  | { kind: "column"; column: SpreadsheetPreviewColumn }
  | { kind: "row"; row: SpreadsheetPreviewRow }
  | null;

function panelCopy(selection: NonNullable<Selection>) {
  if (selection.kind === "column") {
    return ["Atur kolom ini", "Pilih apakah kolom ini dipakai dan bagaimana nilai di dalamnya diproses."];
  }
  if (selection.kind === "row") {
    return ["Pilih siswa yang benar", "Baris ini perlu dicek agar nilai tidak masuk ke siswa yang salah."];
  }
  return ["Atur nilai ini", "Include atau lewati satu nilai tanpa mengubah pilihan nilai lain."];
}

function modeLabel(mode: CellValueMode | ColumnValueMode | undefined): string {
  if (mode === "overwrite_existing") return "Timpa setelah konfirmasi";
  if (mode === "skip_existing") return "Lewati nilai lama";
  if (mode === "fill_empty_only") return "Isi jika kosong";
  return "Ikuti pengaturan kolom";
}

function columnModeLabel(mode: ColumnValueMode | undefined): string {
  if (mode === "overwrite_existing") return "Timpa setelah konfirmasi";
  if (mode === "skip_existing") return "Lewati nilai lama";
  return "Isi jika kosong";
}

function SettingButton({
  children,
  onClick,
  tone = "default",
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  tone?: "default" | "primary" | "danger" | "warning";
  disabled?: boolean;
}) {
  const toneClass = tone === "primary"
    ? "bg-blue-600 text-white hover:bg-blue-700"
    : tone === "danger"
      ? "bg-red-600 text-white hover:bg-red-700"
      : tone === "warning"
        ? "bg-amber-500 text-white hover:bg-amber-600"
        : "border border-border bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900";
  return (
    <button type="button" className={`min-h-10 rounded-full px-4 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-55 ${toneClass}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function ColumnStats({ column }: { column: SpreadsheetPreviewColumn }) {
  const stats = column.stats;
  if (!stats) return null;
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-900"><b>{stats.validValues}</b><br />nilai terbaca</div>
      <div className="rounded-2xl bg-emerald-50 p-2 text-emerald-700 dark:bg-emerald-950/30"><b>{stats.willFill}</b><br />akan diisi</div>
      <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-900"><b>{stats.skippedExisting}</b><br />dilewati karena sudah ada</div>
      <div className="rounded-2xl bg-slate-50 p-2 dark:bg-slate-900"><b>{stats.skippedManual}</b><br />dilewati manual</div>
      <div className="rounded-2xl bg-amber-50 p-2 text-amber-700 dark:bg-amber-950/30"><b>{stats.overwrite}</b><br />akan ditimpa</div>
      <div className="rounded-2xl bg-rose-50 p-2 text-rose-700 dark:bg-rose-950/30"><b>{stats.invalid + stats.blocked}</b><br />perlu dicek</div>
    </div>
  );
}

export function PreviewFixPanel({
  model,
  selection,
  selectionState,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  onResetRowSelection,
  onApplySafeFixes,
  onApproveSuggestions,
  onSetColumnInclude,
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
  selection: Selection;
  selectionState: ImportSelectionState;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onResetRowSelection: (row: SpreadsheetPreviewRow) => void;
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
  onSetColumnInclude: (column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetColumnValueMode: (column: SpreadsheetPreviewColumn, mode: ColumnValueMode, overwriteConfirmed?: boolean) => void;
  onBulkColumnAction: (column: SpreadsheetPreviewColumn, action: "include_valid" | "skip_all" | "skip_existing" | "reset") => void;
  onResetColumnSelection: (column: SpreadsheetPreviewColumn) => void;
  onSetCellInclude: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, include: boolean) => void;
  onSetCellValueMode: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn, mode: CellValueMode, overwriteConfirmed?: boolean) => void;
  onAcceptSuggestedValue: (cell: SpreadsheetPreviewCell, row: SpreadsheetPreviewRow, column: SpreadsheetPreviewColumn) => void;
  onResetCellSelection: (cell: SpreadsheetPreviewCell) => void;
  aiAssist?: SmartImportAssistResponse | null;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [columnOverwriteChecked, setColumnOverwriteChecked] = useState(false);
  const [cellOverwriteChecked, setCellOverwriteChecked] = useState(false);
  const [title, description] = useMemo(() => (
    selection ? panelCopy(selection) : ["Atur kolom dan nilai", "Klik header kolom atau cell nilai pada tabel untuk memilih apa yang akan disimpan."]
  ), [selection]);

  const targetCell = selection?.kind === "cell" ? selection.cell : null;
  const targetColumn = selection?.kind === "cell" ? selection.column : selection?.kind === "column" ? selection.column : null;
  const targetRow = selection?.kind === "cell" ? selection.row : selection?.kind === "row" ? selection.row : null;
  const columnSetting = targetColumn ? selectionState.columnSettings[targetColumn.id] : undefined;
  const cellSetting = targetCell ? selectionState.cellSettings[targetCell.id] : undefined;
  const isGradeCell = Boolean(targetCell && targetColumn && targetColumn.type !== "identity");
  const needsSuggestedApproval = Boolean(
    targetCell
    && targetCell.suggestedValue !== undefined
    && targetCell.resolvedValue === null
    && !targetCell.acceptedSuggestedValue
  );
  const activeHint = useMemo(() => {
    if (targetCell && targetRow && targetColumn) return buildCellReasonHint(targetCell, targetRow, targetColumn, aiAssist);
    if (targetColumn) return buildColumnReasonHint(targetColumn, aiAssist);
    return null;
  }, [aiAssist, targetCell, targetColumn, targetRow]);
  const shouldConfirmOverwrite = Boolean(
    targetCell
    && isGradeCell
    && (
      targetCell.status === "changed"
      || targetCell.requiresConfirmation
      || cellSetting?.valueMode === "overwrite_existing"
    ),
  );

  const handlePrimaryCellAction = () => {
    if (!targetCell || !targetRow || !targetColumn) return;
    if (needsSuggestedApproval) {
      onAcceptSuggestedValue(targetCell, targetRow, targetColumn);
      return;
    }
    if (shouldConfirmOverwrite) {
      setCellOverwriteChecked(true);
      onSetCellValueMode(targetCell, targetRow, targetColumn, "overwrite_existing", true);
      onSetCellInclude(targetCell, targetRow, targetColumn, true);
      return;
    }
    onSetCellInclude(targetCell, targetRow, targetColumn, true);
  };

  return (
    <aside className="sipena-preview-fix-panel" aria-live="polite">
      <h4 className="sipena-preview-fix-title">{title}</h4>
      <p className="sipena-preview-fix-desc">{description}</p>

      {activeHint ? (
        <div className={`sipena-reason-card sipena-reason-card--compact ${reasonToneClass(activeHint.tone)}`}>
          <div className="min-w-0">
            <div className="sipena-reason-kicker">
              <span>{activeHint.source === "hybrid" ? "Analisis SIPENA + AI" : "Analisis SIPENA"}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="sipena-reason-help" aria-label="Lihat alasan lengkap">
                    i
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="max-w-[280px] text-xs leading-5">
                  {activeHint.description}
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="sipena-reason-title">{activeHint.label}</p>
            <p className="sipena-reason-desc">{activeHint.description}</p>
          </div>
          <span className="sipena-reason-action">{activeHint.actionLabel}</span>
        </div>
      ) : null}

      {selection ? (
        <div className="mt-3 grid gap-2 text-xs">
          {targetRow ? <div><span className="font-semibold">Siswa: </span>{targetRow.studentName}</div> : null}
          {targetColumn ? <div><span className="font-semibold">Kolom: </span>{targetColumn.header}</div> : null}
          {targetCell ? (
            <>
              <div><span className="font-semibold">Nilai Excel: </span>{targetCell.displayValue || "kosong"}</div>
              <div><span className="font-semibold">Nilai SIPENA: </span>{targetCell.oldValue ?? "kosong"}</div>
              {targetCell.suggestedValue !== undefined ? (
                <div><span className="font-semibold">Nilai saran: </span>{targetCell.suggestedValue}</div>
              ) : null}
              <div><span className="font-semibold">Keputusan: </span>{targetCell.effectiveInclude ? "Dipakai" : "Dilewati"}</div>
            </>
          ) : null}
          {targetColumn ? <div><span className="font-semibold">Mode kolom: </span>{columnModeLabel(targetColumn.effectiveValueMode)}</div> : null}
          {targetCell ? <div><span className="font-semibold">Perlakuan nilai: </span>{modeLabel(targetCell.effectiveValueMode)}</div> : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-xs">
          <div><span className="font-semibold">Nilai dipilih: </span>{model.summary.includedCells}</div>
          <div><span className="font-semibold">Nilai dilewati: </span>{model.summary.skippedCells + model.summary.manualSkippedCells}</div>
          <div><span className="font-semibold">Nilai akan ditimpa: </span>{model.summary.overwriteCells}</div>
          <div><span className="font-semibold">Nilai perlu dicek: </span>{model.summary.manualRequired + model.summary.invalidCells}</div>
        </div>
      )}

      {targetColumn && !targetCell ? (
        <div className="mt-4 rounded-2xl border border-border p-3">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Nilai di kolom ini</p>
          <ColumnStats column={targetColumn} />
          <label className="mt-3 flex items-center gap-2 text-xs font-semibold">
            <input
              type="checkbox"
              checked={targetColumn.effectiveInclude !== false}
              onChange={(event) => onSetColumnInclude(targetColumn, event.target.checked)}
            />
            Pakai kolom ini
          </label>
          <div className="mt-3 grid gap-2">
            {(["fill_empty_only", "skip_existing", "overwrite_existing"] as ColumnValueMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-2 rounded-2xl border border-border p-2 text-xs">
                <input
                  type="radio"
                  name={`column-mode-${targetColumn.id}`}
                  checked={(columnSetting?.valueMode || targetColumn.effectiveValueMode) === mode}
                  onChange={() => {
                    if (mode === "overwrite_existing") {
                      onSetColumnValueMode(targetColumn, mode, columnOverwriteChecked);
                    } else {
                      onSetColumnValueMode(targetColumn, mode, false);
                    }
                  }}
                />
                {columnModeLabel(mode)}
              </label>
            ))}
          </div>
          {(columnSetting?.valueMode || targetColumn.effectiveValueMode) === "overwrite_existing" ? (
            <label className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <input
                type="checkbox"
                checked={Boolean(columnSetting?.overwriteConfirmed || columnOverwriteChecked)}
                onChange={(event) => {
                  setColumnOverwriteChecked(event.target.checked);
                  onSetColumnValueMode(targetColumn, "overwrite_existing", event.target.checked);
                }}
              />
              Berisiko menimpa nilai: saya paham semua nilai lama pada kolom ini dapat diganti
            </label>
          ) : null}
        </div>
      ) : null}

      {targetCell && isGradeCell ? (
        <div className="mt-4 rounded-2xl border border-border p-3">
          <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Aturan nilai ini</p>
          {targetCell.effectiveInclude === false ? (
            <p className="mt-2 text-xs text-muted-foreground">Nilai ini akan dilewati dan tidak akan mengubah data.</p>
          ) : null}
          {needsSuggestedApproval ? (
            <p className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              SIPENA membaca nilai pecahan sebagai saran. Setujui dulu agar angka ini bisa disimpan.
            </p>
          ) : null}
          {showDetail ? (
          <div className="mt-3 grid gap-2">
            {(["inherit_column", "fill_empty_only", "skip_existing", "overwrite_existing"] as CellValueMode[]).map((mode) => (
              <label key={mode} className="flex items-center gap-2 rounded-2xl border border-border p-2 text-xs">
                <input
                  type="radio"
                  name={`cell-mode-${targetCell.id}`}
                  checked={(cellSetting?.valueMode || "inherit_column") === mode}
                  disabled={targetCell.isBlockedByColumn || targetCell.isBlockedByRow || targetCell.isBlockedByTarget}
                  onChange={() => {
                    if (mode === "overwrite_existing") {
                      onSetCellValueMode(targetCell, targetRow!, targetColumn!, mode, cellOverwriteChecked);
                    } else {
                      onSetCellValueMode(targetCell, targetRow!, targetColumn!, mode, false);
                    }
                  }}
                />
                {modeLabel(mode)}
              </label>
            ))}
          </div>
          ) : null}
          {(cellSetting?.valueMode === "overwrite_existing" || targetCell.requiresConfirmation) ? (
            <label className="mt-3 flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <input
                type="checkbox"
                checked={Boolean(cellSetting?.overwriteConfirmed || cellOverwriteChecked)}
                onChange={(event) => {
                  setCellOverwriteChecked(event.target.checked);
                  onSetCellValueMode(targetCell, targetRow!, targetColumn!, "overwrite_existing", event.target.checked);
                }}
              />
              Berisiko menimpa nilai: saya paham nilai ini akan menimpa nilai lama
            </label>
          ) : null}
        </div>
      ) : null}

      <div className="sipena-preview-fix-actions">
        {!selection ? (
          <>
            <SettingButton tone="primary" onClick={onApplySafeFixes}>Terapkan pemeriksaan otomatis</SettingButton>
            <SettingButton onClick={onApproveSuggestions}>Tinjau Saran AI</SettingButton>
          </>
        ) : targetCell && isGradeCell ? (
          <>
            <SettingButton
              tone="primary"
              onClick={handlePrimaryCellAction}
              disabled={targetCell.isBlockedByColumn || targetCell.isBlockedByRow || targetCell.isBlockedByTarget}
            >
              {needsSuggestedApproval ? "Pakai saran" : shouldConfirmOverwrite ? "Konfirmasi timpa" : "Pakai nilai"}
            </SettingButton>
            <SettingButton onClick={() => onSetCellInclude(targetCell, targetRow!, targetColumn!, false)}>Lewati nilai ini</SettingButton>
            <SettingButton onClick={() => onResetCellSelection(targetCell)}>Reset pilihan</SettingButton>
          </>
        ) : targetColumn ? (
          <>
            <SettingButton tone="primary" onClick={() => onBulkColumnAction(targetColumn, "include_valid")}>Include semua nilai valid</SettingButton>
            <SettingButton onClick={() => onBulkColumnAction(targetColumn, "skip_all")}>Lewati semua nilai di kolom ini</SettingButton>
            <SettingButton onClick={() => onBulkColumnAction(targetColumn, "skip_existing")}>Lewati nilai yang sudah ada</SettingButton>
            <SettingButton onClick={() => onBulkColumnAction(targetColumn, "reset")}>Reset pilihan manual</SettingButton>
            {targetColumn.status === "new_column" ? <SettingButton tone="primary" onClick={() => onApproveColumn(targetColumn)}>Konfirmasi kolom baru</SettingButton> : null}
            <SettingButton onClick={() => onIgnoreColumn(targetColumn)}>Abaikan kolom</SettingButton>
            <SettingButton onClick={() => onResetColumnSelection(targetColumn)}>Reset kolom</SettingButton>
          </>
        ) : targetRow ? (
          <>
            <SettingButton tone="primary" onClick={() => onResetRowSelection(targetRow)}>Kembalikan baris</SettingButton>
            <SettingButton onClick={() => onIgnoreRow(targetRow)}>Abaikan baris</SettingButton>
          </>
        ) : null}
        <SettingButton onClick={() => setShowDetail((current) => !current)}>
          {showDetail ? "Sembunyikan detail" : "Lihat detail"}
        </SettingButton>
      </div>

      {showDetail ? (
        <div className="sipena-preview-detail">
          <p className="text-xs leading-5 text-muted-foreground">
            Data tidak disimpan sebelum tahap Import. Pilihan nilai tidak bisa melewati target kolom atau siswa yang belum valid.
          </p>
          {targetCell?.message ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{targetCell.message}</p> : null}
          {targetCell?.status === "changed" ? (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Untuk menimpa nilai lama, pilih "Timpa nilai lama" pada nilai ini lalu centang konfirmasi risiko.
            </p>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

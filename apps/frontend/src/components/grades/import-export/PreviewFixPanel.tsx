import { useMemo, useState } from "react";

import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewModel,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

import { AdvancedImportOptions } from "./AdvancedImportOptions";
import type { UpdateMode } from "@/lib/gradeImport";

type Selection =
  | { kind: "cell"; cell: SpreadsheetPreviewCell; row: SpreadsheetPreviewRow; column: SpreadsheetPreviewColumn }
  | { kind: "column"; column: SpreadsheetPreviewColumn }
  | { kind: "row"; row: SpreadsheetPreviewRow }
  | null;

function panelCopy(selection: NonNullable<Selection>) {
  if (selection.kind === "column") {
    if (selection.column.status === "new_column") return ["Kolom baru akan ditambahkan", "Setujui kolom ini jika BAB dan tugasnya sudah benar."];
    if (selection.column.status === "manual_required") return ["Tugas ini perlu dipilih", "Pilih target kolom nilai agar nilai masuk ke tempat yang benar."];
    if (selection.column.status === "ignored") return ["Kolom ini diabaikan", "Kolom ini bukan nilai input dan tidak akan diimport."];
    return ["Target kolom nilai", "Periksa tujuan kolom sebelum lanjut."];
  }
  if (selection.kind === "row") {
    return ["Pilih siswa yang benar", "Baris ini perlu dicek agar nilai tidak masuk ke siswa yang salah."];
  }
  if (selection.cell.status === "new_value") return ["Nilai ini akan diisi", "Nilai Excel akan masuk ke sel yang masih kosong."];
  if (selection.cell.status === "changed") return ["Nilai lama berbeda", "Mode aman tetap tidak menimpa nilai lama secara otomatis."];
  if (selection.cell.status === "new_column") return ["Kolom baru akan ditambahkan", "Kolom ini berasal dari struktur baru yang perlu disetujui."];
  if (selection.cell.status === "invalid") return ["Nilai tidak valid", "SIPENA tidak bisa membaca nilai ini sebagai angka 0-100."];
  if (selection.cell.status === "manual_required") return ["Perlu dipilih manual", "Bagian ini harus dipilih agar nilai tidak salah masuk."];
  if (selection.cell.status === "ignored") return ["Bagian ini diabaikan", "Data ini tidak akan mengubah nilai lama."];
  return ["Tidak ada perubahan", "Bagian ini tidak mengubah nilai yang sudah ada."];
}

export function PreviewFixPanel({
  model,
  selection,
  updateMode,
  onUpdateModeChange,
  onApproveColumn,
  onIgnoreColumn,
  onIgnoreCell,
  onIgnoreRow,
  onApplySafeFixes,
  onApproveSuggestions,
}: {
  model: SpreadsheetPreviewModel;
  selection: Selection;
  updateMode: UpdateMode;
  onUpdateModeChange: (mode: UpdateMode) => void;
  onApproveColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreColumn: (column: SpreadsheetPreviewColumn) => void;
  onIgnoreCell: (cell: SpreadsheetPreviewCell) => void;
  onIgnoreRow: (row: SpreadsheetPreviewRow) => void;
  onApplySafeFixes: () => void;
  onApproveSuggestions: () => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const [title, description] = useMemo(() => (
    selection ? panelCopy(selection) : ["Pilih bagian pada tabel", "Klik sel, kolom, atau baris berwarna untuk melihat tindakan sederhana."]
  ), [selection]);

  const targetCell = selection?.kind === "cell" ? selection.cell : null;
  const targetColumn = selection?.kind === "cell" ? selection.column : selection?.kind === "column" ? selection.column : null;
  const targetRow = selection?.kind === "cell" ? selection.row : selection?.kind === "row" ? selection.row : null;

  return (
    <aside className="sipena-preview-fix-panel" aria-live="polite">
      <h4 className="sipena-preview-fix-title">{title}</h4>
      <p className="sipena-preview-fix-desc">{description}</p>

      {selection ? (
        <div className="mt-3 grid gap-2 text-xs">
          {targetRow ? <div><span className="font-semibold">Siswa: </span>{targetRow.studentName}</div> : null}
          {targetColumn ? <div><span className="font-semibold">Kolom: </span>{targetColumn.header}</div> : null}
          {targetCell ? (
            <>
              <div><span className="font-semibold">Nilai lama: </span>{targetCell.oldValue ?? "kosong"}</div>
              <div><span className="font-semibold">Nilai Excel: </span>{(targetCell.newValue ?? targetCell.displayValue) || "kosong"}</div>
            </>
          ) : null}
          {targetColumn?.chapterName ? <div><span className="font-semibold">BAB: </span>{targetColumn.chapterName}</div> : null}
          {targetColumn?.assignmentName ? <div><span className="font-semibold">Tugas: </span>{targetColumn.assignmentName}</div> : null}
        </div>
      ) : (
        <div className="mt-3 grid gap-2 text-xs">
          <div><span className="font-semibold">Siap: </span>{model.summary.readyCells} sel</div>
          <div><span className="font-semibold">Perlu dipilih: </span>{model.summary.manualRequired} bagian</div>
        </div>
      )}

      <div className="sipena-preview-fix-actions">
        {!selection ? (
          <>
            <button type="button" className="min-h-10 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700" onClick={onApplySafeFixes}>Terapkan yang aman</button>
            <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={onApproveSuggestions}>Setujui saran</button>
          </>
        ) : targetCell?.status === "new_value" ? (
          <>
            <button type="button" className="min-h-10 rounded-full bg-emerald-600 px-4 text-xs font-semibold text-white hover:bg-emerald-700">Biarkan</button>
            <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreCell(targetCell)}>Abaikan nilai ini</button>
          </>
        ) : targetCell?.status === "changed" ? (
          <>
            <button type="button" className="min-h-10 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700" onClick={() => onUpdateModeChange("fill_empty_only")}>Biarkan mode aman</button>
            <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreCell(targetCell)}>Abaikan nilai Excel</button>
          </>
        ) : targetCell?.status === "invalid" ? (
          <>
            <button type="button" className="min-h-10 rounded-full bg-slate-700 px-4 text-xs font-semibold text-white hover:bg-slate-800" onClick={() => onIgnoreCell(targetCell)}>Abaikan nilai</button>
            {targetColumn ? <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreColumn(targetColumn)}>Abaikan kolom</button> : null}
          </>
        ) : targetColumn?.status === "new_column" || targetCell?.status === "new_column" ? (
          <>
            {targetColumn ? <button type="button" className="min-h-10 rounded-full bg-indigo-600 px-4 text-xs font-semibold text-white hover:bg-indigo-700" onClick={() => onApproveColumn(targetColumn)}>Setujui kolom baru</button> : null}
            {targetColumn ? <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreColumn(targetColumn)}>Abaikan kolom</button> : null}
          </>
        ) : targetRow?.status === "manual_required" || targetCell?.status === "manual_required" || targetColumn?.status === "manual_required" ? (
          <>
            {targetColumn ? <button type="button" className="min-h-10 rounded-full bg-red-600 px-4 text-xs font-semibold text-white hover:bg-red-700" onClick={() => setShowDetail(true)}>Pilih target</button> : null}
            {targetRow ? <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreRow(targetRow)}>Abaikan baris</button> : null}
            {targetColumn && !targetRow ? <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreColumn(targetColumn)}>Abaikan kolom</button> : null}
          </>
        ) : (
          <>
            <button type="button" className="min-h-10 rounded-full bg-blue-600 px-4 text-xs font-semibold text-white hover:bg-blue-700">Biarkan</button>
            {targetColumn ? <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => onIgnoreColumn(targetColumn)}>Abaikan kolom</button> : null}
          </>
        )}
        <button type="button" className="min-h-10 rounded-full border border-border px-4 text-xs font-semibold" onClick={() => setShowDetail((current) => !current)}>
          Lihat alasan SIPENA
        </button>
      </div>

      {showDetail ? (
        <div className="sipena-preview-advanced">
          <p className="text-xs leading-5 text-muted-foreground">
            Status warna berasal dari preview ImportPlan. Data tidak disimpan sebelum tahap Import.
          </p>
          {targetCell?.message ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{targetCell.message}</p> : null}
          {targetCell?.status === "changed" ? (
            <div className="mt-3">
              <AdvancedImportOptions updateMode={updateMode} onUpdateModeChange={onUpdateModeChange} />
            </div>
          ) : null}
        </div>
      ) : null}
    </aside>
  );
}

import type {
  SmartImportAssistResponse,
  SmartImportAssistSuggestion,
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

export type ImportReasonTone = "safe" | "warning" | "danger" | "info";
export type ImportReasonSource = "local" | "ai" | "hybrid";

export interface ImportReasonHint {
  label: string;
  description: string;
  source: ImportReasonSource;
  actionLabel: string;
  tone: ImportReasonTone;
}

function formatValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "kosong";
  return String(value);
}

function previewColumnIndex(column: SpreadsheetPreviewColumn): number | undefined {
  const value = Number(column.id.replace("excel-col-", ""));
  return Number.isFinite(value) ? value : undefined;
}

function previewRowIndex(row: SpreadsheetPreviewRow): number | undefined {
  const value = Number(row.id.replace("row-", ""));
  return Number.isFinite(value) ? value : undefined;
}

function aiSuggestionFor(
  response: SmartImportAssistResponse | null | undefined,
  type: SmartImportAssistSuggestion["type"],
  rowIndex?: number,
  columnIndex?: number,
): SmartImportAssistSuggestion | undefined {
  if (!response?.suggestions?.length) return undefined;
  return response.suggestions.find((suggestion) => {
    if (suggestion.type !== type) return false;
    if (rowIndex !== undefined && suggestion.rowIndex !== rowIndex) return false;
    if (columnIndex !== undefined && suggestion.columnIndex !== columnIndex) return false;
    return true;
  });
}

function withAiReason(hint: ImportReasonHint, suggestion?: SmartImportAssistSuggestion): ImportReasonHint {
  if (!suggestion?.reason) return hint;
  return {
    ...hint,
    description: `${hint.description} Saran AI: ${suggestion.reason}`,
    source: "hybrid",
    actionLabel: suggestion.suggestedAction || hint.actionLabel,
  };
}

export function buildColumnReasonHint(
  column: SpreadsheetPreviewColumn,
  aiResponse?: SmartImportAssistResponse | null,
): ImportReasonHint {
  const stats = column.stats;
  const target = column.targetLabel || column.sourceHeader || "target belum jelas";
  const columnIndex = previewColumnIndex(column);
  const aiSuggestion = aiSuggestionFor(aiResponse, column.isNewStructure ? "structure" : "column", undefined, columnIndex)
    || aiSuggestionFor(aiResponse, "column", undefined, columnIndex);

  let hint: ImportReasonHint;
  if (column.effectiveInclude === false || column.isIgnored) {
    hint = {
      label: "Kolom dilewati",
      description: `Kolom ini tidak akan disimpan. Target terbaca: ${target}.`,
      source: "local",
      actionLabel: "Pakai kolom",
      tone: "info",
    };
  } else if (column.status === "invalid" || column.status === "blocked" || column.status === "manual_required") {
    hint = {
      label: "Kolom belum jelas",
      description: `Kolom ini memiliki nilai, tetapi targetnya belum aman. Pilih tugas, STS, SAS, atau lewati kolom.`,
      source: "local",
      actionLabel: "Ubah target",
      tone: "danger",
    };
  } else if (column.isNewStructure || column.status === "new_column") {
    hint = {
      label: "Kolom baru",
      description: `SIPENA membaca kolom ini sebagai struktur baru. Konfirmasi hanya jika target ${target} memang benar.`,
      source: "local",
      actionLabel: "Konfirmasi target",
      tone: "warning",
    };
  } else if ((stats?.overwrite || 0) > 0) {
    hint = {
      label: "Ada nilai lama berbeda",
      description: `${stats?.overwrite || 0} nilai pada kolom ini berpotensi menimpa nilai lama. Default aman tidak menimpa tanpa konfirmasi.`,
      source: "local",
      actionLabel: "Cek nilai lama",
      tone: "warning",
    };
  } else if ((stats?.invalid || 0) + (stats?.blocked || 0) > 0) {
    hint = {
      label: "Ada nilai perlu dicek",
      description: `${(stats?.invalid || 0) + (stats?.blocked || 0)} nilai belum siap disimpan karena invalid, diblokir, atau butuh konfirmasi.`,
      source: "local",
      actionLabel: "Lihat nilai",
      tone: "danger",
    };
  } else {
    hint = {
      label: "Kolom siap dipakai",
      description: `Kolom diarahkan ke ${target}. ${stats?.willImport || 0} nilai siap disimpan sesuai aturan aman.`,
      source: "local",
      actionLabel: "Pakai kolom",
      tone: "safe",
    };
  }

  return withAiReason(hint, aiSuggestion);
}

export function buildCellReasonHint(
  cell: SpreadsheetPreviewCell,
  row: SpreadsheetPreviewRow,
  column: SpreadsheetPreviewColumn,
  aiResponse?: SmartImportAssistResponse | null,
): ImportReasonHint {
  const oldValue = formatValue(cell.oldValue);
  const excelValue = formatValue(cell.rawValue ?? cell.displayValue);
  const nextValue = formatValue(cell.resolvedValue ?? cell.newValue ?? cell.suggestedValue);
  const rowIndex = previewRowIndex(row);
  const columnIndex = previewColumnIndex(column);
  const aiSuggestion = aiSuggestionFor(aiResponse, "value", rowIndex, columnIndex);

  let hint: ImportReasonHint;
  if (cell.status === "invalid") {
    hint = {
      label: "Nilai di luar aturan",
      description: `Nilai Excel ${excelValue} tidak bisa disimpan. Nilai harus angka 0 sampai 100.`,
      source: "local",
      actionLabel: "Lewati nilai",
      tone: "danger",
    };
  } else if (cell.status === "blocked" || cell.status === "manual_required" || cell.isBlockedByColumn || cell.isBlockedByRow || cell.isBlockedByTarget) {
    hint = {
      label: "Target belum aman",
      description: `Nilai belum bisa disimpan karena siswa, kolom, atau targetnya belum aman. Selesaikan target dulu agar nilai tidak masuk ke tempat salah.`,
      source: "local",
      actionLabel: "Cek target",
      tone: "danger",
    };
  } else if (cell.suggestedValue !== undefined && cell.resolvedValue === null && !cell.acceptedSuggestedValue) {
    hint = {
      label: "Nilai perlu konfirmasi",
      description: `Excel berisi ${excelValue}. SIPENA menyarankan ${cell.suggestedValue}, tetapi tidak akan menyimpannya sebelum disetujui.`,
      source: "local",
      actionLabel: `Pakai saran ${cell.suggestedValue}`,
      tone: "warning",
    };
  } else if (cell.status === "changed" || cell.requiresConfirmation) {
    hint = {
      label: "Nilai lama berbeda",
      description: `Nilai SIPENA ${oldValue}, Excel ${excelValue}. Default aman melewati nilai ini agar tidak menimpa tanpa konfirmasi.`,
      source: "local",
      actionLabel: "Konfirmasi timpa",
      tone: "warning",
    };
  } else if (cell.status === "overwrite") {
    hint = {
      label: "Siap menimpa",
      description: `Nilai SIPENA ${oldValue} akan diganti menjadi ${nextValue} karena sudah dikonfirmasi.`,
      source: "local",
      actionLabel: "Biarkan",
      tone: "warning",
    };
  } else if (cell.effectiveInclude === false || cell.isManuallySkipped || cell.status === "skipped") {
    hint = {
      label: "Nilai dilewati",
      description: `Nilai Excel ${excelValue} tidak akan mengubah data SIPENA. Nilai lama tetap ${oldValue}.`,
      source: "local",
      actionLabel: "Pakai nilai",
      tone: "info",
    };
  } else if (cell.status === "new_value") {
    hint = {
      label: "Nilai kosong akan diisi",
      description: `Nilai SIPENA masih kosong. Excel ${excelValue} akan disimpan sebagai ${nextValue}.`,
      source: "local",
      actionLabel: "Biarkan",
      tone: "safe",
    };
  } else {
    hint = {
      label: "Nilai siap dipakai",
      description: cell.message || `Nilai Excel ${excelValue} siap diproses sesuai aturan kolom.`,
      source: "local",
      actionLabel: "Pakai nilai",
      tone: "safe",
    };
  }

  return withAiReason(hint, aiSuggestion);
}

export function reasonToneClass(tone: ImportReasonTone): string {
  if (tone === "safe") return "sipena-reason-card--safe";
  if (tone === "warning") return "sipena-reason-card--warning";
  if (tone === "danger") return "sipena-reason-card--danger";
  return "sipena-reason-card--info";
}

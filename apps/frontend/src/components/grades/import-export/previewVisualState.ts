import type {
  SpreadsheetPreviewCell,
  SpreadsheetPreviewColumn,
  SpreadsheetPreviewRow,
} from "@/lib/gradeImport";

export type PreviewVisualTone = "neutral" | "new" | "change" | "danger" | "skip" | "blocked";

export interface PreviewVisualState {
  tone: PreviewVisualTone;
  className: string;
  label: string;
  description: string;
}

function hasDifferentExistingValue(cell: SpreadsheetPreviewCell): boolean {
  const oldValue = cell.oldValue;
  const nextValue = cell.resolvedValue ?? cell.newValue ?? cell.suggestedValue;
  return oldValue !== null
    && oldValue !== undefined
    && nextValue !== null
    && nextValue !== undefined
    && Number(oldValue) !== Number(nextValue);
}

function state(
  tone: PreviewVisualTone,
  label: string,
  description: string,
): PreviewVisualState {
  return {
    tone,
    label,
    description,
    className: `sipena-preview-visual--${tone}`,
  };
}

export function getColumnPreviewVisualState(column: SpreadsheetPreviewColumn): PreviewVisualState {
  if (column.type === "identity") {
    return state("neutral", "Identitas", "Kolom identitas siswa.");
  }
  if (column.effectiveInclude === false || column.isIgnored || ["ignored", "skipped", "manual_skipped"].includes(column.status)) {
    return state("skip", "Dilewati", "Kolom ini tidak akan diimport.");
  }
  if (["invalid", "blocked", "manual_required"].includes(column.status)) {
    return state("danger", "Bermasalah", "Target kolom belum aman. Atur kolom sebelum import.");
  }
  if (["changed", "overwrite", "needs_check", "new_column"].includes(column.status) || column.isNewStructure) {
    return state("change", column.isNewStructure ? "Kolom baru" : "Perlu cek", "Kolom perlu dikonfirmasi atau targetnya perlu dicek.");
  }
  if (column.status === "new_value") {
    return state("new", "Nilai baru", "Kolom berisi nilai baru yang siap diisi.");
  }
  return state("neutral", "Netral", "Kolom tidak memiliki masalah khusus.");
}

export function getCellPreviewVisualState(
  cell: SpreadsheetPreviewCell,
  column: SpreadsheetPreviewColumn,
  row?: SpreadsheetPreviewRow,
): PreviewVisualState {
  const rowNeedsStudentAction = row?.status === "manual_required" || cell.status === "manual_required";
  const isIdentity = column.type === "identity";

  if (isIdentity && rowNeedsStudentAction) {
    return state("danger", "Siswa bermasalah", "Data siswa pada baris ini perlu dipilih atau dilewati.");
  }

  if (cell.status === "invalid") {
    return state("danger", "Tidak valid", "Nilai Excel tidak valid dan tidak bisa diimport otomatis.");
  }

  if (!cell.isManuallySkipped && !["ignored", "manual_skipped"].includes(cell.status) && (cell.isBlockedByRow || cell.isBlockedByColumn || cell.isBlockedByTarget || cell.status === "blocked" || cell.status === "manual_required")) {
    if (cell.requiresConfirmation) {
      return state("change", "Perlu konfirmasi", "Nilai perlu dikonfirmasi sebelum disimpan.");
    }
    return state("blocked", "Ditahan", "Nilai valid ini ditahan sampai siswa atau target kolom beres.");
  }

  if (cell.effectiveInclude === false || cell.isManuallySkipped || ["ignored", "skipped", "manual_skipped"].includes(cell.status)) {
    if (hasDifferentExistingValue(cell)) {
      return state("change", "Nilai lama berbeda", "Nilai Excel berbeda dari nilai SIPENA. Default aman melewati nilai ini.");
    }
    return state("skip", "Dilewati", "Nilai ini tidak akan disimpan.");
  }

  if (cell.requiresConfirmation || cell.status === "needs_check") {
    return state("change", "Perlu konfirmasi", "Nilai perlu dikonfirmasi sebelum disimpan.");
  }

  if (hasDifferentExistingValue(cell) || ["changed", "overwrite"].includes(cell.status)) {
    return state("change", "Perubahan nilai", "Nilai Excel berbeda dari nilai SIPENA atau akan menimpa nilai lama.");
  }

  if (cell.status === "new_value" || cell.status === "manual_included") {
    return state("new", "Nilai baru", "Nilai ini siap diisi ke data yang masih kosong.");
  }

  if (cell.status === "new_column") {
    return state("change", "Kolom baru", "Nilai berada pada kolom baru yang perlu dikonfirmasi.");
  }

  return state("neutral", "Netral", "Tidak ada masalah khusus pada sel ini.");
}

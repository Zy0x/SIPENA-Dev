import type { PreviewCellStatus } from "@/lib/gradeImport";

const labelByStatus: Record<PreviewCellStatus, string> = {
  unchanged: "Tetap",
  included: "Dipilih",
  new_value: "Isi",
  changed: "Beda",
  new_column: "Baru",
  needs_check: "Cek",
  manual_required: "Pilih",
  ignored: "Lewati",
  invalid: "Tidak valid",
  skipped: "Lewati",
  manual_included: "Dipilih",
  manual_skipped: "Dilewati",
  blocked: "Perlu target",
  overwrite: "Timpa",
};

export function PreviewCellBadge({ status }: { status: PreviewCellStatus }) {
  if (status === "unchanged" || status === "included") return null;

  return (
    <span className="sipena-preview-cell-badge">
      {labelByStatus[status]}
    </span>
  );
}

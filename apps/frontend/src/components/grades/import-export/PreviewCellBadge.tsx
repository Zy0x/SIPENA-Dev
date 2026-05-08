import type { PreviewCellStatus } from "@/lib/gradeImport";

const labelByStatus: Record<PreviewCellStatus, string> = {
  unchanged: "Tetap",
  new_value: "Isi",
  changed: "Beda",
  new_column: "Baru",
  needs_check: "Cek",
  manual_required: "Pilih",
  ignored: "Lewati",
  invalid: "Invalid",
};

export function PreviewCellBadge({ status }: { status: PreviewCellStatus }) {
  if (status === "unchanged") return null;

  return (
    <span className="sipena-preview-cell-badge">
      {labelByStatus[status]}
    </span>
  );
}

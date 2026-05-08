import type { PreviewCellStatus } from "@/lib/gradeImport";

const legendItems: Array<{ status: PreviewCellStatus; label: string }> = [
  { status: "unchanged", label: "Tidak berubah" },
  { status: "new_value", label: "Akan diisi" },
  { status: "changed", label: "Nilai berbeda" },
  { status: "new_column", label: "Kolom baru" },
  { status: "needs_check", label: "Perlu dicek" },
  { status: "manual_required", label: "Harus dipilih" },
  { status: "ignored", label: "Diabaikan" },
  { status: "invalid", label: "Nilai tidak valid" },
];

export function PreviewLegend() {
  return (
    <div className="sipena-preview-legend" aria-label="Keterangan warna preview import">
      {legendItems.map((item) => (
        <div key={item.status} className="sipena-preview-legend-item">
          <span className={`sipena-preview-legend-dot sipena-preview-cell--${item.status.replace(/_/g, "-")}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

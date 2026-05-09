import type { PreviewCellStatus } from "@/lib/gradeImport";

const legendItems: Array<{ status: PreviewCellStatus; label: string }> = [
  { status: "unchanged", label: "Tidak berubah" },
  { status: "new_value", label: "Akan diisi" },
  { status: "included", label: "Dipilih" },
  { status: "skipped", label: "Dilewati" },
  { status: "overwrite", label: "Timpa" },
  { status: "new_column", label: "Kolom baru" },
  { status: "needs_check", label: "Perlu dicek" },
  { status: "blocked", label: "Perlu target" },
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

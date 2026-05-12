import type { PreviewCellStatus } from "@/lib/gradeImport";

const legendItems: Array<{ status: PreviewCellStatus; label: string }> = [
  { status: "unchanged", label: "Netral" },
  { status: "new_value", label: "Akan diisi" },
  { status: "needs_check", label: "Perlu konfirmasi" },
  { status: "invalid", label: "Bermasalah" },
  { status: "skipped", label: "Dilewati" },
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

import type { PreviewVisualTone } from "./previewVisualState";

const legendItems: Array<{ tone: PreviewVisualTone; label: string }> = [
  { tone: "neutral", label: "Netral" },
  { tone: "new", label: "Nilai baru" },
  { tone: "change", label: "Perubahan/timpa" },
  { tone: "danger", label: "Bermasalah" },
  { tone: "skip", label: "Dilewati" },
  { tone: "blocked", label: "Ditahan" },
];

export function PreviewLegend() {
  return (
    <div className="sipena-preview-legend" aria-label="Keterangan warna preview import">
      {legendItems.map((item) => (
        <div key={item.tone} className="sipena-preview-legend-item">
          <span className={`sipena-preview-legend-dot sipena-preview-visual--${item.tone}`} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

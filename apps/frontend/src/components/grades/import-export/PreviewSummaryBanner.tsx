import type { SpreadsheetPreviewModel } from "@/lib/gradeImport";

export function PreviewSummaryBanner({
  model,
  onPrimaryAction,
}: {
  model: SpreadsheetPreviewModel;
  onPrimaryAction: () => void;
}) {
  const manualCount = model.summary.manualRequired;
  const needsCheckCount = model.summary.needsCheck;
  const title = manualCount > 0
    ? "Perlu dicek sebelum import"
    : needsCheckCount > 0
      ? "Hampir siap diimport"
      : "Siap diimport";
  const description = manualCount > 0
    ? `Selesaikan ${manualCount} bagian merah agar nilai tidak salah masuk.`
    : needsCheckCount > 0
      ? "Ada beberapa saran SIPENA yang bisa Anda setujui."
      : "Periksa warna pada tabel, lalu lanjutkan. Mode aman aktif.";
  const cta = manualCount > 0 ? "Pilih bagian merah" : needsCheckCount > 0 ? "Setujui Saran SIPENA" : "Lanjutkan";

  return (
    <section className="sipena-preview-banner">
      <div className="min-w-0">
        <h3 className="sipena-preview-banner-title">{title}</h3>
        <p className="sipena-preview-banner-desc">{description}</p>
        <div className="sipena-preview-stat-row">
          <span className="sipena-preview-stat">{model.summary.readyCells} siap</span>
          <span className="sipena-preview-stat">{model.summary.newValueCells} akan diisi</span>
          <span className="sipena-preview-stat">{model.summary.changedCells} nilai berbeda</span>
          <span className="sipena-preview-stat">{model.summary.newColumns} kolom baru</span>
          <span className="sipena-preview-stat">{model.summary.needsCheck} perlu dicek</span>
          <span className="sipena-preview-stat">{model.summary.manualRequired} harus dipilih</span>
        </div>
      </div>
      <button type="button" className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" onClick={onPrimaryAction}>
        {cta}
      </button>
    </section>
  );
}

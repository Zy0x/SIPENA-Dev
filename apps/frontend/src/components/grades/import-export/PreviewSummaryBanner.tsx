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
    ? "Atur kolom dan nilai yang akan diimport"
    : needsCheckCount > 0
      ? "Atur kolom dan nilai yang akan diimport"
      : "Atur kolom dan nilai yang akan diimport";
  const description = manualCount > 0
    ? `Pilih kolom yang dipakai. Masih ada ${manualCount} bagian merah yang perlu dipilih.`
    : needsCheckCount > 0
      ? "Pilih kolom yang dipakai. Jika perlu, klik nilai tertentu untuk dilewati atau diatur manual."
      : "Pilih kolom yang dipakai. Jika perlu, klik nilai tertentu untuk dilewati atau diatur manual.";
  const cta = manualCount > 0 ? "Pilih bagian merah" : needsCheckCount > 0 ? "Setujui Saran SIPENA" : "Terapkan yang aman";

  return (
    <section className="sipena-preview-banner">
      <div className="min-w-0">
        <h3 className="sipena-preview-banner-title">{title}</h3>
        <p className="sipena-preview-banner-desc">{description}</p>
        <div className="sipena-preview-stat-row">
          <span className="sipena-preview-stat">{model.columns.filter((column) => column.effectiveInclude !== false && column.type !== "identity").length} kolom dipakai</span>
          <span className="sipena-preview-stat">{model.columns.filter((column) => column.effectiveInclude === false && column.type !== "identity").length} kolom dilewati</span>
          <span className="sipena-preview-stat">{model.summary.includedCells} nilai siap</span>
          <span className="sipena-preview-stat">{model.summary.newValueCells} akan diisi</span>
          <span className="sipena-preview-stat">{model.summary.manualSkippedCells + model.summary.skippedCells} nilai dilewati</span>
          <span className="sipena-preview-stat">{model.summary.overwriteCells} nilai akan ditimpa</span>
          <span className="sipena-preview-stat">{model.summary.manualRequired} perlu dipilih</span>
          {model.summary.missingInExcelStudents > 0 ? (
            <span className="sipena-preview-stat">{model.summary.missingInExcelStudents} siswa di web tidak ada di Excel; nilainya tidak akan berubah.</span>
          ) : null}
        </div>
      </div>
      <button type="button" className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" onClick={onPrimaryAction}>
        {cta}
      </button>
    </section>
  );
}

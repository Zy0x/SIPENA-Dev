import type { SpreadsheetPreviewModel } from "@/lib/gradeImport";

export function PreviewSummaryBanner({
  model,
  invalidIssueCount = 0,
  onPrimaryAction,
}: {
  model: SpreadsheetPreviewModel;
  invalidIssueCount?: number;
  onPrimaryAction: () => void;
}) {
  const manualCount = model.summary.manualRequired;
  const needsCheckCount = model.summary.needsCheck;
  const title = invalidIssueCount > 0
    ? "Selesaikan nilai bermasalah dulu"
    : manualCount > 0
      ? "Atur kolom dan nilai yang akan disimpan"
      : needsCheckCount > 0
        ? "Atur kolom dan nilai yang akan disimpan"
        : "Atur kolom dan nilai yang akan disimpan";
  const description = invalidIssueCount > 0
    ? `${invalidIssueCount} item perlu dicek sebelum import aman. Selesaikan satu per satu atau lewati yang tidak dipakai.`
    : manualCount > 0
      ? `Klik header untuk atur kolom. Masih ada ${manualCount} bagian merah yang perlu dipilih.`
      : needsCheckCount > 0
        ? "Klik header untuk atur kolom. Klik sel untuk pakai/lewati atau diatur manual."
        : "Klik header untuk atur kolom. Klik sel untuk pakai/lewati atau diatur manual.";
  const cta = invalidIssueCount > 0
    ? "Buka daftar masalah"
    : manualCount > 0
      ? "Buka daftar masalah"
      : needsCheckCount > 0
        ? "Buka daftar masalah"
        : "Lihat verifikasi tabel";

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
            <span className="sipena-preview-stat">{model.summary.missingInExcelStudents} siswa di kelas aktif tidak ada di Excel; nilainya tidak akan berubah.</span>
          ) : null}
        </div>
      </div>
      <button type="button" className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700" onClick={onPrimaryAction}>
        {cta}
      </button>
    </section>
  );
}

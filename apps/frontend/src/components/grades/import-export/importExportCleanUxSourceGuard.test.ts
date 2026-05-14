import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function readSource(path: string) {
  return readFileSync(join(repoRoot, path), "utf8");
}

describe("clean import/export UX source guards", () => {
  const dialogSource = readSource("apps/frontend/src/components/grades/GradeImportExportDialog.tsx");
  const dropzoneSource = readSource("apps/frontend/src/components/grades/import-export/ImportDropzone.tsx");
  const previewSource = readSource("apps/frontend/src/components/grades/import-export/SmartSpreadsheetPreview.tsx");
  const cssSource = readSource("apps/frontend/src/index.css");

  it("opens the same upload file picker from the first footer primary action", () => {
    expect(dropzoneSource).toContain("inputRef?: RefObject<HTMLInputElement>");
    expect(dialogSource).toContain("uploadInputRef.current?.click()");
    expect(dialogSource).toContain("uploadInputRef={uploadInputRef}");
  });

  it("does not render a footer close button or redundant issue queue button", () => {
    const footerSource = dialogSource.slice(dialogSource.indexOf("<footer"), dialogSource.indexOf("</footer>"));

    expect(footerSource).not.toContain("Tutup");
    expect(footerSource).not.toContain("sticky bottom-0");
    expect(previewSource).not.toContain("Buka Daftar Bermasalah");
    expect(previewSource).not.toContain("onIgnoreNonGradeColumns");
  });

  it("keeps post-upload import work area free from redundant summary panels", () => {
    expect(dialogSource).not.toContain("ImportSummaryPanel");
    expect(dialogSource).not.toContain("showImportSummarySidebar");
    expect(dialogSource).not.toContain('MetricCard label="Siswa cocok"');
    expect(dialogSource).not.toContain('MetricCard label="Siswa ambigu"');
    expect(dialogSource).not.toContain('MetricCard label="Kolom nilai"');
    expect(dialogSource).not.toContain('MetricCard label="Tugas baru"');
    expect(dialogSource).not.toContain('MetricCard label="Nilai tidak valid"');
  });

  it("keeps the issue step height efficient near the footer", () => {
    const issueBodyStyles = cssSource.slice(
      cssSource.indexOf(".sipena-import-body--issue-step"),
      cssSource.indexOf(".sipena-issue-step-header"),
    );
    const issueFixStackStyles = cssSource.slice(
      cssSource.indexOf(".sipena-issue-fix-stack"),
      cssSource.indexOf(".sipena-issue-active-summary"),
    );

    expect(cssSource).toContain(".sipena-issue-step");
    expect(issueBodyStyles).toContain("overflow-y: auto");
    expect(issueBodyStyles).toContain("padding-bottom: 18px");
    expect(issueBodyStyles).not.toContain("overflow-y: hidden");
    expect(issueFixStackStyles).toContain("overflow-y: visible");
    expect(cssSource).not.toContain("height: clamp(520px, calc(100dvh - 238px), 720px)");
    expect(cssSource).not.toContain("padding-bottom: 128px");
    expect(cssSource).not.toContain("padding-bottom: 144px");
  });

  it("keeps backend terms behind user-facing labels", () => {
    expect(dialogSource).toContain('blocked: "Perlu diselesaikan"');
    expect(dialogSource).toContain('manual_required: "Perlu dipilih"');
    expect(dialogSource).toContain('fill_empty_only: "Isi yang kosong"');
    expect(dialogSource).toContain('overwrite_existing: "Timpa setelah konfirmasi"');

    expect(dialogSource).not.toContain("Ditahan");
    expect(dialogSource).not.toContain("Diblokir");
    expect(dialogSource).not.toContain("item tertahan");
    expect(dialogSource).not.toContain("Di-skip");
  });

  it("keeps final review focused on values that will be saved", () => {
    expect(dialogSource).toContain("finalReviewOperationKey");
    expect(dialogSource).toContain("executableValueKeys.has");
    expect(dialogSource).toContain("sipena-final-result-empty");
    expect(dialogSource).toContain('MetricCard label="Nilai baru"');
    expect(dialogSource).not.toContain('MetricCard label="Di-skip"');
  });
});

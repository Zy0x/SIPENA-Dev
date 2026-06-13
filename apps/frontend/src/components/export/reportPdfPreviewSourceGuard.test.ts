import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(path, "utf8");
}

describe("generic report PDF preview source guard", () => {
  it("keeps export preview rendered from the same PDF document as export", () => {
    const previewEntrypoint = source("apps/frontend/src/components/export/SignaturePreviewCanvas.tsx");
    const previewCanvas = source("apps/frontend/src/components/export/ReportPdfPreviewCanvas.tsx");
    const pdfEngine = source("apps/frontend/src/lib/exportEngine/pdfEngine.ts");

    expect(previewEntrypoint).toContain("./ReportPdfPreviewCanvas");
    expect(previewEntrypoint).not.toContain("./SignaturePreviewDocument");
    expect(previewCanvas).toContain("buildReportPdfDocumentResult(config)");
    expect(previewCanvas).toContain("renderedSignaturePlacement");
    expect(previewCanvas).toContain("getDocument({ data:");
    expect(pdfEngine).toContain("resolveSignaturePlacementFromBounds");
    expect(pdfEngine).toContain("finalY + layoutPlan.metrics.signatureGapMm");
    expect(pdfEngine).toContain("export function buildReportPdfDocument");
    expect(pdfEngine).toContain("buildReportPdfDocument(config).save");
  });
});

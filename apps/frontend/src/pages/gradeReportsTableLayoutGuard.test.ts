import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

describe("grade reports table layout guard", () => {
  it("uses an input-grade style layered shell with stable grouped headers and frozen columns", () => {
    const source = readSource("apps/frontend/src/pages/GradeReports.tsx");

    expect(source).toContain("sipena-report-grade-table-shell sipena-scroll-chain-page");
    expect(source).toContain("relative h-[70dvh] min-h-[420px] overflow-hidden bg-background");
    expect(source).toContain("reportColumnLayouts");
    expect(source).toContain("reportFrozenWidth");
    expect(source).toContain("reportScrollLeft");
    expect(source).toContain("reportScrollTop");
    expect(source).toContain("sipena-grade-scroll sipena-scroll-chain-page");
    expect(source).toContain("sipena-grade-frozen-layer");
    expect(source).toContain("estimateReportWrappedLineCount");
    expect(source).toContain("getGradeTableChapterTone");
    expect(source).toContain("getGradeTableColumnHeaderTone");
    expect(source).toContain("getGradeTableColumnBodyTone");
    expect(source).toContain("Data Siswa");
    expect(source).toContain("border-r-2 border-primary bg-background");
    expect(source).toContain("hover:bg-fuchsia-50/90");
    expect(source).not.toContain("<table");
    expect(source).not.toContain("<thead");
    expect(source).not.toContain("@/components/ui/table");
  });
});

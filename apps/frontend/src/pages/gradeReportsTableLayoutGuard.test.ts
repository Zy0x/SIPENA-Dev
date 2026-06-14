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
  it("uses an input-grade style native table shell with stable grouped headers", () => {
    const source = readSource("apps/frontend/src/pages/GradeReports.tsx");

    expect(source).toContain("sipena-report-grade-table-shell sipena-scroll-chain-page");
    expect(source).toContain("max-h-[70dvh] overflow-auto scrollbar-thin");
    expect(source).toContain('<table className="min-w-max border-separate border-spacing-0 text-sm">');
    expect(source).toContain('<thead className="sticky top-0 z-30">');
    expect(source).toContain("Identitas Siswa");
    expect(source).toContain("sticky z-40 bg-background");
    expect(source).toContain("group-hover:bg-muted/40");
    expect(source).not.toContain("@/components/ui/table");
    expect(source).not.toContain("<Table>");
  });
});

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

describe("class detail dialog scroll guard", () => {
  it("keeps the student list as the only vertical scroll region", () => {
    const source = readSource("apps/frontend/src/components/classes/ClassDetailDialog.tsx");

    expect(source).toContain("h-[min(calc(100dvh-1rem),44rem)]");
    expect(source).toContain("max-h-none");
    expect(source).toContain("sipena-class-detail-scroll sipena-scroll-chain-page");
    expect(source).toContain("min-h-0 flex-1 overflow-y-auto overscroll-auto");
    expect(source).toContain('aria-label={`Daftar siswa kelas ${classData.name}`}');
    expect(source).toContain('className="w-full table-fixed caption-bottom text-sm"');
    expect(source).toContain('className="sticky top-0 z-10 bg-background');
    expect(source).toContain('type="button"');
    expect(source).not.toContain("@/components/ui/table");
    expect(source).not.toContain("<Table>");
  });
});

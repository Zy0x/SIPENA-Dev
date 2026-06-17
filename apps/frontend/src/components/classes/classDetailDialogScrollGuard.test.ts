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

    expect(source).toContain("h-[min(calc(100dvh-0.75rem),44.5rem)]");
    expect(source).toContain("max-h-none");
    expect(source).toContain("sipena-class-detail-scroll sipena-scroll-chain-page");
    expect(source).toContain("isolate min-h-0 flex-1 overflow-x-scroll overflow-y-auto overscroll-auto");
    expect(source).toContain('aria-label={`Daftar siswa kelas ${classData.name}`}');
    expect(source).toContain('className="w-full min-w-[40rem] table-fixed border-separate border-spacing-0 caption-bottom text-sm"');
    expect(source).toContain('className="sticky top-0 z-20 bg-background shadow-[0_1px_0_hsl(var(--border)),0_2px_8px_-6px_hsl(var(--foreground)/0.35)]"');
    expect(source).toContain("sticky right-0 z-30");
    expect(source).toContain('type="button"');
    expect(source).not.toContain("@/components/ui/table");
    expect(source).not.toContain("<Table>");
  });
});

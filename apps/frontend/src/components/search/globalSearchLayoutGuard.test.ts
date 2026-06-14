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

describe("global search layout guard", () => {
  it("keeps the command palette readable and free from close-button overlap", () => {
    const source = readSource("apps/frontend/src/components/search/GlobalSearch.tsx");

    expect(source).toContain("sipena-global-search-dialog");
    expect(source).toContain("pr-16");
    expect(source).toContain("Bersihkan pencarian");
    expect(source).toContain("max-h-[min(58dvh,430px)]");
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("aria-selected={isHighlighted}");
    expect(source).toContain("Ctrl/Cmd K");
    expect(source).toContain("Up/Down");
    expect(source).toContain("[&>button[aria-label='Tutup_dialog']]:right-3");
  });
});

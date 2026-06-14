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

describe("add subject dialog layout guard", () => {
  it("keeps subject choices searchable, deduplicated, and grouped without a long select menu", () => {
    const source = readSource("apps/frontend/src/components/subjects/AddSubjectDialog.tsx");

    expect(source).toContain("subjectGroupOptions");
    expect(source).toContain("new Map<string");
    expect(source).toContain("filteredSubjectOptions");
    expect(source).toContain('placeholder="Cari mapel..."');
    expect(source).toContain('role="listbox"');
    expect(source).toContain('role="option"');
    expect(source).toContain("activeSubjectGroup");
    expect(source).toContain("handleSelectCustomSubject");
    expect(source).toContain("max-h-[min(92dvh,46rem)] overflow-y-auto sm:max-w-[540px]");
    expect(source).not.toContain("SelectContent");
    expect(source).not.toContain("SelectItem");
  });
});

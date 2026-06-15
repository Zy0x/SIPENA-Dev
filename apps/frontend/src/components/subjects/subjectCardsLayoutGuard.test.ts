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

describe("subject cards layout guard", () => {
  it("keeps subject cards obvious to use across touch and desktop devices", () => {
    const cardSource = readSource("apps/frontend/src/components/subjects/SubjectCard.tsx");
    const pageSource = readSource("apps/frontend/src/pages/Subjects.tsx");

    expect(cardSource).toContain('role="button"');
    expect(cardSource).toContain("Input Nilai");
    expect(cardSource).toContain("Bagikan");
    expect(cardSource).toContain("Edit");
    expect(cardSource).toContain("Hapus");
    expect(cardSource).toContain("h-11");
    expect(cardSource).toContain("min-h-[11.75rem]");
    expect(cardSource).toContain("grid-cols-3 gap-2");
    expect(cardSource).toContain("min-w-0 gap-1.5");
    expect(cardSource).toContain('aria-label="Bagikan link mata pelajaran"');
    expect(cardSource).not.toContain("DropdownMenu");
    expect(cardSource).not.toContain("MoreVertical");
    expect(pageSource).toContain("lg:grid-cols-[minmax(20rem,32rem)_minmax(16rem,1fr)_minmax(9rem,12rem)]");
    expect(pageSource).toContain("lg:grid-cols-[minmax(22rem,44rem)_1fr]");
    expect(pageSource).toContain("grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]");
    expect(pageSource).toContain("KKM kelas");
  });
});

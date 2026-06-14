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
    expect(cardSource).not.toContain("DropdownMenu");
    expect(cardSource).not.toContain("MoreVertical");
    expect(pageSource).toContain("lg:grid-cols-[minmax(16rem,24rem)_1fr_auto]");
    expect(pageSource).toContain("sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5");
    expect(pageSource).toContain("KKM kelas");
  });
});

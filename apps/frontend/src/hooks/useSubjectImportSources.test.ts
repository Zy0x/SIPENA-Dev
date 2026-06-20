import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  const direct = resolve(process.cwd(), relativePath);
  const file = existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
  return readFileSync(file, "utf8");
}

describe("subject import source query", () => {
  it("loads only lightweight class fields when the import dialog is enabled", () => {
    const source = readSource("apps/frontend/src/hooks/useSubjectImportSources.ts");

    expect(source).toContain('select("id, name, academic_year_id, semester_id, class_kkm")');
    expect(source).toContain("enabled: enabled && Boolean(user)");
    expect(source).toContain("staleTime: SOURCE_CACHE_MS");
    expect(source).not.toContain('from("students")');
    expect(source).not.toContain("student_count");
  });
});

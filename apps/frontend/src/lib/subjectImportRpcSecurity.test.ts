import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function migrationSource(): string {
  const relative = "supabase/migrations/20260620103220_import_subjects_from_class.sql";
  const direct = resolve(process.cwd(), relative);
  return readFileSync(existsSync(direct) ? direct : resolve(process.cwd(), "../..", relative), "utf8");
}

describe("subject import RPC security", () => {
  it("uses invoker permissions and limits execution to authenticated users", () => {
    const source = migrationSource();

    expect(source).toContain("SECURITY INVOKER");
    expect(source).toContain("auth.uid()");
    expect(source).toContain("class_not_found_or_forbidden");
    expect(source).toContain("REVOKE ALL ON FUNCTION public.import_subjects_from_class");
    expect(source).toContain("FROM PUBLIC");
    expect(source).toContain("FROM anon");
    expect(source).toContain("TO authenticated");
    expect(source).not.toContain("SECURITY DEFINER");
  });

  it("copies only allowed structure and creates a fresh link token", () => {
    const source = migrationSource();

    expect(source).toContain("public.chapters");
    expect(source).toContain("public.assignments");
    expect(source).toContain("public.grade_formula_settings");
    expect(source).toContain("encode(extensions.gen_random_bytes(32), 'hex')");
    expect(source).toContain("guest/history metadata");
    expect(source).not.toMatch(/INSERT\s+INTO\s+public\.grades/i);
    expect(source).not.toMatch(/FROM\s+public\.grades/i);
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string) {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

describe("OCR Edge Function security guard", () => {
  it("requires JWT, limits payloads, avoids persistence, and performs two AI passes", () => {
    const source = readFileSync(repoPath("supabase/functions/ocr-import-process/index.ts"), "utf8");
    const config = readFileSync(repoPath("supabase/functions/ocr-import-process/config.toml"), "utf8");

    expect(config).toContain("verify_jwt = true");
    expect(source).toContain("const MAX_IMAGES = 5");
    expect(source).toContain("const MAX_BODY_BYTES = 10 * 1024 * 1024");
    expect(source).toContain("runVisionPass");
    expect(source).toContain("runRefinementPass");
    expect(source).toContain("GROQ_API_KEY");
    expect(source).toContain("Login diperlukan untuk memakai OCR");
    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("createClient");
    expect(source).not.toMatch(/\.from\(["'`](students|grades|attendance)/);
    expect(source).not.toMatch(/console\.(info|warn|error)\([^\n]*(base64|images)/);
  });
});

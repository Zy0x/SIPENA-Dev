import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("smart import AI edge function security guards", () => {
  const normalizeNewlines = (value: string) => value.replace(/\r\n/g, "\n");
  const repoPath = (relativePath: string) => {
    const direct = resolve(process.cwd(), relativePath);
    if (existsSync(direct)) return direct;
    return resolve(process.cwd(), "../..", relativePath);
  };
  const functionSource = () => readFileSync(
    repoPath("supabase/functions/smart-import-assist/index.ts"),
    "utf8",
  );
  const functionConfig = () => readFileSync(
    repoPath("supabase/functions/smart-import-assist/config.toml"),
    "utf8",
  );
  const supabaseConfig = () => readFileSync(
    repoPath("supabase/config.toml"),
    "utf8",
  );

  it("requires JWT in both per-function and global Supabase config", () => {
    expect(functionConfig()).toContain("verify_jwt = true");
    expect(normalizeNewlines(supabaseConfig())).toContain("[functions.smart-import-assist]\nverify_jwt = true");
  });

  it("does not use service role or database writes in the smart import assist function", () => {
    const source = functionSource();

    expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).not.toContain("createClient(");
    expect(source).not.toContain(".from(");
    expect(source).not.toContain(".insert(");
    expect(source).not.toContain(".update(");
    expect(source).not.toContain(".delete(");
    expect(source).not.toContain(".upsert(");
    expect(source).not.toContain(".rpc(");
  });

  it("keeps payload limits, CORS, non-streaming JSON, and safe fallback behavior", () => {
    const source = functionSource();

    expect(source).toContain("const MAX_BODY_BYTES = 500 * 1024");
    expect(source).toContain("const MAX_STUDENTS = 200");
    expect(source).toContain("const MAX_ASSIGNMENTS = 300");
    expect(source).toContain('const DEFAULT_MODEL = "openai/gpt-oss-120b"');
    expect(source).toContain('const JSON_OBJECT_FALLBACK_MODEL = "llama-3.3-70b-versatile"');
    expect(source).toContain("buildModelCascade");
    expect(source).toContain("responseFormatForAttempt");
    expect(source).toContain('req.method === "OPTIONS"');
    expect(source).toContain('"Content-Type": "application/json"');
    expect(source).toContain("fallbackResponse");
    expect(source).toContain('type: "json_schema"');
    expect(source).toContain('type: "json_object"');
    expect(source).toContain("fetchWithTimeout");
    expect(source).toContain("GROQ_API_KEY");
  });

  it("sanitizes AI output and forces suggestions to stay confirm-only", () => {
    const source = functionSource();

    expect(source).toContain("sanitizeAiResponse");
    expect(source).toContain("sanitizeSuggestion");
    expect(source).toContain("blockedTextPattern");
    expect(source).toContain("requiresConfirmation: true");
    expect(source).toContain("targetType === \"student\"");
    expect(source).toContain("targetType === \"assignment\"");
    expect(source).toContain("targetType === \"chapter\"");
    expect(source).toContain("targetType === \"table\"");
    expect(source).toContain("rawSuggestedValue >= 0 && rawSuggestedValue <= 100");
  });
});

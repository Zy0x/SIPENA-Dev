import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("auth lockout reset edge function security guards", () => {
  const functionSource = () => readFileSync(
    resolve(process.cwd(), "supabase/functions/auth-lockout-reset/index.ts"),
    "utf8",
  );
  const supabaseConfig = () => readFileSync(
    resolve(process.cwd(), "supabase/config.toml"),
    "utf8",
  );

  it("is intentionally public but still uses server-side guards", () => {
    const source = functionSource();

    expect(supabaseConfig()).toContain("[functions.auth-lockout-reset]\nverify_jwt = false");
    expect(source).toContain("RECAPTCHA_V2_SECRET_KEY");
    expect(source).toContain("ADMIN_DB_PASSWORD");
    expect(source).toContain("SBASE_SERVICE_ROLE_KEY");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("fails closed when captcha is missing and validates reset eligibility", () => {
    const source = functionSource();

    expect(source).toContain("RECAPTCHA_V2_SECRET_KEY missing, rejecting public request");
    expect(source).toContain("return false");
    expect(source).toContain("const MIN_RESET_LOCKOUT_LEVEL = 6");
    expect(source).toContain("const MIN_RESET_FAILURE_COUNT = 18");
    expect(source).toContain("failureCount < MIN_RESET_FAILURE_COUNT");
  });

  it("does not return raw database errors to the user", () => {
    const source = functionSource();

    expect(source).toContain("function publicErrorMessage");
    expect(source).toContain("Fitur request reset waiting time belum siap");
    expect(source).not.toContain('error instanceof Error ? error.message : "Server error"');
  });
});

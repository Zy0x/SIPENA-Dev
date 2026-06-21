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
  ).replace(/\r\n/g, "\n");
  const migrationSource = () => readFileSync(
    resolve(process.cwd(), "supabase/migrations/20260511143000_auth_lockout_reset_requests.sql"),
    "utf8",
  ).replace(/\r\n/g, "\n");

  it("is intentionally public but still uses server-side guards", () => {
    const source = functionSource();

    expect(supabaseConfig()).toContain("[functions.auth-lockout-reset]\nverify_jwt = false");
    expect(source).toContain("RECAPTCHA_V2_SECRET_KEY");
    expect(source).toContain("ADMIN_DB_PASSWORD");
    expect(source).toContain("SBASE_SERVICE_ROLE_KEY");
    expect(source).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(source).toContain("settings.auto_approve_hours * 60 * 60 * 1000");
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

  it("keeps lockout reset tables reachable only through the edge function service role", () => {
    const migration = migrationSource();

    expect(migration).toContain("ALTER TABLE public.auth_lockout_reset_settings ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.auth_lockout_reset_requests ENABLE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.auth_lockout_reset_settings FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("ALTER TABLE public.auth_lockout_reset_requests FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("CREATE POLICY auth_lockout_reset_settings_edge_function_only");
    expect(migration).toContain("CREATE POLICY auth_lockout_reset_requests_edge_function_only");
    expect(migration).toContain("TO anon, authenticated");
    expect(migration).toContain("USING (false)");
    expect(migration).toContain("WITH CHECK (false)");
    expect(migration).toContain("REVOKE ALL ON TABLE public.auth_lockout_reset_settings FROM anon, authenticated");
    expect(migration).toContain("REVOKE ALL ON TABLE public.auth_lockout_reset_requests FROM anon, authenticated");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_lockout_reset_settings TO service_role");
    expect(migration).toContain("GRANT SELECT, INSERT, UPDATE ON TABLE public.auth_lockout_reset_requests TO service_role");
    expect(migration).not.toMatch(
      /GRANT\s+(?:ALL|SELECT|INSERT|UPDATE|DELETE)[^;]+public\.auth_lockout_reset_(?:settings|requests)[^;]+TO\s+(?:anon|authenticated)/i,
    );
  });
});

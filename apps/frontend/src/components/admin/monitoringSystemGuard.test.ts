import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  const direct = resolve(process.cwd(), relativePath);
  const filePath = existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
  return readFileSync(filePath, "utf8");
}

function readOptionalSource(relativePath: string) {
  const direct = resolve(process.cwd(), relativePath);
  const fallback = resolve(process.cwd(), "../..", relativePath);
  const filePath = existsSync(direct) ? direct : fallback;
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : null;
}

describe("dynamic production monitoring guard", () => {
  it("mounts a dedicated monitoring panel in Admin", () => {
    const admin = readSource("apps/frontend/src/pages/Admin.tsx");
    const panel = readSource("apps/frontend/src/components/admin/MonitoringSystemPanel.tsx");

    expect(admin).toContain('id: "monitoring"');
    expect(admin).toContain("<MonitoringSystemPanel adminPassword={getBackendPassword()} />");
    expect(panel).toContain('data-testid="admin-monitoring-system-panel"');
    expect(panel).toContain('localStorage.getItem("admin_session_token")');
    expect(panel).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(panel).not.toMatch(/\d{8,10}:[A-Za-z0-9_-]{30,}/);
  });

  it("keeps monitoring secrets in Vault behind forced RLS", () => {
    const migration = readSource("supabase/migrations/20260711130000_dynamic_production_monitoring.sql");

    expect(migration).toContain("vault.create_secret");
    expect(migration).toContain("vault.update_secret");
    expect(migration).toContain("vault.decrypted_secrets");
    expect(migration).toContain("ALTER TABLE public.monitoring_settings FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("REVOKE ALL ON TABLE public.monitoring_settings FROM PUBLIC, anon, authenticated");
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.monitoring_get_runtime_config() TO service_role");
    expect(migration).not.toContain("GRANT EXECUTE ON FUNCTION public.monitoring_get_runtime_config() TO authenticated");
  });

  it("requires signed, non-replayable alert requests", () => {
    const alert = readSource("supabase/functions/monitoring-alert/index.ts");
    const workflow = readOptionalSource(".github/workflows/synthetic-monitor.yml");
    const synthetic = readSource("scripts/synthetic-monitor.mjs");

    expect(alert).toContain("verifyHmacSignature");
    expect(alert).toContain("monitoring_alert_nonces");
    expect(alert).toContain("Request monitoring sudah kedaluwarsa");
    expect(synthetic).toContain('createHmac("sha256", webhookKey)');

    if (workflow) {
      expect(workflow).toContain("SYNTHETIC_WEBHOOK_KEY: ${{ secrets.SYNTHETIC_WEBHOOK_KEY }}");
      expect(workflow).not.toMatch(/SYNTHETIC_WEBHOOK_KEY:\s+[A-Za-z0-9_-]{32,}/);
    }
  });
});

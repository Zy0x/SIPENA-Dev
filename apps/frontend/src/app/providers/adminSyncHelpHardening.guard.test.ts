import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../../..");
const readSource = (relativePath: string) => {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return readFileSync(direct, "utf8");
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
};

describe("admin notification, production sync, and help hardening guard", () => {
  it("boots the admin notification function and exposes a recoverable error state", () => {
    const edgeFunction = readSource("supabase/functions/admin-event-notifications/index.ts");
    const panel = readSource("apps/frontend/src/components/admin/AdminNotificationsPanel.tsx");

    expect(edgeFunction).toContain('import { serve } from "https://deno.land/std@0.168.0/http/server.ts"');
    expect(panel).toContain("loadError");
    expect(panel).toContain("Coba lagi");
    expect(panel).not.toContain('table: "notifications"');
  });

  it("blocks synchronization until the complete source quality gate passes", () => {
    const syncWorkflow = readSource(".github/workflows/trigger-sync.yml");
    const productionWorkflow = readSource(".github/workflows/production-build.yml");

    expect(syncWorkflow).toContain("Validate source before sync");
    expect(syncWorkflow).toContain("needs: quality");
    expect(syncWorkflow).toContain("npm run security:scan");
    expect(syncWorkflow).toContain("npm run verify:web:dist");
    expect(productionWorkflow).toContain("github.repository == 'Zy0x/SIPENA-Dev'");
    expect(productionWorkflow).toContain("Upload verified web artifact");
  });

  it("keeps navigation shortcuts and their help reference in one registry", () => {
    const registry = readSource("apps/frontend/src/lib/keyboardShortcuts.ts");
    const provider = readSource("apps/frontend/src/components/KeyboardShortcutsProvider.tsx");
    const help = readSource("apps/frontend/src/pages/Help.tsx");

    expect((registry.match(/path: "\//g) || []).length).toBeGreaterThanOrEqual(13);
    expect(provider).toContain("SHORTCUT_PATH_BY_KEY");
    expect(provider).toContain("isInputActive && e.key !== \"Escape\"");
    expect(help).toContain("NAVIGATION_SHORTCUTS.map");
    expect(help).toContain("Cari topik panduan");
    expect(help).not.toContain("S = Setup Awal");
  });

  it("adds breathing room below the sidebar brand header", () => {
    const layout = readSource("apps/frontend/src/components/AppLayout.tsx");
    expect(layout).toContain('className="shrink-0 overflow-hidden border-b border-border/30 px-4 py-2"');
  });

  it("does not keep the previously documented plaintext admin password", () => {
    const deploymentGuide = readSource("docs/guide/004_DEPLOY_EDGE_FUNCTIONS.md");
    expect(deploymentGuide).not.toContain('ADMIN_DB_PASSWORD=' + '"sipena2024"');
    expect(deploymentGuide).toContain('ADMIN_DB_PASSWORD="$ADMIN_DB_PASSWORD"');
  });
});

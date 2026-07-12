import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(__dirname, "../../../../../..");
const readSource = (relativePath: string) => {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return readFileSync(direct, "utf8");
  return readFileSync(resolve(repoRoot, relativePath), "utf8");
};

describe("PWA, authentication, and attendance hardening guard", () => {
  it("uses versioned adaptive icons and a pre-React standalone splash", () => {
    const manifest = readSource("apps/frontend/public/manifest.webmanifest");
    const html = readSource("apps/frontend/index.html");
    const app = readSource("apps/frontend/src/app/App.tsx");

    expect(manifest).toContain("sipena-icon-maskable-512-v2.png");
    expect(manifest).toContain("sipena-icon-any-512-v2.png");
    expect(html).toContain('id="sipena-boot-splash"');
    expect(html).toContain("@media (display-mode: standalone)");
    expect(app).not.toContain("SplashScreen");
    expect(app).toContain('document.getElementById("sipena-boot-splash")');
  });

  it("treats a missing monthly lock as locked in stable and V2 hooks", () => {
    for (const path of ["apps/frontend/src/hooks/useAttendanceStable.ts", "apps/frontend/src/hooks/useAttendanceV2.ts"]) {
      const source = readSource(path);
      expect(source).toContain("if (locks.length === 0) return true");
      expect(source).toContain("flushAttendanceSaves");
    }
  });

  it("prevents scroll-spy hash changes from starting another profile scroll", () => {
    const profile = readSource("apps/frontend/src/pages/Profile.tsx");
    expect(profile).toContain('"scrollspy"');
    expect(profile).toContain('window.addEventListener("scrollend"');
    expect(profile).toContain('hashUpdateSourceRef.current === "scrollspy"');
  });

  it("supports password setup for OAuth accounts without frontend registration notifications", () => {
    const onboarding = readSource("apps/frontend/src/components/onboarding/ExternalAuthOnboarding.tsx");
    const security = readSource("apps/frontend/src/components/settings/AccountSecuritySection.tsx");
    const auth = readSource("apps/frontend/src/contexts/AuthContext.tsx");

    expect(onboarding).toContain("sipena_password_configured");
    expect(onboarding).toContain("Buat Password Login");
    expect(security).toContain("hasPasswordLogin");
    expect(security).toContain("signInWithPassword");
    expect(auth).not.toContain('type: "new_user_registration"');
  });

  it("routes admin registration events through a protected Edge Function", () => {
    const panel = readSource("apps/frontend/src/components/admin/AdminNotificationsPanel.tsx");
    const migration = readSource("supabase/migrations/20260712114500_secure_admin_registration_events.sql");
    expect(panel).toContain("admin-event-notifications");
    expect(migration).toContain("FORCE ROW LEVEL SECURITY");
    expect(migration).toContain("notify_admin_on_auth_registration");
    expect(migration).toContain("notify_admin_on_guest_grant");
  });
});

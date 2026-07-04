import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FEATURE_KEYS } from "./featureAccess";

const repoRoot = resolve(__dirname, "../../../../../..");
const readSource = (relativePath: string) => {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) {
    return readFileSync(direct, "utf8");
  }

  const fromRepoRoot = resolve(repoRoot, relativePath);
  if (existsSync(fromRepoRoot)) {
    return readFileSync(fromRepoRoot, "utf8");
  }

  return readFileSync(resolve(process.cwd(), "../..", relativePath), "utf8");
};

describe("feature access integration guard", () => {
  it("mounts the feature provider and routes attendance through runtime", () => {
    const app = readSource("apps/frontend/src/app/App.tsx");
    expect(app).toContain("<FeatureFlagProvider>");
    expect(app).toContain("AttendanceRuntimeRoute");
    expect(app).not.toContain('from "../pages/Attendance"');
  });

  it("keeps attendance v2 behind feature runtime resolution", () => {
    const route = readSource("apps/frontend/src/features/attendance/runtime/AttendanceRuntimeRoute.tsx");
    const v2Entry = readSource("apps/frontend/src/features/attendance/ui/AttendanceV2.tsx");
    expect(route).toContain("FEATURE_KEYS.attendanceV2Runtime");
    expect(route).toContain("getAccessStatus");
    expect(route).toContain('runtimeAccessStatus === "loading"');
    expect(route).toContain("resolveRuntime");
    expect(route).toContain("remoteEngine");
    expect(route).not.toContain("AttendanceV2Page");
    expect(route).not.toContain("AttendanceV2Visualizer");
    expect(v2Entry).toContain("AttendanceV2LegacyMirror");
    expect(v2Entry).not.toContain("AttendanceV2Page");
    expect(v2Entry).not.toContain("AttendanceV2Visualizer");
  });

  it("keeps attendance v2 as a v1 visual mirror without importing the experimental v2 page", () => {
    const mirror = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2LegacyMirror.tsx");
    expect(mirror).toContain("AttendanceV1Wrapper");
    expect(mirror).not.toContain("AttendanceV2Page");
    expect(mirror).not.toContain("AttendanceV2Visualizer");
  });

  it("keeps the attendance v2 settings modal structured and guided", () => {
    const page = readSource("apps/frontend/src/pages/AttendanceV2.tsx");
    const modal = readSource("apps/frontend/src/components/attendance/v2/SettingsDashboard.tsx");
    const tour = readSource("apps/frontend/src/components/ui/product-tour.tsx");
    expect(page).not.toContain("settingsTourSteps");
    expect(modal).toContain("fullScreenMobile");
    expect(modal).toContain("sm:h-[min(92dvh,820px)]");
    expect(modal).toContain("lg:sticky lg:top-0");
    expect(modal).toContain("lg:sticky lg:bottom-0");
    expect(modal).toContain("settingsSection");
    expect(modal).toContain("settingsTourSteps");
    expect(modal).toContain('tourKey="attendance-v2-settings"');
    expect(modal).toContain("InfoHelp");
    expect(modal).toContain("@/components/ui/tooltip");
    expect(modal).toContain("@/components/ui/popover");
    expect(modal).toContain('dataTour="attendance-v2-settings-info-help"');
    expect(modal).toContain("data-tour={dataTour}");
    expect(modal).toContain("zIndexBase={10120}");
    expect(tour).toContain("zIndexBase?: number");
    expect(tour).toContain("tourZIndexBase");
    expect(tour).toContain("tourZIndexBase + 9");
    expect(modal).toContain('data-tour="attendance-v2-settings-header"');
    expect(modal).toContain('data-tour="attendance-v2-settings-nav"');
    expect(modal).toContain('data-tour="attendance-v2-settings-calendar"');
    expect(modal).toContain('data-tour="attendance-v2-settings-effective"');
    expect(modal).toContain('data-tour="attendance-v2-settings-recap"');
    expect(modal).toContain('data-tour="attendance-v2-settings-audit"');
    expect(modal).toContain('data-tour="attendance-v2-settings-delegation"');
    expect(modal).toContain('data-tour="attendance-v2-settings-backup"');
    expect(modal).toContain("Kalender Akademik");
    expect(modal).toContain("Profil Rekap Presensi");
    expect(modal).toContain("Audit Riwayat Perubahan");
    expect(modal).toContain("Delegasi Guru Pengganti");
    expect(modal).toContain("Backup Bulanan");
  });

  it("filters sidebar navigation with feature access", () => {
    const layout = readSource("apps/frontend/src/components/AppLayout.tsx");
    expect(layout).toContain("useFeatureFlags");
    expect(layout).toContain("visibleNavItems");
    expect(layout).toContain("getAccessStatus");
    expect(layout).toContain('!== "allowed"');
    expect(layout).toContain("featureKey");
  });

  it("does not render guarded page content before access status is final", () => {
    const gate = readSource("apps/frontend/src/components/FeatureGate.tsx");
    expect(gate).toContain("getAccessStatus");
    expect(gate).toContain('accessStatus === "loading"');
    expect(gate).toContain('accessStatus === "allowed"');
    expect(gate).toContain('accessStatus === "error"');
  });

  it("keeps admin feature writes behind the admin Edge Function", () => {
    const panel = readSource("apps/frontend/src/components/admin/FeatureAccessPanel.tsx");
    const edgeFunction = readSource("supabase/functions/admin-feature-access/index.ts");
    expect(panel).toContain("admin-feature-access");
    expect(panel).toContain("FEATURE_CATALOG_SYNC_PAYLOAD");
    expect(panel).toContain("sync-feature-catalog");
    expect(panel).toContain("save-feature");
    expect(panel).toContain("save-user-roles");
    expect(panel).not.toContain(".from(\"feature_flags\")");
    expect(panel).not.toContain(".from('feature_flags')");
    expect(edgeFunction).toContain('action === "sync-feature-catalog"');
    expect(edgeFunction).toContain("feature_flags");
    expect(edgeFunction).not.toContain('from("feature_audiences").delete().eq("feature_key", entry.featureKey)');
  });

  it("uses a feature registry instead of manual duplicated flag definitions", () => {
    const featureAccess = readSource("apps/frontend/src/app/providers/featureAccess.ts");
    expect(featureAccess).toContain("FEATURE_REGISTRY");
    expect(featureAccess).toContain("FEATURE_CATALOG_SYNC_PAYLOAD");
    expect(featureAccess).toContain("Object.fromEntries");
    expect(featureAccess).toContain("FEATURE_REGISTRY.map");
    expect(featureAccess).toContain('key: "page.attendance-v2"');
    expect(featureAccess).toContain("defaultEnabled: false");
  });

  it("uses only registry-backed feature keys in routes and sidebar navigation", () => {
    const knownFeatureIds = new Set(Object.keys(FEATURE_KEYS));
    const sources = [
      readSource("apps/frontend/src/app/App.tsx"),
      readSource("apps/frontend/src/components/AppLayout.tsx"),
    ];
    const usedFeatureIds = sources.flatMap((source) =>
      Array.from(source.matchAll(/FEATURE_KEYS\.([A-Za-z0-9_]+)/g), (match) => match[1]),
    );

    expect(usedFeatureIds.length).toBeGreaterThan(0);
    for (const featureId of usedFeatureIds) {
      expect(knownFeatureIds.has(featureId)).toBe(true);
    }
  });

  it("keeps admin feature control separated into professional tables and tabs", () => {
    const panel = readSource("apps/frontend/src/components/admin/FeatureAccessPanel.tsx");
    expect(panel).toContain("<Tabs");
    expect(panel).toContain('<TabsTrigger value="features"');
    expect(panel).toContain('<TabsTrigger value="roles"');
    expect(panel).toContain('<TabsTrigger value="audit"');
    expect(panel).toContain("<Table");
    expect(panel).toContain("Tabel Fitur");
    expect(panel).toContain("Tabel Role Pengguna");
    expect(panel).toContain("Audit Perubahan");
  });

  it("keeps role access limited to admin, guru, and beta user with guru as default", () => {
    const panel = readSource("apps/frontend/src/components/admin/FeatureAccessPanel.tsx");
    const edgeFunction = readSource("supabase/functions/admin-feature-access/index.ts");
    const migration = readSource("supabase/migrations/20260629123000_default_teacher_roles.sql");

    expect(panel).toContain('const DEFAULT_USER_ROLE = "teacher"');
    expect(panel).toContain('role.value === DEFAULT_USER_ROLE');
    expect(panel).toContain('{ value: "admin", label: "Admin" }');
    expect(panel).toContain('{ value: "teacher", label: "Guru" }');
    expect(panel).toContain('{ value: "beta_user", label: "Beta User" }');
    expect(panel).not.toContain("Tester");
    expect(panel).not.toContain('"tester"');

    expect(edgeFunction).toContain('const DEFAULT_USER_ROLE = "teacher"');
    expect(edgeFunction).toContain('const VALID_ROLES = new Set(["admin", DEFAULT_USER_ROLE, "beta_user"])');
    expect(edgeFunction).toContain("includeDefaultTeacher: true");
    expect(edgeFunction).not.toContain('"tester"');
    expect(edgeFunction).not.toContain("'tester'");

    expect(migration).toContain("DELETE FROM public.user_roles");
    expect(migration).toContain("WHERE role = 'tester'");
    expect(migration).toContain("INSERT INTO public.user_roles");
    expect(migration).toContain("AFTER INSERT ON auth.users");
    expect(migration).toContain("CHECK (role IN ('admin', 'teacher', 'beta_user'))");
  });
});

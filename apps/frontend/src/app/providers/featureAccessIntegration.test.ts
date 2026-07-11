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
    expect(app).toContain("AttendanceStableRoute");
    expect(app).not.toContain('from "../pages/Attendance"');
  });

  it("keeps stable attendance routed to a standalone stable copy", () => {
    const app = readSource("apps/frontend/src/app/App.tsx");
    const stableRoute = readSource("apps/frontend/src/features/attendance/stable/AttendanceStableRoute.tsx");
    const stablePage = readSource("apps/frontend/src/features/attendance/stable/AttendanceStable.tsx");
    const stablePageImpl = readSource("apps/frontend/src/pages/AttendanceStable.tsx");
    const stableHook = readSource("apps/frontend/src/hooks/useAttendanceStable.ts");
    const stableSettings = readSource("apps/frontend/src/components/attendance/stable/SettingsDashboard.tsx");

    expect(app).toContain('<Route path="/attendance"');
    expect(app).toContain("<AttendanceStableRoute />");
    expect(stableRoute).toContain("AttendanceStable");
    expect(stableRoute).not.toContain("VITE_ATTENDANCE_STABLE_CUTOVER");
    expect(stableRoute).not.toContain("AttendanceV1Wrapper");
    expect(stablePage).toContain("AttendanceStablePage");
    expect(stablePage).not.toContain("@/pages/AttendanceV2");
    expect(stablePageImpl).not.toContain("@/components/attendance/v2");
    expect(stablePageImpl).not.toContain("@/hooks/useAttendanceV2");
    expect(stableHook).toContain('type AttendanceStorageMode = "legacy"');
    expect(stableHook).toContain('return "legacy"');
    expect(stableHook).not.toContain("attendance_v2_");
    expect(stableSettings).toContain("attendance-settings");
    expect(stableSettings).not.toContain("attendance-v2-settings");
  });

  it("keeps unsafe attendance v2 promotion controls disabled", () => {
    const admin = readSource("apps/frontend/src/pages/Admin.tsx");
    const adminDatabase = readSource("supabase/functions/admin-database/index.ts");
    const useAttendanceV2 = readSource("apps/frontend/src/hooks/useAttendanceV2.ts");

    expect(admin).not.toContain("AttendanceMergePanel");
    expect(admin).not.toContain('id: "merge-v2"');
    expect(admin).not.toContain("Merge Data V2");
    expect(adminDatabase).toContain("V2_TO_PRODUCTION_PROMOTION_DISABLED");
    expect(adminDatabase).toContain('case "v2-pending-list"');
    expect(adminDatabase).toContain('case "v2-promote"');
    expect(adminDatabase).toContain("return disabledV2PromotionResponse()");
    expect(useAttendanceV2).not.toContain("/attendance/v2/promote");
    expect(useAttendanceV2).toContain("Promosi data Presensi V2 dinonaktifkan");
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
    const shared = readSource("apps/frontend/src/components/attendance/v2/settings/SettingsShared.tsx");
    const calendarSection = readSource("apps/frontend/src/components/attendance/v2/settings/CalendarSection.tsx");
    const effectiveSection = readSource("apps/frontend/src/components/attendance/v2/settings/EffectiveSection.tsx");
    const recapSection = readSource("apps/frontend/src/components/attendance/v2/settings/RecapSection.tsx");
    const auditSection = readSource("apps/frontend/src/components/attendance/v2/settings/AuditSection.tsx");
    const delegationSection = readSource("apps/frontend/src/components/attendance/v2/settings/DelegationSection.tsx");
    const backupSection = readSource("apps/frontend/src/components/attendance/v2/settings/BackupSection.tsx");
    const tour = readSource("apps/frontend/src/components/ui/product-tour.tsx");
    expect(page).not.toContain("settingsTourSteps");
    expect(modal).toContain("fullScreenMobile");
    expect(modal).toContain("lg:h-[min(92dvh,820px)]");
    expect(modal).toContain("DrawerContent");
    expect(modal).toContain("h-[90dvh] max-h-[90dvh]");
    expect(modal).toContain("shrink-0 border-t bg-background");
    expect(modal).toContain("settingsSection");
    expect(modal).toContain("settingsTourSteps");
    expect(modal).toContain('tourKey="attendance-v2-settings"');
    expect(shared).toContain("export function InfoHelp");
    expect(shared).toContain("@/components/ui/tooltip");
    expect(shared).toContain("@/components/ui/popover");
    expect(calendarSection).toContain('dataTour="attendance-v2-settings-info-help"');
    expect(shared).toContain("data-tour={dataTour}");
    expect(modal).toContain("zIndexBase={10120}");
    expect(tour).toContain("zIndexBase?: number");
    expect(tour).toContain("onExit?:");
    expect(tour).toContain("TourExitReason");
    expect(tour).toContain("tourRunIdRef");
    expect(tour).toContain("finishTour");
    expect(tour).toContain('finishTour("closed")');
    expect(tour).toContain('finishTour("skipped")');
    expect(tour).toContain('finishTour("completed")');
    expect(tour).toContain("tourZIndexBase");
    expect(tour).toContain("tourZIndexBase + 9");
    expect(modal).toContain("captureSettingsTourState");
    expect(modal).toContain("restoreSettingsTourState");
    expect(modal).toContain("desktopScrollRef");
    expect(modal).toContain("onExit={restoreSettingsTourState}");
    expect(modal).toContain('data-tour="attendance-v2-settings-header"');
    expect(modal).toContain('data-tour="attendance-v2-settings-nav"');
    expect(calendarSection).toContain('data-tour="attendance-v2-settings-calendar"');
    expect(effectiveSection).toContain('data-tour="attendance-v2-settings-effective"');
    expect(recapSection).toContain('data-tour="attendance-v2-settings-recap"');
    expect(recapSection).toContain('data-tour="attendance-v2-settings-recap-nisn"');
    expect(recapSection).toContain("Data tetap terindeks dan bisa dicari");
    expect(modal).toContain("attendance-v2-settings-recap-nisn");
    expect(modal).toContain("Tampilan NISN di Tabel");
    expect(auditSection).toContain('data-tour="attendance-v2-settings-audit"');
    expect(delegationSection).toContain('data-tour="attendance-v2-settings-delegation"');
    expect(backupSection).toContain('data-tour="attendance-v2-settings-backup"');
    expect(calendarSection).toContain("Format Hari Sekolah & Pengecualian KBM");
    expect(recapSection).toContain("Aturan Rekapitulasi Presensi");
    expect(auditSection).toContain("Audit Riwayat Perubahan");
    expect(delegationSection).toContain("Delegasi Guru Pengganti");
    expect(backupSection).toContain("Pencadangan & Pemulihan Data");
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
    const layout = readSource("apps/frontend/src/components/AppLayout.tsx");
    expect(gate).toContain("getAccessStatus");
    expect(gate).toContain('accessStatus === "loading"');
    expect(gate).toContain('accessStatus === "allowed"');
    expect(gate).toContain('accessStatus === "error"');
    expect(gate).not.toContain('featureKey === "page.attendance-v2"');
    expect(gate).not.toContain("page.attendance-v2\")");
    expect(layout).not.toContain('item.featureKey !== FEATURE_KEYS.attendanceV2');
    expect(layout).not.toContain('featureKey !== FEATURE_KEYS.attendanceV2');
  });

  it("keeps PWA manifest icon references backed by real public assets", () => {
    const manifest = readSource("apps/frontend/public/manifest.json");
    const webManifest = readSource("apps/frontend/public/manifest.webmanifest");
    const sw = readSource("apps/frontend/public/sw.js");

    expect(manifest).toContain("/icon-192.png");
    expect(manifest).toContain("/icon-512.png");
    expect(webManifest).toContain("/icon-192.png");
    expect(webManifest).toContain("/icon-512.png");
    expect(sw).toContain("/icon-192.png");
    expect(existsSync(resolve(repoRoot, "apps/frontend/public/icon-192.png")) || existsSync(resolve(process.cwd(), "apps/frontend/public/icon-192.png"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "apps/frontend/public/icon-512.png")) || existsSync(resolve(process.cwd(), "apps/frontend/public/icon-512.png"))).toBe(true);
    expect(existsSync(resolve(repoRoot, "apps/frontend/public/apple-touch-icon.png")) || existsSync(resolve(process.cwd(), "apps/frontend/public/apple-touch-icon.png"))).toBe(true);
  });

  it("keeps attendance core migration additive and idempotent", () => {
    const migration = readSource("supabase/migrations/20260711090000_attendance_core_stable_migration.sql");
    expect(migration).toContain("attendance_core_records");
    expect(migration).toContain("attendance_core_calendar_events");
    expect(migration).toContain("attendance_core_migration_runs");
    expect(migration).toContain("migrate_legacy_attendance_to_core");
    expect(migration).toContain("legacy_record_id");
    expect(migration).toContain("ON CONFLICT DO NOTHING");
    expect(migration).toContain("SECURITY INVOKER");
    expect(migration).not.toContain("ALTER TABLE public.attendance_records");
    expect(migration).not.toContain("DROP TABLE public.attendance_records");
    expect(migration).not.toContain("DELETE FROM public.attendance_records");
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

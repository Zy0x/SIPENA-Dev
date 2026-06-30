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
    const gate = readSource("apps/frontend/src/components/FeatureGate.tsx");
    expect(route).toContain("FEATURE_KEYS.attendanceV2Runtime");
    expect(route).toContain("getAccessStatus");
    expect(route).toContain('runtimeAccessStatus === "loading"');
    expect(route).toContain("resolveRuntime");
    expect(route).toContain("remoteEngine");
    expect(route).not.toContain("AttendanceV2Page");
    expect(route).not.toContain("AttendanceV2Visualizer");
    expect(v2Entry).toContain("AttendanceV2Wrapper");
    expect(v2Entry).not.toContain("AttendanceV2Page");
    expect(v2Entry).not.toContain("AttendanceV2Visualizer");
    expect(gate).not.toContain("Bypass page.attendance-v2");
    expect(gate).not.toContain('featureKey === "page.attendance-v2"');
  });

  it("keeps the legacy mirror available without importing the experimental v2 page", () => {
    const mirror = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2LegacyMirror.tsx");
    expect(mirror).toContain("AttendanceV1Wrapper");
    expect(mirror).not.toContain("AttendanceV2Page");
    expect(mirror).not.toContain("AttendanceV2Visualizer");
  });

  it("routes attendance v2 to the V2 control center instead of the archived experimental page", () => {
    const wrapper = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2Wrapper.tsx");
    const center = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2ControlCenter.tsx");
    const panels = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2ControlCenter.panels.tsx");
    expect(wrapper).toContain("AttendanceV2ControlCenter");
    expect(wrapper).not.toContain("AttendanceV2Page");
    expect(center).toContain("Pengaturan Presensi V2");
    expect(center).toContain("ProductTour");
    expect(center).toContain("attendance-v2-settings");
    expect(center).toContain("prepareAttendanceV2Tour");
    expect(center).not.toContain('from "@/pages/Attendance"');
    expect(panels).toContain("AcademicCalendarPanel");
    expect(panels).toContain("EffectiveDayPanel");
    expect(panels).toContain("RecapProfilePanel");
    expect(panels).toContain("AuditHistoryPanel");
    expect(panels).toContain("DelegationPanel");
    expect(panels).toContain("MonthlyBackupPanel");
    expect(center).toContain("Kalender Akademik");
    expect(center).toContain("Hari Efektif");
    expect(center).toContain("Profil Rekap");
    expect(panels).toContain("Audit Riwayat Perubahan");
    expect(panels).toContain("Delegasi Guru Pengganti");
    expect(panels).toContain("Backup Bulanan");
  });

  it("keeps attendance v2 settings as a professional guided dashboard", () => {
    const center = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2ControlCenter.tsx");
    const panels = readSource("apps/frontend/src/features/attendance/v2/AttendanceV2ControlCenter.panels.tsx");
    expect(center).toContain("AttendanceV2SectionNav");
    expect(center).toContain("AttendanceV2MobileSectionNav");
    expect(center).toContain("AttendanceV2SummaryStrip");
    expect(center).toContain("createTourCalendarDays");
    expect(center).toContain("TOUR_CLASS_ID");
    expect(center).toContain("attendance-v2-tour-section");
    expect(panels).toContain("SECTION_ITEMS");
    expect(panels).toContain('data-tour="attendance-v2-calendar-panel"');
    expect(panels).toContain('data-tour="attendance-v2-add-event"');
    expect(panels).toContain('data-tour="attendance-v2-effective-panel"');
    expect(panels).toContain('data-tour="attendance-v2-recap-panel"');
    expect(panels).toContain('data-tour="attendance-v2-audit-panel"');
    expect(panels).toContain('data-tour="attendance-v2-delegation-panel"');
    expect(panels).toContain('data-tour="attendance-v2-backup-panel"');
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

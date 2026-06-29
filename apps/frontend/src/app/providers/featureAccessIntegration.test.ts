import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

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
    expect(route).toContain("FEATURE_KEYS.attendanceV2Runtime");
    expect(route).toContain("getAccessStatus");
    expect(route).toContain('runtimeAccessStatus === "loading"');
    expect(route).toContain("resolveRuntime");
    expect(route).toContain("remoteEngine");
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
    expect(panel).toContain("admin-feature-access");
    expect(panel).toContain("save-feature");
    expect(panel).toContain("save-user-roles");
    expect(panel).not.toContain(".from(\"feature_flags\")");
    expect(panel).not.toContain(".from('feature_flags')");
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

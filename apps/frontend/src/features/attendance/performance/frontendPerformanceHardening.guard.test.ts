import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  return existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
}

const source = (relativePath: string) => readFileSync(repoPath(relativePath), "utf8");

describe("frontend performance and touch hardening guard", () => {
  it("shares one viewport-safe bulk attendance dialog between stable and V2", () => {
    const stable = source("apps/frontend/src/pages/AttendanceStable.tsx");
    const v2 = source("apps/frontend/src/pages/AttendanceV2.tsx");
    const dialog = source("apps/frontend/src/components/attendance/shared/BulkAttendanceDialog.tsx");
    const styles = source("apps/frontend/src/index.css");

    expect(stable).toContain("<BulkAttendanceDialog");
    expect(v2).toContain("<BulkAttendanceDialog");
    expect(dialog).toContain("sipena-bulk-attendance-dialog");
    expect(dialog).toContain("min-[360px]:grid-cols-2");
    expect(dialog).toContain("sipena-safe-area-bottom");
    expect(dialog).toContain("aria-pressed={selected}");
    expect(styles).toContain("height: 100dvh !important");
    expect(styles).toContain("@media (max-width: 639px), (max-height: 600px)");
  });

  it("uses shared tabs for the owner and guest class filter", () => {
    const classes = source("apps/frontend/src/pages/Classes.tsx");
    const tabs = source("apps/frontend/src/components/ui/tabs.tsx");

    expect(classes).toContain("<Tabs");
    expect(classes).toContain("<TabsList");
    expect(classes).toContain("grid-cols-3");
    expect(classes).toContain('data-tour="class-access-filter"');
    expect(tabs).toContain("sipena-tab-trigger");
    expect(tabs).toContain("data-[state=active]:bg-primary");
  });

  it("lazy-loads route pages and attendance export engines", () => {
    const app = source("apps/frontend/src/app/App.tsx");
    const routePreload = source("apps/frontend/src/app/routePreload.tsx");
    const layoutRoute = source("apps/frontend/src/components/LayoutRoute.tsx");
    const routeFallback = source("apps/frontend/src/components/RouteTransitionFallback.tsx");
    const stableExport = source("apps/frontend/src/hooks/useAttendanceStableExport.tsx");
    const v2Export = source("apps/frontend/src/hooks/useAttendanceV2Export.tsx");

    expect(app).toContain("loadRouteWithRecovery");
    expect(app).not.toContain("v7_startTransition: true");
    expect(app).toContain("<RoutePreloadManager />");
    expect(layoutRoute).toContain("<Suspense fallback={<RouteTransitionFallback />}");
    expect(routePreload).toContain('document.addEventListener("pointerover"');
    expect(routePreload).toContain('document.addEventListener("pointerdown"');
    expect(routePreload).toContain("requestIdleCallback");
    expect(routePreload).toContain("sipena_route_chunk_recovery_v1");
    expect(routePreload).toContain("__sipena_route_recovery");
    expect(routeFallback).not.toContain("Memuat halaman");
    expect(stableExport).toContain('await import("xlsx-js-style")');
    expect(v2Export).toContain('await import("xlsx-js-style")');
    expect(stableExport).toContain('await import("@/lib/attendancePdfExport")');
    expect(v2Export).toContain('await import("@/lib/attendancePdfExport")');
    expect(stableExport).not.toContain('import * as XLSX from "xlsx-js-style"');
    expect(v2Export).not.toContain('import * as XLSX from "xlsx-js-style"');
  });

  it("keeps grade tab changes free from forced height and body mutations", () => {
    const grades = source("apps/frontend/src/pages/Grades.tsx");

    expect(grades).toContain("startTransition(() => setActiveTab(nextTab))");
    expect(grades).toContain("requestAnimationFrame");
    expect(grades).not.toContain("tabTransitionTimerRef");
    expect(grades).not.toContain("document.body.style.minHeight");
    expect(grades).not.toContain("void tabsElement.offsetHeight");
    expect(grades).not.toContain('behavior: "smooth"');
  });

  it("uses adaptive motion and CSS state for the mobile sidebar", () => {
    const layout = source("apps/frontend/src/components/AppLayout.tsx");
    const motion = source("apps/frontend/src/hooks/useAdaptiveMotion.ts");
    const styles = source("apps/frontend/src/index.css");

    expect(layout).toContain("useAdaptiveMotion");
    expect(layout).toContain('data-sidebar-state={sidebarOpen ? "open" : "closed"}');
    expect(layout).not.toContain("GSAP: Mobile sidebar slide animation");
    expect(motion).toContain("saveData");
    expect(motion).toContain("deviceMemory");
    expect(motion).toContain("hardwareConcurrency");
    expect(styles).toContain('.sipena-app-sidebar[data-sidebar-state="open"]');
    expect(styles).toContain('html[data-motion-profile="light"]');
  });
});

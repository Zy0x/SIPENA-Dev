import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "../..", relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

describe("app layout responsive sidebar guard", () => {
  it("keeps mobile and tablet navigation expanded, dynamic, and viewport-safe", () => {
    const appLayoutSource = readSource("apps/frontend/src/components/AppLayout.tsx");
    const globalStyles = readSource("apps/frontend/src/index.css");
    const standard = readSource("docs/standards/ui-interaction-scroll-standard.md");
    const asideClassBlock = appLayoutSource.slice(
      appLayoutSource.indexOf("<aside"),
      appLayoutSource.indexOf("style={{", appLayoutSource.indexOf("<aside")),
    );

    expect(appLayoutSource).toContain("const effectiveSidebarCollapsed = isDesktopSidebar && sidebarCollapsed");
    expect(appLayoutSource).toContain("setIsDesktopSidebar(window.innerWidth >= 1024)");
    expect(appLayoutSource).toContain('window.visualViewport?.addEventListener("resize", syncSidebarMode)');
    expect(appLayoutSource).toContain("sipena-app-sidebar");
    expect(appLayoutSource).toContain("sipena-app-header-elevated");
    expect(appLayoutSource).toContain("sipena-sidebar-header-elevated");
    expect(appLayoutSource).toContain('data-sidebar-collapsed={effectiveSidebarCollapsed ? "true" : "false"}');
    expect(appLayoutSource).toContain('data-sidebar-state={sidebarOpen ? "open" : "closed"}');
    expect(appLayoutSource).toContain('{effectiveSidebarCollapsed ? (');
    expect(appLayoutSource).toContain('{!effectiveSidebarCollapsed && (');
    expect(appLayoutSource).toContain('data-sidebar-year-badge="true"');
    expect(appLayoutSource).toContain('"flex flex-col gap-1"');
    expect(appLayoutSource).toContain('transition-[width] duration-200 ease-out');
    expect(asideClassBlock).not.toContain('"w-[260px]"');

    expect(globalStyles).toContain(".sipena-app-sidebar");
    expect(globalStyles).toContain(".sipena-app-header-elevated");
    expect(globalStyles).toContain(".sipena-sidebar-header-elevated");
    expect(globalStyles).toContain(".dark .sipena-app-header-elevated");
    expect(globalStyles).toContain(".dark .sipena-sidebar-header-elevated");
    expect(globalStyles).toContain("width: min(18rem, calc(100vw - 3rem))");
    expect(globalStyles).toContain("height: min(100dvh, var(--sipena-visual-viewport-height, 100dvh))");
    expect(globalStyles).toContain('@media (min-width: 640px) and (max-width: 1023px)');
    expect(globalStyles).toContain('@media (min-width: 1024px)');
    expect(globalStyles).toContain('.sipena-app-sidebar[data-sidebar-collapsed="true"]');
    expect(globalStyles).toContain('.sipena-app-sidebar[data-sidebar-state="open"]');
    expect(globalStyles).toContain("transform: translate3d(-100%, 0, 0)");
    expect(appLayoutSource).toContain("useAdaptiveMotion");
    expect(globalStyles).toContain("--sipena-sidebar-expanded-width");
    expect(globalStyles).toContain("--sipena-sidebar-collapsed-width");
    expect(globalStyles).toContain(".sipena-collapsed-nav-link:hover > div");

    const collapsedNavSource = readSource("apps/frontend/src/components/layout/SidebarNav.tsx");
    expect(collapsedNavSource).toContain("sipena-collapsed-nav-link relative flex h-12");
    expect(collapsedNavSource).toContain("absolute right-1 top-1");
    expect(collapsedNavSource).toContain("flex h-12 items-center overflow-hidden");

    expect(standard).toContain("State collapsed desktop tidak boleh diterapkan ke mobile/tablet");
    expect(standard).toContain("Drawer navigasi harus memakai tinggi dynamic viewport");
  });

  it("keeps admin shell headers visually separated without removing blur", () => {
    const adminSource = readSource("apps/frontend/src/pages/Admin.tsx");

    expect(adminSource).toContain("sipena-app-header-elevated sticky top-0 z-30 h-16");
    expect(adminSource).toContain("sipena-sidebar-header-elevated flex items-center h-16");
    expect(adminSource).toContain("sipena-sidebar-header-elevated flex items-center justify-between h-16");
    expect(adminSource).toContain("backdrop-blur-xl");
  });
});

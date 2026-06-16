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
    expect(appLayoutSource).toContain('data-sidebar-collapsed={effectiveSidebarCollapsed ? "true" : "false"}');
    expect(appLayoutSource).toContain('data-sidebar-state={sidebarOpen ? "open" : "closed"}');
    expect(appLayoutSource).toContain('{effectiveSidebarCollapsed ? (');
    expect(asideClassBlock).not.toContain('"w-[260px]"');

    expect(globalStyles).toContain(".sipena-app-sidebar");
    expect(globalStyles).toContain("width: min(18rem, calc(100vw - 3rem))");
    expect(globalStyles).toContain("height: min(100dvh, var(--sipena-visual-viewport-height, 100dvh))");
    expect(globalStyles).toContain('@media (min-width: 640px) and (max-width: 1023px)');
    expect(globalStyles).toContain('@media (min-width: 1024px)');
    expect(globalStyles).toContain('.sipena-app-sidebar[data-sidebar-collapsed="true"]');
    expect(globalStyles).toContain("--sipena-sidebar-expanded-width");
    expect(globalStyles).toContain("--sipena-sidebar-collapsed-width");

    expect(standard).toContain("State collapsed desktop tidak boleh diterapkan ke mobile/tablet");
    expect(standard).toContain("Drawer navigasi harus memakai tinggi dynamic viewport");
  });
});

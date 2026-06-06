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

describe("interactive text selection guard", () => {
  it("keeps shared interactive primitives non-selectable", () => {
    const buttonSource = readSource("apps/frontend/src/components/ui/button.tsx");
    const selectSource = readSource("apps/frontend/src/components/ui/select.tsx");
    const dropdownSource = readSource("apps/frontend/src/components/ui/dropdown-menu.tsx");
    const tabsSource = readSource("apps/frontend/src/components/ui/tabs.tsx");
    const popoverSource = readSource("apps/frontend/src/components/ui/popover.tsx");

    expect(buttonSource).toContain("inline-flex select-none");
    expect(selectSource).toContain("w-full select-none");
    expect(dropdownSource).toContain("className={cn(\"select-none\", className)}");
    expect(tabsSource).toContain("inline-flex select-none");
    expect(popoverSource).toContain("className={cn(\"select-none\", className)}");
  });

  it("keeps global interactive roles non-selectable while text fields remain selectable", () => {
    const globalCss = readSource("apps/frontend/src/index.css");

    expect(globalCss).toContain("[role=\"button\"]");
    expect(globalCss).toContain("[role=\"menuitem\"]");
    expect(globalCss).toContain("[role=\"option\"]");
    expect(globalCss).toContain("[role=\"tab\"]");
    expect(globalCss).toContain("[data-radix-collection-item]");
    expect(globalCss).toContain("[cmdk-item]");
    expect(globalCss).toContain("user-select: none;");
    expect(globalCss).toContain("input,");
    expect(globalCss).toContain("textarea,");
    expect(globalCss).toContain("user-select: text;");
  });
});

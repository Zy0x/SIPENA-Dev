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

describe("grade toolbar interaction guard", () => {
  it("does not capture pointer events away from toolbar buttons", () => {
    const spreadsheetSource = readSource("apps/frontend/src/components/grades/SpreadsheetTable.tsx");

    expect(spreadsheetSource).toContain("handleToolbarPointerDownCapture");
    expect(spreadsheetSource).toContain("finishToolbarPointer");
    expect(spreadsheetSource).toContain('window.addEventListener("pointerup", handlePointerEnd)');
    expect(spreadsheetSource).not.toContain("setPointerCapture");
    expect(spreadsheetSource).not.toContain("releasePointerCapture");
  });

  it("keeps dropdown guard touch-only so mouse and keyboard use Radix normally", () => {
    const spreadsheetSource = readSource("apps/frontend/src/components/grades/SpreadsheetTable.tsx");

    expect(spreadsheetSource).toContain('e.pointerType !== "touch" && e.pointerType !== "pen"');
    expect(spreadsheetSource).toContain("suppressCoarseDropdownClickUntilRef");
    expect(spreadsheetSource).not.toContain("pointerActive || isToolbarActivationSuppressed()");
  });

  it("documents global scroll chaining contracts", () => {
    const globalStyles = readSource("apps/frontend/src/index.css");
    const scrollHelper = readSource("apps/frontend/src/lib/scrollChaining.ts");
    const standard = readSource("docs/standards/ui-interaction-scroll-standard.md");

    expect(globalStyles).toContain(".sipena-scroll-chain-page");
    expect(globalStyles).toContain(".sipena-scroll-isolated");
    expect(scrollHelper).toContain("isVerticalScrollBoundary");
    expect(scrollHelper).toContain("scrollPageBy");
    expect(standard).toContain("setPointerCapture");
  });
});

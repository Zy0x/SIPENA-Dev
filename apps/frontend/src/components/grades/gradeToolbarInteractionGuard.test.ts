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
    const gradesPageSource = readSource("apps/frontend/src/pages/Grades.tsx");
    const tapGuardSource = readSource("apps/frontend/src/hooks/useCoarsePointerTapGuard.ts");

    expect(tapGuardSource).toContain('event.pointerType === "touch" || event.pointerType === "pen"');
    expect(tapGuardSource).toContain("markMovedIfNeeded(event, state)");
    expect(tapGuardSource).toContain("state.cancelled");
    expect(tapGuardSource).toContain("onPointerMove");
    expect(tapGuardSource).toContain("onPointerCancel");
    expect(spreadsheetSource).toContain("useCoarsePointerTapGuard<HTMLButtonElement>");
    expect(spreadsheetSource).toContain("protectionDropdownTapGuard.onPointerMove");
    expect(spreadsheetSource).toContain("fullscreenDropdownTapGuard.onPointerCancel");
    expect(gradesPageSource).toContain("showGradeManageMenu");
    expect(gradesPageSource).toContain("gradeManageDropdownTapGuard.onPointerMove");
    expect(gradesPageSource).toContain("gradeManageDropdownTapGuard.onPointerCancel");
    expect(spreadsheetSource).not.toContain("pointerActive || isToolbarActivationSuppressed()");
  });

  it("documents global scroll chaining contracts", () => {
    const globalStyles = readSource("apps/frontend/src/index.css");
    const scrollHelper = readSource("apps/frontend/src/lib/scrollChaining.ts");
    const standard = readSource("docs/standards/ui-interaction-scroll-standard.md");

    expect(globalStyles).toContain(".sipena-scroll-chain-page");
    expect(globalStyles).toContain(".sipena-scroll-isolated");
    expect(globalStyles).toContain("touch-action: pan-x pan-y");
    expect(scrollHelper).toContain("isVerticalScrollBoundary");
    expect(scrollHelper).toContain("scrollPageBy");
    expect(standard).toContain("setPointerCapture");
  });

  it("lets vertical touch gestures escape toolbar and frozen table edges in fullscreen", () => {
    const spreadsheetSource = readSource("apps/frontend/src/components/grades/SpreadsheetTable.tsx");
    const globalStyles = readSource("apps/frontend/src/index.css");

    expect(globalStyles).toContain(".sipena-grade-toolbar button");
    expect(globalStyles).toContain("touch-action: pan-x pan-y !important");
    expect(spreadsheetSource).toContain("const shouldReleaseToPage = isVerticalWheel &&");
    expect(spreadsheetSource).toContain("const shouldReleaseToPage = isMostlyVertical &&");
    expect(spreadsheetSource).not.toContain("!isFullscreen && isVerticalWheel");
    expect(spreadsheetSource).not.toContain("!isFullscreen && isMostlyVertical");
  });

  it("keeps observed mobile grade outliers compact", () => {
    const spreadsheetSource = readSource("apps/frontend/src/components/grades/SpreadsheetTable.tsx");
    const globalStyles = readSource("apps/frontend/src/index.css");
    const standard = readSource("docs/standards/responsive-input-grade-standard.md");

    expect(spreadsheetSource).toContain("min(100dvh, var(--sipena-visual-viewport-height, 100dvh))");
    expect(spreadsheetSource).toContain("sipena-grade-info-bar");
    expect(globalStyles).toContain("@media (max-width: 430px) and (max-height: 540px)");
    expect(globalStyles).toContain(".sipena-grade-card-actions .sipena-grade-rounding-badge");
    expect(globalStyles).toContain("height: clamp(260px, calc(100dvh - 9rem), 360px)");
    expect(globalStyles).toContain("@media (orientation: landscape) and (max-height: 380px)");
    expect(standard).toContain("393x406");
    expect(standard).toContain("946x335");
  });
});

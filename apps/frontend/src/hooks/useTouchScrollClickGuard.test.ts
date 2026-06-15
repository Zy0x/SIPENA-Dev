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

describe("touch scroll click guard", () => {
  it("mounts a capture-phase touch/pen guard globally without blocking mouse clicks", () => {
    const hookSource = readSource("apps/frontend/src/hooks/useTouchScrollClickGuard.ts");
    const appSource = readSource("apps/frontend/src/app/App.tsx");

    expect(hookSource).toContain('event.pointerType === "touch" || event.pointerType === "pen"');
    expect(hookSource).toContain("TOUCH_SCROLL_CLICK_THRESHOLD_PX");
    expect(hookSource).toContain("TOUCH_SCROLL_CLICK_SUPPRESS_MS");
    expect(hookSource).toContain("movedBeyondThreshold");
    expect(hookSource).not.toContain("startedOnInteractive");
    expect(hookSource).toContain("document.addEventListener(\"pointerdown\", handlePointerDown, true)");
    expect(hookSource).toContain("document.addEventListener(\"pointermove\", handlePointerMove, true)");
    expect(hookSource).toContain("document.addEventListener(\"pointercancel\", handlePointerCancel, true)");
    expect(hookSource).toContain("document.addEventListener(\"click\", handleClick, true)");
    expect(hookSource).toContain("event.stopImmediatePropagation()");
    expect(hookSource).toContain("[role='button']");
    expect(hookSource).toContain("[role='combobox']");
    expect(hookSource).toContain("[aria-haspopup='menu']");
    expect(hookSource).toContain("[aria-haspopup='listbox']");
    expect(hookSource).toContain("[data-radix-collection-item]");
    expect(hookSource).toContain("[data-touch-scroll-click-target='true']");
    expect(appSource).toContain("useTouchScrollClickGuard()");
  });
});

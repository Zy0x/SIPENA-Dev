import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("apps/frontend/src/components/grades/ChapterStructure.tsx", "utf8");

describe("ChapterStructure responsive editing guard", () => {
  it("does not cap BAB or task edit inputs with fixed desktop max widths", () => {
    expect(source).not.toContain("sm:max-w-xl");
    expect(source).not.toContain("sm:max-w-lg");
    expect(source).toContain("className=\"h-10 min-w-0 w-full px-3\"");
  });

  it("moves edit actions below the input on narrow viewports", () => {
    expect(source).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(source).toContain("max-[820px]:grid-cols-1");
    expect(source).toContain("max-[820px]:border-t max-[820px]:pt-2");
  });

  it("keeps chapter open/close triggers separate from edit and delete actions", () => {
    expect(source).toContain("<CollapsibleTrigger asChild>");
    expect(source).toContain("<button");
    expect(source).toContain("aria-label=\"Edit nama BAB\"");
    expect(source.indexOf("<CollapsibleTrigger asChild>")).toBeLessThan(
      source.indexOf("aria-label=\"Edit nama BAB\""),
    );
  });

  it("keeps mobile action targets large enough for touch", () => {
    expect(source).toContain("className=\"h-10 w-10 sm:h-9 sm:w-9\"");
    expect(source).toContain("className=\"h-10 w-10 shrink-0\"");
    expect(source).toContain("className=\"mt-2 min-h-10 w-full gap-2\"");
  });

  it("gives edit fields priority over non-critical icons on very narrow phones", () => {
    expect(source).toContain("max-[420px]:grid-cols-1");
    expect(source).toContain("max-[420px]:hidden");
  });
});

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  return existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
}

const source = (relativePath: string) => readFileSync(repoPath(relativePath), "utf8");

describe("Input Nilai responsive refactor guard", () => {
  it("uses explicit browser and maximal fullscreen modes", () => {
    const page = source("apps/frontend/src/pages/Grades.tsx");
    const table = source("apps/frontend/src/components/grades/SpreadsheetTable.tsx");

    expect(page).toContain('useState<"browser" | "maximal" | null>');
    expect(table).toContain("Layar Penuh Browser");
    expect(table).toContain("Layar Penuh Maksimal");
    expect(table).not.toContain("Mode Layar Penuh Native");
  });

  it("keeps one grade-management menu owner during fullscreen", () => {
    const page = source("apps/frontend/src/pages/Grades.tsx");

    expect(page).toContain("!isFullscreen && gradeToolbarActions");
    expect(page).toContain("runAfterGradeManageMenuCloses");
    expect(page).toContain("setShowGradeManageMenu(false)");
  });

  it("keeps protection mode icon and selected state aligned", () => {
    const table = source("apps/frontend/src/components/grades/SpreadsheetTable.tsx");

    expect(table).toContain("PROTECTION_MODE_META");
    expect(table).toContain("<ProtectionModeIcon");
    expect(table).toContain("<DropdownMenuRadioGroup value={protectionMode}");
    expect(table).toContain('data-[state=checked]:bg-primary/10');
  });

  it("provides animated resize feedback without replacing width logic", () => {
    const table = source("apps/frontend/src/components/grades/SpreadsheetTable.tsx");
    const styles = source("apps/frontend/src/index.css");

    expect(table).toContain("setColumnWidths");
    expect(table).toContain("resizeFeedback");
    expect(table).toContain("sipena-grade-resize-guide");
    expect(styles).toContain("sipena-grade-resize-handle-line");
    expect(styles).toContain("prefers-reduced-motion: reduce");
  });

  it("uses a two-row compact fullscreen toolbar without horizontal scrolling", () => {
    const styles = source("apps/frontend/src/index.css");

    expect(styles).toContain("@container grade-sheet (max-width: 1079px)");
    expect(styles).toContain("grid-template-rows: auto auto");
    expect(styles).toContain("overflow: visible");
    expect(styles).toContain(".sipena-grade-toolbar-slot--manage");

    // Must not introduce horizontal scroll on compact toolbar (isolate the grade-sheet container query block)
    const containerBlockStart = styles.indexOf("@container grade-sheet (max-width: 1079px)");
    const containerBlockEnd = styles.indexOf("@container grade-sheet (max-width: 459px)");
    expect(containerBlockStart).toBeGreaterThan(-1);
    expect(containerBlockEnd).toBeGreaterThan(containerBlockStart);

    const compactToolbarCSS = styles.slice(containerBlockStart, containerBlockEnd);
    expect(compactToolbarCSS).not.toContain("overflow-x");
  });

  it("keeps chapter and assignment actions visually and semantically distinct", () => {
    const chapter = source("apps/frontend/src/components/grades/ChapterStructure.tsx");

    expect(chapter).toContain("Aksi BAB");
    expect(chapter).toContain("Aksi tugas");
    expect(chapter).toContain('"grade-chapter-card"');
    expect(chapter).toContain("border-l-4");
  });

  it("uses tailwind grid classes for card actions bento layout", () => {
    const sourceCode = source("apps/frontend/src/pages/Grades.tsx");

    // Assert that the Bento grid is applied via Tailwind utility classes
    expect(sourceCode).toContain("sipena-grade-card-actions flex flex-wrap gap-2 w-full sm:flex-1 lg:flex-none lg:w-auto lg:justify-end");
    
    // Assert that rounding slot is flex-auto
    expect(sourceCode).toContain("sipena-grade-toolbar-slot--rounding flex-auto min-w-[130px] lg:flex-none lg:min-w-0");

    // Assert that search slot is flex-auto
    expect(sourceCode).toContain("sipena-grade-toolbar-slot--search w-full lg:flex-none lg:w-auto lg:min-w-0");
  });

  it("retains low-height viewport rule for fullscreen mode", () => {
    const styles = source("apps/frontend/src/index.css");

    // Low-height landscape viewport rule (946×335 and similar)
    expect(styles).toContain("@media (max-height: 380px)");
    expect(styles).toContain("sipena-grade-toolbar--fullscreen");
  });
});

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

describe("export studio preview zoom defaults", () => {
  it("starts desktop live preview at a fit-friendly zoom without changing compact auto-fit", () => {
    const source = readSource("apps/frontend/src/components/export/ExportStudioDialog.tsx");

    expect(source).toContain("const DESKTOP_PREVIEW_DEFAULT_ZOOM = 80");
    expect(source).toContain("setPreviewZoom(isCompactLayout ? 100 : DESKTOP_PREVIEW_DEFAULT_ZOOM)");
    expect(source).toContain("const defaultPreviewZoom = isCompactLayout ? autoPreviewZoom : DESKTOP_PREVIEW_DEFAULT_ZOOM");
    expect(source).toContain("onClick={() => setPreviewZoom(defaultPreviewZoom)}");
    expect(source).toContain("Kembalikan zoom preview ke posisi fit awal.");
    expect(source).not.toContain("setPreviewZoom(isCompactLayout ? autoPreviewZoom : 100)");
  });
});

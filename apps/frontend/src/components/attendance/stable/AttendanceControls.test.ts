import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (relativePath: string) =>
  readFileSync(resolve(process.cwd(), relativePath), "utf8");

describe("AttendanceControls calendar legend guard", () => {
  it("keeps the date picker legend visually aligned with calendar states", () => {
    const source = readSource("apps/frontend/src/components/attendance/stable/AttendanceControls.tsx");

    expect(source).toContain("Keterangan Warna Kalender");
    expect(source).toContain("Tanggal Terpilih");
    expect(source).toContain("Hari Minggu");
    expect(source).toContain("Hari Ini");
    expect(source).toContain("day_selected");
    expect(source).toContain("bg-primary/10 text-primary ring-2 ring-primary ring-inset");
    expect(source).toContain("sunday: \"bg-amber-100");
    expect(source).toContain("day_today");
    expect(source).toContain("ring-cyan-500/80");
  });
});

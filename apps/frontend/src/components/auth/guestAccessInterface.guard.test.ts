import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("guest access interface guard", () => {
  it("keeps the public share interface responsive and account-first", () => {
    const source = readSource("apps/frontend/src/pages/GuestAccess.tsx");

    expect(source).toContain("min-h-[100dvh]");
    expect(source).toContain("Akses Guru Tamu");
    expect(source).toContain("Masuk / Daftar SIPENA");
    expect(source).toContain("Masuk Cepat tanpa Akun");
    expect(source).toContain("Collapsible open={quickAccessOpen}");
    expect(source).toContain("Memeriksa Sesi Akun");
    expect(source).toContain("Akses Sudah Dicabut");
    expect(source).toContain("Link Sudah Kedaluwarsa");
  });

  it("keeps signed-in and owner flows distinct", () => {
    const source = readSource("apps/frontend/src/pages/GuestAccess.tsx");

    expect(source).toContain("Lanjut dengan Akun SIPENA");
    expect(source).toContain("Lanjut Input Nilai");
    expect(source).toContain("Gunakan Akun Lain");
    expect(source).toContain("Ini Link Milik Anda");
    expect(source).toContain("Buka Input Nilai Saya");
    expect(source).toContain("isContinuingAccount");
  });

  it("uses stable tabs and a bounded dialog without touching guest grade input", () => {
    const source = readSource("apps/frontend/src/components/auth/GuestAuthDialog.tsx");

    expect(source).toContain("TabsList className=\"grid h-12 w-full grid-cols-2\"");
    expect(source).toContain("TabsTrigger value=\"initial\"");
    expect(source).toContain("TabsTrigger value=\"register\"");
    expect(source).toContain("max-h-[min(94dvh,760px)]");
    expect(source).toContain("onOpenAutoFocus={(event) => event.preventDefault()}");
    expect(source).toContain("DialogFooter");
    expect(source).not.toContain("/guest/grades");
  });
});

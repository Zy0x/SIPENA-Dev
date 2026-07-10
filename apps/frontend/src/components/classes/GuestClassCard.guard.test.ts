import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSource(relativePath: string) {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("guest class card guard", () => {
  it("keeps guest class actions separate from owner management actions", () => {
    const source = readSource("apps/frontend/src/components/classes/GuestClassCard.tsx");

    expect(source).toContain("Guru Tamu");
    expect(source).toContain("Dibagikan oleh");
    expect(source).toContain("buildGuestSessionPayload");
    expect(source).toContain("/guest/grades?token=");
    expect(source).not.toContain("Edit Kelas");
    expect(source).not.toContain("Hapus Kelas");
    expect(source).not.toContain("Duplikasi");
    expect(source).not.toContain("Tambah Murid");
  });

  it("wires guest access into dashboard and classes without replacing owner classes", () => {
    const classes = readSource("apps/frontend/src/pages/Classes.tsx");
    const dashboard = readSource("apps/frontend/src/pages/Dashboard.tsx");

    expect(classes).toContain("useGuestAccesses");
    expect(classes).toContain("GuestClassCard");
    expect(classes).toContain("Kelas Saya");
    expect(classes).toContain("Guru Tamu");
    expect(classes).toContain("Belum ada akses guru tamu");
    expect(dashboard).toContain("Akses Guru Tamu");
    expect(dashboard).toContain("buildGuestSessionPayload");
  });

  it("keeps share link and logged-in guest access flows usable", () => {
    const shareDialog = readSource("apps/frontend/src/components/subjects/ShareLinkDialog.tsx");
    const guestAccess = readSource("apps/frontend/src/pages/GuestAccess.tsx");

    expect(shareDialog).toContain("Dialog open={open}");
    expect(shareDialog).toContain("AlertDialog open={showConfirmRevoke}");
    expect(shareDialog).toContain("AlertDialog open={showConfirmDelete}");
    expect(shareDialog).toContain("sm:grid-cols-[repeat(3,minmax(0,1fr))]");
    expect(guestAccess).toContain("useAuth");
    expect(guestAccess).toContain("Lanjut dengan Akun SIPENA");
    expect(guestAccess).toContain("Lanjut Input Nilai");
    expect(guestAccess).toContain("Ini Link Milik Anda");
    expect(guestAccess).toContain("handleContinueWithSignedInAccount");
  });
});

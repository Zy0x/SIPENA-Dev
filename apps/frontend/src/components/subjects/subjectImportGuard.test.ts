import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function repoPath(relativePath: string): string {
  const direct = resolve(process.cwd(), relativePath);
  return existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
}

function readSource(relativePath: string): string {
  return readFileSync(repoPath(relativePath), "utf8");
}

describe("subject import UI guard", () => {
  it("keeps historical filters, selectable preview, and two-step structure confirmation", () => {
    const source = readSource("apps/frontend/src/components/subjects/ImportSubjectsDialog.tsx");

    expect(source).toContain("Tahun Ajaran");
    expect(source).toContain("Semester");
    expect(source).toContain("Kelas Sumber");
    expect(source).toContain("Pilih Semua");
    expect(source).toContain("Hapus Pilihan");
    expect(source).toContain("Sertakan struktur pembelajaran");
    expect(source).toContain("structureAcknowledged");
    expect(source).toContain("finalConfirmOpen");
    expect(source).toContain("loadStructureSummary");
    expect(source).toContain("reviewImport");
    expect(source).toContain("dihitung satu kali saat Anda memilih Periksa & Import");
    expect(source).toContain("useSubjects(sourceClassId, false, false)");
    expect(source).not.toContain("useQuery({");
    expect(source).toContain("Nilai siswa tidak akan disalin");
    expect(source).toContain("onOpenAutoFocus");
    expect(source).not.toContain("autoFocus");
  });

  it("keeps the page tour conditional without creating dummy data", () => {
    const source = readSource("apps/frontend/src/pages/Subjects.tsx");

    expect(source).toContain("subjects.length === 0");
    expect(source).toContain("prepareSubjectsTour");
    expect(source).toContain("onBeforeStart={prepareSubjectsTour}");
    expect(source).toContain("ImportSubjectsDialog");
    expect(source).toContain("Tambah Kelas Baru");
    expect(source).toContain("AddClassDialog");
    expect(source).toContain("grid-cols-[minmax(0,1fr)_8.5rem]");
    expect(source).not.toContain("dummy");
  });
});

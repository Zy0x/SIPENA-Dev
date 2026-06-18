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

describe("class student import guard", () => {
  it("routes the class page Excel import to the multi-class workbook dialog", () => {
    const classesSource = readSource("apps/frontend/src/pages/Classes.tsx");
    const dialogSource = readSource("apps/frontend/src/components/classes/ImportClassesStudentsDialog.tsx");
    const parserSource = readSource("apps/frontend/src/lib/classStudentImport.ts");
    const studioSource = readSource("apps/frontend/src/components/studio/ResponsiveStudio.tsx");
    const docsSource = readSource("docs/guide/class-student-import.md");

    expect(classesSource).toContain("ImportClassesStudentsDialog");
    expect(classesSource).toContain("classImportDialogOpen");
    expect(classesSource).toContain("Import Kelas & Siswa");
    expect(classesSource).not.toContain("handleOpenImport({ id: classes[0].id");
    expect(classesSource).not.toContain("setSelectedClassForImport");

    expect(dialogSource).toContain("downloadClassStudentImportTemplate");
    expect(dialogSource).toContain("buildClassStudentImportPlan");
    expect(dialogSource).toContain("Preview & Validasi");
    expect(dialogSource).toContain("Saya sudah memeriksa warning");
    expect(dialogSource).toContain("Import Kelas & Siswa");
    expect(dialogSource).toContain("Kolom wajib: Nama Kelas, KKM Kelas, Nama Siswa, dan NISN");

    expect(parserSource).toContain("Siswa - ");
    expect(parserSource).toContain("Sheet Kelas wajib ada");
    expect(parserSource).toContain("Nama kelas maksimal");
    expect(parserSource).toContain("NISN wajib diisi");
    expect(parserSource).toContain("NISN sudah dipakai");
    expect(parserSource).toContain("Langkah pengisian untuk pengguna baru");
    expect(parserSource).toContain("Checklist sebelum upload");

    expect(studioSource).toContain("overflow-x-auto overscroll-x-contain");
    expect(studioSource).toContain('min-w-[42rem]');

    expect(docsSource).toContain("Import Kelas & Siswa");
    expect(docsSource).toContain("Siswa - <Nama Kelas>");
    expect(docsSource).toContain("Import Siswa ke Kelas Ini");
    expect(docsSource).toContain("Cara Mengisi Template");
    expect(docsSource).toContain("Cara Membaca Error dan Warning");
  });
});

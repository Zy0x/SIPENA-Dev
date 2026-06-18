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
    expect(dialogSource).toContain("Cek Data");
    expect(dialogSource).toContain("Saya sudah memeriksa catatan kuning");
    expect(dialogSource).toContain("Import Kelas & Siswa");
    expect(dialogSource).toContain("Pilih kelas yang ingin dimasukkan");
    expect(dialogSource).toContain("includedClassKeys");
    expect(dialogSource).toContain("setAllClassesIncluded");
    expect(dialogSource).toContain("toggleClassIncluded");
    expect(dialogSource).toContain("sipena-import-class-include-checkbox");
    expect(dialogSource).toContain('mode="table"');
    expect(dialogSource).toContain("selectedTotals.errorCount");
    expect(dialogSource).toContain("classesExcluded");
    expect(dialogSource).toContain("studentsExcluded");

    expect(parserSource).toContain("Siswa - ");
    expect(parserSource).toContain("xlsx-js-style");
    expect(parserSource).toContain("Sheet Kelas wajib ada");
    expect(parserSource).toContain("Nama kelas maksimal");
    expect(parserSource).toContain("NISN wajib diisi");
    expect(parserSource).toContain("NISN sudah dipakai");
    expect(parserSource).toContain("Cara isi cepat");
    expect(parserSource).toContain("Checklist sebelum upload");
    expect(parserSource).toContain("TEMPLATE_COLORS");
    expect(parserSource).toContain("applyGuideSheetStyle");
    expect(parserSource).toContain("estimateWrappedRowHeight");

    expect(studioSource).toContain("sipena-responsive-data-table-scroll");
    expect(studioSource).toContain("overflow-x-scroll overscroll-x-contain");
    expect(studioSource).toContain('min-w-[46rem]');
    expect(studioSource).toContain('addEventListener("pointermove"');
    expect(studioSource).toContain("getCoalescedEvents");
    expect(studioSource).toContain("window.requestAnimationFrame");
    expect(studioSource).toContain("state.pendingScrollLeft = state.scrollLeft - deltaX");
    expect(studioSource).toContain("state.velocityX");
    expect(studioSource).toContain("runMomentum");
    expect(studioSource).toContain("}, 120)");

    const cssSource = readSource("apps/frontend/src/index.css");
    expect(cssSource).toContain('[role="checkbox"][data-state="checked"]');
    expect(cssSource).toContain(".sipena-import-class-include-checkbox");
    expect(cssSource).toContain("touch-action: pan-y");
    expect(cssSource).toContain("touch-action: pan-x pan-y");

    expect(docsSource).toContain("Import Kelas & Siswa");
    expect(docsSource).toContain("Siswa - <Nama Kelas>");
    expect(docsSource).toContain("Import Siswa ke Kelas Ini");
    expect(docsSource).toContain("Cara Mengisi Template");
    expect(docsSource).toContain("tinggi baris otomatis");
    expect(docsSource).toContain("Cara Membaca Error dan Warning");
    expect(docsSource).toContain("kotak centang **Ikut**");
    expect(docsSource).toContain("Tabel cek data bisa digeser ke samping");
    expect(docsSource).toContain("error/warning milik kelas tersebut tidak memblokir import kelas lain");
  });
});

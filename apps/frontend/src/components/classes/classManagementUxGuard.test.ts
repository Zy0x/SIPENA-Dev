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

describe("class management UX guard", () => {
  it("keeps class form limits visible and enforced", () => {
    const limitsSource = readSource("apps/frontend/src/components/classes/classFormLimits.ts");
    const addSource = readSource("apps/frontend/src/components/classes/AddClassDialog.tsx");
    const editSource = readSource("apps/frontend/src/components/classes/EditClassDialog.tsx");

    expect(limitsSource).toContain("CLASS_NAME_MAX_LENGTH = 50");
    expect(limitsSource).toContain("CLASS_DESCRIPTION_MAX_LENGTH = 500");
    expect(addSource).toContain("maxLength={CLASS_NAME_MAX_LENGTH}");
    expect(addSource).toContain("maxLength={CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(addSource).toContain("{name.length}/{CLASS_NAME_MAX_LENGTH}");
    expect(addSource).toContain("{description.length}/{CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(editSource).toContain("maxLength={CLASS_NAME_MAX_LENGTH}");
    expect(editSource).toContain("maxLength={CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(editSource).toContain("limitClassName(name.trim())");
    expect(editSource).toContain("limitClassDescription(description.trim())");
  });

  it("keeps class cards discoverable without hover-only menu actions", () => {
    const cardSource = readSource("apps/frontend/src/components/classes/ClassCard.tsx");

    expect(cardSource).toContain('data-tour="class-card-menu"');
    expect(cardSource).toContain("rounded-full border border-border/70");
    expect(cardSource).toContain("Edit Kelas");
    expect(cardSource).toContain("Duplikasi");
    expect(cardSource).toContain("Hapus Kelas");
    expect(cardSource).not.toContain("opacity-0 group-hover:opacity-100");
    expect(cardSource).not.toContain("Lihat Detail");
    expect(cardSource).not.toContain("Tambah Siswa");
  });

  it("shows class detail summary before search without focusing mobile keyboard", () => {
    const detailSource = readSource("apps/frontend/src/components/classes/ClassDetailDialog.tsx");

    expect(detailSource).toContain('data-tour="class-detail-summary"');
    expect(detailSource).toContain("Deskripsi Kelas");
    expect(detailSource).toContain("Belum ada deskripsi kelas.");
    expect(detailSource).toContain("onOpenAutoFocus");
    expect(detailSource).toContain("event.preventDefault()");
    expect(detailSource).toContain("titleRef.current?.focus()");
  });

  it("documents the main class management actions in product tour", () => {
    const classesSource = readSource("apps/frontend/src/pages/Classes.tsx");

    expect(classesSource).toContain("class-import-menu");
    expect(classesSource).toContain("class-kkm-alert");
    expect(classesSource).toContain("class-card-actions");
    expect(classesSource).toContain("class-card-menu");
    expect(classesSource).toContain("Menu Lanjutan");
  });
});

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
    expect(addSource).toContain("onOpenAutoFocus");
    expect(addSource).toContain("event.preventDefault()");
    expect(addSource).toContain("titleRef.current?.focus()");
    expect(addSource).toContain("maxLength={CLASS_NAME_MAX_LENGTH}");
    expect(addSource).toContain("maxLength={CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(addSource).not.toContain("autoFocus");
    expect(addSource).toContain("{name.length}/{CLASS_NAME_MAX_LENGTH}");
    expect(addSource).toContain("{description.length}/{CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(editSource).toContain("maxLength={CLASS_NAME_MAX_LENGTH}");
    expect(editSource).toContain("maxLength={CLASS_DESCRIPTION_MAX_LENGTH}");
    expect(editSource).toContain("limitClassName(name.trim())");
    expect(editSource).toContain("limitClassDescription(description.trim())");
  });

  it("keeps class page mobile header and search layout usable", () => {
    const classesSource = readSource("apps/frontend/src/pages/Classes.tsx");
    const cssSource = readSource("apps/frontend/src/index.css");
    const docsSource = readSource("docs/standards/ui-interaction-scroll-standard.md");

    expect(classesSource).toContain("flex flex-col gap-3 sm:flex-row");
    expect(classesSource).toContain("grid grid-cols-[auto_auto_minmax(0,1fr)]");
    expect(classesSource).toContain("sipena-search-field");
    expect(classesSource).toContain("sipena-search-input");
    expect(classesSource).toContain("Gunakan tombol di kartu kelas untuk membuka detail, siswa, mapel, atau nilai.");
    expect(classesSource).toContain('align="start"');
    expect(cssSource).toContain(".sipena-search-field");
    expect(cssSource).toContain(".sipena-search-field:focus-within");
    expect(cssSource).toContain(".sipena-search-field .sipena-search-input");
    expect(docsSource).toContain("Kotak pencarian wajib menggambar border/focus ring di wrapper luar");
    expect(docsSource).toContain("Dropdown menu wajib collision-aware");
  });

  it("keeps class cards discoverable without hover-only menu actions", () => {
    const cardSource = readSource("apps/frontend/src/components/classes/ClassCard.tsx");

    expect(cardSource).toContain('data-tour="class-card-menu"');
    expect(cardSource).toContain("sm:h-11 sm:w-11");
    expect(cardSource).toContain("text-base font-bold");
    expect(cardSource).toContain("space-y-1 px-1.5 sm:px-2");
    expect(cardSource).toContain("line-clamp-2");
    expect(cardSource).toContain("text-justify");
    expect(cardSource).toContain("rounded-full border border-border/70");
    expect(cardSource).toContain("Edit Kelas");
    expect(cardSource).toContain("Duplikasi");
    expect(cardSource).toContain("Hapus Kelas");
    expect(cardSource).not.toContain("sm:h-20 sm:w-20");
    expect(cardSource).not.toContain("sm:h-14 sm:w-14");
    expect(cardSource).not.toContain("sm:text-3xl");
    expect(cardSource).not.toContain("sm:text-2xl");
    expect(cardSource).not.toContain("opacity-0 group-hover:opacity-100");
    expect(cardSource).not.toContain("Lihat Detail");
    expect(cardSource).not.toContain("Tambah Siswa");
  });

  it("shows class detail summary before search without focusing mobile keyboard", () => {
    const detailSource = readSource("apps/frontend/src/components/classes/ClassDetailDialog.tsx");
    const alertDialogSource = readSource("apps/frontend/src/components/ui/alert-dialog.tsx");
    const editStudentSource = readSource("apps/frontend/src/components/classes/EditStudentDialog.tsx");
    const dialogSource = readSource("apps/frontend/src/components/ui/dialog.tsx");
    const toastSource = readSource("apps/frontend/src/components/ui/enhanced-toast.tsx");

    expect(detailSource).toContain('data-tour="class-detail-summary"');
    expect(detailSource).toContain("Deskripsi Kelas");
    expect(detailSource).toContain("Belum ada deskripsi kelas.");
    expect(detailSource).toContain("isDescriptionExpanded");
    expect(detailSource).toContain("line-clamp-2");
    expect(detailSource).toContain("text-justify");
    expect(detailSource).toContain("py-2.5");
    expect(detailSource).toContain("max-w-4xl");
    expect(detailSource).toContain("w-[calc(100vw-0.75rem)]");
    expect(detailSource).toContain("justify-center text-xs sm:text-sm");
    expect(detailSource).toContain("overflow-x-scroll overflow-y-auto");
    expect(detailSource).toContain('min-w-[40rem]');
    expect(detailSource).toContain('w-[17rem]');
    expect(detailSource).toContain("break-all");
    expect(detailSource).toContain("border-separate border-spacing-0");
    expect(detailSource).toContain("isolate min-h-0 flex-1 overflow-x-scroll");
    expect(detailSource).toContain("sticky right-0");
    expect(detailSource).toContain("tableScrollRef.current?.scrollTo({ left: 0 })");
    expect(detailSource).toContain("sipena-search-field min-h-11");
    expect(detailSource).toContain("Lihat selengkapnya...");
    expect(detailSource).toContain("onOpenAutoFocus");
    expect(detailSource).toContain("event.preventDefault()");
    expect(detailSource).toContain("titleRef.current?.focus()");
    expect(editStudentSource).toContain("onOpenAutoFocus");
    expect(editStudentSource).toContain("titleRef.current?.focus()");
    expect(editStudentSource).not.toContain("autoFocus");
    expect(dialogSource).toContain("z-[10080]");
    expect(dialogSource).toContain("z-[10090]");
    expect(dialogSource).toContain("DialogStackDepthContext");
    expect(dialogSource).toContain("10080 + stackOffset");
    expect(dialogSource).toContain("10090 + stackOffset");
    expect(alertDialogSource).toContain("z-[10100]");
    expect(alertDialogSource).toContain("z-[10110]");
    expect(toastSource).toContain("z-[10130]");
  });

  it("keeps add student modal touch-safe and duplicate verification responsive", () => {
    const addStudentSource = readSource("apps/frontend/src/components/classes/AddStudentDialog.tsx");
    const tabsSource = readSource("apps/frontend/src/components/ui/tabs.tsx");
    const dropdownSource = readSource("apps/frontend/src/components/ui/dropdown-menu.tsx");
    const selectSource = readSource("apps/frontend/src/components/ui/select.tsx");
    const tourSource = readSource("apps/frontend/src/components/ui/product-tour.tsx");
    const cssSource = readSource("apps/frontend/src/index.css");

    expect(addStudentSource).toContain("onOpenAutoFocus");
    expect(addStudentSource).toContain("titleRef.current?.focus()");
    expect(addStudentSource).not.toContain("autoFocus");
    expect(addStudentSource).toContain('autoComplete="off"');
    expect(addStudentSource).toContain("Nama sama dengan");
    expect(addStudentSource).toContain("h-[min(calc(100dvh-1rem),44rem)]");
    expect(addStudentSource).toContain("min-h-0 flex-1 overflow-y-auto");
    expect(addStudentSource).toContain("shrink-0 gap-2 border-t border-border");
    expect(addStudentSource).toContain("Simpan Pilihan");
    expect(addStudentSource).toContain("Paksa Tambah Semua");
    expect(addStudentSource).toContain("Tandai Semua untuk Dilewati");
    expect(addStudentSource).toContain("Izinkan Semua Ditambahkan");
    expect(tabsSource).toContain("rounded-xl border border-border/70");
    expect(tabsSource).toContain("touch-manipulation");
    expect(tabsSource).toContain("data-[state=active]:bg-primary");
    expect(tabsSource).toContain("active:bg-primary active:text-primary-foreground");
    expect(dropdownSource).toContain("collisionPadding = 12");
    expect(dropdownSource).toContain("max-h-[min(var(--radix-dropdown-menu-content-available-height),calc(100dvh-1rem))]");
    expect(dropdownSource).toContain("z-[10120]");
    expect(selectSource).toContain("z-[10120]");
    expect(cssSource).toContain(':where(.app-page table thead, [role="dialog"] table thead, .sipena-table-header)');
    expect(cssSource).toContain(':where(.app-page table thead th, [role="dialog"] table thead th)');
    expect(tourSource).toContain("bg-emerald-600 text-white");
    expect(tourSource).toContain("active:bg-emerald-700 active:text-white");
    expect(tourSource).toContain("bg-primary text-primary-foreground");
    expect(tourSource).toContain("active:bg-primary active:text-primary-foreground");
  });

  it("documents the main class management actions in product tour", () => {
    const classesSource = readSource("apps/frontend/src/pages/Classes.tsx");
    const tourSource = readSource("apps/frontend/src/components/ui/product-tour.tsx");

    expect(classesSource).toContain("class-import-menu");
    expect(classesSource).toContain("class-kkm-alert");
    expect(classesSource).toContain("class-card-actions");
    expect(classesSource).toContain("class-card-menu");
    expect(classesSource).toContain("Menu Lanjutan");
    expect(classesSource).toContain("tourDummyClass");
    expect(classesSource).toContain("Contoh Kelas VIIA");
    expect(classesSource).toContain("onBeforeStart={prepareClassesTour}");
    expect(classesSource).toContain("onComplete={cleanupClassesTour}");
    expect(tourSource).toContain("onBeforeStart?: () => void | Promise<void>");
  });
});

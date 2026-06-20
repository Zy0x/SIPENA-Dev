import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  const direct = resolve(process.cwd(), relativePath);
  const filePath = existsSync(direct) ? direct : resolve(process.cwd(), "../..", relativePath);
  return readFileSync(filePath, "utf8");
}

describe("OCR BETA integration guard", () => {
  const dialog = source("apps/frontend/src/components/import/OCRImportDialog.tsx");
  const classes = source("apps/frontend/src/pages/Classes.tsx");
  const grades = source("apps/frontend/src/pages/Grades.tsx");
  const attendance = source("apps/frontend/src/pages/Attendance.tsx");
  const addClass = source("apps/frontend/src/components/classes/AddClassDialog.tsx");
  const studio = source("apps/frontend/src/components/studio/ResponsiveStudio.tsx");
  const viewer = source("apps/frontend/src/components/import/OcrImageViewerDialog.tsx");

  it("uses real OCR with consent, editable review, retry, and no legacy string matrix callback", () => {
    expect(dialog).toContain("requestOcrExtraction");
    expect(dialog).toContain("Saya setuju foto diproses oleh layanan AI");
    expect(dialog).toContain("Coba OCR Lagi");
    expect(dialog).toContain("onConfirmImport");
    expect(dialog).not.toContain("onDataReady");
  });

  it("labels every OCR entry as BETA", () => {
    expect(classes).toMatch(/Import Siswa dari Foto \(OCR\)[\s\S]{0,180}BETA/);
    expect(grades).toMatch(/Import dari Foto \(OCR\)[\s\S]{0,180}BETA/);
    expect(attendance.match(/Import dari Foto \(OCR\)[\s\S]{0,180}BETA/g)).toHaveLength(2);
  });

  it("requires an explicit class for students and preserves existing grade and attendance data", () => {
    expect(classes).toContain("ocrTargetClassId");
    expect(classes).not.toContain("Use first class as default target");
    expect(classes).not.toContain("OCR-${Date.now()}");
    expect(grades).toContain("existingGrades");
    expect(attendance).toContain("existingAttendance");
  });

  it("creates a class from the OCR selector and selects it after creation", () => {
    expect(dialog).toContain("Tambah Kelas Baru");
    expect(dialog).toContain("onRequestCreateClass");
    expect(classes).toContain("setOcrTargetClassId(createdClass.id)");
    expect(classes).toContain("ocrCreatedClass");
    expect(addClass).toContain("onCreated?.(createdClass as Class)");
    expect(addClass).toContain("trigger !== null");
  });

  it("uses touch-safe image selectors, vertical reorder controls, and the shared zoom viewer", () => {
    expect(dialog).toContain('aria-pressed={activeImage?.id === image.id}');
    expect(dialog).toContain("sipena-ocr-image-selector");
    expect(dialog).toContain("ArrowUp");
    expect(dialog).toContain("ArrowDown");
    expect(dialog).not.toContain("ArrowLeft");
    expect(dialog).not.toContain("<button key={image.id}");
    expect(dialog.match(/setImageViewerOpen\(true\)/g)).toHaveLength(2);
    expect(viewer).toContain("touch-none");
    expect(viewer).toContain("onDoubleClick={toggleDoubleTapZoom}");
    expect(viewer).toContain("pointersRef.current.size === 2");
  });

  it("keeps source photos and raw OCR text on one shared page selection", () => {
    expect(dialog.match(/<OcrPageSwitcher images=\{images\}/g)).toHaveLength(2);
    expect(dialog).toContain("activePageText");
    expect(dialog).toContain("Tampilkan foto sebelumnya");
    expect(dialog).toContain("Tampilkan foto berikutnya");
    expect(dialog).toContain("Pilih halaman foto sumber");
    expect(dialog).toContain("Disusun dari hasil tabel");
    expect(dialog).toContain("Teks mengikuti foto sumber yang sedang dipilih");
  });

  it("keeps shared collapsibles stateful and accessible on touch", () => {
    expect(studio).toContain("sipena-collapsible-trigger");
    expect(studio).toContain("group-data-[state=open]:rotate-180");
    expect(studio).toContain("touch-manipulation");
    expect(studio).toContain('data-touch-scroll-click-target="true"');
  });
});

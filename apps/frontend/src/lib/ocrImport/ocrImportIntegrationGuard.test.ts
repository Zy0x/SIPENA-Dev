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
});

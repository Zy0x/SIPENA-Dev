import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  buildClassStudentImportPlan,
  buildClassStudentImportTemplateWorkbook,
  CLASS_IMPORT_MAX_DESCRIPTION_LENGTH,
  getStudentSheetName,
} from "./classStudentImport";

function workbookFromSheets(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return workbook;
}

describe("class student import", () => {
  it("parses the official hybrid workbook with two classes and per-class student sheets", () => {
    const plan = buildClassStudentImportPlan(buildClassStudentImportTemplateWorkbook(), []);

    expect(plan.totals.classCount).toBe(2);
    expect(plan.totals.newClassCount).toBe(2);
    expect(plan.totals.studentCount).toBe(5);
    expect(plan.totals.newStudentCount).toBe(5);
    expect(plan.totals.errorCount).toBe(0);
  });

  it("marks an existing class and skips an existing student with the same name and NISN", () => {
    const workbook = buildClassStudentImportTemplateWorkbook();
    const plan = buildClassStudentImportPlan(workbook, [
      {
        id: "class-vii-a",
        name: "VIIA",
        class_kkm: 75,
        description: null,
        students: [{ id: "student-1", name: "Ahmad Fauzi", nisn: "0012345678" }],
      },
    ]);

    const viiA = plan.classes.find((item) => item.name === "VIIA");

    expect(viiA?.existingClassId).toBe("class-vii-a");
    expect(viiA?.students[0].status).toBe("skip-existing");
    expect(plan.totals.existingClassCount).toBe(1);
    expect(plan.totals.skippedStudentCount).toBe(1);
  });

  it("blocks a workbook without a usable Kelas sheet", () => {
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Panduan: [["Panduan"]],
      "Siswa - VIIA": [["No", "Nama Siswa *", "NISN *"], [1, "Ali", "0012345678"]],
    }), []);

    expect(plan.totals.errorCount).toBeGreaterThan(0);
    expect(plan.issues.some((item) => item.message.includes("Sheet Kelas wajib ada"))).toBe(true);
  });

  it("blocks duplicate class names inside the Kelas sheet", () => {
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Kelas: [
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Sheet Siswa"],
        ["VIIA", 75, "", "Siswa - VIIA"],
        ["VIIA", 70, "", "Siswa - VIIA 2"],
      ],
      "Siswa - VIIA": [["No", "Nama Siswa *", "NISN *"], [1, "Ali", "0012345678"]],
      "Siswa - VIIA 2": [["No", "Nama Siswa *", "NISN *"], [1, "Budi", "0012345679"]],
    }), []);

    expect(plan.totals.errorCount).toBeGreaterThan(0);
    expect(plan.issues.some((item) => item.message.includes("muncul lebih dari sekali"))).toBe(true);
  });

  it("validates class description length and NISN quality", () => {
    const longDescription = "A".repeat(CLASS_IMPORT_MAX_DESCRIPTION_LENGTH + 1);
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Kelas: [
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Sheet Siswa"],
        ["VIIA", 75, longDescription, "Siswa - VIIA"],
      ],
      "Siswa - VIIA": [
        ["No", "Nama Siswa *", "NISN *"],
        [1, "Ali", ""],
        [2, "Budi", "123456789012345678"],
        [3, "Citra", "12345"],
      ],
    }), []);

    expect(plan.totals.errorCount).toBe(3);
    expect(plan.totals.warningCount).toBe(1);
    expect(plan.issues.some((item) => item.message.includes("Deskripsi maksimal"))).toBe(true);
    expect(plan.issues.some((item) => item.message.includes("NISN wajib"))).toBe(true);
    expect(plan.issues.some((item) => item.message.includes("NISN maksimal"))).toBe(true);
    expect(plan.issues.some((item) => item.message.includes("NISN kurang"))).toBe(true);
  });

  it("warns when the same student name uses a different NISN", () => {
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Kelas: [
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Sheet Siswa"],
        ["VIIA", 75, "", "Siswa - VIIA"],
      ],
      "Siswa - VIIA": [
        ["No", "Nama Siswa *", "NISN *"],
        [1, "Ali", "0012345678"],
        [2, "Ali", "0012345679"],
      ],
    }), []);

    expect(plan.totals.errorCount).toBe(0);
    expect(plan.totals.warningStudentCount).toBe(1);
    expect(plan.issues.some((item) => item.message.includes("Nama sama"))).toBe(true);
  });

  it("keeps generated student sheet names within Excel limits", () => {
    expect(getStudentSheetName("Kelas VIIA - SMPN 1 Banjarmasin yang sangat panjang").length).toBeLessThanOrEqual(31);
  });
});

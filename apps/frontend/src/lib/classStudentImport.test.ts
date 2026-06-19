import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";

import {
  buildClassStudentImportPlan,
  CLASS_IMPORT_MAX_DESCRIPTION_LENGTH,
  getStudentSheetName,
} from "./classStudentImport";

const OFFICIAL_TEMPLATE_SHA256 = "17F53B8F312DE22A51433055A0970CC7845B01A435A34C183548D25021CDE5D8";

function officialTemplatePath() {
  const direct = resolve(process.cwd(), "public/templates/SIPENA_Template_Import_Kelas_dan_Siswa.xlsx");
  if (existsSync(direct)) return direct;
  return resolve(process.cwd(), "apps/frontend/public/templates/SIPENA_Template_Import_Kelas_dan_Siswa.xlsx");
}

function loadOfficialTemplateWorkbook() {
  return XLSX.read(readFileSync(officialTemplatePath()), { type: "buffer" });
}

function workbookFromSheets(sheets: Record<string, unknown[][]>) {
  const workbook = XLSX.utils.book_new();
  Object.entries(sheets).forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  });
  return workbook;
}

describe("class student import", () => {
  it("keeps the checked-in download identical to the approved official template", () => {
    const hash = createHash("sha256").update(readFileSync(officialTemplatePath())).digest("hex").toUpperCase();

    expect(hash).toBe(OFFICIAL_TEMPLATE_SHA256);
  });

  it("parses the approved official workbook with two classes and per-class student sheets", () => {
    const plan = buildClassStudentImportPlan(loadOfficialTemplateWorkbook(), []);

    expect(plan.totals.classCount).toBe(2);
    expect(plan.totals.newClassCount).toBe(2);
    expect(plan.totals.studentCount).toBe(5);
    expect(plan.totals.newStudentCount).toBe(5);
    expect(plan.totals.errorCount).toBe(0);
  });

  it("marks an existing class and skips an existing student with the same name and NISN", () => {
    const workbook = loadOfficialTemplateWorkbook();
    const plan = buildClassStudentImportPlan(workbook, [
      {
        id: "class-vii-a",
        name: "VA",
        class_kkm: 75,
        description: null,
        students: [{ id: "student-1", name: "Ahmad Fauzi", nisn: "0012345678" }],
      },
    ]);

    const viiA = plan.classes.find((item) => item.name === "VA");

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
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Nama Sheet Kelas"],
        ["VIIA", 75, "", "Kelas - VIIA"],
        ["VIIA", 70, "", "Kelas - VIIA 2"],
      ],
      "Kelas - VIIA": [["No", "Nama Siswa *", "NISN *"], [1, "Ali", "0012345678"]],
      "Kelas - VIIA 2": [["No", "Nama Siswa *", "NISN *"], [1, "Budi", "0012345679"]],
    }), []);

    expect(plan.totals.errorCount).toBeGreaterThan(0);
    expect(plan.issues.some((item) => item.message.includes("muncul lebih dari sekali"))).toBe(true);
  });

  it("validates class description length and NISN quality", () => {
    const longDescription = "A".repeat(CLASS_IMPORT_MAX_DESCRIPTION_LENGTH + 1);
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Kelas: [
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Nama Sheet Kelas"],
        ["VIIA", 75, longDescription, "Kelas - VIIA"],
      ],
      "Kelas - VIIA": [
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
        ["Nama Kelas *", "KKM Kelas *", "Deskripsi", "Nama Sheet Kelas"],
        ["VIIA", 75, "", "Kelas - VIIA"],
      ],
      "Kelas - VIIA": [
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
    expect(getStudentSheetName("VIIA")).toBe("Kelas - VIIA");
    expect(getStudentSheetName("Kelas VIIA - SMPN 1 Banjarmasin yang sangat panjang").length).toBeLessThanOrEqual(31);
  });

  it("accepts flexible class sheet and student headers without required stars", () => {
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      "Daftar Kelas": [
        ["Nama Rombel", "Nilai KKM", "Keterangan", "Nama Sheet Kelas"],
        ["VIIC", 72, "Kelas uji", "Murid VIIC"],
      ],
      "Murid VIIC": [
        ["Nomor Urut", "Nama Murid", "Nomor Induk Siswa Nasional"],
        [1, "Dede", "0012345688"],
      ],
    }), []);

    expect(plan.totals.classCount).toBe(1);
    expect(plan.classes[0]?.name).toBe("VIIC");
    expect(plan.classes[0]?.sheetName).toBe("Murid VIIC");
    expect(plan.classes[0]?.students[0]?.name).toBe("Dede");
    expect(plan.totals.errorCount).toBe(0);
  });

  it("finds a custom student sheet from class name when the sheet column is empty", () => {
    const plan = buildClassStudentImportPlan(workbookFromSheets({
      Kelas: [
        ["Nama Kelas", "KKM Kelas", "Deskripsi", "Nama Sheet Kelas"],
        ["VIID", 74, "", ""],
      ],
      "Daftar Murid VIID": [
        ["No", "Nama Peserta Didik", "NISN"],
        [1, "Rani", "0012345699"],
      ],
    }), []);

    expect(plan.classes[0]?.sheetName).toBe("Daftar Murid VIID");
    expect(plan.totals.studentCount).toBe(1);
    expect(plan.totals.errorCount).toBe(0);
  });
});

import { describe, expect, it } from "vitest";

import { requestSmartImportAssist } from "./smartImportAiClient";
import {
  sanitizeSmartImportAssistResponse,
  type SmartImportAssistRequest,
} from "./smartImportAiTypes";
import {
  buildExecutableImportOperations,
  type ImportPlan,
} from "./index";

const baseRequest: SmartImportAssistRequest = {
  mode: "grade_import_assist",
  workbookSummary: {
    fileName: "nilai.xlsx",
    sheets: [{ name: "Nilai", rowCount: 12, columnCount: 6 }],
    candidateTables: [{
      id: "table-1",
      sheetName: "Nilai",
      headerRowIndex: 1,
      dataStartRowIndex: 2,
      dataEndRowIndex: 10,
      matchedStudentCount: 8,
      gradeColumnCount: 3,
      sampleStudents: ["Ani", "Budi"],
      headers: ["Nama", "Tugas 1"],
    }],
    headers: [{ columnIndex: 2, rawHeader: "Tugas 1" }],
    sampleRows: [{ rowIndex: 2, values: ["Ani", 85] }],
  },
  webContext: {
    students: [{ id: "student-1", name: "Ani", nisn: "001" }],
    chapters: [{ id: "chapter-1", name: "BAB 1" }],
    assignments: [{ id: "assignment-1", chapter_id: "chapter-1", name: "Tugas 1" }],
  },
  deterministicPlan: {
    studentMappings: [],
    columnMappings: [],
    conflicts: [],
    warnings: [],
  },
};

describe("smart import AI sanitizer", () => {
  it("membersihkan JSON dari markdown fenced code", () => {
    const result = sanitizeSmartImportAssistResponse(`\`\`\`json
{
  "suggestions": [
    {
      "type": "student",
      "rowIndex": 2,
      "suggestedAction": "Gunakan siswa ini",
      "targetId": "student-1",
      "targetType": "student",
      "confidence": 0.95,
      "reason": "Nama dan NISN mirip",
      "requiresConfirmation": false
    }
  ],
  "summary": { "confidence": 0.95, "riskLevel": "low", "notes": ["Perlu dicek"] }
}
\`\`\``, baseRequest);

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]).toMatchObject({
      type: "student",
      targetId: "student-1",
      requiresConfirmation: true,
    });
  });

  it("membuang targetId siswa yang tidak ada di webContext", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [{
        type: "student",
        rowIndex: 2,
        suggestedAction: "Pilih siswa",
        targetId: "student-x",
        targetType: "student",
        confidence: 0.99,
        reason: "Nama mirip",
        requiresConfirmation: false,
      }],
      summary: { confidence: 0.9, riskLevel: "low", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toEqual([]);
    expect(result.summary.riskLevel).toBe("low");
  });

  it("membuang targetId assignment, chapter, dan tabel yang tidak dikenal", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [
        {
          type: "column",
          columnIndex: 5,
          suggestedAction: "Gunakan target ini",
          targetId: "assignment-x",
          targetType: "assignment",
          confidence: 0.99,
          reason: "Header mirip",
          requiresConfirmation: true,
        },
        {
          type: "structure",
          columnIndex: 6,
          suggestedAction: "Gunakan BAB ini",
          targetId: "chapter-x",
          targetType: "chapter",
          confidence: 0.99,
          reason: "Header mirip",
          requiresConfirmation: true,
        },
        {
          type: "table",
          sourceId: "table-x",
          suggestedAction: "Gunakan tabel ini",
          targetId: "table-x",
          targetType: "table",
          confidence: 0.99,
          reason: "Tabel paling lengkap",
          requiresConfirmation: true,
        },
      ],
      summary: { confidence: 0.99, riskLevel: "medium", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toEqual([]);
  });

  it("memaksa semua saran tetap butuh konfirmasi walau confidence tinggi atau rendah", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [{
        type: "student",
        rowIndex: 2,
        suggestedAction: "Pilih siswa Ani",
        targetId: "student-1",
        targetType: "student",
        confidence: 0.72,
        reason: "Nama mirip",
        requiresConfirmation: false,
      }],
      summary: { confidence: 0.72, riskLevel: "medium", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].confidence).toBe(0.72);
    expect(result.suggestions[0].requiresConfirmation).toBe(true);
  });

  it("membuang suggestedValue di luar rentang 0 sampai 100", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [{
        type: "value",
        rowIndex: 2,
        columnIndex: 3,
        suggestedAction: "Gunakan nilai saran",
        targetType: "value",
        suggestedValue: 101,
        confidence: 0.94,
        reason: "Skala salah",
        requiresConfirmation: true,
      }],
      summary: { confidence: 0.94, riskLevel: "medium", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toEqual([]);
  });

  it("membuang suggestedValue negatif dan suggestion type tidak dikenal", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [
        {
          type: "value",
          rowIndex: 2,
          columnIndex: 3,
          suggestedAction: "Gunakan nilai saran",
          targetType: "value",
          suggestedValue: -1,
          confidence: 0.94,
          reason: "Skala salah",
          requiresConfirmation: true,
        },
        {
          type: "sql",
          suggestedAction: "Gunakan query ini",
          targetType: "ignore",
          confidence: 0.94,
          reason: "Tidak relevan",
          requiresConfirmation: true,
        },
      ],
      summary: { confidence: 0.94, riskLevel: "medium", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toEqual([]);
  });

  it("menerima target valid untuk assignment, chapter, table, ignore, dan value tanpa membuatnya otomatis aman", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [
        {
          type: "column",
          columnIndex: 3,
          suggestedAction: "Gunakan target ini",
          targetId: "assignment-1",
          targetType: "assignment",
          confidence: 0.96,
          reason: "Header cocok",
          requiresConfirmation: false,
        },
        {
          type: "structure",
          columnIndex: 4,
          suggestedAction: "Gunakan BAB ini",
          targetId: "chapter-1",
          targetType: "chapter",
          confidence: 0.96,
          reason: "BAB cocok",
          requiresConfirmation: false,
        },
        {
          type: "table",
          sourceId: "table-1",
          suggestedAction: "Gunakan tabel ini",
          targetId: "table-1",
          targetType: "table",
          confidence: 0.96,
          reason: "Tabel paling lengkap",
          requiresConfirmation: false,
        },
        {
          type: "column",
          columnIndex: 5,
          suggestedAction: "Abaikan kolom",
          targetType: "ignore",
          confidence: 0.96,
          reason: "Kolom ringkasan",
          requiresConfirmation: false,
        },
        {
          type: "value",
          rowIndex: 2,
          columnIndex: 6,
          suggestedAction: "Gunakan nilai saran",
          targetType: "value",
          suggestedValue: 80,
          confidence: 0.96,
          reason: "Pecahan 8/10",
          requiresConfirmation: false,
        },
      ],
      summary: { confidence: 0.96, riskLevel: "low", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toHaveLength(5);
    expect(result.suggestions.every((suggestion) => suggestion.requiresConfirmation)).toBe(true);
  });

  it("mengembalikan fallback saat JSON AI invalid", () => {
    const result = sanitizeSmartImportAssistResponse("bukan json", baseRequest);

    expect(result.suggestions).toEqual([]);
    expect(result.summary.confidence).toBe(0);
    expect(result.summary.riskLevel).toBe("high");
    expect(result.summary.notes[0]).toContain("AI tidak tersedia");
  });

  it("membuang saran yang berisi SQL atau instruksi deploy", () => {
    const result = sanitizeSmartImportAssistResponse({
      suggestions: [{
        type: "structure",
        suggestedAction: "deploy function lalu update table",
        targetType: "ignore",
        confidence: 0.99,
        reason: "jalankan SQL update grades",
        requiresConfirmation: true,
      }],
      summary: { confidence: 0.99, riskLevel: "high", notes: [] },
    }, baseRequest);

    expect(result.suggestions).toEqual([]);
  });

  it("tidak menghapus conflict atau membuat operation executable hanya karena ada saran AI", () => {
    const plan: ImportPlan = {
      sourceType: "free_structured",
      updateMode: "fill_empty_only",
      studentMappings: [{
        rowIndex: 2,
        excelName: "Ani",
        studentId: undefined,
        matchedBy: undefined,
        confidence: 0,
        status: "missing_in_web",
        warnings: [],
        conflicts: [{
          code: "IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE",
          severity: "blocked",
          type: "student",
          message: "Siswa belum ada.",
          rowIndex: 2,
          columnIndex: 3,
        }],
      }],
      missingInExcelStudents: [],
      columnMappings: [{
        columnIndex: 3,
        rawHeader: "BAB 1 - Tugas 1",
        parsedHeader: {
          raw: "BAB 1 - Tugas 1",
          normalized: "bab 1 tugas 1",
          headerType: "assignment",
          target: {
            gradeType: "assignment",
            chapterId: "chapter-1",
            chapterName: "BAB 1",
            assignmentId: "assignment-1",
            assignmentName: "Tugas 1",
          },
          confidence: 100,
          reserved: false,
          derived: false,
          reasons: [],
          warnings: [],
        },
        target: {
          gradeType: "assignment",
          chapterId: "chapter-1",
          chapterName: "BAB 1",
          assignmentId: "assignment-1",
          assignmentName: "Tugas 1",
        },
        confidence: 100,
        status: "safe",
        warnings: [],
        conflicts: [],
      }],
      structureSuggestions: [],
      gradeOperations: [{
        id: "op-1",
        rowIndex: 2,
        columnIndex: 3,
        target: {
          gradeType: "assignment",
          chapterId: "chapter-1",
          chapterName: "BAB 1",
          assignmentId: "assignment-1",
          assignmentName: "Tugas 1",
        },
        rawValue: 85,
        value: 85,
        existingValue: null,
        updateMode: "fill_empty_only",
        action: "blocked",
        warnings: [],
        conflicts: [{
          code: "IMPORT_STUDENT_MISSING_IN_WEB_FOR_VALUE",
          severity: "blocked",
          type: "student",
          message: "Siswa belum ada.",
          rowIndex: 2,
          columnIndex: 3,
        }],
      }],
      warnings: [],
      conflicts: [],
      summary: {
        totalRows: 1,
        matchedStudents: 0,
        mappedColumns: 1,
        safeOperations: 0,
        blockedOperations: 1,
        needsConfirmation: 0,
      },
    };
    const suggestions = sanitizeSmartImportAssistResponse({
      suggestions: [{
        type: "student",
        rowIndex: 2,
        suggestedAction: "Gunakan siswa ini",
        targetId: "student-1",
        targetType: "student",
        confidence: 0.99,
        reason: "Nama mirip",
        requiresConfirmation: false,
      }],
      summary: { confidence: 0.99, riskLevel: "low", notes: [] },
    }, baseRequest);

    expect(suggestions.suggestions).toHaveLength(1);
    expect(buildExecutableImportOperations({ plan }).summary.executableCount).toBe(0);
  });
});

describe("smart import AI client", () => {
  it("mengembalikan fallback aman saat function error", async () => {
    const result = await requestSmartImportAssist(baseRequest, {
      invoke: async () => ({ error: new Error("Function gagal") }),
      timeoutMs: 1000,
    });

    expect(result.suggestions).toEqual([]);
    expect(result.summary.confidence).toBe(0);
    expect(result.summary.riskLevel).toBe("high");
    expect(result.summary.notes[0]).toContain("Function gagal");
  });
});

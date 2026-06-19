import { describe, expect, it } from "vitest";
import {
  hasBlockingOcrIssues,
  normalizeAttendanceStatus,
  normalizeOcrDate,
  parseManualOcrText,
  prepareOcrDraft,
  sanitizeOcrExtractionResult,
  normalizeStudentOcrShape,
  validateOcrDraft,
} from "./validation";
import { validateOcrImageFiles } from "./imagePreprocessor";
import type { OcrExtractionResult, OcrImportContext } from "./types";

const students = [
  { id: "student-1", name: "Ahmad Fauzi", nisn: "0012345678" },
  { id: "student-2", name: "Siti Rahma", nisn: "0012345679" },
];

function result(kind: OcrExtractionResult["kind"]): OcrExtractionResult {
  return {
    requestId: "request-1",
    kind,
    rawText: "",
    columns: kind === "attendance"
      ? [
          { id: "name", label: "Nama Siswa", semantic: "student_name", confidence: 0.98 },
          { id: "nisn", label: "NISN", semantic: "nisn", confidence: 0.98 },
          { id: "date", label: "Tanggal", semantic: "date", confidence: 0.98 },
          { id: "status", label: "Status", semantic: "attendance_status", confidence: 0.98 },
        ]
      : [
          { id: "name", label: "Nama Siswa", semantic: "student_name", confidence: 0.98 },
          { id: "nisn", label: "NISN", semantic: "nisn", confidence: 0.98 },
          { id: "task", label: "Tugas 1", semantic: kind === "grades" ? "grade" : "unknown", confidence: 0.96 },
        ],
    rows: [],
    warnings: [],
    usedFallback: false,
  };
}

describe("OCR import validation", () => {
  it("sanitizes an untrusted OCR response and preserves photo order", () => {
    const sanitized = sanitizeOcrExtractionResult({
      kind: "students",
      requestId: "abc",
      columns: [
        { id: "name", label: "Nama Siswa", semantic: "student_name", confidence: 2 },
        { id: "nisn", label: "NISN", semantic: "nisn", confidence: 0.8 },
      ],
      rows: [
        { id: "b", page: 2, values: ["Budi", "0012345688"], confidence: 0.9 },
        { id: "a", page: 1, values: ["Ali", "0012345687"], confidence: 0.8 },
      ],
    }, "students");

    expect(sanitized.columns[0].confidence).toBe(1);
    expect(sanitized.rows.map((row) => row.page)).toEqual([2, 1]);
  });

  it("rejects a response for another OCR domain", () => {
    expect(() => sanitizeOcrExtractionResult({ kind: "grades" }, "students")).toThrow(/tidak sesuai/i);
  });

  it("maps grade columns and blocks invalid values", () => {
    const extraction = result("grades");
    extraction.rows = [{ id: "row-1", page: 1, values: ["Ahmad Fauzi", "0012345678", "105"], confidence: 0.95, handwritten: false }];
    const context: OcrImportContext = {
      kind: "grades",
      students,
      assignments: [{ id: "task-1", name: "Tugas 1" }],
    };
    const draft = prepareOcrDraft(extraction, context);

    expect(draft.columns[2].targetId).toBe("task-1");
    expect(draft.rows[0].targetStudentId).toBe("student-1");
    expect(hasBlockingOcrIssues(draft.rows)).toBe(true);
    expect(draft.rows[0].issues.some((item) => item.code === "GRADE_INVALID")).toBe(true);
  });

  it("keeps existing grades and marks them for a human review", () => {
    const extraction = result("grades");
    extraction.rows = [{ id: "row-1", page: 1, values: ["Ahmad Fauzi", "0012345678", "85"], confidence: 0.95, handwritten: false }];
    const draft = prepareOcrDraft(extraction, {
      kind: "grades",
      students,
      assignments: [{ id: "task-1", name: "Tugas 1" }],
      existingGrades: [{ studentId: "student-1", assignmentId: "task-1", value: 80 }],
    });

    expect(draft.rows[0].issues.some((item) => item.code === "GRADE_EXISTS")).toBe(true);
    expect(hasBlockingOcrIssues(draft.rows)).toBe(false);
  });

  it("requires a real NISN and detects existing students", () => {
    const extraction = result("students");
    extraction.rows = [{ id: "row-1", page: 1, values: ["Ahmad Fauzi", "0012345678", ""], confidence: 0.95, handwritten: false }];
    const context: OcrImportContext = { kind: "students", targetClassId: "class-1", students };
    const draft = prepareOcrDraft(extraction, context);

    expect(draft.rows[0].included).toBe(false);
    expect(draft.rows[0].issues.some((item) => item.code === "STUDENT_EXISTS")).toBe(true);
  });

  it("always creates canonical student name and NISN columns", () => {
    const sanitized = sanitizeOcrExtractionResult({
      kind: "students",
      columns: [{ id: "detected-name", label: "Nama", semantic: "unknown", confidence: 0.9 }],
      rows: [{ id: "row-1", page: 1, values: ["Budi Santoso"], confidence: 0.9 }],
    }, "students");

    expect(sanitized.columns.map((column) => column.semantic)).toEqual(["student_name", "nisn"]);
    expect(sanitized.columns.map((column) => column.label)).toEqual(["Nama Siswa", "NISN"]);
    expect(sanitized.rows[0].values).toEqual(["Budi Santoso", "-"]);
  });

  it("replaces only missing NISN cells and preserves detected values", () => {
    const canonical = normalizeStudentOcrShape(
      [
        { id: "name", label: "Nama Siswa", semantic: "student_name", confidence: 0.9 },
        { id: "nisn", label: "NISN", semantic: "nisn", confidence: 0.9 },
        { id: "room", label: "Ruang", semantic: "unknown", confidence: 0.8 },
      ],
      [
        { id: "row-1", page: 1, values: ["Budi", "", "A"], confidence: 0.9, handwritten: false },
        { id: "row-2", page: 1, values: ["Dewi", "0012345682", "B"], confidence: 0.9, handwritten: false },
      ],
    );

    expect(canonical.rows[0].values).toEqual(["Budi", "-", "A"]);
    expect(canonical.rows[1].values).toEqual(["Dewi", "0012345682", "B"]);
    expect(canonical.columns.map((column) => column.label)).toEqual(["Nama Siswa", "NISN", "Ruang"]);
  });

  it("allows different students to share the missing-NISN placeholder", () => {
    const extraction = result("students");
    extraction.rows = [
      { id: "row-1", page: 1, values: ["Siswa Tanpa NISN A", "-", ""], confidence: 0.95, handwritten: false },
      { id: "row-2", page: 1, values: ["Siswa Tanpa NISN B", "-", ""], confidence: 0.95, handwritten: false },
    ];
    const draft = prepareOcrDraft(extraction, { kind: "students", targetClassId: "class-1", students });

    expect(hasBlockingOcrIssues(draft.rows)).toBe(false);
    expect(draft.rows.every((row) => row.issues.some((item) => item.code === "NISN_PLACEHOLDER"))).toBe(true);
    expect(draft.rows.some((row) => row.issues.some((item) => item.code === "NISN_DUPLICATE_DRAFT"))).toBe(false);
  });

  it("blocks repeated NISN values inside one OCR draft", () => {
    const extraction = result("students");
    extraction.rows = [
      { id: "row-1", page: 1, values: ["Siswa Baru A", "0099999999", ""], confidence: 0.95, handwritten: false },
      { id: "row-2", page: 2, values: ["Siswa Baru B", "0099999999", ""], confidence: 0.95, handwritten: false },
    ];
    const draft = prepareOcrDraft(extraction, { kind: "students", targetClassId: "class-1", students });

    expect(hasBlockingOcrIssues(draft.rows)).toBe(true);
    expect(draft.rows.every((row) => row.issues.some((item) => item.code === "NISN_DUPLICATE_DRAFT"))).toBe(true);
  });

  it("normalizes attendance dates and Indonesian status labels", () => {
    expect(normalizeOcrDate("19/06/2026")).toBe("2026-06-19");
    expect(normalizeAttendanceStatus("Ijin")).toBe("I");
    expect(normalizeAttendanceStatus("Alpha")).toBe("A");
  });

  it("flags handwriting and existing attendance without blocking valid rows", () => {
    const extraction = result("attendance");
    extraction.rows = [{ id: "row-1", page: 1, values: ["Siti Rahma", "0012345679", "19/06/2026", "Hadir"], confidence: 0.9, handwritten: true }];
    const context: OcrImportContext = {
      kind: "attendance",
      students,
      existingAttendance: [{ studentId: "student-2", date: "2026-06-19", status: "S" }],
    };
    const draft = prepareOcrDraft(extraction, context);

    expect(hasBlockingOcrIssues(draft.rows)).toBe(false);
    expect(draft.rows[0].issues.map((item) => item.code)).toEqual(expect.arrayContaining(["HANDWRITING_REVIEW", "ATTENDANCE_EXISTS"]));
  });

  it("revalidates edits instead of trusting stale AI issues", () => {
    const extraction = result("grades");
    extraction.rows = [{ id: "row-1", page: 1, values: ["Tidak Ada", "", "80"], confidence: 0.95, handwritten: false }];
    const context: OcrImportContext = { kind: "grades", students, assignments: [{ id: "task-1", name: "Tugas 1" }] };
    const initial = prepareOcrDraft(extraction, context);
    initial.rows[0].values[0] = "Ahmad Fauzi";
    const updated = validateOcrDraft(initial.rows, initial.columns, context);

    expect(hasBlockingOcrIssues(updated.rows)).toBe(false);
    expect(updated.rows[0].targetStudentId).toBe("student-1");
  });

  it("parses manual fallback without invoking AI", () => {
    const manual = parseManualOcrText("1\tAhmad Fauzi\t0012345678", "students");
    expect(manual.usedFallback).toBe(true);
    expect(manual.rows).toHaveLength(1);
  });

  it("builds editable grade columns from a manual fallback header", () => {
    const manual = parseManualOcrText("Nama Siswa\tNISN\tTugas 1\nAhmad Fauzi\t0012345678\t88", "grades");
    expect(manual.columns.map((column) => column.semantic)).toEqual(["student_name", "nisn", "grade"]);
    expect(manual.columns[2].label).toBe("Tugas 1");
    expect(manual.rows[0].values[2]).toBe("88");
  });

  it("enforces image type, size, and five-photo limits", () => {
    const image = new File([new Uint8Array(10)], "photo.jpg", { type: "image/jpeg" });
    expect(() => validateOcrImageFiles([image], 4)).not.toThrow();
    expect(() => validateOcrImageFiles([image], 5)).toThrow(/Maksimal 5/);
    expect(() => validateOcrImageFiles([new File(["x"], "photo.gif", { type: "image/gif" })])).toThrow(/JPG/);
  });
});

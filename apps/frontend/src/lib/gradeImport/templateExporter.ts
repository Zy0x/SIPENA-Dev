import * as XLSX from "xlsx";

import { hashImportMetadata } from "./metadataHash";
import { normalizeName, normalizeNisn, normalizeText, toCanonicalChapterName } from "./textNormalizer";

export const OFFICIAL_TEMPLATE_VERSION = "2.0.0";

export interface TemplateStudent {
  id: string;
  name: string;
  nisn?: string | null;
}

export interface TemplateChapter {
  id: string;
  name: string;
  order_index?: number | null;
}

export interface TemplateAssignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index?: number | null;
}

export interface OfficialGradeTemplateContext {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  semesterId?: string | null;
  semesterName?: string | null;
  academicYearId?: string | null;
  generatedBy?: string | null;
  students: TemplateStudent[];
  chapters: TemplateChapter[];
  assignments: TemplateAssignment[];
  generatedAt?: string;
}

interface TemplateColumn {
  visibleHeader: string;
  gradeType: "assignment" | "sts" | "sas";
  chapterId: string;
  assignmentId: string;
  targetKey: string;
}

export interface CustomGradeTemplateOptions {
  assignmentIds?: string[];
  includeSts?: boolean;
  includeSas?: boolean;
}

type SheetVisibility = 0 | 1 | 2;

interface WorkbookWithVisibility extends XLSX.WorkBook {
  Workbook?: {
    Sheets?: Array<{ name: string; Hidden?: SheetVisibility }>;
  };
}

interface StyledCell extends XLSX.CellObject {
  s?: unknown;
}

function safeText(value: unknown): string {
  return String(value ?? "").trim();
}

function sanitizeFileSegment(value: string): string {
  const cleaned = safeText(value)
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "Data";
}

function hashPayload(value: unknown): string {
  return hashImportMetadata(value);
}

function setColumnWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((wch) => ({ wch }));
}

function setFreezePane(ws: XLSX.WorkSheet, xSplit: number, ySplit: number) {
  (ws as XLSX.WorkSheet & { "!freeze"?: { xSplit: number; ySplit: number } })["!freeze"] = {
    xSplit,
    ySplit,
  };
}

function styleHeaderRow(ws: XLSX.WorkSheet, rowIndex: number, columnCount: number) {
  for (let col = 0; col < columnCount; col += 1) {
    const ref = XLSX.utils.encode_cell({ r: rowIndex, c: col });
    const cell = ws[ref] as StyledCell | undefined;
    if (cell) {
      cell.s = {
        font: { bold: true },
        fill: { fgColor: { rgb: "EAF3FF" } },
        alignment: { vertical: "center", wrapText: true },
      };
    }
  }
}

function forceTextColumn(ws: XLSX.WorkSheet, columnIndex: number, firstRow: number, lastRow: number) {
  for (let row = firstRow; row <= lastRow; row += 1) {
    const ref = XLSX.utils.encode_cell({ r: row, c: columnIndex });
    const cell = ws[ref] as XLSX.CellObject | undefined;
    if (cell) {
      cell.t = "s";
      cell.z = "@";
    }
  }
}

function appendSheet(wb: WorkbookWithVisibility, ws: XLSX.WorkSheet, name: string, hidden: SheetVisibility = 0) {
  XLSX.utils.book_append_sheet(wb, ws, name);
  wb.Workbook = wb.Workbook || {};
  wb.Workbook.Sheets = wb.Workbook.Sheets || [];
  const existing = wb.Workbook.Sheets.find((sheet) => sheet.name === name);
  if (existing) {
    existing.Hidden = hidden;
  } else {
    wb.Workbook.Sheets.push({ name, Hidden: hidden });
  }
}

function getOrderedStructure(context: OfficialGradeTemplateContext) {
  const chapters = [...context.chapters].sort((left, right) => {
    const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder || left.name.localeCompare(right.name);
  });

  const assignmentsByChapter = new Map<string, TemplateAssignment[]>();
  context.assignments.forEach((assignment) => {
    const entries = assignmentsByChapter.get(assignment.chapter_id) || [];
    entries.push(assignment);
    assignmentsByChapter.set(assignment.chapter_id, entries);
  });

  assignmentsByChapter.forEach((entries) => {
    entries.sort((left, right) => {
      const leftOrder = left.order_index ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.order_index ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder || left.name.localeCompare(right.name);
    });
  });

  return { chapters, assignmentsByChapter };
}

function buildTemplateColumns(context: OfficialGradeTemplateContext, options: CustomGradeTemplateOptions = {}): TemplateColumn[] {
  const { chapters, assignmentsByChapter } = getOrderedStructure(context);
  const columns: TemplateColumn[] = [];
  const assignmentIds = options.assignmentIds ? new Set(options.assignmentIds) : null;
  const includeSts = options.includeSts ?? true;
  const includeSas = options.includeSas ?? true;

  chapters.forEach((chapter) => {
    const assignments = (assignmentsByChapter.get(chapter.id) || [])
      .filter((assignment) => !assignmentIds || assignmentIds.has(assignment.id));
    assignments.forEach((assignment) => {
      const chapterName = toCanonicalChapterName(chapter.name);
      columns.push({
        visibleHeader: `${chapterName} - ${safeText(assignment.name)}`,
        gradeType: "assignment",
        chapterId: chapter.id,
        assignmentId: assignment.id,
        targetKey: `assignment:${assignment.id}`,
      });
    });
  });

  if (includeSts) {
    columns.push({
      visibleHeader: "STS",
      gradeType: "sts",
      chapterId: "",
      assignmentId: "",
      targetKey: "special:sts",
    });
  }
  if (includeSas) {
    columns.push({
      visibleHeader: "SAS",
      gradeType: "sas",
      chapterId: "",
      assignmentId: "",
      targetKey: "special:sas",
    });
  }

  return columns;
}

function createGuideSheet() {
  const rows = [
    ["SIPENA - Template Resmi Import Nilai v2"],
    ["Template ini dibuat dari data kelas, mapel, semester, siswa, BAB, dan tugas yang sedang aktif."],
    ["Saat diupload, SIPENA tetap mencocokkan isinya dengan data web sebelum import."],
    [""],
    ["Cara mengisi template"],
    ["1. Isi nilai hanya pada sheet Isi_Nilai."],
    ["2. Nama dan NISN harus sesuai dengan data siswa di web SIPENA."],
    ["3. Nilai diisi angka 0 sampai 100. Angka 0 adalah nilai valid."],
    ["4. Sel kosong tidak akan menghapus atau menimpa nilai lama saat import."],
    ["5. Pengguna boleh menambah header baru dengan format: BAB 1 - Tugas 2 atau BAB 3 - Proyek."],
    ["6. Header STS dan SAS dipakai untuk nilai sumatif tengah dan akhir semester."],
    ["7. Sheet tersembunyi membantu SIPENA mengenali siswa, kolom nilai, dan struktur web saat import."],
    ["8. Jika memakai file Excel bebas, SIPENA tetap bisa membaca secara smart, tetapi template ini adalah acuan paling aman."],
    [""],
    ["Catatan keamanan"],
    ["Template dibuat dari browser, sehingga bukan jaminan file tidak berubah. SIPENA tetap memvalidasi terhadap data web saat upload."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [110]);
  styleHeaderRow(ws, 0, 1);
  return ws;
}

function createRulesSheet() {
  const rows = [
    ["rule", "value", "description"],
    ["template_version", OFFICIAL_TEMPLATE_VERSION, "Versi template resmi SIPENA."],
    ["default_update_policy", "fill_empty_only", "Kebijakan default mengisi nilai kosong dan melewati nilai lama tanpa konfirmasi."],
    ["allowed_min_value", 0, "Nilai minimal yang bisa disimpan."],
    ["allowed_max_value", 100, "Nilai maksimal yang bisa disimpan."],
    ["decimal_separator", "dot_or_comma", "Angka 85.5 dan 85,5 dapat dibaca; koma desimal tetap ditandai untuk dicek."],
    ["empty_tokens", "-, –, —, n/a, na, null, kosong, belum, belum dinilai, belum ada, tdk ada, tidak ada", "Token ini dianggap kosong dan tidak menghapus nilai lama."],
    ["textual_grade_policy", "needs_confirmation", "Tuntas, Remedial, A/B/C, dan teks sejenis tidak dikonversi otomatis."],
    ["student_policy", "match_existing_only", "Import nilai tidak membuat siswa baru otomatis."],
    ["structure_policy", "confirm_before_create", "BAB/tugas baru harus dikonfirmasi user sebelum nilai bisa disimpan."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [28, 72, 92]);
  styleHeaderRow(ws, 0, 3);
  return ws;
}

function createExamplesSheet() {
  const rows = [
    ["contoh", "status", "keterangan"],
    ["85", "Siap import", "Angka 0 sampai 100 valid."],
    ["85,5", "Perlu dicek ringan", "Koma desimal dibaca sebagai 85.5."],
    ["85%", "Perlu dicek ringan", "Persen dibaca sebagai 85."],
    ["90/100", "Dikonversi", "Pecahan valid otomatis dibaca sebagai nilai 0-100."],
    ["8/10", "Perlu dicek", "SIPENA menyarankan 80, tetapi tidak menyimpan sebelum disetujui."],
    ["-", "Dilewati", "Kosong dan tidak menghapus nilai lama."],
    ["belum dinilai", "Dilewati", "Kosong dan tidak menghapus nilai lama."],
    ["Tuntas", "Perlu dicek", "Teks tidak dikonversi otomatis menjadi angka."],
    ["A", "Perlu dicek", "Huruf nilai tidak dikonversi otomatis menjadi angka."],
    ["101", "Diblokir", "Nilai di luar 0 sampai 100."],
    ["#VALUE!", "Diblokir", "Error Excel tidak bisa disimpan sebagai nilai."],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [24, 24, 92]);
  styleHeaderRow(ws, 0, 3);
  return ws;
}

function createInputSheet(context: OfficialGradeTemplateContext, columns: TemplateColumn[]) {
  const header = ["No", "NISN", "Nama Siswa", ...columns.map((column) => column.visibleHeader)];
  const rows = context.students.map((student, index) => [
    index + 1,
    safeText(student.nisn),
    safeText(student.name),
    ...columns.map(() => ""),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  setColumnWidths(ws, [8, 18, 32, ...columns.map((column) => Math.max(14, Math.min(28, column.visibleHeader.length + 2)))]);
  setFreezePane(ws, 3, 1);
  styleHeaderRow(ws, 0, header.length);
  forceTextColumn(ws, 1, 1, rows.length);
  ws["!autofilter"] = {
    ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: header.length - 1 } }),
  };
  return ws;
}

function createManifestSheet(context: OfficialGradeTemplateContext, columns: TemplateColumn[]) {
  const { chapters, assignmentsByChapter } = getOrderedStructure(context);
  const structurePayload = chapters.map((chapter) => ({
    id: chapter.id,
    name: chapter.name,
    assignments: (assignmentsByChapter.get(chapter.id) || []).map((assignment) => ({
      id: assignment.id,
      name: assignment.name,
      order_index: assignment.order_index ?? null,
    })),
    order_index: chapter.order_index ?? null,
  }));
  const studentsPayload = context.students.map((student) => ({
    id: student.id,
    name: student.name,
    nisn: student.nisn ?? "",
  }));
  const columnsPayload = columns.map((column, index) => ({
    column_index: index + 4,
    visible_header: column.visibleHeader,
    grade_type: column.gradeType,
    target_key: column.targetKey,
  }));

  const rows = [
    ["key", "value"],
    ["app", "SIPENA"],
    ["template_version", OFFICIAL_TEMPLATE_VERSION],
    ["class_id", context.classId],
    ["class_name", context.className],
    ["subject_id", context.subjectId],
    ["subject_name", context.subjectName],
    ["semester_id", context.semesterId || ""],
    ["semester_name", context.semesterName || ""],
    ["academic_year_id", context.academicYearId || ""],
    ["generated_at", context.generatedAt || new Date().toISOString()],
    ["generated_by", context.generatedBy || ""],
    ["students_hash", hashPayload(studentsPayload)],
    ["structure_hash", hashPayload(structurePayload)],
    ["columns_hash", hashPayload(columnsPayload)],
    ["signature_status", "unsigned_client_template"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [28, 72]);
  styleHeaderRow(ws, 0, 2);
  return ws;
}

function createStudentsSheet(context: OfficialGradeTemplateContext) {
  const rows = [
    ["student_id", "nisn", "name", "normalized_name", "normalized_nisn", "row_number"],
    ...context.students.map((student, index) => [
      student.id,
      safeText(student.nisn),
      safeText(student.name),
      normalizeName(student.name).normalized,
      normalizeNisn(student.nisn || "").normalized,
      index + 2,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [40, 18, 32, 32, 18, 14]);
  styleHeaderRow(ws, 0, 6);
  forceTextColumn(ws, 1, 1, rows.length - 1);
  forceTextColumn(ws, 4, 1, rows.length - 1);
  return ws;
}

function createStructureSheet(context: OfficialGradeTemplateContext) {
  const { chapters, assignmentsByChapter } = getOrderedStructure(context);
  const rows: unknown[][] = [
    [
      "chapter_id",
      "chapter_name",
      "chapter_order",
      "normalized_chapter_name",
      "assignment_id",
      "assignment_name",
      "assignment_order",
      "normalized_assignment_name",
      "grade_type",
    ],
  ];

  chapters.forEach((chapter) => {
    const assignments = assignmentsByChapter.get(chapter.id) || [];
    if (assignments.length === 0) {
      rows.push([
        chapter.id,
        chapter.name,
        chapter.order_index ?? "",
        normalizeText(toCanonicalChapterName(chapter.name)),
        "",
        "",
        "",
        "",
        "assignment",
      ]);
      return;
    }

    assignments.forEach((assignment) => {
      rows.push([
        chapter.id,
        chapter.name,
        chapter.order_index ?? "",
        normalizeText(toCanonicalChapterName(chapter.name)),
        assignment.id,
        assignment.name,
        assignment.order_index ?? "",
        normalizeText(assignment.name),
        "assignment",
      ]);
    });
  });

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [40, 24, 14, 28, 40, 28, 16, 32, 16]);
  styleHeaderRow(ws, 0, 9);
  return ws;
}

function createColumnMapSheet(columns: TemplateColumn[]) {
  const rows = [
    ["column_index", "visible_header", "grade_type", "chapter_id", "assignment_id", "target_key", "locked"],
    ...columns.map((column, index) => [
      index + 4,
      column.visibleHeader,
      column.gradeType,
      column.chapterId,
      column.assignmentId,
      column.targetKey,
      "true",
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColumnWidths(ws, [14, 32, 16, 40, 40, 28, 12]);
  styleHeaderRow(ws, 0, 7);
  return ws;
}

export function buildOfficialGradeTemplateWorkbook(context: OfficialGradeTemplateContext): XLSX.WorkBook {
  const wb = XLSX.utils.book_new() as WorkbookWithVisibility;
  const columns = buildTemplateColumns(context);

  appendSheet(wb, createGuideSheet(), "Panduan");
  appendSheet(wb, createInputSheet(context, columns), "Isi_Nilai");
  appendSheet(wb, createManifestSheet(context, columns), "_manifest", 1);
  appendSheet(wb, createStudentsSheet(context), "_students", 1);
  appendSheet(wb, createStructureSheet(context), "_structure", 1);
  appendSheet(wb, createColumnMapSheet(columns), "_column_map", 1);
  appendSheet(wb, createRulesSheet(), "_rules", 1);
  appendSheet(wb, createExamplesSheet(), "_examples", 1);

  return wb;
}

export function buildCustomGradeTemplateWorkbook(
  context: OfficialGradeTemplateContext,
  options: CustomGradeTemplateOptions = {},
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new() as WorkbookWithVisibility;
  const columns = buildTemplateColumns(context, options);

  appendSheet(wb, createGuideSheet(), "Panduan");
  appendSheet(wb, createInputSheet(context, columns), "Isi_Nilai");
  appendSheet(wb, createManifestSheet(context, columns), "_manifest", 1);
  appendSheet(wb, createStudentsSheet(context), "_students", 1);
  appendSheet(wb, createStructureSheet(context), "_structure", 1);
  appendSheet(wb, createColumnMapSheet(columns), "_column_map", 1);
  appendSheet(wb, createRulesSheet(), "_rules", 1);
  appendSheet(wb, createExamplesSheet(), "_examples", 1);

  return wb;
}

export function getOfficialGradeTemplateFileName(context: Pick<OfficialGradeTemplateContext, "className" | "subjectName" | "semesterName">) {
  return [
    "Template_Nilai_SIPENA",
    sanitizeFileSegment(context.className),
    sanitizeFileSegment(context.subjectName),
    sanitizeFileSegment(context.semesterName || "Semester_Aktif"),
  ].join("_") + ".xlsx";
}

export function downloadOfficialGradeTemplate(context: OfficialGradeTemplateContext) {
  const workbook = buildOfficialGradeTemplateWorkbook(context);
  XLSX.writeFile(workbook, getOfficialGradeTemplateFileName(context));
}

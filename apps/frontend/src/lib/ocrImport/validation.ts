import type {
  OcrColumn,
  OcrColumnSemantic,
  OcrDraftRow,
  OcrExtractionResult,
  OcrImportContext,
  OcrImportKind,
  OcrIssue,
} from "./types";

const MAX_COLUMNS = 40;
const MAX_ROWS = 500;
const MAX_CELL_LENGTH = 300;
const MAX_RAW_TEXT_LENGTH = 50_000;

const VALID_KINDS = new Set<OcrImportKind>(["students", "grades", "attendance"]);
const VALID_SEMANTICS = new Set<OcrColumnSemantic>([
  "order",
  "student_name",
  "nisn",
  "grade",
  "date",
  "attendance_status",
  "unknown",
]);

function cleanText(value: unknown, maxLength = MAX_CELL_LENGTH) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function normalizeIdentity(value: unknown) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function clampConfidence(value: unknown) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.min(1, value))
    : 0;
}

function cleanPage(value: unknown) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? Math.min(value, 5) : 1;
}

function fallbackColumns(kind: OcrImportKind): OcrColumn[] {
  const definitions = kind === "students"
    ? [["order", "No", "order"], ["student_name", "Nama Siswa", "student_name"], ["nisn", "NISN", "nisn"]]
    : kind === "attendance"
      ? [["student_name", "Nama Siswa", "student_name"], ["nisn", "NISN", "nisn"], ["date", "Tanggal", "date"], ["status", "Status", "attendance_status"]]
      : [["student_name", "Nama Siswa", "student_name"], ["nisn", "NISN", "nisn"]];
  return definitions.map(([id, label, semantic]) => ({ id, label, semantic: semantic as OcrColumnSemantic, confidence: 0 }));
}

export function sanitizeOcrExtractionResult(raw: unknown, expectedKind: OcrImportKind): OcrExtractionResult {
  if (!raw || typeof raw !== "object") throw new Error("Hasil OCR tidak valid.");
  const root = raw as Record<string, unknown>;
  const kind = VALID_KINDS.has(root.kind as OcrImportKind) ? root.kind as OcrImportKind : expectedKind;
  if (kind !== expectedKind) throw new Error("Jenis hasil OCR tidak sesuai dengan alur import.");

  const rawColumns = Array.isArray(root.columns) ? root.columns.slice(0, MAX_COLUMNS) : [];
  const columns = rawColumns.flatMap((item, index): OcrColumn[] => {
    if (!item || typeof item !== "object") return [];
    const column = item as Record<string, unknown>;
    const semantic = VALID_SEMANTICS.has(column.semantic as OcrColumnSemantic)
      ? column.semantic as OcrColumnSemantic
      : "unknown";
    return [{
      id: cleanText(column.id, 60) || `column-${index + 1}`,
      label: cleanText(column.label, 100) || `Kolom ${index + 1}`,
      semantic,
      confidence: clampConfidence(column.confidence),
    }];
  });
  const safeColumns = columns.length ? columns : fallbackColumns(kind);

  const rawRows = Array.isArray(root.rows) ? root.rows.slice(0, MAX_ROWS) : [];
  const rows = rawRows.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const values = Array.isArray(row.values)
      ? row.values.slice(0, safeColumns.length).map((value) => cleanText(value))
      : [];
    while (values.length < safeColumns.length) values.push("");
    if (!values.some(Boolean)) return [];
    return [{
      id: cleanText(row.id, 80) || `ocr-row-${index + 1}`,
      page: cleanPage(row.page),
      values,
      confidence: clampConfidence(row.confidence),
      handwritten: row.handwritten === true,
    }];
  });

  return {
    requestId: cleanText(root.requestId, 100) || crypto.randomUUID(),
    kind,
    rawText: cleanText(root.rawText, MAX_RAW_TEXT_LENGTH),
    columns: safeColumns,
    rows,
    warnings: Array.isArray(root.warnings)
      ? root.warnings.map((item) => cleanText(item, 240)).filter(Boolean).slice(0, 12)
      : [],
    usedFallback: root.usedFallback === true,
  };
}

function columnIndex(columns: OcrColumn[], semantic: OcrColumnSemantic) {
  return columns.findIndex((column) => column.semantic === semantic);
}

function valueAt(row: OcrDraftRow, columns: OcrColumn[], semantic: OcrColumnSemantic) {
  const index = columnIndex(columns, semantic);
  return index >= 0 ? cleanText(row.values[index]) : "";
}

function issue(severity: OcrIssue["severity"], code: string, message: string, columnId?: string): OcrIssue {
  return { severity, code, message, columnId };
}

function resolveStudent(name: string, nisn: string, context: OcrImportContext) {
  const normalizedNisn = normalizeIdentity(nisn);
  if (normalizedNisn) {
    const byNisn = context.students.filter((student) => normalizeIdentity(student.nisn) === normalizedNisn);
    if (byNisn.length === 1) return { id: byNisn[0].id, ambiguous: false };
    if (byNisn.length > 1) return { id: undefined, ambiguous: true };
  }

  const normalizedName = normalizeIdentity(name);
  if (!normalizedName) return { id: undefined, ambiguous: false };
  const exact = context.students.filter((student) => normalizeIdentity(student.name) === normalizedName);
  if (exact.length === 1) return { id: exact[0].id, ambiguous: false };
  if (exact.length > 1) return { id: undefined, ambiguous: true };

  const partial = context.students.filter((student) => {
    const candidate = normalizeIdentity(student.name);
    return candidate.includes(normalizedName) || normalizedName.includes(candidate);
  });
  return partial.length === 1
    ? { id: partial[0].id, ambiguous: false }
    : { id: undefined, ambiguous: partial.length > 1 };
}

export function normalizeOcrDate(value: string) {
  const text = cleanText(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (!match) return "";
  return `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

export function normalizeAttendanceStatus(value: string) {
  const normalized = normalizeIdentity(value);
  const aliases: Record<string, string> = {
    h: "H", hadir: "H",
    i: "I", izin: "I", ijin: "I",
    s: "S", sakit: "S",
    a: "A", alfa: "A", alpha: "A", alpa: "A",
    d: "D", dispensasi: "D",
  };
  return aliases[normalized] || "";
}

function mapGradeColumns(columns: OcrColumn[], context: OcrImportContext) {
  const assignments = context.assignments || [];
  return columns.map((column) => {
    if (column.semantic !== "grade" || column.targetId) return column;
    const normalized = normalizeIdentity(column.label);
    const exact = assignments.filter((assignment) => normalizeIdentity(assignment.name) === normalized);
    if (exact.length === 1) return { ...column, targetId: exact[0].id };
    const partial = assignments.filter((assignment) => {
      const candidate = normalizeIdentity(assignment.name);
      return candidate.includes(normalized) || normalized.includes(candidate);
    });
    return partial.length === 1 ? { ...column, targetId: partial[0].id } : column;
  });
}

export function prepareOcrDraft(result: OcrExtractionResult, context: OcrImportContext) {
  const columns = mapGradeColumns(result.columns, context);
  const rows: OcrDraftRow[] = result.rows.map((row) => ({ ...row, included: true, issues: [] }));
  return validateOcrDraft(rows, columns, context);
}

export function validateOcrDraft(rows: OcrDraftRow[], columns: OcrColumn[], context: OcrImportContext) {
  const existingNisn = new Map(context.students.filter((student) => student.nisn).map((student) => [normalizeIdentity(student.nisn), student]));
  const existingName = new Map(context.students.map((student) => [normalizeIdentity(student.name), student]));
  const existingAttendance = new Set((context.existingAttendance || []).map((item) => `${item.studentId}:${item.date}`));
  const existingGrades = new Set((context.existingGrades || [])
    .filter((item) => item.value !== null)
    .map((item) => `${item.studentId}:${item.assignmentId}`));
  const draftNisnCounts = new Map<string, number>();
  const draftNameNisn = new Map<string, Set<string>>();
  if (context.kind === "students") {
    rows.forEach((row) => {
      const draftNisn = normalizeIdentity(valueAt(row, columns, "nisn"));
      const draftName = normalizeIdentity(valueAt(row, columns, "student_name"));
      if (draftNisn) draftNisnCounts.set(draftNisn, (draftNisnCounts.get(draftNisn) || 0) + 1);
      if (draftName) {
        const nisnSet = draftNameNisn.get(draftName) || new Set<string>();
        if (draftNisn) nisnSet.add(draftNisn);
        draftNameNisn.set(draftName, nisnSet);
      }
    });
  }

  return {
    columns,
    rows: rows.map((row): OcrDraftRow => {
      const issues: OcrIssue[] = [];
      if (row.handwritten) issues.push(issue("warning", "HANDWRITING_REVIEW", "Tulisan tangan terdeteksi. Periksa semua isi baris ini."));
      if (row.confidence < 0.75) issues.push(issue("warning", "LOW_CONFIDENCE", "Hasil OCR kurang yakin. Cocokkan kembali dengan foto."));

      const name = valueAt(row, columns, "student_name");
      const nisn = valueAt(row, columns, "nisn");
      if (!name) issues.push(issue("error", "NAME_REQUIRED", "Nama siswa wajib diisi."));

      if (context.kind === "students") {
        if (!context.targetClassId) issues.push(issue("error", "CLASS_REQUIRED", "Pilih kelas tujuan terlebih dahulu."));
        if (!nisn) issues.push(issue("error", "NISN_REQUIRED", "NISN wajib diisi. SIPENA tidak membuat NISN palsu."));
        if (nisn.length > 17) issues.push(issue("error", "NISN_TOO_LONG", "NISN maksimal 17 karakter."));
        if (nisn && nisn.length < 10) issues.push(issue("warning", "NISN_SHORT", "NISN kurang dari 10 karakter. Periksa kembali."));
        if (nisn && (draftNisnCounts.get(normalizeIdentity(nisn)) || 0) > 1) {
          issues.push(issue("error", "NISN_DUPLICATE_DRAFT", "NISN muncul lebih dari sekali pada hasil OCR. Perbaiki atau keluarkan salah satu baris."));
        }
        if (name && (draftNameNisn.get(normalizeIdentity(name))?.size || 0) > 1) {
          issues.push(issue("warning", "NAME_DUPLICATE_DRAFT", "Nama yang sama memiliki NISN berbeda. Pastikan ini memang dua siswa berbeda."));
        }
        const sameNisn = existingNisn.get(normalizeIdentity(nisn));
        const sameName = existingName.get(normalizeIdentity(name));
        if (sameNisn && normalizeIdentity(sameNisn.name) !== normalizeIdentity(name)) {
          issues.push(issue("error", "NISN_CONFLICT", `NISN sudah dipakai oleh ${sameNisn.name}.`));
        } else if (sameName && normalizeIdentity(sameName.nisn) === normalizeIdentity(nisn)) {
          issues.push(issue("info", "STUDENT_EXISTS", "Siswa sudah ada dan akan dilewati."));
        } else if (sameName && normalizeIdentity(sameName.nisn) !== normalizeIdentity(nisn)) {
          issues.push(issue("warning", "NAME_CONFLICT", "Nama sama ditemukan dengan NISN berbeda."));
        }
        return { ...row, included: issues.every((item) => item.code !== "STUDENT_EXISTS"), issues };
      }

      if (!nisn) issues.push(issue("warning", "NISN_MISSING", "NISN tidak terbaca; pencocokan memakai nama."));
      const match = resolveStudent(name, nisn, context);
      if (match.ambiguous) issues.push(issue("error", "STUDENT_AMBIGUOUS", "Siswa cocok ke lebih dari satu data. Perbaiki nama atau NISN."));
      if (!match.id && !match.ambiguous) issues.push(issue("error", "STUDENT_NOT_FOUND", "Siswa tidak ditemukan pada kelas aktif."));

      if (context.kind === "grades") {
        const gradeColumns = columns.filter((column) => column.semantic === "grade");
        if (gradeColumns.length === 0) issues.push(issue("error", "GRADE_COLUMN_REQUIRED", "Tidak ada kolom nilai yang terdeteksi."));
        gradeColumns.forEach((column) => {
          const index = columns.findIndex((item) => item.id === column.id);
          const rawValue = cleanText(row.values[index]);
          if (!column.targetId) issues.push(issue("error", "ASSIGNMENT_UNMAPPED", `Kolom ${column.label} belum dipetakan ke tugas.`, column.id));
          if (rawValue && (!Number.isFinite(Number(rawValue.replace(",", "."))) || Number(rawValue.replace(",", ".")) < 0 || Number(rawValue.replace(",", ".")) > 100)) {
            issues.push(issue("error", "GRADE_INVALID", `Nilai ${column.label} harus berupa angka 0–100.`, column.id));
          }
          if (rawValue && match.id && column.targetId && existingGrades.has(`${match.id}:${column.targetId}`)) {
            issues.push(issue("warning", "GRADE_EXISTS", `Nilai ${column.label} sudah ada dan tidak akan ditimpa.`, column.id));
          }
        });
      } else {
        const date = normalizeOcrDate(valueAt(row, columns, "date"));
        const status = normalizeAttendanceStatus(valueAt(row, columns, "attendance_status"));
        if (!date) issues.push(issue("error", "DATE_INVALID", "Tanggal harus memakai format YYYY-MM-DD atau DD/MM/YYYY."));
        if (!status) issues.push(issue("error", "STATUS_INVALID", "Status harus H, I, S, A, atau D."));
        if (match.id && date && existingAttendance.has(`${match.id}:${date}`)) {
          issues.push(issue("warning", "ATTENDANCE_EXISTS", "Presensi pada tanggal ini sudah ada dan tidak akan ditimpa."));
        }
      }

      return { ...row, targetStudentId: match.id, issues };
    }),
  };
}

export function hasBlockingOcrIssues(rows: OcrDraftRow[]) {
  return rows.some((row) => row.included && row.issues.some((item) => item.severity === "error"));
}

export function hasOcrWarnings(rows: OcrDraftRow[]) {
  return rows.some((row) => row.included && row.issues.some((item) => item.severity === "warning"));
}

export function parseManualOcrText(text: string, kind: OcrImportKind): OcrExtractionResult {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const splitLine = (line: string) => line.includes("\t")
    ? line.split("\t")
    : line.includes("|")
      ? line.split("|")
      : line.split(/\s{2,}/);
  const parsedLines = lines.map((line) => splitLine(line).map((value) => cleanText(value)));
  const hasGradeHeader = kind === "grades" && parsedLines.length > 0 && (
    normalizeIdentity(parsedLines[0][0]).includes("nama") ||
    normalizeIdentity(parsedLines[0][1]).includes("nisn")
  );
  const gradeWidth = kind === "grades" ? Math.max(3, ...parsedLines.map((values) => values.length)) : 0;
  const columns = kind === "grades"
    ? Array.from({ length: gradeWidth }, (_, index): OcrColumn => {
        if (index === 0) return { id: "student_name", label: "Nama Siswa", semantic: "student_name", confidence: 1 };
        if (index === 1) return { id: "nisn", label: "NISN", semantic: "nisn", confidence: 1 };
        return {
          id: `grade-${index - 1}`,
          label: hasGradeHeader ? cleanText(parsedLines[0][index], 100) || `Nilai ${index - 1}` : `Nilai ${index - 1}`,
          semantic: "grade",
          confidence: 1,
        };
      })
    : fallbackColumns(kind);
  const dataLines = hasGradeHeader ? parsedLines.slice(1) : parsedLines;
  const rows = dataLines.map((inputValues, index) => {
    const values = [...inputValues];
    while (values.length < columns.length) values.push("");
    return { id: `manual-row-${index + 1}`, page: 1, values: values.slice(0, columns.length), confidence: 1, handwritten: false };
  });
  return {
    requestId: crypto.randomUUID(),
    kind,
    rawText: text.slice(0, MAX_RAW_TEXT_LENGTH),
    columns,
    rows,
    warnings: ["Data dibuat melalui editor manual setelah OCR tidak tersedia."],
    usedFallback: true,
  };
}

import type {
  OcrColumn,
  OcrColumnSemantic,
  OcrDraftRow,
  OcrExtractionResult,
  OcrImportContext,
  OcrImportKind,
  OcrIssue,
  OcrPageText,
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

function cleanMultilineText(value: unknown, maxLength = MAX_RAW_TEXT_LENGTH) {
  if (typeof value !== "string") return "";
  const printableValue = Array.from(value.replace(/\r\n?/g, "\n"), (character) => {
    const code = character.charCodeAt(0);
    return code === 9 || code === 10 || (code >= 32 && code !== 127) ? character : "";
  }).join("");
  return printableValue
    .replace(/[^\S\n\t]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxLength);
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

function isStudentNameColumn(column: OcrColumn) {
  const label = normalizeIdentity(column.label);
  return column.semantic === "student_name" || label === "nama" || label === "nama siswa" || label === "siswa";
}

function isStudentNisnColumn(column: OcrColumn) {
  const label = normalizeIdentity(column.label);
  return column.semantic === "nisn" || label === "nisn" || label === "nomor induk siswa nasional";
}

export function normalizeStudentOcrShape(
  columns: OcrColumn[],
  rows: OcrExtractionResult["rows"],
): Pick<OcrExtractionResult, "columns" | "rows"> {
  const nameIndex = columns.findIndex(isStudentNameColumn);
  const nisnIndex = columns.findIndex(isStudentNisnColumn);
  const requiredIndexes = new Set([nameIndex, nisnIndex].filter((index) => index >= 0));
  const optionalColumns = columns.filter((column, index) => (
    !requiredIndexes.has(index) && !isStudentNameColumn(column) && !isStudentNisnColumn(column)
  ));
  const optionalIndexes = optionalColumns.map((column) => columns.indexOf(column));
  const nameColumn = nameIndex >= 0 ? columns[nameIndex] : undefined;
  const nisnColumn = nisnIndex >= 0 ? columns[nisnIndex] : undefined;
  const canonicalColumns: OcrColumn[] = [
    {
      id: nameColumn?.id || "required-student-name",
      label: "Nama Siswa",
      semantic: "student_name",
      confidence: nameColumn?.confidence || 0,
    },
    {
      id: nisnColumn?.id || "required-student-nisn",
      label: "NISN",
      semantic: "nisn",
      confidence: nisnColumn?.confidence || 0,
    },
    ...optionalColumns,
  ];

  return {
    columns: canonicalColumns,
    rows: rows.map((row) => ({
      ...row,
      values: [
        nameIndex >= 0 ? cleanText(row.values[nameIndex]) : "",
        nisnIndex >= 0 ? cleanText(row.values[nisnIndex]) || "-" : "-",
        ...optionalIndexes.map((index) => cleanText(row.values[index])),
      ],
    })),
  };
}

function buildTableFallbackText(columns: OcrColumn[], rows: OcrExtractionResult["rows"], page: number) {
  const pageRows = rows.filter((row) => row.page === page);
  if (!pageRows.length) return "";
  return [
    columns.map((column) => column.label).join("\t"),
    ...pageRows.map((row) => row.values.map((value) => cleanText(value)).join("\t")),
  ].join("\n");
}

function sanitizePageTexts(
  rawPageTexts: unknown,
  legacyRawText: string,
  columns: OcrColumn[],
  rows: OcrExtractionResult["rows"],
): OcrPageText[] {
  const byPage = new Map<number, OcrPageText>();
  if (Array.isArray(rawPageTexts)) {
    rawPageTexts.slice(0, 5).forEach((item) => {
      if (!item || typeof item !== "object") return;
      const entry = item as Record<string, unknown>;
      const page = cleanPage(entry.page);
      const text = cleanMultilineText(entry.text);
      if (!text) return;
      const source = entry.source === "table_fallback" || entry.source === "manual" ? entry.source : "ocr";
      const current = byPage.get(page);
      byPage.set(page, {
        page,
        text: current ? `${current.text}\n\n${text}` : text,
        source: current?.source === "ocr" || source === "ocr" ? "ocr" : source,
      });
    });
  }

  const rowPages = [...new Set(rows.map((row) => row.page))].sort((first, second) => first - second);
  rowPages.forEach((page) => {
    if (byPage.has(page)) return;
    if (rowPages.length === 1 && legacyRawText) {
      byPage.set(page, { page, text: legacyRawText, source: "ocr" });
      return;
    }
    const text = buildTableFallbackText(columns, rows, page);
    if (text) byPage.set(page, { page, text, source: "table_fallback" });
  });

  return [...byPage.values()].sort((first, second) => first.page - second.page);
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

  const canonical = kind === "students"
    ? normalizeStudentOcrShape(safeColumns, rows)
    : { columns: safeColumns, rows };
  const rawText = cleanMultilineText(root.rawText);
  const pageTexts = sanitizePageTexts(root.pageTexts, rawText, canonical.columns, canonical.rows);

  return {
    requestId: cleanText(root.requestId, 100) || crypto.randomUUID(),
    kind,
    rawText,
    pageTexts,
    columns: canonical.columns,
    rows: canonical.rows,
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

export function cleanOcrGradeValue(val: string): string {
  let cleaned = val.trim();
  if (!cleaned) return "";

  // Replace common OCR character mismatches for numbers
  cleaned = cleaned
    .replace(/[Oo]/g, "0")
    .replace(/[lI]/g, "1")
    .replace(/[^0-9,.]/g, ""); // Keep only numbers, commas, and dots

  // Replace comma with dot
  cleaned = cleaned.replace(",", ".");

  return cleaned;
}

function getJaroWinklerSimilarity(s1: string, s2: string): number {
  const str1 = s1.toLowerCase().trim();
  const str2 = s2.toLowerCase().trim();
  if (str1 === str2) return 1;
  const len1 = str1.length;
  const len2 = str2.length;
  if (len1 === 0 || len2 === 0) return 0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const matches1 = new Array(len1).fill(false);
  const matches2 = new Array(len2).fill(false);

  let matches = 0;
  let transpositions = 0;

  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(len2 - 1, i + matchWindow);

    for (let j = start; j <= end; j++) {
      if (matches2[j]) continue;
      if (str1[i] === str2[j]) {
        matches1[i] = true;
        matches2[j] = true;
        matches++;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!matches1[i]) continue;
    while (!matches2[k]) k++;
    if (str1[i] !== str2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, len1, len2); i++) {
    if (str1[i] === str2[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function getSimilarityScore(s1: string, s2: string): number {
  const norm1 = normalizeIdentity(s1);
  const norm2 = normalizeIdentity(s2);
  if (!norm1 || !norm2) return 0;
  if (norm1 === norm2) return 1.0;

  const jw = getJaroWinklerSimilarity(norm1, norm2);

  if (norm1.length > 3 && norm2.length > 3) {
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return Math.max(jw, 0.88);
    }
  }

  return jw;
}

function resolveStudent(name: string, nisn: string, orderStr: string, context: OcrImportContext) {
  const normalizedNisn = normalizeIdentity(nisn);
  if (normalizedNisn) {
    const byNisn = context.students.filter((student) => normalizeIdentity(student.nisn) === normalizedNisn);
    if (byNisn.length === 1) return { id: byNisn[0].id, ambiguous: false, matchedBy: "nisn" as const };
    if (byNisn.length > 1) return { id: undefined, ambiguous: true, matchedBy: "none" as const };
  }

  const normalizedName = normalizeIdentity(name);

  // Check No. Urut (Absen) matching
  const orderNum = parseInt(orderStr, 10);
  let studentByOrder: typeof context.students[0] | undefined;
  if (Number.isInteger(orderNum) && orderNum > 0 && orderNum <= context.students.length) {
    studentByOrder = context.students[orderNum - 1];
  }

  if (!normalizedName) {
    if (studentByOrder) {
      return { id: studentByOrder.id, ambiguous: false, matchedBy: "order" as const };
    }
    return { id: undefined, ambiguous: false, matchedBy: "none" as const };
  }

  // Exact name matching
  const exact = context.students.filter((student) => normalizeIdentity(student.name) === normalizedName);
  if (exact.length === 1) {
    const conflict = studentByOrder && studentByOrder.id !== exact[0].id;
    return { id: exact[0].id, ambiguous: false, matchedBy: "name_exact" as const, orderMatchConflict: conflict };
  }
  if (exact.length > 1) return { id: undefined, ambiguous: true, matchedBy: "none" as const };

  // Fuzzy matching
  let bestStudent: typeof context.students[0] | undefined;
  let highestScore = 0;
  let matchesCountAtHighest = 0;

  for (const student of context.students) {
    const score = getSimilarityScore(normalizedName, student.name);
    if (score > highestScore) {
      highestScore = score;
      bestStudent = student;
      matchesCountAtHighest = 1;
    } else if (score === highestScore && score > 0) {
      matchesCountAtHighest++;
    }
  }

  const FUZZY_THRESHOLD = 0.78;
  if (bestStudent && highestScore >= FUZZY_THRESHOLD) {
    const closeCompetitors = context.students.filter(
      (s) => s.id !== bestStudent!.id && Math.abs(getSimilarityScore(normalizedName, s.name) - highestScore) < 0.04
    );

    if (closeCompetitors.length > 0 || matchesCountAtHighest > 1) {
      return { id: undefined, ambiguous: true, matchedBy: "none" as const };
    }

    const conflict = studentByOrder && studentByOrder.id !== bestStudent.id;
    return {
      id: bestStudent.id,
      ambiguous: false,
      matchedBy: "name_fuzzy" as const,
      similarity: Math.round(highestScore * 100),
      orderMatchConflict: conflict,
    };
  }

  if (studentByOrder) {
    return { id: studentByOrder.id, ambiguous: false, matchedBy: "order" as const };
  }

  return { id: undefined, ambiguous: false, matchedBy: "none" as const };
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
  const canonical = context.kind === "students"
    ? normalizeStudentOcrShape(result.columns, result.rows)
    : { columns: result.columns, rows: result.rows };
  const columns = mapGradeColumns(canonical.columns, context);
  const rows: OcrDraftRow[] = canonical.rows.map((row) => ({ ...row, included: true, issues: [] }));
  return validateOcrDraft(rows, columns, context);
}

export function validateOcrDraft(rows: OcrDraftRow[], columns: OcrColumn[], context: OcrImportContext) {
  const existingNisn = new Map(context.students.flatMap((student) => {
    const normalizedNisn = normalizeIdentity(student.nisn);
    return normalizedNisn ? [[normalizedNisn, student] as const] : [];
  }));
  const existingName = new Map(context.students.map((student) => [normalizeIdentity(student.name), student]));
  const existingAttendance = new Set((context.existingAttendance || []).map((item) => `${item.studentId}:${item.date}`));
  const existingGrades = new Set((context.existingGrades || [])
    .filter((item) => item.value !== null)
    .map((item) => `${item.studentId}:${item.assignmentId}`));
  const draftNisnCounts = new Map<string, number>();
  const draftNameNisn = new Map<string, Set<string>>();
  const draftNameCounts = new Map<string, number>();
  if (context.kind === "students") {
    rows.forEach((row) => {
      const draftNisn = normalizeIdentity(valueAt(row, columns, "nisn"));
      const draftName = normalizeIdentity(valueAt(row, columns, "student_name"));
      if (draftNisn) draftNisnCounts.set(draftNisn, (draftNisnCounts.get(draftNisn) || 0) + 1);
      if (draftName) {
        draftNameCounts.set(draftName, (draftNameCounts.get(draftName) || 0) + 1);
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
        const normalizedNisn = normalizeIdentity(nisn);
        if (!context.targetClassId) issues.push(issue("error", "CLASS_REQUIRED", "Pilih kelas tujuan terlebih dahulu."));
        if (!normalizedNisn) issues.push(issue("info", "NISN_PLACEHOLDER", "NISN tidak terdeteksi dan akan disimpan sebagai tanda -."));
        if (normalizedNisn && nisn.length > 17) issues.push(issue("error", "NISN_TOO_LONG", "NISN maksimal 17 karakter."));
        if (normalizedNisn && nisn.length < 10) issues.push(issue("warning", "NISN_SHORT", "NISN kurang dari 10 karakter. Periksa kembali."));
        if (normalizedNisn && (draftNisnCounts.get(normalizedNisn) || 0) > 1) {
          issues.push(issue("error", "NISN_DUPLICATE_DRAFT", "NISN muncul lebih dari sekali pada hasil OCR. Perbaiki atau keluarkan salah satu baris."));
        }
        if (name && ((draftNameNisn.get(normalizeIdentity(name))?.size || 0) > 1 || (draftNameCounts.get(normalizeIdentity(name)) || 0) > 1)) {
          issues.push(issue("warning", "NAME_DUPLICATE_DRAFT", "Nama yang sama muncul lebih dari sekali. Pastikan ini memang siswa yang berbeda."));
        }
        const sameNisn = normalizedNisn ? existingNisn.get(normalizedNisn) : undefined;
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

      let matchId: string | undefined;
      let matchedBy: "nisn" | "name_exact" | "order" | "name_fuzzy" | "manual" | "none" = "none";
      let similarity = 0;
      let orderMatchConflict = false;

      if (row.manualStudentId) {
        matchId = row.manualStudentId;
        matchedBy = "manual";
      } else {
        const orderVal = valueAt(row, columns, "order");
        const match = resolveStudent(name, nisn, orderVal, context);
        matchId = match.id;
        matchedBy = match.matchedBy;
        similarity = match.similarity || 0;
        orderMatchConflict = match.orderMatchConflict || false;
      }

      if (!nisn && matchedBy !== "manual") {
        issues.push(issue("warning", "NISN_MISSING", "NISN tidak terbaca; pencocokan memakai nama/No. Urut."));
      }

      if (matchedBy === "none") {
        if (name) {
          issues.push(issue("error", "STUDENT_NOT_FOUND", "Siswa tidak ditemukan pada kelas aktif."));
        }
      } else if (matchedBy === "order") {
        const matchedStudent = context.students.find((s) => s.id === matchId);
        const sim = matchedStudent ? Math.round(getSimilarityScore(name, matchedStudent.name) * 100) : 0;
        if (name && sim < 60) {
          issues.push(issue("warning", "ORDER_NAME_MISMATCH", `No. Urut cocok (${valueAt(row, columns, "order")}), tapi nama di foto (${name}) berbeda jauh dari data sekolah (${matchedStudent?.name || ""}).`));
        } else {
          issues.push(issue("info", "RESOLVED_BY_ORDER", `Siswa cocok berdasarkan No. Urut ${valueAt(row, columns, "order")} (${matchedStudent?.name}).`));
        }
      } else if (matchedBy === "name_fuzzy") {
        const matchedStudent = context.students.find((s) => s.id === matchId);
        issues.push(issue("warning", "RESOLVED_FUZZY", `Nama cocok secara fuzzy dengan ${matchedStudent?.name} (kemiripan ${similarity}%).`));
      }

      if (orderMatchConflict) {
        const matchedStudent = context.students.find((s) => s.id === matchId);
        issues.push(issue("warning", "ORDER_CONFLICT", `No. Urut di foto (${valueAt(row, columns, "order")}) berbeda dari daftar absen sekolah untuk ${matchedStudent?.name}.`));
      }

      if (context.kind === "grades") {
        const gradeColumns = columns.filter((column) => column.semantic === "grade");
        if (gradeColumns.length === 0) issues.push(issue("error", "GRADE_COLUMN_REQUIRED", "Tidak ada kolom nilai yang terdeteksi."));
        gradeColumns.forEach((column) => {
          const index = columns.findIndex((item) => item.id === column.id);
          const rawValue = cleanOcrGradeValue(row.values[index]);
          // Auto-clean cell value in-place
          row.values[index] = rawValue;

          if (!column.targetId) issues.push(issue("error", "ASSIGNMENT_UNMAPPED", `Kolom ${column.label} belum dipetakan ke tugas.`, column.id));
          if (rawValue && (!Number.isFinite(Number(rawValue)) || Number(rawValue) < 0 || Number(rawValue) > 100)) {
            issues.push(issue("error", "GRADE_INVALID", `Nilai ${column.label} harus berupa angka 0–100.`, column.id));
          }
          if (rawValue && matchId && column.targetId && existingGrades.has(`${matchId}:${column.targetId}`)) {
            issues.push(issue("warning", "GRADE_EXISTS", `Nilai ${column.label} sudah ada dan tidak akan ditimpa.`, column.id));
          }
        });
      } else {
        const dateIdx = columnIndex(columns, "date");
        if (dateIdx >= 0) {
          row.values[dateIdx] = normalizeOcrDate(row.values[dateIdx]);
        }
        const statusIdx = columnIndex(columns, "attendance_status");
        if (statusIdx >= 0) {
          row.values[statusIdx] = normalizeAttendanceStatus(row.values[statusIdx]);
        }

        const date = normalizeOcrDate(valueAt(row, columns, "date"));
        const status = normalizeAttendanceStatus(valueAt(row, columns, "attendance_status"));
        if (!date) issues.push(issue("error", "DATE_INVALID", "Tanggal harus memakai format YYYY-MM-DD atau DD/MM/YYYY."));
        if (!status) issues.push(issue("error", "STATUS_INVALID", "Status harus H, I, S, A, atau D."));
        if (matchId && date && existingAttendance.has(`${matchId}:${date}`)) {
          issues.push(issue("warning", "ATTENDANCE_EXISTS", "Presensi pada tanggal ini sudah ada dan tidak akan ditimpa."));
        }
      }

      return { ...row, targetStudentId: matchId, issues };
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
    rawText: cleanMultilineText(text),
    pageTexts: [{ page: 1, text: cleanMultilineText(text), source: "manual" }],
    columns,
    rows,
    warnings: ["Data dibuat melalui editor manual setelah OCR tidak tersedia."],
    usedFallback: true,
  };
}

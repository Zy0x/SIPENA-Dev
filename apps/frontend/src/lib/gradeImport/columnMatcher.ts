import { parseGradeHeader } from "./headerParser";
import { normalizeText, toCanonicalChapterName } from "./textNormalizer";
import type {
  ColumnMapping,
  GradeTarget,
  ImportConflict,
  ImportWarning,
  MappingStatus,
  ParsedGradeHeader,
  StructureSuggestion,
} from "./types";

export type ColumnMatchTargetType =
  | "existing_assignment"
  | "sts"
  | "sas"
  | "create_assignment"
  | "create_chapter_and_assignment"
  | "ignore"
  | "unresolved";

export interface ImportWebChapter {
  id: string;
  name: string;
  order_index?: number | null;
}

export interface ImportWebAssignment {
  id: string;
  chapter_id: string;
  name: string;
  order_index?: number | null;
}

export interface ColumnMatcherMetadata {
  columnIndex: number;
  visibleHeader?: string;
  gradeType?: string;
  chapterId?: string;
  assignmentId?: string;
  targetKey?: string;
}

export interface ColumnMatcherHeaderInput {
  columnIndex: number;
  rawHeader: string;
  parsedHeader?: ParsedGradeHeader;
  metadata?: ColumnMatcherMetadata;
}

export interface MatchedColumn extends ColumnMapping {
  targetType: ColumnMatchTargetType;
  metadata?: ColumnMatcherMetadata;
}

export interface ColumnMatcherResult {
  mappings: MatchedColumn[];
  structureSuggestions: StructureSuggestion[];
  warnings: ImportWarning[];
  conflicts: ImportConflict[];
  summary: {
    totalColumns: number;
    mappedExisting: number;
    specialColumns: number;
    ignoredColumns: number;
    createSuggestions: number;
    needsConfirmation: number;
    unresolved: number;
    blocked: number;
  };
}

interface ChapterRecord {
  chapter: ImportWebChapter;
  normalizedName: string;
}

interface AssignmentRecord {
  assignment: ImportWebAssignment;
  chapter: ImportWebChapter;
  normalizedChapterName: string;
  normalizedAssignmentName: string;
}

function warning(code: string, message: string, columnIndex?: number, field = "header"): ImportWarning {
  return { code, severity: "warning", message, columnIndex, field };
}

function conflict(code: string, message: string, columnIndex?: number, options?: string[]): ImportConflict {
  return { code, severity: "blocked", message, type: "column", columnIndex, options };
}

function levenshtein(left: string, right: string): number {
  if (left === right) return 0;
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1);
  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(current[j - 1] + 1, previous[j] + 1, previous[j - 1] + cost);
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

function similarity(left: string, right: string): number {
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) {
    const ratio = Math.min(left.length, right.length) / Math.max(left.length, right.length);
    return Math.round(80 + ratio * 16);
  }
  const distance = levenshtein(left, right);
  return Math.round((1 - distance / Math.max(left.length, right.length)) * 100);
}

function chapterNumber(value: string): number | null {
  const match = normalizeText(toCanonicalChapterName(value)).match(/\b(?:bab|unit|materi)\s+(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function makeMapping(
  input: ColumnMatcherHeaderInput,
  parsedHeader: ParsedGradeHeader,
  targetType: ColumnMatchTargetType,
  status: MappingStatus,
  confidence: number,
  target?: GradeTarget,
  warnings: ImportWarning[] = [],
  conflicts: ImportConflict[] = [],
): MatchedColumn {
  return {
    columnIndex: input.columnIndex,
    rawHeader: input.rawHeader,
    parsedHeader,
    target,
    targetType,
    confidence,
    status,
    warnings,
    conflicts,
    metadata: input.metadata,
  };
}

function createSuggestion(
  type: StructureSuggestion["type"],
  chapterName: string | undefined,
  assignmentName: string | undefined,
  target: GradeTarget,
  confidence: number,
  warnings: ImportWarning[],
): StructureSuggestion {
  return {
    id: `${type}:${normalizeText(chapterName)}:${normalizeText(assignmentName)}`,
    type,
    chapterName,
    assignmentName,
    target,
    confidence,
    requiresConfirmation: true,
    status: "needs_confirmation",
    warnings,
  };
}

function buildRecords(chapters: ImportWebChapter[], assignments: ImportWebAssignment[]) {
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const chapterRecords: ChapterRecord[] = chapters.map((chapter) => ({
    chapter,
    normalizedName: normalizeText(toCanonicalChapterName(chapter.name)),
  }));
  const assignmentRecords: AssignmentRecord[] = assignments
    .map((assignment) => {
      const chapter = chapterById.get(assignment.chapter_id);
      if (!chapter) return null;
      return {
        assignment,
        chapter,
        normalizedChapterName: normalizeText(toCanonicalChapterName(chapter.name)),
        normalizedAssignmentName: normalizeText(assignment.name),
      };
    })
    .filter(Boolean) as AssignmentRecord[];

  return { chapterRecords, assignmentRecords };
}

function resolveByMetadata(
  input: ColumnMatcherHeaderInput,
  parsedHeader: ParsedGradeHeader,
  records: ReturnType<typeof buildRecords>,
): MatchedColumn | null {
  const metadata = input.metadata;
  if (!metadata) return null;

  if (["sts", "sas"].includes(metadata.gradeType || "")) {
    const gradeType = metadata.gradeType as "sts" | "sas";
    const warnings = normalizeText(metadata.visibleHeader || "") && normalizeText(metadata.visibleHeader) !== normalizeText(input.rawHeader)
      ? [warning("COLUMN_METADATA_VS_HEADER_CHANGED", "Metadata resmi valid tetapi header terlihat berubah.", input.columnIndex)]
      : [];
    return makeMapping(input, parsedHeader, gradeType, warnings.length ? "warning" : "safe", warnings.length ? 92 : 100, { gradeType }, warnings);
  }

  if (metadata.assignmentId) {
    const record = records.assignmentRecords.find((item) => item.assignment.id === metadata.assignmentId);
    if (record) {
      const headerChanged = normalizeText(metadata.visibleHeader || "") && normalizeText(metadata.visibleHeader) !== normalizeText(input.rawHeader);
      const warnings = headerChanged
        ? [warning("COLUMN_METADATA_VS_HEADER_CHANGED", "Metadata resmi valid tetapi header terlihat berubah. Target metadata tetap dipakai sebagai kandidat utama.", input.columnIndex)]
        : [];
      return makeMapping(
        input,
        parsedHeader,
        "existing_assignment",
        warnings.length ? "warning" : "safe",
        warnings.length ? 94 : 100,
        {
          gradeType: "assignment",
          chapterId: record.chapter.id,
          chapterName: record.chapter.name,
          assignmentId: record.assignment.id,
          assignmentName: record.assignment.name,
        },
        warnings,
      );
    }

    if (parsedHeader.headerType === "assignment" || parsedHeader.headerType === "sts" || parsedHeader.headerType === "sas") {
      return makeMapping(
        input,
        parsedHeader,
        "unresolved",
        "needs_confirmation",
        50,
        parsedHeader.target,
        [warning("COLUMN_METADATA_INVALID_HEADER_CLEAR", "Metadata resmi tidak cocok dengan struktur web, tetapi header cukup jelas. Perlu konfirmasi manual.", input.columnIndex)],
      );
    }
  }

  return null;
}

function resolveAssignmentHeader(
  input: ColumnMatcherHeaderInput,
  parsedHeader: ParsedGradeHeader,
  records: ReturnType<typeof buildRecords>,
): { mapping: MatchedColumn; suggestion?: StructureSuggestion } {
  const target = parsedHeader.target;
  const chapterName = target?.chapterName;
  const assignmentName = target?.assignmentName;
  const normalizedChapter = normalizeText(toCanonicalChapterName(chapterName || ""));
  const normalizedAssignment = normalizeText(assignmentName || "");

  const exactChapter = records.chapterRecords.find((record) => record.normalizedName === normalizedChapter);
  if (exactChapter) {
    const exactAssignment = records.assignmentRecords.find((record) =>
      record.chapter.id === exactChapter.chapter.id && record.normalizedAssignmentName === normalizedAssignment,
    );
    if (exactAssignment) {
      return {
        mapping: makeMapping(input, parsedHeader, "existing_assignment", "safe", 98, {
          gradeType: "assignment",
          chapterId: exactChapter.chapter.id,
          chapterName: exactChapter.chapter.name,
          assignmentId: exactAssignment.assignment.id,
          assignmentName: exactAssignment.assignment.name,
          sourceChapterName: target?.sourceChapterName,
          sourceAssignmentName: target?.sourceAssignmentName,
        }),
      };
    }

    const similarAssignment = records.assignmentRecords
      .filter((record) => record.chapter.id === exactChapter.chapter.id)
      .map((record) => ({ record, score: similarity(normalizedAssignment, record.normalizedAssignmentName) }))
      .filter((item) => item.score >= 74)
      .sort((left, right) => right.score - left.score)[0];
    if (similarAssignment) {
      return {
        mapping: makeMapping(
          input,
          parsedHeader,
          "existing_assignment",
          "needs_confirmation",
          similarAssignment.score,
          {
            gradeType: "assignment",
            chapterId: exactChapter.chapter.id,
            chapterName: exactChapter.chapter.name,
            assignmentId: similarAssignment.record.assignment.id,
            assignmentName: similarAssignment.record.assignment.name,
          },
          [warning("COLUMN_ASSIGNMENT_SIMILAR_MATCH", "Nama tugas mirip dengan tugas web dan perlu konfirmasi.", input.columnIndex)],
        ),
      };
    }

    const createTarget: GradeTarget = {
      gradeType: "assignment",
      chapterId: exactChapter.chapter.id,
      chapterName: exactChapter.chapter.name,
      assignmentName,
      sourceChapterName: target?.sourceChapterName,
      sourceAssignmentName: target?.sourceAssignmentName,
    };
    const warnings = [warning("COLUMN_CREATE_ASSIGNMENT_SUGGESTED", "BAB ada di web tetapi tugas belum ada. Saran create_assignment butuh konfirmasi.", input.columnIndex)];
    return {
      mapping: makeMapping(input, parsedHeader, "create_assignment", "needs_confirmation", 86, createTarget, warnings),
      suggestion: createSuggestion("create_assignment", exactChapter.chapter.name, assignmentName, createTarget, 86, warnings),
    };
  }

  const similarChapter = records.chapterRecords
    .filter((record) => {
      const inputNumber = chapterNumber(chapterName || "");
      const webNumber = chapterNumber(record.chapter.name);
      return inputNumber === null || webNumber === null || inputNumber === webNumber;
    })
    .map((record) => ({ record, score: similarity(normalizedChapter, record.normalizedName) }))
    .filter((item) => item.score >= 76)
    .sort((left, right) => right.score - left.score)[0];
  if (similarChapter) {
    return {
      mapping: makeMapping(
        input,
        parsedHeader,
        "existing_assignment",
        "needs_confirmation",
        similarChapter.score,
        {
          gradeType: "assignment",
          chapterId: similarChapter.record.chapter.id,
          chapterName: similarChapter.record.chapter.name,
          assignmentName,
        },
        [warning("COLUMN_CHAPTER_SIMILAR_MATCH", "Nama BAB mirip dengan BAB web dan perlu konfirmasi.", input.columnIndex)],
      ),
    };
  }

  const createTarget: GradeTarget = {
    gradeType: "assignment",
    chapterName,
    assignmentName,
    sourceChapterName: target?.sourceChapterName,
    sourceAssignmentName: target?.sourceAssignmentName,
  };
  const warnings = [warning("COLUMN_CREATE_CHAPTER_AND_ASSIGNMENT_SUGGESTED", "BAB dan tugas belum ada di web. Saran create_chapter_and_assignment butuh konfirmasi.", input.columnIndex)];
  return {
    mapping: makeMapping(input, parsedHeader, "create_chapter_and_assignment", "needs_confirmation", 82, createTarget, warnings),
    suggestion: createSuggestion("create_chapter_and_assignment", chapterName, assignmentName, createTarget, 82, warnings),
  };
}

function resolveAssignmentOnlyHeader(
  input: ColumnMatcherHeaderInput,
  parsedHeader: ParsedGradeHeader,
  records: ReturnType<typeof buildRecords>,
): MatchedColumn | null {
  const normalized = normalizeText(input.rawHeader);
  const matches = records.assignmentRecords.filter((record) => record.normalizedAssignmentName === normalized);
  if (matches.length === 1) {
    const record = matches[0];
    return makeMapping(
      input,
      parsedHeader,
      "existing_assignment",
      "needs_confirmation",
      72,
      {
        gradeType: "assignment",
        chapterId: record.chapter.id,
        chapterName: record.chapter.name,
        assignmentId: record.assignment.id,
        assignmentName: record.assignment.name,
      },
      [warning("COLUMN_ASSIGNMENT_WITHOUT_CHAPTER", "Header hanya menyebut tugas tanpa BAB, sehingga perlu konfirmasi.", input.columnIndex)],
    );
  }
  if (matches.length > 1) {
    return makeMapping(
      input,
      parsedHeader,
      "unresolved",
      "ambiguous",
      0,
      undefined,
      [warning("COLUMN_ASSIGNMENT_WITHOUT_CHAPTER_AMBIGUOUS", "Header tugas tanpa BAB cocok ke banyak BAB.", input.columnIndex)],
      [conflict("COLUMN_ASSIGNMENT_AMBIGUOUS", "Header tugas tanpa BAB cocok ke banyak tugas web. Pilih manual.", input.columnIndex, matches.map((item) => `${item.chapter.name} - ${item.assignment.name}`))],
    );
  }
  return null;
}

export function matchColumns(
  headers: ColumnMatcherHeaderInput[],
  chapters: ImportWebChapter[],
  assignments: ImportWebAssignment[],
): ColumnMatcherResult {
  const records = buildRecords(chapters, assignments);
  const suggestions: StructureSuggestion[] = [];

  const mappings = headers.map((input) => {
    const parsedHeader = input.parsedHeader || parseGradeHeader(input.rawHeader);
    const metadataMapping = resolveByMetadata(input, parsedHeader, records);
    if (metadataMapping) return metadataMapping;

    if (parsedHeader.reserved || parsedHeader.derived) {
      return makeMapping(input, parsedHeader, "ignore", "safe", 100);
    }

    if (parsedHeader.headerType === "sts") {
      return makeMapping(input, parsedHeader, "sts", "safe", 96, { gradeType: "sts" });
    }
    if (parsedHeader.headerType === "sas") {
      return makeMapping(input, parsedHeader, "sas", "safe", 96, { gradeType: "sas" });
    }
    if (parsedHeader.headerType === "assignment") {
      const resolved = resolveAssignmentHeader(input, parsedHeader, records);
      if (resolved.suggestion) suggestions.push(resolved.suggestion);
      return resolved.mapping;
    }

    const assignmentOnly = resolveAssignmentOnlyHeader(input, parsedHeader, records);
    if (assignmentOnly) return assignmentOnly;

    return makeMapping(
      input,
      parsedHeader,
      "unresolved",
      "missing",
      0,
      undefined,
      [warning("COLUMN_UNRESOLVED", "Header belum bisa dipetakan otomatis.", input.columnIndex)],
    );
  });

  const warnings = [...mappings.flatMap((mapping) => mapping.warnings), ...suggestions.flatMap((suggestion) => suggestion.warnings)];
  const conflicts = mappings.flatMap((mapping) => mapping.conflicts);
  const countTarget = (targetType: ColumnMatchTargetType) => mappings.filter((mapping) => mapping.targetType === targetType).length;
  const countStatus = (status: MappingStatus) => mappings.filter((mapping) => mapping.status === status).length;

  return {
    mappings,
    structureSuggestions: suggestions,
    warnings,
    conflicts,
    summary: {
      totalColumns: mappings.length,
      mappedExisting: countTarget("existing_assignment"),
      specialColumns: countTarget("sts") + countTarget("sas"),
      ignoredColumns: countTarget("ignore"),
      createSuggestions: countTarget("create_assignment") + countTarget("create_chapter_and_assignment"),
      needsConfirmation: countStatus("needs_confirmation"),
      unresolved: countTarget("unresolved"),
      blocked: countStatus("blocked"),
    },
  };
}

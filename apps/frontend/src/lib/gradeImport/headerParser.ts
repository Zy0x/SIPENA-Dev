import {
  DERIVED_COLUMN_HEADERS,
  RESERVED_COLUMN_HEADERS,
  SAS_ALIASES,
  STS_ALIASES,
} from "./constants";
import { normalizeText, normalizeWhitespace, toCanonicalChapterName } from "./textNormalizer";
import type { ImportWarning, ParsedGradeHeader, ParsedHeaderType } from "./types";

function warning(code: string, message: string): ImportWarning {
  return { code, severity: "warning", message, field: "header" };
}

const reservedSet = new Set<string>(RESERVED_COLUMN_HEADERS);
const derivedSet = new Set<string>(DERIVED_COLUMN_HEADERS);
const stsSet = new Set<string>(STS_ALIASES);
const sasSet = new Set<string>(SAS_ALIASES);

function baseHeader(raw: string, normalized: string, headerType: ParsedHeaderType): ParsedGradeHeader {
  return {
    raw,
    normalized,
    headerType,
    confidence: 0,
    reserved: headerType === "reserved",
    derived: headerType === "derived",
    reasons: [],
    warnings: [],
  };
}

function parseAssignmentHeader(raw: string, normalized: string): ParsedGradeHeader | null {
  const parts = normalizeWhitespace(raw)
    .split(/\s*(?:-|:|\/|\|)\s*/u)
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean);

  if (parts.length < 2) return null;

  const chapterRaw = parts[0];
  const assignmentRaw = parts.slice(1).join(" - ");
  const chapterNormalized = normalizeText(chapterRaw);
  const assignmentNormalized = normalizeText(assignmentRaw);
  const explicitChapter = /^(bab|unit|materi)\s+([ivxlcdm]+|\d+)/i.test(chapterNormalized);

  if (!explicitChapter || !assignmentNormalized) return null;

  const chapterName = toCanonicalChapterName(chapterRaw);
  const assignmentName = normalizeWhitespace(assignmentRaw);
  const warnings: ImportWarning[] = [];

  if (stsSet.has(assignmentNormalized) || sasSet.has(assignmentNormalized)) {
    warnings.push(warning(
      "HEADER_SPECIAL_GRADE_WITH_CHAPTER",
      "Header menyebut BAB dan STS/SAS sekaligus, sehingga perlu konfirmasi manual.",
    ));
  }

  return {
    raw,
    normalized,
    headerType: "assignment",
    target: {
      gradeType: "assignment",
      chapterName,
      assignmentName,
      sourceChapterName: chapterRaw,
      sourceAssignmentName: assignmentRaw,
    },
    confidence: warnings.length > 0 ? 72 : 98,
    reserved: false,
    derived: false,
    reasons: ["Header eksplisit menyebut BAB/Unit/Materi dan nama tugas."],
    warnings,
  };
}

export function parseGradeHeader(value: unknown): ParsedGradeHeader {
  const raw = value === null || value === undefined ? "" : String(value);
  const normalized = normalizeText(raw);

  if (!normalized) {
    return {
      ...baseHeader(raw, normalized, "unknown"),
      reasons: ["Header kosong."],
    };
  }

  if (reservedSet.has(normalized)) {
    return {
      ...baseHeader(raw, normalized, "reserved"),
      confidence: 100,
      reasons: ["Kolom identitas atau metadata siswa, bukan nilai."],
    };
  }

  if (derivedSet.has(normalized)) {
    return {
      ...baseHeader(raw, normalized, "derived"),
      confidence: 100,
      reasons: ["Kolom hasil hitung atau rekap, bukan nilai mentah."],
    };
  }

  if (stsSet.has(normalized)) {
    return {
      raw,
      normalized,
      headerType: "sts",
      target: { gradeType: "sts" },
      confidence: 96,
      reserved: false,
      derived: false,
      reasons: ["Header dikenali sebagai STS atau aliasnya."],
      warnings: [],
    };
  }

  if (sasSet.has(normalized)) {
    return {
      raw,
      normalized,
      headerType: "sas",
      target: { gradeType: "sas" },
      confidence: 96,
      reserved: false,
      derived: false,
      reasons: ["Header dikenali sebagai SAS atau aliasnya."],
      warnings: [],
    };
  }

  const assignmentHeader = parseAssignmentHeader(raw, normalized);
  if (assignmentHeader) return assignmentHeader;

  return {
    ...baseHeader(raw, normalized, "unknown"),
    confidence: 0,
    reasons: ["Header belum cukup jelas untuk dipetakan otomatis."],
  };
}

export function isReservedOrDerivedHeader(value: unknown): boolean {
  const parsed = parseGradeHeader(value);
  return parsed.reserved || parsed.derived;
}

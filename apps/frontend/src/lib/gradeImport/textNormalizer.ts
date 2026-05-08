import { MUHAMMAD_NAME_ALIASES, ROMAN_NUMERAL_VALUES } from "./constants";
import type { ImportWarning, TextNormalizationResult } from "./types";

const ZERO_WIDTH_REGEX = /[\u200B-\u200D\u2060\uFEFF]/g;
const NBSP_REGEX = /\u00A0/g;
const PUNCTUATION_REGEX = /[^\p{L}\p{N}\s]+/gu;

function warning(code: string, message: string, field?: string): ImportWarning {
  return { code, severity: "warning", message, field };
}

export function removeZeroWidthChars(value: string): string {
  return value.replace(ZERO_WIDTH_REGEX, "");
}

export function normalizeWhitespace(value: string): string {
  return removeZeroWidthChars(value)
    .replace(NBSP_REGEX, " ")
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeText(value: unknown): string {
  if (value === null || value === undefined) return "";
  return normalizeWhitespace(String(value))
    .toLowerCase()
    .replace(PUNCTUATION_REGEX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

export function normalizeName(value: unknown): TextNormalizationResult {
  const raw = value === null || value === undefined ? "" : String(value);
  const normalized = normalizeText(raw);
  const parts = normalized.split(" ").filter(Boolean);
  const candidates = [normalized];
  const warnings: ImportWarning[] = [];

  if (parts.length > 0 && MUHAMMAD_NAME_ALIASES.includes(parts[0] as typeof MUHAMMAD_NAME_ALIASES[number])) {
    const rest = parts.slice(1).join(" ");
    const aliasCandidates = MUHAMMAD_NAME_ALIASES.map((alias) => normalizeText(`${alias} ${rest}`));
    candidates.push(...aliasCandidates);
    warnings.push(warning(
      "NAME_MUHAMMAD_ALIAS_CANDIDATE",
      "Variasi Muh/Mhd/Muhammad hanya dibuat sebagai kandidat, bukan auto exact.",
      "name",
    ));
  }

  return {
    raw,
    normalized,
    candidates: unique(candidates),
    warnings,
  };
}

export function normalizeNisn(value: unknown): TextNormalizationResult {
  const raw = value === null || value === undefined ? "" : String(value);
  const warnings: ImportWarning[] = [];
  let normalized = normalizeWhitespace(raw);

  if (!normalized) {
    return { raw, normalized: "", candidates: [], warnings };
  }

  if (/[eE][+-]?\d+/.test(normalized)) {
    warnings.push(warning(
      "NISN_SCIENTIFIC_NOTATION",
      "NISN terlihat memakai scientific notation dan perlu dikonfirmasi manual.",
      "nisn",
    ));
    return { raw, normalized, candidates: [normalized], warnings };
  }

  if (/^\d+\.0$/.test(normalized)) {
    normalized = normalized.replace(/\.0$/, "");
    warnings.push(warning("NISN_TRAILING_DECIMAL_REMOVED", "Akhiran .0 pada NISN dihapus.", "nisn"));
  }

  const digitsOnly = normalized.replace(/\D+/g, "");
  if (digitsOnly !== normalized) {
    warnings.push(warning("NISN_NON_DIGIT_REMOVED", "Karakter non-digit pada NISN dibersihkan.", "nisn"));
    normalized = digitsOnly;
  }

  if (/^0+\d+/.test(normalized)) {
    warnings.push(warning(
      "NISN_LEADING_ZERO",
      "NISN memiliki leading zero. Jangan hilangkan nol awal tanpa validasi.",
      "nisn",
    ));
  }

  return {
    raw,
    normalized,
    candidates: unique([normalized]),
    warnings,
  };
}

function canonicalChapter(prefix: string, numberText: string): string | null {
  const lowerPrefix = normalizeText(prefix);
  const lowerNumber = normalizeText(numberText);
  const romanValue = ROMAN_NUMERAL_VALUES[lowerNumber];
  const numericValue = /^\d+$/.test(lowerNumber) ? Number(lowerNumber) : romanValue;

  if (!numericValue) return null;
  const canonicalPrefix = lowerPrefix === "bab" ? "BAB" : lowerPrefix.replace(/^\p{L}/u, (char) => char.toUpperCase());
  return `${canonicalPrefix} ${numericValue}`;
}

export function normalizeRomanNumeralChapter(value: unknown): TextNormalizationResult {
  const raw = value === null || value === undefined ? "" : String(value);
  const normalized = normalizeText(raw);
  const candidates = [normalized];
  const warnings: ImportWarning[] = [];

  const match = normalized.match(/\b(bab|unit|materi)\s+([ivxlcdm]+|\d+)\b/i);
  if (match) {
    const canonical = canonicalChapter(match[1], match[2]);
    if (canonical) {
      candidates.push(normalizeText(canonical));
      if (!/^\d+$/.test(match[2])) {
        warnings.push(warning(
          "CHAPTER_ROMAN_NUMERAL_CANDIDATE",
          `${match[0]} dikenali sebagai kandidat ${canonical}.`,
          "chapter",
        ));
      }
    }
  }

  return {
    raw,
    normalized,
    candidates: unique(candidates),
    warnings,
  };
}

export function toCanonicalChapterName(value: string): string {
  const normalized = normalizeText(value);
  const match = normalized.match(/^(bab|unit|materi)\s+([ivxlcdm]+|\d+)\b/i);
  if (!match) return normalizeWhitespace(value);
  return canonicalChapter(match[1], match[2]) || normalizeWhitespace(value);
}

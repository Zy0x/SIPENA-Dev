import { EXCEL_ERROR_VALUES, TEXTUAL_GRADE_VALUES } from "./constants";
import type { GradeValueParseResult, ImportConflict, ImportWarning } from "./types";
import { normalizeText, normalizeWhitespace } from "./textNormalizer";

function warning(code: string, message: string): ImportWarning {
  return { code, severity: "warning", message, field: "value" };
}

function conflict(code: string, message: string): ImportConflict {
  return { code, severity: "blocked", type: "grade_value", message };
}

function validResult(raw: unknown, normalized: string, value: number, warnings: ImportWarning[] = []): GradeValueParseResult {
  return { raw, normalized, status: "valid", value, warnings, conflicts: [] };
}

function emptyResult(raw: unknown): GradeValueParseResult {
  return { raw, normalized: "", status: "empty", value: null, warnings: [], conflicts: [] };
}

function invalidResult(raw: unknown, normalized: string, message: string): GradeValueParseResult {
  return { raw, normalized, status: "invalid", value: null, warnings: [], conflicts: [conflict("GRADE_VALUE_INVALID", message)] };
}

function isWithinRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

function normalizeDecimal(value: string): string {
  return value.replace(",", ".");
}

export function parseGradeValue(value: unknown): GradeValueParseResult {
  if (value === null || value === undefined) return emptyResult(value);

  if (typeof value === "number") {
    if (!Number.isFinite(value)) return invalidResult(value, String(value), "Nilai bukan angka valid.");
    if (!isWithinRange(value)) return invalidResult(value, String(value), "Nilai harus berada pada rentang 0 sampai 100.");
    return validResult(value, String(value), value);
  }

  const rawString = String(value);
  const visible = normalizeWhitespace(rawString);
  const normalized = normalizeText(rawString);

  if (!visible) return emptyResult(value);

  if (EXCEL_ERROR_VALUES.includes(normalized as typeof EXCEL_ERROR_VALUES[number])) {
    return invalidResult(value, normalized, "Cell berisi error Excel dan tidak bisa diimport.");
  }

  if (TEXTUAL_GRADE_VALUES.includes(normalized as typeof TEXTUAL_GRADE_VALUES[number])) {
    return {
      raw: value,
      normalized,
      status: "textual",
      value: null,
      warnings: [warning("GRADE_VALUE_TEXTUAL", "Nilai tekstual tidak diimport otomatis.")],
      conflicts: [conflict("GRADE_VALUE_TEXTUAL_BLOCKED", "Nilai tekstual perlu mapping manual.")],
    };
  }

  const fractionMatch = visible.match(/^(\d+(?:[.,]\d+)?)\s*\/\s*(\d+(?:[.,]\d+)?)$/);
  if (fractionMatch) {
    const numerator = Number(normalizeDecimal(fractionMatch[1]));
    const denominator = Number(normalizeDecimal(fractionMatch[2]));

    if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
      return invalidResult(value, normalized, "Format pecahan nilai tidak valid.");
    }

    if (denominator === 100 && isWithinRange(numerator)) {
      return validResult(value, normalized, numerator, [
        warning("GRADE_VALUE_FRACTION_100", "Format 90/100 dibaca sebagai 90."),
      ]);
    }

    const suggestedValue = Number(((numerator / denominator) * 100).toFixed(2));
    return {
      raw: value,
      normalized,
      status: "needs_confirmation",
      value: null,
      suggestedValue,
      warnings: [warning("GRADE_VALUE_FRACTION_SCALED", `Nilai dapat diskalakan menjadi ${suggestedValue}, tetapi perlu konfirmasi.`)],
      conflicts: [],
    };
  }

  const percentMatch = visible.match(/^(\d+(?:[.,]\d+)?)\s*%$/);
  if (percentMatch) {
    const parsed = Number(normalizeDecimal(percentMatch[1]));
    if (!isWithinRange(parsed)) return invalidResult(value, normalized, "Persentase nilai harus berada pada rentang 0 sampai 100.");
    return validResult(value, normalized, parsed, [
      warning("GRADE_VALUE_PERCENT", "Tanda persen dihapus dan nilai dibaca sebagai angka 0-100."),
    ]);
  }

  const hasDecimalComma = /^\d+,\d+$/.test(visible);
  const numericText = normalizeDecimal(visible);
  if (/^\d+(?:\.\d+)?$/.test(numericText)) {
    const parsed = Number(numericText);
    if (!isWithinRange(parsed)) return invalidResult(value, normalized, "Nilai harus berada pada rentang 0 sampai 100.");
    return validResult(value, normalized, parsed, hasDecimalComma ? [
      warning("GRADE_VALUE_DECIMAL_COMMA", "Koma desimal dibaca sebagai titik desimal."),
    ] : []);
  }

  return invalidResult(value, normalized, "Nilai harus berupa angka 0 sampai 100.");
}

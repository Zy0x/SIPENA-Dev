import { parseGradeValue } from "@/lib/gradeImport";

export type ValueDecisionCategory =
  | "regular"
  | "safe_conversion"
  | "approval_conversion"
  | "textual"
  | "invalid"
  | "empty";

export function classifyGradeValue(value: unknown): {
  category: ValueDecisionCategory;
  value: number | null;
  suggestedValue?: number;
  reason: string;
} {
  const parsed = parseGradeValue(value);
  if (parsed.status === "empty") return { category: "empty", value: null, reason: "Kosong dan akan dilewati." };
  if (parsed.status === "textual") return { category: "textual", value: null, reason: "Nilai teks tidak dikonversi otomatis." };
  if (parsed.status === "invalid") return { category: "invalid", value: null, reason: parsed.conflicts[0]?.message || "Nilai tidak valid." };
  if (parsed.status === "needs_confirmation") {
    return {
      category: "approval_conversion",
      value: null,
      suggestedValue: parsed.suggestedValue,
      reason: parsed.warnings[0]?.message || "Nilai perlu persetujuan sebelum dikonversi.",
    };
  }
  return {
    category: parsed.warnings.length ? "safe_conversion" : "regular",
    value: parsed.value,
    reason: parsed.warnings[0]?.message || "Nilai angka valid.",
  };
}

import * as XLSX from "xlsx";

import type { ImportDecision, ImportResultReportInput } from "./types";

function decisionRow(decision: ImportDecision) {
  return {
    id: decision.id,
    row: decision.rowIndex ?? "",
    column: decision.columnIndex ?? "",
    source: decision.sourceLabel,
    target: decision.targetLabel,
    action: decision.action,
    status: decision.status,
    risk: decision.risk,
    raw_value: decision.rawValue ?? "",
    value: decision.value ?? "",
    suggested_value: decision.suggestedValue ?? "",
    approved_by: decision.approvedBy,
    reason: decision.reason,
  };
}

function appendJsonSheet(wb: XLSX.WorkBook, name: string, rows: Record<string, unknown>[]) {
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{}]), name);
}

export function buildImportResultReportWorkbook(input: ImportResultReportInput): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const { graph } = input;
  const importedAt = input.importedAt || new Date().toISOString();

  appendJsonSheet(workbook, "Ringkasan", [{
    file_name: input.fileName || "",
    class_name: input.className || "",
    subject_name: input.subjectName || "",
    semester_name: input.semesterName || "",
    academic_year_name: input.academicYearName || "",
    user_name: input.userName || "",
    imported_at: importedAt,
    saved_count: input.savedCount ?? graph.summary.save + graph.summary.convert + graph.summary.overwrite,
    converted_count: graph.summary.convert,
    overwritten_count: graph.summary.overwrite,
    skipped_count: graph.summary.skip,
    failed_count: input.failedCount ?? 0,
    ai_decisions: graph.summary.aiDecided,
  }]);

  appendJsonSheet(workbook, "Berhasil", graph.decisions.filter((item) => ["save", "convert"].includes(item.action)).map(decisionRow));
  appendJsonSheet(workbook, "Dikonversi", graph.decisions.filter((item) => item.action === "convert").map(decisionRow));
  appendJsonSheet(workbook, "Ditimpa", graph.decisions.filter((item) => item.action === "overwrite").map(decisionRow));
  appendJsonSheet(workbook, "Skip", graph.decisions.filter((item) => item.action === "skip").map(decisionRow));
  appendJsonSheet(workbook, "Gagal", graph.decisions.filter((item) => item.status === "blocked").map(decisionRow));
  appendJsonSheet(workbook, "Keputusan_AI", graph.decisions.filter((item) => item.aiSuggestion || item.approvedBy === "ai").map(decisionRow));

  return workbook;
}

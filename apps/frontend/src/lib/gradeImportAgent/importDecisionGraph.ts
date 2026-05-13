import { buildExecutableImportOperations, type ExecutableImportPlan, type GradeOperation, type GradeTarget, type ImportPlan } from "@/lib/gradeImport";

import type { ImportDecision, ImportDecisionAction, ImportDecisionGraph, ImportDecisionStatus } from "./types";

function gradeTargetLabel(target: GradeTarget | undefined): string {
  if (!target) return "Belum ada target";
  if (target.gradeType === "sts") return "STS";
  if (target.gradeType === "sas") return "SAS";
  return [target.chapterName, target.assignmentName].filter(Boolean).join(" - ") || "Tugas belum jelas";
}

function operationSourceLabel(operation: GradeOperation): string {
  return `Baris ${operation.rowIndex}, kolom ${operation.columnIndex}`;
}

function decisionAction(operation: GradeOperation, executable: boolean): ImportDecisionAction {
  if (executable && operation.isAutoConverted && (operation.existingValue === null || operation.existingValue === undefined)) return "convert";
  if (executable) return operation.existingValue !== null && operation.existingValue !== undefined ? "overwrite" : "save";
  if (operation.action === "overwrite") return "overwrite";
  if (operation.action === "needs_confirmation" && operation.suggestedValue !== undefined) return "convert";
  if (operation.action === "skip_empty" || operation.action === "skip_existing") return "skip";
  if (operation.action === "manual_skip_row" || operation.action === "manual_skip_column" || operation.action === "manual_skip_cell") return "skip";
  if (!operation.target.assignmentId && operation.target.gradeType === "assignment" && operation.target.chapterId) return "create_assignment";
  if (!operation.target.assignmentId && operation.target.gradeType === "assignment") return "create_chapter_and_assignment";
  return operation.action === "blocked" ? "manual_choice_required" : "save";
}

function decisionStatus(operation: GradeOperation, executable: boolean): ImportDecisionStatus {
  if (executable) return operation.warnings.length ? "auto_fixed" : "safe";
  if (operation.action === "skip_empty" || operation.action === "skip_existing") return "will_skip";
  if (operation.action === "manual_skip_row" || operation.action === "manual_skip_column" || operation.action === "manual_skip_cell") return "will_skip";
  if (operation.action === "needs_confirmation") return "needs_user_choice";
  return "blocked";
}

function decisionReason(operation: GradeOperation, executable: boolean): string {
  if (executable && operation.existingValue !== null && operation.existingValue !== undefined) {
    return "Nilai siap disimpan sebagai overwrite yang sudah lolos pemeriksaan.";
  }
  if (executable && operation.isAutoConverted && operation.conversionLabel) return operation.conversionLabel;
  if (executable) return "Nilai siap disimpan karena siswa, target, dan nilai sudah aman.";
  if (operation.action === "skip_empty") return "Sel kosong dilewati dan tidak menghapus nilai lama.";
  if (operation.action === "skip_existing") return "Nilai lama sudah ada dan mode aman tidak menimpa otomatis.";
  if (operation.suggestedValue !== undefined) return `Nilai dapat dikonversi menjadi ${operation.suggestedValue}, tetapi perlu persetujuan.`;
  if (operation.conflicts[0]?.message) return operation.conflicts[0].message;
  return "Item perlu dipilih sebelum bisa disimpan.";
}

function summarize(decisions: ImportDecision[]): ImportDecisionGraph["summary"] {
  const countAction = (action: ImportDecisionAction) => decisions.filter((item) => item.action === action).length;
  const countStatus = (status: ImportDecisionStatus) => decisions.filter((item) => item.status === status).length;

  return {
    total: decisions.length,
    save: countAction("save"),
    convert: countAction("convert"),
    overwrite: countAction("overwrite"),
    createAssignment: countAction("create_assignment"),
    createChapterAndAssignment: countAction("create_chapter_and_assignment"),
    skip: countAction("skip"),
    manualChoiceRequired: countAction("manual_choice_required"),
    blocked: countStatus("blocked"),
    safe: countStatus("safe"),
    autoFixed: countStatus("auto_fixed"),
    aiDecided: countStatus("ai_decided"),
  };
}

export function buildImportDecisionGraph(
  plan: ImportPlan,
  executablePlan: ExecutableImportPlan = buildExecutableImportOperations({ plan }),
): ImportDecisionGraph {
  const executableByOperationId = new Map(executablePlan.operations.map((operation) => [operation.operationId, operation]));
  const blockedByOperationId = new Map(executablePlan.blockedItems.map((item) => [item.operationId, item]));
  const skippedByOperationId = new Map(executablePlan.skippedItems.map((item) => [item.operationId, item]));

  const decisions = plan.gradeOperations.map<ImportDecision>((operation) => {
    const executableOperation = executableByOperationId.get(operation.id);
    const skipped = skippedByOperationId.get(operation.id);
    const blocked = blockedByOperationId.get(operation.id);
    const action = skipped ? "skip" : decisionAction(operation, Boolean(executableOperation));
    const status = skipped ? "will_skip" : decisionStatus(operation, Boolean(executableOperation));

    return {
      id: operation.id,
      kind: action === "overwrite" ? "overwrite" : action === "skip" ? "skip" : operation.suggestedValue !== undefined ? "value" : "header",
      status,
      action,
      rowIndex: operation.rowIndex,
      columnIndex: operation.columnIndex,
      sourceLabel: operationSourceLabel(operation),
      targetLabel: gradeTargetLabel(executableOperation?.target || operation.target),
      target: executableOperation?.target || operation.target,
      rawValue: operation.rawValue,
      value: executableOperation?.value ?? operation.value,
      suggestedValue: operation.suggestedValue,
      risk: status === "blocked" ? "high" : status === "needs_user_choice" ? "review" : "safe",
      reason: skipped?.message || blocked?.message || decisionReason(operation, Boolean(executableOperation)),
      operation,
      executableOperation,
      conflicts: operation.conflicts,
      warnings: operation.warnings,
      approvedBy: executableOperation ? "system" : "none",
    };
  });

  const officialGoldenPath = plan.sourceType === "official_exact";
  return {
    sourceType: plan.sourceType,
    officialGoldenPath,
    aiAllowed: !officialGoldenPath,
    plan,
    executablePlan,
    decisions,
    summary: summarize(decisions),
  };
}

export function rebuildImportDecisionGraphSummary(graph: ImportDecisionGraph): ImportDecisionGraph {
  return { ...graph, summary: summarize(graph.decisions) };
}

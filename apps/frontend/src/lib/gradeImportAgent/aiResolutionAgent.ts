import type { SmartImportAssistResponse, SmartImportAssistSuggestion } from "@/lib/gradeImport";

import { rebuildImportDecisionGraphSummary } from "./importDecisionGraph";
import type { AiResolutionMode, ImportDecision, ImportDecisionAction, ImportDecisionGraph, ImportDecisionStatus } from "./types";

function suggestionKey(suggestion: SmartImportAssistSuggestion): string {
  return `${suggestion.rowIndex ?? ""}:${suggestion.columnIndex ?? ""}:${suggestion.type}`;
}

function decisionKey(decision: ImportDecision): string {
  const type = decision.kind === "student" ? "student" : decision.kind === "value" ? "value" : decision.kind === "skip" ? "value" : "column";
  return `${decision.rowIndex ?? ""}:${decision.columnIndex ?? ""}:${type}`;
}

function actionFromSuggestion(suggestion: SmartImportAssistSuggestion): ImportDecisionAction {
  if (suggestion.targetType === "ignore") return "skip";
  if (suggestion.targetType === "value") return "convert";
  if (suggestion.targetType === "assignment") return "save";
  if (suggestion.targetType === "chapter") return "create_chapter_and_assignment";
  if (suggestion.targetType === "student" || suggestion.targetType === "table") return "manual_choice_required";
  return "manual_choice_required";
}

function statusForSuggestion(suggestion: SmartImportAssistSuggestion, mode: AiResolutionMode, handleAll: boolean): ImportDecisionStatus {
  if (suggestion.confidence >= 0.9 && mode !== "safe") return "ai_decided";
  if (suggestion.confidence >= 0.7 && !handleAll) return "needs_user_choice";
  if (handleAll || mode === "aggressive") return "will_skip";
  return "needs_user_choice";
}

function applySuggestion(decision: ImportDecision, suggestion: SmartImportAssistSuggestion, mode: AiResolutionMode, handleAll: boolean): ImportDecision {
  const status = statusForSuggestion(suggestion, mode, handleAll);
  if (status === "will_skip") {
    return {
      ...decision,
      status,
      action: "skip",
      risk: "safe",
      reason: suggestion.reason || "AI melewati item ini karena belum cukup jelas.",
      aiSuggestion: suggestion,
      approvedBy: "ai",
      conflicts: [],
    };
  }

  return {
    ...decision,
    status,
    action: status === "ai_decided" ? actionFromSuggestion(suggestion) : "manual_choice_required",
    risk: status === "ai_decided" && suggestion.confidence >= 0.9 ? "review" : "review",
    reason: suggestion.reason || decision.reason,
    suggestedValue: suggestion.suggestedValue ?? decision.suggestedValue,
    value: suggestion.suggestedValue ?? decision.value,
    aiSuggestion: suggestion,
    approvedBy: status === "ai_decided" ? "ai" : "none",
    conflicts: status === "ai_decided" ? [] : decision.conflicts,
  };
}

export function resolveImportDecisionGraphWithAi(
  graph: ImportDecisionGraph,
  response: SmartImportAssistResponse,
  options: { mode?: AiResolutionMode; handleAll?: boolean } = {},
): ImportDecisionGraph {
  if (!graph.aiAllowed || graph.officialGoldenPath) {
    return { ...graph, aiResponse: response };
  }

  const mode = options.mode || "fast";
  const handleAll = Boolean(options.handleAll || mode === "aggressive");
  const suggestions = new Map(response.suggestions.map((suggestion) => [suggestionKey(suggestion), suggestion]));
  const decisions = graph.decisions.map((decision) => {
    if (["safe", "auto_fixed", "will_skip"].includes(decision.status)) return decision;
    const suggestion = suggestions.get(decisionKey(decision));
    if (suggestion) return applySuggestion(decision, suggestion, mode, handleAll);
    if (handleAll) {
      return {
        ...decision,
        status: "will_skip" as const,
        action: "skip" as const,
        risk: "safe" as const,
        reason: "AI melewati item ini karena tidak ada keputusan aman.",
        approvedBy: "ai" as const,
        conflicts: [],
      };
    }
    return decision;
  });

  return rebuildImportDecisionGraphSummary({
    ...graph,
    aiResponse: response,
    decisions,
  });
}

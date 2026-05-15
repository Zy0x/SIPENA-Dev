import type { SmartImportAssistResponse, SmartImportAssistSuggestion } from "@/lib/gradeImport";

import { rebuildImportDecisionGraphSummary } from "./importDecisionGraph";
import type { AiResolutionMode, ImportDecision, ImportDecisionGraph, ImportDecisionStatus } from "./types";

function suggestionKey(suggestion: SmartImportAssistSuggestion): string {
  return `${suggestion.rowIndex ?? ""}:${suggestion.columnIndex ?? ""}:${suggestion.type}`;
}

function decisionKey(decision: ImportDecision): string {
  const type = decision.kind === "student" ? "student" : decision.kind === "value" ? "value" : decision.kind === "skip" ? "value" : "column";
  return `${decision.rowIndex ?? ""}:${decision.columnIndex ?? ""}:${type}`;
}

function statusForSuggestion(_suggestion: SmartImportAssistSuggestion, _mode: AiResolutionMode, _handleAll: boolean): ImportDecisionStatus {
  return "needs_user_choice";
}

function applySuggestion(decision: ImportDecision, suggestion: SmartImportAssistSuggestion, mode: AiResolutionMode, handleAll: boolean): ImportDecision {
  const status = statusForSuggestion(suggestion, mode, handleAll);
  return {
    ...decision,
    status,
    action: "manual_choice_required",
    risk: "review",
    reason: suggestion.reason || decision.reason,
    suggestedValue: suggestion.suggestedValue ?? decision.suggestedValue,
    value: suggestion.suggestedValue ?? decision.value,
    aiSuggestion: suggestion,
    approvedBy: "none",
    conflicts: decision.conflicts,
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
    return decision;
  });

  return rebuildImportDecisionGraphSummary({
    ...graph,
    aiResponse: response,
    decisions,
  });
}

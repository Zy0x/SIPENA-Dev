import { RuleEvaluationContext, RuleEvaluationOutput, AttendanceRule } from "./ruleEngine.types";
import { defaultRulesList } from "./defaultRules";
import { resolveRuleConflicts } from "./conflictEngine";

/**
 * evaluateAttendanceRules
 * Evaluates the rules engine context against core default rules and optional custom rules.
 * Resolves rule clashes and returns a deterministic, explainable output state.
 */
export function evaluateAttendanceRules(
  context: RuleEvaluationContext,
  customRules: AttendanceRule[] = []
): RuleEvaluationOutput {
  // Combine default rules and any class/school-specific custom rules
  const allRules = [...defaultRulesList, ...customRules].filter((r) => r.enabled);

  // Filter rules whose conditions are met
  const matchingRules = allRules.filter((rule) => {
    try {
      return rule.condition(context);
    } catch (e) {
      console.error(`Error evaluating condition for rule '${rule.id}':`, e);
      return false;
    }
  });

  if (matchingRules.length === 0) {
    return {
      selectedStatus: context.existingRecord ? context.existingRecord.status : null,
      writeAllowed: true,
      reasonCode: "NO_RULES_MATCHED",
      appliedRuleIds: [],
      conflictNotes: [],
    };
  }

  // Delegate rule resolution to the conflict resolver
  const resolution = resolveRuleConflicts(matchingRules, context);

  if (!resolution.resolvedEffect) {
    return {
      selectedStatus: context.existingRecord ? context.existingRecord.status : null,
      writeAllowed: true,
      reasonCode: "NO_EFFECT_RESOLVED",
      appliedRuleIds: resolution.appliedRules.map((r) => r.id),
      conflictNotes: resolution.conflictNotes,
    };
  }

  const effect = resolution.resolvedEffect;
  
  // Use resolved status if defined, otherwise fall back to existing record or null
  const selectedStatus = effect.selectedStatus !== undefined 
    ? effect.selectedStatus 
    : (context.existingRecord ? context.existingRecord.status : null);

  return {
    selectedStatus,
    writeAllowed: effect.writeAllowed,
    reasonCode: effect.reasonCode,
    appliedRuleIds: resolution.appliedRules.map((r) => r.id),
    conflictNotes: resolution.conflictNotes,
    auditMetadata: {
      totalMatchingRules: matchingRules.length,
      matchingRuleIds: matchingRules.map((r) => r.id),
      validationIssues: effect.validationIssues || []
    }
  };
}

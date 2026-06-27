import {
  AttendanceRule,
  RuleConditionError,
  RuleEvaluationAuditMetadata,
  RuleEvaluationContext,
  RuleEvaluationOutput,
} from "./ruleEngine.types";
import { defaultRulesList } from "./defaultRules";
import { resolveRuleConflicts } from "./conflictEngine";

function createAuditMetadata(
  context: RuleEvaluationContext,
  matchingRules: AttendanceRule[],
  conditionErrors: RuleConditionError[],
  overrides: Partial<RuleEvaluationAuditMetadata> = {}
): RuleEvaluationAuditMetadata {
  return {
    totalMatchingRules: matchingRules.length,
    matchingRuleIds: matchingRules.map((rule) => rule.id),
    conditionErrors,
    validationIssues: [],
    resolvedPriority: null,
    appliedRuleScopes: [],
    source: context.additionalContext?.source,
    isRetroactiveEdit: context.additionalContext?.isRetroactiveEdit,
    ...overrides,
  };
}

/**
 * evaluateAttendanceRules
 * Evaluates the rules engine context against core default rules and optional custom rules.
 * Resolves rule clashes and returns a deterministic, explainable output state.
 */
export function evaluateAttendanceRules(
  context: RuleEvaluationContext,
  customRules: AttendanceRule[] = []
): RuleEvaluationOutput {
  const allRules = [...defaultRulesList, ...customRules].filter((r) => r.enabled);
  const conditionErrors: RuleConditionError[] = [];

  const matchingRules = allRules.filter((rule) => {
    try {
      return rule.condition(context);
    } catch (error) {
      conditionErrors.push({
        ruleId: rule.id,
        message: error instanceof Error ? error.message : String(error),
      });
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
      auditMetadata: createAuditMetadata(context, matchingRules, conditionErrors),
    };
  }

  const resolution = resolveRuleConflicts(matchingRules, context);

  if (!resolution.resolvedEffect) {
    return {
      selectedStatus: context.existingRecord ? context.existingRecord.status : null,
      writeAllowed: true,
      reasonCode: "NO_EFFECT_RESOLVED",
      appliedRuleIds: resolution.appliedRules.map((r) => r.id),
      conflictNotes: resolution.conflictNotes,
      auditMetadata: createAuditMetadata(context, matchingRules, conditionErrors, {
        resolvedPriority: resolution.resolvedPriority,
        appliedRuleScopes: resolution.appliedRules.map((rule) => rule.scope),
      }),
    };
  }

  const effect = resolution.resolvedEffect;
  const selectedStatus =
    effect.selectedStatus !== undefined ? effect.selectedStatus : context.existingRecord ? context.existingRecord.status : null;

  return {
    selectedStatus,
    writeAllowed: effect.writeAllowed,
    reasonCode: effect.reasonCode,
    appliedRuleIds: resolution.appliedRules.map((r) => r.id),
    conflictNotes: resolution.conflictNotes,
    auditMetadata: createAuditMetadata(context, matchingRules, conditionErrors, {
      validationIssues: effect.validationIssues ?? [],
      resolvedPriority: resolution.resolvedPriority,
      appliedRuleScopes: resolution.appliedRules.map((rule) => rule.scope),
      ...(effect.auditMetadata ?? {}),
    }),
  };
}

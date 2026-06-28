import type { AttendanceRule, RuleEffect, RuleEvaluationContext, RulePriority, RuleScope } from "./ruleEngine.types";

export interface ConflictResolutionResult {
  appliedRules: AttendanceRule[];
  resolvedEffect: RuleEffect | null;
  conflictNotes: string[];
  resolvedPriority: RulePriority | null;
}

function specificityScore(scope: RuleScope): number {
  switch (scope) {
    case "student":
      return 5;
    case "class":
      return 4;
    case "status":
      return 3;
    case "date":
      return 2;
    case "school":
      return 1;
    default:
      return 0;
  }
}

function sortRulesDeterministically(left: AttendanceRule, right: AttendanceRule): number {
  const priorityDelta = left.priority - right.priority;
  if (priorityDelta !== 0) return priorityDelta;

  const specificityDelta = specificityScore(right.scope) - specificityScore(left.scope);
  if (specificityDelta !== 0) return specificityDelta;

  return left.id.localeCompare(right.id);
}

function selectedStatusKey(effect: RuleEffect): string {
  return effect.selectedStatus === undefined ? "__undefined__" : String(effect.selectedStatus);
}

export function resolveRuleConflicts(
  matchingRules: AttendanceRule[],
  context: RuleEvaluationContext
): ConflictResolutionResult {
  if (matchingRules.length === 0) {
    return { appliedRules: [], resolvedEffect: null, conflictNotes: [], resolvedPriority: null };
  }

  const orderedRules = [...matchingRules].sort(sortRulesDeterministically);
  const highestPriority = orderedRules[0].priority;
  const rulesAtPriority = orderedRules.filter((rule) => rule.priority === highestPriority);
  const evaluated = rulesAtPriority.map((rule) => ({
    rule,
    effect: rule.effect(context),
  }));

  const blockingEffect = evaluated.find((item) => item.rule.conflictBehavior === "block" && !item.effect.writeAllowed);
  if (blockingEffect) {
    return {
      appliedRules: [blockingEffect.rule],
      resolvedEffect: blockingEffect.effect,
      conflictNotes: [],
      resolvedPriority: highestPriority,
    };
  }

  const uniqueStatusOutcomes = new Set(evaluated.map((item) => selectedStatusKey(item.effect)));
  if (uniqueStatusOutcomes.size <= 1) {
    const selectedStatus = evaluated.find((item) => item.effect.selectedStatus !== undefined)?.effect.selectedStatus;
    const validationIssues = evaluated.flatMap((item) => item.effect.validationIssues ?? []);
    const auditMetadata = evaluated.reduce<Record<string, unknown>>((metadata, item) => {
      return { ...metadata, ...(item.effect.auditMetadata ?? {}) };
    }, {});
    const resolvedEffect: RuleEffect = {
      writeAllowed: evaluated.every((item) => item.effect.writeAllowed),
      reasonCode: evaluated[0].effect.reasonCode,
      validationIssues,
      auditMetadata,
    };

    if (selectedStatus !== undefined) {
      resolvedEffect.selectedStatus = selectedStatus;
    }

    return {
      appliedRules: evaluated.map((item) => item.rule),
      resolvedEffect,
      conflictNotes: [],
      resolvedPriority: highestPriority,
    };
  }

  const highestSpecificity = Math.max(...evaluated.map((item) => specificityScore(item.rule.scope)));
  const highestSpecificityRules = evaluated
    .filter((item) => specificityScore(item.rule.scope) === highestSpecificity)
    .sort((left, right) => left.rule.id.localeCompare(right.rule.id));

  if (highestSpecificityRules.length === 1) {
    const resolved = highestSpecificityRules[0];
    const clashingRuleNames = evaluated
      .filter((item) => item.rule.id !== resolved.rule.id)
      .map((item) => `'${item.rule.name}'`)
      .join(", ");

    return {
      appliedRules: [resolved.rule],
      resolvedEffect: resolved.effect,
      conflictNotes: [
        `Resolved rule clash on date '${context.date}' by specificity. Rule '${resolved.rule.name}' took precedence over ${clashingRuleNames}.`,
      ],
      resolvedPriority: highestPriority,
    };
  }

  const resolved = highestSpecificityRules[0];
  const clashes = highestSpecificityRules
    .map((item) => `'${item.rule.name}' (status: ${selectedStatusKey(item.effect)})`)
    .join(" vs ");

  return {
    appliedRules: highestSpecificityRules.map((item) => item.rule),
    resolvedEffect: resolved.effect,
    conflictNotes: [
      `RULE_CLASH_WARNING: Multiple competing rules clashing at priority ${highestPriority} on date '${context.date}': ${clashes}. Deterministically applied '${resolved.rule.name}' by rule id.`,
    ],
    resolvedPriority: highestPriority,
  };
}

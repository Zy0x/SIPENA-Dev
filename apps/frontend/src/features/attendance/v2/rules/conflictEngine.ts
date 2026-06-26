import { AttendanceRule, RuleEvaluationContext, RuleEffect } from "./ruleEngine.types";

export interface ConflictResolutionResult {
  appliedRules: AttendanceRule[];
  resolvedEffect: RuleEffect | null;
  conflictNotes: string[];
}

/**
 * resolveRuleConflicts
 * Evaluates matching rules against a priority hierarchy and specificity weights.
 * Returns the resolved effect and notes regarding resolved or clashing rules.
 */
export function resolveRuleConflicts(
  matchingRules: AttendanceRule[],
  context: RuleEvaluationContext
): ConflictResolutionResult {
  if (matchingRules.length === 0) {
    return { appliedRules: [], resolvedEffect: null, conflictNotes: [] };
  }

  // Group rules by priority
  const groupedByPriority: Record<number, AttendanceRule[]> = {};
  matchingRules.forEach((rule) => {
    if (!groupedByPriority[rule.priority]) {
      groupedByPriority[rule.priority] = [];
    }
    groupedByPriority[rule.priority].push(rule);
  });

  // Find the highest priority group (lowest numerical value)
  const sortedPriorities = Object.keys(groupedByPriority)
    .map(Number)
    .sort((a, b) => a - b);
  
  const highestPriority = sortedPriorities[0];
  const rulesAtPriority = groupedByPriority[highestPriority];

  // If there's only one rule at this priority, return it immediately
  if (rulesAtPriority.length === 1) {
    const singleRule = rulesAtPriority[0];
    return {
      appliedRules: [singleRule],
      resolvedEffect: singleRule.effect(context),
      conflictNotes: [],
    };
  }

  // Evaluate the effects of all rules in this group
  const evaluated = rulesAtPriority.map((rule) => ({
    rule,
    effect: rule.effect(context),
  }));

  // Check if they disagree on the proposed selectedStatus
  const uniqueStatusOutcomes = new Set(
    evaluated.map((ev) => ev.effect.selectedStatus).filter((s) => s !== undefined)
  );

  // If they agree (0 or 1 unique status outcome), merge the write permissions and use the status
  if (uniqueStatusOutcomes.size <= 1) {
    const finalEffect: RuleEffect = {
      writeAllowed: evaluated.every((ev) => ev.effect.writeAllowed),
      reasonCode: evaluated[0].effect.reasonCode,
      selectedStatus: evaluated.find((ev) => ev.effect.selectedStatus !== undefined)?.effect.selectedStatus ?? null,
    };
    return {
      appliedRules: rulesAtPriority,
      resolvedEffect: finalEffect,
      conflictNotes: [],
    };
  }

  // Clashing conflict detected! Disagreement on selectedStatus.
  // Resolve by specificity: student > class > school > other
  const specificityScore = (scope: string) => {
    switch (scope) {
      case "student": return 3;
      case "class": return 2;
      case "school": return 1;
      default: return 0;
    }
  };

  const sortedBySpecificity = [...evaluated].sort(
    (a, b) => specificityScore(b.rule.scope) - specificityScore(a.rule.scope)
  );

  const highestSpecificityScore = specificityScore(sortedBySpecificity[0].rule.scope);
  const highestSpecificityRules = sortedBySpecificity.filter(
    (ev) => specificityScore(ev.rule.scope) === highestSpecificityScore
  );

  // If specificity resolved the clash
  if (highestSpecificityRules.length === 1) {
    const resolved = highestSpecificityRules[0];
    const clashingRuleNames = evaluated
      .filter((ev) => ev.rule.id !== resolved.rule.id)
      .map((ev) => `'${ev.rule.name}'`)
      .join(", ");
    return {
      appliedRules: [resolved.rule],
      resolvedEffect: resolved.effect,
      conflictNotes: [
        `Resolved potential clash on date '${context.date}' using specificity. Rule '${resolved.rule.name}' took precedence over ${clashingRuleNames}.`,
      ],
    };
  }

  // If there is still a tie (same priority, same specificity, different status outcomes)
  // Apply the first rule but return a warning conflict report
  const resolved = highestSpecificityRules[0];
  const clashes = highestSpecificityRules
    .map((ev) => `'${ev.rule.name}' (status: ${ev.effect.selectedStatus})`)
    .join(" vs ");
  return {
    appliedRules: highestSpecificityRules.map((h) => h.rule),
    resolvedEffect: resolved.effect,
    conflictNotes: [
      `RULE_CLASH_WARNING: Multiple competing rules clashing at priority ${highestPriority} on date '${context.date}': ${clashes}. Arbitrarily applied '${resolved.rule.name}'.`,
    ],
  };
}

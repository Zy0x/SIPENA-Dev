import type { ColumnMapping, ImportPlan } from "@/lib/gradeImport";

export type HeaderDecision =
  | "map_to_sts"
  | "map_to_sas"
  | "map_to_existing_assignment"
  | "create_assignment"
  | "create_chapter_and_assignment"
  | "ignore_column"
  | "needs_user_choice"
  | "will_skip";

export function headerDecisionFor(mapping: ColumnMapping & { targetType?: string }): HeaderDecision {
  if (mapping.parsedHeader.reserved || mapping.parsedHeader.derived || mapping.targetType === "ignore") return "ignore_column";
  if (mapping.target?.gradeType === "sts") return "map_to_sts";
  if (mapping.target?.gradeType === "sas") return "map_to_sas";
  if (mapping.target?.gradeType === "assignment" && mapping.target.assignmentId && ["safe", "warning"].includes(mapping.status)) {
    return "map_to_existing_assignment";
  }
  if (mapping.targetType === "create_assignment") return "create_assignment";
  if (mapping.targetType === "create_chapter_and_assignment") return "create_chapter_and_assignment";
  if (mapping.status === "missing") return "will_skip";
  return "needs_user_choice";
}

export function summarizeHeaderChecks(plan: ImportPlan) {
  const decisions = plan.columnMappings.map((mapping) => headerDecisionFor(mapping));
  const count = (decision: HeaderDecision) => decisions.filter((item) => item === decision).length;
  return {
    mapped: count("map_to_sts") + count("map_to_sas") + count("map_to_existing_assignment"),
    createAssignment: count("create_assignment"),
    createChapterAndAssignment: count("create_chapter_and_assignment"),
    ignored: count("ignore_column") + count("will_skip"),
    needsUserChoice: count("needs_user_choice"),
  };
}

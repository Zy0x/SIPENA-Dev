import type { ImportPlan, StudentMapping } from "@/lib/gradeImport";

export interface StudentVerifierSummary {
  safe: number;
  needsCheck: number;
  willSkip: number;
  duplicateTarget: number;
  missingInExcel: number;
}

export function isStudentMappingSafe(mapping: StudentMapping, officialGoldenPath = false): boolean {
  if (officialGoldenPath && mapping.matchedBy === "student_id" && mapping.studentId) return true;
  return Boolean(mapping.studentId && ["safe", "warning"].includes(mapping.status));
}

export function verifyStudentsTwoWay(plan: ImportPlan, officialGoldenPath = false): StudentVerifierSummary {
  const safe = plan.studentMappings.filter((mapping) => isStudentMappingSafe(mapping, officialGoldenPath)).length;
  const duplicateTarget = plan.studentMappings.filter((mapping) =>
    mapping.conflicts.some((conflict) => conflict.code === "STUDENT_DUPLICATE_EXCEL_MATCH"),
  ).length;
  const willSkip = plan.studentMappings.filter((mapping) => mapping.status === "missing_in_web").length;
  const needsCheck = plan.studentMappings.length - safe - willSkip;

  return {
    safe,
    needsCheck: Math.max(0, needsCheck),
    willSkip,
    duplicateTarget,
    missingInExcel: plan.missingInExcelStudents.length,
  };
}

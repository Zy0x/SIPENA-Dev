import { buildExecutableImportOperations, buildImportPlan, type ImportPlan, type ImportPlanContext, type OfficialTemplateAnalysis, type UpdateMode } from "@/lib/gradeImport";

import { buildImportDecisionGraph } from "./importDecisionGraph";
import type { ImportDecisionGraph } from "./types";

export interface OfficialTemplateHandlerResult {
  plan: ImportPlan;
  graph: ImportDecisionGraph;
  skipAi: boolean;
  skipManualStudentMapping: boolean;
  skipManualHeaderMapping: boolean;
  route: "golden_path" | "metadata_first" | "damaged";
  message: string;
}

export function handleOfficialTemplateAnalysis(
  analysis: OfficialTemplateAnalysis,
  context: ImportPlanContext,
  updateMode: UpdateMode = "fill_empty_only",
): OfficialTemplateHandlerResult {
  const plan = buildImportPlan(analysis, context, { updateMode });
  const executablePlan = buildExecutableImportOperations({ plan, updateMode });
  const graph = buildImportDecisionGraph(plan, executablePlan);

  if (analysis.sourceType === "official_exact") {
    return {
      plan,
      graph,
      skipAi: true,
      skipManualStudentMapping: true,
      skipManualHeaderMapping: true,
      route: "golden_path",
      message: "Template Resmi SIPENA valid. Siswa dan kolom diproses langsung dari metadata resmi.",
    };
  }

  if (analysis.sourceType === "official_modified") {
    return {
      plan,
      graph,
      skipAi: false,
      skipManualStudentMapping: true,
      skipManualHeaderMapping: false,
      route: "metadata_first",
      message: "Template berubah, tetapi metadata resmi tetap menjadi acuan utama untuk target yang valid.",
    };
  }

  return {
    plan,
    graph,
    skipAi: false,
    skipManualStudentMapping: false,
    skipManualHeaderMapping: false,
    route: "damaged",
    message: "Template resmi tidak lengkap. SIPENA perlu pemeriksaan tambahan atau fallback Excel bebas.",
  };
}

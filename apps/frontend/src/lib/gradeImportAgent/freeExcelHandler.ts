import { buildExecutableImportOperations, buildImportPlan, type FreeExcelAnalysis, type FreeExcelRegionAnalysis, type ImportPlan, type ImportPlanContext, type UpdateMode } from "@/lib/gradeImport";

import { buildImportDecisionGraph } from "./importDecisionGraph";
import type { ImportDecisionGraph } from "./types";

export interface FreeExcelHandlerResult {
  plan: ImportPlan;
  graph: ImportDecisionGraph;
  requiresTableChoice: boolean;
  selectedRegion: FreeExcelRegionAnalysis | null;
  message: string;
}

export function handleFreeExcelAnalysis(
  analysis: FreeExcelAnalysis,
  context: ImportPlanContext,
  options: { updateMode?: UpdateMode; selectedRegionId?: string } = {},
): FreeExcelHandlerResult {
  const selectedRegionId = options.selectedRegionId || analysis.selectedRegionId;
  const selectedRegion = selectedRegionId
    ? analysis.regions.find((region) => region.id === selectedRegionId) || null
    : analysis.bestRegion;
  const requiresTableChoice = analysis.requiresRegionSelection && !selectedRegionId;
  const plan = buildImportPlan(analysis, context, {
    updateMode: options.updateMode || "fill_empty_only",
    selectedRegionId: selectedRegionId || undefined,
  });
  const executablePlan = buildExecutableImportOperations({ plan });
  const graph = buildImportDecisionGraph(plan, executablePlan);

  return {
    plan,
    graph,
    requiresTableChoice,
    selectedRegion,
    message: requiresTableChoice
      ? "Kami menemukan beberapa tabel nilai. Pilih tabel yang ingin dipakai."
      : "Excel bebas sudah dibaca dengan pemeriksaan otomatis.",
  };
}

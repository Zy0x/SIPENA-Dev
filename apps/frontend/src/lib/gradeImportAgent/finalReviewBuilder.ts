import type { FinalReviewModel, ImportDecision, ImportDecisionGraph, FinalReviewSection } from "./types";

function section(id: FinalReviewSection["id"], title: string, decisions: ImportDecision[]): FinalReviewSection {
  return { id, title, count: decisions.length, decisions };
}

export function buildFinalReviewModel(graph: ImportDecisionGraph): FinalReviewModel {
  const changes = graph.decisions.filter((decision) =>
    ["save", "convert", "overwrite", "create_assignment", "create_chapter_and_assignment"].includes(decision.action),
  );
  const attention = graph.decisions.filter((decision) =>
    decision.status === "needs_user_choice" || decision.status === "blocked" || decision.action === "manual_choice_required",
  );
  const skipped = graph.decisions.filter((decision) => decision.action === "skip" || decision.status === "will_skip");
  const disabledReason = graph.summary.blocked > 0
    ? "Selesaikan atau skip item yang wajib dipilih terlebih dahulu."
    : graph.summary.manualChoiceRequired > 0
      ? "Periksa item yang masih perlu pilihan."
      : graph.summary.save + graph.summary.convert + graph.summary.overwrite === 0
        ? "Tidak ada nilai siap disimpan."
        : null;

  return {
    summary: graph.summary,
    sections: [
      section("changes", "Akan Diubah", changes),
      section("attention", "Perlu Perhatian", attention),
      section("skipped", "Akan Di-skip", skipped),
    ],
    canExecute: disabledReason === null,
    disabledReason,
  };
}

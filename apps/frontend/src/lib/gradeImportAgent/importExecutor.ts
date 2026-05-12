import type { ImportDecisionGraph, ImportExecutorPayloadItem } from "./types";

export function buildFinalImportPayload(graph: ImportDecisionGraph): ImportExecutorPayloadItem[] {
  const unsafe = graph.decisions.find((decision) =>
    decision.status === "blocked"
    || decision.status === "needs_user_choice"
    || decision.action === "manual_choice_required",
  );
  if (unsafe) {
    throw new Error("Import belum bisa dieksekusi karena masih ada item yang perlu dipilih.");
  }

  return graph.decisions.flatMap((decision): ImportExecutorPayloadItem[] => {
    if (!["save", "convert", "overwrite"].includes(decision.action)) return [];
    const executable = decision.executableOperation;
    if (!executable) return [];
    if (executable.target.gradeType === "assignment" && !executable.target.assignmentId) {
      throw new Error("Target tugas belum lengkap.");
    }
    if ((executable.target.gradeType === "sts" || executable.target.gradeType === "sas") && executable.target.assignmentId) {
      throw new Error("Target STS/SAS tidak boleh memakai tugas.");
    }
    return [{
      studentId: executable.studentId,
      gradeType: executable.target.gradeType,
      assignmentId: executable.target.gradeType === "assignment" ? executable.target.assignmentId : undefined,
      value: executable.value,
      decisionId: decision.id,
      rowIndex: decision.rowIndex,
      columnIndex: decision.columnIndex,
    }];
  });
}

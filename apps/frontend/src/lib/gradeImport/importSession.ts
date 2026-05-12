import type { ExecutableImportPlan } from "./executableImportBuilder";
import type { FreeExcelRegionAnalysis } from "./freeExcelAnalyzer";
import type { ImportSelectionState } from "./importSelection";
import type { ImportPlan, ImportSourceType } from "./types";
import type { SmartImportAssistResponse } from "./smartImportAiTypes";
import type { SpreadsheetPreviewModel } from "./spreadsheetPreviewBuilder";

export type ImportSessionMode = "quick" | "advanced";

export type ImportSessionSkipReason =
  | "skip_empty"
  | "skip_existing"
  | "manual_skip_row"
  | "manual_skip_column"
  | "manual_skip_cell";

export type ImportSessionReadyStatus =
  | "ready_fill"
  | "ready_overwrite"
  | ImportSessionSkipReason
  | "blocked"
  | "needs_confirmation";

export interface ImportSessionFileMeta {
  name: string;
  size: number;
  lastModified: number;
}

export interface ImportWorkbookProfile {
  sourceType: ImportSourceType;
  sourceLabel: string;
  selectedTableId?: string;
  candidateTables: FreeExcelRegionAnalysis[];
  requiresTableSelection: boolean;
}

export interface ImportSessionSnapshot {
  id: string;
  mode: ImportSessionMode;
  file: ImportSessionFileMeta | null;
  workbookProfile: ImportWorkbookProfile | null;
  deterministicPlan: ImportPlan | null;
  aiAssist: SmartImportAssistResponse | null;
  selectionState: ImportSelectionState;
  preview: SpreadsheetPreviewModel | null;
  executablePlan: ExecutableImportPlan | null;
  createdAt: string;
  updatedAt: string;
}

export function createImportSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `import-session-${Date.now().toString(36)}`;
}

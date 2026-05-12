import type {
  ExecutableImportOperation,
  ExecutableImportPlan,
  GradeOperation,
  GradeTarget,
  ImportConflict,
  ImportPlan,
  ImportSourceType,
  ImportWarning,
  SmartImportAssistResponse,
  SmartImportAssistSuggestion,
} from "@/lib/gradeImport";

export type ImportDecisionStatus =
  | "safe"
  | "auto_fixed"
  | "ai_decided"
  | "needs_user_choice"
  | "will_skip"
  | "blocked";

export type ImportDecisionAction =
  | "save"
  | "convert"
  | "overwrite"
  | "create_assignment"
  | "create_chapter_and_assignment"
  | "skip"
  | "manual_choice_required";

export type ImportDecisionKind =
  | "student"
  | "header"
  | "value"
  | "overwrite"
  | "structure"
  | "skip";

export type AiResolutionMode = "safe" | "fast" | "aggressive";

export interface ImportDecision {
  id: string;
  kind: ImportDecisionKind;
  status: ImportDecisionStatus;
  action: ImportDecisionAction;
  rowIndex?: number;
  columnIndex?: number;
  sourceLabel: string;
  targetLabel: string;
  target?: GradeTarget;
  rawValue?: unknown;
  value?: number | null;
  suggestedValue?: number;
  risk: "safe" | "review" | "high";
  reason: string;
  operation?: GradeOperation;
  executableOperation?: ExecutableImportOperation;
  conflicts: ImportConflict[];
  warnings: ImportWarning[];
  aiSuggestion?: SmartImportAssistSuggestion;
  approvedBy: "system" | "ai" | "user" | "none";
}

export interface ImportDecisionGraph {
  sourceType: ImportSourceType;
  officialGoldenPath: boolean;
  aiAllowed: boolean;
  plan: ImportPlan;
  executablePlan: ExecutableImportPlan;
  decisions: ImportDecision[];
  aiResponse?: SmartImportAssistResponse | null;
  summary: {
    total: number;
    save: number;
    convert: number;
    overwrite: number;
    createAssignment: number;
    createChapterAndAssignment: number;
    skip: number;
    manualChoiceRequired: number;
    blocked: number;
    safe: number;
    autoFixed: number;
    aiDecided: number;
  };
}

export interface FinalReviewSection {
  id: "changes" | "attention" | "skipped";
  title: string;
  count: number;
  decisions: ImportDecision[];
}

export interface FinalReviewModel {
  summary: ImportDecisionGraph["summary"];
  sections: FinalReviewSection[];
  canExecute: boolean;
  disabledReason: string | null;
}

export interface ImportExecutorPayloadItem {
  studentId: string;
  gradeType: "assignment" | "sts" | "sas";
  assignmentId?: string;
  value: number;
  decisionId: string;
  rowIndex?: number;
  columnIndex?: number;
}

export interface ImportResultReportInput {
  fileName?: string | null;
  className?: string | null;
  subjectName?: string | null;
  semesterName?: string | null;
  academicYearName?: string | null;
  userName?: string | null;
  importedAt?: string;
  graph: ImportDecisionGraph;
  savedCount?: number;
  failedCount?: number;
}

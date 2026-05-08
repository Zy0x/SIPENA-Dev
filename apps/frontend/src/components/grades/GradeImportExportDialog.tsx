import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock,
  Download,
  FileSpreadsheet,
  Loader2,
  MapPinned,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEnhancedToast } from "@/contexts/ToastContext";
import {
  analyzeFreeExcelWorkbook,
  analyzeOfficialTemplateWorkbook,
  buildImportPlan,
  readWorkbookFile,
  type ColumnMapping,
  type GradeOperation,
  type GradeTarget,
  type ImportConflict,
  type ImportPlan,
  type ImportPlanContext,
  type ImportPlanInputAnalysis,
  type ImportSourceType,
  type ImportWarning,
  type StudentMapping,
  type UpdateMode,
} from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { ExportOptionCard } from "./import-export/ExportOptionCard";
import { ImportDropzone } from "./import-export/ImportDropzone";
import { ImportModeCard } from "./import-export/ImportModeCard";
import { ImportStepper } from "./import-export/ImportStepper";
import { ImportSummaryPanel } from "./import-export/ImportSummaryPanel";
import { RiskAlert } from "./import-export/RiskAlert";
import { StatusBadge, type StatusBadgeTone } from "./import-export/StatusBadge";
import { WorkbookPreviewPanel } from "./import-export/WorkbookPreviewPanel";

export type GradeImportExportTab = "import" | "export";

interface GradeImportExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeTab: GradeImportExportTab;
  onTabChange: (tab: GradeImportExportTab) => void;
  classNameLabel: string;
  subjectName: string;
  semesterName?: string | null;
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  canDownloadOfficialTemplate?: boolean;
  isDownloadingTemplate?: boolean;
  onDownloadOfficialTemplate?: () => void | Promise<void>;
  isExportingCurrentGrades?: boolean;
  isExportingBackup?: boolean;
  onDownloadCurrentGrades?: () => void | Promise<void>;
  onDownloadBackup?: () => void | Promise<void>;
  onOpenLegacyImport?: () => void;
  onSaveGrade?: (studentId: string, gradeType: "assignment" | "sts" | "sas", value: number, assignmentId?: string) => void | Promise<void>;
  onImportComplete?: () => void | Promise<void>;
  importContext: ImportPlanContext;
}

type ImportMode = "official" | "smart";
type ExportMode = "official" | "current" | "backup";
type ImportExecutionState = "idle" | "analyzing" | "ready" | "failed" | "importing" | "success";
type ColumnResolutionKind = "existing_assignment" | "create_assignment" | "create_chapter_and_assignment" | "sts" | "sas" | "ignore";
type ImportUiErrorCode =
  | "IMPORT_FILE_TOO_LARGE"
  | "IMPORT_UNSUPPORTED_FILE_TYPE"
  | "IMPORT_WORKBOOK_READ_FAILED"
  | "IMPORT_CONTEXT_MISMATCH"
  | "IMPORT_DUPLICATE_STUDENT_MAPPING"
  | "IMPORT_DUPLICATE_COLUMN_TARGET"
  | "IMPORT_INVALID_GRADE_VALUE"
  | "IMPORT_NO_VALID_SHEET"
  | "IMPORT_SHEET_EMPTY"
  | "IMPORT_FILE_EMPTY";

interface ColumnResolution {
  kind: ColumnResolutionKind;
  assignmentId?: string;
  chapterId?: string;
  chapterName?: string;
  assignmentName?: string;
  confirmed?: boolean;
}

interface ImportResolverState {
  ignoredRows: number[];
  unresolvedRows: number[];
  studentOverrides: Record<string, string>;
  ignoredColumns: number[];
  columnOverrides: Record<string, ColumnResolution>;
  resolvedConflictKeys: string[];
}

interface ImportExecutionFailure {
  operationId: string;
  rowIndex: number;
  columnIndex: number;
  target: string;
  message: string;
}

interface ImportExecutionSummary {
  successCount: number;
  skippedCount: number;
  failedCount: number;
  warnings: string[];
  failedRows: ImportExecutionFailure[];
}

interface ImportExecutionProgress {
  current: number;
  total: number;
}

const emptyResolverState: ImportResolverState = {
  ignoredRows: [],
  unresolvedRows: [],
  studentOverrides: {},
  ignoredColumns: [],
  columnOverrides: {},
  resolvedConflictKeys: [],
};

const importSteps = ["Upload", "Analisis", "Pemetaan", "Konflik", "Preview", "Import"];
const maxImportFileBytes = 20 * 1024 * 1024;

const sourceLabels: Record<ImportSourceType, string> = {
  official_exact: "Template resmi cocok",
  official_modified: "Template resmi dimodifikasi",
  official_damaged: "Template resmi rusak",
  free_structured: "Excel bebas terstruktur",
  free_unstructured: "Excel bebas belum terstruktur",
  unsupported: "Tidak didukung",
};

const updateModeLabels: Record<UpdateMode, string> = {
  fill_empty_only: "Isi nilai kosong saja",
  overwrite_existing: "Timpa nilai lama",
  overwrite_selected_columns: "Timpa kolom dipilih",
  skip_existing: "Lewati nilai lama",
};

const conflictTypeLabels: Record<ImportConflict["type"], string> = {
  student: "Siswa",
  column: "Kolom",
  structure: "Struktur",
  grade_value: "Nilai",
  context: "Konteks",
  overwrite: "Overwrite",
  unsupported: "Format",
};

const exportSheetsByMode: Record<ExportMode, string[]> = {
  official: ["Panduan", "Isi_Nilai", "_manifest", "_students", "_structure", "_column_map"],
  current: ["Panduan", "Nilai"],
  backup: ["Panduan", "Nilai", "_manifest", "_students", "_structure", "_grades"],
};

const importUiErrorMessages: Record<ImportUiErrorCode, { title: string; message: string }> = {
  IMPORT_FILE_TOO_LARGE: {
    title: "IMPORT_FILE_TOO_LARGE",
    message: "File terlalu besar. Gunakan file maksimal 20 MB atau pecah workbook menjadi beberapa file.",
  },
  IMPORT_UNSUPPORTED_FILE_TYPE: {
    title: "IMPORT_UNSUPPORTED_FILE_TYPE",
    message: "Format file tidak didukung. Gunakan .xlsx, .xls, atau .csv.",
  },
  IMPORT_WORKBOOK_READ_FAILED: {
    title: "IMPORT_WORKBOOK_READ_FAILED",
    message: "Workbook gagal dibaca. Coba simpan ulang dari Excel lalu upload kembali.",
  },
  IMPORT_CONTEXT_MISMATCH: {
    title: "IMPORT_CONTEXT_MISMATCH",
    message: "Template berbeda dengan kelas, mapel, semester, atau tahun ajaran aktif. Pilih konteks yang sesuai atau download template baru.",
  },
  IMPORT_DUPLICATE_STUDENT_MAPPING: {
    title: "IMPORT_DUPLICATE_STUDENT_MAPPING",
    message: "Ada lebih dari satu baris Excel yang menuju siswa web yang sama. Pilih satu baris atau abaikan duplikat.",
  },
  IMPORT_DUPLICATE_COLUMN_TARGET: {
    title: "IMPORT_DUPLICATE_COLUMN_TARGET",
    message: "Ada lebih dari satu kolom menuju target nilai yang sama. Pilih kolom yang dipakai sebelum import.",
  },
  IMPORT_INVALID_GRADE_VALUE: {
    title: "IMPORT_INVALID_GRADE_VALUE",
    message: "Ada nilai invalid. Nilai harus berupa angka 0 sampai 100.",
  },
  IMPORT_NO_VALID_SHEET: {
    title: "IMPORT_NO_VALID_SHEET",
    message: "Workbook tidak memiliki sheet valid. Pastikan file berisi sheet nilai.",
  },
  IMPORT_SHEET_EMPTY: {
    title: "IMPORT_SHEET_EMPTY",
    message: "Sheet yang dibaca kosong. Pilih file dengan data siswa dan kolom nilai.",
  },
  IMPORT_FILE_EMPTY: {
    title: "IMPORT_FILE_EMPTY",
    message: "File kosong dan tidak bisa dianalisis.",
  },
};

function normalizeImportErrorCode(code?: string): ImportUiErrorCode | null {
  if (!code) return null;
  if (code === "IMPORT_SEMESTER_MISMATCH" || code === "IMPORT_CONTEXT_MISMATCH_BLOCKED") return "IMPORT_CONTEXT_MISMATCH";
  if (code === "STUDENT_DUPLICATE_EXCEL_MATCH") return "IMPORT_DUPLICATE_STUDENT_MAPPING";
  if (code === "IMPORT_INVALID_VALUE_STRICT" || code === "GRADE_VALUE_INVALID") return "IMPORT_INVALID_GRADE_VALUE";
  if (code in importUiErrorMessages) return code as ImportUiErrorCode;
  return null;
}

function getImportErrorMessage(code: ImportUiErrorCode | null, fallback?: string) {
  return code ? importUiErrorMessages[code] : { title: "IMPORT_WORKBOOK_READ_FAILED", message: fallback || "File gagal dianalisis. Coba periksa format workbook." };
}

function sourceTone(sourceType: ImportSourceType): StatusBadgeTone {
  if (sourceType === "official_exact") return "success";
  if (sourceType === "official_modified" || sourceType === "free_structured") return "safe";
  if (sourceType === "official_damaged") return "warning";
  if (sourceType === "free_unstructured") return "smart";
  return "warning";
}

function statusTone(status: string): StatusBadgeTone {
  if (status === "safe") return "success";
  if (status === "warning" || status === "needs_confirmation") return "warning";
  if (status === "blocked" || status === "ambiguous" || status === "missing_in_web") return "warning";
  return "info";
}

function operationTone(action: GradeOperation["action"]): StatusBadgeTone {
  if (action === "fill_empty" || action === "overwrite") return "success";
  if (action === "blocked" || action === "needs_confirmation") return "warning";
  return "info";
}

function operationLabel(operation: GradeOperation): string {
  if (operation.action === "fill_empty") return "Siap import";
  if (operation.action === "overwrite") return "Overwrite";
  if (operation.action === "skip_existing") return "Dilewati";
  if (operation.action === "skip_empty") return "Kosong";
  if (operation.action === "needs_confirmation") return "Perlu konfirmasi";
  return "Diblokir";
}

function emptyExecutionSummary(): ImportExecutionSummary {
  return {
    successCount: 0,
    skippedCount: 0,
    failedCount: 0,
    warnings: [],
    failedRows: [],
  };
}

function targetLabel(operation: GradeOperation): string {
  if (operation.target.gradeType === "sts") return "STS";
  if (operation.target.gradeType === "sas") return "SAS";
  return [operation.target.chapterName, operation.target.assignmentName].filter(Boolean).join(" - ") || "Tugas";
}

function hasBlockedConflicts(plan: ImportPlan | null): boolean {
  return Boolean(plan?.conflicts.some((item) => item.severity === "blocked"));
}

function getTopWarnings(plan: ImportPlan | null): ImportWarning[] {
  return (plan?.warnings || []).slice(0, 5);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values)).filter(Boolean);
}

function uniqueNumbersForState(values: number[]): number[] {
  return Array.from(new Set(values)).filter((value) => Number.isFinite(value));
}

function conflictKey(conflict: ImportConflict): string {
  return [
    conflict.type,
    conflict.code,
    conflict.rowIndex ?? "",
    conflict.columnIndex ?? "",
    conflict.message,
  ].join(":");
}

function targetKey(target: GradeTarget | undefined): string {
  if (!target) return "";
  if (target.gradeType === "assignment") {
    return `assignment:${target.assignmentId || ""}:${target.chapterId || ""}:${target.chapterName || ""}:${target.assignmentName || ""}`;
  }
  return `special:${target.gradeType}`;
}

function buildTargetFromColumnResolution(resolution: ColumnResolution, context: ImportPlanContext): GradeTarget | undefined {
  if (resolution.kind === "ignore") return undefined;
  if (resolution.kind === "sts" || resolution.kind === "sas") return { gradeType: resolution.kind };

  if (resolution.kind === "existing_assignment" && resolution.assignmentId) {
    const assignment = context.assignments.find((item) => item.id === resolution.assignmentId);
    const chapter = assignment ? context.chapters.find((item) => item.id === assignment.chapter_id) : undefined;
    if (!assignment) return undefined;
    return {
      gradeType: "assignment",
      chapterId: chapter?.id || assignment.chapter_id,
      chapterName: chapter?.name,
      assignmentId: assignment.id,
      assignmentName: assignment.name,
    };
  }

  if (resolution.kind === "create_assignment") {
    const chapter = context.chapters.find((item) => item.id === resolution.chapterId);
    return {
      gradeType: "assignment",
      chapterId: resolution.chapterId || chapter?.id,
      chapterName: resolution.chapterName || chapter?.name,
      assignmentName: resolution.assignmentName,
    };
  }

  return {
    gradeType: "assignment",
    chapterName: resolution.chapterName,
    assignmentName: resolution.assignmentName,
  };
}

function operationActionAfterResolution(operation: GradeOperation, updateMode: UpdateMode): GradeOperation["action"] {
  if (operation.conflicts.length) return "blocked";
  if (operation.value === null) return "skip_empty";
  if (operation.existingValue !== null && operation.existingValue !== undefined) {
    if (updateMode === "overwrite_existing" || updateMode === "overwrite_selected_columns") return "overwrite";
    return "skip_existing";
  }
  return "fill_empty";
}

function recalculateSummary(plan: ImportPlan): ImportPlan["summary"] {
  const readyOperations = plan.gradeOperations.filter((operation) => ["fill_empty", "overwrite"].includes(operation.action));
  const skippedOperations = plan.gradeOperations.filter((operation) => ["skip_empty", "skip_existing"].includes(operation.action));
  const invalidValues = plan.gradeOperations.filter((operation) =>
    operation.conflicts.some((item) => item.code === "IMPORT_INVALID_VALUE_STRICT" || item.type === "grade_value"),
  ).length;
  const newChapterSuggestions = plan.structureSuggestions.filter((item) => item.type === "create_chapter" || item.type === "create_chapter_and_assignment").length;
  const newAssignmentSuggestions = plan.structureSuggestions.filter((item) => item.type === "create_assignment" || item.type === "create_chapter_and_assignment").length;

  return {
    ...plan.summary,
    matchedStudents: plan.studentMappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
    mappedColumns: plan.columnMappings.filter((mapping) => mapping.target && ["safe", "warning"].includes(mapping.status)).length,
    safeOperations: readyOperations.length,
    blockedOperations: plan.gradeOperations.filter((operation) => operation.action === "blocked").length,
    needsConfirmation: plan.gradeOperations.filter((operation) => operation.action === "needs_confirmation").length,
    matchedStudentCount: plan.studentMappings.filter((mapping) => mapping.studentId && ["safe", "warning"].includes(mapping.status)).length,
    ambiguousStudentCount: plan.studentMappings.filter((mapping) => mapping.status === "ambiguous").length,
    missingStudentCount: plan.studentMappings.filter((mapping) => mapping.status === "missing_in_web" || mapping.status === "missing_in_excel").length,
    gradeColumnCount: plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived && mapping.status !== "missing").length,
    conflictCount: plan.conflicts.length,
    newAssignmentCount: newAssignmentSuggestions,
    newChapterCount: newChapterSuggestions,
    invalidValueCount: invalidValues,
    readyImportCount: readyOperations.length,
    skippedValueCount: skippedOperations.length,
  };
}

function applyResolverToPlan(
  basePlan: ImportPlan,
  resolver: ImportResolverState,
  context: ImportPlanContext,
  updateMode: UpdateMode,
): ImportPlan {
  const ignoredRows = new Set(resolver.ignoredRows);
  const unresolvedRows = new Set(resolver.unresolvedRows);
  const ignoredColumns = new Set(resolver.ignoredColumns);
  const resolvedKeys = new Set(resolver.resolvedConflictKeys);

  const studentsById = new Map(context.students.map((student) => [student.id, student]));
  const columnOverrides = new Map(
    Object.entries(resolver.columnOverrides).map(([columnIndex, resolution]) => [Number(columnIndex), resolution]),
  );

  const studentMappings = basePlan.studentMappings.map((mapping) => {
    const overrideStudent = resolver.studentOverrides[String(mapping.rowIndex)]
      ? studentsById.get(resolver.studentOverrides[String(mapping.rowIndex)])
      : undefined;

    if (ignoredRows.has(mapping.rowIndex)) {
      return {
        ...mapping,
        status: "warning" as const,
        warnings: uniqueStrings([...mapping.warnings.map((item) => item.code), "STUDENT_ROW_IGNORED_BY_USER"]).map((code) => (
          mapping.warnings.find((item) => item.code === code) || {
            code,
            severity: "warning" as const,
            message: "Baris Excel diabaikan untuk import.",
            rowIndex: mapping.rowIndex,
          }
        )),
        conflicts: [],
      };
    }

    if (unresolvedRows.has(mapping.rowIndex)) {
      return {
        ...mapping,
        status: "blocked" as const,
        conflicts: [{
          code: "STUDENT_MARKED_UNRESOLVED",
          severity: "blocked" as const,
          type: "student" as const,
          rowIndex: mapping.rowIndex,
          message: "Baris siswa ditandai unresolved oleh user.",
        }],
      };
    }

    if (overrideStudent) {
      return {
        ...mapping,
        studentId: overrideStudent.id,
        webName: overrideStudent.name,
        webNisn: overrideStudent.nisn || undefined,
        matchedBy: "manual" as const,
        confidence: 100,
        status: "safe" as const,
        conflicts: [],
      };
    }

    return mapping;
  });

  const columnMappings = basePlan.columnMappings.map((mapping) => {
    const resolution = columnOverrides.get(mapping.columnIndex);

    if (ignoredColumns.has(mapping.columnIndex) || resolution?.kind === "ignore") {
      return {
        ...mapping,
        target: undefined,
        confidence: 100,
        status: "safe" as const,
        conflicts: [],
        warnings: [{
          code: "COLUMN_IGNORED_BY_USER",
          severity: "warning" as const,
          message: "Kolom Excel diabaikan untuk import.",
          columnIndex: mapping.columnIndex,
        }],
      };
    }

    if (resolution) {
      const target = buildTargetFromColumnResolution(resolution, context);
      const needsStructureConfirmation = ["create_assignment", "create_chapter_and_assignment"].includes(resolution.kind) && !resolution.confirmed;
      return {
        ...mapping,
        target,
        confidence: resolution.kind === "existing_assignment" || resolution.kind === "sts" || resolution.kind === "sas" ? 100 : 92,
        status: needsStructureConfirmation ? "needs_confirmation" as const : "safe" as const,
        conflicts: needsStructureConfirmation
          ? [{
              code: "STRUCTURE_CONFIRMATION_REQUIRED",
              severity: "blocked" as const,
              type: "structure" as const,
              columnIndex: mapping.columnIndex,
              message: "BAB/tugas baru belum dikonfirmasi.",
            }]
          : [],
        warnings: resolution.kind === "create_assignment" || resolution.kind === "create_chapter_and_assignment"
          ? [{
              code: "STRUCTURE_CREATION_CONFIRMED_IN_PREVIEW",
              severity: "warning" as const,
              message: "Struktur baru hanya dikonfirmasi untuk preview, belum dibuat di database.",
              columnIndex: mapping.columnIndex,
            }]
          : mapping.warnings,
      };
    }

    return mapping;
  });

  const studentByRow = new Map(studentMappings.map((mapping) => [mapping.rowIndex, mapping]));
  const columnByIndex = new Map(columnMappings.map((mapping) => [mapping.columnIndex, mapping]));

  const gradeOperations = basePlan.gradeOperations.map((operation) => {
    const student = studentByRow.get(operation.rowIndex);
    const column = columnByIndex.get(operation.columnIndex);
    const ignored = ignoredRows.has(operation.rowIndex) || ignoredColumns.has(operation.columnIndex) || column?.target === undefined;
    const unresolved = unresolvedRows.has(operation.rowIndex);
    const studentSafe = Boolean(student?.studentId && ["safe", "warning"].includes(student.status));
    const columnSafe = Boolean(column?.target && ["safe", "warning"].includes(column.status));

    let conflicts = operation.conflicts.filter((item) => {
      if (resolvedKeys.has(conflictKey(item))) return false;
      if (ignored) return false;
      if (item.type === "student" && studentSafe) return false;
      if ((item.type === "column" || item.type === "structure") && columnSafe) return false;
      return true;
    });

    if (unresolved) {
      conflicts = [{
        code: "STUDENT_MARKED_UNRESOLVED",
        severity: "blocked" as const,
        type: "student" as const,
        rowIndex: operation.rowIndex,
        columnIndex: operation.columnIndex,
        message: "Baris siswa ditandai unresolved oleh user.",
      }];
    }

    const nextOperation: GradeOperation = {
      ...operation,
      studentId: student?.studentId,
      target: column?.target || operation.target,
      updateMode,
      conflicts,
      action: ignored ? "skip_existing" : operation.action,
    };
    nextOperation.action = ignored ? "skip_existing" : operationActionAfterResolution(nextOperation, updateMode);
    return nextOperation;
  });

  const operationConflicts = gradeOperations.flatMap((operation) => operation.conflicts);
  const planConflicts = basePlan.conflicts.filter((item) => {
    if (resolvedKeys.has(conflictKey(item))) return false;
    if (item.rowIndex && ignoredRows.has(item.rowIndex)) return false;
    if (item.columnIndex && ignoredColumns.has(item.columnIndex)) return false;
    if (item.type === "student" && item.rowIndex) {
      const mapping = studentByRow.get(item.rowIndex);
      return !(mapping?.studentId && ["safe", "warning"].includes(mapping.status));
    }
    if ((item.type === "column" || item.type === "structure") && item.columnIndex) {
      const mapping = columnByIndex.get(item.columnIndex);
      return !(mapping?.target && ["safe", "warning"].includes(mapping.status));
    }
    return true;
  });

  const nextPlan: ImportPlan = {
    ...basePlan,
    updateMode,
    studentMappings,
    columnMappings,
    gradeOperations,
    conflicts: [...planConflicts, ...operationConflicts],
  };

  return {
    ...nextPlan,
    conflicts: nextPlan.conflicts.filter((item, index, all) =>
      all.findIndex((candidate) => conflictKey(candidate) === conflictKey(item)) === index,
    ),
    summary: recalculateSummary(nextPlan),
  };
}

function MetricCard({
  label,
  value,
  tone = "info",
}: {
  label: string;
  value: number;
  tone?: "blue" | "green" | "orange" | "red" | "violet" | "info";
}) {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/25 dark:text-emerald-100",
    orange: "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-100",
    red: "border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100",
    violet: "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-900/60 dark:bg-violet-950/25 dark:text-violet-100",
    info: "border-border bg-slate-50 text-slate-900 dark:bg-slate-900/60 dark:text-slate-100",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-2xl border p-3", toneClass)}>
      <p className="truncate text-xs font-medium opacity-80">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal">{value}</p>
    </div>
  );
}

function EmptyPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-border bg-white p-6 text-center dark:bg-slate-950">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-900">
        <Clock className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}

function AnalysisStep({ plan }: { plan: ImportPlan | null }) {
  if (!plan) {
    return <EmptyPanel title="Belum ada file dianalisis" description="Upload file Excel atau CSV untuk membuat ImportPlan preview." />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge tone={sourceTone(plan.sourceType)}>{sourceLabels[plan.sourceType]}</StatusBadge>
          <StatusBadge tone={hasBlockedConflicts(plan) ? "warning" : "safe"}>
            {hasBlockedConflicts(plan) ? "Ada blocker" : "Siap dilanjutkan"}
          </StatusBadge>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Siswa cocok" value={plan.summary.matchedStudentCount || 0} tone="green" />
          <MetricCard label="Siswa ambigu" value={plan.summary.ambiguousStudentCount || 0} tone="orange" />
          <MetricCard label="Kolom nilai" value={plan.summary.gradeColumnCount || 0} tone="blue" />
          <MetricCard label="Konflik" value={plan.summary.conflictCount || 0} tone={(plan.summary.conflictCount || 0) > 0 ? "red" : "green"} />
          <MetricCard label="Tugas baru" value={plan.summary.newAssignmentCount || 0} tone="violet" />
          <MetricCard label="Nilai invalid" value={plan.summary.invalidValueCount || 0} tone={(plan.summary.invalidValueCount || 0) > 0 ? "orange" : "green"} />
        </div>
      </div>

      {(plan.summary.gradeColumnCount || 0) === 0 ? (
        <RiskAlert title="Tidak ada kolom nilai" tone="blocked">
          IMPORT_NO_GRADE_COLUMNS: Pastikan workbook memiliki kolom nilai seperti BAB 1 - Tugas 1, STS, atau SAS.
        </RiskAlert>
      ) : null}

      {hasBlockedConflicts(plan) ? (
        <RiskAlert title="ImportPlan blocked" tone="blocked">
          IMPORT_PLAN_BLOCKED: Masuk ke step Konflik dan selesaikan item berstatus Diblokir sebelum import.
        </RiskAlert>
      ) : null}

      <div className="space-y-2">
        {getTopWarnings(plan).length ? getTopWarnings(plan).map((item, index) => (
          <RiskAlert key={`${item.code}-${index}`} title={normalizeImportErrorCode(item.code) || item.code} tone="warning">
            {getImportErrorMessage(normalizeImportErrorCode(item.code), item.message).message}
          </RiskAlert>
        )) : (
          <RiskAlert title="Tidak ada warning utama" tone="safe">
            Analisis awal tidak menemukan warning utama. Tetap cek pemetaan dan preview sebelum import.
          </RiskAlert>
        )}
      </div>
    </div>
  );
}

function StudentMappingCard({ mapping }: { mapping: StudentMapping }) {
  const excelLabel = mapping.excelName || mapping.excelNisn || `Baris ${mapping.rowIndex}`;
  const webLabel = `Web: ${mapping.webName || "Belum cocok"} ${mapping.webNisn ? `(${mapping.webNisn})` : ""}`.trim();

  return (
    <div className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={excelLabel}>
            {excelLabel}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={webLabel}>
            {webLabel}
          </p>
        </div>
        <StatusBadge tone={statusTone(mapping.status)}>{mapping.status}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Baris {mapping.rowIndex}</span>
        <span>Confidence {mapping.confidence}%</span>
        <span>{mapping.matchedBy || "manual"}</span>
      </div>
    </div>
  );
}

function ColumnMappingCard({ mapping }: { mapping: ColumnMapping }) {
  const target = mapping.target?.gradeType === "assignment"
    ? [mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ")
    : mapping.target?.gradeType?.toUpperCase();

  return (
    <div className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={mapping.rawHeader || `Kolom ${mapping.columnIndex}`}>{mapping.rawHeader || `Kolom ${mapping.columnIndex}`}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground" title={target || "Belum dipetakan"}>Target: {target || "Belum dipetakan"}</p>
        </div>
        <StatusBadge tone={statusTone(mapping.status)}>{mapping.status}</StatusBadge>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
        <span>Kolom {mapping.columnIndex}</span>
        <span>Confidence {mapping.confidence}%</span>
        <span>{mapping.parsedHeader.headerType}</span>
      </div>
    </div>
  );
}

function MappingStep({ plan }: { plan: ImportPlan | null }) {
  if (!plan) {
    return <EmptyPanel title="Pemetaan belum tersedia" description="ImportPlan akan menampilkan mapping siswa dan kolom setelah file selesai dianalisis." />;
  }

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Mapping Siswa</h3>
        </div>
        <div className="grid gap-3 md:hidden">
          {plan.studentMappings.length ? plan.studentMappings.slice(0, 24).map((mapping) => <StudentMappingCard key={mapping.rowIndex} mapping={mapping} />) : (
            <EmptyPanel title="Belum ada siswa" description="Workbook tidak memuat baris siswa yang bisa dipetakan. Pastikan ada kolom Nama Siswa atau NISN." />
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-[24px] border border-border bg-white dark:bg-slate-950 md:block">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Baris</th>
                <th className="px-4 py-3 text-left font-semibold">Excel</th>
                <th className="px-4 py-3 text-left font-semibold">Data Web</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {plan.studentMappings.map((mapping) => (
                <tr key={mapping.rowIndex} className="border-t border-border">
                  <td className="px-4 py-3">{mapping.rowIndex}</td>
                  <td className="max-w-[220px] px-4 py-3"><span className="block truncate" title={mapping.excelName || "-"}>{mapping.excelName || "-"}</span><span className="block truncate text-xs text-muted-foreground" title={mapping.excelNisn || ""}>{mapping.excelNisn || ""}</span></td>
                  <td className="max-w-[220px] px-4 py-3"><span className="block truncate" title={mapping.webName || "-"}>{mapping.webName || "-"}</span><span className="block truncate text-xs text-muted-foreground" title={mapping.webNisn || ""}>{mapping.webNisn || ""}</span></td>
                  <td className="px-4 py-3"><StatusBadge tone={statusTone(mapping.status)}>{mapping.status}</StatusBadge></td>
                  <td className="px-4 py-3">{mapping.confidence}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <MapPinned className="h-4 w-4 text-violet-600" />
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Mapping Kolom/BAB/Tugas</h3>
        </div>
        <div className="grid gap-3 md:hidden">
          {plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).length ? plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).map((mapping) => (
            <ColumnMappingCard key={mapping.columnIndex} mapping={mapping} />
          )) : (
            <EmptyPanel title="Tidak ada kolom nilai" description="Tambahkan kolom seperti BAB 1 - Tugas 1, STS, atau SAS agar import dapat dipetakan." />
          )}
        </div>
        <div className="hidden overflow-x-auto rounded-[24px] border border-border bg-white dark:bg-slate-950 md:block">
          <table className="w-full min-w-[780px] text-sm">
            <thead className="bg-slate-50 text-xs text-muted-foreground dark:bg-slate-900/60">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kolom</th>
                <th className="px-4 py-3 text-left font-semibold">Header</th>
                <th className="px-4 py-3 text-left font-semibold">Target</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-left font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).map((mapping) => {
                const target = mapping.target?.gradeType === "assignment"
                  ? [mapping.target.chapterName, mapping.target.assignmentName].filter(Boolean).join(" - ")
                  : mapping.target?.gradeType?.toUpperCase();
                return (
                  <tr key={mapping.columnIndex} className="border-t border-border">
                    <td className="px-4 py-3">{mapping.columnIndex}</td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block truncate" title={mapping.rawHeader}>{mapping.rawHeader}</span></td>
                    <td className="max-w-[260px] px-4 py-3"><span className="block truncate" title={target || "-"}>{target || "-"}</span></td>
                    <td className="px-4 py-3"><StatusBadge tone={statusTone(mapping.status)}>{mapping.status}</StatusBadge></td>
                    <td className="px-4 py-3">{mapping.confidence}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

interface ConflictResolutionActions {
  onUseCurrentStudent: (rowIndex: number, studentId: string) => void;
  onChooseStudent: (rowIndex: number, studentId: string) => void;
  onIgnoreRow: (rowIndex: number) => void;
  onMarkRowUnresolved: (rowIndex: number) => void;
  onUseExistingAssignment: (columnIndex: number, assignmentId: string) => void;
  onConfirmCreateAssignment: (columnIndex: number, chapterId: string, assignmentName: string) => void;
  onConfirmCreateChapterAndAssignment: (columnIndex: number, chapterName: string, assignmentName: string) => void;
  onSetSpecialColumn: (columnIndex: number, kind: "sts" | "sas") => void;
  onIgnoreColumn: (columnIndex: number) => void;
  onResolveConflict: (conflict: ImportConflict) => void;
  onKeepDuplicateColumn: (conflict: ImportConflict, keepColumnIndex: number) => void;
  onBulkIgnoreDerived: () => void;
  onBulkUseSafeMappings: () => void;
  onBulkTrustStudentIdWarnings: () => void;
  onUpdateModeChange: (mode: UpdateMode) => void;
}

function ResolutionButton({
  children,
  onClick,
  tone = "default",
}: {
  children: string;
  onClick: () => void;
  tone?: "default" | "safe" | "warning";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        tone === "safe" && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-950/35 dark:text-blue-100",
        tone === "warning" && "border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-100",
        tone === "default" && "border-border bg-white text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900",
      )}
    >
      {children}
    </button>
  );
}

function StructureResolutionControls({
  conflict,
  mapping,
  context,
  actions,
}: {
  conflict: ImportConflict;
  mapping?: ColumnMapping;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  const suggestedChapterName = mapping?.target?.chapterName || mapping?.target?.sourceChapterName || "";
  const suggestedAssignmentName = mapping?.target?.assignmentName || mapping?.target?.sourceAssignmentName || mapping?.rawHeader || "";
  const [chapterName, setChapterName] = useState(suggestedChapterName);
  const [assignmentName, setAssignmentName] = useState(suggestedAssignmentName);
  const [chapterId, setChapterId] = useState(mapping?.target?.chapterId || context.chapters[0]?.id || "");

  return (
    <div className="mt-3 grid gap-2 rounded-2xl border border-orange-100 bg-white/70 p-3 dark:border-orange-900/50 dark:bg-slate-950/40">
      <label className="grid gap-1 text-xs font-medium">
        BAB
        <input
          value={chapterName}
          onChange={(event) => setChapterName(event.target.value)}
          className="min-h-9 rounded-xl border border-border bg-white px-3 text-sm dark:bg-slate-950"
          placeholder="Nama BAB"
        />
      </label>
      <label className="grid gap-1 text-xs font-medium">
        Tugas
        <input
          value={assignmentName}
          onChange={(event) => setAssignmentName(event.target.value)}
          className="min-h-9 rounded-xl border border-border bg-white px-3 text-sm dark:bg-slate-950"
          placeholder="Nama tugas"
        />
      </label>
      <div className="flex flex-wrap gap-2">
        {context.chapters.length ? (
          <select
            value={chapterId}
            onChange={(event) => setChapterId(event.target.value)}
            className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
          >
            {context.chapters.map((chapter) => (
              <option key={chapter.id} value={chapter.id}>{chapter.name}</option>
            ))}
          </select>
        ) : null}
        <ResolutionButton
          tone="warning"
          onClick={() => {
            if (!conflict.columnIndex || !chapterId || !assignmentName.trim()) return;
            actions.onConfirmCreateAssignment(conflict.columnIndex, chapterId, assignmentName.trim());
          }}
        >
          Konfirmasi tugas baru
        </ResolutionButton>
        <ResolutionButton
          tone="warning"
          onClick={() => {
            if (!conflict.columnIndex || !chapterName.trim() || !assignmentName.trim()) return;
            actions.onConfirmCreateChapterAndAssignment(conflict.columnIndex, chapterName.trim(), assignmentName.trim());
          }}
        >
          Konfirmasi BAB + tugas
        </ResolutionButton>
      </div>
    </div>
  );
}

function ConflictActionPanel({
  conflict,
  plan,
  context,
  actions,
}: {
  conflict: ImportConflict;
  plan: ImportPlan;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  const studentMapping = conflict.rowIndex ? plan.studentMappings.find((mapping) => mapping.rowIndex === conflict.rowIndex) : undefined;
  const columnMapping = conflict.columnIndex ? plan.columnMappings.find((mapping) => mapping.columnIndex === conflict.columnIndex) : undefined;
  const chapterById = new Map(context.chapters.map((chapter) => [chapter.id, chapter]));

  if (conflict.type === "student" && conflict.rowIndex) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        {studentMapping?.studentId ? (
          <ResolutionButton tone="safe" onClick={() => actions.onUseCurrentStudent(conflict.rowIndex!, studentMapping.studentId!)}>
            Gunakan siswa web ini
          </ResolutionButton>
        ) : null}
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) actions.onChooseStudent(conflict.rowIndex!, event.target.value);
          }}
          className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
        >
          <option value="">Pilih siswa lain</option>
          {context.students.map((student) => (
            <option key={student.id} value={student.id}>{student.name} {student.nisn ? `(${student.nisn})` : ""}</option>
          ))}
        </select>
        <ResolutionButton onClick={() => actions.onIgnoreRow(conflict.rowIndex!)}>Abaikan baris Excel</ResolutionButton>
        <ResolutionButton tone="warning" onClick={() => actions.onMarkRowUnresolved(conflict.rowIndex!)}>Tandai unresolved</ResolutionButton>
      </div>
    );
  }

  if ((conflict.type === "column" || conflict.type === "structure") && conflict.columnIndex) {
    const duplicateOptionColumns = conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET"
      ? (conflict.options || [])
          .map((header) => plan.columnMappings.find((mapping) => mapping.rawHeader === header))
          .filter(Boolean) as ColumnMapping[]
      : [];

    return (
      <div className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value=""
            onChange={(event) => {
              if (event.target.value) actions.onUseExistingAssignment(conflict.columnIndex!, event.target.value);
            }}
            className="min-h-9 max-w-full rounded-full border border-border bg-white px-3 text-xs dark:bg-slate-950"
          >
            <option value="">Gunakan tugas existing</option>
            {context.assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {[chapterById.get(assignment.chapter_id)?.name, assignment.name].filter(Boolean).join(" - ")}
              </option>
            ))}
          </select>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sts")}>Jadikan STS</ResolutionButton>
          <ResolutionButton tone="safe" onClick={() => actions.onSetSpecialColumn(conflict.columnIndex!, "sas")}>Jadikan SAS</ResolutionButton>
          <ResolutionButton onClick={() => actions.onIgnoreColumn(conflict.columnIndex!)}>Abaikan kolom</ResolutionButton>
          {conflict.code === "IMPORT_DUPLICATE_COLUMN_TARGET" ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, conflict.columnIndex!)}>
              Gunakan kolom ini
            </ResolutionButton>
          ) : null}
          {duplicateOptionColumns[0] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[0].columnIndex)}>
              Gunakan kolom pertama
            </ResolutionButton>
          ) : null}
          {duplicateOptionColumns[1] ? (
            <ResolutionButton tone="safe" onClick={() => actions.onKeepDuplicateColumn(conflict, duplicateOptionColumns[1].columnIndex)}>
              Gunakan kolom kedua
            </ResolutionButton>
          ) : null}
        </div>
        {conflict.type === "structure" ? (
          <StructureResolutionControls conflict={conflict} mapping={columnMapping} context={context} actions={actions} />
        ) : null}
      </div>
    );
  }

  if (conflict.type === "overwrite") {
    return (
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {(Object.keys(updateModeLabels) as UpdateMode[]).map((mode) => (
          <ResolutionButton key={mode} tone={mode === "overwrite_existing" ? "warning" : "safe"} onClick={() => actions.onUpdateModeChange(mode)}>
            {updateModeLabels[mode]}
          </ResolutionButton>
        ))}
      </div>
    );
  }

  if (conflict.severity === "blocked") {
    return (
      <div className="mt-3 rounded-2xl border border-red-100 bg-white/70 p-3 text-xs leading-5 dark:border-red-900/50 dark:bg-slate-950/40">
        Konflik ini tetap diblokir sampai file atau pemetaan sumber diperbaiki. Tidak ada auto-map untuk data ambigu.
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <ResolutionButton onClick={() => actions.onResolveConflict(conflict)}>Tandai dicek</ResolutionButton>
    </div>
  );
}

function ConflictStep({
  plan,
  context,
  actions,
}: {
  plan: ImportPlan | null;
  context: ImportPlanContext;
  actions: ConflictResolutionActions;
}) {
  if (!plan) {
    return <EmptyPanel title="Konflik belum tersedia" description="Konflik akan muncul setelah file dianalisis." />;
  }

  const grouped = plan.conflicts.reduce((acc, item) => {
    acc[item.type] = [...(acc[item.type] || []), item];
    return acc;
  }, {} as Record<ImportConflict["type"], ImportConflict[]>);
  const types = Object.keys(conflictTypeLabels) as ImportConflict["type"][];

  return (
    <div className="space-y-3">
      <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Bulk action aman</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Action ini hanya mengubah preview resolver. Tidak ada data yang disimpan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ResolutionButton onClick={actions.onBulkIgnoreDerived}>Abaikan semua derived columns</ResolutionButton>
            <ResolutionButton tone="safe" onClick={actions.onBulkUseSafeMappings}>Gunakan semua mapping safe</ResolutionButton>
            <ResolutionButton tone="safe" onClick={actions.onBulkTrustStudentIdWarnings}>Gunakan data web untuk warning student_id</ResolutionButton>
          </div>
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Existing value conflict policy</p>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(updateModeLabels) as UpdateMode[]).map((mode) => (
              <ResolutionButton
                key={mode}
                tone={plan.updateMode === mode ? "safe" : mode === "overwrite_existing" ? "warning" : "default"}
                onClick={() => actions.onUpdateModeChange(mode)}
              >
                {updateModeLabels[mode]}
              </ResolutionButton>
            ))}
          </div>
        </div>
      </section>

      {!plan.conflicts.length ? (
        <RiskAlert title="Tidak ada konflik blocking" tone="safe">
          ImportPlan tidak menemukan konflik utama. Lanjutkan ke preview untuk melihat operasi yang akan terjadi.
        </RiskAlert>
      ) : types.filter((type) => grouped[type]?.length).map((type) => (
        <section key={type} className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{conflictTypeLabels[type]}</h3>
            <StatusBadge tone="warning">{grouped[type].length} konflik</StatusBadge>
          </div>
          <div className="mt-3 space-y-2">
            {grouped[type].map((item, index) => (
              <div key={`${item.code}-${index}`} className="rounded-2xl border border-red-100 bg-red-50/80 p-3 text-red-950 dark:border-red-900/60 dark:bg-red-950/25 dark:text-red-100">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="max-w-full truncate text-sm font-semibold" title={normalizeImportErrorCode(item.code) || item.code}>
                        {normalizeImportErrorCode(item.code) || item.code}
                      </p>
                      <StatusBadge tone={item.severity === "blocked" ? "warning" : "info"}>
                        {item.severity === "blocked" ? "Diblokir" : item.severity === "warning" ? "Perlu Dicek" : "Aman"}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs leading-5 opacity-85">
                      {getImportErrorMessage(normalizeImportErrorCode(item.code), item.message).message}
                    </p>
                    <p className="mt-1 text-xs opacity-70">
                      {item.rowIndex ? `Baris ${item.rowIndex}` : ""} {item.columnIndex ? `Kolom ${item.columnIndex}` : ""}
                    </p>
                    <ConflictActionPanel conflict={item} plan={plan} context={context} actions={actions} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PreviewStep({
  plan,
  updateMode,
  onUpdateModeChange,
}: {
  plan: ImportPlan | null;
  updateMode: UpdateMode;
  onUpdateModeChange: (mode: UpdateMode) => void;
}) {
  if (!plan) {
    return <EmptyPanel title="Preview belum tersedia" description="Preview operasi akan muncul setelah file selesai dianalisis dan pemetaan aman." />;
  }

  const groupedActions = plan.gradeOperations.reduce((acc, operation) => {
    acc[operation.action] = (acc[operation.action] || 0) + 1;
    return acc;
  }, {} as Record<GradeOperation["action"], number>);
  const visibleOperations = plan.gradeOperations
    .filter((operation) => operation.value !== null || operation.action !== "skip_empty")
    .slice(0, 80);
  const isBlocked = hasBlockedConflicts(plan);

  return (
    <div className="space-y-4">
      {isBlocked ? (
        <RiskAlert title="ImportPlan blocked" tone="blocked">
          IMPORT_PLAN_BLOCKED: Preview ini masih memiliki konflik Diblokir. Tombol import tetap nonaktif sampai konflik diselesaikan.
        </RiskAlert>
      ) : null}

      <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Update Mode</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {(Object.keys(updateModeLabels) as UpdateMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onUpdateModeChange(mode)}
              className={cn(
                "rounded-2xl border p-3 text-left text-sm transition-colors",
                updateMode === mode
                  ? "border-blue-300 bg-blue-50 text-blue-950 dark:border-blue-800 dark:bg-blue-950/35 dark:text-blue-100"
                  : "border-border bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-900/50 dark:text-slate-200",
              )}
            >
              <span className="font-semibold">{updateModeLabels[mode]}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="BAB baru" value={plan.summary.newChapterCount || 0} tone="violet" />
        <MetricCard label="Tugas baru" value={plan.summary.newAssignmentCount || 0} tone="violet" />
        <MetricCard label="Siap import" value={plan.summary.readyImportCount || 0} tone="green" />
        <MetricCard label="Skipped/invalid" value={(plan.summary.skippedValueCount || 0) + (plan.summary.invalidValueCount || 0)} tone="orange" />
      </div>

      <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(groupedActions) as GradeOperation["action"][]).map((action) => (
            <StatusBadge key={action} tone={operationTone(action)}>{operationLabel({ action } as GradeOperation)}: {groupedActions[action]}</StatusBadge>
          ))}
        </div>
        <div className="mt-4 grid gap-2">
          {visibleOperations.map((operation) => (
            <div key={operation.id} className="rounded-2xl border border-border bg-slate-50 p-3 dark:bg-slate-900/55">
              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={targetLabel(operation)}>{targetLabel(operation)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Baris {operation.rowIndex} / Kolom {operation.columnIndex} / Nilai {operation.value ?? "-"}
                    {operation.existingValue !== undefined ? ` / Lama ${operation.existingValue ?? "kosong"}` : ""}
                  </p>
                </div>
                <StatusBadge tone={operationTone(operation.action)}>{operationLabel(operation)}</StatusBadge>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function hasExistingGrade(operation: GradeOperation): boolean {
  return operation.existingValue !== null && operation.existingValue !== undefined;
}

function canExecuteOverwrite(
  operation: GradeOperation,
  selectedOverwriteColumns: Set<number>,
): boolean {
  if (!hasExistingGrade(operation)) return true;
  if (operation.updateMode === "overwrite_existing") return true;
  if (operation.updateMode === "overwrite_selected_columns") {
    return selectedOverwriteColumns.has(operation.columnIndex);
  }
  return false;
}

// TODO production import hardening before replacing this safe client executor:
// RPC batch import, idempotency key, signed server template, audit log,
// rollback, and server-side validation.
async function executeClientSideImport({
  plan,
  onSaveGrade,
  onProgress,
  selectedOverwriteColumns,
}: {
  plan: ImportPlan;
  onSaveGrade?: GradeImportExportDialogProps["onSaveGrade"];
  onProgress: (progress: ImportExecutionProgress) => void;
  selectedOverwriteColumns: Set<number>;
}): Promise<ImportExecutionSummary> {
  const summary = emptyExecutionSummary();
  const operations = plan.gradeOperations;
  const warnings = new Set<string>();

  if (!onSaveGrade) {
    return {
      ...summary,
      skippedCount: operations.length,
      warnings: ["Mekanisme simpan nilai belum tersedia di halaman ini."],
    };
  }

  onProgress({ current: 0, total: operations.length });

  for (const operation of operations) {
    onProgress({ current: summary.successCount + summary.failedCount + summary.skippedCount, total: operations.length });

    if (operation.conflicts.length || operation.action === "blocked" || operation.action === "needs_confirmation") {
      summary.skippedCount += 1;
      warnings.add("Sebagian operasi dilewati karena masih blocked atau unresolved.");
      continue;
    }

    if (operation.action !== "fill_empty" && operation.action !== "overwrite") {
      summary.skippedCount += 1;
      continue;
    }

    if (!operation.studentId || operation.value === null) {
      summary.skippedCount += 1;
      warnings.add("Sebagian operasi dilewati karena siswa atau nilai belum valid.");
      continue;
    }

    if (operation.target.gradeType === "assignment" && !operation.target.assignmentId) {
      summary.skippedCount += 1;
      warnings.add("Struktur baru perlu dibuat atau dikonfirmasi terlebih dahulu.");
      continue;
    }

    if (operation.action === "overwrite" && !canExecuteOverwrite(operation, selectedOverwriteColumns)) {
      summary.skippedCount += 1;
      warnings.add("Nilai lama dilewati karena mode update tidak mengizinkan overwrite untuk kolom ini.");
      continue;
    }

    try {
      await onSaveGrade(
        operation.studentId,
        operation.target.gradeType,
        operation.value,
        operation.target.gradeType === "assignment" ? operation.target.assignmentId : undefined,
      );
      summary.successCount += 1;
    } catch (caught) {
      summary.failedCount += 1;
      summary.failedRows.push({
        operationId: operation.id,
        rowIndex: operation.rowIndex,
        columnIndex: operation.columnIndex,
        target: targetLabel(operation),
        message: caught instanceof Error ? caught.message : "Gagal menyimpan nilai.",
      });
    }
  }

  onProgress({ current: operations.length, total: operations.length });

  return {
    ...summary,
    warnings: Array.from(warnings),
  };
}

function ImportStep({
  state,
  plan,
  summary,
  progress,
  onDone,
  onBack,
}: {
  state: ImportExecutionState;
  plan: ImportPlan | null;
  summary: ImportExecutionSummary | null;
  progress: ImportExecutionProgress;
  onDone: () => void;
  onBack: () => void;
}) {
  const blocked = hasBlockedConflicts(plan);
  const isSuccess = state === "success";
  const progressPercent = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
  const hasFailures = Boolean(summary?.failedCount);
  return (
    <div className="space-y-4">
      <div className="rounded-[24px] border border-border bg-white p-6 text-center dark:bg-slate-950">
      <div className={cn(
        "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
        hasFailures
          ? "bg-orange-50 text-orange-600 dark:bg-orange-950/30"
          : isSuccess
            ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30"
            : "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
      )}>
        {state === "importing" ? <Loader2 className="h-6 w-6 animate-spin" /> : hasFailures ? <ShieldAlert className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        {isSuccess ? (hasFailures ? "Import selesai sebagian" : "Import aman selesai") : "Executor import aman siap"}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {blocked
          ? "Masih ada konflik blocking. Tahap ini tidak akan menyimpan data sebelum konflik diselesaikan."
          : "Executor hanya memproses operasi yang sudah resolved, memakai mekanisme simpan nilai existing, dan tidak menimpa nilai lama kecuali mode update mengizinkan."}
      </p>
      {state === "importing" ? (
        <div className="mx-auto mt-5 max-w-md text-left">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Progress</span>
            <span>{progress.current}/{progress.total}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
            <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>
      ) : null}
      </div>

      {summary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <MetricCard label="Berhasil" value={summary.successCount} tone="green" />
            <MetricCard label="Dilewati" value={summary.skippedCount} tone="orange" />
            <MetricCard label="Gagal" value={summary.failedCount} tone={summary.failedCount ? "red" : "info"} />
          </div>

          {summary.warnings.length ? (
            <RiskAlert title="Catatan executor aman" tone="warning">
              <ul className="space-y-1 text-left">
                {summary.warnings.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </RiskAlert>
          ) : null}

          {summary.failedRows.length ? (
            <section className="rounded-[24px] border border-red-200 bg-red-50 p-4 dark:border-red-900/60 dark:bg-red-950/20">
              <h4 className="text-sm font-semibold text-red-950 dark:text-red-100">Baris gagal disimpan</h4>
              <div className="mt-3 grid gap-2">
                {summary.failedRows.slice(0, 10).map((item) => (
                  <div key={item.operationId} className="rounded-2xl border border-red-200 bg-white p-3 text-sm dark:border-red-900/50 dark:bg-slate-950">
                    <p className="font-medium text-slate-950 dark:text-slate-50">{item.target}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Baris {item.rowIndex} / Kolom {item.columnIndex} / {item.message}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          {isSuccess ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <Button type="button" variant="outline" className="h-11 rounded-full" onClick={onBack}>
                Kembali
              </Button>
              <Button type="button" className="h-11 rounded-full bg-blue-600 hover:bg-blue-700" onClick={onDone}>
                Selesai
              </Button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export default function GradeImportExportDialog({
  open,
  onOpenChange,
  activeTab,
  onTabChange,
  classNameLabel,
  subjectName,
  semesterName,
  studentCount,
  chapterCount,
  assignmentCount,
  canDownloadOfficialTemplate = true,
  isDownloadingTemplate = false,
  onDownloadOfficialTemplate,
  isExportingCurrentGrades = false,
  isExportingBackup = false,
  onDownloadCurrentGrades,
  onDownloadBackup,
  onOpenLegacyImport,
  onSaveGrade,
  onImportComplete,
  importContext,
}: GradeImportExportDialogProps) {
  const { info, success, error: showError, warning: showWarning } = useEnhancedToast();
  const [tab, setTab] = useState<GradeImportExportTab>(activeTab);
  const [importMode, setImportMode] = useState<ImportMode>("official");
  const [exportMode, setExportMode] = useState<ExportMode>("official");
  const [fileName, setFileName] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [analysis, setAnalysis] = useState<ImportPlanInputAnalysis | null>(null);
  const [basePlan, setBasePlan] = useState<ImportPlan | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("fill_empty_only");
  const [resolverState, setResolverState] = useState<ImportResolverState>(emptyResolverState);
  const [executionState, setExecutionState] = useState<ImportExecutionState>("idle");
  const [executionSummary, setExecutionSummary] = useState<ImportExecutionSummary | null>(null);
  const [executionProgress, setExecutionProgress] = useState<ImportExecutionProgress>({ current: 0, total: 0 });
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [analysisErrorCode, setAnalysisErrorCode] = useState<ImportUiErrorCode | null>(null);

  useEffect(() => {
    if (open) setTab(activeTab);
  }, [activeTab, open]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setFileName(null);
      setAnalysis(null);
      setBasePlan(null);
      setPlan(null);
      setUpdateMode("fill_empty_only");
      setResolverState(emptyResolverState);
      setExecutionState("idle");
      setExecutionSummary(null);
      setExecutionProgress({ current: 0, total: 0 });
      setAnalysisError(null);
      setAnalysisErrorCode(null);
    }
  }, [open]);

  useEffect(() => {
    if (!analysis) return;
    const nextBasePlan = buildImportPlan(analysis, importContext, { updateMode });
    setBasePlan(nextBasePlan);
    setPlan(applyResolverToPlan(nextBasePlan, resolverState, importContext, updateMode));
  }, [analysis, importContext, resolverState, updateMode]);

  const contextLabel = useMemo(() => (
    [classNameLabel, subjectName, semesterName || "Semester aktif"].filter(Boolean).join(" / ")
  ), [classNameLabel, semesterName, subjectName]);

  const updateResolver = useCallback((updater: (current: ImportResolverState) => ImportResolverState) => {
    setResolverState((current) => updater(current));
  }, []);

  const resolverActions = useMemo<ConflictResolutionActions>(() => ({
    onUseCurrentStudent: (rowIndex, studentId) => updateResolver((current) => ({
      ...current,
      ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
      unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
      studentOverrides: { ...current.studentOverrides, [rowIndex]: studentId },
    })),
    onChooseStudent: (rowIndex, studentId) => updateResolver((current) => ({
      ...current,
      ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
      unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
      studentOverrides: { ...current.studentOverrides, [rowIndex]: studentId },
    })),
    onIgnoreRow: (rowIndex) => updateResolver((current) => {
      const { [rowIndex]: _removed, ...studentOverrides } = current.studentOverrides;
      return {
        ...current,
        ignoredRows: uniqueNumbersForState([...current.ignoredRows, rowIndex]),
        unresolvedRows: current.unresolvedRows.filter((item) => item !== rowIndex),
        studentOverrides,
      };
    }),
    onMarkRowUnresolved: (rowIndex) => updateResolver((current) => {
      const { [rowIndex]: _removed, ...studentOverrides } = current.studentOverrides;
      return {
        ...current,
        ignoredRows: current.ignoredRows.filter((item) => item !== rowIndex),
        unresolvedRows: uniqueNumbersForState([...current.unresolvedRows, rowIndex]),
        studentOverrides,
      };
    }),
    onUseExistingAssignment: (columnIndex, assignmentId) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: { kind: "existing_assignment", assignmentId },
      },
    })),
    onConfirmCreateAssignment: (columnIndex, chapterId, assignmentName) => updateResolver((current) => {
      const chapter = importContext.chapters.find((item) => item.id === chapterId);
      return {
        ...current,
        ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
        columnOverrides: {
          ...current.columnOverrides,
          [columnIndex]: {
            kind: "create_assignment",
            chapterId,
            chapterName: chapter?.name,
            assignmentName,
            confirmed: true,
          },
        },
      };
    }),
    onConfirmCreateChapterAndAssignment: (columnIndex, chapterName, assignmentName) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: {
          kind: "create_chapter_and_assignment",
          chapterName,
          assignmentName,
          confirmed: true,
        },
      },
    })),
    onSetSpecialColumn: (columnIndex, kind) => updateResolver((current) => ({
      ...current,
      ignoredColumns: current.ignoredColumns.filter((item) => item !== columnIndex),
      columnOverrides: {
        ...current.columnOverrides,
        [columnIndex]: { kind },
      },
    })),
    onIgnoreColumn: (columnIndex) => updateResolver((current) => ({
      ...current,
      ignoredColumns: uniqueNumbersForState([...current.ignoredColumns, columnIndex]),
      columnOverrides: Object.fromEntries(Object.entries(current.columnOverrides).filter(([key]) => Number(key) !== columnIndex)),
    })),
    onResolveConflict: (conflict) => updateResolver((current) => ({
      ...current,
      resolvedConflictKeys: uniqueStrings([...current.resolvedConflictKeys, conflictKey(conflict)]),
    })),
    onKeepDuplicateColumn: (conflict, keepColumnIndex) => updateResolver((current) => {
      const optionHeaders = new Set(conflict.options || []);
      const duplicateColumns = (plan?.columnMappings || [])
        .filter((mapping) => optionHeaders.has(mapping.rawHeader) && mapping.columnIndex !== keepColumnIndex)
        .map((mapping) => mapping.columnIndex);
      return {
        ...current,
        ignoredColumns: uniqueNumbersForState([...current.ignoredColumns, ...duplicateColumns]),
        resolvedConflictKeys: uniqueStrings([
          ...current.resolvedConflictKeys,
          ...(plan?.conflicts || [])
            .filter((item) => item.code === "IMPORT_DUPLICATE_COLUMN_TARGET" && (item.options || []).join("|") === (conflict.options || []).join("|"))
            .map(conflictKey),
        ]),
      };
    }),
    onBulkIgnoreDerived: () => updateResolver((current) => ({
      ...current,
      ignoredColumns: uniqueNumbersForState([
        ...current.ignoredColumns,
        ...(plan?.columnMappings || [])
          .filter((mapping) => mapping.parsedHeader.derived)
          .map((mapping) => mapping.columnIndex),
      ]),
    })),
    onBulkUseSafeMappings: () => updateResolver((current) => ({
      ...current,
      resolvedConflictKeys: uniqueStrings([
        ...current.resolvedConflictKeys,
        ...(plan?.conflicts || []).filter((item) => {
          if (!["student", "column", "structure"].includes(item.type)) return false;
          const student = item.rowIndex ? plan?.studentMappings.find((mapping) => mapping.rowIndex === item.rowIndex) : undefined;
          const column = item.columnIndex ? plan?.columnMappings.find((mapping) => mapping.columnIndex === item.columnIndex) : undefined;
          return Boolean(
            (student && ["safe", "warning"].includes(student.status))
            || (column && ["safe", "warning"].includes(column.status)),
          );
        }).map(conflictKey),
      ]),
    })),
    onBulkTrustStudentIdWarnings: () => updateResolver((current) => ({
      ...current,
      studentOverrides: {
        ...current.studentOverrides,
        ...Object.fromEntries((plan?.studentMappings || [])
          .filter((mapping) => mapping.matchedBy === "student_id" && mapping.status === "warning" && mapping.studentId)
          .map((mapping) => [String(mapping.rowIndex), mapping.studentId as string])),
      },
    })),
    onUpdateModeChange: setUpdateMode,
  }), [importContext.chapters, plan, updateResolver]);

  const hasPlan = Boolean(plan || basePlan);
  const blocked = hasBlockedConflicts(plan);
  const unsupported = plan?.sourceType === "unsupported";
  const canGoNext = useMemo(() => {
    if (stepIndex === 0) return hasPlan && !unsupported;
    if (stepIndex === 1) return hasPlan && !unsupported;
    if (stepIndex === 3) return hasPlan && !blocked;
    if (stepIndex >= importSteps.length - 1) return false;
    return hasPlan;
  }, [blocked, hasPlan, stepIndex, unsupported]);

  const handleTabChange = useCallback((value: string) => {
    const nextTab = value === "export" ? "export" : "import";
    setTab(nextTab);
    onTabChange(nextTab);
  }, [onTabChange]);

  const showPlaceholder = useCallback((title: string, description: string) => {
    info(title, description);
  }, [info]);

  const handleFileSelected = useCallback(async (file: File) => {
    setFileName(file.name);
    setStepIndex(0);
    setAnalysis(null);
    setBasePlan(null);
    setPlan(null);
    setResolverState(emptyResolverState);
    setAnalysisError(null);
    setAnalysisErrorCode(null);
    setExecutionSummary(null);
    setExecutionProgress({ current: 0, total: 0 });
    setExecutionState("analyzing");

    try {
      if (file.size > maxImportFileBytes) {
        const fileTooLarge = getImportErrorMessage("IMPORT_FILE_TOO_LARGE");
        setAnalysisError(fileTooLarge.message);
        setAnalysisErrorCode("IMPORT_FILE_TOO_LARGE");
        setExecutionState("failed");
        showError(fileTooLarge.title, fileTooLarge.message);
        return;
      }

      const workbook = await readWorkbookFile(file);
      if (!workbook.ok) {
        const readError = "error" in workbook ? workbook.error : { message: "Workbook tidak bisa dibaca." };
        const code = normalizeImportErrorCode("code" in readError ? readError.code : undefined);
        const displayError = getImportErrorMessage(code, readError.message);
        setAnalysisError(displayError.message);
        setAnalysisErrorCode(code);
        setExecutionState("failed");
        showError(displayError.title, displayError.message);
        return;
      }

      const officialAnalysis = analyzeOfficialTemplateWorkbook(workbook, {
        classId: importContext.classId,
        subjectId: importContext.subjectId,
        semesterId: importContext.semesterId,
        academicYearId: importContext.academicYearId,
      });
      const isOfficial = officialAnalysis.sourceType.startsWith("official_");
      const nextAnalysis = isOfficial ? officialAnalysis : analyzeFreeExcelWorkbook(workbook);
      const nextPlan = buildImportPlan(nextAnalysis, importContext, { updateMode });

      setAnalysis(nextAnalysis);
      setBasePlan(nextPlan);
      setPlan(applyResolverToPlan(nextPlan, emptyResolverState, importContext, updateMode));
      setImportMode(isOfficial ? "official" : "smart");
      setStepIndex(1);
      setExecutionState("ready");
      setAnalysisErrorCode(null);
      success("ImportPlan siap", "File sudah dianalisis sebagai preview. Belum ada data yang disimpan.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "File gagal dianalisis.";
      setAnalysisError(message);
      setAnalysisErrorCode("IMPORT_WORKBOOK_READ_FAILED");
      setExecutionState("failed");
      showError("IMPORT_WORKBOOK_READ_FAILED", message);
    }
  }, [importContext, showError, success, updateMode]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePrimaryAction = useCallback(async () => {
    if (tab === "import") {
      if (stepIndex === 5) {
        if (executionState === "success") {
          handleClose();
          return;
        }

        if (blocked) {
          showWarning("Import diblokir", "Konflik blocking harus diselesaikan sebelum executor import diaktifkan.");
          return;
        }
        if (!plan) {
          showWarning("ImportPlan belum siap", "Upload dan selesaikan preview import sebelum menjalankan executor.");
          return;
        }

        setExecutionState("importing");
        setExecutionSummary(null);
        setExecutionProgress({ current: 0, total: 0 });

        try {
          const selectedOverwriteColumns = new Set(Object.keys(resolverState.columnOverrides).map(Number));
          const summary = await executeClientSideImport({
            plan,
            onSaveGrade,
            selectedOverwriteColumns,
            onProgress: setExecutionProgress,
          });
          setExecutionSummary(summary);
          setExecutionState("success");
          if (summary.successCount > 0) {
            await onImportComplete?.();
          }
          if (summary.failedCount > 0) {
            showWarning("Import selesai sebagian", `${summary.successCount} nilai tersimpan, ${summary.failedCount} gagal, ${summary.skippedCount} dilewati.`);
          } else {
            success("Import aman selesai", `${summary.successCount} nilai tersimpan, ${summary.skippedCount} dilewati.`);
          }
        } catch (caught) {
          setExecutionState("failed");
          showError("Import gagal", caught instanceof Error ? caught.message : "Executor import berhenti sebelum selesai.");
        }
        return;
      }

      if (!canGoNext) {
        showWarning(
          stepIndex === 3 ? "Konflik belum resolved" : "ImportPlan belum siap",
          stepIndex === 3
            ? "Import tidak bisa lanjut selama masih ada konflik blocking."
            : "Upload file yang valid dulu untuk membuat preview import.",
        );
        return;
      }

      setStepIndex((current) => Math.min(current + 1, importSteps.length - 1));
      return;
    }

    if (exportMode === "official" && onDownloadOfficialTemplate) {
      await onDownloadOfficialTemplate();
      return;
    }
    if (exportMode === "current" && onDownloadCurrentGrades) {
      await onDownloadCurrentGrades();
      return;
    }
    if (exportMode === "backup" && onDownloadBackup) {
      await onDownloadBackup();
      return;
    }

    showPlaceholder(
      exportMode === "current" ? "Export nilai saat ini belum dijalankan" : "Backup lengkap belum dijalankan",
      "Pilih kelas dan mata pelajaran yang valid sebelum membuat workbook export.",
    );
  }, [
    blocked,
    canGoNext,
    executionState,
    exportMode,
    handleClose,
    onDownloadOfficialTemplate,
    onDownloadBackup,
    onDownloadCurrentGrades,
    onImportComplete,
    onSaveGrade,
    plan,
    resolverState.columnOverrides,
    showError,
    showPlaceholder,
    showWarning,
    stepIndex,
    success,
    tab,
  ]);

  const handleBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const modeLabel = exportMode === "official"
    ? "Template Resmi SIPENA"
    : exportMode === "current"
      ? "Export Nilai Saat Ini"
      : "Backup Lengkap";
  const backupIncompleteWarning = exportMode === "backup" && (
    !importContext.classId
    || !importContext.subjectId
    || !importContext.academicYearId
    || studentCount === 0
    || chapterCount === 0
    || assignmentCount === 0
  )
    ? "Sebagian data belum tersedia untuk export lengkap."
    : null;
  const exportActionLoading = exportMode === "official"
    ? isDownloadingTemplate
    : exportMode === "current"
      ? isExportingCurrentGrades
      : isExportingBackup;

  const primaryLabel = useMemo(() => {
    if (tab === "export") {
      if (exportActionLoading) return "Menyiapkan...";
      if (exportMode === "official") return "Download Template Resmi";
      if (exportMode === "current") return "Download Export Nilai";
      return "Download Backup";
    }
    if (stepIndex === 0) return executionState === "analyzing" ? "Menganalisis..." : "Upload File Dulu";
    if (stepIndex === 5 && executionState === "success") return "Selesai";
    if (stepIndex === 5) return executionState === "importing" ? "Memproses..." : "Mulai Import Aman";
    return "Lanjut";
  }, [executionState, exportActionLoading, exportMode, stepIndex, tab]);
  const importPrimaryDisabled = tab === "import" && (
    executionState === "analyzing"
    || executionState === "importing"
    || (stepIndex > 0 && stepIndex < 5 && !canGoNext)
    || (stepIndex === 5 && blocked)
  );
  const exportPrimaryDisabled = tab === "export" && (
    exportActionLoading
    || (exportMode === "official" && (!canDownloadOfficialTemplate || !onDownloadOfficialTemplate))
    || (exportMode === "current" && !onDownloadCurrentGrades)
    || (exportMode === "backup" && !onDownloadBackup)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-0.5rem)] max-h-[860px] w-[calc(100vw-0.5rem)] max-w-[1120px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[24px] border-white/80 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(92dvh,860px)] sm:w-[calc(100vw-2rem)]">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95 sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-start gap-3 pr-10">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/70 sm:h-12 sm:w-12">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-base font-semibold tracking-normal text-slate-950 dark:text-slate-50 sm:text-lg">
                  Export/Import Nilai SIPENA
                </DialogTitle>
                <StatusBadge tone="safe">Mode aman aktif</StatusBadge>
              </div>
              <DialogDescription className="mt-1 max-w-full truncate text-sm text-muted-foreground" title={contextLabel || undefined}>
                {contextLabel || "Pilih kelas, mapel, dan semester terlebih dahulu"}
              </DialogDescription>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border bg-white px-4 py-3 dark:bg-slate-950 sm:px-6">
            <TabsList aria-label="Mode export dan import nilai" className="grid h-11 w-full max-w-md grid-cols-2 rounded-full bg-slate-100 p-1 dark:bg-slate-900">
              <TabsTrigger value="import" className="h-9 rounded-full text-xs sm:text-sm">
                Import Nilai
              </TabsTrigger>
              <TabsTrigger value="export" className="h-9 rounded-full text-xs sm:text-sm">
                Export Nilai
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overscroll-contain overflow-y-auto overflow-x-hidden bg-slate-50/70 px-4 py-4 dark:bg-slate-950 sm:px-6">
            <TabsContent value="import" className="m-0 min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                <main className="min-w-0 space-y-4">
                  <section className="min-w-0 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
                    <ImportStepper steps={importSteps} currentIndex={stepIndex} />
                  </section>

                  {stepIndex === 0 ? (
                    <>
                      <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        <ImportModeCard
                          title="Template Resmi SIPENA"
                          description="Gunakan template dari struktur web aktif untuk import paling terarah."
                          details={["Siswa dan NISN mengikuti data web", "Cocok untuk BAB, tugas, STS, dan SAS", "Sel kosong tidak menghapus nilai lama"]}
                          selected={importMode === "official"}
                          tone="official"
                          icon={<FileSpreadsheet className="h-5 w-5" />}
                          onClick={() => setImportMode("official")}
                        />
                        <ImportModeCard
                          title="Smart Import"
                          description="Untuk Excel bebas yang perlu dianalisis dan dipetakan dulu."
                          details={["Mapping ambigu wajib dikonfirmasi", "Tidak membuat BAB/tugas tanpa persetujuan", "Tidak menyimpan otomatis setelah upload"]}
                          selected={importMode === "smart"}
                          tone="smart"
                          icon={<Bot className="h-5 w-5" />}
                          onClick={() => setImportMode("smart")}
                        />
                      </div>

                      <ImportDropzone fileName={fileName} onFileSelected={handleFileSelected} />

                      {executionState === "analyzing" ? (
                        <RiskAlert title="File sedang dianalisis" tone="info">
                          SIPENA membaca workbook, mendeteksi template resmi atau Smart Import, lalu membuat ImportPlan preview.
                        </RiskAlert>
                      ) : null}

                      {analysisError ? (
                        <RiskAlert title={getImportErrorMessage(analysisErrorCode, analysisError).title} tone="blocked">
                          {analysisError}
                        </RiskAlert>
                      ) : null}

                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                        {studentCount === 0 ? (
                          <RiskAlert title="Belum ada siswa" tone="warning">
                            Tambahkan siswa pada kelas aktif sebelum import nilai agar mapping siswa bisa dibuat.
                          </RiskAlert>
                        ) : null}
                        {chapterCount === 0 || assignmentCount === 0 ? (
                          <RiskAlert title="Belum ada BAB/tugas" tone="warning">
                            Tambahkan BAB dan tugas, atau konfirmasi struktur baru di step Konflik sebelum import.
                          </RiskAlert>
                        ) : null}
                        {importMode === "smart" ? (
                          <RiskAlert title="AI tidak tersedia" tone="info">
                            Smart Import tahap ini memakai analyzer workbook lokal. Data ambigu tetap perlu dipilih manual.
                          </RiskAlert>
                        ) : null}
                        <RiskAlert title="Data tidak akan ditimpa tanpa konfirmasi" tone="safe">
                          Default import adalah isi nilai kosong saja. Nilai lama akan muncul sebagai konflik sebelum tahap simpan.
                        </RiskAlert>
                        <RiskAlert title="BAB dan tugas baru butuh persetujuan" tone="warning">
                          Header baru hanya menjadi kandidat. Sistem tidak membuat struktur baru secara otomatis.
                        </RiskAlert>
                      </div>
                    </>
                  ) : null}

                  {stepIndex === 1 ? <AnalysisStep plan={plan} /> : null}
                  {stepIndex === 2 ? <MappingStep plan={plan} /> : null}
                  {stepIndex === 3 ? <ConflictStep plan={plan} context={importContext} actions={resolverActions} /> : null}
                  {stepIndex === 4 ? <PreviewStep plan={plan} updateMode={updateMode} onUpdateModeChange={setUpdateMode} /> : null}
                  {stepIndex === 5 ? (
                    <ImportStep
                      state={executionState}
                      plan={plan}
                      summary={executionSummary}
                      progress={executionProgress}
                      onDone={handleClose}
                      onBack={handleBack}
                    />
                  ) : null}
                </main>

                <ImportSummaryPanel
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  fileName={fileName}
                  plan={plan}
                  currentStep={importSteps[stepIndex]}
                />
              </div>
            </TabsContent>

            <TabsContent value="export" className="m-0 min-w-0 focus-visible:ring-0 focus-visible:ring-offset-0">
              <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <main className="min-w-0 space-y-3">
                  <ExportOptionCard
                    title="Template Resmi SIPENA"
                    description="Workbook kosong berbasis struktur kelas, mapel, semester, siswa, BAB, dan tugas aktif."
                    meta="Paling aman untuk input nilai baru"
                    selected={exportMode === "official"}
                    tone="official"
                    icon={<FileSpreadsheet className="h-5 w-5" />}
                    onClick={() => setExportMode("official")}
                  />
                  <ExportOptionCard
                    title="Export Nilai Saat Ini"
                    description="Membawa nilai yang sedang tersimpan agar guru dapat mengecek atau melengkapi data."
                    meta="Sheet Panduan dan Nilai"
                    selected={exportMode === "current"}
                    tone="current"
                    icon={<Download className="h-5 w-5" />}
                    onClick={() => setExportMode("current")}
                  />
                  <ExportOptionCard
                    title="Backup Lengkap"
                    description="Paket workbook untuk arsip kelas dan mapel aktif sebelum perubahan besar."
                    meta="Disarankan sebelum import massal"
                    selected={exportMode === "backup"}
                    tone="backup"
                    icon={<Archive className="h-5 w-5" />}
                    onClick={() => setExportMode("backup")}
                  />

                  {backupIncompleteWarning ? (
                    <RiskAlert title="Export lengkap belum membawa semua konteks" tone="warning">
                      {backupIncompleteWarning} Workbook tetap akan dibuat dari siswa, struktur, dan nilai yang tersedia saat ini.
                    </RiskAlert>
                  ) : (
                    <RiskAlert title="Export aman aktif" tone="safe">
                      Nilai kosong tetap kosong. Export tidak mengubah nilai di Input Nilai dan tidak menyimpan data baru.
                    </RiskAlert>
                  )}
                </main>

                <WorkbookPreviewPanel
                  classNameLabel={classNameLabel}
                  subjectName={subjectName}
                  semesterName={semesterName}
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  modeLabel={modeLabel}
                  sheetNames={exportSheetsByMode[exportMode]}
                  warning={backupIncompleteWarning}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <footer className="sticky bottom-0 z-20 shrink-0 border-t border-border bg-white/95 px-4 py-3 backdrop-blur dark:bg-slate-950/95 sm:px-6">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="hidden min-w-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
              <ShieldCheck className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="truncate">Data tidak akan ditimpa tanpa konfirmasi.</span>
            </div>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {tab === "import" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full rounded-full sm:min-h-10 sm:w-auto"
                  onClick={handleBack}
                >
                  Kembali
                </Button>
              ) : null}
              {tab === "import" && stepIndex === 0 && onOpenLegacyImport ? (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11 w-full rounded-full sm:min-h-10 sm:w-auto"
                  onClick={onOpenLegacyImport}
                >
                  Import lama
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full rounded-full sm:min-h-10 sm:w-auto"
                onClick={handleClose}
              >
                Tutup
              </Button>
              <Button
                type="button"
                disabled={
                  exportPrimaryDisabled
                  || importPrimaryDisabled
                }
                className={cn(
                  "min-h-11 w-full min-w-0 gap-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:min-h-10 sm:w-auto",
                  tab === "import" && importMode === "smart" && "bg-violet-600 hover:bg-violet-700",
                )}
                onClick={handlePrimaryAction}
              >
                {tab === "import" ? (
                  <>
                    {executionState === "analyzing" || executionState === "importing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                ) : exportMode === "official" ? (
                  <>
                    {exportActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                ) : (
                  <>
                    {exportActionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {primaryLabel}
                  </>
                )}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

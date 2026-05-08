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
  onOpenLegacyImport?: () => void;
  importContext: ImportPlanContext;
}

type ImportMode = "official" | "smart";
type ExportMode = "official" | "current" | "backup";
type ImportExecutionState = "idle" | "analyzing" | "ready" | "failed" | "importing" | "success";

const importSteps = ["Upload", "Analisis", "Pemetaan", "Konflik", "Preview", "Import"];

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

      <div className="space-y-2">
        {getTopWarnings(plan).length ? getTopWarnings(plan).map((item, index) => (
          <RiskAlert key={`${item.code}-${index}`} title={item.code} tone="warning">
            {item.message}
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
  return (
    <div className="rounded-2xl border border-border bg-white p-3 dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">
            {mapping.excelName || mapping.excelNisn || `Baris ${mapping.rowIndex}`}
          </p>
          <p className="mt-1 truncate text-xs text-muted-foreground">
            Web: {mapping.webName || "Belum cocok"} {mapping.webNisn ? `(${mapping.webNisn})` : ""}
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
          <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{mapping.rawHeader || `Kolom ${mapping.columnIndex}`}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">Target: {target || "Belum dipetakan"}</p>
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
          {plan.studentMappings.slice(0, 24).map((mapping) => <StudentMappingCard key={mapping.rowIndex} mapping={mapping} />)}
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
                  <td className="px-4 py-3">{mapping.excelName || "-"}<span className="block text-xs text-muted-foreground">{mapping.excelNisn || ""}</span></td>
                  <td className="px-4 py-3">{mapping.webName || "-"}<span className="block text-xs text-muted-foreground">{mapping.webNisn || ""}</span></td>
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
          {plan.columnMappings.filter((mapping) => !mapping.parsedHeader.reserved && !mapping.parsedHeader.derived).map((mapping) => (
            <ColumnMappingCard key={mapping.columnIndex} mapping={mapping} />
          ))}
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
                    <td className="px-4 py-3">{mapping.rawHeader}</td>
                    <td className="px-4 py-3">{target || "-"}</td>
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

function ConflictStep({ plan }: { plan: ImportPlan | null }) {
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
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.code}</p>
                    <p className="mt-1 text-xs leading-5 opacity-85">{item.message}</p>
                    <p className="mt-1 text-xs opacity-70">
                      {item.rowIndex ? `Baris ${item.rowIndex}` : ""} {item.columnIndex ? `Kolom ${item.columnIndex}` : ""}
                    </p>
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

  return (
    <div className="space-y-4">
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
                  <p className="truncate text-sm font-semibold text-slate-950 dark:text-slate-50">{targetLabel(operation)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
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

function ImportStep({ state, plan }: { state: ImportExecutionState; plan: ImportPlan | null }) {
  const blocked = hasBlockedConflicts(plan);
  const isSuccess = state === "success";
  return (
    <div className="rounded-[24px] border border-border bg-white p-6 text-center dark:bg-slate-950">
      <div className={cn(
        "mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl",
        isSuccess ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
      )}>
        {state === "importing" ? <Loader2 className="h-6 w-6 animate-spin" /> : <CheckCircle2 className="h-6 w-6" />}
      </div>
      <h3 className="text-base font-semibold text-slate-950 dark:text-slate-50">
        {isSuccess ? "Preview import selesai" : "Executor import belum diaktifkan"}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
        {blocked
          ? "Masih ada konflik blocking. Tahap ini tidak akan menyimpan data sebelum konflik diselesaikan."
          : "Tahap ini hanya menampilkan progress aman. Penyimpanan final, RPC batch, dan conflict resolver akan masuk tahap berikutnya."}
      </p>
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
  onOpenLegacyImport,
  importContext,
}: GradeImportExportDialogProps) {
  const { info, success, error: showError, warning: showWarning } = useEnhancedToast();
  const [tab, setTab] = useState<GradeImportExportTab>(activeTab);
  const [importMode, setImportMode] = useState<ImportMode>("official");
  const [exportMode, setExportMode] = useState<ExportMode>("official");
  const [fileName, setFileName] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [analysis, setAnalysis] = useState<ImportPlanInputAnalysis | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [updateMode, setUpdateMode] = useState<UpdateMode>("fill_empty_only");
  const [executionState, setExecutionState] = useState<ImportExecutionState>("idle");
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setTab(activeTab);
  }, [activeTab, open]);

  useEffect(() => {
    if (!open) {
      setStepIndex(0);
      setFileName(null);
      setAnalysis(null);
      setPlan(null);
      setUpdateMode("fill_empty_only");
      setExecutionState("idle");
      setAnalysisError(null);
    }
  }, [open]);

  useEffect(() => {
    if (!analysis) return;
    setPlan(buildImportPlan(analysis, importContext, { updateMode }));
  }, [analysis, importContext, updateMode]);

  const contextLabel = useMemo(() => (
    [classNameLabel, subjectName, semesterName || "Semester aktif"].filter(Boolean).join(" / ")
  ), [classNameLabel, semesterName, subjectName]);

  const hasPlan = Boolean(plan);
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
    setPlan(null);
    setAnalysisError(null);
    setExecutionState("analyzing");

    try {
      const workbook = await readWorkbookFile(file);
      if (!workbook.ok) {
        const readError = "error" in workbook ? workbook.error : { message: "Workbook tidak bisa dibaca." };
        setAnalysisError(readError.message);
        setExecutionState("failed");
        showError("File gagal dibaca", readError.message);
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
      setPlan(nextPlan);
      setImportMode(isOfficial ? "official" : "smart");
      setStepIndex(1);
      setExecutionState("ready");
      success("ImportPlan siap", "File sudah dianalisis sebagai preview. Belum ada data yang disimpan.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "File gagal dianalisis.";
      setAnalysisError(message);
      setExecutionState("failed");
      showError("Analisis gagal", message);
    }
  }, [importContext, showError, success, updateMode]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  const handlePrimaryAction = useCallback(async () => {
    if (tab === "import") {
      if (stepIndex === 5) {
        if (blocked) {
          showWarning("Import diblokir", "Konflik blocking harus diselesaikan sebelum executor import diaktifkan.");
          return;
        }
        setExecutionState("importing");
        window.setTimeout(() => {
          setExecutionState("success");
          success("Preview import selesai", "Executor penyimpanan belum dijalankan pada tahap ini.");
        }, 500);
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

    showPlaceholder(
      exportMode === "current" ? "Export nilai saat ini belum dijalankan" : "Backup lengkap belum dijalankan",
      "Tahap berikutnya akan menambahkan export nilai terisi dan backup lengkap tanpa mengganggu input nilai manual.",
    );
  }, [blocked, canGoNext, exportMode, onDownloadOfficialTemplate, showPlaceholder, showWarning, stepIndex, success, tab]);

  const handleBack = useCallback(() => {
    setStepIndex((current) => Math.max(0, current - 1));
  }, []);

  const modeLabel = exportMode === "official"
    ? "Template Resmi SIPENA"
    : exportMode === "current"
      ? "Export Nilai Saat Ini"
      : "Backup Lengkap";

  const primaryLabel = useMemo(() => {
    if (tab === "export") return exportMode === "official" ? (isDownloadingTemplate ? "Menyiapkan..." : "Download Template Resmi") : "Siapkan Export";
    if (stepIndex === 0) return executionState === "analyzing" ? "Menganalisis..." : "Upload File Dulu";
    if (stepIndex === 5) return executionState === "importing" ? "Memproses..." : "Mulai Import Aman";
    return "Lanjut";
  }, [executionState, exportMode, isDownloadingTemplate, stepIndex, tab]);
  const importPrimaryDisabled = tab === "import" && (
    executionState === "analyzing"
    || executionState === "importing"
    || (stepIndex > 0 && stepIndex < 5 && !canGoNext)
    || (stepIndex === 5 && blocked)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[calc(100dvh-1rem)] max-h-[860px] w-[calc(100vw-1rem)] max-w-[1120px] grid-rows-none flex-col gap-0 overflow-hidden rounded-[24px] border-white/80 bg-white p-0 shadow-2xl dark:border-slate-800 dark:bg-slate-950 sm:h-[min(92dvh,860px)] sm:w-[calc(100vw-2rem)]">
        <header className="sticky top-0 z-20 shrink-0 border-b border-border bg-white/95 px-4 py-4 backdrop-blur dark:bg-slate-950/95 sm:px-6">
          <div className="flex min-w-0 items-start gap-3 pr-8">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/70">
              <FileSpreadsheet className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-lg font-semibold tracking-normal text-slate-950 dark:text-slate-50">
                  Export/Import Nilai SIPENA
                </DialogTitle>
                <StatusBadge tone="safe">Mode aman aktif</StatusBadge>
              </div>
              <DialogDescription className="mt-1 truncate text-sm text-muted-foreground">
                {contextLabel || "Pilih kelas, mapel, dan semester terlebih dahulu"}
              </DialogDescription>
            </div>
          </div>
        </header>

        <Tabs value={tab} onValueChange={handleTabChange} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b border-border bg-white px-4 py-3 dark:bg-slate-950 sm:px-6">
            <TabsList className="grid h-11 w-full max-w-md grid-cols-2 rounded-full bg-slate-100 p-1 dark:bg-slate-900">
              <TabsTrigger value="import" className="h-9 rounded-full text-xs sm:text-sm">
                Import Nilai
              </TabsTrigger>
              <TabsTrigger value="export" className="h-9 rounded-full text-xs sm:text-sm">
                Export Nilai
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/70 px-4 py-4 dark:bg-slate-950 sm:px-6">
            <TabsContent value="import" className="m-0 min-w-0">
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
                        <RiskAlert title="Analisis gagal" tone="blocked">
                          {analysisError}
                        </RiskAlert>
                      ) : null}

                      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
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
                  {stepIndex === 3 ? <ConflictStep plan={plan} /> : null}
                  {stepIndex === 4 ? <PreviewStep plan={plan} updateMode={updateMode} onUpdateModeChange={setUpdateMode} /> : null}
                  {stepIndex === 5 ? <ImportStep state={executionState} plan={plan} /> : null}
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

            <TabsContent value="export" className="m-0 min-w-0">
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
                    meta="Termasuk STS dan SAS"
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

                  <RiskAlert title="Export tahap ini masih placeholder" tone="info">
                    Template Resmi SIPENA sudah dapat diunduh. Export nilai saat ini dan backup lengkap akan masuk tahap berikutnya.
                  </RiskAlert>
                </main>

                <WorkbookPreviewPanel
                  classNameLabel={classNameLabel}
                  subjectName={subjectName}
                  semesterName={semesterName}
                  studentCount={studentCount}
                  chapterCount={chapterCount}
                  assignmentCount={assignmentCount}
                  modeLabel={modeLabel}
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
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              {tab === "import" && stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                  onClick={handleBack}
                >
                  Kembali
                </Button>
              ) : null}
              {tab === "import" && stepIndex === 0 && onOpenLegacyImport ? (
                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                  onClick={onOpenLegacyImport}
                >
                  Import lama
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-full sm:h-10 sm:w-auto"
                onClick={handleClose}
              >
                Tutup
              </Button>
              <Button
                type="button"
                disabled={
                  (tab === "export" && exportMode === "official" && (!canDownloadOfficialTemplate || isDownloadingTemplate))
                  || importPrimaryDisabled
                }
                className={cn(
                  "h-11 w-full gap-2 rounded-full bg-blue-600 text-white hover:bg-blue-700 sm:h-10 sm:w-auto",
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
                    <Download className="h-4 w-4" />
                    {primaryLabel}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
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

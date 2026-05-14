import { BarChart3, CheckCircle2, FileWarning, Users } from "lucide-react";

import type { ImportPlan } from "@/lib/gradeImport";

import { StatusBadge } from "./StatusBadge";

interface ImportSummaryPanelProps {
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  fileName?: string | null;
  plan?: ImportPlan | null;
  currentStep?: string;
  readyImportCount?: number;
  needsCheckCount?: number;
  blockedCount?: number;
  skippedCount?: number;
}

const metrics = [
  { key: "students", label: "Siswa", icon: Users },
  { key: "chapters", label: "BAB", icon: BarChart3 },
  { key: "assignments", label: "Tugas", icon: CheckCircle2 },
] as const;

export function ImportSummaryPanel({
  studentCount,
  chapterCount,
  assignmentCount,
  fileName,
  plan,
  currentStep,
  readyImportCount,
  needsCheckCount,
  blockedCount,
  skippedCount,
}: ImportSummaryPanelProps) {
  const values = {
    students: studentCount,
    chapters: chapterCount,
    assignments: assignmentCount,
  };
  const planBlockedCount = plan?.conflicts.filter((item) => item.severity === "blocked").length || 0;
  const missingInExcelCount = plan?.missingInExcelStudents.length || 0;
  const importMetrics = [
    { label: "Siap import", value: readyImportCount ?? plan?.summary.readyImportCount ?? 0, tone: "text-emerald-700 dark:text-emerald-300" },
    { label: "Perlu dicek", value: needsCheckCount ?? plan?.summary.needsConfirmation ?? 0, tone: "text-orange-700 dark:text-orange-300" },
    { label: "Diblokir", value: blockedCount ?? planBlockedCount, tone: "text-red-700 dark:text-red-300" },
    { label: "Dilewati", value: skippedCount ?? plan?.summary.skippedValueCount ?? 0, tone: "text-slate-700 dark:text-slate-200" },
  ];

  return (
    <aside className="min-w-0 space-y-3 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950 lg:sticky lg:top-4 lg:max-h-[calc(92dvh-12rem)] lg:overflow-y-auto">
      <div className="space-y-2">
        <StatusBadge tone="info" description="Ringkasan singkat dari file dan tahap import aktif.">Ringkasan</StatusBadge>
        <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Ringkasan import</h3>
        <p className="text-xs leading-5 text-muted-foreground">
          {currentStep ? `Langkah: ${currentStep}. ` : ""}Angka ini hanya ringkasan, bukan tombol aksi.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {importMetrics.map((metric) => (
          <div key={metric.label} className="rounded-2xl border border-border bg-slate-50 p-3 dark:bg-slate-900/60">
            <p className="truncate text-[11px] font-medium text-muted-foreground">{metric.label}</p>
            <p className={`mt-1 text-lg font-semibold ${metric.tone}`}>{metric.value}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 lg:grid-cols-1">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.key} className="rounded-2xl border border-border bg-slate-50 p-3 dark:bg-slate-900/60">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate text-[11px] font-medium">{metric.label}</span>
              </div>
              <p className="mt-2 text-lg font-semibold text-slate-950 dark:text-slate-50">{values[metric.key]}</p>
            </div>
          );
        })}
      </div>
      <div className="rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/25 dark:text-orange-100">
        <div className="flex gap-2">
          <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-xs leading-5">
            {plan
              ? `${readyImportCount ?? plan.summary.readyImportCount ?? 0} nilai siap import, ${blockedCount ?? planBlockedCount} item diblokir.`
              : fileName ? "File sudah siap dianalisis sebagai preview." : "Upload file untuk melihat rencana import."}
            {missingInExcelCount > 0 ? ` ${missingInExcelCount} siswa di web tidak ada di Excel; nilainya tidak akan berubah.` : ""}
          </p>
        </div>
      </div>
    </aside>
  );
}

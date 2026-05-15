import { FileSpreadsheet, Table2 } from "lucide-react";

import { StatusBadge } from "./StatusBadge";

interface WorkbookPreviewPanelProps {
  classNameLabel: string;
  subjectName: string;
  semesterName?: string | null;
  studentCount: number;
  chapterCount: number;
  assignmentCount: number;
  modeLabel: string;
  sheetNames: string[];
  warning?: string | null;
}

export function WorkbookPreviewPanel({
  classNameLabel,
  subjectName,
  semesterName,
  studentCount,
  chapterCount,
  assignmentCount,
  modeLabel,
  sheetNames,
  warning,
}: WorkbookPreviewPanelProps) {
  const contextRows = [
    ["Kelas", classNameLabel || "-"],
    ["Mapel", subjectName || "-"],
    ["Semester", semesterName || "Aktif"],
  ];

  return (
    <section className="min-w-0 rounded-[20px] border border-slate-300 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950 xl:sticky xl:top-3">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge tone="info" description="Mode file export yang akan dibuat.">{modeLabel}</StatusBadge>
          <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">Preview workbook</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Struktur mengikuti kelas, mapel, dan semester yang sedang dipilih.
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100 dark:bg-blue-950/30 dark:ring-blue-900/60">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
      </div>

      <dl className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-slate-50/70 text-xs dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900/40">
        {contextRows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 px-3 py-2.5">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="truncate font-semibold text-slate-950 dark:text-slate-50" title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      <details className="mt-4 rounded-2xl border border-slate-300 dark:border-slate-800">
        <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground">
          <Table2 className="h-4 w-4" />
          Sheet workbook
        </summary>
        <div className="grid gap-2 border-t border-slate-200 p-3 dark:border-slate-800 sm:grid-cols-2">
          {sheetNames.map((sheet) => (
            <div key={sheet} className="truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              {sheet}
            </div>
          ))}
        </div>
      </details>

      {warning ? (
        <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-xs leading-5 text-orange-950 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-100">
          {warning}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 overflow-hidden rounded-2xl border border-slate-300 dark:divide-slate-800 dark:border-slate-800">
        <PreviewMetric label="Siswa" value={studentCount} />
        <PreviewMetric label="BAB" value={chapterCount} />
        <PreviewMetric label="Kolom nilai" value={assignmentCount + 2} />
      </div>
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="p-3 text-center">
      <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

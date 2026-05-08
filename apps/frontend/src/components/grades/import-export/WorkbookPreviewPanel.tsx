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
}

const sheets = ["Panduan", "Isi_Nilai", "_manifest", "_students", "_structure", "_column_map"];

export function WorkbookPreviewPanel({
  classNameLabel,
  subjectName,
  semesterName,
  studentCount,
  chapterCount,
  assignmentCount,
  modeLabel,
}: WorkbookPreviewPanelProps) {
  return (
    <section className="min-w-0 rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <StatusBadge tone="success">{modeLabel}</StatusBadge>
          <h3 className="mt-3 text-sm font-semibold text-slate-950 dark:text-slate-50">Workbook Preview</h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Struktur mengikuti kelas, mapel, dan semester yang sedang dipilih.
          </p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100 dark:bg-emerald-950/30 dark:ring-emerald-900/60">
          <FileSpreadsheet className="h-6 w-6" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
          <p className="text-muted-foreground">Kelas</p>
          <p className="mt-1 truncate font-semibold text-slate-950 dark:text-slate-50">{classNameLabel || "-"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
          <p className="text-muted-foreground">Mapel</p>
          <p className="mt-1 truncate font-semibold text-slate-950 dark:text-slate-50">{subjectName || "-"}</p>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/60">
          <p className="text-muted-foreground">Semester</p>
          <p className="mt-1 truncate font-semibold text-slate-950 dark:text-slate-50">{semesterName || "Aktif"}</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
          <Table2 className="h-4 w-4" />
          Sheet workbook
        </div>
        <div className="grid gap-2 p-3 sm:grid-cols-2">
          {sheets.map((sheet) => (
            <div key={sheet} className="truncate rounded-xl bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
              {sheet}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        <PreviewMetric label="Siswa" value={studentCount} />
        <PreviewMetric label="BAB" value={chapterCount} />
        <PreviewMetric label="Kolom nilai" value={assignmentCount + 2} />
      </div>
    </section>
  );
}

function PreviewMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border p-3 text-center">
      <p className="text-lg font-semibold text-slate-950 dark:text-slate-50">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

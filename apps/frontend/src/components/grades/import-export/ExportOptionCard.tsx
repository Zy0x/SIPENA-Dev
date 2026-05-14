import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface ExportOptionCardProps {
  title: string;
  description: string;
  meta: string;
  selected: boolean;
  tone: "official" | "current" | "backup";
  icon: ReactNode;
  onClick: () => void;
}

const toneClass: Record<ExportOptionCardProps["tone"], string> = {
  official: "border-blue-200 bg-blue-50/45 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200",
  current: "border-indigo-200 bg-indigo-50/45 text-indigo-700 dark:border-indigo-900/60 dark:bg-indigo-950/20 dark:text-indigo-200",
  backup: "border-amber-200 bg-amber-50/45 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-200",
};

export function ExportOptionCard({ title, description, meta, selected, tone, icon, onClick }: ExportOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-[112px] min-w-0 gap-3 rounded-[18px] border bg-white p-3 text-left shadow-sm transition hover:border-indigo-200 hover:shadow-md dark:bg-slate-950",
        selected ? "border-indigo-300 ring-2 ring-indigo-100 dark:border-indigo-700 dark:ring-indigo-950" : "border-slate-300 dark:border-slate-800",
      )}
    >
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border", toneClass[tone])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</p>
          {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600" /> : null}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">{description}</p>
        <p className="text-xs font-medium text-muted-foreground">{meta}</p>
      </div>
    </button>
  );
}

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
  official: "border-emerald-200 bg-emerald-50/45 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
  current: "border-blue-200 bg-blue-50/45 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/20 dark:text-blue-200",
  backup: "border-orange-200 bg-orange-50/45 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/20 dark:text-orange-200",
};

export function ExportOptionCard({ title, description, meta, selected, tone, icon, onClick }: ExportOptionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 gap-3 rounded-[24px] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950",
        selected ? "border-blue-300 ring-2 ring-blue-100 dark:border-blue-700 dark:ring-blue-950" : "border-border",
      )}
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", toneClass[tone])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</p>
          {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" /> : null}
        </div>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <p className="text-xs font-medium text-muted-foreground">{meta}</p>
      </div>
    </button>
  );
}

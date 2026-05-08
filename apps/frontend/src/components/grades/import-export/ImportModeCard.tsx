import { CheckCircle2 } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ImportModeTone = "official" | "smart";

interface ImportModeCardProps {
  title: string;
  description: string;
  details: string[];
  selected: boolean;
  tone: ImportModeTone;
  icon: ReactNode;
  onClick: () => void;
}

const toneClass: Record<ImportModeTone, string> = {
  official: "border-emerald-200 bg-emerald-50/40 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-200",
  smart: "border-violet-200 bg-violet-50/40 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/20 dark:text-violet-200",
};

export function ImportModeCard({ title, description, details, selected, tone, icon, onClick }: ImportModeCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-w-0 flex-col rounded-[24px] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-950",
        selected ? "border-blue-300 ring-2 ring-blue-100 dark:border-blue-700 dark:ring-blue-950" : "border-border",
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border", toneClass[tone])}>
          {icon}
        </div>
        {selected ? <CheckCircle2 className="h-5 w-5 shrink-0 text-blue-600" /> : null}
      </div>
      <div className="mt-4 min-w-0 space-y-2">
        <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{title}</p>
        <p className="text-sm leading-6 text-muted-foreground">{description}</p>
        <ul className="space-y-1.5 text-xs leading-5 text-muted-foreground">
          {details.map((detail) => (
            <li key={detail} className="flex gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

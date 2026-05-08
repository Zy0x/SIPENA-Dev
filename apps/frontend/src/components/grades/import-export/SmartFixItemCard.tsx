import { ChevronDown, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { SimplifiedConflictItem } from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { StatusBadge } from "./StatusBadge";

const levelTone = {
  auto_fixable: "success",
  needs_confirmation: "warning",
  manual_required: "danger",
} as const;

const levelLabel = {
  auto_fixable: "Aman",
  needs_confirmation: "Perlu dicek",
  manual_required: "Perlu dipilih",
} as const;

export function SmartFixItemCard({
  item,
  defaultOpen = false,
  children,
}: {
  item: SimplifiedConflictItem;
  defaultOpen?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <article className="rounded-2xl border border-border bg-white p-3 shadow-sm dark:bg-slate-950">
      <div className="flex min-w-0 items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h5 className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-950 dark:text-slate-50" title={item.title}>
              {item.title}
            </h5>
            <StatusBadge tone={levelTone[item.level]}>{levelLabel[item.level]}</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p>
        </div>
        {(item.reason || children) ? (
          <button
            type="button"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-white text-slate-600 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
            aria-label={open ? "Sembunyikan alasan SIPENA" : "Lihat alasan SIPENA"}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : null}
      </div>
      <div className={cn("mt-3 space-y-3", !open && "hidden")}>
        {item.reason ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-5 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200">
            <span className="font-semibold">Alasan SIPENA: </span>
            {item.reason}
          </div>
        ) : null}
        {children}
      </div>
    </article>
  );
}

import { CheckCircle2, CircleAlert, ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";

import type { SimplifiedConflictGroup } from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { SmartFixItemCard } from "./SmartFixItemCard";
import { StatusBadge } from "./StatusBadge";

const groupTone = {
  auto_fixable: "success",
  needs_confirmation: "warning",
  manual_required: "danger",
} as const;

const groupIcon = {
  auto_fixable: CheckCircle2,
  needs_confirmation: CircleAlert,
  manual_required: ShieldAlert,
} as const;

export function SmartFixGroupCard({
  group,
  defaultOpen = false,
  onPrimaryAction,
  renderItem,
}: {
  group: SimplifiedConflictGroup;
  defaultOpen?: boolean;
  onPrimaryAction?: () => void;
  renderItem?: (item: SimplifiedConflictGroup["items"][number]) => ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const Icon = groupIcon[group.level];

  return (
    <section className="rounded-[24px] border border-border bg-white p-4 shadow-sm dark:bg-slate-950">
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl",
          group.level === "auto_fixable" && "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30",
          group.level === "needs_confirmation" && "bg-orange-50 text-orange-600 dark:bg-orange-950/30",
          group.level === "manual_required" && "bg-red-50 text-red-600 dark:bg-red-950/30",
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-950 dark:text-slate-50">{group.title}</h4>
            <StatusBadge tone={groupTone[group.level]}>{group.itemCount} item</StatusBadge>
          </div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{group.description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          disabled={!group.canBulkApply}
          onClick={onPrimaryAction}
          className={cn(
            "min-h-11 rounded-full px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            group.level === "auto_fixable" && "bg-emerald-600 text-white hover:bg-emerald-700",
            group.level === "needs_confirmation" && "bg-orange-600 text-white hover:bg-orange-700",
            group.level === "manual_required" && "bg-red-600 text-white hover:bg-red-700",
          )}
        >
          {group.recommendedActionLabel}
        </button>
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="min-h-11 rounded-full border border-border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
        >
          {open ? "Sembunyikan detail" : "Lihat detail"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-2">
          {group.items.length ? group.items.map((item) => (
            renderItem ? renderItem(item) : <SmartFixItemCard key={item.id} item={item} defaultOpen={group.level === "manual_required"} />
          )) : (
            <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground dark:border-slate-800">
              Tidak ada item pada bagian ini.
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}

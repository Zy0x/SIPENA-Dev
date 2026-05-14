import { CheckCircle2, CircleAlert, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type StatusBadgeTone = "safe" | "success" | "warning" | "danger" | "info" | "smart";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone;
  className?: string;
  description?: ReactNode;
}

const toneClass: Record<StatusBadgeTone, string> = {
  safe: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200",
  warning: "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/60 dark:bg-orange-950/35 dark:text-orange-200",
  danger: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/35 dark:text-red-200",
  info: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200",
  smart: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/35 dark:text-violet-200",
};

const iconByTone: Record<StatusBadgeTone, ComponentType<{ className?: string }>> = {
  safe: ShieldCheck,
  success: CheckCircle2,
  warning: CircleAlert,
  danger: ShieldAlert,
  info: Info,
  smart: Info,
};

export function StatusBadge({ children, tone = "info", className, description }: StatusBadgeProps) {
  const Icon = iconByTone[tone];

  const badge = (
    <span
      tabIndex={description ? 0 : undefined}
      className={cn(
        "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        toneClass[tone],
        className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 truncate">{children}</span>
    </span>
  );

  if (!description) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
        {description}
      </TooltipContent>
    </Tooltip>
  );
}

import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { cn } from "@/lib/utils";

type RiskAlertTone = "safe" | "warning" | "info" | "blocked";

interface RiskAlertProps {
  title: string;
  children: ReactNode;
  tone?: RiskAlertTone;
  className?: string;
}

const toneClass: Record<RiskAlertTone, string> = {
  safe: "border-emerald-200 bg-emerald-50/80 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100",
  warning: "border-orange-200 bg-orange-50/80 text-orange-900 dark:border-orange-900/60 dark:bg-orange-950/30 dark:text-orange-100",
  info: "border-slate-200 bg-slate-50/80 text-slate-900 dark:border-slate-800 dark:bg-slate-900/55 dark:text-slate-100",
  blocked: "border-red-200 bg-red-50/80 text-red-900 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-100",
};

const iconByTone: Record<RiskAlertTone, ComponentType<{ className?: string }>> = {
  safe: CheckCircle2,
  warning: AlertTriangle,
  info: Info,
  blocked: ShieldAlert,
};

export function RiskAlert({ title, children, tone = "info", className }: RiskAlertProps) {
  const Icon = iconByTone[tone];

  return (
    <div className={cn("rounded-2xl border p-3.5", toneClass[tone], className)}>
      <div className="flex min-w-0 items-start gap-3">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold leading-5">{title}</p>
          <div className="text-xs leading-5 opacity-85">{children}</div>
        </div>
      </div>
    </div>
  );
}

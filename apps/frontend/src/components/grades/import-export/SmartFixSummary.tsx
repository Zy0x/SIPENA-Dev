import { Sparkles } from "lucide-react";

import type { ConflictSimplifierResult } from "@/lib/gradeImport";

import { StatusBadge } from "./StatusBadge";

export function SmartFixSummary({
  result,
  onPrimaryAction,
}: {
  result: ConflictSimplifierResult;
  onPrimaryAction: () => void;
}) {
  return (
    <section className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-sm dark:border-blue-900/60 dark:bg-slate-950">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-blue-700 dark:text-blue-200">
            <Sparkles className="h-5 w-5 shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-wide">SIPENA Smart Fix Assistant</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold tracking-normal text-slate-950 dark:text-slate-50">
            {result.headline}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{result.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="success">{result.autoFixableCount} aman diperbaiki</StatusBadge>
            <StatusBadge tone="warning">{result.needsConfirmationCount} butuh konfirmasi</StatusBadge>
            <StatusBadge tone="danger">{result.manualRequiredCount} harus dipilih</StatusBadge>
          </div>
        </div>
        <button
          type="button"
          onClick={onPrimaryAction}
          className="min-h-11 w-full rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"
        >
          {result.primaryActionLabel}
        </button>
      </div>
    </section>
  );
}

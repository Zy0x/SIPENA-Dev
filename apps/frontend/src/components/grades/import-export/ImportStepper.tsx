import { CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface ImportStepperProps {
  steps: string[];
  currentIndex: number;
}

export function ImportStepper({ steps, currentIndex }: ImportStepperProps) {
  return (
    <nav aria-label="Langkah import nilai" className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-max items-center gap-2 sm:min-w-0">
        {steps.map((step, index) => {
          const isDone = index < currentIndex;
          const isActive = index === currentIndex;

          return (
            <li key={step} className="flex items-center gap-2">
              <div
                aria-current={isActive ? "step" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-semibold transition-colors",
                  isActive && "border-blue-300 bg-blue-50 text-blue-700 shadow-sm dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
                  isDone && "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/35 dark:text-emerald-200",
                  !isActive && !isDone && "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400",
                )}
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-current/10 text-[10px]">
                    {index + 1}
                  </span>
                )}
                <span className="whitespace-nowrap">{step}</span>
              </div>
              {index < steps.length - 1 ? <div className="h-px w-4 bg-border sm:w-6" /> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

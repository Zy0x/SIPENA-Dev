import { Loader2 } from "lucide-react";
import { clampExportProgress } from "@/lib/exportProgress";

interface PreviewProgressIndicatorProps {
  percent: number;
  phase: string;
  detail?: string;
}

export function PreviewProgressIndicator({ percent, phase, detail }: PreviewProgressIndicatorProps) {
  const value = Math.round(clampExportProgress(percent));

  return (
    <div
      className="rounded-2xl border border-border bg-background/95 p-3 shadow-sm sm:p-4"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      aria-label="Progress preview ekspor"
    >
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">{phase || "Menyusun preview..."}</p>
            {detail ? <p className="truncate text-[11px] text-muted-foreground">{detail}</p> : null}
          </div>
        </div>
        <span className="shrink-0 text-xs font-bold text-primary">{value}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

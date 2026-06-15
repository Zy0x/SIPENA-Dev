import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { setBackgroundTimeout } from "@/lib/backgroundTimer";
import {
  clampExportProgress,
  normalizeExportProgressUpdate,
  type ExportProgressReporter,
} from "@/lib/exportProgress";

type LoaderStatus = "running" | "done" | "error";

interface ExportLoaderProgressState {
  percent: number;
  phase: string;
  message: string;
  logs: string[];
  status: LoaderStatus;
}

interface ExportLoaderOverlayProps {
  visible: boolean;
  fileName?: string;
  fileSize?: string;
  progress: ExportLoaderProgressState;
}

type ExportLoaderTask<T> = (progress: ExportProgressReporter) => Promise<T> | T;

function waitWithBackgroundTimer(delayMs: number) {
  return new Promise<void>((resolve) => {
    setBackgroundTimeout(resolve, delayMs);
  });
}

function yieldFrame() {
  return new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(() => resolve());
      return;
    }
    setTimeout(resolve, 0);
  });
}

function appendLog(logs: string[], message: string) {
  if (!message) return logs;
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : "";
  if (lastLog === message) return logs;
  return [...logs, message].slice(-5);
}

function ExportLoaderOverlay({
  visible,
  fileName = "export.pdf",
  fileSize = "",
  progress,
}: ExportLoaderOverlayProps) {
  if (!visible) return null;

  const percent = Math.round(clampExportProgress(progress.percent));
  const circumference = 2 * Math.PI * 70;
  const dashOffset = circumference * (1 - percent / 100);
  const statusLabel = progress.status === "done" ? "SELESAI" : progress.status === "error" ? "GAGAL" : "AKTIF";
  const StatusIcon = progress.status === "done" ? CheckCircle2 : progress.status === "error" ? XCircle : Loader2;
  const displayedLogs = progress.logs.length > 0 ? progress.logs : [progress.message || "Menyiapkan ekspor..."];

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 px-3 py-6 backdrop-blur-sm">
      <div
        className="relative w-[min(460px,94vw)] overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Progress ekspor"
      >
        <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">Mengekspor File</p>
            <p className="max-w-full truncate text-sm font-bold text-foreground sm:max-w-[280px]">{fileName}</p>
            {fileSize ? <p className="mt-0.5 text-[11px] text-muted-foreground">{fileSize}</p> : null}
          </div>
          <div
            className="inline-flex w-fit items-center gap-2 rounded-md border border-primary/20 bg-primary/10 px-2.5 py-1 text-primary"
            aria-live="polite"
          >
            <StatusIcon className={progress.status === "running" ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">{statusLabel}</span>
          </div>
        </div>

        <div className="mb-5 flex justify-center">
          <div className="relative h-28 w-28">
            <svg className="h-28 w-28 -rotate-90" viewBox="0 0 160 160" aria-hidden="true">
              <circle cx="80" cy="80" r="70" fill="none" className="stroke-muted/20" strokeWidth="4" />
              <circle
                cx="80"
                cy="80"
                r="70"
                fill="none"
                className="stroke-primary transition-[stroke-dashoffset] duration-300 ease-out"
                strokeWidth="4"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                style={{ filter: "drop-shadow(0 0 8px hsl(var(--primary) / 0.32))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div>
                <span className="text-2xl font-bold text-foreground">{percent}</span>
                <span className="ml-0.5 text-xs text-primary">%</span>
              </div>
              <span className="mt-1 max-w-[88px] truncate text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                {progress.phase || "MEMULAI"}
              </span>
            </div>
          </div>
        </div>

        <div className="mb-4" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Progress nyata</span>
            <span className="text-[10px] font-semibold text-primary">{percent}%</span>
          </div>
          <div className="relative h-2 overflow-hidden rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary/75 to-primary transition-[width] duration-300 ease-out"
              style={{ width: `${percent}%`, boxShadow: "0 0 10px hsl(var(--primary) / 0.28)" }}
            />
          </div>
        </div>

        <div className="mb-4 rounded-xl border border-border bg-muted/25 p-3" aria-live="polite">
          <p className="mb-2 text-xs font-semibold text-foreground">{progress.message || "Menyiapkan ekspor..."}</p>
          <div className="space-y-1 text-[11px] text-muted-foreground">
            {displayedLogs.map((log, index) => (
              <div key={`${index}-${log}`} className="flex items-start gap-2">
                <span className="mt-[0.35rem] h-1 w-1 shrink-0 rounded-full bg-primary/60" />
                <span className="min-w-0">{log}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          Progress mencapai 100% hanya setelah file selesai dibuat dan proses download sudah dimulai.
        </p>
      </div>
    </div>,
    document.body,
  );
}

export function useExportLoader() {
  const [loaderKey, setLoaderKey] = useState(0);
  const [state, setState] = useState({ visible: false, fileName: "", fileSize: "" });
  const [progress, setProgress] = useState<ExportLoaderProgressState>({
    percent: 0,
    phase: "MEMULAI",
    message: "Menyiapkan ekspor...",
    logs: [],
    status: "running",
  });
  const runIdRef = useRef(0);

  const updateProgress = useCallback((update: Parameters<ExportProgressReporter["update"]>[0], phase?: string, message?: string) => {
    const normalized = normalizeExportProgressUpdate(update, phase, message);
    setProgress((prev) => {
      const hasPercent = Number.isFinite(normalized.percent);
      const nextPercent = hasPercent ? Math.max(prev.percent, normalized.percent) : prev.percent;
      const nextPhase = normalized.phase || prev.phase;
      const nextMessage = normalized.message || prev.message;
      return {
        ...prev,
        percent: nextPercent,
        phase: nextPhase,
        message: nextMessage,
        logs: appendLog(prev.logs, normalized.message),
      };
    });
  }, []);

  const runWithLoader = useCallback(async <T,>(
    fileName: string,
    task: ExportLoaderTask<T>,
    fileSize?: string,
  ): Promise<T> => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;

    setLoaderKey((prev) => prev + 1);
    setState({ visible: true, fileName, fileSize: fileSize || "" });
    setProgress({
      percent: 0,
      phase: "MEMULAI",
      message: "Menyiapkan ekspor...",
      logs: ["Menyiapkan ekspor..."],
      status: "running",
    });

    await yieldFrame();

    const reporter: ExportProgressReporter = {
      update: updateProgress,
      yieldFrame,
      isCancelled: () => runIdRef.current !== runId,
    };

    try {
      const result = await task(reporter);
      reporter.update({ percent: 100, phase: "SELESAI", message: "File siap, download dimulai." });
      setProgress((prev) => ({ ...prev, percent: 100, phase: "SELESAI", status: "done" }));
      await waitWithBackgroundTimer(420);
      if (runIdRef.current === runId) {
        setState({ visible: false, fileName: "", fileSize: "" });
      }
      return result;
    } catch (error) {
      setProgress((prev) => ({
        ...prev,
        phase: "GAGAL",
        message: "Ekspor gagal. Silakan coba lagi.",
        logs: appendLog(prev.logs, "Ekspor gagal. Silakan coba lagi."),
        status: "error",
      }));
      await waitWithBackgroundTimer(900);
      if (runIdRef.current === runId) {
        setState({ visible: false, fileName: "", fileSize: "" });
      }
      throw error;
    }
  }, [updateProgress]);

  const showLoader = useCallback((fileName: string, fileSize?: string) => (
    runWithLoader(fileName, async (reporter) => {
      reporter.update({ percent: 100, phase: "SELESAI", message: "File siap diproses." });
      await reporter.yieldFrame();
    }, fileSize)
  ), [runWithLoader]);

  const overlay = (
    <ExportLoaderOverlay
      key={loaderKey}
      visible={state.visible}
      fileName={state.fileName}
      fileSize={state.fileSize}
      progress={progress}
    />
  );

  return { showLoader, runWithLoader, overlay };
}

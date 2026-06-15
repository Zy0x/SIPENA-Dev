export interface ExportProgressUpdate {
  percent?: number;
  phase?: string;
  message?: string;
}

export interface ExportProgressReporter {
  update: (update: ExportProgressUpdate | number, phase?: string, message?: string) => void;
  yieldFrame: () => Promise<void>;
  isCancelled?: () => boolean;
}

export function clampExportProgress(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

export function normalizeExportProgressUpdate(
  update: ExportProgressUpdate | number,
  phase?: string,
  message?: string,
): Required<ExportProgressUpdate> {
  if (typeof update === "number") {
    return {
      percent: clampExportProgress(update),
      phase: phase || "",
      message: message || "",
    };
  }

  return {
    percent: update.percent === undefined ? NaN : clampExportProgress(update.percent),
    phase: update.phase || "",
    message: update.message || "",
  };
}

export async function reportExportProgress(
  reporter: ExportProgressReporter | undefined,
  percent: number,
  phase: string,
  message: string,
) {
  reporter?.update({ percent, phase, message });
  await reporter?.yieldFrame();
}

import { useState } from "react";

import type { UpdateMode } from "@/lib/gradeImport";
import { cn } from "@/lib/utils";

import { RiskAlert } from "./RiskAlert";

const options: Array<{ mode: UpdateMode; title: string; description: string; risky?: boolean }> = [
  {
    mode: "fill_empty_only",
    title: "Isi nilai kosong saja",
    description: "Disarankan. Nilai lama tidak ditimpa.",
  },
  {
    mode: "skip_existing",
    title: "Lewati nilai yang sudah ada",
    description: "Baris yang sudah punya nilai akan dilewati.",
  },
  {
    mode: "overwrite_existing",
    title: "Timpa nilai lama",
    description: "Berisiko. Nilai lama dapat diganti oleh isi Excel.",
    risky: true,
  },
];

export function AdvancedImportOptions({
  updateMode,
  onUpdateModeChange,
}: {
  updateMode: UpdateMode;
  onUpdateModeChange: (mode: UpdateMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const [overwriteText, setOverwriteText] = useState("");

  return (
    <section className="rounded-[24px] border border-border bg-white p-4 dark:bg-slate-950">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">
            Perlakuan nilai lama
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Pilihan saat ini: {options.find((item) => item.mode === updateMode)?.title || "Isi nilai kosong saja"}. Mengganti nilai lama tetap butuh konfirmasi eksplisit.
          </p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-full border border-border bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:bg-slate-950 dark:text-slate-100 dark:hover:bg-slate-900"
          onClick={() => setOpen((current) => !current)}
        >
          Atur nilai lama
        </button>
      </div>

      {open ? (
        <div className="mt-4 grid gap-2">
          {options.map((option) => (
            <div
              key={option.mode}
              className={cn(
                "rounded-2xl border p-3",
                updateMode === option.mode
                  ? "border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/30"
                  : "border-border bg-slate-50 dark:bg-slate-900/50",
              )}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950 dark:text-slate-50">{option.title}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{option.description}</p>
                </div>
                {option.risky ? (
                  <div className="grid gap-2 sm:min-w-56">
                    <input
                      value={overwriteText}
                      onChange={(event) => setOverwriteText(event.target.value)}
                      className="min-h-11 rounded-xl border border-red-200 bg-white px-3 text-sm dark:border-red-900/60 dark:bg-slate-950"
                      placeholder="Ketik TIMPA"
                      aria-label="Ketik TIMPA untuk mengonfirmasi timpa nilai lama"
                    />
                    <button
                      type="button"
                      disabled={overwriteText !== "TIMPA"}
                      className="min-h-11 rounded-full bg-red-600 px-4 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => onUpdateModeChange(option.mode)}
                    >
                      Konfirmasi timpa nilai lama
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="min-h-11 rounded-full bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                    onClick={() => onUpdateModeChange(option.mode)}
                  >
                    Pilih perlakuan ini
                  </button>
                )}
              </div>
              {option.risky ? (
                <div className="mt-3">
                  <RiskAlert title="Berisiko menimpa nilai" tone="blocked">
                    Pilih ini hanya jika Anda benar-benar ingin mengganti nilai lama dengan nilai dari Excel.
                  </RiskAlert>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2, Loader2 } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  getReportRoundingLabel,
  getReportRoundingTargetLabel,
  type CustomFormula,
  type ReportRoundingMode,
  type ReportRoundingTarget,
} from "@/lib/gradeFormula";

const ROUNDING_OPTIONS: Array<{
  mode: ReportRoundingMode;
  title: string;
  description: string;
  example: string;
}> = [
  {
    mode: "default",
    title: "Default",
    description: "Pertahankan nilai hitung asli. Tampilan tetap mengikuti format nilai saat ini.",
    example: "86.25 -> 86.3",
  },
  {
    mode: "one_decimal",
    title: "Satu desimal",
    description: "Tampilkan hasil pilihan dengan satu angka di belakang koma.",
    example: "86.25 -> 86.3",
  },
  {
    mode: "nearest_integer",
    title: "Bulat terdekat",
    description: "Nilai desimal dibulatkan ke bilangan bulat paling dekat.",
    example: "86.5 -> 87",
  },
  {
    mode: "floor_integer",
    title: "Bulat ke bawah",
    description: "Nilai desimal selalu turun ke bilangan bulat di bawahnya.",
    example: "86.9 -> 86",
  },
  {
    mode: "ceil_integer",
    title: "Bulat ke atas",
    description: "Nilai desimal selalu naik ke bilangan bulat di atasnya.",
    example: "86.1 -> 87",
  },
];

const ROUNDING_TARGET_OPTIONS: Array<{
  target: ReportRoundingTarget;
  title: string;
  description: string;
}> = [
  {
    target: "report",
    title: "Rapor",
    description: "Hanya kolom Rapor yang mengikuti mode pembulatan.",
  },
  {
    target: "chapter_average",
    title: "Rata-rata BAB",
    description: "Hanya kolom Rata-rata pada setiap BAB yang dibulatkan.",
  },
  {
    target: "all",
    title: "Semuanya",
    description: "Terapkan ke Rapor dan seluruh Rata-rata BAB.",
  },
];

interface ReportRoundingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: CustomFormula;
  onFormulaChange: (formula: CustomFormula) => Promise<void> | void;
  onApplyToAllSubjects?: (formula: CustomFormula) => Promise<void> | void;
  isSaving?: boolean;
  isSavingAllSubjects?: boolean;
  subjectName?: string;
  subjectCount?: number;
}

export function ReportRoundingSettingsDialog({
  open,
  onOpenChange,
  formula,
  onFormulaChange,
  onApplyToAllSubjects,
  isSaving = false,
  isSavingAllSubjects = false,
  subjectName = "mapel pilihan",
  subjectCount = 0,
}: ReportRoundingSettingsDialogProps) {
  const currentMode = formula.reportRounding?.mode || "default";
  const currentTarget = formula.reportRounding?.target || "report";
  const [draftMode, setDraftMode] = useState<ReportRoundingMode>(currentMode);
  const [draftTarget, setDraftTarget] = useState<ReportRoundingTarget>(currentTarget);
  const [pendingScope, setPendingScope] = useState<"selected" | "all" | null>(null);
  const isBusy = isSaving || isSavingAllSubjects;

  useEffect(() => {
    if (open) {
      setDraftMode(currentMode);
      setDraftTarget(currentTarget);
      setPendingScope(null);
    }
  }, [currentMode, currentTarget, open]);

  const selectedOption = useMemo(
    () => ROUNDING_OPTIONS.find((option) => option.mode === draftMode) || ROUNDING_OPTIONS[0],
    [draftMode],
  );

  const buildNextFormula = () => ({
    ...formula,
    reportRounding: { mode: draftMode, target: draftTarget },
  });

  const handleApplyToSelectedSubject = async () => {
    setPendingScope("selected");
    try {
      await onFormulaChange(buildNextFormula());
      onOpenChange(false);
    } finally {
      setPendingScope(null);
    }
  };

  const handleApplyToAllSubjects = async () => {
    if (!onApplyToAllSubjects) return;
    setPendingScope("all");
    try {
      await onApplyToAllSubjects(buildNextFormula());
      onOpenChange(false);
    } finally {
      setPendingScope(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isBusy && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Pembulatan Nilai
          </DialogTitle>
          <DialogDescription>
            Atur cara nilai hasil kalkulasi menangani desimal.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Pengaturan ini hanya mengubah tampilan hasil kalkulasi. Nilai tugas, STS, SAS, dan data mentah tetap tidak diubah.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Terapkan ke</p>
              <p className="text-xs text-muted-foreground">Pilih area nilai yang mengikuti mode pembulatan.</p>
            </div>
            <RadioGroup value={draftTarget} onValueChange={(value) => setDraftTarget(value as ReportRoundingTarget)}>
              <div className="grid gap-2 sm:grid-cols-3">
                {ROUNDING_TARGET_OPTIONS.map((option) => (
                  <label
                    key={option.target}
                    className="flex cursor-pointer gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/40 data-[checked=true]:border-primary data-[checked=true]:bg-primary/5"
                    data-checked={draftTarget === option.target}
                  >
                    <RadioGroupItem value={option.target} className="mt-1" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{option.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">{option.description}</span>
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Mode pembulatan</p>
              <p className="text-xs text-muted-foreground">Pilih cara angka desimal diubah.</p>
            </div>
            <RadioGroup value={draftMode} onValueChange={(value) => setDraftMode(value as ReportRoundingMode)}>
              <div className="grid gap-2 sm:grid-cols-2">
                {ROUNDING_OPTIONS.map((option) => (
                  <label
                    key={option.mode}
                    className="flex cursor-pointer gap-3 rounded-xl border bg-background p-3 transition hover:bg-muted/40 data-[checked=true]:border-primary data-[checked=true]:bg-primary/5"
                    data-checked={draftMode === option.mode}
                  >
                    <RadioGroupItem value={option.mode} className="mt-1" />
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex items-center gap-2">
                        <span className="font-semibold">{option.title}</span>
                        {option.mode === currentMode && (
                          <Badge variant="secondary" className="text-[10px]">
                            Aktif
                          </Badge>
                        )}
                      </span>
                      <span className="block text-sm text-muted-foreground">{option.description}</span>
                      <span className="block rounded-lg bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
                        {option.example}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </RadioGroup>
          </div>

          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            Pilihan: <span className="font-semibold">{selectedOption.title}</span> untuk{" "}
            <span className="font-semibold">{getReportRoundingTargetLabel(draftTarget)}</span>
          </div>

          <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
            Tombol <span className="font-semibold text-foreground">Mapel Pilihan</span> hanya memperbarui{" "}
            <span className="font-semibold text-foreground">{subjectName}</span>. Tombol{" "}
            <span className="font-semibold text-foreground">Seluruh Mapel</span> hanya menyalin aturan pembulatan ke{" "}
            <span className="font-semibold text-foreground">{Math.max(0, subjectCount)} mapel</span> pada kelas ini tanpa mengubah rumus bobot tiap mapel.
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Batal
          </Button>
          <Button type="button" variant="secondary" onClick={handleApplyToSelectedSubject} disabled={isBusy}>
            {pendingScope === "selected" && isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pendingScope === "selected" && isBusy ? "Menerapkan..." : "Terapkan ke Mapel Pilihan"}
          </Button>
          <Button
            type="button"
            onClick={handleApplyToAllSubjects}
            disabled={isBusy || !onApplyToAllSubjects || subjectCount <= 0}
          >
            {pendingScope === "all" && isBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {pendingScope === "all" && isBusy ? "Menerapkan..." : "Terapkan ke Seluruh Mapel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

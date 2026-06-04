import { useEffect, useMemo, useState } from "react";
import { Calculator, CheckCircle2 } from "lucide-react";

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
import { getReportRoundingLabel, type CustomFormula, type ReportRoundingMode } from "@/lib/gradeFormula";

const ROUNDING_OPTIONS: Array<{
  mode: ReportRoundingMode;
  title: string;
  description: string;
  example: string;
}> = [
  {
    mode: "default",
    title: "Default",
    description: "Pertahankan nilai hitung asli. Tampilan tetap mengikuti format Rapor saat ini.",
    example: "86.25 -> 86.3",
  },
  {
    mode: "one_decimal",
    title: "Satu desimal",
    description: "Simpan hasil Rapor dengan satu angka di belakang koma.",
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

interface ReportRoundingSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formula: CustomFormula;
  onFormulaChange: (formula: CustomFormula) => Promise<void> | void;
  isSaving?: boolean;
}

export function ReportRoundingSettingsDialog({
  open,
  onOpenChange,
  formula,
  onFormulaChange,
  isSaving = false,
}: ReportRoundingSettingsDialogProps) {
  const currentMode = formula.reportRounding?.mode || "default";
  const [draftMode, setDraftMode] = useState<ReportRoundingMode>(currentMode);

  useEffect(() => {
    if (open) setDraftMode(currentMode);
  }, [currentMode, open]);

  const selectedOption = useMemo(
    () => ROUNDING_OPTIONS.find((option) => option.mode === draftMode) || ROUNDING_OPTIONS[0],
    [draftMode],
  );

  const handleSave = async () => {
    await onFormulaChange({
      ...formula,
      reportRounding: { mode: draftMode },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isSaving && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-primary" />
            Pembulatan Nilai Rapor
          </DialogTitle>
          <DialogDescription>
            Atur cara kolom Rapor menangani nilai desimal setelah rumus nilai dihitung.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert className="border-blue-200 bg-blue-50/70 text-blue-950 dark:border-blue-900/60 dark:bg-blue-950/25 dark:text-blue-100">
            <CheckCircle2 className="h-4 w-4" />
            <AlertDescription>
              Pengaturan ini hanya mengubah hasil kalkulasi Rapor. Nilai tugas, STS, SAS, dan data mentah tetap tidak diubah.
            </AlertDescription>
          </Alert>

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

          <div className="rounded-xl border bg-muted/40 p-3 text-sm">
            Mode dipilih: <span className="font-semibold">{selectedOption.title}</span>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Batal
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Menyimpan..." : "Simpan Pembulatan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

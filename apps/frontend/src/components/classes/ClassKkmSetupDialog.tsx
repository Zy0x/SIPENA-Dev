import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Loader2, Target } from "lucide-react";
import { Class, useClasses } from "@/hooks/useClasses";

interface ClassKkmSetupDialogProps {
  classes: Class[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ClassKkmSetupDialog({
  classes,
  open,
  onOpenChange,
}: ClassKkmSetupDialogProps) {
  const { updateClass } = useClasses();
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;

    const nextValues: Record<string, string> = {};
    classes.forEach((classItem) => {
      nextValues[classItem.id] = classItem.class_kkm?.toString() || "75";
    });
    setValues(nextValues);
  }, [classes, open]);

  const hasInvalidValue = useMemo(() => (
    classes.some((classItem) => {
      const value = parseInt(values[classItem.id] || "", 10);
      return Number.isNaN(value) || value < 0 || value > 100;
    })
  ), [classes, values]);

  const handleSave = async () => {
    for (const classItem of classes) {
      const parsedValue = parseInt(values[classItem.id] || "", 10);
      if (Number.isNaN(parsedValue) || parsedValue < 0 || parsedValue > 100) {
        return;
      }

      if (classItem.class_kkm !== parsedValue) {
        await updateClass.mutateAsync({
          id: classItem.id,
          class_kkm: parsedValue,
        });
      }
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Panduan KKM Kelas
          </DialogTitle>
          <DialogDescription>
            Sekarang setiap kelas memiliki KKM kelas. Nilai ini dipakai sebagai acuan ranking keseluruhan kelas dan otomatis menjadi default KKM saat membuat mapel baru.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Anda tetap bisa mengubah KKM per mapel saat membuat atau mengedit mapel. KKM kelas hanya menjadi default awal dan patokan ranking keseluruhan.
          </AlertDescription>
        </Alert>

        <div className="grid gap-3 py-2 max-h-[320px] overflow-y-auto pr-1">
          {classes.map((classItem) => (
            <div key={classItem.id} className="rounded-xl border border-border/70 p-3 space-y-2">
              <div>
                <p className="font-medium text-sm text-foreground">{classItem.name}</p>
                <p className="text-xs text-muted-foreground">
                  Isi KKM kelas untuk melengkapi acuan ranking keseluruhan dan default KKM mapel baru.
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor={`class-kkm-${classItem.id}`}>KKM Kelas</Label>
                <Input
                  id={`class-kkm-${classItem.id}`}
                  type="number"
                  min="0"
                  max="100"
                  value={values[classItem.id] || ""}
                  onChange={(e) => setValues((prev) => ({ ...prev, [classItem.id]: e.target.value }))}
                />
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Nanti Saja
          </Button>
          <Button type="button" onClick={handleSave} disabled={updateClass.isPending || hasInvalidValue}>
            {updateClass.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan KKM Kelas"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

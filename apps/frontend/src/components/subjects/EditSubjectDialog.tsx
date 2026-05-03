import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { Subject, useSubjects } from "@/hooks/useSubjects";

interface EditSubjectDialogProps {
  subject: Subject;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditSubjectDialog({
  subject,
  open,
  onOpenChange,
}: EditSubjectDialogProps) {
  const [name, setName] = useState(subject.name);
  const [kkm, setKkm] = useState(subject.kkm.toString());
  const { updateSubject } = useSubjects(subject.class_id);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    const kkmValue = parseInt(kkm);
    if (isNaN(kkmValue) || kkmValue < 0 || kkmValue > 100) return;

    await updateSubject.mutateAsync({
      id: subject.id,
      name: name.trim(),
      kkm: kkmValue,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Mata Pelajaran</DialogTitle>
            <DialogDescription>
              Perbarui informasi mata pelajaran
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-subject-name">Nama Mata Pelajaran *</Label>
              <Input
                id="edit-subject-name"
                placeholder="Nama mapel"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="edit-kkm">KKM (Kriteria Ketuntasan Minimal)</Label>
              <Input
                id="edit-kkm"
                type="number"
                min="0"
                max="100"
                placeholder="70"
                value={kkm}
                onChange={(e) => setKkm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Nilai antara 0-100. Digunakan untuk menentukan warna nilai.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || updateSubject.isPending}
            >
              {updateSubject.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

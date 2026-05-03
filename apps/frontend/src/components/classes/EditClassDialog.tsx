import { useState, useEffect } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { Class, useClasses } from "@/hooks/useClasses";

interface EditClassDialogProps {
  classData: Class;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function EditClassDialog({
  classData,
  open,
  onOpenChange,
}: EditClassDialogProps) {
  const [name, setName] = useState(classData.name);
  const [description, setDescription] = useState(classData.description || "");
  const [classKkm, setClassKkm] = useState(classData.class_kkm?.toString() || "75");
  const { updateClass } = useClasses();

  useEffect(() => {
    if (open) {
      setName(classData.name);
      setDescription(classData.description || "");
      setClassKkm(classData.class_kkm?.toString() || "75");
    }
  }, [open, classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedClassKkm = parseInt(classKkm, 10);
    if (!name.trim() || Number.isNaN(parsedClassKkm) || parsedClassKkm < 0 || parsedClassKkm > 100) return;

    await updateClass.mutateAsync({
      id: classData.id,
      name: name.trim(),
      description: description.trim() || undefined,
      class_kkm: parsedClassKkm,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Kelas</DialogTitle>
            <DialogDescription>
              Perbarui informasi kelas dan KKM kelas. KKM kelas dipakai untuk acuan ranking keseluruhan dan default KKM mapel baru.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-class-name">Nama Kelas *</Label>
              <Input
                id="edit-class-name"
                placeholder="Contoh: V-A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-class-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="edit-class-desc"
                placeholder="Catatan tentang kelas ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-class-kkm">KKM Kelas *</Label>
              <Input
                id="edit-class-kkm"
                type="number"
                min="0"
                max="100"
                placeholder="75"
                value={classKkm}
                onChange={(e) => setClassKkm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Gunakan nilai 0-100. Nilai ini menjadi patokan ranking keseluruhan kelas.
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
              disabled={!name.trim() || !classKkm.trim() || updateClass.isPending}
            >
              {updateClass.isPending ? (
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

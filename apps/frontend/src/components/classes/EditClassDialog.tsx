import { useState, useEffect, useRef } from "react";
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
import { CLASS_DESCRIPTION_MAX_LENGTH, CLASS_NAME_MAX_LENGTH, limitClassDescription, limitClassName } from "./classFormLimits";

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
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (open) {
      setName(limitClassName(classData.name));
      setDescription(limitClassDescription(classData.description || ""));
      setClassKkm(classData.class_kkm?.toString() || "75");
    }
  }, [open, classData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedClassKkm = parseInt(classKkm, 10);
    const trimmedName = limitClassName(name.trim());
    const trimmedDescription = limitClassDescription(description.trim());
    if (!trimmedName || Number.isNaN(parsedClassKkm) || parsedClassKkm < 0 || parsedClassKkm > 100) return;

    await updateClass.mutateAsync({
      id: classData.id,
      name: trimmedName,
      description: trimmedDescription || undefined,
      class_kkm: parsedClassKkm,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Edit Kelas
            </DialogTitle>
            <DialogDescription>
              Perbarui identitas kelas, deskripsi, dan KKM kelas.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="edit-class-name">Nama Kelas *</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {name.length}/{CLASS_NAME_MAX_LENGTH}
                </span>
              </div>
              <Input
                id="edit-class-name"
                placeholder="Contoh: V-A"
                value={name}
                onChange={(e) => setName(limitClassName(e.target.value))}
                maxLength={CLASS_NAME_MAX_LENGTH}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="edit-class-desc">Deskripsi (opsional)</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {description.length}/{CLASS_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="edit-class-desc"
                placeholder="Catatan tentang kelas ini..."
                value={description}
                onChange={(e) => setDescription(limitClassDescription(e.target.value))}
                maxLength={CLASS_DESCRIPTION_MAX_LENGTH}
                rows={3}
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

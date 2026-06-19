import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Loader2 } from "lucide-react";
import { useClasses, type Class } from "@/hooks/useClasses";
import { CLASS_DESCRIPTION_MAX_LENGTH, CLASS_NAME_MAX_LENGTH, limitClassDescription, limitClassName } from "./classFormLimits";

interface AddClassDialogProps {
  trigger?: React.ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onCreated?: (createdClass: Class) => void;
}

export default function AddClassDialog({ trigger, open, onOpenChange, onCreated }: AddClassDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classKkm, setClassKkm] = useState("75");
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { createClass } = useClasses();
  const isControlled = open !== undefined;
  const resolvedOpen = open ?? internalOpen;
  const setDialogOpen = (nextOpen: boolean) => {
    if (!isControlled) setInternalOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedClassKkm = parseInt(classKkm, 10);
    const trimmedName = limitClassName(name.trim());
    const trimmedDescription = limitClassDescription(description.trim());
    if (!trimmedName || Number.isNaN(parsedClassKkm) || parsedClassKkm < 0 || parsedClassKkm > 100) return;

    const createdClass = await createClass.mutateAsync({
      name: trimmedName,
      description: trimmedDescription || undefined,
      class_kkm: parsedClassKkm,
    });

    setName("");
    setDescription("");
    setClassKkm("75");
    onCreated?.(createdClass as Class);
    setDialogOpen(false);
  };

  return (
    <Dialog open={resolvedOpen} onOpenChange={setDialogOpen}>
      {trigger !== null ? (
        <DialogTrigger asChild>
          {trigger || (
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Tambah Kelas
            </Button>
          )}
        </DialogTrigger>
      ) : null}
      <DialogContent
        className="sm:max-w-[425px]"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          requestAnimationFrame(() => titleRef.current?.focus());
        }}
      >
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle ref={titleRef} tabIndex={-1} className="outline-none">
              Tambah Kelas Baru
            </DialogTitle>
            <DialogDescription>
              Isi identitas kelas. KKM kelas menjadi acuan awal untuk ranking dan mapel baru.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="class-name">Nama Kelas *</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {name.length}/{CLASS_NAME_MAX_LENGTH}
                </span>
              </div>
              <Input
                id="class-name"
                placeholder="Contoh: V-A"
                value={name}
                onChange={(e) => setName(limitClassName(e.target.value))}
                maxLength={CLASS_NAME_MAX_LENGTH}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="class-desc">Deskripsi (opsional)</Label>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {description.length}/{CLASS_DESCRIPTION_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="class-desc"
                placeholder="Catatan tentang kelas ini..."
                value={description}
                onChange={(e) => setDescription(limitClassDescription(e.target.value))}
                maxLength={CLASS_DESCRIPTION_MAX_LENGTH}
                rows={3}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-kkm">KKM Kelas *</Label>
              <Input
                id="class-kkm"
                type="number"
                min="0"
                max="100"
                placeholder="75"
                value={classKkm}
                onChange={(e) => setClassKkm(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Dipakai sebagai acuan ranking keseluruhan kelas dan menjadi nilai default KKM semua mapel baru di kelas ini.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialogOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={!name.trim() || !classKkm.trim() || createClass.isPending}
            >
              {createClass.isPending ? (
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

import { useState } from "react";
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
import { useClasses } from "@/hooks/useClasses";

interface AddClassDialogProps {
  trigger?: React.ReactNode;
}

export default function AddClassDialog({ trigger }: AddClassDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [classKkm, setClassKkm] = useState("75");
  const { createClass } = useClasses();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const parsedClassKkm = parseInt(classKkm, 10);
    if (!name.trim() || Number.isNaN(parsedClassKkm) || parsedClassKkm < 0 || parsedClassKkm > 100) return;

    await createClass.mutateAsync({
      name: name.trim(),
      description: description.trim() || undefined,
      class_kkm: parsedClassKkm,
    });

    setName("");
    setDescription("");
    setClassKkm("75");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Tambah Kelas
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Tambah Kelas Baru</DialogTitle>
            <DialogDescription>
              Masukkan nama kelas dan KKM kelas. KKM kelas akan dipakai sebagai default saat membuat KKM mapel, tetapi tetap bisa diubah per mapel nanti.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="class-name">Nama Kelas *</Label>
              <Input
                id="class-name"
                placeholder="Contoh: V-A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="class-desc">Deskripsi (opsional)</Label>
              <Textarea
                id="class-desc"
                placeholder="Catatan tentang kelas ini..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
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
              onClick={() => setOpen(false)}
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

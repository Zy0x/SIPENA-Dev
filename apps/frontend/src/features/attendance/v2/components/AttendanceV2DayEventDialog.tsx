import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AttendanceV2DayEventDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  existingLabel?: string;
  existingDescription?: string;
  existingColor?: string;
  onSave: (args: { label: string; description: string; color: string }) => Promise<void>;
  onDelete?: () => Promise<void>;
  isLoading: boolean;
}

export const AttendanceV2DayEventDialog: React.FC<AttendanceV2DayEventDialogProps> = ({
  isOpen,
  onClose,
  dateStr,
  existingLabel = "",
  existingDescription = "",
  existingColor = "blue",
  onSave,
  onDelete,
  isLoading,
}) => {
  const [label, setLabel] = useState(existingLabel);
  const [description, setDescription] = useState(existingDescription);
  const [color, setColor] = useState(existingColor);

  React.useEffect(() => {
    setLabel(existingLabel);
    setDescription(existingDescription);
    setColor(existingColor);
  }, [existingLabel, existingDescription, existingColor, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ label, description, color });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur Kegiatan Sekolah</DialogTitle>
          <DialogDescription>
            Menambahkan informasi kegiatan sekolah pada tanggal {dateStr}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="label">Nama Kegiatan</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Contoh: Classmeeting / Pembagian Rapor"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="desc">Deskripsi Tambahan</Label>
            <Input
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail kegiatan..."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="color">Warna Indikator</Label>
            <select
              id="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg dark:bg-slate-900 dark:border-slate-800"
            >
              <option value="blue">Biru (Umum)</option>
              <option value="green">Hijau (Akademik)</option>
              <option value="amber">Kuning (Ujian)</option>
              <option value="red">Merah (Penting)</option>
            </select>
          </div>
          <DialogFooter className="flex justify-between items-center">
            {onDelete && existingLabel && (
              <Button type="button" variant="ghost" className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20" onClick={onDelete} disabled={isLoading}>
                Hapus Event
              </Button>
            )}
            <div className="flex space-x-2 ml-auto">
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Batal
              </Button>
              <Button type="submit" disabled={isLoading}>
                Simpan Event
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

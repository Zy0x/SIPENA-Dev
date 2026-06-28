import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AttendanceV2HolidayDialogProps {
  isOpen: boolean;
  onClose: () => void;
  dateStr: string;
  existingDescription?: string;
  onSave: (description: string) => Promise<void>;
  isLoading: boolean;
}

export const AttendanceV2HolidayDialog: React.FC<AttendanceV2HolidayDialogProps> = ({
  isOpen,
  onClose,
  dateStr,
  existingDescription = "",
  onSave,
  isLoading,
}) => {
  const [description, setDescription] = useState(existingDescription);

  React.useEffect(() => {
    setDescription(existingDescription);
  }, [existingDescription, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(description);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Atur Hari Libur Kustom</DialogTitle>
          <DialogDescription>
            Menetapkan tanggal {dateStr} sebagai hari libur kustom sekolah.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi Libur</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Libur khusus sekolah / Ujian Akhir Semester"
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              Simpan Libur
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

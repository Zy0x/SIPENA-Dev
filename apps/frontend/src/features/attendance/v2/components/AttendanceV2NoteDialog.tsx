import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface AttendanceV2NoteDialogProps {
  isOpen: boolean;
  onClose: () => void;
  studentName: string;
  dateStr: string;
  existingNote?: string;
  onSave: (note: string | null) => Promise<void>;
  isLoading: boolean;
}

export const AttendanceV2NoteDialog: React.FC<AttendanceV2NoteDialogProps> = ({
  isOpen,
  onClose,
  studentName,
  dateStr,
  existingNote = "",
  onSave,
  isLoading,
}) => {
  const [note, setNote] = useState(existingNote);

  React.useEffect(() => {
    setNote(existingNote);
  }, [existingNote, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave(note.trim() ? note : null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Catatan Presensi Murid</DialogTitle>
          <DialogDescription>
            Tulis alasan atau keterangan untuk {studentName} pada tanggal {dateStr}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="note">Catatan Alasan</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Sakit flu disertai demam tinggi / Izin lomba perwakilan sekolah"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Batal
            </Button>
            <Button type="submit" disabled={isLoading}>
              Simpan Catatan
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

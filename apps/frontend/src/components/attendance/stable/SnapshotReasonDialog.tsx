import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Camera, Loader2 } from "lucide-react";

interface SnapshotReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snapshotReason: string;
  setSnapshotReason: (reason: string) => void;
  handleCreateSnapshotAction: () => Promise<void>;
  isCreatingSnapshot: boolean;
}

export const SnapshotReasonDialog: React.FC<SnapshotReasonDialogProps> = ({
  open,
  onOpenChange,
  snapshotReason,
  setSnapshotReason,
  handleCreateSnapshotAction,
  isCreatingSnapshot,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
            <Camera className="w-5 h-5 text-primary" />
            <span>Simpan Snapshot Presensi</span>
          </DialogTitle>
          <DialogDescription className="pt-2 text-muted-foreground text-sm">
            Snapshot akan mengunci seluruh rekapitulasi data presensi pada bulan ini sebagai catatan historis tetap.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Catatan / Alasan Snapshot (Opsional)</Label>
            <Input
              placeholder="Contoh: Rilis Laporan Bulanan Akhir"
              value={snapshotReason}
              onChange={(e) => setSnapshotReason(e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => onOpenChange(false)} 
            className="rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleCreateSnapshotAction}
            disabled={isCreatingSnapshot}
            className="rounded-xl gap-1.5"
          >
            {isCreatingSnapshot && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Simpan Snapshot</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

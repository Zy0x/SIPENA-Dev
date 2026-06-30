import React from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Loader2 } from "lucide-react";

interface MergeV2toV1DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClass: any;
  currentMonth: Date;
  handlePromote: () => Promise<void>;
  isPromoting: boolean;
}

export const MergeV2toV1Dialog: React.FC<MergeV2toV1DialogProps> = ({
  open,
  onOpenChange,
  selectedClass,
  currentMonth,
  handlePromote,
  isPromoting,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
            <AlertCircle className="w-5 h-5 text-emerald-600" />
            <span>Merge Data V2 ke V1</span>
          </DialogTitle>
          <DialogDescription className="pt-2 text-muted-foreground text-sm leading-relaxed">
            Apakah Anda yakin ingin memindahkan data hasil eksperimen V2 ke V1 (Produksi)?
            <br /><br />
            Tindakan ini akan <strong>menimpa data presensi, hari libur, kegiatan khusus, dan status penguncian</strong> untuk kelas <strong>{selectedClass?.name}</strong> pada bulan <strong>{format(currentMonth, "MMMM yyyy", { locale: idLocale })}</strong> di V1 dengan data dari V2.
            <br /><br />
            Data pengguna lain tidak akan terganggu. Tindakan ini tidak dapat dibatalkan.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0 mt-4">
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
            onClick={handlePromote}
            disabled={isPromoting}
            className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-1.5"
          >
            {isPromoting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Ya, Merge Data</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

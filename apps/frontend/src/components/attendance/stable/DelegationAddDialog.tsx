import React from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { UserPlus, Loader2 } from "lucide-react";

interface DelegationAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  delegationTargetEmail: string;
  setDelegationTargetEmail: (email: string) => void;
  delegationStartsAt: Date;
  setDelegationStartsAt: (date: Date) => void;
  delegationEndsAt: Date;
  setDelegationEndsAt: (date: Date) => void;
  handleCreateDelegationAction: () => Promise<void>;
  isCreatingDelegation: boolean;
}

export const DelegationAddDialog: React.FC<DelegationAddDialogProps> = ({
  open,
  onOpenChange,
  delegationTargetEmail,
  setDelegationTargetEmail,
  delegationStartsAt,
  setDelegationStartsAt,
  delegationEndsAt,
  setDelegationEndsAt,
  handleCreateDelegationAction,
  isCreatingDelegation,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Delegasikan Guru Pengganti</span>
          </DialogTitle>
          <DialogDescription className="pt-2 text-muted-foreground text-sm">
            Berikan akses temporer untuk membaca dan menulis data presensi kelas ini ke guru lain.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Email Guru Pengganti</Label>
            <Input
              type="email"
              placeholder="Contoh: guru.pengganti@sekolah.sch.id"
              value={delegationTargetEmail}
              onChange={(e) => setDelegationTargetEmail(e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal Mulai</Label>
              <Input
                type="date"
                value={format(delegationStartsAt, "yyyy-MM-dd")}
                onChange={(e) => setDelegationStartsAt(e.target.value ? new Date(e.target.value) : new Date())}
                className="h-9 text-sm rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tanggal Selesai</Label>
              <Input
                type="date"
                value={format(delegationEndsAt, "yyyy-MM-dd")}
                onChange={(e) => setDelegationEndsAt(e.target.value ? new Date(e.target.value) : new Date())}
                className="h-9 text-sm rounded-xl"
              />
            </div>
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
            onClick={handleCreateDelegationAction}
            disabled={isCreatingDelegation || !delegationTargetEmail.trim()}
            className="rounded-xl gap-1.5"
          >
            {isCreatingDelegation && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>Delegasikan</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import React, { useState } from "react";
import { Check, Info, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ClassType {
  id: string;
  name: string;
}

interface BulkApplySettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classes: ClassType[];
  currentClassId: string;
  onApply: (selectedClassIds: string[]) => Promise<void>;
  isLoading: boolean;
}

export function BulkApplySettingsDialog({
  open,
  onOpenChange,
  classes,
  currentClassId,
  onApply,
  isLoading,
}: BulkApplySettingsDialogProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const availableClasses = classes.filter(c => c.id !== currentClassId && c.id !== "tour-dummy-class");
  const allSelected = availableClasses.length > 0 && selectedIds.length === availableClasses.length;

  const handleToggleAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(availableClasses.map(c => c.id));
    }
  };

  const handleToggle = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleApply = async () => {
    if (selectedIds.length === 0) return;
    await onApply(selectedIds);
    onOpenChange(false);
    setSelectedIds([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Terapkan ke Kelas Lain
          </DialogTitle>
          <DialogDescription>
            Pilih kelas yang akan menerima salinan Libur Kustom dan Kegiatan Khusus. Data agenda di kelas target tidak dihapus, melainkan ditambahkan dengan data dari kelas ini.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center space-x-2 mb-4 pb-4 border-b">
            <Checkbox 
              id="select-all" 
              checked={allSelected} 
              onCheckedChange={handleToggleAll} 
              disabled={isLoading || availableClasses.length === 0}
            />
            <Label htmlFor="select-all" className="font-semibold cursor-pointer">
              Pilih Semua Kelas ({availableClasses.length})
            </Label>
          </div>

          <ScrollArea className="h-[200px] pr-4">
            {availableClasses.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8">
                Tidak ada kelas lain yang tersedia.
              </div>
            ) : (
              <div className="space-y-3">
                {availableClasses.map((cls) => (
                  <div key={cls.id} className="flex items-center space-x-3">
                    <Checkbox 
                      id={`class-${cls.id}`} 
                      checked={selectedIds.includes(cls.id)} 
                      onCheckedChange={() => handleToggle(cls.id)} 
                      disabled={isLoading}
                    />
                    <Label 
                      htmlFor={`class-${cls.id}`} 
                      className="text-sm font-medium leading-none cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {cls.name}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading} className="rounded-xl">
            Batal
          </Button>
          <Button 
            onClick={handleApply} 
            disabled={selectedIds.length === 0 || isLoading}
            className="rounded-xl gap-2"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Terapkan ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

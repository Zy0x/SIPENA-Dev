import React, { useState } from "react";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, ShieldCheck, BadgeAlert } from "lucide-react";
import {
  listAllStatuses,
  registerCustomStatus,
} from "../rules/statusEngine";
import type {
  AttendanceStatusDefinitionV2,
  AttendanceStatusBehaviorFlag
} from "../rules/ruleEngine.types";
import { useEnhancedToast } from "@/contexts/ToastContext";

interface AttendanceV2StatusRegistryDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRegistryUpdated: () => void;
}

export const AttendanceV2StatusRegistryDialog: React.FC<AttendanceV2StatusRegistryDialogProps> = ({
  isOpen,
  onClose,
  onRegistryUpdated,
}) => {
  const { toast: showToast } = useEnhancedToast();
  const [statuses, setStatuses] = useState<any[]>([]);
  
  // Form State
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [weight, setWeight] = useState("0");
  const [exportCode, setExportCode] = useState("");
  const [colorToken, setColorToken] = useState("gray");
  
  // Flag states
  const [countsAsPresent, setCountsAsPresent] = useState(false);
  const [countsAsAbsence, setCountsAsAbsence] = useState(false);
  const [requiresNote, setRequiresNote] = useState(false);

  // Load statuses
  React.useEffect(() => {
    if (isOpen) {
      setStatuses(listAllStatuses());
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim() || !label.trim() || !exportCode.trim()) {
      showToast({ title: "Validasi Gagal", description: "Semua kolom wajib diisi.", variant: "error" });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    if (statuses.some((s) => s.code === cleanCode)) {
      showToast({ title: "Kode Duplikat", description: `Kode status '${cleanCode}' sudah terdaftar.`, variant: "error" });
      return;
    }

    const behaviorFlags: AttendanceStatusBehaviorFlag[] = [];
    if (requiresNote) behaviorFlags.push("REQUIRES_NOTE");
    if (countsAsPresent) behaviorFlags.push("COUNTS_AS_PRESENT");
    if (countsAsAbsence) behaviorFlags.push("COUNTS_AS_ABSENCE");

    const newStatus: any = {
      code: cleanCode,
      label: label.trim(),
      weight: parseFloat(weight) || 0,
      countsAsPresent,
      countsAsAbsence,
      exportCode: exportCode.trim().toUpperCase(),
      colorToken,
      behaviorFlags,
    };

    try {
      registerCustomStatus(newStatus);
      showToast({
        title: "Status Terdaftar",
        description: `Status '${label}' (${cleanCode}) berhasil ditambahkan ke V2 Status Engine.`,
        variant: "success",
      });
      // Reset form
      setCode("");
      setLabel("");
      setWeight("0");
      setExportCode("");
      setColorToken("gray");
      setCountsAsPresent(false);
      setCountsAsAbsence(false);
      setRequiresNote(false);
      
      // Refresh list
      const updated = listAllStatuses();
      setStatuses(updated);
      onRegistryUpdated();
    } catch (err: any) {
      showToast({ title: "Registrasi Gagal", description: err.message || "Gagal mendaftarkan status.", variant: "error" });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md md:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-purple-600" />
            <span>V2 Status Engine Registry Manager</span>
          </DialogTitle>
          <DialogDescription>
            Lihat daftar status kehadiran yang didukung oleh V2 Engine dan daftarkan kode status baru secara dinamis.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          {/* Status List */}
          <div className="space-y-3">
            <Label className="font-bold text-slate-800 dark:text-slate-200">Status Terdaftar Aktif</Label>
            <div className="border rounded-lg bg-slate-50/50 dark:bg-slate-900/10 p-2">
              <ScrollArea className="h-[280px]">
                <div className="space-y-2 pr-2">
                  {statuses.map((s) => {
                    const hasNote = s.behaviorFlags.includes("REQUIRES_NOTE");
                    const countsPres = s.behaviorFlags.includes("COUNTS_AS_PRESENT") || s.countsAsPresent;
                    const countsAbs = s.behaviorFlags.includes("COUNTS_AS_ABSENCE") || s.countsAsAbsence;

                    return (
                      <div
                        key={s.code}
                        className="p-2 border rounded-md flex items-center justify-between text-xs bg-white dark:bg-slate-950 shadow-sm"
                      >
                        <div className="flex items-center space-x-2">
                          <span className={`w-6 h-6 rounded flex items-center justify-center font-bold font-mono border ${
                            s.colorToken === "green" ? "bg-emerald-50 text-emerald-700 border-emerald-100" :
                            s.colorToken === "blue" ? "bg-sky-50 text-sky-700 border-sky-100" :
                            s.colorToken === "orange" ? "bg-amber-50 text-amber-700 border-amber-100" :
                            s.colorToken === "red" ? "bg-rose-50 text-rose-700 border-rose-100" :
                            s.colorToken === "purple" ? "bg-purple-50 text-purple-700 border-purple-100" :
                            "bg-slate-50 text-slate-700 border-slate-200"
                          }`}>
                            {s.code}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-200">{s.label}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5 text-[9px]">
                              {countsPres && <span className="px-1 bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400 rounded">Hadir</span>}
                              {countsAbs && <span className="px-1 bg-rose-100 text-rose-800 dark:bg-rose-950/30 dark:text-rose-400 rounded">Absen</span>}
                              {hasNote && <span className="px-1 bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400 rounded">Wajib Catatan</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-500 font-mono">
                          <p>Bobot: {s.weight}</p>
                          <p>Ekspor: {s.exportCode}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* Add Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <Label className="font-bold text-slate-800 dark:text-slate-200">Daftarkan Kode Status Kustom</Label>
            <div className="space-y-3 p-3 border rounded-lg bg-slate-50/50 dark:bg-slate-900/10">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="reg-code" className="text-[10px] uppercase font-semibold">Kode Status</Label>
                  <Input
                    id="reg-code"
                    maxLength={2}
                    placeholder="Contoh: T"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-export" className="text-[10px] uppercase font-semibold">Kode Ekspor</Label>
                  <Input
                    id="reg-export"
                    maxLength={2}
                    placeholder="Contoh: T"
                    value={exportCode}
                    onChange={(e) => setExportCode(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="reg-label" className="text-[10px] uppercase font-semibold">Nama Status</Label>
                <Input
                  id="reg-label"
                  placeholder="Contoh: Terlambat"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label htmlFor="reg-weight" className="text-[10px] uppercase font-semibold">Bobot (0 - 1)</Label>
                  <Input
                    id="reg-weight"
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reg-color" className="text-[10px] uppercase font-semibold">Token Warna</Label>
                  <Select value={colorToken} onValueChange={setColorToken}>
                    <SelectTrigger id="reg-color">
                      <SelectValue placeholder="Pilih Warna" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="green">Hijau (Emerald)</SelectItem>
                      <SelectItem value="blue">Biru (Sky)</SelectItem>
                      <SelectItem value="orange">Orange (Amber)</SelectItem>
                      <SelectItem value="red">Merah (Rose)</SelectItem>
                      <SelectItem value="purple">Ungu (Purple)</SelectItem>
                      <SelectItem value="gray">Abu-abu (Slate)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t text-xs">
                <p className="text-[10px] uppercase font-semibold text-slate-500 mb-1">Perilaku Status (Behavior Flags)</p>
                <div className="flex flex-col space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flag-present"
                      checked={countsAsPresent}
                      onCheckedChange={(c) => {
                        setCountsAsPresent(!!c);
                        if (c) setCountsAsAbsence(false);
                      }}
                    />
                    <Label htmlFor="flag-present" className="text-xs font-normal cursor-pointer select-none">
                      Hitung sebagai Kehadiran (Counts as Present)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flag-absence"
                      checked={countsAsAbsence}
                      onCheckedChange={(c) => {
                        setCountsAsAbsence(!!c);
                        if (c) setCountsAsPresent(false);
                      }}
                    />
                    <Label htmlFor="flag-absence" className="text-xs font-normal cursor-pointer select-none">
                      Hitung sebagai Absen/Mangkir (Counts as Absence)
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="flag-note"
                      checked={requiresNote}
                      onCheckedChange={(c) => setRequiresNote(!!c)}
                    />
                    <Label htmlFor="flag-note" className="text-xs font-normal cursor-pointer select-none text-amber-700 dark:text-amber-400 font-semibold">
                      Wajib Isi Catatan Alasan (Requires Note)
                    </Label>
                  </div>
                </div>
              </div>

              <Button type="submit" size="sm" className="w-full flex items-center justify-center space-x-1 bg-purple-600 hover:bg-purple-700 mt-2">
                <Plus className="w-3.5 h-3.5" />
                <span>Daftarkan Kode Status</span>
              </Button>
            </div>
          </form>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

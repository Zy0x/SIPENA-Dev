import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, AlertCircle, Database, CheckCircle } from "lucide-react";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface PendingClass {
  class_id: string;
  class_name: string;
  month: string;
  record_count: number;
}

interface AttendanceMergePanelProps {
  adminPassword: () => string;
}

export const AttendanceMergePanel: React.FC<AttendanceMergePanelProps> = ({ adminPassword }) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [pendingClasses, setPendingClasses] = useState<PendingClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [workDayFormat, setWorkDayFormat] = useState<"5days" | "6days">("6days");

  const fetchPendingClasses = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "v2-pending-list",
          password: adminPassword(),
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Gagal mengambil data V2.");
      }
      setPendingClasses(result.data || []);
      setSelectedClassId("");
      setSelectedMonth("");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Mengambil Data",
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingClasses();
  }, []);

  const handleMerge = async () => {
    if (!selectedClassId || !selectedMonth) {
      toast({ variant: "destructive", title: "Peringatan", description: "Pilih kelas dan bulan terlebih dahulu." });
      return;
    }

    if (!confirm("Peringatan Destruktif!\n\nTindakan ini akan menimpa data absensi produksi (V1) dengan data eksperimen (V2). Lanjutkan?")) {
      return;
    }

    setIsMerging(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "v2-promote",
          password: adminPassword(),
          classId: selectedClassId,
          month: selectedMonth,
          workDayFormat,
        }),
      });

      const result = await response.json();
      if (!response.ok || result.error) {
        throw new Error(result.error || "Gagal memproses merge.");
      }

      toast({
        title: "Merge Berhasil",
        description: `Data V2 berhasil digabungkan ke Produksi (V1) untuk bulan ${selectedMonth}.`,
      });
      
      // Refresh list
      fetchPendingClasses();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Merge Gagal",
        description: error.message,
      });
    } finally {
      setIsMerging(false);
    }
  };

  // Filter available months for the selected class
  const availableMonths = pendingClasses
    .filter((pc) => pc.class_id === selectedClassId)
    .map((pc) => pc.month);

  const uniqueClasses = Array.from(new Map(pendingClasses.map(item => [item.class_id, item])).values());

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
          <Database className="w-5 h-5 text-emerald-500" />
          Merge Data Presensi V2 ke Produksi (V1)
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          Modul ini hanya dapat diakses oleh Admin. Gunakan modul ini untuk menggabungkan data eksperimen (V2) para guru ke tabel produksi utama (V1).
        </p>
      </div>

      <Card className="border-emerald-500/20 shadow-sm">
        <CardHeader className="bg-emerald-50/50 dark:bg-emerald-950/20 border-b border-border/50">
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-base font-semibold text-emerald-700 dark:text-emerald-400">
                Pilih Data Target
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Data akan ditimpa (Overwrite) pada bulan dan kelas yang dipilih.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchPendingClasses} disabled={isLoading} className="h-8 text-xs">
              {isLoading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Refresh Data
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-5 space-y-5">
          {pendingClasses.length === 0 && !isLoading ? (
            <div className="text-center p-6 border border-dashed rounded-xl bg-muted/20">
              <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-muted-foreground">Tidak ada data V2 yang menunggu (Pending) untuk di-merge.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Pilih Kelas</Label>
                <Select value={selectedClassId} onValueChange={(val) => { setSelectedClassId(val); setSelectedMonth(""); }}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="-- Pilih Kelas --" />
                  </SelectTrigger>
                  <SelectContent>
                    {uniqueClasses.map((cls) => (
                      <SelectItem key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Pilih Bulan</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth} disabled={!selectedClassId}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="-- Pilih Bulan --" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMonths.map((m) => (
                      <SelectItem key={m} value={m}>
                        {format(parseISO(`${m}-01`), "MMMM yyyy", { locale: idLocale })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground font-semibold">Format Hari Kerja</Label>
                <Select value={workDayFormat} onValueChange={(val: any) => setWorkDayFormat(val)}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6days">6 Hari (Senin - Sabtu)</SelectItem>
                    <SelectItem value="5days">5 Hari (Senin - Jumat)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  Jika memilih 5 hari, data hari Sabtu di V2 akan diabaikan (dihapus saat merge).
                </p>
              </div>
            </div>
          )}

          {selectedClassId && selectedMonth && (
            <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="flex gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="space-y-1 text-amber-800 dark:text-amber-200 text-sm">
                  <p className="font-semibold">Konfirmasi Penggabungan</p>
                  <p className="leading-relaxed opacity-90">
                    Dengan menekan tombol di bawah, Anda akan menimpa seluruh rekaman absensi, libur, event, dan kunci (lock) di <strong>Produksi (V1)</strong> untuk kelas dan bulan yang dipilih dengan data dari <strong>Sandbox (V2)</strong>.
                  </p>
                </div>
              </div>
              <div className="mt-4 flex justify-end">
                <Button
                  onClick={handleMerge}
                  disabled={isMerging}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md w-full sm:w-auto"
                >
                  {isMerging && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Eksekusi Merge ke V1
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

import React from "react";
import {
  Check,
  FileSpreadsheet,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";

import type { RecapProfile } from "@/hooks/useAttendanceStable";
import { DEFAULT_STATUSES } from "@/components/attendance/JumlahCalculationConfig";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALL_STATUSES = ["H", "S", "I", "A", "D"];
const STATUS_LABELS: Record<string, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpha",
  D: "Dispensasi",
};
const STATUS_COLORS: Record<string, string> = {
  H: "bg-grade-pass/20 text-grade-pass border-grade-pass/30",
  S: "bg-grade-warning/20 text-grade-warning border-grade-warning/30",
  I: "bg-primary/20 text-primary border-primary/30",
  A: "bg-grade-fail/20 text-grade-fail border-grade-fail/30",
  D: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

import {
  SectionIntro,
  InfoHelp,
  EmptyState,
  statusLabels,
} from "./SettingsShared";

export interface RecapSectionProps {
  recapProfile: RecapProfile | null;
  handleUpdateRecapProfile: (data: Partial<RecapProfile>) => void;
  handleToggleRecapStatus: (type: "present" | "absence", status: "H" | "S" | "I" | "A" | "D") => void;
  effectiveDays: number;
  showNISNDaily?: boolean;
  setShowNISNDaily?: (value: boolean) => void;
  showNISNMonthly?: boolean;
  setShowNISNMonthly?: (value: boolean) => void;
}

export const RecapSection: React.FC<RecapSectionProps> = ({
  recapProfile,
  handleUpdateRecapProfile,
  handleToggleRecapStatus,
  effectiveDays,
  showNISNDaily,
  setShowNISNDaily,
  showNISNMonthly,
  setShowNISNMonthly,
}) => {
  return (
    <div className="space-y-4" data-tour="attendance-settings-recap">
      <SectionIntro
        icon={FileSpreadsheet}
        title="Aturan Rekapitulasi Presensi"
        description="Sesuaikan kebijakan pembagi persentase kehadiran murid dan petakan status (Sakit, Izin, Alfa, Dispen) agar terhitung sebagai Hadir atau Absen."
        help={
          <InfoHelp
            label="Profil Rekap"
            summary="Mengatur cara sistem mengkalkulasi rekapitulasi kehadiran."
            detail="Aturan rekap tidak mengubah database presensi mentah, hanya menentukan cara pengolahan angka saat rekap bulanan atau export laporan."
            example="Sekolah dapat memilih apakah Dispensasi dihitung sebagai Hadir (Masuk) atau Absen (Tidak Masuk)."
            impact="Merubah pemetaan status langsung memengaruhi statistik persentase kehadiran di rapor murid."
          />
        }
      />

      {!recapProfile ? (
        <EmptyState icon={Info} text="Aturan rekap belum tersedia." />
      ) : (
        <div className="grid gap-4">
          {/* Denominator Card */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-recap-denominator">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-foreground">Dasar Pembagi Kehadiran (Denominator)</h4>
              <p className="text-xs text-muted-foreground">Tentukan dasar pembagian matematika untuk menghitung persentase kehadiran.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  value: "effective_days" as const,
                  label: "Bagi Hari Efektif Sekolah",
                  desc: `Dibagi berdasarkan total ${effectiveDays} hari sekolah aktif dalam kalender. Digunakan untuk pelaporan rapor bulanan resmi.`,
                },
                {
                  value: "filled_days" as const,
                  label: "Bagi Hari Terisi Presensi",
                  desc: "Dibagi berdasarkan jumlah tanggal yang sudah Anda isi absensinya saja. Ideal untuk memantau progress di tengah bulan.",
                },
              ].map((item) => {
                const active = recapProfile.denominator_policy === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleUpdateRecapProfile({ denominator_policy: item.value })}
                    className={cn(
                      "flex min-h-[84px] touch-manipulation items-center justify-between rounded-2xl border-2 p-4 text-left transition-all",
                      active
                        ? "border-primary bg-primary/5 text-primary shadow-sm"
                        : "border-muted bg-background hover:bg-muted/40 active:bg-muted/60"
                    )}
                  >
                    <div className="pr-2">
                      <span className="block text-sm font-bold leading-tight">{item.label}</span>
                      <span className="block text-xs mt-1 text-muted-foreground leading-normal">{item.desc}</span>
                    </div>
                    <div className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-all",
                      active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/30"
                    )}>
                      {active && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logika Kolom Jumlah Card */}
          {recapProfile && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-recap-jumlah">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Logika Kolom Jumlah</h4>
                  <p className="text-xs text-muted-foreground">Pilih status apa saja yang akan dihitung dan dijumlahkan pada kolom "Jumlah" di Tabel Rekap Bulanan.</p>
                </div>
                {(!(recapProfile.counted_statuses?.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(s => recapProfile.counted_statuses?.includes(s as any)))) && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-[10px] gap-1 shrink-0" 
                    onClick={() => {
                      handleUpdateRecapProfile({ counted_statuses: DEFAULT_STATUSES as ("H"|"I"|"S"|"A"|"D")[] });
                    }}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span className="hidden sm:inline">Reset Default</span>
                  </Button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {ALL_STATUSES.map((status) => {
                  const isChecked = (recapProfile.counted_statuses || DEFAULT_STATUSES).includes(status);
                  
                  return (
                    <label key={status} className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all touch-manipulation",
                      isChecked ? "border-primary bg-primary/5" : "border-muted bg-background hover:bg-muted/40"
                    )}>
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(checked) => {
                          const currentStatuses = recapProfile.counted_statuses || (DEFAULT_STATUSES as ("H"|"I"|"S"|"A"|"D")[]);
                          const newStatuses = checked
                            ? [...currentStatuses, status as ("H"|"I"|"S"|"A"|"D")]
                            : currentStatuses.filter((s) => s !== status);
                          
                          handleUpdateRecapProfile({ counted_statuses: newStatuses });
                        }}
                      />
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold">{STATUS_LABELS[status]}</span>
                          <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-sm border", STATUS_COLORS[status])}>
                            {status}
                          </span>
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div className="mt-3 pt-3 border-t border-border flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground">
                  Status Terpilih: {" "}
                  {(recapProfile.counted_statuses?.length === DEFAULT_STATUSES.length && DEFAULT_STATUSES.every(s => recapProfile.counted_statuses?.includes(s as any))) || !recapProfile.counted_statuses ? (
                    <strong className="text-foreground">{DEFAULT_STATUSES.join(" + ")} (Default)</strong>
                  ) : (
                    <strong className="text-primary">{recapProfile.counted_statuses.join(" + ") || "Tidak ada"}</strong>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Status Mapping Card */}
          <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-recap-mapping">
            <div className="mb-3">
              <h4 className="text-sm font-bold text-foreground">Pemetaan Kelompok Status Kehadiran</h4>
              <p className="text-xs text-muted-foreground">Petakan masing-masing status KBM murid agar masuk dalam kategori hadir fisik atau tidak hadir.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {[
                {
                  type: "present" as const,
                  title: "Dihitung Hadir Fisik (Masuk)",
                  desc: "Status murid yang dianggap hadir sekolah secara fisik dan menambah nilai persentase masuk.",
                  list: recapProfile.present_statuses,
                  tone: "green",
                },
                {
                  type: "absence" as const,
                  title: "Dihitung Tidak Hadir (Absen)",
                  desc: "Status murid yang dihitung sebagai ketidakhadiran (absen) di rekap nilai.",
                  list: recapProfile.absence_statuses,
                  tone: "red",
                },
              ].map((group) => (
                <div
                  key={group.type}
                  className={cn(
                    "rounded-2xl border p-4 transition-all shadow-sm",
                    group.tone === "green"
                      ? "border-green-200 bg-green-50/20 dark:border-green-950/40 dark:bg-green-950/5"
                      : "border-red-200 bg-red-50/20 dark:border-red-950/40 dark:bg-red-950/5"
                  )}
                >
                  <div className="mb-2">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                        group.tone === "green"
                          ? "bg-green-100 text-green-700 dark:bg-green-900/60 dark:text-green-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/60 dark:text-red-300"
                      )}>
                        <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                      </span>
                      <span className={cn(
                        "text-xs font-bold uppercase tracking-wider",
                        group.tone === "green" ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"
                      )}>{group.title}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{group.desc}</p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mt-3">
                    {(["H", "S", "I", "A", "D"] as const).map((status) => {
                      const selected = group.list.includes(status);
                      return (
                        <button
                          key={`${group.type}-${status}`}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => handleToggleRecapStatus(group.type, status)}
                          className={cn(
                            "min-h-[48px] rounded-xl border-2 transition-all flex flex-col items-center justify-center gap-0.5 touch-manipulation",
                            selected && group.tone === "green" && "border-green-500 bg-green-500 text-white font-bold shadow-md dark:border-green-600 dark:bg-green-600",
                            selected && group.tone === "red" && "border-red-500 bg-red-500 text-white font-bold shadow-md dark:border-red-600 dark:bg-red-600",
                            !selected && "border-muted bg-background text-muted-foreground hover:bg-muted/40 active:bg-muted/60"
                          )}
                        >
                          <span className="text-sm font-extrabold leading-none">{status}</span>
                          <span className="text-[9px] leading-none opacity-80">{statusLabels[status]}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Tampilan NISN */}
          {setShowNISNDaily && setShowNISNMonthly && (
            <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-recap-nisn">
              <div className="mb-3">
                <h4 className="text-sm font-bold text-foreground">Tampilan NISN (Desktop)</h4>
                <p className="text-xs text-muted-foreground">
                  Tampilkan NISN sebagai sub-teks nama murid pada perangkat desktop. Data tetap terindeks dan bisa dicari meski tampilan NISN disembunyikan.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex min-h-[84px] items-center justify-between rounded-2xl border border-muted bg-background p-4 shadow-sm">
                  <div className="pr-2">
                    <span className="block text-sm font-bold leading-tight">Tabel Harian</span>
                    <span className="block text-xs mt-1 text-muted-foreground leading-normal">Tampilkan di mode presensi harian</span>
                  </div>
                  <Switch
                    checked={showNISNDaily}
                    onCheckedChange={setShowNISNDaily}
                  />
                </div>
                <div className="flex min-h-[84px] items-center justify-between rounded-2xl border border-muted bg-background p-4 shadow-sm">
                  <div className="pr-2">
                    <span className="block text-sm font-bold leading-tight">Tabel Bulanan</span>
                    <span className="block text-xs mt-1 text-muted-foreground leading-normal">Tampilkan di mode rekap bulanan</span>
                  </div>
                  <Switch
                    checked={showNISNMonthly}
                    onCheckedChange={setShowNISNMonthly}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

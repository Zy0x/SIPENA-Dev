import React from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Camera,
  RotateCcw,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { DayEvent, HolidayRecord, MonthSnapshot } from "@/hooks/useAttendanceStable";

import {
  SectionIntro,
  InfoHelp,
  CompactMetric,
  EmptyState,
} from "./SettingsShared";

export interface BackupSectionProps {
  snapshots: MonthSnapshot[];
  handleRestoreSnapshotAction: (id: string) => Promise<void>;
  isRestoringSnapshot: boolean;
  isCreatingSnapshot: boolean;
  onAddSnapshotClick: () => void;
  monthDays: Date[];
  effectiveDays: number;
  holidays: HolidayRecord[];
  dayEvents: DayEvent[];
}

export const BackupSection: React.FC<BackupSectionProps> = ({
  snapshots,
  handleRestoreSnapshotAction,
  isRestoringSnapshot,
  isCreatingSnapshot,
  onAddSnapshotClick,
  monthDays,
  effectiveDays,
  holidays,
  dayEvents,
}) => {
  const customHolidayCount = holidays.filter((h) => h.description !== "Hari Kerja").length;

  return (
    <div className="space-y-4" data-tour="attendance-settings-backup">
      <SectionIntro
        icon={Camera}
        title="Pencadangan & Pemulihan Data"
        description="Buat snapshot data presensi bulan berjalan. Gunakan titik pemulihan ini jika data bermasalah setelah proses impor massal."
        help={
          <InfoHelp
            label="Backup & Restore"
            summary="Membuat cadangan mandiri data presensi kelas."
            detail="Pencadangan menyimpan kondisi seluruh kehadiran murid pada tanggal berjalan di bulan aktif sebagai restore point aman."
            example="Membuat backup sebelum mengimpor file Excel baru, agar dapat di-restore bila data file keliru."
            impact="Memulihkan data (restore) akan mengembalikan seluruh presensi ke tanggal backup dibuat."
          />
        }
        action={
          <Button
            type="button"
            className="h-10 min-h-[40px] rounded-xl text-xs font-bold gap-1 shadow-sm"
            onClick={onAddSnapshotClick}
            disabled={isCreatingSnapshot}
            data-tour="attendance-settings-backup-create"
          >
            {isCreatingSnapshot ? (
              <RotateCcw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            <span>Buat Cadangan</span>
          </Button>
        }
      />

      <div className="grid gap-4">
        {/* Summary Card */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-backup-summary">
          <h4 className="text-sm font-bold text-foreground mb-3">Statistik Kondisi Bulan Aktif</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            <CompactMetric label="Hari Kalender" value={`${monthDays.length} Hari`} />
            <CompactMetric label="Hari Efektif" value={`${effectiveDays} Hari`} tone="green" />
            <CompactMetric label="Libur Kustom" value={`${customHolidayCount} Hari`} tone="amber" />
            <CompactMetric label="Total Agenda" value={`${dayEvents.length} Acara`} tone="blue" />
          </div>
        </div>

        {/* Backups List */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-backup-list">
          <div className="mb-3 border-b pb-2 flex justify-between items-end">
            <div>
              <h4 className="text-sm font-bold text-foreground">Titik Pencadangan Tersimpan</h4>
              <p className="text-xs text-muted-foreground">Pilih riwayat titik aman yang ingin dipulihkan ke database.</p>
            </div>
            <div className="text-xs font-medium text-muted-foreground">
              Kuota: <span className={snapshots.length >= 5 ? "text-destructive" : "text-foreground"}>{snapshots.length}</span>/5
            </div>
          </div>

          {isCreatingSnapshot && (
            <div className="p-3 mb-2 rounded-xl bg-muted/20 border border-dashed flex flex-col gap-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
              <span className="text-[10px] font-semibold text-muted-foreground flex items-center gap-1.5 mt-1 animate-pulse">
                <RotateCcw className="h-3.5 w-3.5 animate-spin text-primary" />
                Sedang memproses cadangan baru...
              </span>
            </div>
          )}

          <div className="divide-y max-h-72 overflow-y-auto pr-1">
            {snapshots.length === 0 && !isCreatingSnapshot ? (
              <EmptyState icon={Camera} text="Belum ada titik pencadangan tersimpan." compact />
            ) : (
              snapshots.map((snapshot) => (
                <div key={snapshot.id} className="flex flex-col gap-3 py-3 transition-colors hover:bg-muted/10 px-1.5 rounded-lg sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">
                      {format(new Date(snapshot.created_at), "d MMM yyyy, HH:mm", { locale: idLocale })} WIB
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed break-words">{snapshot.reason || "Backup rutin bulanan"}</p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9 min-h-[36px] rounded-xl text-xs font-bold gap-1 border-muted hover:bg-primary/5 hover:text-primary shrink-0"
                    onClick={() => handleRestoreSnapshotAction(snapshot.id)}
                    disabled={isRestoringSnapshot}
                  >
                    {isRestoringSnapshot ? (
                      <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="h-3.5 w-3.5" />
                    )}
                    <span>Pulihkan</span>
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

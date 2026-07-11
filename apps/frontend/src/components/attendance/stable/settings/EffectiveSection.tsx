import React from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  Bookmark,
  CalendarOff,
  CheckCircle2,
  Copy,
  RotateCcw,
  Share2,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DayEvent, HolidayRecord } from "@/hooks/useAttendanceStable";
import { cn } from "@/lib/utils";

import {
  SectionIntro,
  InfoHelp,
  CollapsibleCard,
  CompactMetric,
  EmptyState,
  formatDateOnly,
} from "./SettingsShared";

export interface EffectiveSectionProps {
  holidays: HolidayRecord[];
  dayEvents: DayEvent[];
  handleRemoveHoliday: (date: string, classId?: string | null) => void;
  handleRemoveDayEvent: (date: string) => void;
  onAddHolidayClick: () => void;
  onAddDayEventClick: () => void;
  handleDuplicateAgenda?: () => Promise<void>;
  isDuplicatingAgenda?: boolean;
  onBulkApplyClick?: () => void;
  monthDays: Date[];
  effectiveDays: number;
  isLocked: boolean;
  isHolidayCombined: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
}

export const EffectiveSection: React.FC<EffectiveSectionProps> = ({
  holidays,
  dayEvents,
  handleRemoveHoliday,
  handleRemoveDayEvent,
  onAddHolidayClick,
  onAddDayEventClick,
  handleDuplicateAgenda,
  isDuplicatingAgenda,
  onBulkApplyClick,
  monthDays,
  effectiveDays,
  isLocked,
  isHolidayCombined,
  getHolidayDescriptionCombined,
}) => {
  const nonEffectiveDays = monthDays.filter((day) => isHolidayCombined(day));

  return (
    <div className="space-y-4" data-tour="attendance-settings-effective">
      <SectionIntro
        icon={CalendarOff}
        title="Libur Kustom & Agenda Non-KBM"
        description="Daftarkan hari libur khusus kelas Anda (di luar libur nasional) serta catat agenda penting non-kegiatan belajar rutin."
        help={
          <InfoHelp
            label="Pengecualian Efektif"
            summary="Mengelola libur lokal dan pencatatan kegiatan kelas."
            detail="Gunakan modul ini untuk libur lokal, rapat guru, renovasi, study tour, atau agenda luar KBM yang memengaruhi hari efektif presensi."
            example="Rapat wali murid tanggal 10 Juli membuat kelas diliburkan dari presensi."
            impact="Tanggal berstatus tidak efektif otomatis tidak dihitung dalam penyebut rekapitulasi."
          />
        }
      />

      <div className="grid gap-4">
        {/* Holidays Card */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-effective-holiday">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3 mb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Hari Libur Kustom</h4>
              <p className="text-xs text-muted-foreground">Hari belajar yang sengaja diliburkan untuk kelas aktif.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {onBulkApplyClick && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex h-9 min-h-[36px] rounded-xl text-xs font-bold gap-1"
                  onClick={onBulkApplyClick}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  <span>Salin ke Kelas Lain</span>
                </Button>
              )}
              {handleDuplicateAgenda && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 min-h-[36px] rounded-xl text-xs font-bold gap-1"
                  onClick={handleDuplicateAgenda}
                  disabled={isDuplicatingAgenda}
                >
                  {isDuplicatingAgenda ? (
                    <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>Duplikat Bulan Lalu</span>
                </Button>
              )}
              <Button
                type="button"
                className="h-9 min-h-[36px] rounded-xl text-xs font-bold gap-1 shadow-sm"
                onClick={onAddHolidayClick}
              >
                <CalendarOff className="h-3.5 w-3.5" />
                <span>Tambah Libur</span>
              </Button>
            </div>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto pr-1">
            {holidays.length === 0 ? (
              <EmptyState icon={CalendarOff} text="Belum ada libur kustom terdaftar." compact />
            ) : (
              holidays.map((holiday) => (
                <div key={`${holiday.date}-${holiday.class_id || "school"}`} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/10 px-1 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">{formatDateOnly(holiday.date)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed break-words">{holiday.description || "Tanpa keterangan"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0",
                        holiday.class_id
                          ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/45 dark:bg-blue-950/20 dark:text-blue-300"
                          : "border-muted bg-muted/30 text-muted-foreground"
                      )}
                    >
                      {holiday.class_id ? "Kelas" : "Sekolah"}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      className="h-9 min-h-[36px] w-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 shrink-0"
                      onClick={() => handleRemoveHoliday(holiday.date, holiday.class_id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Events Card */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-settings-effective-event">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-3 mb-3">
            <div>
              <h4 className="text-sm font-bold text-foreground">Kegiatan Khusus (Non-KBM)</h4>
              <p className="text-xs text-muted-foreground">Catat agenda penting kelas yang tidak meliburkan presensi.</p>
            </div>
            <Button
              type="button"
              className="h-9 min-h-[36px] rounded-xl text-xs font-bold gap-1 shadow-sm"
              onClick={onAddDayEventClick}
            >
              <Bookmark className="h-3.5 w-3.5" />
              <span>Tambah Kegiatan</span>
            </Button>
          </div>
          <div className="divide-y max-h-64 overflow-y-auto pr-1">
            {dayEvents.length === 0 ? (
              <EmptyState icon={Bookmark} text="Belum ada agenda kegiatan terdaftar." compact />
            ) : (
              dayEvents.map((event) => (
                <div key={event.date} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-muted/10 px-1 rounded-lg">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">{formatDateOnly(event.date)}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed break-words">
                      {event.label}{event.description ? ` — ${event.description}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="h-9 min-h-[36px] w-9 rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/15 shrink-0"
                    onClick={() => handleRemoveDayEvent(event.date)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Non-Effective Preview Card */}
        <CollapsibleCard
          title={`Pratinjau Hari Tidak Efektif (${nonEffectiveDays.length} Hari)`}
          subtitle="Daftar lengkap tanggal belajar yang dinonaktifkan di bulan ini beserta alasannya."
          icon={CheckCircle2}
          dataTour="attendance-settings-effective-preview"
        >
          <div className="grid grid-cols-2 gap-2 mb-3.5 sm:grid-cols-4">
            <CompactMetric label="Hari Kalender" value={`${monthDays.length} Hari`} />
            <CompactMetric label="Hari Efektif" value={`${effectiveDays} Hari`} tone="green" />
            <CompactMetric label="Tidak Efektif" value={`${nonEffectiveDays.length} Hari`} tone="amber" />
            <CompactMetric label="Status Kunci" value={isLocked ? "Terkunci" : "Terbuka"} tone={isLocked ? "red" : "blue"} />
          </div>
          <div className="divide-y max-h-60 overflow-y-auto pr-1">
            {nonEffectiveDays.length === 0 ? (
              <EmptyState icon={CheckCircle2} text="Tidak ada tanggal non-efektif pada bulan ini." compact />
            ) : (
              nonEffectiveDays.map((day) => (
                <div key={day.toISOString()} className="flex items-center justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-foreground">{format(day, "EEEE, d MMMM yyyy", { locale: idLocale })}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {getHolidayDescriptionCombined(day) || "Akhir pekan atau libur rutin"}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px] border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 rounded-full px-2 py-0.5">
                    Tidak Efektif
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import { format, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CalendarDays,
  Check,
  Globe,
  Settings2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HolidayRecord } from "@/hooks/useAttendanceV2";
import { cn } from "@/lib/utils";

import {
  SectionIntro,
  InfoHelp,
  CollapsibleCard,
  EmptyState,
  formatDateOnly,
} from "./SettingsShared";

export interface CalendarSectionProps {
  workDayFormat: "5days" | "6days";
  handleWorkDayFormatChange: (format: "5days" | "6days") => void;
  monthNationalHolidays: any[];
  holidays: HolidayRecord[];
  toggleHoliday: (h: { date: string; description?: string }) => Promise<void>;
  monthDays: Date[];
}

export const CalendarSection: React.FC<CalendarSectionProps> = ({
  workDayFormat,
  handleWorkDayFormatChange,
  monthNationalHolidays,
  holidays,
  toggleHoliday,
  monthDays,
}) => {
  const [isBulkLoading, setIsBulkLoading] = useState(false);

  const handleBulkToggle = async (dates: string[], makeWorkingDay: boolean) => {
    setIsBulkLoading(true);
    try {
      await Promise.all(
        dates.map((date) =>
          makeWorkingDay
            ? toggleHoliday({ date, description: "Hari Kerja" })
            : toggleHoliday({ date })
        )
      );
    } finally {
      setIsBulkLoading(false);
    }
  };

  return (
    <div className="space-y-4" data-tour="attendance-v2-settings-calendar">
      <SectionIntro
        icon={CalendarDays}
        title="Format Hari Sekolah & Pengecualian KBM"
        description="Atur jumlah hari KBM mingguan kelas Anda serta override/paksa hari libur nasional atau akhir pekan agar tetap dihitung masuk sekolah."
        help={
          <InfoHelp
            label="Kalender Akademik"
            summary="Mengatur hari belajar KBM mingguan dan masuk belajar khusus."
            detail="Kalender akademik menjadi acuan utama sistem untuk menentukan hari efektif sebelum rekap atau export dibuat."
            example="Jika sekolah memakai format 5 hari sekolah, Sabtu dan Minggu otomatis libur. Namun, Anda bisa memaksanya menjadi masuk belajar khusus untuk ujian."
            impact="Perubahan hari sekolah akan langsung mengubah penyebut rekapitulasi kehadiran fisik murid."
            dataTour="attendance-v2-settings-info-help"
          />
        }
      />
      <div className="grid gap-4">
        {/* Format Hari Sekolah */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm" data-tour="attendance-v2-settings-calendar-format">
          <div className="mb-3">
            <h4 className="text-sm font-bold text-foreground">Format Hari Sekolah</h4>
            <p className="text-xs text-muted-foreground">Dasar sistem menentukan hari masuk belajar rutin per minggu.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { key: "5days" as const, label: "5 Hari Belajar", desc: "Senin s/d Jumat aktif KBM. Sabtu & Minggu libur otomatis." },
              { key: "6days" as const, label: "6 Hari Belajar", desc: "Senin s/d Sabtu aktif KBM. Hari Minggu libur otomatis." },
            ].map((item) => {
              const active = workDayFormat === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => handleWorkDayFormatChange(item.key)}
                  className={cn(
                    "flex min-h-[72px] touch-manipulation items-center justify-between rounded-2xl border-2 p-4 text-left transition-all",
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

        {/* Override Tanggal */}
        <CollapsibleCard
          title="Modifikasi Pengecualian Tanggal Masuk (Ubah Libur Jadi Masuk)"
          subtitle="Jadikan tanggal libur nasional atau akhir pekan tertentu tetap terhitung masuk sekolah."
          icon={Globe}
          dataTour="attendance-v2-settings-calendar-override"
        >
          <div className="grid gap-4 md:grid-cols-2">
            {/* National Holidays */}
            <div className="rounded-xl border bg-background/50 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">Libur Nasional Bulan Ini</span>
                  <Badge variant="secondary">{monthNationalHolidays.length}</Badge>
                </div>
                {monthNationalHolidays.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" disabled={isBulkLoading}>
                        <Settings2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="rounded-xl">
                      <DropdownMenuItem
                        onClick={() => {
                          const datesToChange = monthNationalHolidays
                            .filter((h) => !holidays.some((override) => override.date === h.date && override.description === "Hari Kerja"))
                            .map((h) => h.date);
                          if (datesToChange.length > 0) handleBulkToggle(datesToChange, true);
                        }}
                        className="text-xs font-semibold"
                      >
                        Jadikan Semua Masuk
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => {
                          const datesToChange = monthNationalHolidays
                            .filter((h) => holidays.some((override) => override.date === h.date && override.description === "Hari Kerja"))
                            .map((h) => h.date);
                          if (datesToChange.length > 0) handleBulkToggle(datesToChange, false);
                        }}
                        className="text-xs font-semibold text-destructive"
                      >
                        Pulihkan Semua Libur
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <div className="divide-y max-h-60 overflow-y-auto pr-1">
                {monthNationalHolidays.length === 0 ? (
                  <EmptyState icon={Globe} text="Tidak ada libur nasional resmi bulan ini." compact />
                ) : (
                  monthNationalHolidays.map((holiday) => {
                    const isOverridden = holidays.some(
                      (h) => h.date === holiday.date && h.description === "Hari Kerja",
                    );

                    return (
                      <div
                        key={holiday.date}
                        className={cn(
                          "flex items-center justify-between gap-3 py-2.5 transition-colors",
                          isOverridden && "bg-primary/5 px-2 rounded-lg"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">{formatDateOnly(holiday.date)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{holiday.name}</p>
                          {isOverridden && (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                              <Check className="h-3 w-3 stroke-[2.5]" />
                              Masuk khusus
                            </span>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={isOverridden ? "default" : "outline"}
                          className="h-10 min-h-[40px] shrink-0 rounded-xl px-3 text-xs font-bold touch-manipulation"
                          onClick={() =>
                            isOverridden
                              ? toggleHoliday({ date: holiday.date })
                              : toggleHoliday({ date: holiday.date, description: "Hari Kerja" })
                          }
                        >
                          {isOverridden ? "Pulihkan" : "Jadikan Masuk"}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Weekend Days */}
            <div className="rounded-xl border bg-background/50 p-3">
              <div className="mb-2.5 flex items-center justify-between gap-2 border-b pb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">
                    {workDayFormat === "6days" ? "Hari Minggu" : "Sabtu & Minggu"}
                  </span>
                  <Badge variant="secondary">
                    {monthDays.filter((day) => {
                      const dayOfWeek = getDay(day);
                      return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                    }).length}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-xl" disabled={isBulkLoading}>
                      <Settings2 className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="rounded-xl">
                    <DropdownMenuItem
                      onClick={() => {
                        const datesToChange = monthDays
                          .filter((day) => {
                            const dayOfWeek = getDay(day);
                            return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                          })
                          .map((d) => format(d, "yyyy-MM-dd"))
                          .filter((date) => !holidays.some((h) => h.date === date && h.description === "Hari Kerja"));
                        if (datesToChange.length > 0) handleBulkToggle(datesToChange, true);
                      }}
                      className="text-xs font-semibold"
                    >
                      Jadikan Semua Masuk
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        const datesToChange = monthDays
                          .filter((day) => {
                            const dayOfWeek = getDay(day);
                            return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                          })
                          .map((d) => format(d, "yyyy-MM-dd"))
                          .filter((date) => holidays.some((h) => h.date === date && h.description === "Hari Kerja"));
                        if (datesToChange.length > 0) handleBulkToggle(datesToChange, false);
                      }}
                      className="text-xs font-semibold text-destructive"
                    >
                      Pulihkan Semua Libur
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="divide-y max-h-60 overflow-y-auto pr-1">
                {monthDays
                  .filter((day) => {
                    const dayOfWeek = getDay(day);
                    return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                  })
                  .map((day) => {
                    const date = format(day, "yyyy-MM-dd");
                    const isOverridden = holidays.some((h) => h.date === date && h.description === "Hari Kerja");
                    return (
                      <div
                        key={date}
                        className={cn(
                          "flex items-center justify-between gap-3 py-2.5 transition-colors",
                          isOverridden && "bg-primary/5 px-2 rounded-lg"
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-foreground">{format(day, "EEEE, d MMM", { locale: idLocale })}</p>
                          {isOverridden ? (
                            <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-primary">
                              <Check className="h-3 w-3 stroke-[2.5]" />
                              Masuk khusus
                            </span>
                          ) : (
                            <p className="text-[11px] text-muted-foreground mt-0.5">Libur rutin akhir pekan</p>
                          )}
                        </div>
                        <Button
                          type="button"
                          variant={isOverridden ? "default" : "outline"}
                          className="h-10 min-h-[40px] shrink-0 rounded-xl px-3 text-xs font-bold touch-manipulation"
                          onClick={() =>
                            isOverridden
                              ? toggleHoliday({ date })
                              : toggleHoliday({ date, description: "Hari Kerja" })
                          }
                        >
                          {isOverridden ? "Pulihkan" : "Jadikan Masuk"}
                        </Button>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </CollapsibleCard>
      </div>
    </div>
  );
};

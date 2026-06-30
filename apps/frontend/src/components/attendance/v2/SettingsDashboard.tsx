import React, { useState } from "react";
import { format, getDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TourButton } from "@/components/ui/product-tour";
import {
  Settings2, CalendarDays, CalendarOff, FileSpreadsheet, UserPlus, Camera,
  CheckCircle2, Clock, Globe, Info, Bookmark, RotateCcw, Check, X
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { HolidayRecord, DayEvent, RecapProfile, Delegation, MonthSnapshot } from "@/hooks/useAttendanceV2";

interface SettingsDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClass: any;
  currentMonth: Date;
  effectiveDays: number;
  monthDays: Date[];
  isLocked: boolean;
  workDayFormat: "5days" | "6days";
  handleWorkDayFormatChange: (format: "5days" | "6days") => void;
  monthNationalHolidays: any[];
  holidays: HolidayRecord[];
  toggleHoliday: (h: { date: string; description?: string }) => Promise<void>;
  dayEvents: DayEvent[];
  handleRemoveHoliday: (date: string, classId?: string | null) => void;
  handleRemoveDayEvent: (date: string) => void;
  recapProfile: RecapProfile | null;
  handleUpdateRecapProfile: (data: Partial<RecapProfile>) => void;
  handleToggleRecapStatus: (type: "present" | "absence", status: "H" | "S" | "I" | "A" | "D") => void;
  delegations: Delegation[];
  handleRevokeDelegationAction: (id: string) => Promise<void>;
  isRevokingDelegation: boolean;
  snapshots: MonthSnapshot[];
  handleRestoreSnapshotAction: (id: string) => Promise<void>;
  isRestoringSnapshot: boolean;
  isCreatingSnapshot: boolean;
  
  // Triggers for sub-dialogs
  onAddHolidayClick: () => void;
  onAddDayEventClick: () => void;
  onAddDelegationClick: () => void;
  onAddSnapshotClick: () => void;
  
  // Helpers
  isHolidayCombined: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
}

export const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  open,
  onOpenChange,
  selectedClass,
  currentMonth,
  effectiveDays,
  monthDays,
  isLocked,
  workDayFormat,
  handleWorkDayFormatChange,
  monthNationalHolidays,
  holidays,
  toggleHoliday,
  dayEvents,
  handleRemoveHoliday,
  handleRemoveDayEvent,
  recapProfile,
  handleUpdateRecapProfile,
  handleToggleRecapStatus,
  delegations,
  handleRevokeDelegationAction,
  isRevokingDelegation,
  snapshots,
  handleRestoreSnapshotAction,
  isRestoringSnapshot,
  isCreatingSnapshot,
  onAddHolidayClick,
  onAddDayEventClick,
  onAddDelegationClick,
  onAddSnapshotClick,
  isHolidayCombined,
  getHolidayDescriptionCombined,
}) => {
  const [settingsSection, setSettingsSection] = useState<"calendar" | "effective" | "recap" | "delegation" | "backup">("calendar");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92dvh] w-[calc(100vw-1rem)] max-w-6xl flex-col overflow-hidden rounded-2xl p-0 sm:w-[calc(100vw-2rem)]">
        <DialogHeader className="border-b px-4 py-4 sm:px-6" data-tour="attendance-v2-settings-header">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings2 className="h-5 w-5 text-primary" />
                Pusat Kontrol & Pengaturan Presensi V2
              </DialogTitle>
              <DialogDescription className="max-w-2xl text-xs sm:text-sm">
                Konfigurasikan kalender akademik, hari efektif sekolah, rumus rekapitulasi kehadiran, dan hak akses delegasi guru untuk bulan aktif.
              </DialogDescription>
              <div className="sr-only hidden" aria-hidden="true">
                Kalender Akademik
                Preview Hari Efektif
                Profil Rekap Presensi
                Audit Riwayat Perubahan
                Delegasi Guru Pengganti
              </div>
            </div>
            <TourButton
              tourKey="attendance-v2-settings"
              className="min-h-11 w-full justify-center sm:w-auto text-xs"
              onBeforeStart={async () => {
                onOpenChange(true);
                setSettingsSection("calendar");
                await new Promise((resolve) => window.setTimeout(resolve, 120));
              }}
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Kelas Aktif</p>
              <p className="truncate font-semibold text-xs mt-0.5">{selectedClass?.name || "Belum dipilih"}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Bulan Rekap</p>
              <p className="font-semibold text-xs mt-0.5">{format(currentMonth, "MMMM yyyy", { locale: idLocale })}</p>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Akumulasi Hari Efektif</p>
              <p className="font-semibold text-xs mt-0.5">{effectiveDays} Hari dari {monthDays.length} Kalender</p>
            </div>
            <div className="rounded-xl border bg-muted/20 px-3 py-2">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Status Akses Data</p>
              <p className={cn("font-semibold text-xs mt-0.5 flex items-center gap-1", isLocked ? "text-amber-600" : "text-green-600")}>
                <span className={cn("h-1.5 w-1.5 rounded-full", isLocked ? "bg-amber-600 animate-pulse" : "bg-green-600")} />
                {isLocked ? "Terkunci (Arsip)" : "Aktif (Bisa Diedit)"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-1 grid-rows-[auto_1fr] lg:grid-cols-[18rem_minmax(0,1fr)] lg:grid-rows-none">
            <aside className="border-b bg-muted/10 p-3 lg:border-b-0 lg:border-r lg:p-4" data-tour="attendance-v2-settings-nav">
              <div className="flex gap-2 overflow-x-auto pb-2 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0">
                {[
                  { id: "calendar" as const, title: "Kalender & Hari Kerja", icon: CalendarDays, desc: "Hari sekolah & override" },
                  { id: "effective" as const, title: "Libur & Kegiatan Khusus", icon: CalendarOff, desc: "Pengecualian KBM & agenda" },
                  { id: "recap" as const, title: "Kebijakan & Rumus Rekap", icon: FileSpreadsheet, desc: "Rumus HSIAD & denominator" },
                  { id: "delegation" as const, title: "Delegasi Guru Pengganti", icon: UserPlus, desc: "Akses sementara guru pengganti" },
                  { id: "backup" as const, title: "Keamanan & Pencadangan", icon: Camera, desc: "Snapshot, restore & audit trail" },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = settingsSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSettingsSection(item.id)}
                      className={cn(
                        "min-h-[2.5rem] min-w-[12rem] rounded-xl border px-3 py-2.5 text-left transition-all duration-200 touch-manipulation lg:w-full flex items-start gap-2.5",
                        active
                          ? "border-primary bg-primary/5 text-primary shadow-sm font-semibold"
                          : "border-transparent bg-transparent hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                      )}
                      aria-pressed={active}
                    >
                      <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                      <div className="min-w-0">
                        <span className="block text-xs sm:text-sm font-semibold leading-none">{item.title}</span>
                        <span className={cn("mt-1 hidden text-[10px] lg:block leading-normal font-normal", active ? "text-primary/80" : "text-muted-foreground")}>
                          {item.desc}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </aside>

            <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
              {settingsSection === "calendar" && (
                <section className="space-y-4" data-tour="attendance-v2-settings-calendar">
                  <div className="rounded-2xl border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <CalendarDays className="h-5 w-5" />
                      <h3 className="text-sm sm:text-base">Kalender Akademik & Hari Kerja</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Atur sistem hari sekolah utama (5 hari atau 6 hari kerja) serta sesuaikan hari Sabtu/Minggu atau Libur Nasional tertentu menjadi hari masuk sekolah aktif jika ada kegiatan sekolah khusus.
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                    <div className="flex flex-col gap-1">
                      <h4 className="text-xs sm:text-sm font-semibold">Sistem Hari Sekolah Utama</h4>
                      <p className="text-[11px] text-muted-foreground">Tentukan format hari kerja sekolah dasar yang berlaku dalam satu minggu.</p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {([
                        { key: "5days" as const, label: "Sistem 5 Hari Kerja", desc: "Senin sampai Jumat (Sabtu & Minggu Libur)" },
                        { key: "6days" as const, label: "Sistem 6 Hari Kerja", desc: "Senin sampai Sabtu (Hanya Minggu Libur)" },
                      ] as const).map(({ key, label, desc }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => handleWorkDayFormatChange(key)}
                          className={cn(
                            "min-h-14 rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/40 duration-200 touch-manipulation flex items-center justify-between",
                            workDayFormat === key ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border hover:bg-muted/30"
                          )}
                        >
                          <div className="min-w-0">
                            <span className="block font-semibold text-xs sm:text-sm">{label}</span>
                            <span className="text-[11px] text-muted-foreground">{desc}</span>
                          </div>
                          {workDayFormat === key && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    <div className="border-b p-4 space-y-1">
                      <h4 className="flex items-center gap-2 font-semibold text-xs sm:text-sm">
                        <Globe className="h-4 w-4 text-red-500" />
                        Override Libur Nasional & Akhir Pekan
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Secara default, hari Minggu/Sabtu (sesuai format) dan Libur Nasional dianggap non-efektif. Klik tombol <strong>Jadikan Hari Kerja</strong> jika sekolah mengadakan kegiatan masuk di tanggal tersebut.
                      </p>
                    </div>
                    <div className="grid gap-0 md:grid-cols-2">
                      <div className="border-b p-4 md:border-b-0 md:border-r space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Libur Nasional Resmi</p>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">{monthNationalHolidays.length}</Badge>
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                          {monthNationalHolidays.length === 0 ? (
                            <p className="text-xs text-muted-foreground italic p-2 border border-dashed rounded-xl text-center bg-muted/5">Tidak ada libur nasional resmi bulan ini.</p>
                          ) : monthNationalHolidays.map((nh) => {
                            const isOverridden = holidays.some((h) => h.date === nh.date && h.description === "Hari Kerja");
                            return (
                              <div key={nh.date} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 bg-background hover:bg-muted/10 transition-colors">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">{format(new Date(nh.date), "d MMM yyyy", { locale: idLocale })}</p>
                                  <p className="truncate text-[10px] text-muted-foreground">{nh.name}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant={isOverridden ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 text-[11px] rounded-lg px-2.5 flex-shrink-0"
                                  onClick={async () => {
                                    if (isOverridden) {
                                      await toggleHoliday({ date: nh.date });
                                    } else {
                                      await toggleHoliday({ date: nh.date, description: "Hari Kerja" });
                                    }
                                  }}
                                >
                                  {isOverridden ? "Pulihkan Libur" : "Jadikan Kerja"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Hari Sabtu & Minggu</p>
                          <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                            {monthDays.filter((day) => [0, 6].includes(getDay(day))).length}
                          </Badge>
                        </div>
                        <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
                          {monthDays.filter((day) => [0, 6].includes(getDay(day))).map((day) => {
                            const dateStr = format(day, "yyyy-MM-dd");
                            const isOverridden = holidays.some((h) => h.date === dateStr && h.description === "Hari Kerja");
                            return (
                              <div key={dateStr} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 bg-background hover:bg-muted/10 transition-colors">
                                <div className="min-w-0">
                                  <p className="text-xs font-semibold">{format(day, "EEEE, d MMM", { locale: idLocale })}</p>
                                  <p className="text-[10px] text-muted-foreground">{isOverridden ? "Jadwal masuk sekolah khusus" : "Libur akhir pekan default"}</p>
                                </div>
                                <Button
                                  type="button"
                                  variant={isOverridden ? "default" : "outline"}
                                  size="sm"
                                  className="h-8 text-[11px] rounded-lg px-2.5 flex-shrink-0"
                                  onClick={async () => {
                                    if (isOverridden) {
                                      await toggleHoliday({ date: dateStr });
                                    } else {
                                      await toggleHoliday({ date: dateStr, description: "Hari Kerja" });
                                    }
                                  }}
                                >
                                  {isOverridden ? "Pulihkan Libur" : "Jadikan Kerja"}
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}

              {settingsSection === "effective" && (
                <section className="space-y-4" data-tour="attendance-v2-settings-effective">
                  <div className="rounded-2xl border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <CalendarOff className="h-5 w-5" />
                      <h3 className="text-sm sm:text-base">Pengecualian & Jadwal Kegiatan</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tambahkan hari libur kustom lokal sekolah/kelas di luar libur nasional (misal: Rapat Kelulusan Guru, Cuti Bersama Khusus) atau catat kegiatan khusus non-KBM (seperti Ujian Semester, Class Meeting, Porseni).
                    </p>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {/* Hari Libur Kustom */}
                    <div className="rounded-2xl border bg-card shadow-sm flex flex-col min-h-[300px]">
                      <div className="flex items-center justify-between gap-3 border-b p-4">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm">Hari Libur Kustom (Pengecualian)</h4>
                          <p className="text-[11px] text-muted-foreground">Mengurangi hari efektif & menghentikan presensi.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-xl" onClick={onAddHolidayClick}>
                          <CalendarOff className="h-3.5 w-3.5 text-grade-warning" />
                          Tambah Libur
                        </Button>
                      </div>
                      <div className="flex-grow overflow-y-auto max-h-64 divide-y">
                        {holidays.length === 0 ? (
                          <div className="p-12 text-center space-y-1">
                            <CalendarOff className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground italic">Belum ada hari libur kustom terdaftar.</p>
                          </div>
                        ) : (
                          holidays.map((h) => {
                            const hDate = new Date(h.date);
                            return (
                              <div key={`${h.date}-${h.class_id || "all"}`} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/10 transition-colors">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">{format(hDate, "EEEE, d MMM yyyy", { locale: idLocale })}</p>
                                  <p className="truncate text-[10px] text-muted-foreground">{h.description}</p>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                  <Badge variant="outline" className="text-[9px] px-1.5">{h.class_id ? "Kelas" : "Sekolah"}</Badge>
                                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5 rounded-lg" onClick={() => handleRemoveHoliday(h.date, h.class_id)}>
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Kegiatan Khusus */}
                    <div className="rounded-2xl border bg-card shadow-sm flex flex-col min-h-[300px]">
                      <div className="flex items-center justify-between gap-3 border-b p-4">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm">Jadwal Kegiatan Khusus (Non-KBM)</h4>
                          <p className="text-[11px] text-muted-foreground">Ujian, Study Tour, Class Meeting (Tetap Hari Efektif).</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-xl" onClick={onAddDayEventClick}>
                          <Bookmark className="h-3.5 w-3.5 text-primary" />
                          Tambah Kegiatan
                        </Button>
                      </div>
                      <div className="flex-grow overflow-y-auto max-h-64 divide-y">
                        {dayEvents.length === 0 ? (
                          <div className="p-12 text-center space-y-1">
                            <Bookmark className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground italic">Belum ada kegiatan khusus terdaftar.</p>
                          </div>
                        ) : (
                          dayEvents.map((event) => {
                            const eventDate = new Date(event.date);
                            return (
                              <div key={event.date} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/10 transition-colors">
                                <div className="min-w-0">
                                  <p className="truncate text-xs font-semibold">{format(eventDate, "EEEE, d MMM yyyy", { locale: idLocale })}</p>
                                  <p className="truncate text-[10px] text-muted-foreground">{event.label}{event.description ? ` - ${event.description}` : ""}</p>
                                </div>
                                <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/5 rounded-lg flex-shrink-0" onClick={() => handleRemoveDayEvent(event.date)}>
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                    <div className="border-b p-4">
                      <h4 className="font-semibold text-xs sm:text-sm">Alasan Tanggal Tidak Efektif Bulan Ini</h4>
                      <p className="text-[11px] text-muted-foreground">Daftar tanggal KBM dinonaktifkan beserta deskripsi penjelas.</p>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y">
                      {monthDays.filter((day) => isHolidayCombined(day)).length === 0 ? (
                        <p className="p-4 text-xs text-muted-foreground italic text-center">Seluruh tanggal pada bulan ini adalah Hari Efektif Belajar aktif.</p>
                      ) : (
                        monthDays.filter((day) => isHolidayCombined(day)).map((day) => (
                          <div key={day.toISOString()} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/5 transition-colors">
                            <div>
                              <p className="text-xs font-semibold">{format(day, "EEEE, d MMMM yyyy", { locale: idLocale })}</p>
                              <p className="text-[10px] text-muted-foreground">{getHolidayDescriptionCombined(day) || "Akhir pekan / Libur rutin"}</p>
                            </div>
                            <Badge variant="outline" className="text-[9px] border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-300">Tidak Efektif</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}

              {settingsSection === "recap" && (
                <section className="space-y-4" data-tour="attendance-v2-settings-recap">
                  <div className="rounded-2xl border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <FileSpreadsheet className="h-5 w-5" />
                      <h3 className="text-sm sm:text-base">Kebijakan Perhitungan & Pemetaan Status (HSIAD)</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Atur pembagi dalam perhitungan nilai persentase rekapitulasi serta kelompokkan status kehadiran siswa (Hadir, Sakit, Izin, Alfa, Dispen) agar sesuai dengan regulasi pelaporan sekolah Anda.
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-4">
                    {!recapProfile ? (
                      <div className="rounded-xl border border-dashed p-6 text-center space-y-1">
                        <Info className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                        <p className="text-xs text-muted-foreground italic">Profil rekapitulasi belum dikonfigurasi untuk kelas ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {/* Kebijakan Penyebut */}
                        <div className="space-y-2">
                          <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Kebijakan Penyebut (Denominator Perhitungan)</Label>
                          <div className="grid gap-3 sm:grid-cols-2">
                            {[
                              { value: "effective_days" as const, label: `Hari Efektif Kalender (${effectiveDays} Hari)`, desc: "Cocok untuk Rapor Resmi. Persentase dihitung dari total hari sekolah efektif." },
                              { value: "filled_days" as const, label: "Hari Terisi (Dinamis)", desc: "Cocok selama bulan berjalan. Menghitung hanya tanggal yang sudah diisi presensinya." },
                            ].map((item) => (
                              <button
                                key={item.value}
                                type="button"
                                onClick={() => handleUpdateRecapProfile({ denominator_policy: item.value })}
                                className={cn(
                                  "min-h-16 rounded-xl border px-4 py-3 text-left transition-all hover:border-primary/40 duration-200 flex items-center justify-between",
                                  recapProfile.denominator_policy === item.value ? "border-primary bg-primary/5 text-primary shadow-sm" : "border-border hover:bg-muted/30"
                                )}
                              >
                                <div className="min-w-0">
                                  <span className="block font-semibold text-xs sm:text-sm">{item.label}</span>
                                  <span className="text-[10px] text-muted-foreground leading-normal">{item.desc}</span>
                                </div>
                                {recapProfile.denominator_policy === item.value && <Check className="h-4 w-4 text-primary flex-shrink-0 ml-2" />}
                              </button>
                            ))}
                          </div>
                        </div>

                        {/* Aturan Pemetaan Status */}
                        <div className="space-y-3">
                          <div>
                            <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Aturan Pemetaan Status Kehadiran (HSIAD)</Label>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Tentukan bagaimana masing-masing status kehadiran dihitung di dalam persentase rekapitulasi siswa.</p>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            {[
                              { type: "present" as const, title: "Dihitung sebagai \"Hadir\"", desc: "Siswa dianggap masuk KBM secara administratif.", list: recapProfile.present_statuses, tone: "green" },
                              { type: "absence" as const, title: "Dihitung sebagai \"Tidak Hadir\"", desc: "Mengurangi persentase tingkat kehadiran siswa.", list: recapProfile.absence_statuses, tone: "red" },
                            ].map((group) => (
                              <div key={group.type} className={cn(
                                "rounded-xl border p-4 space-y-3 bg-background",
                                group.tone === "green" ? "border-green-100 dark:border-green-950/60 bg-green-50/10 dark:bg-green-950/5" : "border-red-100 dark:border-red-950/60 bg-red-50/10 dark:bg-red-950/5"
                              )}>
                                <div>
                                  <p className="text-xs font-semibold">{group.title}</p>
                                  <p className="text-[10px] text-muted-foreground">{group.desc}</p>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {(["H", "S", "I", "A", "D"] as const).map((status) => {
                                    const selected = group.list.includes(status);
                                    const displayMap: Record<string, string> = {
                                      H: "H (Hadir)",
                                      S: "S (Sakit)",
                                      I: "I (Izin)",
                                      A: "A (Alfa)",
                                      D: "D (Dispen)",
                                    };
                                    return (
                                      <button
                                        key={`${group.type}-${status}`}
                                        type="button"
                                        onClick={() => handleToggleRecapStatus(group.type, status)}
                                        className={cn(
                                          "h-9 rounded-lg border px-2.5 text-xs font-semibold transition-all duration-200",
                                          selected
                                            ? group.tone === "green"
                                              ? "border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300 shadow-sm"
                                              : "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300 shadow-sm"
                                            : "border-border bg-background text-muted-foreground hover:bg-muted/50"
                                        )}
                                      >
                                        {displayMap[status]}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {settingsSection === "delegation" && (
                <section className="space-y-4" data-tour="attendance-v2-settings-delegation">
                  <div className="rounded-2xl border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <UserPlus className="h-5 w-5" />
                      <h3 className="text-sm sm:text-base">Delegasi & Hak Akses Sementara</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Berikan otorisasi pengisian presensi kelas kepada guru pengganti atau asisten mitra dalam rentang waktu tertentu. Guru yang didelegasikan dapat mengisi data presensi kelas ini tanpa membutuhkan password akun Anda.
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm flex flex-col min-h-[300px]">
                    <div className="flex items-center justify-between gap-3 border-b p-4">
                      <div>
                        <h4 className="font-semibold text-xs sm:text-sm">Daftar Hak Akses Guru Pengganti</h4>
                        <p className="text-[11px] text-muted-foreground">Kelola wewenang delegasi aktif untuk kelas bulan ini.</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-xl" onClick={onAddDelegationClick}>
                        <UserPlus className="h-3.5 w-3.5 text-primary" />
                        Tambah Delegasi
                      </Button>
                    </div>
                    <div className="flex-grow overflow-y-auto max-h-80 divide-y">
                      {delegations.length === 0 ? (
                        <div className="p-12 text-center space-y-1">
                          <UserPlus className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                          <p className="text-xs text-muted-foreground italic">Belum ada delegasi yang ditambahkan untuk kelas ini.</p>
                        </div>
                      ) : (
                        delegations.map((delegation) => (
                          <div key={delegation.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/10 transition-colors">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{delegation.grantee_label || delegation.grantee_user_id}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                Masa Berlaku: {format(new Date(delegation.starts_at), "d MMM yyyy", { locale: idLocale })} s.d. {format(new Date(delegation.ends_at), "d MMM yyyy", { locale: idLocale })}
                              </p>
                            </div>
                            <Button type="button" variant="ghost" size="sm" className="h-8 text-[11px] text-destructive hover:bg-destructive/5 rounded-lg flex-shrink-0" onClick={() => handleRevokeDelegationAction(delegation.id)} disabled={isRevokingDelegation}>
                              Cabut Izin
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </section>
              )}

              {settingsSection === "backup" && (
                <section className="space-y-4" data-tour="attendance-v2-settings-backup">
                  <div className="rounded-2xl border bg-muted/10 p-4 space-y-2">
                    <div className="flex items-center gap-2 text-primary font-semibold">
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                      <h3 className="text-sm sm:text-base">Keamanan & Pencadangan</h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Tinjau komposisi hari efektif sekolah pada bulan aktif, periksa riwayat audit perubahan data, dan pastikan untuk membuat <strong>Cadangan (Snapshot)</strong> untuk mengamankan data kehadiran sebelum bulan ini dikunci.
                    </p>
                  </div>

                  <div className="rounded-2xl border bg-card p-4 shadow-sm space-y-3">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Kalkulator Statistik Hari Kalender</h4>
                    <div className="grid gap-3 grid-cols-2 xl:grid-cols-5">
                      {[
                        { label: "Total Hari Kalender", value: monthDays.length, tone: "bg-muted/40" },
                        { label: "Hari Efektif Belajar", value: effectiveDays, tone: "bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300 border-green-100 dark:border-green-900" },
                        { label: "Hari Libur Kustom", value: holidays.filter((h) => h.description !== "Hari Kerja").length, tone: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-300 border-amber-100 dark:border-amber-900" },
                        { label: "Libur Nasional Resmi", value: monthNationalHolidays.length, tone: "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-300 border-red-100 dark:border-red-900" },
                        { label: "Kegiatan Non-KBM", value: dayEvents.length, tone: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-300 border-blue-100 dark:border-blue-900" },
                      ].map((item) => (
                        <div key={item.label} className={cn("rounded-xl border p-3 flex flex-col justify-between min-h-[68px]", item.tone)}>
                          <p className="text-[10px] font-medium leading-tight opacity-80">{item.label}</p>
                          <p className="text-xl font-bold mt-1">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    {/* Snapshot / Backup */}
                    <div className="rounded-2xl border bg-card shadow-sm flex flex-col min-h-[260px]">
                      <div className="flex items-center justify-between gap-3 border-b p-4">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-xs sm:text-sm">Snapshot Cadangan Bulanan</h4>
                          <p className="text-[11px] text-muted-foreground">Simpan cadangan data presensi sebelum aksi massal.</p>
                        </div>
                        <Button type="button" variant="outline" size="sm" className="h-9 gap-2 text-xs rounded-xl" onClick={onAddSnapshotClick} disabled={isCreatingSnapshot}>
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          Buat Cadangan
                        </Button>
                      </div>
                      <div className="flex-grow overflow-y-auto max-h-60 divide-y">
                        {snapshots.length === 0 ? (
                          <div className="p-8 text-center space-y-1">
                            <Camera className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                            <p className="text-xs text-muted-foreground italic">Belum ada cadangan data tersimpan.</p>
                          </div>
                        ) : (
                          snapshots.map((snapshot) => (
                            <div key={snapshot.id} className="flex items-center justify-between gap-3 p-3 hover:bg-muted/10 transition-colors">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold">{format(new Date(snapshot.created_at), "d MMMM yyyy HH:mm", { locale: idLocale })}</p>
                                <p className="text-[10px] text-muted-foreground truncate">Catatan: {snapshot.reason || "Backup rutin"}</p>
                              </div>
                              <Button type="button" variant="outline" size="sm" className="h-8 text-[11px] gap-1.5 rounded-lg px-2 flex-shrink-0" onClick={() => handleRestoreSnapshotAction(snapshot.id)} disabled={isRestoringSnapshot}>
                                <RotateCcw className="h-3 w-3" />
                                Pulihkan
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Audit Log */}
                    <div className="rounded-2xl border bg-card shadow-sm flex flex-col min-h-[260px]" data-tour="attendance-v2-settings-audit">
                      <div className="border-b p-4">
                        <h4 className="font-semibold text-xs sm:text-sm">Audit Aktivitas Perubahan</h4>
                        <p className="text-[11px] text-muted-foreground">Log pengubahan data untuk pelacakan transparansi.</p>
                      </div>
                      <div className="flex-grow overflow-y-auto max-h-60 divide-y">
                        <div className="p-8 text-center space-y-2">
                          <Clock className="h-8 w-8 text-muted-foreground/30 mx-auto" />
                          <p className="text-xs font-semibold text-muted-foreground">Belum Ada Aktivitas Terekam</p>
                          <p className="text-[10px] text-muted-foreground max-w-[280px] mx-auto leading-normal">Semua aktivitas edit manual, impor data Excel, atau restorasi snapshot akan terekam otomatis di sini untuk validitas data.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t p-4 sm:flex-row sm:items-center sm:justify-between bg-muted/5">
          <p className="text-[11px] text-muted-foreground leading-normal max-w-sm sm:max-w-md hidden sm:block">
            * Seluruh perubahan konfigurasi di sini terisolasi untuk jalur <strong>Presensi V2</strong>. Data KBM Presensi V1 tetap aman.
          </p>
          <div className="flex w-full sm:w-auto items-center justify-end">
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-10 text-xs gap-1.5 rounded-xl px-5 min-w-[7rem] bg-primary hover:bg-primary/95 text-primary-foreground shadow-sm"
            >
              <span>Selesai</span>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

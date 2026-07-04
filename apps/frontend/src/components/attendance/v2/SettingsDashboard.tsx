import React, { useMemo, useState } from "react";
import { format, getDay, addMonths, addYears } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Activity,
  Bookmark,
  CalendarDays,
  CalendarOff,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  Globe,
  Info,
  RotateCcw,
  Settings2,
  ShieldCheck,
  UserPlus,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ProductTour, TourButton, type TourStep } from "@/components/ui/product-tour";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DayEvent, Delegation, HolidayRecord, MonthSnapshot, RecapProfile } from "@/hooks/useAttendanceV2";
import { cn } from "@/lib/utils";

type SettingsSection = "calendar" | "effective" | "recap" | "audit" | "delegation" | "backup";

interface SettingsDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedClass: any;
  currentMonth: Date;
  setCurrentMonth?: (month: Date) => void;
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

  onAddHolidayClick: () => void;
  onAddDayEventClick: () => void;
  onAddDelegationClick: () => void;
  onAddSnapshotClick: () => void;

  isHolidayCombined: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
}

const delayForTour = () => new Promise((resolve) => window.setTimeout(resolve, 140));

const formatDateOnly = (date: Date | string) => format(new Date(date), "d MMM yyyy", { locale: idLocale });

const statusLabels: Record<"H" | "S" | "I" | "A" | "D", string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alfa",
  D: "Dispen",
};

function CompactMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "blue";
}) {
  const toneClass = {
    default: "border-border bg-muted/25 text-foreground",
    green: "border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-300",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300",
  }[tone];

  return (
    <div className={cn("min-w-0 rounded-xl border px-3 py-2", toneClass)}>
      <p className="truncate text-[10px] font-semibold uppercase tracking-wide opacity-80">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold">{value}</p>
    </div>
  );
}

const InlinePopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "sipena-scroll-chain-page z-[10200] w-72 rounded-md border border-border bg-popover p-4 text-popover-foreground shadow-md outline-none scrollbar-thin data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
InlinePopoverContent.displayName = "InlinePopoverContent";

function SectionIntro({
  icon: Icon,
  title,
  description,
  action,
  help,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  action?: React.ReactNode;
  help?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border bg-muted/10 p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-semibold text-primary">
            <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
            <h3 className="text-sm sm:text-base">{title}</h3>
            {help}
          </div>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}

function InfoHelp({
  label,
  summary,
  detail,
  example,
  impact,
  dataTour,
}: {
  label: string;
  summary: string;
  detail: string;
  example?: string;
  impact?: string;
  dataTour?: string;
}) {
  return (
    <Tooltip>
      <Popover>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Informasi ${label}`}
              data-tour={dataTour}
              className={cn(
                "inline-flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary",
                "transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                "active:bg-primary/15 data-[state=open]:bg-primary/10",
              )}
              onClick={(event) => event.stopPropagation()}
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
          </PopoverTrigger>
        </TooltipTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="z-[10170] w-[min(21rem,calc(100vw-2rem))] rounded-2xl border-primary/15 p-3 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="space-y-3">
            <div>
              <p className="text-sm font-bold text-foreground">{label}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
            </div>
            {example ? (
              <div className="rounded-xl border bg-muted/40 p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Contoh</p>
                <p className="mt-1 text-xs leading-relaxed text-foreground">{example}</p>
              </div>
            ) : null}
            {impact ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
                <p className="text-[10px] font-bold uppercase tracking-wide">Dampak</p>
                <p className="mt-1 text-xs leading-relaxed">{impact}</p>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
      <TooltipContent side="top" className="z-[10160] max-w-xs text-xs">
        {summary}
      </TooltipContent>
    </Tooltip>
  );
}

function EmptyState({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center gap-2 p-6 text-center">
      <Icon className="h-8 w-8 text-muted-foreground/35" />
      <p className="max-w-xs text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

export const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
  open,
  onOpenChange,
  selectedClass,
  currentMonth,
  setCurrentMonth,
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
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("calendar");

  const customHolidayCount = holidays.filter((h) => h.description !== "Hari Kerja").length;
  const nonEffectiveDays = monthDays.filter((day) => isHolidayCombined(day));

  const monthOptions = useMemo(() => {
    const options: Date[] = [];
    const baseYear = currentMonth.getFullYear();
    for (let m = 0; m < 12; m++) {
      options.push(new Date(baseYear, m, 1));
    }
    return options;
  }, [currentMonth.getFullYear()]);

  const sectionItems = useMemo(
    () => [
      {
        id: "calendar" as const,
        title: "Kalender",
        detail: "Hari kerja",
        icon: CalendarDays,
        tour: "attendance-v2-settings-calendar",
      },
      {
        id: "effective" as const,
        title: "Libur & Kegiatan",
        detail: "Pengecualian",
        icon: CalendarOff,
        tour: "attendance-v2-settings-effective",
      },
      {
        id: "recap" as const,
        title: "Rekap",
        detail: "Rumus",
        icon: FileSpreadsheet,
        tour: "attendance-v2-settings-recap",
      },
      {
        id: "audit" as const,
        title: "Riwayat",
        detail: "Audit",
        icon: Clock,
        tour: "attendance-v2-settings-audit",
      },
      {
        id: "delegation" as const,
        title: "Delegasi",
        detail: "Guru pengganti",
        icon: UserPlus,
        tour: "attendance-v2-settings-delegation",
      },
      {
        id: "backup" as const,
        title: "Backup",
        detail: "Cadangan",
        icon: Camera,
        tour: "attendance-v2-settings-backup",
      },
    ],
    [],
  );

  const settingsTourSteps: TourStep[] = useMemo(
    () => [
      {
        target: "[data-tour='attendance-v2-settings-header']",
        title: "Pusat Kendali Pengaturan Kelas",
        description: "Halaman ini memuat ringkasan informasi penting seperti nama kelas aktif, periode bulan berjalan, serta status penguncian data kehadiran. Semua perubahan setelan di sini akan langsung berlaku untuk laporan presensi kelas Anda.",
        prepare: async () => {
          onOpenChange(true);
          setSettingsSection("calendar");
          await delayForTour();
        },
      },
      // 1. Kalender Akademik
      {
        target: "[data-tour='attendance-v2-settings-nav-calendar']",
        title: "Menu Kalender Akademik",
        description: "Arahkan perhatian Anda ke tombol menu Kalender Akademik. Menu ini digunakan untuk mengatur format hari belajar aktif mingguan bagi kelas Anda.",
        prepare: async () => {
          setSettingsSection("calendar");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-calendar-format']",
        title: "Format Hari Belajar Mingguan",
        description: "Di bagian ini, Anda dapat menentukan pola belajar mingguan murid (sistem 5 hari sekolah atau 6 hari sekolah). Pilihan ini menjadi acuan sistem untuk memformat hari efektif belajar.",
        prepare: async () => {
          setSettingsSection("calendar");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-calendar-override']",
        title: "Penyesuaian Hari Libur & Akhir Pekan",
        description: "Gunakan fitur ini jika ada kegiatan sekolah khusus yang mengharuskan kelas masuk pada akhir pekan (Sabtu/Minggu) atau libur nasional. Hari yang ditandai masuk akan dihitung dalam hari efektif.",
        prepare: async () => {
          setSettingsSection("calendar");
          await delayForTour();
        },
      },
      // 2. Hari Libur & Kegiatan Khusus
      {
        target: "[data-tour='attendance-v2-settings-nav-effective']",
        title: "Menu Hari Libur & Kegiatan",
        description: "Tombol menu ini mengarahkan Anda ke pengaturan hari libur khusus kelas serta pencatatan kegiatan belajar non-efektif.",
        prepare: async () => {
          setSettingsSection("effective");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-effective-holiday']",
        title: "Daftar Hari Libur Kustom",
        description: "Tambahkan tanggal libur kustom tertentu di luar hari libur nasional (misalnya libur semester, rapat guru, atau renovasi sekolah). Murid tidak akan dihitung hadir pada tanggal ini.",
        prepare: async () => {
          setSettingsSection("effective");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-effective-event']",
        title: "Pencatatan Kegiatan Khusus",
        description: "Catat agenda khusus kelas yang bukan merupakan kegiatan belajar mengajar rutin (KBM) tetapi tetap perlu diketahui (seperti study tour, pentas seni, atau rapat wali murid).",
        prepare: async () => {
          setSettingsSection("effective");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-effective-preview']",
        title: "Pratinjau Hari Tidak Efektif",
        description: "Halaman ringkasan ini merinci seluruh tanggal di bulan berjalan yang berstatus tidak efektif beserta alasannya (seperti libur rutin, hari Minggu, atau hari libur khusus).",
        prepare: async () => {
          setSettingsSection("effective");
          await delayForTour();
        },
      },
      // 3. Kebijakan Rekap
      {
        target: "[data-tour='attendance-v2-settings-nav-recap']",
        title: "Menu Kebijakan Rekap Kehadiran",
        description: "Tombol menu ini membawa Anda ke pengaturan formula pembagi rekapitulasi nilai kehadiran murid.",
        prepare: async () => {
          setSettingsSection("recap");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-recap-denominator']",
        title: "Kebijakan Angka Pembagi (Denominator)",
        description: "Tentukan dasar pembagian untuk persentase kehadiran murid: apakah dihitung berdasarkan jumlah hari efektif kalender akademik, atau hanya berdasarkan hari yang sudah diisi presensi.",
        prepare: async () => {
          setSettingsSection("recap");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-recap-mapping']",
        title: "Pemetaan Status Kehadiran Murid",
        description: "Atur pengelompokan status presensi (Hadir, Sakit, Izin, Alpha, Dispensasi) untuk menentukan apakah status tertentu dihitung sebagai kehadiran fisik atau ketidakhadiran dalam nilai akhir murid.",
        prepare: async () => {
          setSettingsSection("recap");
          await delayForTour();
        },
      },
      // 4. Log Audit
      {
        target: "[data-tour='attendance-v2-settings-nav-audit']",
        title: "Menu Catatan Riwayat Perubahan",
        description: "Tombol menu ini digunakan untuk membuka halaman peninjauan riwayat perubahan presensi kelas.",
        prepare: async () => {
          setSettingsSection("audit");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-audit-history']",
        title: "Riwayat Aktivitas & Perubahan Data",
        description: "Setiap perubahan status kehadiran murid akan dicatat di panel ini secara terperinci (nama guru pengubah, tanggal perubahan, status awal, dan status baru) demi menjaga akurasi data.",
        prepare: async () => {
          setSettingsSection("audit");
          await delayForTour();
        },
      },
      // 5. Delegasi
      {
        target: "[data-tour='attendance-v2-settings-nav-delegation']",
        title: "Menu Pendelegasian Akses",
        description: "Tombol menu ini mengarahkan Anda ke pendelegasian wewenang pengisian presensi kelas kepada rekan guru pendamping.",
        prepare: async () => {
          setSettingsSection("delegation");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-delegation-add']",
        title: "Tombol Pemberian Akses Sementara",
        description: "Klik tombol ini untuk menunjuk rekan guru lain agar dapat mengisi presensi kelas Anda secara aman dalam kurun waktu tertentu tanpa perlu membagikan kata sandi akun Anda.",
        prepare: async () => {
          setSettingsSection("delegation");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-delegation-list']",
        title: "Daftar Hak Akses Aktif",
        description: "Di sini Anda dapat melihat siapa saja rekan guru yang saat ini sedang didelegasikan untuk membantu mengisi presensi, lengkap dengan masa berlakunya dan tombol pembatalan izin.",
        prepare: async () => {
          setSettingsSection("delegation");
          await delayForTour();
        },
      },
      // 6. Backup
      {
        target: "[data-tour='attendance-v2-settings-nav-backup']",
        title: "Menu Pencadangan & Pemulihan",
        description: "Tombol menu ini merupakan pintu gerbang untuk membuat cadangan data (snapshot) kelas Anda.",
        prepare: async () => {
          setSettingsSection("backup");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-backup-create']",
        title: "Tombol Pembuatan Cadangan Baru",
        description: "Klik tombol ini sebelum Anda mengimpor data murid secara massal untuk menyimpan kondisi data saat ini sebagai titik aman yang dapat dipulihkan kapan saja.",
        prepare: async () => {
          setSettingsSection("backup");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-backup-summary']",
        title: "Statistik Presensi Bulan Ini",
        description: "Menampilkan ringkasan statistik bulan aktif seperti jumlah hari efektif sekolah, libur kelas, dan kegiatan khusus sebagai catatan referensi sebelum pencadangan.",
        prepare: async () => {
          setSettingsSection("backup");
          await delayForTour();
        },
      },
      {
        target: "[data-tour='attendance-v2-settings-backup-list']",
        title: "Daftar Titik Cadangan Data",
        description: "Menampilkan daftar seluruh cadangan data yang pernah Anda buat beserta tombol untuk memulihkan (restore) kondisi data kelas kembali ke titik waktu tersebut jika terjadi kesalahan.",
        prepare: async () => {
          setSettingsSection("backup");
          await delayForTour();
        },
      },
    ],
    [onOpenChange],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        fullScreenMobile
        className={cn(
          "flex flex-col gap-0 lg:overflow-hidden",
          "sm:h-[min(92dvh,820px)] sm:max-h-[92dvh] sm:w-[calc(100vw-2rem)] sm:max-w-6xl",
        )}
        onPointerDownOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target && (target.closest("[data-sipena-tour]") || target.closest(".sipena-tour-action"))) {
            e.preventDefault();
          }
        }}
        onInteractOutside={(e) => {
          const target = e.target as HTMLElement;
          if (target && (target.closest("[data-sipena-tour]") || target.closest(".sipena-tour-action"))) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader
          className="border-b bg-background px-3 pb-2 pt-3 sm:px-5 sm:pb-3 sm:pt-4 lg:sticky lg:top-0 lg:z-20 lg:bg-background/95 lg:backdrop-blur"
          data-tour="attendance-v2-settings-header"
        >
          <div className="flex items-start justify-between gap-3 pr-10">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Settings2 className="h-4 w-4 text-primary sm:h-5 sm:w-5" />
                Pengaturan Presensi V2
              </DialogTitle>
              <DialogDescription className="mt-1 line-clamp-2 text-xs sm:text-sm">
                Kelola kalender akademik, hari efektif, rekap, delegasi, audit, dan backup untuk kelas aktif.
              </DialogDescription>
            </div>
            <TourButton
              tourKey="attendance-v2-settings"
              className="min-h-10 shrink-0 justify-center rounded-xl px-3 text-xs sm:min-h-11"
              onBeforeStart={async () => {
                onOpenChange(true);
                setSettingsSection("calendar");
                await delayForTour();
              }}
            />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <CompactMetric label="Kelas" value={selectedClass?.name || "Belum dipilih"} />
            <CompactMetric
              label="Bulan"
              value={
                <div className="flex items-center justify-between gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-lg text-foreground hover:bg-muted/80"
                    onClick={() => {
                      if (setCurrentMonth) {
                        setCurrentMonth(addMonths(currentMonth, -1));
                      }
                    }}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-xs sm:text-sm font-bold hover:bg-muted/80 text-foreground transition-colors cursor-pointer select-none"
                      >
                        <span className="truncate max-w-[5.25rem] sm:max-w-none">
                          {format(currentMonth, "MMMM yyyy", { locale: idLocale })}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-60 shrink-0" />
                      </button>
                    </PopoverTrigger>
                    <InlinePopoverContent className="w-56 p-2 rounded-xl" align="center">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 mb-1">
                        Pilih Bulan
                      </div>
                      <div className="grid grid-cols-2 gap-1 max-h-64 overflow-y-auto">
                        {monthOptions.map((month) => {
                          const isSelected = month.getMonth() === currentMonth.getMonth() && month.getFullYear() === currentMonth.getFullYear();
                          return (
                            <button
                              key={month.toISOString()}
                              type="button"
                              onClick={() => {
                                if (setCurrentMonth) {
                                  setCurrentMonth(month);
                                }
                              }}
                              className={cn(
                                "px-2 py-1.5 rounded-lg text-xs text-left font-medium transition-colors truncate",
                                isSelected
                                  ? "bg-primary text-primary-foreground font-semibold"
                                  : "hover:bg-muted text-foreground"
                              )}
                            >
                              {format(month, "MMMM", { locale: idLocale })}
                            </button>
                          );
                        })}
                      </div>
                      <div className="border-t mt-2 pt-1.5 flex items-center justify-between gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 flex-1 px-1.5 rounded-lg text-[10px] font-semibold hover:bg-muted"
                          onClick={() => {
                            if (setCurrentMonth) {
                              setCurrentMonth(addYears(currentMonth, -1));
                            }
                          }}
                        >
                          Tahun Lalu
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          className="h-7 flex-1 px-1.5 rounded-lg text-[10px] font-semibold hover:bg-muted"
                          onClick={() => {
                            if (setCurrentMonth) {
                              setCurrentMonth(addYears(currentMonth, 1));
                            }
                          }}
                        >
                          Tahun Depan
                        </Button>
                      </div>
                    </InlinePopoverContent>
                  </Popover>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 rounded-lg text-foreground hover:bg-muted/80"
                    onClick={() => {
                      if (setCurrentMonth) {
                        setCurrentMonth(addMonths(currentMonth, 1));
                      }
                    }}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              }
            />
            <CompactMetric label="Hari efektif" value={`${effectiveDays}/${monthDays.length} hari`} tone="green" />
            <CompactMetric
              label="Status"
              value={isLocked ? "Terkunci" : "Bisa diedit"}
              tone={isLocked ? "amber" : "blue"}
            />
          </div>
        </DialogHeader>

        <div className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)] lg:overflow-hidden lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:grid-rows-none">
          <aside
            className="shrink-0 border-b bg-background px-3 py-2 lg:static lg:border-b-0 lg:border-r lg:bg-muted/10 lg:p-3"
            data-tour="attendance-v2-settings-nav"
          >
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 lg:block lg:space-y-2 lg:gap-0">
              {sectionItems.map((item) => {
                const Icon = item.icon;
                const active = settingsSection === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    data-tour={`attendance-v2-settings-nav-${item.id}`}
                    data-selected={active ? "true" : "false"}
                    aria-pressed={active}
                    onClick={() => setSettingsSection(item.id)}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center transition-colors min-h-[4.25rem] touch-manipulation",
                      "sm:min-h-[3.25rem] sm:flex-row sm:gap-2 sm:px-3 sm:py-1.5",
                      "lg:w-full lg:min-h-[3.25rem] lg:flex-col lg:items-start lg:justify-start lg:gap-0 lg:p-3 lg:text-left",
                      active
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}
                  >
                    <span className="flex flex-col items-center gap-1 sm:flex-row sm:gap-2 lg:flex-row lg:gap-2.5">
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="text-[10px] font-bold leading-tight sm:text-xs lg:text-sm lg:font-semibold truncate">
                        {item.title}
                      </span>
                    </span>
                    <span className={cn(
                      "hidden lg:block mt-0.5 truncate text-[10px]", 
                      active ? "text-primary-foreground/80" : "text-muted-foreground"
                    )}>
                      {item.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </aside>

          <main className="px-3 py-3 sm:px-5 sm:py-4 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain">
            {settingsSection === "calendar" && (
              <section className="space-y-3" data-tour="attendance-v2-settings-calendar">
                <SectionIntro
                  icon={CalendarDays}
                  title="Kalender Akademik"
                  description="Atur format hari sekolah utama dan override hari libur tertentu tanpa membuka banyak panel."
                  help={
                    <InfoHelp
                      label="Kalender Akademik"
                      summary="Dasar sistem menentukan tanggal masuk, libur, dan kegiatan."
                      detail="Kalender akademik menjadi acuan Presensi V2 untuk menentukan hari efektif sebelum rekap atau export dibuat."
                      example="Jika sekolah memakai 5 hari, Sabtu dan Minggu otomatis tidak efektif kecuali dibuat masuk khusus."
                      impact="Perubahan kalender dapat mengubah jumlah hari efektif dan persentase rekap."
                      dataTour="attendance-v2-settings-info-help"
                    />
                  }
                />

                 <div className="grid gap-3 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                  <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4" data-tour="attendance-v2-settings-calendar-format">
                    <div className="mb-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">Format Hari Sekolah</h4>
                        <p className="text-xs text-muted-foreground">Dasar perhitungan hari efektif mingguan.</p>
                      </div>
                      <InfoHelp
                        label="Format 5/6 Hari Sekolah"
                        summary="Pilih pola masuk mingguan utama untuk kelas ini."
                        detail="Format ini menentukan hari mana yang otomatis dianggap hari efektif setiap minggu."
                        example="Mode 5 hari menghitung Senin-Jumat. Mode 6 hari menghitung Senin-Sabtu."
                        impact="Jumlah hari efektif bulan ini akan berubah mengikuti format yang dipilih."
                      />
                    </div>
                    <div className="grid gap-2">
                      {[
                        { key: "5days" as const, label: "5 hari", desc: "Senin sampai Jumat" },
                        { key: "6days" as const, label: "6 hari", desc: "Senin sampai Sabtu" },
                      ].map((item) => {
                        const active = workDayFormat === item.key;
                        return (
                          <button
                            key={item.key}
                            type="button"
                            aria-pressed={active}
                            data-selected={active ? "true" : "false"}
                            onClick={() => handleWorkDayFormatChange(item.key)}
                            className={cn(
                              "flex min-h-14 touch-manipulation items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                              active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/40",
                            )}
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold">{item.label}</span>
                              <span className="block text-xs text-muted-foreground">{item.desc}</span>
                            </span>
                            {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-calendar-override">
                    <div className="flex items-center justify-between gap-3 border-b p-3 sm:p-4">
                      <div className="min-w-0">
                        <h4 className="flex items-center gap-2 text-sm font-semibold">
                          <Globe className="h-4 w-4 text-red-500" />
                          Override Libur dan Akhir Pekan
                        </h4>
                        <p className="text-xs text-muted-foreground">Jadikan tanggal tertentu tetap masuk sekolah.</p>
                      </div>
                      <InfoHelp
                        label="Override Libur dan Akhir Pekan"
                        summary="Mengubah tanggal libur menjadi tanggal masuk khusus."
                        detail="Gunakan ini saat ada kegiatan belajar atau presensi tetap berjalan pada tanggal yang biasanya libur."
                        example="Sabtu biasanya libur pada mode 5 hari, tetapi bisa ditandai masuk untuk ujian sekolah."
                        impact="Tanggal yang dioverride ikut masuk ke hari efektif dan rekap."
                      />
                    </div>
                    <div className="grid gap-0 md:grid-cols-2">
                      <div className="border-b p-3 md:border-b-0 md:border-r sm:p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">Libur nasional</p>
                          <Badge variant="secondary">{monthNationalHolidays.length}</Badge>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {monthNationalHolidays.length === 0 ? (
                            <EmptyState icon={Globe} text="Tidak ada libur nasional bulan ini." />
                          ) : (
                            monthNationalHolidays.map((holiday) => {
                              const isOverridden = holidays.some(
                                (h) => h.date === holiday.date && h.description === "Hari Kerja",
                              );

                              return (
                                <div key={holiday.date} className="flex items-center justify-between gap-2 rounded-xl border bg-background p-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold">{formatDateOnly(holiday.date)}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{holiday.name}</p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant={isOverridden ? "default" : "outline"}
                                    size="sm"
                                    className="min-h-10 shrink-0 rounded-xl px-2 text-[11px]"
                                    onClick={() =>
                                      isOverridden
                                        ? toggleHoliday({ date: holiday.date })
                                        : toggleHoliday({ date: holiday.date, description: "Hari Kerja" })
                                    }
                                  >
                                    {isOverridden ? "Pulihkan" : "Masuk"}
                                  </Button>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      <div className="p-3 sm:p-4">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">
                            {workDayFormat === "6days" ? "Hari Minggu" : "Sabtu dan Minggu"}
                          </p>
                          <Badge variant="secondary">
                            {monthDays.filter((day) => {
                              const dayOfWeek = getDay(day);
                              return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                            }).length}
                          </Badge>
                        </div>
                        <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                          {monthDays
                            .filter((day) => {
                              const dayOfWeek = getDay(day);
                              return workDayFormat === "6days" ? dayOfWeek === 0 : [0, 6].includes(dayOfWeek);
                            })
                            .map((day) => {
                              const date = format(day, "yyyy-MM-dd");
                              const isOverridden = holidays.some((h) => h.date === date && h.description === "Hari Kerja");
                              return (
                                <div key={date} className="flex items-center justify-between gap-2 rounded-xl border bg-background p-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold">{format(day, "EEEE, d MMM", { locale: idLocale })}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">
                                      {isOverridden ? "Jadwal masuk khusus" : "Libur default"}
                                    </p>
                                  </div>
                                  <Button
                                    type="button"
                                    variant={isOverridden ? "default" : "outline"}
                                    size="sm"
                                    className="min-h-10 shrink-0 rounded-xl px-2 text-[11px]"
                                    onClick={() =>
                                      isOverridden
                                        ? toggleHoliday({ date })
                                        : toggleHoliday({ date, description: "Hari Kerja" })
                                    }
                                  >
                                    {isOverridden ? "Pulihkan" : "Masuk"}
                                  </Button>
                                </div>
                              );
                            })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {settingsSection === "effective" && (
              <section className="space-y-3" data-tour="attendance-v2-settings-effective">
                <SectionIntro
                  icon={CalendarOff}
                  title="Libur dan Kegiatan Khusus"
                  description="Tambah pengecualian lokal, kegiatan kelas, dan periksa alasan tanggal tidak efektif."
                  help={
                    <InfoHelp
                      label="Libur dan Kegiatan Khusus"
                      summary="Mencatat pengecualian kalender yang tidak cukup ditangani format mingguan."
                      detail="Gunakan bagian ini untuk libur lokal, kegiatan kelas, atau agenda khusus yang memengaruhi hari efektif."
                      example="Pesantren Ramadhan, class meeting, study tour kelas tertentu, atau libur semester."
                      impact="Tanggal yang ditandai tidak efektif tidak masuk denominator rekap hari efektif."
                    />
                  }
                />

                <div className="grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-effective-holiday">
                    <div className="flex items-center justify-between gap-3 border-b p-3 sm:p-4">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">Libur Kustom</h4>
                        <p className="text-xs text-muted-foreground">Tanggal non-efektif di luar libur nasional.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <InfoHelp
                          label="Libur Kustom"
                          summary="Menandai tanggal tertentu sebagai tidak efektif."
                          detail="Gunakan untuk libur lokal sekolah atau kelas yang tidak termasuk kalender nasional."
                          example="Tanggal 12 Agustus dipakai rapat guru, sehingga kelas tidak presensi."
                          impact="Libur kustom mengurangi hari efektif dan memengaruhi rekap/export."
                        />
                        <Button type="button" variant="outline" className="min-h-10 shrink-0 rounded-xl text-xs" onClick={onAddHolidayClick}>
                          <CalendarOff className="mr-1.5 h-3.5 w-3.5" />
                          Tambah
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {holidays.length === 0 ? (
                        <EmptyState icon={CalendarOff} text="Belum ada libur kustom." />
                      ) : (
                        holidays.map((holiday) => (
                          <div key={`${holiday.date}-${holiday.class_id || "school"}`} className="flex items-center justify-between gap-2 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{formatDateOnly(holiday.date)}</p>
                              <p className="truncate text-[11px] text-muted-foreground">{holiday.description}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              <Badge variant="outline" className="text-[10px]">{holiday.class_id ? "Kelas" : "Sekolah"}</Badge>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 rounded-xl text-destructive"
                                onClick={() => handleRemoveHoliday(holiday.date, holiday.class_id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-effective-event">
                    <div className="flex items-center justify-between gap-3 border-b p-3 sm:p-4">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">Kegiatan Khusus</h4>
                        <p className="text-xs text-muted-foreground">Agenda non-KBM yang tetap perlu dicatat.</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <InfoHelp
                          label="Kegiatan Khusus"
                          summary="Mencatat agenda yang perlu muncul di kalender presensi."
                          detail="Kegiatan khusus memberi konteks pada tanggal tertentu tanpa selalu membuatnya libur."
                          example="Study tour, senam bersama, ujian sekolah, atau class meeting."
                          impact="Label kegiatan membantu guru memahami alasan tanggal saat rekap/export diperiksa."
                        />
                        <Button type="button" variant="outline" className="min-h-10 shrink-0 rounded-xl text-xs" onClick={onAddDayEventClick}>
                          <Bookmark className="mr-1.5 h-3.5 w-3.5" />
                          Tambah
                        </Button>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-y-auto divide-y">
                      {dayEvents.length === 0 ? (
                        <EmptyState icon={Bookmark} text="Belum ada kegiatan khusus." />
                      ) : (
                        dayEvents.map((event) => (
                          <div key={event.date} className="flex items-center justify-between gap-2 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-semibold">{formatDateOnly(event.date)}</p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {event.label}
                                {event.description ? ` - ${event.description}` : ""}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-10 w-10 shrink-0 rounded-xl text-destructive"
                              onClick={() => handleRemoveDayEvent(event.date)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-effective-preview">
                  <div className="flex flex-col gap-1 border-b p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold">Preview Hari Tidak Efektif</h4>
                        <p className="text-xs text-muted-foreground">Alasan ini dipakai sebelum rekap dan export Presensi V2.</p>
                      </div>
                      <InfoHelp
                        label="Preview Hari Tidak Efektif"
                        summary="Daftar tanggal yang tidak dihitung sebagai hari presensi."
                        detail="Preview ini membantu memeriksa kenapa jumlah hari efektif berbeda dari jumlah hari kalender."
                        example="Minggu, libur nasional, libur kelas, atau tanggal di luar tahun ajaran."
                        impact="Gunakan preview ini sebelum export agar angka rekap tidak membingungkan."
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 border-b p-3 sm:grid-cols-4">
                    <CompactMetric label="Hari kalender" value={monthDays.length} />
                    <CompactMetric label="Efektif" value={effectiveDays} tone="green" />
                    <CompactMetric label="Tidak efektif" value={nonEffectiveDays.length} tone="amber" />
                    <CompactMetric label="Terkunci" value={isLocked ? "Ya" : "Tidak"} tone={isLocked ? "red" : "blue"} />
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y">
                    {nonEffectiveDays.length === 0 ? (
                      <EmptyState icon={CheckCircle2} text="Tidak ada tanggal non-efektif pada bulan ini." />
                    ) : (
                      nonEffectiveDays.map((day) => (
                        <div key={day.toISOString()} className="flex items-center justify-between gap-2 p-3">
                          <div className="min-w-0">
                            <p className="truncate text-xs font-semibold">{format(day, "EEEE, d MMMM yyyy", { locale: idLocale })}</p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {getHolidayDescriptionCombined(day) || "Akhir pekan atau libur rutin"}
                            </p>
                          </div>
                          <Badge variant="outline" className="shrink-0 border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
                            Tidak efektif
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </section>
            )}

            {settingsSection === "recap" && (
              <section className="space-y-3" data-tour="attendance-v2-settings-recap">
                <SectionIntro
                  icon={FileSpreadsheet}
                  title="Profil Rekap Presensi"
                  description="Sesuaikan rumus rekap dengan kebijakan sekolah tanpa mengubah data presensi mentah."
                  help={
                    <InfoHelp
                      label="Profil Rekap Presensi"
                      summary="Mengatur cara sistem menghitung ringkasan presensi."
                      detail="Profil rekap tidak mengubah catatan presensi, hanya mengatur cara status dihitung saat rekap dan export."
                      example="Sekolah A menghitung Sakit dan Izin sebagai catatan, sekolah B menghitungnya sebagai tidak hadir."
                      impact="Pengaturan ini dapat mengubah total hadir, tidak hadir, dan persentase."
                    />
                  }
                />

                {!recapProfile ? (
                  <div className="rounded-2xl border border-dashed bg-card p-6">
                    <EmptyState icon={Info} text="Profil rekap belum tersedia untuk kelas ini." />
                  </div>
                ) : (
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                    <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4" data-tour="attendance-v2-settings-recap-denominator">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Denominator</Label>
                        <InfoHelp
                          label="Denominator Rekap"
                          summary="Angka pembagi untuk menghitung persentase presensi."
                          detail="Denominator menentukan total hari acuan saat menghitung persentase hadir atau tidak hadir."
                          example="Jika memakai hari efektif, pembagi mengikuti kalender akademik. Jika memakai hari terisi, pembagi hanya tanggal yang sudah diinput."
                          impact="Pilihan denominator sangat memengaruhi persentase akhir di rekap/export."
                        />
                      </div>
                      <div className="mt-3 grid gap-2">
                        {[
                          {
                            value: "effective_days" as const,
                            label: "Hari efektif",
                            desc: `${effectiveDays} hari sesuai kalender akademik`,
                          },
                          {
                            value: "filled_days" as const,
                            label: "Hari terisi",
                            desc: "Mengikuti tanggal yang sudah diinput",
                          },
                        ].map((item) => {
                          const active = recapProfile.denominator_policy === item.value;
                          return (
                            <button
                              key={item.value}
                              type="button"
                              aria-pressed={active}
                              data-selected={active ? "true" : "false"}
                              onClick={() => handleUpdateRecapProfile({ denominator_policy: item.value })}
                              className={cn(
                                "flex min-h-14 touch-manipulation items-center justify-between rounded-xl border px-3 py-2 text-left transition-colors",
                                active ? "border-primary bg-primary/10 text-primary" : "border-border bg-background hover:bg-muted/40",
                              )}
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold">{item.label}</span>
                                <span className="block text-xs text-muted-foreground">{item.desc}</span>
                              </span>
                              {active ? <Check className="h-4 w-4 shrink-0" /> : null}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4" data-tour="attendance-v2-settings-recap-mapping">
                      <div className="flex items-center justify-between gap-2">
                        <Label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pemetaan Status H/S/I/A/D</Label>
                        <InfoHelp
                          label="Pemetaan Status"
                          summary="Menentukan status mana yang masuk hitungan hadir atau tidak hadir."
                          detail="Setiap sekolah bisa punya aturan rekap berbeda. Status yang tidak dipilih tetap tersimpan sebagai catatan presensi."
                          example="H dihitung hadir. A biasanya dihitung tidak hadir. D bisa dihitung hadir atau hanya catatan sesuai kebijakan sekolah."
                          impact="Mapping status mengubah ringkasan kelas, persentase, dan export rekap."
                        />
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-2">
                        {[
                          {
                            type: "present" as const,
                            title: "Dihitung hadir",
                            list: recapProfile.present_statuses,
                            tone: "green",
                          },
                          {
                            type: "absence" as const,
                            title: "Dihitung tidak hadir",
                            list: recapProfile.absence_statuses,
                            tone: "red",
                          },
                        ].map((group) => (
                          <div key={group.type} className="rounded-xl border bg-background p-3">
                            <p className="text-sm font-semibold">{group.title}</p>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                              {(["H", "S", "I", "A", "D"] as const).map((status) => {
                                const selected = group.list.includes(status);
                                return (
                                  <button
                                    key={`${group.type}-${status}`}
                                    type="button"
                                    aria-pressed={selected}
                                    data-selected={selected ? "true" : "false"}
                                    onClick={() => handleToggleRecapStatus(group.type, status)}
                                    className={cn(
                                      "min-h-11 touch-manipulation rounded-xl border px-2 text-xs font-semibold transition-colors",
                                      selected && group.tone === "green" && "border-green-300 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300",
                                      selected && group.tone === "red" && "border-red-300 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300",
                                      !selected && "border-border bg-background text-muted-foreground hover:bg-muted/50",
                                    )}
                                  >
                                    {status} - {statusLabels[status]}
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
              </section>
            )}

            {settingsSection === "audit" && (
              <section className="space-y-3" data-tour="attendance-v2-settings-audit">
                <SectionIntro
                  icon={Clock}
                  title="Audit Riwayat Perubahan"
                  description="Area ini menyiapkan jejak perubahan Presensi V2: editor, waktu, sumber aksi, nilai lama, dan nilai baru."
                  help={
                    <InfoHelp
                      label="Audit Riwayat Perubahan"
                      summary="Mencatat siapa mengubah apa dan kapan."
                      detail="Audit membantu menelusuri perubahan presensi, termasuk edit manual, import, OCR, restore, dan aksi guru pengganti."
                      example="Nilai murid tanggal 12 berubah dari A ke H oleh guru pengganti pukul 08.14."
                      impact="Audit membuat data lebih aman karena perubahan penting tidak hilang tanpa jejak."
                    />
                  }
                />
                <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-audit-history">
                  <div className="grid gap-2 border-b p-3 sm:grid-cols-3 sm:p-4">
                    <CompactMetric label="Sumber" value="Manual, import, OCR, restore" tone="blue" />
                    <CompactMetric label="Editor" value="Guru asli / pengganti" />
                    <CompactMetric label="Mode bulan" value={isLocked ? "Baca saja" : "Aktif"} tone={isLocked ? "amber" : "green"} />
                  </div>
                  <EmptyState
                    icon={Activity}
                    text="Belum ada aktivitas terekam pada tampilan ini. Perubahan manual, import, OCR, dan restore akan muncul di sini saat audit V2 aktif."
                  />
                </div>
              </section>
            )}

            {settingsSection === "delegation" && (
              <section className="space-y-3" data-tour="attendance-v2-settings-delegation">
                <SectionIntro
                  icon={UserPlus}
                  title="Delegasi Guru Pengganti"
                  description="Berikan akses sementara tanpa membagikan akun. Audit tetap mencatat editor sebenarnya."
                  help={
                    <InfoHelp
                      label="Delegasi Guru Pengganti"
                      summary="Memberi akses sementara kepada guru lain."
                      detail="Delegasi dipakai saat wali kelas atau guru utama berhalangan, tetapi perubahan tetap tercatat atas nama editor sebenarnya."
                      example="Guru pengganti diberi akses edit presensi kelas VI-B hanya tanggal 10-12 Juli."
                      impact="Akses sementara mengurangi risiko berbagi akun dan memudahkan audit."
                    />
                  }
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 rounded-xl text-xs"
                      onClick={onAddDelegationClick}
                      data-tour="attendance-v2-settings-delegation-add"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" />
                      Tambah Delegasi
                    </Button>
                  }
                />

                <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-delegation-list">
                  <div className="max-h-[22rem] overflow-y-auto divide-y">
                    {delegations.length === 0 ? (
                      <EmptyState icon={UserPlus} text="Belum ada delegasi untuk kelas ini." />
                    ) : (
                      delegations.map((delegation) => (
                        <div key={delegation.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold">{delegation.grantee_label || delegation.grantee_user_id}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDateOnly(delegation.starts_at)} sampai {formatDateOnly(delegation.ends_at)}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            className="min-h-10 shrink-0 rounded-xl text-xs text-destructive hover:bg-destructive/5"
                            onClick={() => handleRevokeDelegationAction(delegation.id)}
                            disabled={isRevokingDelegation}
                          >
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
              <section className="space-y-3" data-tour="attendance-v2-settings-backup">
                <SectionIntro
                  icon={Camera}
                  title="Backup Bulanan"
                  description="Buat snapshot sebelum import besar atau pemulihan data. Restore selalu tercatat sebagai aktivitas baru."
                  help={
                    <InfoHelp
                      label="Backup dan Restore Bulanan"
                      summary="Menyimpan cadangan bulan sebelum perubahan besar."
                      detail="Backup membantu memulihkan kondisi bulan jika terjadi kesalahan import, OCR, atau edit massal."
                      example="Sebelum import presensi satu bulan, buat cadangan agar data bisa dipulihkan bila file salah."
                      impact="Restore tidak menghapus audit; sistem tetap mencatat bahwa pemulihan pernah dilakukan."
                    />
                  }
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-10 rounded-xl text-xs"
                      onClick={onAddSnapshotClick}
                      disabled={isCreatingSnapshot}
                      data-tour="attendance-v2-settings-backup-create"
                    >
                      <Camera className="mr-1.5 h-3.5 w-3.5" />
                      Buat Cadangan
                    </Button>
                  }
                />

                <div className="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
                  <div className="rounded-2xl border bg-card p-3 shadow-sm sm:p-4" data-tour="attendance-v2-settings-backup-summary">
                    <h4 className="text-sm font-semibold">Ringkasan Bulan Ini</h4>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <CompactMetric label="Hari kalender" value={monthDays.length} />
                      <CompactMetric label="Hari efektif" value={effectiveDays} tone="green" />
                      <CompactMetric label="Libur kustom" value={customHolidayCount} tone="amber" />
                      <CompactMetric label="Kegiatan" value={dayEvents.length} tone="blue" />
                    </div>
                  </div>

                  <div className="rounded-2xl border bg-card shadow-sm" data-tour="attendance-v2-settings-backup-list">
                    <div className="border-b p-3 sm:p-4">
                      <h4 className="text-sm font-semibold">Daftar Cadangan</h4>
                      <p className="text-xs text-muted-foreground">Pilih cadangan yang ingin dipulihkan.</p>
                    </div>
                    <div className="max-h-[20rem] overflow-y-auto divide-y">
                      {snapshots.length === 0 ? (
                        <EmptyState icon={Camera} text="Belum ada cadangan tersimpan." />
                      ) : (
                        snapshots.map((snapshot) => (
                          <div key={snapshot.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">
                                {format(new Date(snapshot.created_at), "d MMM yyyy HH:mm", { locale: idLocale })}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">{snapshot.reason || "Backup rutin"}</p>
                            </div>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-10 shrink-0 rounded-xl text-xs"
                              onClick={() => handleRestoreSnapshotAction(snapshot.id)}
                              disabled={isRestoringSnapshot}
                            >
                              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                              Pulihkan
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>

        <div className="shrink-0 border-t bg-background px-3 py-2 sm:px-5 lg:sticky lg:bottom-0 lg:z-20 lg:bg-background/95 lg:backdrop-blur">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="line-clamp-2 text-[11px] leading-normal text-muted-foreground">
              <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
              Perubahan ini hanya berlaku untuk jalur Presensi V2. V1 dan export V1 tetap tidak disentuh.
            </p>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 w-full rounded-xl px-6 text-sm font-semibold sm:w-auto"
            >
              Selesai
            </Button>
          </div>
        </div>
      </DialogContent>

      <DialogPortal>
        <ProductTour
          steps={settingsTourSteps}
          tourKey="attendance-v2-settings"
          requireOnboarding={false}
          zIndexBase={10120}
        />
      </DialogPortal>
    </Dialog>
  );
};

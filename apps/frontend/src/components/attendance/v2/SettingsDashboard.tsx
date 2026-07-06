import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, addYears } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  CalendarDays,
  CalendarOff,
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileSpreadsheet,
  Lock,
  LockOpen,
  Settings2,
  ShieldCheck,
  UserPlus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogPortal,
} from "@/components/ui/dialog";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { ProductTour, TourButton, type TourStep } from "@/components/ui/product-tour";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerPortal,
  DrawerOverlay,
} from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-mobile";
import type { DayEvent, Delegation, HolidayRecord, MonthSnapshot, RecapProfile } from "@/hooks/useAttendanceV2";
import { cn } from "@/lib/utils";

import {
  type SettingsSection,
  CompactMetric,
  InlinePopoverContent,
  MobileMetricsExpander,
  delayForTour,
} from "./settings/SettingsShared";
import { CalendarSection } from "./settings/CalendarSection";
import { EffectiveSection } from "./settings/EffectiveSection";
import { RecapSection } from "./settings/RecapSection";
import { AuditSection } from "./settings/AuditSection";
import { DelegationSection } from "./settings/DelegationSection";
import { BackupSection } from "./settings/BackupSection";

// ── Props Interface (100% preserved) ─────────────────────────────────

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
  handleDuplicateAgenda?: () => Promise<void>;
  isDuplicatingAgenda?: boolean;
  onBulkApplyClick?: () => void;
}

// ── Section Navigation Items ─────────────────────────────────────────

interface SectionNavItem {
  id: SettingsSection;
  title: string;
  detail: string;
  icon: React.ElementType;
  tour: string;
}

const SECTION_ITEMS: SectionNavItem[] = [
  { id: "calendar", title: "Kalender", detail: "Hari Kerja", icon: CalendarDays, tour: "attendance-v2-settings-calendar" },
  { id: "effective", title: "Libur & Kegiatan", detail: "Pengecualian", icon: CalendarOff, tour: "attendance-v2-settings-effective" },
  { id: "recap", title: "Aturan Rekap", detail: "Rumus Hitung", icon: FileSpreadsheet, tour: "attendance-v2-settings-recap" },
  { id: "audit", title: "Riwayat", detail: "Audit Log", icon: Clock, tour: "attendance-v2-settings-audit" },
  { id: "delegation", title: "Delegasi", detail: "Akses Guru", icon: UserPlus, tour: "attendance-v2-settings-delegation" },
  { id: "backup", title: "Backup", detail: "Snapshot", icon: Camera, tour: "attendance-v2-settings-backup" },
];

// ── Main Component ───────────────────────────────────────────────────

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
  handleDuplicateAgenda,
  isDuplicatingAgenda,
  onBulkApplyClick,
}) => {
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("calendar");
  const isMobile = useIsMobile();
  const mobileScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mobileScrollRef.current) {
      mobileScrollRef.current.scrollTop = 0;
    }
  }, [settingsSection]);

  const monthOptions = useMemo(() => {
    const options: Date[] = [];
    const baseYear = currentMonth.getFullYear();
    for (let m = 0; m < 12; m++) {
      options.push(new Date(baseYear, m, 1));
    }
    return options;
  }, [currentMonth.getFullYear()]);

  // ── Product Tour Steps ──────────────────────────────────────────

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
        description: "Atur pengelompokan status presensi (Hadir, Sakit, Izin, Alfa, Dispensasi) untuk menentukan apakah status tertentu dihitung sebagai kehadiran fisik atau ketidakhadiran dalam nilai akhir murid.",
        prepare: async () => {
          setSettingsSection("recap");
          await delayForTour();
        },
      },
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

  // ── Tab Content Renderer ────────────────────────────────────────

  const renderTabContent = () => {
    switch (settingsSection) {
      case "calendar":
        return (
          <CalendarSection
            workDayFormat={workDayFormat}
            handleWorkDayFormatChange={handleWorkDayFormatChange}
            monthNationalHolidays={monthNationalHolidays}
            holidays={holidays}
            toggleHoliday={toggleHoliday}
            monthDays={monthDays}
          />
        );
      case "effective":
        return (
          <EffectiveSection
            holidays={holidays}
            dayEvents={dayEvents}
            handleRemoveHoliday={handleRemoveHoliday}
            handleRemoveDayEvent={handleRemoveDayEvent}
            onAddHolidayClick={onAddHolidayClick}
            onAddDayEventClick={onAddDayEventClick}
            handleDuplicateAgenda={handleDuplicateAgenda}
            isDuplicatingAgenda={isDuplicatingAgenda}
            onBulkApplyClick={onBulkApplyClick}
            monthDays={monthDays}
            effectiveDays={effectiveDays}
            isLocked={isLocked}
            isHolidayCombined={isHolidayCombined}
            getHolidayDescriptionCombined={getHolidayDescriptionCombined}
          />
        );
      case "recap":
        return (
          <RecapSection
            recapProfile={recapProfile}
            handleUpdateRecapProfile={handleUpdateRecapProfile}
            handleToggleRecapStatus={handleToggleRecapStatus}
            effectiveDays={effectiveDays}
          />
        );
      case "audit":
        return <AuditSection isLocked={isLocked} />;
      case "delegation":
        return (
          <DelegationSection
            delegations={delegations}
            handleRevokeDelegationAction={handleRevokeDelegationAction}
            isRevokingDelegation={isRevokingDelegation}
            onAddDelegationClick={onAddDelegationClick}
          />
        );
      case "backup":
        return (
          <BackupSection
            snapshots={snapshots}
            handleRestoreSnapshotAction={handleRestoreSnapshotAction}
            isRestoringSnapshot={isRestoringSnapshot}
            isCreatingSnapshot={isCreatingSnapshot}
            onAddSnapshotClick={onAddSnapshotClick}
            monthDays={monthDays}
            effectiveDays={effectiveDays}
            holidays={holidays}
            dayEvents={dayEvents}
          />
        );
      default:
        return null;
    }
  };

  // ── Shared Tour Button Props ────────────────────────────────────

  const tourButtonProps = {
    tourKey: "attendance-v2-settings" as const,
    onBeforeStart: async () => {
      onOpenChange(true);
      setSettingsSection("calendar");
      await delayForTour();
    },
  };

  // ── Shared Auto-Save Footer ─────────────────────────────────────

  const autoSaveIndicator = (
    <div className="flex items-center gap-2">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-950/50">
        <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 stroke-[2.5]" aria-hidden="true" />
      </span>
      <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 select-none">
        Tersimpan otomatis
      </span>
    </div>
  );

  // ── Prevent Tour interaction from closing modal ─────────────────

  const preventTourClose = (e: { target: EventTarget | null; preventDefault: () => void }) => {
    const target = e.target as HTMLElement;
    if (target && (target.closest("[data-sipena-tour]") || target.closest(".sipena-tour-action"))) {
      e.preventDefault();
    }
  };

  // ── Mobile: Bottom Sheet Drawer ─────────────────────────────────

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerPortal>
          <DrawerOverlay className="fixed inset-0 z-[10080] bg-black/60 backdrop-blur-sm" />
          <DrawerContent className="fixed inset-x-0 bottom-0 z-[10090] mt-24 flex h-[90dvh] max-h-[90dvh] flex-col rounded-t-3xl border bg-background overflow-hidden outline-none">


            {/* Header */}
            <div className="px-5 pt-3 pb-2 shrink-0" data-tour="attendance-v2-settings-header">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <DrawerTitle className="flex items-center gap-2 text-base font-extrabold text-foreground">
                    <Settings2 className="h-5 w-5 text-primary shrink-0" />
                    <span className="truncate">Pengaturan Presensi V2</span>
                  </DrawerTitle>
                </div>
                <TourButton
                  {...tourButtonProps}
                  className="min-h-9 shrink-0 rounded-xl px-2.5 text-xs font-bold"
                />
              </div>
            </div>

            {/* Tab Navigation Strip */}
            <nav className="shrink-0 relative pt-1 pb-1 bg-muted/5 border-b" aria-label="Navigasi pengaturan">
              <div className="flex gap-1.5 overflow-x-auto px-4 pb-2 scrollbar-none items-end relative z-10" style={{ paddingRight: '2rem' }}>
                {SECTION_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = settingsSection === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-tour={`attendance-v2-settings-nav-${item.id}`}
                      aria-pressed={active}
                      onClick={() => setSettingsSection(item.id)}
                      className={cn(
                        "attendance-btn relative shrink-0 flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] rounded-xl text-xs font-bold transition-all duration-200 touch-manipulation select-none border",
                        active
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20 scale-95"
                          : "bg-muted/50 text-muted-foreground border-border/80 hover:bg-muted active:bg-muted/80",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span>{item.title}</span>
                    </button>
                  );
                })}
              </div>
              <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-20" />
            </nav>

            {/* Scrollable Content Pane */}
            <div
              ref={mobileScrollRef}
              className="flex-1 min-h-0 relative overflow-y-auto overscroll-contain px-5 py-4 scrollbar-thin space-y-4"
            >
              {/* Expose Month selector and static metrics at the top of scrollable content */}
              <div className="shrink-0">
                <MobileMetricsExpander
                  selectedClass={selectedClass}
                  currentMonth={currentMonth}
                  setCurrentMonth={setCurrentMonth}
                  effectiveDays={effectiveDays}
                  monthDays={monthDays}
                  isLocked={isLocked}
                  monthOptions={monthOptions}
                />
              </div>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={settingsSection}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4 max-w-full pb-8"
                >
                  {renderTabContent()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Sticky Action Footer */}
            <div className="shrink-0 border-t bg-background px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                {autoSaveIndicator}
                <Button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className="min-h-[44px] flex-1 rounded-xl text-sm font-bold shadow-md active:scale-98"
                >
                  Selesai
                </Button>
              </div>
            </div>
          </DrawerContent>

          <ProductTour
            steps={settingsTourSteps}
            tourKey="attendance-v2-settings"
            requireOnboarding={false}
            zIndexBase={10120}
          />
        </DrawerPortal>
      </Drawer>
    );
  }

  // ── Desktop: Centered Modal with Sidebar ────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        fullScreenMobile={false}
        className={cn(
          "flex flex-col gap-0 overflow-hidden p-0 sm:p-0",
          "lg:h-[min(92dvh,820px)] lg:max-h-[92dvh] lg:w-[calc(100vw-2rem)] lg:max-w-6xl rounded-2xl",
        )}
        onPointerDownOutside={preventTourClose}
        onInteractOutside={preventTourClose}
      >
        <DialogHeader
          className="shrink-0 border-b bg-background"
          data-tour="attendance-v2-settings-header"
        >
          <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3 pr-16">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-base font-extrabold sm:text-lg">
                <Settings2 className="h-5 w-5 text-primary shrink-0" />
                <span className="truncate">Pengaturan Presensi V2</span>
              </DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-relaxed sm:text-sm max-w-xl">
                Kelola kalender akademik, hari efektif, rekap, delegasi, audit, dan backup untuk kelas aktif.
              </DialogDescription>
            </div>
            <TourButton
              {...tourButtonProps}
              className="min-h-10 shrink-0 justify-center rounded-xl px-4 text-xs font-bold sm:text-sm"
            />
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-3 gap-3 px-6 pb-4 max-w-3xl">
            <div className="min-w-0">
              <CompactMetric label="Kelas" value={selectedClass?.name || "Belum dipilih"} />
            </div>
            <div className="shrink-0">
              <CompactMetric
                label="Bulan"
                value={
                  <div className="flex items-center justify-between gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 rounded-md text-foreground active:bg-muted lg:hover:bg-muted/80"
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
                          className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-bold active:bg-muted lg:hover:bg-muted/80 text-foreground transition-colors cursor-pointer select-none"
                        >
                          <span className="truncate max-w-[5rem]">
                            {format(currentMonth, "MMM yyyy", { locale: idLocale })}
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
                                  "px-2 py-2 rounded-lg text-xs text-left font-semibold transition-colors truncate active:scale-95 touch-manipulation",
                                  isSelected
                                    ? "bg-primary text-primary-foreground font-bold shadow-sm"
                                    : "active:bg-muted lg:hover:bg-muted text-foreground"
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
                            className="h-8 flex-1 px-2 rounded-lg text-[11px] font-bold active:bg-muted lg:hover:bg-muted"
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
                            className="h-8 flex-1 px-2 rounded-lg text-[11px] font-bold active:bg-muted lg:hover:bg-muted"
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
                      className="h-6 w-6 shrink-0 rounded-md text-foreground active:bg-muted lg:hover:bg-muted/80"
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
            </div>
            <div className="shrink-0">
              <CompactMetric label="Hari Efektif" value={`${effectiveDays}/${monthDays.length} hari`} tone="green" />
            </div>
          </div>
        </DialogHeader>

        {/* Sidebar + Main Content Layout */}
        <div className="min-h-0 flex-1 flex flex-row overflow-hidden">
          <aside
            className="w-64 shrink-0 bg-muted/5 py-4 pl-6 pr-[2px] -mr-[2px] border-r flex flex-col gap-1 overflow-y-auto scrollbar-none"
            data-tour="attendance-v2-settings-nav"
          >
            {SECTION_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = settingsSection === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  data-tour={`attendance-v2-settings-nav-${item.id}`}
                  aria-pressed={active}
                  onClick={() => setSettingsSection(item.id)}
                  className={cn(
                    "attendance-btn relative w-full flex items-center gap-3 min-h-[52px] rounded-l-xl rounded-r-none px-4 text-left transition-all duration-200 touch-manipulation select-none border border-r-transparent overflow-hidden",
                    active
                      ? "bg-background text-primary border-border shadow-[-4px_0_10px_-4px_rgba(0,0,0,0.05)] z-20 translate-x-[1px] before:absolute before:left-0 before:inset-y-0 before:w-[3px] before:bg-primary"
                      : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  )}
                >
                  <span className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-4.5 w-4.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-xs font-bold leading-tight">{item.title}</span>
                    <span className="block text-[10px] mt-0.5 font-semibold text-muted-foreground/75 leading-normal">
                      {item.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </aside>

          <main className="flex-1 min-h-0 relative overflow-hidden bg-background">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={settingsSection}
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -15 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className="absolute inset-0 overflow-y-auto overscroll-contain p-6 scrollbar-thin"
              >
                <div className="mx-auto max-w-4xl w-full pb-8">
                  {renderTabContent()}
                </div>
              </motion.div>
            </AnimatePresence>
          </main>
        </div>

        {/* Sticky Action Footer */}
        <div className="shrink-0 border-t bg-background">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex flex-col gap-1 min-w-0">
              {autoSaveIndicator}
              <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
                <span className="line-clamp-1 font-medium">Pengaturan hanya berlaku untuk Presensi V2. Data presensi V1 tetap aman.</span>
              </p>
            </div>
            <Button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-[44px] rounded-xl px-6 text-sm font-bold shadow-md active:scale-98"
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

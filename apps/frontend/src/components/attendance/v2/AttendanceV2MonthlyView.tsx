import React, { useRef } from "react";
import { format, getDay } from "date-fns";
import { useVirtualizer } from "@tanstack/react-virtual";
import { id as idLocale } from "date-fns/locale";
import { 
  BarChart3, Lock, Unlock, ChevronLeft, ChevronRight, 
  CalendarOff, MessageSquare, CalendarDays, Bookmark, Sun, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { NationalHolidaySync } from "@/components/attendance/NationalHolidaySync";
import { calculateJumlah, type JumlahConfig, DEFAULT_STATUSES } from "@/components/attendance/JumlahCalculationConfig";
import { PercentageRow } from "@/components/attendance/PercentageRow";
import { SmartScrollTable } from "@/components/attendance/SmartScrollTable";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  nisn: string;
}

interface MonthlyAttendanceRowProps {
  student: Student;
  idx: number;
  isLocked: boolean;
  monthDays: Date[];
  isHolidayCombined: (date: Date) => boolean;
  getAttendance: (studentId: string, date: Date) => string | null;
  getAttendanceNote: (studentId: string, date: Date) => string | null;
  isNationalHoliday: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
  getHolidayDescription: (date: Date) => string | null;
  getNationalHolidayName: (date: Date) => string | null;
  handleSetMonthlyAttendance: (studentId: string, date: Date, status: "H" | "I" | "S" | "A" | "D" | null) => void;
  allStatuses: ("H" | "I" | "S" | "A" | "D")[];
  statusConfig: any;
  jumlahConfig: JumlahConfig;
  showNISNMonthly?: boolean;
}

const MonthlyAttendanceRow = React.memo(React.forwardRef<HTMLTableRowElement, MonthlyAttendanceRowProps>(({
  student,
  idx,
  isLocked,
  monthDays,
  isHolidayCombined,
  getAttendance,
  getAttendanceNote,
  isNationalHoliday,
  getHolidayDescriptionCombined,
  getHolidayDescription,
  getNationalHolidayName,
  handleSetMonthlyAttendance,
  allStatuses,
  statusConfig,
  jumlahConfig,
  showNISNMonthly,
}, ref) => {
  const studentStats: Record<string, number> = { H: 0, I: 0, S: 0, A: 0, D: 0 };
  monthDays.forEach(day => {
    if (!isHolidayCombined(day)) {
      const st = getAttendance(student.id, day);
      if (st && st in studentStats) studentStats[st as keyof typeof studentStats]++;
    }
  });

  return (
    <tr ref={ref} className={cn(idx % 2 === 0 ? "bg-muted/5" : "bg-card")}>
      <td 
        style={{ willChange: "transform" }}
        className="sticky left-0 z-10 bg-card px-2 py-1 text-[10px] sm:text-xs border-r-2 border-b border-r-border/80 border-b-border/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] min-w-[120px] sm:min-w-[160px] max-w-[160px] sm:max-w-[200px] text-left"
      >
        <div className="flex flex-col w-[120px] sm:w-[160px]">
          <div className="flex items-start">
            <span className="text-muted-foreground font-medium w-5 sm:w-6 shrink-0 pr-1 sm:pr-1.5 text-right">{idx + 1}.</span>
            <span className="text-foreground break-words leading-tight flex-1">{student.name}</span>
          </div>
          {showNISNMonthly && student.nisn && (
            <div className="flex items-start">
              <span className="w-5 sm:w-6 shrink-0 pr-1 sm:pr-1.5"></span>
              <span className="hidden sm:block text-[9px] text-muted-foreground/80 font-medium leading-none mt-0.5">{student.nisn}</span>
            </div>
          )}
        </div>
      </td>
      {monthDays.map(day => {
        const st = getAttendance(student.id, day);
        const note = getAttendanceNote(student.id, day);
        const holidayActive = isHolidayCombined(day);
        const dayNum = getDay(day);
        const isSunday = dayNum === 0;
        return (
          <td key={day.toISOString()} className={cn("p-0.5 text-center relative border-b border-b-border/30", holidayActive && "bg-grade-warning/5")}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div
                  role="button"
                  data-touch-scroll-click-target="true"
                  className={cn("attendance-btn select-none w-7 h-7 sm:w-8 sm:h-8 mx-auto flex items-center justify-center text-[9px] sm:text-[10px] font-bold rounded-md transition-colors",
                    !isLocked && !holidayActive && "cursor-pointer",
                    holidayActive ? "bg-grade-warning/10 text-grade-warning/60"
                      : st ? statusConfig[st]?.bgActive || "bg-muted/20" : "bg-muted/20 text-muted-foreground/50 active:bg-muted/40 lg:hover:bg-muted/40",
                    isSunday && !st && "text-grade-warning/40"
                  )}
                  onClick={() => {
                    if (!holidayActive) {
                      const cycle: (("H" | "I" | "S" | "A" | "D") | null)[] = ["H", "I", "S", "A", "D", null];
                      const currIdx = cycle.indexOf(st as any);
                      const nextStatus = cycle[(currIdx + 1) % cycle.length];
                      handleSetMonthlyAttendance(student.id, day, nextStatus);
                    }
                  }}
                >
                  {holidayActive ? "L" : st || "-"}
                </div>
              </TooltipTrigger>
              {holidayActive && (
                <TooltipContent side="top" className="text-[10px] p-2 rounded-xl">
                  <p className="font-bold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-1.5">
                    <CalendarOff className="w-3 h-3" /> {isNationalHoliday(day) ? "Libur Nasional" : "Hari Libur"}
                  </p>
                  <p className="text-muted-foreground">
                    {getHolidayDescription(day) || getNationalHolidayName(day) || (isSunday ? "Hari Minggu" : "Libur")}
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
            {note && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary flex items-center justify-center cursor-pointer">
                    <MessageSquare className="w-1.5 h-1.5 text-primary-foreground" />
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px] max-w-[200px]">
                  <p className="font-semibold text-foreground">{student.name}</p>
                  <p className="text-muted-foreground">{note}</p>
                </TooltipContent>
              </Tooltip>
            )}
          </td>
        );
      })}
      {allStatuses.map(s => (
        <td key={s} className={cn("px-1 py-0.5 text-center text-[9px] sm:text-[10px] font-bold border-l border-b border-l-border/30 border-b-border/30", statusConfig[s]?.color)}>
          {studentStats[s]}
        </td>
      ))}
      <td className="px-1 py-0.5 text-center text-[9px] sm:text-[10px] font-bold border-l-2 border-b border-l-border border-b-border/30 bg-muted/20 text-foreground">
        {calculateJumlah(studentStats, jumlahConfig)}
      </td>
    </tr>
  );
}));

MonthlyAttendanceRow.displayName = "MonthlyAttendanceRow";

interface AttendanceV2MonthlyViewProps {
  isLocked: boolean;
  handleToggleLock: () => void;
  jumlahConfig: JumlahConfig;
  setJumlahConfig: (cfg: JumlahConfig) => void;
  handlePrevMonth: () => void;
  currentMonth: Date;
  handleNextMonth: () => void;
  workDayFormat: "5days" | "6days";
  holidays: any[];
  isHolidayCombined: (date: Date) => boolean;
  isNationalHoliday: (date: Date) => boolean;
  getDayEvent: (date: Date) => any;
  getHolidayDescriptionCombined: (date: Date) => string | null;
  getNationalHolidayName: (date: Date) => string | null;
  getHolidayDescription: (date: Date) => string | null;
  filteredStudents: Student[];
  getAttendance: (studentId: string, date: Date) => string | null;
  getAttendanceNote: (studentId: string, date: Date) => string | null;
  handleSetMonthlyAttendance: (studentId: string, date: Date, status: "H" | "I" | "S" | "A" | "D" | null) => void;
  allStatuses: ("H" | "I" | "S" | "A" | "D")[];
  statusConfig: any;
  monthDays: Date[];
  effectiveDays: number;
  nationalHolidays: any[];
  nationalHolidaysLoading: boolean;
  nationalHolidaysLastSynced: Date | null;
  nationalHolidaysError: string | null;
  refreshNationalHolidays: () => void;
  monthNationalHolidays: any[];
  dailyStats: Record<string, number>;
  monthlyStats: Record<string, number>;
  activeView: "daily" | "monthly";
  saveIndicator?: React.ReactNode;
  showNISNMonthly?: boolean;
  onOpenSettings?: () => void;
}

const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

export const AttendanceV2MonthlyView: React.FC<AttendanceV2MonthlyViewProps> = ({
  isLocked,
  handleToggleLock,
  jumlahConfig,
  setJumlahConfig,
  handlePrevMonth,
  currentMonth,
  handleNextMonth,
  workDayFormat,
  holidays,
  isHolidayCombined,
  isNationalHoliday,
  getDayEvent,
  getHolidayDescriptionCombined,
  getNationalHolidayName,
  getHolidayDescription,
  filteredStudents,
  getAttendance,
  getAttendanceNote,
  handleSetMonthlyAttendance,
  allStatuses,
  statusConfig,
  monthDays,
  effectiveDays,
  nationalHolidays,
  nationalHolidaysLoading,
  nationalHolidaysLastSynced,
  nationalHolidaysError,
  refreshNationalHolidays,
  monthNationalHolidays,
  dailyStats,
  monthlyStats,
  activeView,
  saveIndicator,
  showNISNMonthly,
  onOpenSettings,
}) => {
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 40,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom = virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;

  return (
    <>
      {/* Stats Cards */}
      <div className="flex sm:grid sm:grid-cols-5 gap-1.5 sm:gap-2 mb-6 overflow-x-auto pb-1.5 sm:pb-0 scrollbar-none scroll-smooth">
        {allStatuses.map((key) => {
          const cfg = statusConfig[key];
          const val = activeView === "daily" ? dailyStats[key] : monthlyStats[key];
          const IconComp = cfg.icon;
          return (
            <div key={key} data-stat-card className="rounded-2xl p-2 sm:p-3 border border-border/60 bg-muted/20 flex-shrink-0 min-w-[76px] sm:min-w-0 sm:flex-shrink">
              <div className={cn("w-6 h-6 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center mb-1", cfg.bg)}>
                <IconComp className={cn("w-3 h-3 sm:w-4 sm:h-4", cfg.color)} />
              </div>
              <p className={cn("text-base sm:text-xl font-bold", cfg.color)}>{val}</p>
              <p className="text-[8px] sm:text-xs text-muted-foreground">{cfg.label}</p>
            </div>
          );
        })}
      </div>

      {/* Legend Section */}
      <div className="rounded-2xl bg-card border-2 border-border shadow-sm overflow-hidden mb-6">
        <div className="px-3 py-2 bg-muted/30 border-b-2 border-border">
          <p className="text-[10px] sm:text-xs font-bold text-foreground uppercase tracking-wide">📋 Keterangan Status</p>
        </div>
        <div className="p-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-[10px] sm:text-xs">
            {allStatuses.map((key) => {
              const cfg = statusConfig[key];
              return (
                <div key={key} className="flex items-center gap-1.5">
                  <div className={cn("w-4 h-4 rounded-md flex items-center justify-center text-[7px] font-bold shadow-sm", cfg.bgActive)}>{key}</div>
                  <span className="text-foreground font-medium">{cfg.label}</span>
                </div>
              );
            })}
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-md bg-grade-warning/30 border border-grade-warning flex items-center justify-center text-[7px] font-bold text-grade-warning shadow-sm">L</div>
              <span className="text-foreground font-medium">Libur</span>
            </div>
          </div>

          {/* Hari Efektif */}
          <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-primary/10 border-2 border-primary/30 shadow-sm">
            <CalendarDays className="w-5 h-5 text-primary flex-shrink-0" />
            <div>
              <span className="text-sm sm:text-base font-extrabold text-primary">{effectiveDays} Hari Efektif</span>
              <span className="text-[10px] sm:text-xs text-muted-foreground ml-2">
                {format(currentMonth, "MMMM yyyy", { locale: idLocale })} • {workDayFormat === "5days" ? "Sen–Jum" : "Sen–Sab"}
              </span>
            </div>
          </div>

          {/* National Holiday Sync */}
          <NationalHolidaySync
            nationalHolidays={nationalHolidays}
            isLoading={nationalHolidaysLoading}
            lastSynced={nationalHolidaysLastSynced}
            error={nationalHolidaysError}
            onRefresh={refreshNationalHolidays}
            monthNationalHolidays={monthNationalHolidays}
          />

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border/50 text-[10px] text-muted-foreground">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3 text-primary" />
              <span>= Catatan siswa</span>
            </div>
            <div className="flex items-center gap-1">
              <Bookmark className="w-3 h-3 text-primary" />
              <span>= Kegiatan khusus</span>
            </div>
            <div className="flex items-center gap-1">
              <Sun className="w-3 h-3 text-grade-warning" />
              <span>= Hari libur kustom</span>
            </div>
            <div className="flex items-center gap-1 font-medium text-primary bg-primary/10 px-2.5 py-0.5 rounded-full ml-auto">
              <span>💡 Tip: Ketuk baris tabel berulang untuk mengubah status</span>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden" 
        data-monthly-table 
      >
        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5 border-b border-border">
          {/* Left section: Title & Save Indicator */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary flex-shrink-0" />
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">Rekap Bulanan</span>
              {saveIndicator && <div className="ml-1.5 flex-shrink-0">{saveIndicator}</div>}
            </div>
          </div>

          {/* Right section: Navigation & Action Buttons */}
          <div className="flex items-center justify-between sm:justify-end gap-3 w-full sm:w-auto border-t border-border/30 pt-2 sm:border-t-0 sm:pt-0">
            {/* Action buttons (Lock & Config) */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant={isLocked ? "default" : "outline"} size="sm" className="sipena-monthly-lock-btn h-8 px-2.5 text-xs gap-1 rounded-xl" onClick={handleToggleLock}>
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                    <span className="hidden xs:inline sm:inline">{isLocked ? "Terkunci" : "Terbuka"}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs sm:hidden">{isLocked ? "Kunci Aktif" : "Kunci Nonaktif"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={
                      jumlahConfig.mode === "default" ||
                      (jumlahConfig.selectedStatuses.length === DEFAULT_STATUSES.length &&
                        DEFAULT_STATUSES.every((s) => jumlahConfig.selectedStatuses.includes(s)))
                        ? "outline"
                        : "default"
                    }
                    size="sm"
                    className={cn(
                      "sipena-jumlah-config-btn h-8 px-2.5 text-xs gap-1 rounded-xl",
                      (jumlahConfig.mode !== "default" &&
                        !(
                          jumlahConfig.selectedStatuses.length === DEFAULT_STATUSES.length &&
                          DEFAULT_STATUSES.every((s) => jumlahConfig.selectedStatuses.includes(s))
                        )) &&
                        "bg-primary text-primary-foreground"
                    )}
                    onClick={() => onOpenSettings?.()}
                  >
                    <Settings2 className="w-3 h-3" />
                    <span className="hidden sm:inline">Jumlah</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-xs max-w-[200px] p-2">
                  <p className="font-semibold mb-1">Logika Kolom Jumlah</p>
                  <p className="text-muted-foreground text-[10px]">
                    Menghitung: {jumlahConfig.mode === "default" ? DEFAULT_STATUSES.join(", ") : (jumlahConfig.selectedStatuses.join(", ") || "Tidak ada")}. 
                    Klik untuk mengubah di Pengaturan.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={handlePrevMonth}><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-xs font-medium min-w-[70px] sm:min-w-[85px] text-center text-foreground">{format(currentMonth, "MMM yyyy", { locale: idLocale })}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl" onClick={handleNextMonth}><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>

        {isLocked && (
          <div className="flex items-center justify-between gap-3 px-3 py-2 bg-amber-500/10 dark:bg-amber-500/5 border-b border-amber-500/20 text-xs text-amber-800 dark:text-amber-400 font-medium overflow-hidden animate-fade-in">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="flex items-center justify-center px-1.5 py-0.5 rounded-md bg-amber-500 text-white font-semibold text-[10px] uppercase tracking-wider select-none shrink-0 shadow-sm z-10 animate-pulse">
                Terkunci
              </span>
              <div className="flex-1 min-w-0 overflow-hidden relative h-5 flex items-center">
                <span className="animate-sipena-lock-marquee absolute whitespace-nowrap pl-1">
                  Rekap presensi dikunci. Buka gembok di atas untuk mengedit data.
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 font-semibold select-none z-10 bg-[#fdf6e2] dark:bg-[#1a140b] pl-2 py-0.5">
              <Lock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-500" />
            </div>
          </div>
        )}

        <SmartScrollTable ref={tableContainerRef} data-tour="attendance-table" className="max-h-[380px] sm:max-h-[480px]">
          <table className="w-full text-center border-separate border-spacing-0 min-w-max select-none">
            <thead className="z-10 bg-slate-50 dark:bg-slate-900">
              <tr>
                <th 
                  style={{ willChange: "transform" }}
                  className="sticky left-0 top-0 z-30 bg-slate-50 dark:bg-slate-900 px-2 py-1.5 text-[10px] sm:text-xs font-semibold text-left text-foreground border-r-2 border-b border-r-border/80 border-b-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] min-w-[120px] sm:min-w-[160px]"
                >
                  <div className="flex items-center w-[120px] sm:w-[160px] text-left">
                    <span className="w-5 sm:w-6 shrink-0 pr-1 sm:pr-1.5 text-right text-muted-foreground">No.</span>
                    <span className="truncate flex-1">Nama Murid</span>
                  </div>
                </th>
                {monthDays.map(day => {
                  const dayNum = getDay(day);
                  const isSun = dayNum === 0;
                  const isSat = workDayFormat === "5days" && dayNum === 6;
                  const ev = getDayEvent(day);
                  const holCustom = holidays.some(h => h.date === format(day, "yyyy-MM-dd"));
                  const isNatHol = isNationalHoliday(day);
                  return (
                    <th key={day.toISOString()} className={cn("sticky top-0 z-20 px-0.5 py-1 min-w-[28px] sm:min-w-[32px] border-l border-b border-l-border/30 border-b-border bg-slate-50 dark:bg-slate-900",
                      isSun && "bg-grade-warning/10 dark:bg-grade-warning/20",
                      holCustom && "bg-red-50 dark:bg-red-900/10",
                      isNatHol && !holCustom && "bg-red-50/50 dark:bg-red-950/10",
                      ev && "bg-primary/5"
                    )}>
                      <Popover>
                        <PopoverTrigger asChild>
                          <button className="w-full cursor-pointer focus:outline-none touch-manipulation min-h-[32px]">
                            <p className={cn("text-[7px] sm:text-[8px] font-medium", isSun || isSat ? "text-grade-warning" : "text-muted-foreground")}>{dayNames[dayNum]}</p>
                            <p className={cn("text-[9px] sm:text-[10px] font-bold leading-tight", isSun ? "text-grade-warning" : holCustom ? "text-red-500" : isNatHol ? "text-red-400" : "text-foreground")}>{format(day, "d")}</p>
                            {ev && <div className="w-1.5 h-1.5 rounded-full bg-primary mx-auto mt-0.5" />}
                            {holCustom && <div className="w-1.5 h-1.5 rounded-full bg-red-500 mx-auto mt-0.5" />}
                            {isNatHol && !holCustom && <div className="w-1.5 h-1.5 rounded-full bg-red-400 mx-auto mt-0.5" />}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent side="bottom" className="text-[10px] max-w-[220px] p-2.5">
                          <p className="font-semibold text-foreground">{format(day, "EEEE, d MMMM", { locale: idLocale })}</p>
                          {ev && <p className="text-primary mt-1">📌 {ev.label}{ev.description ? `: ${ev.description}` : ""}</p>}
                          {holCustom && <p className="text-red-500 mt-1">🔴 {getHolidayDescriptionCombined(day)}</p>}
                          {isNatHol && <p className="text-red-400 mt-1">🇮🇩 {getNationalHolidayName(day)}</p>}
                          {!ev && !holCustom && !isNatHol && !isSun && <p className="text-muted-foreground mt-1">Hari kerja biasa</p>}
                          {isSun && !holCustom && !isNatHol && <p className="text-grade-warning mt-1">☀️ Hari Minggu</p>}
                        </PopoverContent>
                      </Popover>
                    </th>
                  );
                })}
                {allStatuses.map(s => (
                  <th key={s} className={cn("sticky top-0 z-20 px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-bold min-w-[28px] sm:min-w-[32px] border-l border-b border-l-border/50 border-b-border bg-slate-50 dark:bg-slate-900", statusConfig[s]?.color)}>{s}</th>
                ))}
                <th className="sticky top-0 z-20 px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-bold min-w-[32px] sm:min-w-[36px] border-l-2 border-b border-l-border border-b-border bg-muted/95 text-foreground">
                  Jml
                </th>
              </tr>
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr>
                  <td style={{ height: `${paddingTop}px` }} colSpan={monthDays.length + allStatuses.length + 2} />
                </tr>
              )}
              {virtualItems.map((virtualItem) => {
                const student = filteredStudents[virtualItem.index];
                return (
                  <MonthlyAttendanceRow
                    key={student.id}
                    ref={rowVirtualizer.measureElement}
                    data-index={virtualItem.index}
                    student={student}
                    idx={virtualItem.index}
                    isLocked={isLocked}
                    monthDays={monthDays}
                    isHolidayCombined={isHolidayCombined}
                    getAttendance={getAttendance}
                    getAttendanceNote={getAttendanceNote}
                    isNationalHoliday={isNationalHoliday}
                    getHolidayDescriptionCombined={getHolidayDescriptionCombined}
                    getHolidayDescription={getHolidayDescription}
                    getNationalHolidayName={getNationalHolidayName}
                    handleSetMonthlyAttendance={handleSetMonthlyAttendance}
                    allStatuses={allStatuses}
                    statusConfig={statusConfig}
                    jumlahConfig={jumlahConfig}
                    showNISNMonthly={showNISNMonthly}
                  />
                );
              })}
              {paddingBottom > 0 && (
                <tr>
                  <td style={{ height: `${paddingBottom}px` }} colSpan={monthDays.length + allStatuses.length + 2} />
                </tr>
              )}
            </tbody>
            {/* Total Row */}
            <tfoot>
              <tr className="border-t-2 border-border bg-muted">
                <td className="sticky left-0 z-10 bg-muted px-2 py-1.5 text-[10px] sm:text-xs font-bold text-foreground border-r-2 border-b border-r-border/80 border-b-border shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)] bg-muted/95" colSpan={1}>
                  <div className="w-[120px] sm:w-[160px] text-left">Total</div>
                </td>
                {monthDays.map(day => {
                  const dayCounts: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                  filteredStudents.forEach(student => {
                    if (!isHolidayCombined(day)) {
                      const st = getAttendance(student.id, day);
                      if (st) dayCounts[st] = (dayCounts[st] || 0) + 1;
                    }
                  });
                  const dayTotal = dayCounts.H + dayCounts.S + dayCounts.I + dayCounts.A + dayCounts.D;
                  return (
                    <td key={day.toISOString()} className="p-0.5 text-center text-[9px] sm:text-[10px] font-bold border-b border-b-border">
                      {dayTotal || ""}
                    </td>
                  );
                })}
                {(() => {
                  const totals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                  let grandJumlah = 0;
                  filteredStudents.forEach(student => {
                    const studentStats: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
                    monthDays.forEach(day => {
                      if (!isHolidayCombined(day)) {
                        const st = getAttendance(student.id, day);
                        if (st && st in totals) {
                          totals[st as keyof typeof totals]++;
                          studentStats[st as keyof typeof studentStats]++;
                        }
                      }
                    });
                    grandJumlah += calculateJumlah(studentStats, jumlahConfig);
                  });
                  return (
                    <>
                      {allStatuses.map(s => (
                        <td key={s} className={cn("px-1 py-1.5 text-center text-[9px] sm:text-[10px] font-bold border-l border-b border-l-border/30 border-b-border", statusConfig[s]?.color)}>
                          {totals[s]}
                        </td>
                      ))}
                      <td className="px-1 py-1.5 text-center text-[9px] sm:text-[10px] font-extrabold border-l-2 border-b border-l-border border-b-border text-foreground bg-muted">
                        {grandJumlah}
                      </td>
                    </>
                  );
                })()}
              </tr>
              {/* Percentage Row */}
              <PercentageRow
                allStatuses={allStatuses}
                filteredStudents={filteredStudents}
                monthDays={monthDays}
                effectiveDays={effectiveDays}
                getAttendance={getAttendance}
                isHoliday={isHolidayCombined}
                statusConfig={statusConfig}
                jumlahConfig={jumlahConfig}
              />
            </tfoot>
          </table>
        </SmartScrollTable>
      </div>
    </>
  );
};

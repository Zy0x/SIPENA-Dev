import React, { useRef, useState, useMemo } from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users, Search, Check, MessageSquare, CheckSquare } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
  nisn: string;
}

interface DailyAttendanceRowProps {
  student: Student;
  index: number;
  status: string | null;
  note: string | null;
  selectedDate: Date;
  holidayActive: boolean;
  handleOpenNote: (studentId: string, name: string, date: Date) => void;
  handleSetAttendance: (studentId: string, date: Date, status: string | null) => void;
  allStatuses: string[];
  statusConfig: any;
  showNISNDaily?: boolean;
}

const DailyAttendanceRow: React.FC<DailyAttendanceRowProps> = React.memo(({
  student,
  index,
  status,
  note,
  selectedDate,
  holidayActive,
  handleOpenNote,
  handleSetAttendance,
  allStatuses,
  statusConfig,
  showNISNDaily,
}) => {
  return (
    <div 
      className={cn(
        "flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4 sm:px-4 sm:py-2.5 transition-colors", 
        holidayActive ? "opacity-40" : "lg:hover:bg-muted/30"
      )}
    >
      {/* Number + Name Container */}
      <div className="flex items-center gap-2 w-full sm:w-auto min-w-0 flex-1">
        {/* Number badge */}
        <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
          <span className="text-[8px] sm:text-[10px] font-semibold text-muted-foreground">{index + 1}</span>
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1.5">
              <p className="text-[12px] sm:text-sm font-semibold sm:font-medium text-foreground leading-snug break-words">
                {student.name}
              </p>
              {!status && !holidayActive && (
                <Badge 
                  variant="outline" 
                  className="text-[9px] px-1.5 py-0 h-4 flex-shrink-0 bg-red-50 text-red-600 border-red-200 dark:bg-red-950/30 dark:text-red-400 dark:border-red-900/50 rounded-full font-medium"
                >
                  Belum Absen
                </Badge>
              )}
              {note && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button 
                      onClick={() => handleOpenNote(student.id, student.name, selectedDate)} 
                      className="flex-shrink-0 touch-manipulation"
                    >
                      <MessageSquare className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-primary" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[200px] text-xs">{note}</TooltipContent>
                </Tooltip>
              )}
            </div>
            {showNISNDaily && student.nisn && (
              <p className="hidden sm:block text-[10px] text-muted-foreground font-medium">NISN: {student.nisn}</p>
            )}
          </div>
        </div>
      </div>

      {/* Status buttons + Note */}
      <div className="flex items-center gap-1.5 sm:gap-1.5 flex-shrink-0 ml-7 sm:ml-0 mt-0.5 sm:mt-0">
        {allStatuses.map((s) => {
          const isSelected = status === s;
          const cfg = statusConfig[s];
          return (
            <button 
              key={s}
              onClick={() => handleSetAttendance(student.id, selectedDate, isSelected ? null : s)}
              disabled={holidayActive}
              className={cn(
                "flex items-center justify-center touch-manipulation select-none attendance-btn",
                "w-9 h-9 rounded-lg sm:rounded-xl sm:w-auto sm:h-auto sm:min-w-[38px] sm:min-h-[40px] sm:px-1 sm:py-1 sm:flex-col",
                isSelected ? cn(cfg.bgActive, "shadow-sm") : "bg-muted/50 text-muted-foreground lg:hover:bg-muted/80",
                holidayActive && "cursor-not-allowed opacity-40"
              )}
              aria-label={cfg.label}
            >
              <span className="text-[11px] sm:text-xs font-bold leading-none">{s}</span>
              <span className={cn("text-[5px] sm:text-[7px] leading-none mt-0.5 font-medium hidden sm:block", isSelected ? "opacity-80" : "opacity-60")}>
                {cfg.label}
              </span>
            </button>
          );
        })}
        {/* Note button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button 
              onClick={() => handleOpenNote(student.id, student.name, selectedDate)}
              disabled={holidayActive}
              className={cn(
                "flex w-9 h-9 rounded-lg sm:rounded-lg sm:w-auto sm:h-auto sm:min-w-[38px] sm:min-h-[40px] items-center justify-center touch-manipulation flex-shrink-0 attendance-btn",
                note ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground lg:hover:bg-muted/80",
                holidayActive && "opacity-40 cursor-not-allowed"
              )}
            >
              <MessageSquare className="w-3.5 h-3.5 sm:w-3.5 sm:h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Catatan</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
});

DailyAttendanceRow.displayName = "DailyAttendanceRow";

interface AttendanceV2DailyViewProps {
  selectedClass: any;
  selectedDate: Date;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  setShowBulkDialog: (show: boolean) => void;
  isHolidayCombined: (date: Date) => boolean;
  getHolidayDescriptionCombined: (date: Date) => string | null;
  filteredStudents: Student[];
  getAttendance: (studentId: string, date: Date) => string | null;
  getAttendanceNote: (studentId: string, date: Date) => string | null;
  handleOpenNote: (studentId: string, name: string, date: Date) => void;
  handleSetAttendance: (studentId: string, date: Date, status: string | null) => void;
  allStatuses: string[];
  statusConfig: any;
  saveIndicator?: React.ReactNode;
  showNISNDaily?: boolean;
}

export const AttendanceV2DailyView: React.FC<AttendanceV2DailyViewProps> = ({
  selectedClass,
  selectedDate,
  searchQuery,
  setSearchQuery,
  setShowBulkDialog,
  isHolidayCombined,
  getHolidayDescriptionCombined,
  filteredStudents,
  getAttendance,
  getAttendanceNote,
  handleOpenNote,
  handleSetAttendance,
  allStatuses,
  statusConfig,
  saveIndicator,
  showNISNDaily,
}) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "absent">("all");

  const localFilteredStudents = useMemo(() => {
    if (statusFilter === "all") return filteredStudents;
    return filteredStudents.filter((student) => {
      const status = getAttendance(student.id, selectedDate);
      if (statusFilter === "missing") return !status;
      if (statusFilter === "absent") return status === "S" || status === "I" || status === "A" || status === "D";
      return true;
    });
  }, [filteredStudents, statusFilter, getAttendance, selectedDate]);

  const rowVirtualizer = useVirtualizer({
    count: localFilteredStudents.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 64,
    overscan: 5,
  });

  return (
    <div data-tour="attendance-table" className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden max-w-full">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto flex-wrap">
          <Users className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate max-w-[120px] sm:max-w-none">{selectedClass?.name}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
            {format(selectedDate, "d MMM", { locale: idLocale })}
          </Badge>
          
          {!isHolidayCombined(selectedDate) && filteredStudents.filter(s => !getAttendance(s.id, selectedDate)).length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex-shrink-0 animate-pulse">
              {filteredStudents.filter(s => !getAttendance(s.id, selectedDate)).length} Belum Absen
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-between sm:justify-end">
          {saveIndicator && <div className="flex-shrink-0">{saveIndicator}</div>}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input 
              placeholder="Cari murid..." 
              value={searchQuery} 
              onChange={(e) => setSearchQuery(e.target.value)} 
              className="pl-7 h-8 text-xs w-full sm:w-44 md:w-56 lg:w-64 rounded-xl transition-all" 
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowBulkDialog(true)} 
                disabled={isHolidayCombined(selectedDate)} 
                className="text-xs h-8 px-2.5 gap-1.5 rounded-xl flex-shrink-0"
              >
                <CheckSquare className="w-3.5 h-3.5 text-primary" />
                <span className="hidden xs:inline sm:inline">Presensi Massal</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs sm:hidden">Presensi Massal</TooltipContent>
          </Tooltip>
        </div>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-muted/10 border-b border-border overflow-x-auto scrollbar-none">
        <button 
          onClick={() => setStatusFilter("all")} 
          className={cn(
            "attendance-btn h-7 text-[10px] rounded-full px-3 whitespace-nowrap transition-colors select-none outline-none focus:outline-none active:scale-[0.98]",
            statusFilter === "all" 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-background text-muted-foreground border border-input"
          )}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Semua Murid
        </button>
        <button 
          onClick={() => setStatusFilter("missing")} 
          className={cn(
            "attendance-btn h-7 text-[10px] rounded-full px-3 whitespace-nowrap relative transition-colors select-none outline-none focus:outline-none active:scale-[0.98] flex items-center",
            statusFilter === "missing" 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-background text-muted-foreground border border-input"
          )}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Belum Absen
          {!isHolidayCombined(selectedDate) && filteredStudents.filter(s => !getAttendance(s.id, selectedDate)).length > 0 && (
            <span className={cn(
              "ml-1.5 inline-flex items-center justify-center rounded-full w-4 h-4 text-[8px] font-bold",
              statusFilter === "missing" 
                ? "bg-primary-foreground text-primary" 
                : "bg-destructive text-destructive-foreground"
            )}>
              {filteredStudents.filter(s => !getAttendance(s.id, selectedDate)).length}
            </span>
          )}
        </button>
        <button 
          onClick={() => setStatusFilter("absent")} 
          className={cn(
            "attendance-btn h-7 text-[10px] rounded-full px-3 whitespace-nowrap transition-colors select-none outline-none focus:outline-none active:scale-[0.98]",
            statusFilter === "absent" 
              ? "bg-primary text-primary-foreground shadow-sm" 
              : "bg-background text-muted-foreground border border-input"
          )}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          Sakit/Izin/Alpha/Disp
        </button>
      </div>

      {isHolidayCombined(selectedDate) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-grade-warning/5 border-b border-grade-warning/10 text-xs">
          <span className="text-grade-warning font-medium">{getHolidayDescriptionCombined(selectedDate)}</span>
        </div>
      )}

      <div 
        ref={parentRef}
        className="h-[340px] sm:h-[420px] overflow-y-auto overscroll-contain relative bg-card"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {localFilteredStudents.length > 0 ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualItem) => {
              const student = localFilteredStudents[virtualItem.index];
              const status = getAttendance(student.id, selectedDate);
              const note = getAttendanceNote(student.id, selectedDate);
              const holidayActive = isHolidayCombined(selectedDate);

              return (
                <div
                  key={student.id}
                  ref={rowVirtualizer.measureElement}
                  data-index={virtualItem.index}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                  className="border-b border-border/40 last:border-0"
                >
                  <DailyAttendanceRow
                    student={student}
                    index={virtualItem.index}
                    status={status}
                    note={note}
                    selectedDate={selectedDate}
                    holidayActive={holidayActive}
                    handleOpenNote={handleOpenNote}
                    handleSetAttendance={handleSetAttendance}
                    allStatuses={allStatuses}
                    statusConfig={statusConfig}
                    showNISNDaily={showNISNDaily}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 mb-4 flex flex-col items-center justify-center group opacity-80">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl group-hover:bg-primary/20 transition-colors duration-500"></div>
              <svg className="w-10 h-10 sm:w-12 sm:h-12 text-primary/60 relative z-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                <path d="M19 8v6m-3-3h6" opacity="0.4" />
              </svg>
            </div>
            <p className="text-xs sm:text-sm font-medium">Tidak ada murid ditemukan</p>
          </div>
        )}
      </div>
    </div>
  );
};

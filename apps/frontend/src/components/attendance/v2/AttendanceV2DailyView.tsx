import React from "react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Users, Search, Check, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface Student {
  id: string;
  name: string;
}

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
}) => {
  return (
    <div data-tour="attendance-table" className="rounded-2xl bg-card border border-border shadow-sm overflow-hidden max-w-full">
      <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-3.5 border-b border-border">
        <div className="flex items-center gap-2 min-w-0 w-full sm:w-auto">
          <Users className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-semibold truncate flex-1 sm:flex-none">{selectedClass?.name}</span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 flex-shrink-0">
            {format(selectedDate, "d MMM", { locale: idLocale })}
          </Badge>
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
                className="text-xs h-8 px-2.5 gap-1 rounded-xl flex-shrink-0"
              >
                <Check className="w-3 h-3" />
                <span className="hidden xs:inline sm:inline">Semua</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent className="text-xs sm:hidden">Presensi Massal</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {isHolidayCombined(selectedDate) && (
        <div className="flex items-center gap-2 px-3 py-2 bg-grade-warning/5 border-b border-grade-warning/10 text-xs">
          <span className="text-grade-warning font-medium">{getHolidayDescriptionCombined(selectedDate)}</span>
        </div>
      )}

      <ScrollArea className="h-[340px] sm:h-[420px] overscroll-auto">
        <div className="divide-y divide-border/50">
          {filteredStudents.map((student, index) => {
            const status = getAttendance(student.id, selectedDate);
            const note = getAttendanceNote(student.id, selectedDate);
            const holidayActive = isHolidayCombined(selectedDate);

            return (
              <div 
                key={student.id} 
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
                    <div className="flex items-center gap-1.5">
                      <p className="text-[12px] sm:text-sm font-semibold sm:font-medium text-foreground leading-snug break-words">
                        {student.name}
                      </p>
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
          })}
          {filteredStudents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Users className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-xs">Tidak ada murid ditemukan</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

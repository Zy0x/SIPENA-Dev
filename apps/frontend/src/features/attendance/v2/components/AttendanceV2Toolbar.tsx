import React from "react";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  CalendarDays, ChevronLeft, ChevronRight, Lock, Unlock, Download, Upload, Plus
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface AttendanceV2ToolbarProps {
  classes: any[];
  selectedClassId: string;
  onClassChange: (id: string) => void;
  selectedMonth: Date;
  onMonthChange: (date: Date) => void;
  isLocked: boolean;
  onToggleLock: () => void;
  onAddHoliday: () => void;
  onAddEvent: () => void;
  onBulkUpdate: () => void;
  onExport: () => void;
  onImport: () => void;
}

export const AttendanceV2Toolbar: React.FC<AttendanceV2ToolbarProps> = ({
  classes,
  selectedClassId,
  onClassChange,
  selectedMonth,
  onMonthChange,
  isLocked,
  onToggleLock,
  onAddHoliday,
  onAddEvent,
  onBulkUpdate,
  onExport,
  onImport,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 border rounded-xl bg-white dark:bg-slate-950 shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        {/* Class Selector */}
        <div className="w-[180px]">
          <Select value={selectedClassId} onValueChange={onClassChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih Kelas" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((cls) => (
                <SelectItem key={cls.id} value={cls.id}>
                  {cls.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Selector Navigation */}
        <div className="flex items-center space-x-1 border rounded-lg p-0.5">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMonthChange(subMonths(selectedMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-semibold px-3 capitalize">
            {format(selectedMonth, "MMMM yyyy", { locale: idLocale })}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onMonthChange(addMonths(selectedMonth, 1))}
            className="h-8 w-8"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={onBulkUpdate} disabled={isLocked}>
          Update Massal
        </Button>
        <Button variant="outline" size="sm" onClick={onAddHoliday} disabled={isLocked}>
          <Plus className="w-4 h-4 mr-1" /> Libur
        </Button>
        <Button variant="outline" size="sm" onClick={onAddEvent} disabled={isLocked}>
          <Plus className="w-4 h-4 mr-1" /> Event
        </Button>
        <Button variant="outline" size="sm" onClick={onToggleLock}>
          {isLocked ? <Lock className="w-4 h-4 mr-1" /> : <Unlock className="w-4 h-4 mr-1" />}
          {isLocked ? "Buka Kunci" : "Kunci"}
        </Button>
        <Button variant="outline" size="sm" onClick={onImport} disabled={isLocked}>
          <Upload className="w-4 h-4 mr-1" /> Import
        </Button>
        <Button variant="default" size="sm" onClick={onExport}>
          <Download className="w-4 h-4 mr-1" /> Export
        </Button>
      </div>
    </div>
  );
};

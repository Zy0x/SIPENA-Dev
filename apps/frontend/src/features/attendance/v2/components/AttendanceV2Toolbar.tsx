import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ChevronLeft, ChevronRight, Lock, Unlock, Download, Upload, Plus, Settings, Eye
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
  
  // V2 specific props
  workDayFormat: "5days" | "6days";
  onWorkDayFormatChange: (format: "5days" | "6days") => void;
  isRetroactive: boolean;
  onRetroactiveChange: (val: boolean) => void;
  actorName: string;
  onActorNameChange: (val: string) => void;
  onOpenStatusRegistry: () => void;
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
  
  workDayFormat,
  onWorkDayFormatChange,
  isRetroactive,
  onRetroactiveChange,
  actorName,
  onActorNameChange,
  onOpenStatusRegistry,
}) => {
  return (
    <div className="flex flex-col gap-4 p-4 border rounded-xl bg-white dark:bg-slate-950 shadow-sm">
      {/* Top row: selectors and navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
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

          {/* Workday format selector */}
          <div className="w-[160px]">
            <Select value={workDayFormat} onValueChange={(val) => onWorkDayFormatChange(val as "5days" | "6days")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Tipe Hari Kerja" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5days">5 Hari Kerja (Sabtu Libur)</SelectItem>
                <SelectItem value="6days">6 Hari Kerja (Sabtu Aktif)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={onBulkUpdate} disabled={isLocked} className="text-xs">
            Update Massal
          </Button>
          <Button variant="outline" size="sm" onClick={onOpenStatusRegistry} className="text-xs">
            <Settings className="w-3.5 h-3.5 mr-1" /> Status V2
          </Button>
          <Button variant="outline" size="sm" onClick={onAddHoliday} disabled={isLocked} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Libur
          </Button>
          <Button variant="outline" size="sm" onClick={onAddEvent} disabled={isLocked} className="text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Event
          </Button>
          <Button variant="outline" size="sm" onClick={onToggleLock} className="text-xs">
            {isLocked ? <Lock className="w-3.5 h-3.5 mr-1 text-rose-500" /> : <Unlock className="w-3.5 h-3.5 mr-1 text-emerald-500" />}
            {isLocked ? "Buka Kunci" : "Kunci"}
          </Button>
          <Button variant="default" size="sm" onClick={onExport} className="text-xs bg-purple-600 hover:bg-purple-700">
            <Download className="w-3.5 h-3.5 mr-1" /> Export V2
          </Button>
        </div>
      </div>

      {/* Bottom row: audit actor name and retroactive mode */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
        {/* Retroactive Switch & Actor Info */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="retroactive-mode"
              checked={isRetroactive}
              onCheckedChange={(c) => onRetroactiveChange(!!c)}
            />
            <Label htmlFor="retroactive-mode" className="text-xs cursor-pointer font-medium text-amber-700 dark:text-amber-400">
              Mode Edit Retroaktif (Bypass aturan kunci/non-efektif)
            </Label>
          </div>

          <div className="flex items-center space-x-2">
            <Label htmlFor="actor-name" className="text-xs text-slate-500 font-medium shrink-0">
              Nama Aktor Audit:
            </Label>
            <Input
              id="actor-name"
              type="text"
              value={actorName}
              onChange={(e) => onActorNameChange(e.target.value)}
              placeholder="Nama operator presensi..."
              className="h-7 text-xs w-[160px] py-1 px-2 border rounded-md"
            />
          </div>
        </div>

        <div className="text-[10px] text-slate-400 font-mono self-end sm:self-center">
          V2 Engine Active
        </div>
      </div>
    </div>
  );
};

import React from "react";
import { format, getDay, isSameDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CalendarOff, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { HolidayRecord } from "@/hooks/useAttendanceV2";

interface HolidayAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedHolidayDates: Date[];
  setSelectedHolidayDates: React.Dispatch<React.SetStateAction<Date[]>>;
  holidayDescription: string;
  setHolidayDescription: (desc: string) => void;
  isHolidayGlobal: boolean;
  setIsHolidayGlobal: (global: boolean) => void;
  isHolidayCombined: (date: Date) => boolean;
  getExistingHolidayForDate: (date: Date) => HolidayRecord | undefined;
  handleAddHoliday: () => Promise<void>;
}

export const HolidayAddDialog: React.FC<HolidayAddDialogProps> = ({
  open,
  onOpenChange,
  selectedHolidayDates,
  setSelectedHolidayDates,
  holidayDescription,
  setHolidayDescription,
  isHolidayGlobal,
  setIsHolidayGlobal,
  isHolidayCombined,
  getExistingHolidayForDate,
  handleAddHoliday,
}) => {
  const handleToggleHolidayDate = (date: Date) => {
    setSelectedHolidayDates((prev) =>
      prev.some((d) => isSameDay(d, date))
        ? prev.filter((d) => !isSameDay(d, date))
        : [...prev, date]
    );
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setSelectedHolidayDates([]);
          setHolidayDescription("");
        }
      }}
    >
      <DialogContent
        className={cn(
          "w-[calc(100vw-1.5rem)] max-w-md",
          "mx-auto rounded-2xl",
          "max-h-[90dvh] sm:max-h-[85vh]",
          "flex flex-col p-0 overflow-hidden"
        )}
      >
        {/* Header — fixed */}
        <DialogHeader className="px-4 pt-4 pb-3 flex-shrink-0 border-b border-border">
          <DialogTitle className="text-sm sm:text-base flex items-center gap-2">
            <CalendarOff className="w-4 h-4 text-grade-warning flex-shrink-0" />
            Tambah Hari Libur
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih satu atau beberapa tanggal sekaligus untuk ditambahkan sebagai hari libur atau hari kerja kustom.
            <span className="block mt-1 text-grade-warning font-medium">
              Gunakan keterangan <strong>"Hari Kerja"</strong> untuk mengubah hari Minggu/Libur Nasional menjadi hari sekolah aktif.
            </span>
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-auto px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Pilih Tanggal (bisa lebih dari satu)
            </Label>
            <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden bg-amber-50/30 dark:bg-amber-950/20">
              <div className="px-3 py-1.5 bg-amber-100/50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800">
                <p className="text-[9px] font-semibold text-amber-700 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1">
                  <CalendarOff className="w-3 h-3" /> Kalender Hari Libur
                </p>
              </div>
              <div className="w-full overflow-x-auto">
                <div className="min-w-[280px] max-w-full mx-auto">
                  <Calendar
                    mode="multiple"
                    selected={selectedHolidayDates}
                    onSelect={(dates) => setSelectedHolidayDates(dates || [])}
                    className="pointer-events-auto mx-auto"
                    classNames={{
                      months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                      month: "space-y-4 w-full",
                      caption: "flex justify-center pt-1 relative items-center",
                      caption_label: "text-xs sm:text-sm font-medium",
                      table: "w-full border-collapse",
                      head_row: "flex w-full",
                      head_cell: "text-muted-foreground rounded-md flex-1 font-normal text-[0.65rem] sm:text-[0.8rem]",
                      row: "flex w-full mt-2",
                      cell: "flex-1 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-amber-100 dark:[&:has([aria-selected])]:bg-amber-900/40 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-8 w-full sm:h-9 p-0 font-normal aria-selected:opacity-100 text-xs sm:text-sm",
                      day_selected: "bg-amber-500 text-white hover:bg-amber-600 focus:bg-amber-600",
                    }}
                    modifiers={{
                      holiday: (date) => isHolidayCombined(date),
                      sunday: (date) => getDay(date) === 0,
                      hasExisting: (date) => !!getExistingHolidayForDate(date),
                    }}
                    modifiersClassNames={{
                      holiday: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium",
                      sunday: "text-amber-600 dark:text-amber-400",
                      hasExisting: "ring-2 ring-amber-400 ring-inset font-bold",
                    }}
                  />
                </div>
              </div>
            </div>

            {selectedHolidayDates.length > 0 && (
              <div className="max-h-[72px] overflow-y-auto overscroll-auto">
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedHolidayDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d) => {
                      const existing = getExistingHolidayForDate(d);
                      return (
                        <Tooltip key={d.toISOString()}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={existing ? "destructive" : "secondary"}
                              className="text-[9px] gap-1 px-1.5 py-0.5"
                            >
                              {format(d, "d MMM", { locale: idLocale })}
                              {existing && <AlertCircle className="w-2 h-2" />}
                              <button
                                type="button"
                                onClick={() => handleToggleHolidayDate(d)}
                                className="hover:text-destructive"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          </TooltipTrigger>
                          {existing && (
                            <TooltipContent className="text-[10px]">
                              <p className="font-semibold text-grade-warning">⚠ Sudah ada hari libur:</p>
                              <p>{existing.description}</p>
                              <p className="text-muted-foreground mt-0.5">Akan ditimpa dengan keterangan baru.</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      );
                    })}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Keterangan (berlaku untuk semua tanggal terpilih)
            </Label>
            <Input
              placeholder="Contoh: Hari Raya Idul Fitri"
              value={holidayDescription}
              onChange={(e) => setHolidayDescription(e.target.value)}
              className="h-9 text-sm rounded-xl"
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-xs font-medium text-foreground">
                Terapkan untuk Semua Kelas
              </Label>
              <p className="text-[10px] text-muted-foreground">
                Jika aktif, hari libur ini berlaku untuk seluruh kelas yang Anda kelola.
              </p>
            </div>
            <Switch
              checked={isHolidayGlobal}
              onCheckedChange={setIsHolidayGlobal}
            />
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedHolidayDates([]);
              setHolidayDescription("");
              onOpenChange(false);
            }}
            size="sm"
            className="text-xs rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleAddHoliday}
            disabled={selectedHolidayDates.length === 0}
            size="sm"
            className="text-xs rounded-xl"
          >
            <CalendarOff className="w-3.5 h-3.5 mr-1.5" />
            Tambah{selectedHolidayDates.length > 0 ? ` (${selectedHolidayDates.length})` : ""} Libur
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

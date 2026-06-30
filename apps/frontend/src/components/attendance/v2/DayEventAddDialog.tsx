import React from "react";
import { format, isSameDay } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Bookmark, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DayEvent } from "@/hooks/useAttendanceV2";

interface DayEventAddDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDayEventDates: Date[];
  setSelectedDayEventDates: React.Dispatch<React.SetStateAction<Date[]>>;
  dayEventLabel: string;
  setDayEventLabel: (label: string) => void;
  dayEventDesc: string;
  setDayEventDesc: (desc: string) => void;
  getDayEvent: (date: Date) => DayEvent | undefined;
  getExistingEventForDate: (date: Date) => DayEvent | undefined;
  isHolidayCombined: (date: Date) => boolean;
  handleAddDayEvent: () => Promise<void>;
}

export const DayEventAddDialog: React.FC<DayEventAddDialogProps> = ({
  open,
  onOpenChange,
  selectedDayEventDates,
  setSelectedDayEventDates,
  dayEventLabel,
  setDayEventLabel,
  dayEventDesc,
  setDayEventDesc,
  getDayEvent,
  getExistingEventForDate,
  isHolidayCombined,
  handleAddDayEvent,
}) => {
  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        onOpenChange(isOpen);
        if (!isOpen) {
          setSelectedDayEventDates([]);
          setDayEventLabel("");
          setDayEventDesc("");
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
            <Bookmark className="w-4 h-4 text-primary flex-shrink-0" />
            Tambah Kegiatan Khusus
          </DialogTitle>
          <DialogDescription className="text-xs">
            Pilih satu atau beberapa tanggal sekaligus untuk menandai kegiatan khusus
            (ujian, studi wisata, dll).
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-auto px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Pilih Tanggal (bisa lebih dari satu)
            </Label>
            <div className="border border-primary/30 dark:border-primary/40 rounded-xl overflow-hidden bg-primary/5 dark:bg-primary/10">
              <div className="px-3 py-1.5 bg-primary/10 dark:bg-primary/20 border-b border-primary/20 dark:border-primary/30">
                <p className="text-[9px] font-semibold text-primary uppercase tracking-wide flex items-center gap-1">
                  <Bookmark className="w-3 h-3" /> Kalender Kegiatan
                </p>
              </div>
              <div className="w-full overflow-x-auto">
                <div className="min-w-[280px] max-w-full mx-auto">
                  <Calendar
                    mode="multiple"
                    selected={selectedDayEventDates}
                    onSelect={(dates) => setSelectedDayEventDates(dates || [])}
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
                      cell: "flex-1 text-center text-sm p-0 relative [&:has([aria-selected])]:bg-primary/15 first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                      day: "h-8 w-full sm:h-9 p-0 font-normal aria-selected:opacity-100 text-xs sm:text-sm",
                      day_selected: "bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary/90",
                    }}
                    modifiers={{
                      dayEvent: (date) => !!getDayEvent(date),
                      hasExisting: (date) => !!getExistingEventForDate(date),
                      holiday: (date) => isHolidayCombined(date),
                    }}
                    modifiersClassNames={{
                      dayEvent: "ring-2 ring-primary/50 ring-inset font-bold",
                      hasExisting: "ring-2 ring-primary/50 ring-inset",
                      holiday: "bg-amber-100/50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 line-through opacity-60",
                    }}
                  />
                </div>
              </div>
            </div>

            {selectedDayEventDates.length > 0 && (
              <div className="max-h-[72px] overflow-y-auto overscroll-auto">
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {selectedDayEventDates
                    .sort((a, b) => a.getTime() - b.getTime())
                    .map((d) => {
                      const existing = getExistingEventForDate(d);
                      return (
                        <Tooltip key={d.toISOString()}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant={existing ? "default" : "secondary"}
                              className="text-[9px] gap-1 px-1.5 py-0.5"
                            >
                              {format(d, "d MMM", { locale: idLocale })}
                              {existing && <Info className="w-2 h-2" />}
                              <button
                                type="button"
                                onClick={() => setSelectedDayEventDates((prev) => prev.filter((pd) => !isSameDay(pd, d)))}
                                className="hover:text-destructive"
                              >
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </Badge>
                          </TooltipTrigger>
                          {existing && (
                            <TooltipContent className="text-[10px]">
                              <p className="font-semibold text-primary">ℹ Sudah ada kegiatan:</p>
                              <p>{existing.label}{existing.description ? ` — ${existing.description}` : ""}</p>
                              <p className="text-muted-foreground mt-0.5">Akan ditimpa dengan kegiatan baru.</p>
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
              Label Kegiatan <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="Contoh: UTS, Study Tour, Class Meeting"
              value={dayEventLabel}
              onChange={(e) => setDayEventLabel(e.target.value)}
              className="h-9 text-sm rounded-xl"
              maxLength={50}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-foreground">
              Deskripsi (opsional)
            </Label>
            <Input
              placeholder="Keterangan tambahan..."
              value={dayEventDesc}
              onChange={(e) => setDayEventDesc(e.target.value)}
              className="h-9 text-sm rounded-xl"
              maxLength={200}
            />
          </div>
        </div>

        {/* Footer — fixed */}
        <div className="px-4 pb-4 pt-3 border-t border-border flex-shrink-0 flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSelectedDayEventDates([]);
              setDayEventLabel("");
              setDayEventDesc("");
              onOpenChange(false);
            }}
            size="sm"
            className="text-xs rounded-xl"
          >
            Batal
          </Button>
          <Button
            type="button"
            onClick={handleAddDayEvent}
            disabled={selectedDayEventDates.length === 0 || !dayEventLabel.trim()}
            size="sm"
            className="text-xs rounded-xl"
          >
            <Bookmark className="w-3.5 h-3.5 mr-1.5" />
            Tambah{selectedDayEventDates.length > 0 ? ` (${selectedDayEventDates.length})` : ""} Kegiatan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

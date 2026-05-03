import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Globe, RefreshCw, Loader2, Check, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NationalHoliday } from "@/hooks/useIndonesianHolidays";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface NationalHolidaySyncProps {
  nationalHolidays: NationalHoliday[];
  isLoading: boolean;
  lastSynced: Date | null;
  error: string | null;
  onRefresh: () => void;
  monthNationalHolidays: NationalHoliday[];
}

export function NationalHolidaySync({
  nationalHolidays,
  isLoading,
  lastSynced,
  error,
  onRefresh,
  monthNationalHolidays,
}: NationalHolidaySyncProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/10 p-2.5 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-3.5 h-3.5 text-primary flex-shrink-0" />
          <span className="text-[10px] sm:text-xs font-semibold text-foreground truncate">
            Kalender Nasional Indonesia
          </span>
          {nationalHolidays.length > 0 && (
            <Badge variant="secondary" className="text-[8px] px-1.5 py-0 flex-shrink-0">
              {nationalHolidays.length} libur
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {error ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <AlertTriangle className="w-3.5 h-3.5 text-grade-warning" />
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">{error}</TooltipContent>
            </Tooltip>
          ) : lastSynced ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Check className="w-3.5 h-3.5 text-grade-pass" />
              </TooltipTrigger>
              <TooltipContent className="text-[10px]">
                Tersinkron • {format(lastSynced, "HH:mm")}
              </TooltipContent>
            </Tooltip>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 rounded-lg"
            onClick={onRefresh}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>

      {monthNationalHolidays.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {monthNationalHolidays.map((h) => (
            <Popover key={h.date}>
              <PopoverTrigger asChild>
                <button className="focus:outline-none">
                  <Badge
                    variant="outline"
                    className="text-[8px] px-1.5 py-0.5 border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors touch-manipulation min-h-[24px]"
                  >
                    🇮🇩 {format(new Date(h.date), "d MMM", { locale: idLocale })}
                  </Badge>
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" className="max-w-[240px] text-xs p-3">
                <p className="font-semibold text-red-600 dark:text-red-400">{h.name}</p>
                <p className="text-muted-foreground mt-1">
                  {format(new Date(h.date), "EEEE, d MMMM yyyy", { locale: idLocale })}
                </p>
                <p className="text-[9px] text-primary mt-1.5 font-medium">🇮🇩 Hari libur nasional Indonesia</p>
              </PopoverContent>
            </Popover>
          ))}
        </div>
      )}

      {monthNationalHolidays.length === 0 && !isLoading && nationalHolidays.length > 0 && (
        <p className="text-[9px] text-muted-foreground">Tidak ada libur nasional bulan ini</p>
      )}
    </div>
  );
}

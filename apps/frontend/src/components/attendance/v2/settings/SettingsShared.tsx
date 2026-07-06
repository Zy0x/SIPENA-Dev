import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, addMonths, addYears } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Info,
  Lock,
  LockOpen,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────

export type SettingsSection = "calendar" | "effective" | "recap" | "audit" | "delegation" | "backup";

export const SECTIONS: SettingsSection[] = ["calendar", "effective", "recap", "audit", "delegation", "backup"];

export const statusLabels: Record<"H" | "S" | "I" | "A" | "D", string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alfa",
  D: "Dispen",
};

// ── Utilities ────────────────────────────────────────────────────────

export const formatDateOnly = (date: Date | string) =>
  format(new Date(date), "d MMM yyyy", { locale: idLocale });

export const delayForTour = () =>
  new Promise((resolve) => window.setTimeout(resolve, 140));

// ── CompactMetric ────────────────────────────────────────────────────

export function CompactMetric({
  label,
  value,
  tone = "default",
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "blue";
  icon?: React.ElementType;
}) {
  const toneClass = {
    default: "bg-muted/30 text-foreground border border-muted/50",
    green: "bg-green-50/80 text-green-700 border border-green-200/60 dark:bg-green-950/20 dark:text-green-300 dark:border-green-900/30",
    amber: "bg-amber-50/80 text-amber-700 border border-amber-200/60 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-900/30",
    red: "bg-red-50/80 text-red-700 border border-red-200/60 dark:bg-red-950/20 dark:text-red-300 dark:border-red-900/30",
    blue: "bg-blue-50/80 text-blue-700 border border-blue-200/60 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-900/30",
  }[tone];

  return (
    <div className={cn("flex min-w-0 flex-col items-center justify-center rounded-2xl px-3.5 py-3 text-center transition-all", toneClass)}>
      <p className="line-clamp-2 text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</p>
      <div className="mt-1 flex items-center justify-center gap-1.5">
        {Icon && <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden="true" />}
        <div className="break-words text-sm font-extrabold leading-tight">{value}</div>
      </div>
    </div>
  );
}

// ── InlinePopoverContent ─────────────────────────────────────────────

export const InlinePopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Content
    ref={ref}
    align={align}
    sideOffset={sideOffset}
    className={cn(
      "sipena-scroll-chain-page z-[10200] w-72 rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-xl outline-none scrollbar-thin data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
      className,
    )}
    {...props}
  />
));
InlinePopoverContent.displayName = "InlinePopoverContent";

// ── SectionIntro ─────────────────────────────────────────────────────

export function SectionIntro({
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
    <div className="rounded-2xl border border-l-4 border-l-primary bg-gradient-to-br from-primary/5 via-primary/[0.01] to-transparent p-4 sm:p-5">
      <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="h-4.5 w-4.5 text-primary" aria-hidden="true" />
            </span>
            <h3 className="text-sm font-extrabold text-foreground">{title}</h3>
            {help}
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed break-words">{description}</p>
        </div>
        {action ? <div className="shrink-0 sm:self-start">{action}</div> : null}
      </div>
    </div>
  );
}

// ── InfoHelp ─────────────────────────────────────────────────────────

export function InfoHelp({
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
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Informasi ${label}`}
          data-tour={dataTour}
          className={cn(
            "inline-flex h-6 w-6 shrink-0 touch-manipulation items-center justify-center rounded-full border border-primary/20 bg-primary/5 text-primary",
            "transition-all hover:bg-primary/10 active:bg-primary/15 data-[state=open]:bg-primary/10",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1"
          )}
        >
          <Info className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(
          "z-[10170] w-[min(21rem,calc(100vw-2rem))] rounded-2xl border-primary/15 p-4 shadow-2xl bg-background",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
          "data-[state=open]:duration-200 data-[state=closed]:duration-150"
        )}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-foreground">{label}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
          </div>
          {example ? (
            <div className="rounded-xl border bg-muted/40 p-3">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Contoh Kasus</p>
              <p className="mt-1 text-xs leading-relaxed text-foreground">{example}</p>
            </div>
          ) : null}
          {impact ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              <p className="text-[10px] font-bold uppercase tracking-wider">Dampak Perubahan</p>
              <p className="mt-1 text-xs leading-relaxed">{impact}</p>
            </div>
          ) : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ── EmptyState ───────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, text, compact = false }: { icon: React.ElementType; text: string; compact?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 p-6 text-center border-2 border-dashed rounded-2xl bg-muted/10 border-muted/50", compact ? "min-h-28" : "min-h-40")}>
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-dashed border-muted-foreground/20 bg-muted/30">
        <Icon className="h-5 w-5 text-muted-foreground/50" aria-hidden="true" />
      </div>
      <p className="max-w-[18rem] text-xs leading-relaxed text-muted-foreground font-semibold">{text}</p>
    </div>
  );
}

// ── CollapsibleCard ──────────────────────────────────────────────────

export const CollapsibleCard: React.FC<{
  title: string;
  subtitle?: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  dataTour?: string;
}> = ({ title, subtitle, icon: Icon, children, defaultExpanded = false, dataTour }) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  return (
    <div className="rounded-2xl border bg-card shadow-sm overflow-hidden" data-tour={dataTour}>
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-muted/10 focus-visible:outline-none focus-visible:bg-muted/20 min-h-[48px]"
      >
        <div className="flex items-center gap-3 min-w-0">
          {Icon && (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-foreground leading-snug">{title}</h4>
            {subtitle && <p className="text-xs text-muted-foreground leading-normal mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <motion.span
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.15 }}
          className="text-muted-foreground shrink-0 ml-2"
        >
          <ChevronDown className="h-4.5 w-4.5" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden border-t"
          >
            <div className="p-4 bg-muted/5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ── MobileMetricsExpander ────────────────────────────────────────────

export const MobileMetricsExpander: React.FC<{
  selectedClass: any;
  currentMonth: Date;
  setCurrentMonth?: (month: Date) => void;
  effectiveDays: number;
  monthDays: Date[];
  isLocked: boolean;
  monthOptions: Date[];
}> = ({
  selectedClass,
  currentMonth,
  setCurrentMonth,
  effectiveDays,
  monthDays,
  isLocked,
  monthOptions,
}) => {
  return (
    <div className="mt-3 space-y-2">
      {/* Month Selector (Always visible on mobile) */}
      <div className="flex items-center justify-between gap-1 rounded-2xl border bg-muted/40 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-xl text-foreground active:bg-muted"
          onClick={() => {
            if (setCurrentMonth) setCurrentMonth(addMonths(currentMonth, -1));
          }}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-extrabold active:bg-muted text-foreground transition-colors cursor-pointer select-none min-h-[40px]"
            >
              <span>Periode: {format(currentMonth, "MMMM yyyy", { locale: idLocale })}</span>
              <ChevronDown className="h-4 w-4 opacity-75 shrink-0 text-primary" />
            </button>
          </PopoverTrigger>
          <InlinePopoverContent className="w-52 p-1.5 rounded-2xl z-[10500]" align="center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1 mb-1">
              Pilih Bulan
            </div>
            <div className="grid grid-cols-2 gap-1 max-h-56 overflow-y-auto">
              {monthOptions.map((month) => {
                const isSelected = month.getMonth() === currentMonth.getMonth() && month.getFullYear() === currentMonth.getFullYear();
                return (
                  <button
                    key={month.toISOString()}
                    type="button"
                    onClick={() => {
                      if (setCurrentMonth) setCurrentMonth(month);
                    }}
                    className={cn(
                      "px-1.5 py-1.5 rounded-lg text-[11px] text-left font-semibold transition-colors truncate active:scale-95 touch-manipulation min-h-[32px]",
                      isSelected
                        ? "bg-primary text-primary-foreground font-bold shadow-sm"
                        : "active:bg-muted text-foreground"
                    )}
                  >
                    {format(month, "MMMM", { locale: idLocale })}
                  </button>
                );
              })}
            </div>
            <div className="border-t mt-1.5 pt-1.5 flex items-center justify-between gap-1">
              <Button
                type="button"
                variant="ghost"
                className="h-8 flex-1 px-1 rounded-xl text-[10px] font-bold active:bg-muted"
                onClick={() => {
                  if (setCurrentMonth) setCurrentMonth(addYears(currentMonth, -1));
                }}
              >
                Tahun Lalu
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 flex-1 px-1 rounded-xl text-[10px] font-bold active:bg-muted"
                onClick={() => {
                  if (setCurrentMonth) setCurrentMonth(addYears(currentMonth, 1));
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
          className="h-10 w-10 shrink-0 rounded-xl text-foreground active:bg-muted"
          onClick={() => {
            if (setCurrentMonth) setCurrentMonth(addMonths(currentMonth, 1));
          }}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Class & Effective metrics (Always visible, side-by-side) */}
      <div className="grid grid-cols-2 gap-2">
        <CompactMetric label="Kelas" value={selectedClass?.name || "Belum dipilih"} />
        <CompactMetric label="Hari efektif" value={`${effectiveDays}/${monthDays.length} hari`} tone="green" />
      </div>
    </div>
  );
};

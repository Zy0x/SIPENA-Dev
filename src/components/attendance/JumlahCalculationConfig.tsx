import { useState, useEffect } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export type JumlahMode = "default" | "custom";

export interface JumlahConfig {
  mode: JumlahMode;
  selectedStatuses: string[];
}

const STORAGE_KEY = "sipena_jumlah_config";

const ALL_STATUSES = ["H", "S", "I", "A", "D"];
const DEFAULT_STATUSES = ["S", "I", "A", "D"]; // Default: non-hadir

const STATUS_LABELS: Record<string, string> = {
  H: "Hadir",
  S: "Sakit",
  I: "Izin",
  A: "Alpha",
  D: "Dispensasi",
};

const STATUS_COLORS: Record<string, string> = {
  H: "bg-grade-pass/20 text-grade-pass border-grade-pass/30",
  S: "bg-grade-warning/20 text-grade-warning border-grade-warning/30",
  I: "bg-primary/20 text-primary border-primary/30",
  A: "bg-grade-fail/20 text-grade-fail border-grade-fail/30",
  D: "bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-500/30",
};

export function getJumlahConfig(): JumlahConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { mode: "default", selectedStatuses: DEFAULT_STATUSES };
}

export function saveJumlahConfig(config: JumlahConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function calculateJumlah(stats: Record<string, number>, config: JumlahConfig): number {
  const statuses = config.mode === "default" ? DEFAULT_STATUSES : config.selectedStatuses;
  return statuses.reduce((sum, s) => sum + (stats[s] || 0), 0);
}

interface JumlahCalculationConfigProps {
  config: JumlahConfig;
  onConfigChange: (config: JumlahConfig) => void;
}

export function JumlahCalculationConfig({ config, onConfigChange }: JumlahCalculationConfigProps) {
  const [open, setOpen] = useState(false);

  const handleStatusToggle = (status: string, checked: boolean) => {
    const newStatuses = checked
      ? [...config.selectedStatuses, status]
      : config.selectedStatuses.filter((s) => s !== status);
    
    const newConfig: JumlahConfig = {
      mode: "custom",
      selectedStatuses: newStatuses,
    };
    onConfigChange(newConfig);
    saveJumlahConfig(newConfig);
  };

  const handleReset = () => {
    const defaultConfig: JumlahConfig = { mode: "default", selectedStatuses: DEFAULT_STATUSES };
    onConfigChange(defaultConfig);
    saveJumlahConfig(defaultConfig);
  };

  const isDefault = config.mode === "default" || 
    (config.selectedStatuses.length === DEFAULT_STATUSES.length && 
     DEFAULT_STATUSES.every(s => config.selectedStatuses.includes(s)));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isDefault ? "outline" : "default"}
          size="sm"
          className={cn(
            "h-8 px-2.5 text-xs gap-1 rounded-xl",
            !isDefault && "bg-primary text-primary-foreground"
          )}
        >
          <Settings2 className="w-3 h-3" />
          <span className="hidden sm:inline">Jumlah</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="end">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-foreground">Logika Kolom Jumlah</p>
              <p className="text-[10px] text-muted-foreground">Pilih status yang dihitung</p>
            </div>
            {!isDefault && (
              <Button variant="ghost" size="sm" className="h-6 px-1.5 text-[9px] gap-1" onClick={handleReset}>
                <RotateCcw className="w-3 h-3" />
                Reset
              </Button>
            )}
          </div>

          <div className="space-y-2">
            {ALL_STATUSES.map((status) => {
              const isChecked = config.mode === "default"
                ? DEFAULT_STATUSES.includes(status)
                : config.selectedStatuses.includes(status);
              return (
                <label key={status} className="flex items-center gap-2.5 cursor-pointer group">
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={(checked) => handleStatusToggle(status, !!checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                  <Badge
                    variant="outline"
                    className={cn("text-[10px] px-2 py-0.5 border", STATUS_COLORS[status])}
                  >
                    {status}
                  </Badge>
                  <span className="text-xs text-foreground group-hover:text-primary transition-colors">
                    {STATUS_LABELS[status]}
                  </span>
                </label>
              );
            })}
          </div>

          <div className="pt-2 border-t border-border">
            <p className="text-[10px] text-muted-foreground">
              {isDefault ? (
                <>Default: <strong>S + I + A + D</strong> (ketidakhadiran)</>
              ) : (
                <>Kustom: <strong>{config.selectedStatuses.join(" + ") || "Tidak ada"}</strong></>
              )}
            </p>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

import { useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, Info, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RecapProfile } from "@/hooks/useAttendanceV2";
interface PercentageRowProps {
  allStatuses: string[];
  filteredStudents: { id: string }[];
  monthDays: Date[];
  effectiveDays: number;
  getAttendance: (studentId: string, date: Date) => string | null;
  isHoliday: (date: Date) => boolean;
  statusConfig: Record<string, { color: string }>;
  recapProfile: RecapProfile | null;
}

export function PercentageRow({
  allStatuses,
  filteredStudents,
  monthDays,
  effectiveDays,
  getAttendance,
  isHoliday,
  statusConfig,
  recapProfile,
}: PercentageRowProps) {
  const { percentages, isComplete, unfilledDays, totalPercentage, denominator, totalTarget } = useMemo(() => {
    const totals: Record<string, number> = { H: 0, S: 0, I: 0, A: 0, D: 0 };
    let totalUnfilled = 0;
    const studentCount = filteredStudents.length;

    filteredStudents.forEach((student) => {
      monthDays.forEach((day) => {
        if (!isHoliday(day)) {
          const st = getAttendance(student.id, day);
          if (st && totals.hasOwnProperty(st)) {
            totals[st]++;
          } else if (!st) {
            totalUnfilled++;
          }
        }
      });
    });

    const pcts: Record<string, number> = {};
    const totalTarget = studentCount * effectiveDays;
    const denominator = recapProfile?.denominator_policy === "filled_days" 
      ? Math.max(0, totalTarget - totalUnfilled) 
      : totalTarget;

    allStatuses.forEach((s) => {
      if (denominator > 0) {
        pcts[s] = (totals[s] * 100) / denominator;
      } else {
        pcts[s] = 0;
      }
    });

    const presentStatuses = recapProfile?.present_statuses || ["H"];
    const totalPresentCount = presentStatuses.reduce((sum, s) => sum + (totals[s] || 0), 0);
    const totalPct = denominator > 0 ? (totalPresentCount * 100) / denominator : 0;

    return {
      percentages: pcts,
      isComplete: totalUnfilled === 0,
      unfilledDays: totalUnfilled,
      totalPercentage: totalPct,
      denominator,
      totalTarget,
    };
  }, [allStatuses, filteredStudents, monthDays, effectiveDays, getAttendance, isHoliday, recapProfile]);

  return (
    <tr className="border-t border-dashed border-border bg-card">
      <td className="sticky left-0 z-10 bg-card px-2 py-1.5 text-[10px] sm:text-xs font-bold text-primary border-r-2 border-b border-r-border/80 border-b-border/30 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.15)]" colSpan={1}>
        <div className="flex items-center gap-1 w-[120px] sm:w-[160px]">
          {/* % icon - shows percentage formula */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="focus:outline-none touch-manipulation min-w-[20px] min-h-[20px] flex items-center justify-center rounded hover:bg-primary/10 transition-colors">
                <Percent className="w-3.5 h-3.5 text-primary cursor-pointer" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="w-[300px] text-xs p-0 overflow-hidden shadow-xl border-border/50">
              <div className="bg-gradient-to-r from-primary/10 to-transparent px-3 py-2.5 border-b border-border flex items-center gap-2">
                <div className="bg-primary p-1 rounded-md shadow-sm">
                  <Percent className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
                <span className="font-bold text-foreground">Rumus Persentase</span>
              </div>
              
              <div className="p-3 space-y-3">
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Formula Dasar</p>
                  <div className="bg-muted/40 p-2 rounded-md border border-border/50 text-[11px] font-medium text-foreground flex items-center justify-center text-center leading-relaxed">
                    (Total Status / Pembagi) × 100
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Kalkulasi Saat Ini</p>
                  <div className="bg-muted/40 p-2 rounded-md border border-border/50 text-[11px] font-mono text-foreground flex flex-col items-center justify-center text-center">
                    <span>(Total Status × 100) / {denominator}</span>
                    <span className="text-[9px] text-muted-foreground mt-1">
                      Pembagi: {recapProfile?.denominator_policy === "filled_days" ? `Hari Terisi (${denominator})` : `Hari Efektif (${totalTarget})`}
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-border space-y-2">
                   <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Hasil per Status</p>
                   <div className="grid grid-cols-2 gap-1.5">
                     {allStatuses.map(s => (
                       <div key={s} className="flex items-center justify-between bg-muted/20 border border-border/50 rounded-md px-2 py-1.5">
                         <span className={cn("font-extrabold text-[11px]", statusConfig[s]?.color)}>{s}</span>
                         <span className="font-mono text-[11px] font-medium text-foreground">{percentages[s]?.toFixed(1) || "0"}%</span>
                       </div>
                     ))}
                   </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* i icon - shows data completeness */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="focus:outline-none touch-manipulation min-w-[20px] min-h-[20px] flex items-center justify-center rounded hover:bg-primary/10 transition-colors">
                {!isComplete ? (
                  <AlertCircle className="w-3.5 h-3.5 text-destructive cursor-pointer animate-pulse" />
                ) : (
                  <Info className="w-3.5 h-3.5 text-primary cursor-pointer" />
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="max-w-[260px] text-xs p-3">
              {!isComplete ? (
                <>
                  <p className="font-semibold text-destructive flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Data masih belum final
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Masih terdapat <strong className="text-destructive">{unfilledDays}</strong> data kehadiran di kalender yang kosong (belum diisi).
                  </p>
                  <p className="text-muted-foreground mt-1 text-[10px]">
                    Isi seluruh data presensi pada hari efektif agar persentase akurat.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-primary flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5" /> Kelengkapan Data
                  </p>
                  <p className="text-primary font-medium mt-1.5">✅ Semua data sudah lengkap</p>
                  <p className="text-muted-foreground mt-1">
                    Seluruh hari efektif ({effectiveDays} hari) untuk {filteredStudents.length} siswa telah terisi.
                  </p>
                </>
              )}
            </PopoverContent>
          </Popover>
        </div>
      </td>
      {/* Empty cells for day columns */}
      {monthDays.map((day) => (
        <td key={day.toISOString()} className="p-0.5 border-b border-b-border/10" />
      ))}
      {/* Percentage per status */}
      {allStatuses.map((s) => (
        <td
          key={s}
          className={cn(
            "px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-bold border-l border-b border-l-border/30 border-b-border/30",
            statusConfig[s]?.color
          )}
        >
          {percentages[s] > 0 ? `${percentages[s].toFixed(1)}%` : "0%"}
        </td>
      ))}
      {/* Total percentage */}
      <td className="px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-extrabold border-l-2 border-b border-l-border border-b-border/30 text-grade-pass bg-grade-pass/10 relative group">
        {totalPercentage > 0 ? `${totalPercentage.toFixed(1)}%` : "0%"}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-grade-pass/90 text-[7px] text-grade-pass-foreground rounded-sm transition-opacity">
          Hadir
        </div>
      </td>
    </tr>
  );
}

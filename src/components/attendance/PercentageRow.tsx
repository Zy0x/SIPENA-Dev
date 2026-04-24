import { useMemo } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { AlertCircle, Info, Percent } from "lucide-react";
import { cn } from "@/lib/utils";
import { calculateJumlah, type JumlahConfig } from "./JumlahCalculationConfig";

interface PercentageRowProps {
  allStatuses: string[];
  filteredStudents: { id: string }[];
  monthDays: Date[];
  effectiveDays: number;
  getAttendance: (studentId: string, date: Date) => string | null;
  isHoliday: (date: Date) => boolean;
  statusConfig: Record<string, { color: string }>;
  jumlahConfig: JumlahConfig;
}

export function PercentageRow({
  allStatuses,
  filteredStudents,
  monthDays,
  effectiveDays,
  getAttendance,
  isHoliday,
  statusConfig,
  jumlahConfig,
}: PercentageRowProps) {
  const { percentages, isComplete, unfilledDays, totalPercentage } = useMemo(() => {
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
    allStatuses.forEach((s) => {
      if (studentCount > 0 && effectiveDays > 0) {
        pcts[s] = (totals[s] * 100) / (studentCount * effectiveDays);
      } else {
        pcts[s] = 0;
      }
    });

    const totalStatusCount = calculateJumlah(totals, jumlahConfig);
    const totalPct = (studentCount > 0 && effectiveDays > 0)
      ? (totalStatusCount * 100) / (studentCount * effectiveDays)
      : 0;

    return {
      percentages: pcts,
      isComplete: totalUnfilled === 0,
      unfilledDays: totalUnfilled,
      totalPercentage: totalPct,
    };
  }, [allStatuses, filteredStudents, monthDays, effectiveDays, getAttendance, isHoliday, jumlahConfig]);

  return (
    <tr className="border-t border-dashed border-border bg-primary/10">
      <td className="sticky left-0 z-10 bg-primary/5 px-2 py-1.5 text-[10px] sm:text-xs font-bold text-primary border-r border-border" colSpan={1}>
        <div className="flex items-center gap-1">
          {/* % icon - shows percentage formula */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="focus:outline-none touch-manipulation min-w-[20px] min-h-[20px] flex items-center justify-center rounded hover:bg-primary/10 transition-colors">
                <Percent className="w-3.5 h-3.5 text-primary cursor-pointer" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="right" className="max-w-[280px] text-xs p-3">
              <p className="font-semibold text-primary flex items-center gap-1.5">
                <Percent className="w-3.5 h-3.5" /> Rumus Persentase
              </p>
              <p className="text-muted-foreground mt-1.5 leading-relaxed">
                Persentase = (Total Status / Jumlah Siswa) × (100 / Hari Efektif)
              </p>
              <p className="text-muted-foreground mt-1">
                = (Total Status × 100) / ({filteredStudents.length} siswa × {effectiveDays} hari)
              </p>
              <div className="mt-2 pt-2 border-t border-border space-y-1">
                {allStatuses.map(s => (
                  <p key={s} className="text-muted-foreground">
                    <span className={cn("font-bold", statusConfig[s]?.color)}>{s}</span>: {percentages[s]?.toFixed(1) || "0"}%
                  </p>
                ))}
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
        <td key={day.toISOString()} className="p-0.5" />
      ))}
      {/* Percentage per status */}
      {allStatuses.map((s) => (
        <td
          key={s}
          className={cn(
            "px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-bold border-l border-border/30",
            statusConfig[s]?.color
          )}
        >
          {percentages[s] > 0 ? `${percentages[s].toFixed(1)}%` : "0%"}
        </td>
      ))}
      {/* Total percentage */}
      <td className="px-1 py-1.5 text-center text-[8px] sm:text-[9px] font-extrabold border-l-2 border-border text-foreground bg-muted/30">
        {totalPercentage > 0 ? `${totalPercentage.toFixed(1)}%` : "0%"}
      </td>
    </tr>
  );
}

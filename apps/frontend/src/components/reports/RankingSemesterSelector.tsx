import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Calendar, ChevronDown, Check, Layers, TrendingUp } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export type RankingSemesterValue = "1" | "2" | "all";

interface RankingSemesterSelectorProps {
  value: RankingSemesterValue;
  onChange: (value: RankingSemesterValue) => void;
  className?: string;
  showIndicator?: boolean;
}

export function RankingSemesterSelector({
  value,
  onChange,
  className,
  showIndicator = true,
}: RankingSemesterSelectorProps) {
  const { activeYear, activeSemester, semestersForActiveYear } = useAcademicYear();

  const getDisplayText = () => {
    switch (value) {
      case "1":
        return "SMT 1";
      case "2":
        return "SMT 2";
      case "all":
        return "Semua";
    }
  };
  
  const getFullDisplayText = () => {
    switch (value) {
      case "1":
        return "Semester 1";
      case "2":
        return "Semester 2";
      case "all":
        return "Semua Semester";
    }
  };

  const getDisplayIcon = () => {
    switch (value) {
      case "all":
        return <Layers className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />;
      default:
        return <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />;
    }
  };

  const options = [
    { value: "1" as const, label: "Semester 1", description: "Ranking berdasarkan data semester ganjil" },
    { value: "2" as const, label: "Semester 2", description: "Ranking berdasarkan data semester genap" },
    { value: "all" as const, label: "Semua Semester", description: "Ranking tahunan (rata-rata kedua semester)" },
  ];

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 sm:gap-1.5 font-medium border-primary/20 hover:border-primary/40 h-7 sm:h-8 px-1.5 sm:px-2.5 text-[10px] sm:text-xs min-w-0"
          >
            {getDisplayIcon()}
            <span className="truncate">{getDisplayText()}</span>
            <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4 opacity-50 shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5" />
            Filter Semester Ranking
          </div>
          <DropdownMenuSeparator />
          
          {options.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => onChange(option.value)}
              className="flex items-center justify-between cursor-pointer py-3"
            >
              <div className="flex items-center gap-3">
                {option.value === "all" ? (
                  <Layers className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                )}
                <div>
                  <p className={cn(
                    "text-sm font-medium",
                    value === option.value && "text-primary"
                  )}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
              {value === option.value && (
                <Check className="h-4 w-4 text-primary shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Active Period Indicator - Responsive */}
      {showIndicator && activeYear && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[10px] sm:text-xs text-muted-foreground flex-wrap"
        >
          <span className="shrink-0">Data:</span>
          <Badge variant="secondary" className="text-[10px] sm:text-xs font-normal truncate max-w-[200px]">
            {activeYear.name} • {getFullDisplayText()}
          </Badge>
        </motion.div>
      )}
    </div>
  );
}

/**
 * Hook untuk menggunakan semester filter di halaman ranking
 * Default mengikuti semester aktif global, tapi bisa di-override user
 */
export function useRankingSemesterFilter() {
  const { activeSemesterNumber, semestersForActiveYear } = useAcademicYear();
  const [semesterFilter, setSemesterFilter] = useState<RankingSemesterValue>(
    activeSemesterNumber?.toString() as RankingSemesterValue || "all"
  );

  // Sync dengan semester aktif saat pertama kali mount
  useEffect(() => {
    if (activeSemesterNumber) {
      setSemesterFilter(activeSemesterNumber.toString() as RankingSemesterValue);
    }
  }, [activeSemesterNumber]);

  /**
   * Get semester IDs for query based on filter
   */
  const getSemesterFilter = (semesters: { id: string; number: number }[]) => {
    if (semesterFilter === "all") {
      return semesters.map(s => s.id);
    }
    const targetNumber = parseInt(semesterFilter);
    const targetSemester = semesters.find(s => s.number === targetNumber);
    return targetSemester ? [targetSemester.id] : [];
  };

  /**
   * Check if we're showing combined data
   */
  const isCombinedView = semesterFilter === "all";

  /**
   * Get semester number for filtering (null if combined view)
   */
  const filterSemesterNumber = semesterFilter === "all" ? null : parseInt(semesterFilter);

  return {
    semesterFilter,
    setSemesterFilter,
    getSemesterFilter,
    isCombinedView,
    filterSemesterNumber,
    semestersForActiveYear,
  };
}

export default RankingSemesterSelector;

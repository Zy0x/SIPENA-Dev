import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HeaderYearDisplayProps {
  className?: string;
  variant?: "mobile" | "desktop" | "tablet";
}

/**
 * Simple display component for header showing active year and semester
 * No dropdown, just text display - optimized for all screen sizes
 */
export function HeaderYearDisplay({ 
  className,
  variant = "mobile",
}: HeaderYearDisplayProps) {
  const { 
    activeYear, 
    activeSemester,
    isLoading,
  } = useAcademicYear();

  if (isLoading) {
    return (
      <div className={cn("flex items-center", className)}>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeYear) {
    if (variant === "mobile" || variant === "tablet") {
      return (
        <div className={cn("flex flex-col items-start leading-tight min-w-0", className)}>
          <span className="text-[10px] sm:text-xs font-semibold text-destructive truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
            Tahun Ajaran
          </span>
          <span className="text-[9px] sm:text-[10px] text-destructive/80 truncate max-w-[80px] sm:max-w-[100px]">
            Belum Dipilih
          </span>
        </div>
      );
    }

    return (
      <div className={cn("flex flex-col items-start leading-tight min-w-0", className)}>
        <span className="text-sm font-semibold text-destructive truncate max-w-[150px]">
          Tahun Ajaran
        </span>
        <span className="text-xs text-destructive/80 truncate max-w-[150px]">
          Belum Dipilih
        </span>
      </div>
    );
  }

  // Mobile/Tablet: Compact 2-line display
  if (variant === "mobile" || variant === "tablet") {
    return (
      <div className={cn("flex flex-col items-start leading-tight min-w-0", className)}>
        <span className="text-[10px] sm:text-xs font-semibold text-foreground truncate max-w-[80px] sm:max-w-[100px] md:max-w-[120px]">
          {activeYear.name}
        </span>
        {activeSemester && (
          <span className="text-[9px] sm:text-[10px] text-muted-foreground truncate max-w-[80px] sm:max-w-[100px]">
            {activeSemester.name}
          </span>
        )}
      </div>
    );
  }

  // Desktop/Tablet variant - 2-line display like mobile but larger
  return (
    <div className={cn("flex flex-col items-start leading-tight min-w-0", className)}>
      <span className="text-sm font-semibold text-foreground truncate max-w-[150px]">
        {activeYear.name}
      </span>
      {activeSemester && (
        <span className="text-xs text-muted-foreground truncate max-w-[150px]">
          {activeSemester.name}
        </span>
      )}
    </div>
  );
}

export default HeaderYearDisplay;

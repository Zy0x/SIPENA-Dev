import { useState } from "react";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Loader2, Plus, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { YearSwitchDialog } from "./YearSwitchDialog";

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
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);

  if (isLoading) {
    return (
      <div className={cn("flex items-center", className)}>
        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeYear) {
    return (
      <>
        <button 
          onClick={() => setShowSwitchDialog(true)}
          className={cn(
            "flex items-center gap-2 leading-tight min-w-0 transition-all duration-300",
            "px-2.5 py-1.5 rounded-lg border border-destructive/30 hover:border-destructive/60 bg-destructive/10 hover:bg-destructive/20",
            "active:scale-95 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
            className
          )}
          aria-label="Atur Tahun Ajaran"
        >
          <AlertCircle className="h-4 w-4 text-destructive animate-pulse group-hover:animate-none shrink-0" />
          {variant === "mobile" || variant === "tablet" ? (
            <div className="flex flex-col items-start min-w-0 text-left">
              <span className="text-[10px] sm:text-xs font-semibold text-destructive truncate max-w-[90px] sm:max-w-[120px]">
                Pilih Tahun
              </span>
              <span className="text-[9px] sm:text-[10px] text-destructive/80 truncate max-w-[90px] sm:max-w-[120px]">
                Ketuk di sini
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-start min-w-0 text-left">
              <span className="text-sm font-semibold text-destructive truncate max-w-[150px]">
                Pilih Tahun Ajaran
              </span>
              <span className="text-xs text-destructive/80 truncate max-w-[150px] flex items-center gap-1">
                <Plus className="h-3 w-3" /> Klik untuk mengatur
              </span>
            </div>
          )}
        </button>
        <YearSwitchDialog
          open={showSwitchDialog}
          onOpenChange={setShowSwitchDialog}
          targetYearId={null}
          onComplete={() => setShowSwitchDialog(false)}
        />
      </>
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

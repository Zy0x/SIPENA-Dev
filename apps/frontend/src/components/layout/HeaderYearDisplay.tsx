import { useState } from "react";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { Loader2, Plus, AlertCircle, Calendar } from "lucide-react";
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
            "flex items-center gap-2 leading-tight min-w-0 transition-all duration-300 text-left",
            "group focus-visible:outline-none rounded-lg p-1 -ml-1 hover:bg-muted/50",
            className
          )}
          aria-label="Atur Tahun Ajaran"
        >
          <div className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-100/50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 transition-transform group-hover:scale-105 group-active:scale-95">
             <Calendar className="h-3.5 w-3.5" />
          </div>
          
          {variant === "mobile" || variant === "tablet" ? (
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold text-foreground truncate max-w-[90px] sm:max-w-[120px] group-hover:text-primary transition-colors">
                Pilih Tahun
              </span>
              <span className="text-[9px] sm:text-[10px] text-amber-600/80 dark:text-amber-400/80 truncate max-w-[90px] sm:max-w-[120px] flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                Ketuk di sini
              </span>
            </div>
          ) : (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground truncate max-w-[150px] group-hover:text-primary transition-colors">
                Tahun Ajaran
              </span>
              <span className="text-xs text-amber-600/80 dark:text-amber-400/80 truncate max-w-[150px] flex items-center gap-1">
                <span className="relative flex h-1.5 w-1.5 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500"></span>
                </span>
                Belum diatur
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

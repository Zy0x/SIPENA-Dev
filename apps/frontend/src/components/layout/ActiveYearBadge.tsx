import { useState, useRef, useCallback } from "react";
import { Calendar, ChevronDown, Check, Plus, Loader2, ChevronRight } from "lucide-react";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { YearSwitchDialog } from "./YearSwitchDialog";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface ActiveYearBadgeProps {
  className?: string;
  variant?: "default" | "compact" | "minimal";
  showSemester?: boolean;
  showSemesterToggle?: boolean;
}

export function ActiveYearBadge({ 
  className, 
  variant = "default",
  showSemester = true,
  showSemesterToggle = false,
}: ActiveYearBadgeProps) {
  const { 
    activeYear, 
    activeSemester,
    academicYears, 
    isSwitching,
    isLoading,
    semestersForActiveYear,
  } = useAcademicYear();
  
  const [showSwitchDialog, setShowSwitchDialog] = useState(false);
  const [targetYearId, setTargetYearId] = useState<string | null>(null);
  
  const prefersReducedMotion = useReducedMotion();
  
  // Refs for GSAP animations
  const yearButtonRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // GSAP: Year button hover
  const handleButtonHover = useCallback((isEntering: boolean) => {
    if (!yearButtonRef.current || prefersReducedMotion) return;
    gsap.to(yearButtonRef.current, {
      scale: isEntering ? 1.02 : 1,
      duration: 0.15,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  const handleButtonPress = useCallback((isPressed: boolean) => {
    if (!yearButtonRef.current || prefersReducedMotion) return;
    gsap.to(yearButtonRef.current, {
      scale: isPressed ? 0.98 : 1,
      duration: 0.1,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  // Handle year selection
  const handleYearSelect = (yearId: string) => {
    if (yearId === activeYear?.id) return;
    setTargetYearId(yearId);
    setShowSwitchDialog(true);
  };

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50",
        className
      )}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Memuat...</span>
      </div>
    );
  }

  // No active year
  if (!activeYear) {
    return (
      <>
        <button
          onClick={() => setShowSwitchDialog(true)}
          className={cn(
            "sipena-year-btn group relative flex w-full items-center gap-2.5 rounded-xl border-2 border-primary/50 bg-primary/10 p-2 text-left transition-all duration-300 hover:border-primary hover:bg-primary/20 hover:shadow-md active:scale-[0.98]",
            "shadow-[0_0_15px_rgba(var(--primary),0.3)] animate-[pulse_2s_cubic-bezier(0.4,0,0.6,1)_infinite]", // Glow and slow pulse
            className
          )}
          data-tour="setup-year"
        >
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/20 text-primary transition-all duration-300 group-hover:scale-110 group-hover:bg-primary/30">
            {/* Ping indicator */}
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
            </span>
            <Calendar className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-bold leading-tight text-primary">Pilih Tahun Ajaran</span>
            <span className="text-[10px] font-medium leading-tight text-primary/70">Wajib diatur untuk memulai</span>
          </div>
          <div className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all duration-300 group-hover:translate-x-0.5 shadow-sm">
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <YearSwitchDialog
          open={showSwitchDialog}
          onOpenChange={setShowSwitchDialog}
          targetYearId={targetYearId}
          onComplete={() => setTargetYearId(null)}
        />
      </>
    );
  }

  // Compact variant for mobile
  if (variant === "compact") {
    return (
      <>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "gap-1 h-8 px-2 font-medium",
                isSwitching && "opacity-50 pointer-events-none",
                className
              )}
              disabled={isSwitching}
            >
              {isSwitching ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Calendar className="h-3.5 w-3.5" />
              )}
              <span className="text-xs truncate max-w-[80px]">
                {activeYear.name}
              </span>
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48" isEmpty={academicYears.length === 0} emptyLabel="Tidak ada pilihan Tahun Ajaran">
            {academicYears.map((year) => (
              <DropdownMenuItem
                key={year.id}
                onClick={() => handleYearSelect(year.id)}
                className="flex items-center justify-between"
              >
                <span className={cn(
                  year.id === activeYear.id && "font-semibold"
                )}>
                  {year.name}
                </span>
                {year.id === activeYear.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setShowSwitchDialog(true)}
              className="text-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Kelola Tahun Ajaran
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <YearSwitchDialog
          open={showSwitchDialog}
          onOpenChange={setShowSwitchDialog}
          targetYearId={targetYearId}
          onComplete={() => setTargetYearId(null)}
        />
      </>
    );
  }

  // Minimal variant for sidebar with semester toggle
  if (variant === "minimal") {
    return (
      <>
        <div className="space-y-3">
          {/* Year selector button */}
          <button
            ref={yearButtonRef}
            onClick={() => setShowSwitchDialog(true)}
            onPointerEnter={() => handleButtonHover(true)}
            onPointerLeave={() => handleButtonHover(false)}
            onPointerDown={() => handleButtonPress(true)}
            onPointerUp={() => handleButtonPress(false)}
            disabled={isSwitching}
            className={cn(
              "sipena-year-badge-btn w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
              "bg-primary/10 hover:bg-primary/20 active:bg-primary/25",
              "border border-primary/20 hover:border-primary/40",
              "text-left group transition-colors duration-200",
              "min-h-[44px] touch-manipulation",
              isSwitching && "opacity-50 pointer-events-none",
              className
            )}
          >
            <div className="flex-shrink-0" ref={calendarRef}>
              {isSwitching ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Calendar className="h-4 w-4 text-primary" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">
                {activeYear.name}
                {showSemester && activeSemester && (
                  <span className="text-muted-foreground font-normal ml-1">
                    • {activeSemester.name}
                  </span>
                )}
              </p>
            </div>
            <ChevronDown className="h-4 w-4 text-primary shrink-0" />
          </button>
        </div>

        <YearSwitchDialog
          open={showSwitchDialog}
          onOpenChange={setShowSwitchDialog}
          targetYearId={targetYearId}
          onComplete={() => setTargetYearId(null)}
        />
      </>
    );
  }

  // Default variant
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "gap-2 font-medium border-primary/20 hover:border-primary/40",
              isSwitching && "opacity-50 pointer-events-none",
              className
            )}
            disabled={isSwitching}
          >
            {isSwitching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Calendar className="h-4 w-4 text-primary" />
            )}
            
            <span className="hidden sm:inline">{activeYear.name}</span>
            <span className="sm:hidden">
              {activeYear.name.split("/")[0]}
            </span>
            
            {showSemester && activeSemester && (
              <Badge variant="secondary" className="ml-1 text-xs py-0 px-1.5">
                Sem {activeSemester.number}
              </Badge>
            )}
            
            <ChevronDown className="h-4 w-4 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        
        <DropdownMenuContent align="end" className="w-56" isEmpty={academicYears.length === 0} emptyLabel="Tidak ada pilihan Tahun Ajaran">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
            Pilih Tahun Ajaran
          </div>
          
          {academicYears.map((year) => (
            <DropdownMenuItem
              key={year.id}
              onClick={() => handleYearSelect(year.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className={cn(
                  year.id === activeYear.id && "font-semibold text-primary"
                )}>
                  {year.name}
                </span>
              </div>
              {year.id === activeYear.id && (
                <Badge variant="default" className="text-xs py-0">
                  Aktif
                </Badge>
              )}
            </DropdownMenuItem>
          ))}
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={() => {
              setTargetYearId(null);
              setShowSwitchDialog(true);
            }}
            className="text-primary cursor-pointer"
          >
            <Plus className="h-4 w-4 mr-2" />
            Kelola Tahun Ajaran
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <YearSwitchDialog
        open={showSwitchDialog}
        onOpenChange={setShowSwitchDialog}
        targetYearId={targetYearId}
        onComplete={() => setTargetYearId(null)}
      />
    </>
  );
}

export default ActiveYearBadge;

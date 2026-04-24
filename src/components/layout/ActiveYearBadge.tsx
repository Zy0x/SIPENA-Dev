import { useState, useRef, useEffect, useCallback } from "react";
import { Calendar, ChevronDown, Check, Plus, Loader2 } from "lucide-react";
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
import { SemesterToggle, SemesterUnavailableHint } from "./SemesterToggle";
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
  const duration = prefersReducedMotion ? 0.01 : 0.25;
  
  // Refs for GSAP animations
  const yearButtonRef = useRef<HTMLButtonElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  // GSAP: Animated hint bounce — restart when component becomes visible
  const arrowTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    if (!arrowRef.current || prefersReducedMotion) return;
    
    // Kill previous timeline if exists
    if (arrowTlRef.current) arrowTlRef.current.kill();

    const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
    tl.to(arrowRef.current, { y: 6, opacity: 1, duration: 0.7, ease: "power2.inOut" })
      .to(arrowRef.current, { y: 0, opacity: 0.4, duration: 0.7, ease: "power2.inOut" });
    
    arrowTlRef.current = tl;

    // Visibility observer to pause/resume animation when sidebar hides/shows
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          tl.play();
        } else {
          tl.pause();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(arrowRef.current);
    
    return () => {
      tl.kill();
      observer.disconnect();
      arrowTlRef.current = null;
    };
  }, [prefersReducedMotion]);

  // GSAP: Hint entrance
  useEffect(() => {
    if (!hintRef.current) return;
    
    gsap.fromTo(hintRef.current,
      { opacity: 0, y: -3 },
      { opacity: 1, y: 0, duration: duration * 1.2, delay: 0.1, ease: "power3.out" }
    );
  }, [duration]);

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
      <Button
        variant="outline"
        size="sm"
        className={cn("gap-2", className)}
        onClick={() => setShowSwitchDialog(true)}
      >
        <Calendar className="h-4 w-4" />
        <span>Pilih Tahun Ajaran</span>
      </Button>
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
          <DropdownMenuContent align="end" className="w-48">
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
              "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl",
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
              </p>
              {showSemester && activeSemester && !showSemesterToggle && (
                <p className="text-[10px] text-muted-foreground truncate">
                  {activeSemester.name}
                </p>
              )}
            </div>
            <ChevronDown className="h-4 w-4 text-primary shrink-0" />
          </button>

          {/* Semester Toggle with GSAP hint */}
          <div className="relative pt-1">
            {/* Animated hint label */}
            <div 
              ref={hintRef}
              className="flex items-center justify-center gap-1.5 mb-1.5"
            >
              <span className="text-[10px] text-primary/60 font-medium flex items-center gap-1">
                <span ref={arrowRef} style={{ opacity: 0.4 }}>↓</span>
                <span>Pilih Semester</span>
              </span>
            </div>
            
            {semestersForActiveYear.length > 0 ? (
              <SemesterToggle size="sm" className="w-full" />
            ) : (
              <SemesterUnavailableHint />
            )}
          </div>
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
        
        <DropdownMenuContent align="end" className="w-56">
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

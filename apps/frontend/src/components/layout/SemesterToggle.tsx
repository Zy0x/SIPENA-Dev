import { useRef, useEffect, useCallback } from "react";
import { useAcademicYear } from "@/contexts/AcademicYearContext";
import { cn } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { showWarning } from "@/contexts/ToastContext";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface SemesterToggleProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

export function SemesterToggle({ 
  className, 
  size = "md",
  disabled = false,
}: SemesterToggleProps) {
  const { 
    activeSemester, 
    semestersForActiveYear, 
    switchSemester, 
    isSwitching,
    hasActiveYear,
  } = useAcademicYear();

  const containerRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0.01 : 0.25;

  const semester1 = semestersForActiveYear.find(s => s.number === 1);
  const semester2 = semestersForActiveYear.find(s => s.number === 2);
  const activeSemesterNumber = activeSemester?.number || 1;

  // GSAP: Animate indicator position
  useEffect(() => {
    if (!indicatorRef.current || !hasActiveYear || semestersForActiveYear.length === 0) return;
    
    gsap.to(indicatorRef.current, {
      left: activeSemesterNumber === 1 ? "4px" : "50%",
      duration,
      ease: "back.out(1.7)"
    });
  }, [activeSemesterNumber, duration, hasActiveYear, semestersForActiveYear.length]);

  // GSAP: Container entrance
  useEffect(() => {
    if (!containerRef.current || !hasActiveYear || semestersForActiveYear.length === 0) return;
    
    gsap.fromTo(containerRef.current,
      { opacity: 0, y: 5 },
      { opacity: 1, y: 0, duration: duration * 1.2, ease: "power3.out" }
    );
  }, [duration, hasActiveYear, semestersForActiveYear.length]);

  // If no active year or no semesters, don't render
  if (!hasActiveYear || semestersForActiveYear.length === 0) {
    return null;
  }

  const handleToggle = async (number: 1 | 2) => {
    if (disabled || isSwitching) return;
    
    const targetSemester = number === 1 ? semester1 : semester2;
    if (targetSemester && targetSemester.id !== activeSemester?.id) {
      await switchSemester(targetSemester.id);
    }
  };

  const sizeClasses = {
    sm: {
      container: "h-9 text-[11px]",
      button: "px-3 py-1.5",
      indicator: "w-[calc(50%-2px)]",
    },
    md: {
      container: "h-10 text-xs",
      button: "px-4 py-2",
      indicator: "w-[calc(50%-2px)]",
    },
    lg: {
      container: "h-11 text-sm",
      button: "px-5 py-2.5",
      indicator: "w-[calc(50%-2px)]",
    },
  };

  const sizes = sizeClasses[size];

  // Semester button component with tooltip for unavailable
  const SemesterButton = ({ 
    number, 
    semester, 
    isActive 
  }: { 
    number: 1 | 2; 
    semester: typeof semester1; 
    isActive: boolean;
  }) => {
    const isUnavailable = !semester;
    const buttonRef = useRef<HTMLButtonElement>(null);

    // GSAP hover
    const handleHover = useCallback((isEntering: boolean) => {
      if (!buttonRef.current || prefersReducedMotion || isActive) return;
      gsap.to(buttonRef.current, {
        scale: isEntering ? 1.02 : 1,
        duration: 0.15,
        ease: "power2.out"
      });
    }, [isActive]);
    
    const buttonContent = (
      <button
        ref={buttonRef}
        onClick={() => {
          if (isUnavailable) {
            showWarning(
              `Semester ${number} Belum Dibuat`,
              "Buka menu ⋮ pada Tahun Ajaran di sidebar untuk mengaktifkan semester ini."
            );
            return;
          }
          handleToggle(number);
        }}
        onPointerEnter={() => handleHover(true)}
        onPointerLeave={() => handleHover(false)}
        disabled={disabled || isSwitching}
        className={cn(
          "relative z-10 flex items-center justify-center rounded-lg font-semibold w-1/2 whitespace-nowrap",
          "min-h-[36px] touch-manipulation transition-colors duration-150",
          sizes.button,
          isActive
            ? "text-primary-foreground"
            : isUnavailable
              ? "text-muted-foreground/50"
              : "text-muted-foreground hover:text-foreground",
          isUnavailable && "opacity-40 cursor-pointer"
        )}
      >
        {isSwitching && activeSemesterNumber !== number ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <span className="truncate flex items-center gap-1">
            Sem {number}
            {isUnavailable && (
              <AlertCircle className="h-3 w-3 text-status-connecting" />
            )}
          </span>
        )}
      </button>
    );

    // Wrap with tooltip if unavailable
    if (isUnavailable) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {buttonContent}
          </TooltipTrigger>
          <TooltipContent 
            side="bottom" 
            sideOffset={8}
            className="bg-popover border-border text-popover-foreground"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <AlertCircle className="h-3.5 w-3.5 text-grade-warning" />
              <span>Semester {number} belum dibuat</span>
            </div>
          </TooltipContent>
        </Tooltip>
      );
    }

    return buttonContent;
  };

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative inline-flex items-center rounded-xl bg-muted/80 p-1 border border-border/50",
        "shadow-sm hover:shadow-md transition-shadow",
        sizes.container,
        isSwitching && "pointer-events-none opacity-70",
        className
      )}
    >
      {/* Animated background indicator with glow */}
      <div
        ref={indicatorRef}
        className={cn(
          "absolute top-1 bottom-1 rounded-lg bg-primary shadow-md",
          "shadow-primary/30",
          sizes.indicator
        )}
        style={{ left: activeSemesterNumber === 1 ? "4px" : "50%" }}
      />

      {/* Semester 1 button */}
      <SemesterButton number={1} semester={semester1} isActive={activeSemesterNumber === 1} />

      {/* Semester 2 button */}
      <SemesterButton number={2} semester={semester2} isActive={activeSemesterNumber === 2} />
    </div>
  );
}

// Component to show when no semesters available
export function SemesterUnavailableHint() {
  const containerRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!containerRef.current) return;
    
    gsap.fromTo(containerRef.current,
      { opacity: 0, scale: 0.95 },
      { opacity: 1, scale: 1, duration: 0.3, ease: "power3.out" }
    );
  }, []);

  // Shake animation for icon
  useEffect(() => {
    if (!iconRef.current || prefersReducedMotion) return;
    
    const tl = gsap.timeline({ repeat: -1, repeatDelay: 2 });
    tl.to(iconRef.current, { rotation: -10, duration: 0.1 })
      .to(iconRef.current, { rotation: 10, duration: 0.1 })
      .to(iconRef.current, { rotation: -10, duration: 0.1 })
      .to(iconRef.current, { rotation: 10, duration: 0.1 })
      .to(iconRef.current, { rotation: 0, duration: 0.1 });
    
    return () => {
      tl.kill();
    };
  }, [prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl",
        "bg-status-connecting/10 border border-status-connecting/30 border-dashed",
        "text-status-connecting",
        "min-h-[40px]"
      )}
    >
      <div ref={iconRef}>
        <AlertCircle className="h-4 w-4" />
      </div>
      <span className="text-xs font-medium">Semester belum dibuat</span>
    </div>
  );
}

export default SemesterToggle;

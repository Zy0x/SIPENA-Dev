import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./button";
import { X, ChevronLeft, ChevronRight, HelpCircle, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
}

interface ProductTourProps {
  steps: TourStep[];
  tourKey: string;
  onComplete?: () => void;
  // If true, tour will only auto-start if user hasn't completed onboarding
  requireOnboarding?: boolean;
  // Passed from parent to indicate if user needs onboarding
  shouldAutoStart?: boolean;
}

type TooltipPosition = "top" | "bottom" | "left" | "right";

// Simple event bus for tour triggers
const tourListeners = new Map<string, () => void>();

export const triggerTour = (tourKey: string) => {
  const listener = tourListeners.get(tourKey);
  if (listener) listener();
};

export function ProductTour({ steps, tourKey, onComplete, requireOnboarding = true, shouldAutoStart }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, position: "bottom" as TooltipPosition });
  
  const popupRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const initRef = useRef(false);

  const step = steps[currentStep];

  // Register listener for manual trigger
  useEffect(() => {
    const handleTrigger = () => {
      if (mountedRef.current) {
        setCurrentStep(0);
        setIsActive(true);
      }
    };

    tourListeners.set(tourKey, handleTrigger);

    return () => {
      tourListeners.delete(tourKey);
    };
  }, [tourKey]);

  // Auto-start only once for new users who haven't completed onboarding
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    // Check if tour was already seen for this key
    const hasSeenTour = localStorage.getItem(`tour_completed_${tourKey}`);
    
    // If requireOnboarding is true, we need shouldAutoStart to be true
    // If requireOnboarding is false, we use the old behavior (local storage check only)
    const shouldStart = requireOnboarding 
      ? (shouldAutoStart === true && !hasSeenTour)
      : (!hasSeenTour && steps.length > 0);
    
    if (shouldStart && steps.length > 0) {
      const timer = setTimeout(() => {
        if (mountedRef.current) {
          setIsActive(true);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tourKey, steps.length, requireOnboarding, shouldAutoStart]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Calculate optimal tooltip position
  const getOptimalPosition = useCallback((rect: DOMRect, tooltipWidth: number, tooltipHeight: number) => {
    const padding = 16;
    const arrowSize = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const positions: { name: TooltipPosition; x: number; y: number; valid: boolean }[] = [
      {
        name: "bottom",
        x: rect.left + rect.width / 2 - tooltipWidth / 2,
        y: rect.bottom + arrowSize + padding,
        valid: rect.bottom + tooltipHeight + arrowSize + padding * 2 < viewportHeight
      },
      {
        name: "top",
        x: rect.left + rect.width / 2 - tooltipWidth / 2,
        y: rect.top - tooltipHeight - arrowSize - padding,
        valid: rect.top - tooltipHeight - arrowSize - padding > 0
      },
      {
        name: "right",
        x: rect.right + arrowSize + padding,
        y: rect.top + rect.height / 2 - tooltipHeight / 2,
        valid: rect.right + tooltipWidth + arrowSize + padding * 2 < viewportWidth
      },
      {
        name: "left",
        x: rect.left - tooltipWidth - arrowSize - padding,
        y: rect.top + rect.height / 2 - tooltipHeight / 2,
        valid: rect.left - tooltipWidth - arrowSize - padding > 0
      }
    ];

    let position = positions.find(p => p.valid) || positions[0];
    
    // Clamp to viewport
    position.x = Math.max(padding, Math.min(viewportWidth - tooltipWidth - padding, position.x));
    position.y = Math.max(padding, Math.min(viewportHeight - tooltipHeight - padding, position.y));

    return { x: position.x, y: position.y, position: position.name };
  }, []);

  // Find and track target element
  useEffect(() => {
    if (!isActive || !step || !mountedRef.current) return;

    let retryCount = 0;
    const maxRetries = 15;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const findAndTrackElement = () => {
      if (!mountedRef.current || !isActive) return;

      const target = document.querySelector(step.target);

      if (!target) {
        retryCount++;
        if (retryCount < maxRetries) {
          retryTimer = setTimeout(findAndTrackElement, 300);
        } else {
          // Skip to next step if element not found
          if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
          } else {
            handleComplete();
          }
        }
        return;
      }

      // Scroll into view
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });

      // Start tracking position
      const updatePosition = () => {
        if (!mountedRef.current || !isActive) return;

        const rect = target.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          setTargetRect(rect);

          if (popupRef.current) {
            const tooltipRect = popupRef.current.getBoundingClientRect();
            const newPos = getOptimalPosition(rect, tooltipRect.width, tooltipRect.height);
            setTooltipPos(newPos);
          }
        }

        rafRef.current = requestAnimationFrame(updatePosition);
      };

      // Small delay to let scroll complete
      setTimeout(() => {
        if (mountedRef.current && isActive) {
          rafRef.current = requestAnimationFrame(updatePosition);
        }
      }, 100);
    };

    findAndTrackElement();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, step, currentStep, steps.length, getOptimalPosition]);

  const handleNext = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      handleComplete();
    }
  }, [currentStep, steps.length]);

  const handlePrev = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const handleComplete = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    localStorage.setItem(`tour_completed_${tourKey}`, "true");
    setIsActive(false);
    setTargetRect(null);
    setCurrentStep(0);
    onComplete?.();
  }, [tourKey, onComplete]);

  const handleSkip = useCallback(() => {
    handleComplete();
  }, [handleComplete]);

  // Don't render if not active
  if (!isActive || !step || steps.length === 0) {
    return null;
  }

  const isLastStep = currentStep === steps.length - 1;

  // Get arrow classes based on position
  const getArrowClasses = () => {
    switch (tooltipPos.position) {
      case "top": return "bottom-[-10px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-card";
      case "bottom": return "top-[-10px] left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-card";
      case "left": return "right-[-10px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-card";
      case "right": return "left-[-10px] top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-card";
    }
  };

  return (
    <>
      {/* Backdrop with spotlight cutout */}
      <div className="fixed inset-0 z-[9990] pointer-events-none">
        {targetRect && (
          <div
            className="absolute rounded-xl transition-all duration-200 ease-out"
            style={{
              top: targetRect.top - 8,
              left: targetRect.left - 8,
              width: targetRect.width + 16,
              height: targetRect.height + 16,
              boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.75)",
            }}
          />
        )}
      </div>

      {/* Click blocker */}
      <div 
        className="fixed inset-0 z-[9991] pointer-events-auto" 
        onClick={handleSkip}
      />

      {/* Highlight border */}
      {targetRect && (
        <div
          className="fixed z-[9992] pointer-events-none rounded-xl border-[3px] border-primary animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 20px hsl(var(--primary) / 0.5)",
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={popupRef}
        className={cn(
          "fixed z-[9999] w-[320px] max-w-[calc(100vw-2rem)] bg-card border-2 border-primary/30 rounded-2xl shadow-2xl p-4 pointer-events-auto",
          "animate-fade-in"
        )}
        style={{
          left: tooltipPos.x,
          top: tooltipPos.y,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Arrow */}
        <div className={cn("absolute w-0 h-0 border-[10px] border-solid", getArrowClasses())} />

        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-1 rounded-full">
              {currentStep + 1} / {steps.length}
            </span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={handleSkip}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <h3 className="font-bold text-lg text-foreground mb-2">{step.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{step.description}</p>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                i === currentStep ? "w-6 bg-primary" : i < currentStep ? "w-2 bg-primary/60" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={handleSkip} className="text-muted-foreground">
            Lewati
          </Button>

          <div className="flex items-center gap-2">
            {currentStep > 0 && (
              <Button variant="outline" size="sm" onClick={handlePrev}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Kembali
              </Button>
            )}
            <Button size="sm" onClick={handleNext} className="min-w-[90px]">
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Selesai
                </>
              ) : (
                <>
                  Lanjut
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

// Tour button component - triggers tour without page refresh
export function TourButton({ tourKey, className }: { tourKey: string; className?: string }) {
  const startTour = () => {
    localStorage.removeItem(`tour_completed_${tourKey}`);
    triggerTour(tourKey);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={startTour}
      className={cn("gap-2 border-primary/30 hover:bg-primary/5", className)}
      title="Lihat panduan"
    >
      <HelpCircle className="w-4 h-4 text-primary" />
      <span className="hidden sm:inline">Panduan</span>
    </Button>
  );
}

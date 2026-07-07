import React, { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "./button";
import { X, ChevronLeft, ChevronRight, HelpCircle, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TourStep {
  target: string;
  title: string;
  description: string;
  placement?: "top" | "bottom" | "left" | "right";
  prepare?: () => void | Promise<void>;
}

interface ProductTourProps {
  steps: TourStep[];
  tourKey: string;
  onComplete?: () => void;
  onExit?: (reason: TourExitReason) => void;
  // If true, tour will only auto-start if user hasn't completed onboarding
  requireOnboarding?: boolean;
  // Passed from parent to indicate if user needs onboarding
  shouldAutoStart?: boolean;
  // Optional layer override for tours launched from high z-index surfaces such as dialogs.
  zIndexBase?: number;
}

type TooltipPosition = "top" | "bottom" | "left" | "right";
export type TourExitReason = "completed" | "skipped" | "closed" | "cancelled";

// Simple event bus for tour triggers
const tourListeners = new Map<string, () => void>();

export const triggerTour = (tourKey: string) => {
  const listener = tourListeners.get(tourKey);
  if (listener) listener();
};

export function ProductTour({
  steps,
  tourKey,
  onComplete,
  onExit,
  requireOnboarding = true,
  shouldAutoStart,
  zIndexBase,
}: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, position: "bottom" as TooltipPosition });
  const tourZIndexBase = zIndexBase ?? 9990;
  
  const popupRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  const initRef = useRef(false);
  const activeRef = useRef(false);
  const tourRunIdRef = useRef(0);
  const onCompleteRef = useRef(onComplete);
  const onExitRef = useRef(onExit);

  const step = steps[currentStep];

  useEffect(() => {
    activeRef.current = isActive;
  }, [isActive]);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onExitRef.current = onExit;
  }, [onComplete, onExit]);

  const cancelTracking = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startTour = useCallback(() => {
    tourRunIdRef.current += 1;
    setCurrentStep(0);
    setTargetRect(null);
    setIsActive(true);
  }, []);

  const finishTour = useCallback((reason: TourExitReason) => {
    tourRunIdRef.current += 1;
    cancelTracking();
    localStorage.setItem(`tour_completed_${tourKey}`, "true");
    activeRef.current = false;
    setIsActive(false);
    setTargetRect(null);
    setCurrentStep(0);
    onCompleteRef.current?.();
    onExitRef.current?.(reason);
  }, [cancelTracking, tourKey]);

  // Register listener for manual trigger
  useEffect(() => {
    const handleTrigger = () => {
      if (mountedRef.current) {
        startTour();
      }
    };

    tourListeners.set(tourKey, handleTrigger);

    return () => {
      tourListeners.delete(tourKey);
    };
  }, [startTour, tourKey]);

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
          startTour();
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [tourKey, steps.length, requireOnboarding, shouldAutoStart, startTour]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tourRunIdRef.current += 1;
      cancelTracking();
      if (activeRef.current) {
        onExitRef.current?.("cancelled");
      }
    };
  }, [cancelTracking]);

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

    let cancelled = false;
    let retryCount = 0;
    const maxRetries = 15;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    const runId = tourRunIdRef.current;

    const findAndTrackElement = () => {
      if (!mountedRef.current || !activeRef.current || runId !== tourRunIdRef.current) return;

      // Find the first *visible* element matching selector (supports both mobile tab + desktop sidebar having same data-tour)
      const allTargets = document.querySelectorAll(step.target);
      const target = (Array.from(allTargets).find(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? allTargets[0] ?? null) as Element | null;

      if (!target) {
        retryCount++;
        if (retryCount < maxRetries) {
          retryTimer = setTimeout(findAndTrackElement, 300);
        } else {
          // Skip to next step if element not found
          if (currentStep < steps.length - 1) {
            setCurrentStep(prev => prev + 1);
          } else {
            finishTour("completed");
          }
        }
        return;
      }

      // Safe scroll to prevent fixed containers (like Vaul Drawer) from shifting
      const safeScrollIntoView = (el: Element) => {
        const getScrollParent = (node: HTMLElement | null): HTMLElement | null => {
          if (!node || node === document.body) return null;
          if (node.scrollHeight > node.clientHeight) {
            const style = window.getComputedStyle(node);
            if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
              return node;
            }
          }
          return getScrollParent(node.parentElement);
        };

        const scrollParent = getScrollParent(el as HTMLElement);
        if (scrollParent) {
          const parentRect = scrollParent.getBoundingClientRect();
          const elRect = el.getBoundingClientRect();
          const isOutside = elRect.top < parentRect.top || elRect.bottom > parentRect.bottom;
          
          if (isOutside) {
            const relativeTop = elRect.top - parentRect.top;
            const targetScrollTop = scrollParent.scrollTop + relativeTop - (parentRect.height / 2) + (elRect.height / 2);
            scrollParent.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
          }
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      };

      safeScrollIntoView(target);

      // Start tracking position
      const updatePosition = () => {
        if (!mountedRef.current || !activeRef.current || runId !== tourRunIdRef.current) return;
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
        if (mountedRef.current && activeRef.current && runId === tourRunIdRef.current) {
          rafRef.current = requestAnimationFrame(updatePosition);
        }
      }, 100);
    };

    const prepareAndTrackElement = async () => {
      await step.prepare?.();
      if (cancelled || !mountedRef.current || !activeRef.current || runId !== tourRunIdRef.current) return;
      findAndTrackElement();
    };

    void prepareAndTrackElement();

    return () => {
      cancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isActive, step, currentStep, steps.length, getOptimalPosition, finishTour]);

  const handleNext = useCallback(() => {
    cancelTracking();
    setTargetRect(null);
    
    if (currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      finishTour("completed");
    }
  }, [cancelTracking, currentStep, finishTour, steps.length]);

  const handlePrev = useCallback(() => {
    cancelTracking();
    setTargetRect(null);
    
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [cancelTracking, currentStep]);

  const handleSkip = useCallback(() => {
    finishTour("skipped");
  }, [finishTour]);

  const handleClose = useCallback(() => {
    finishTour("closed");
  }, [finishTour]);

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
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: tourZIndexBase }} data-sipena-tour="true">
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
        data-sipena-tour="true"
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: tourZIndexBase + 1 }}
        onClick={handleClose}
      />

      {/* Highlight border */}
      {targetRect && (
        <div
          data-sipena-tour="true"
          className="fixed pointer-events-none rounded-xl border-[3px] border-primary animate-pulse"
          style={{
            top: targetRect.top - 8,
            left: targetRect.left - 8,
            width: targetRect.width + 16,
            height: targetRect.height + 16,
            boxShadow: "0 0 20px hsl(var(--primary) / 0.5)",
            zIndex: tourZIndexBase + 2,
          }}
        />
      )}

      {/* Tooltip */}
      <div
        ref={popupRef}
        data-sipena-tour="true"
        className={cn(
          "fixed w-[320px] max-w-[calc(100vw-2rem)] bg-card border-2 border-primary/30 rounded-2xl shadow-2xl p-4 pointer-events-auto",
          "animate-fade-in"
        )}
        style={{
          left: tooltipPos.x,
          top: tooltipPos.y,
          zIndex: tourZIndexBase + 9,
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
          <Button variant="ghost" size="icon" className="h-8 w-8 -mr-2" onClick={handleClose}>
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
            <Button
              size="sm"
              onClick={handleNext}
              data-tour-final={isLastStep ? "true" : "false"}
              className={cn(
                "sipena-tour-action min-w-[90px] touch-manipulation select-none shadow-md transition-colors",
                isLastStep
                  ? "bg-emerald-600 text-white hover:bg-emerald-700 hover:text-white active:bg-emerald-700 active:text-white focus-visible:bg-emerald-600 focus-visible:text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground active:bg-primary active:text-primary-foreground focus-visible:bg-primary focus-visible:text-primary-foreground",
              )}
            >
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
export function TourButton({
  tourKey,
  className,
  onBeforeStart,
}: {
  tourKey: string;
  className?: string;
  onBeforeStart?: () => void | Promise<void>;
}) {
  const [isStarting, setIsStarting] = useState(false);

  const startTour = async () => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      await onBeforeStart?.();
      localStorage.removeItem(`tour_completed_${tourKey}`);
      triggerTour(tourKey);
    } finally {
      setIsStarting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={startTour}
      disabled={isStarting}
      className={cn("gap-2 border-primary/30 hover:bg-primary/5", className)}
      title="Lihat panduan"
    >
      <HelpCircle className="w-4 h-4 text-primary" />
      <span className="hidden sm:inline">Panduan</span>
    </Button>
  );
}

import * as React from "react";
import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Undo2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EnhancedToastProps {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  onDismiss: (id: string) => void;
  position?: "top" | "bottom";
  undoAction?: () => Promise<void> | void;
  undoLabel?: string;
}

// Custom hook for swipe handling
const useSwipe = (
  onSwipe: (direction: "left" | "right" | "up" | "down") => void,
  position: "top" | "bottom" = "top"
) => {
  const startX = useRef(0);
  const startY = useRef(0);
  const currentX = useRef(0);
  const currentY = useRef(0);
  const isSwiping = useRef(false);

  const handleStart = (clientX: number, clientY: number) => {
    startX.current = clientX;
    startY.current = clientY;
    currentX.current = clientX;
    currentY.current = clientY;
    isSwiping.current = true;
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isSwiping.current) return { x: 0, y: 0 };
    
    currentX.current = clientX;
    currentY.current = clientY;
    
    const diffX = clientX - startX.current;
    const diffY = clientY - startY.current;
    
    return { x: diffX, y: diffY };
  };

  const handleEnd = () => {
    if (!isSwiping.current) return false;
    
    const diffX = currentX.current - startX.current;
    const diffY = currentY.current - startY.current;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);
    const threshold = 60;

    isSwiping.current = false;

    if (absDiffX > threshold && absDiffX > absDiffY) {
      onSwipe(diffX > 0 ? "right" : "left");
      return true;
    }
    
    if (absDiffY > threshold && absDiffY > absDiffX) {
      if (position === "top" && diffY < 0) {
        onSwipe("up");
        return true;
      }
      if (position === "bottom" && diffY > 0) {
        onSwipe("down");
        return true;
      }
    }
    
    return false;
  };

  return { handleStart, handleMove, handleEnd };
};

export function EnhancedToast({
  id,
  title,
  description,
  variant = "default",
  duration = 4000,
  onDismiss,
  position = "top",
  undoAction,
  undoLabel = "Batalkan",
}: EnhancedToastProps) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const [isUndoing, setIsUndoing] = useState(false);
  const toastRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<number>(100);
  const lastTickRef = useRef<number>(Date.now());

  // Enter animation
  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
  }, []);

  // Progress bar animation
  useEffect(() => {
    if (duration <= 0 || isPaused || isUndoing) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;
      
      const decrement = (delta / duration) * 100;
      progressRef.current = Math.max(0, progressRef.current - decrement);
      setProgress(progressRef.current);

      if (progressRef.current <= 0) {
        handleDismiss(position === "top" ? "up" : "down");
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, isPaused, position, isUndoing]);

  const handleDismiss = useCallback((direction: "left" | "right" | "up" | "down" = "right") => {
    if (isExiting) return;
    
    setIsExiting(true);
    
    const exitDistance = 300;
    switch (direction) {
      case "left":
        setOffset({ x: -exitDistance, y: 0 });
        break;
      case "right":
        setOffset({ x: exitDistance, y: 0 });
        break;
      case "up":
        setOffset({ x: 0, y: -100 });
        break;
      case "down":
        setOffset({ x: 0, y: 100 });
        break;
    }
    
    setTimeout(() => onDismiss(id), 200);
  }, [id, onDismiss, isExiting]);

  const handleUndo = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!undoAction || isUndoing) return;
    
    console.log("[EnhancedToast] Undo button clicked");
    setIsUndoing(true);
    
    try {
      await undoAction();
      console.log("[EnhancedToast] Undo action completed");
    } catch (err) {
      console.error("[EnhancedToast] Undo failed:", err);
    }
    // Toast will be dismissed by the undo action
  }, [undoAction, isUndoing]);

  const swipe = useSwipe(handleDismiss, position);

  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setIsPaused(true);
    swipe.handleStart(e.touches[0].clientX, e.touches[0].clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const delta = swipe.handleMove(e.touches[0].clientX, e.touches[0].clientY);
    
    let constrainedY = delta.y;
    if (position === "top") {
      constrainedY = Math.min(0, delta.y);
    } else {
      constrainedY = Math.max(0, delta.y);
    }
    
    setOffset({ x: delta.x, y: constrainedY });
  };

  const handleTouchEnd = () => {
    const swiped = swipe.handleEnd();
    setIsDragging(false);
    
    if (!swiped) {
      setOffset({ x: 0, y: 0 });
    }
    
    setIsPaused(false);
    lastTickRef.current = Date.now();
  };

  const handleMouseEnter = () => {
    if (!isDragging) {
      setIsPaused(true);
    }
  };

  const handleMouseLeave = () => {
    setIsPaused(false);
    lastTickRef.current = Date.now();
  };

  // Variant styles - compact and readable
  const variantConfig = {
    default: {
      bg: "bg-card/95 dark:bg-card/95",
      border: "border-border/50",
      icon: null,
      iconColor: "",
      progressBg: "bg-primary",
    },
    success: {
      bg: "bg-emerald-50/95 dark:bg-emerald-950/90",
      border: "border-emerald-200/60 dark:border-emerald-700/50",
      icon: CheckCircle,
      iconColor: "text-emerald-600 dark:text-emerald-400",
      progressBg: "bg-emerald-500",
    },
    error: {
      bg: "bg-red-50/95 dark:bg-red-950/90",
      border: "border-red-200/60 dark:border-red-700/50",
      icon: AlertCircle,
      iconColor: "text-red-600 dark:text-red-400",
      progressBg: "bg-red-500",
    },
    warning: {
      bg: "bg-amber-50/95 dark:bg-amber-950/90",
      border: "border-amber-200/60 dark:border-amber-700/50",
      icon: AlertTriangle,
      iconColor: "text-amber-600 dark:text-amber-400",
      progressBg: "bg-amber-500",
    },
    info: {
      bg: "bg-blue-50/95 dark:bg-blue-950/90",
      border: "border-blue-200/60 dark:border-blue-700/50",
      icon: Info,
      iconColor: "text-blue-600 dark:text-blue-400",
      progressBg: "bg-blue-500",
    },
  };

  const config = variantConfig[variant];
  const IconComponent = config.icon;

  const dragOpacity = isDragging 
    ? Math.max(0.4, 1 - (Math.abs(offset.x) + Math.abs(offset.y)) / 200)
    : 1;

  return (
    <div
      ref={toastRef}
      role="alert"
      aria-live="polite"
      className={cn(
        "relative w-full rounded-xl border shadow-lg overflow-hidden",
        "backdrop-blur-xl backdrop-saturate-150",
        config.bg,
        config.border,
        "text-foreground",
        "transition-all ease-out select-none",
        isDragging ? "cursor-grabbing duration-0" : "cursor-grab duration-200",
        !isVisible && (position === "top" ? "-translate-y-4" : "translate-y-4"),
        !isVisible && "opacity-0 scale-95",
        isVisible && !isExiting && "translate-y-0 opacity-100 scale-100",
        isExiting && "opacity-0 pointer-events-none"
      )}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        opacity: isExiting ? 0 : dragOpacity,
        touchAction: "none",
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Progress bar at top */}
      <div className="h-0.5 w-full bg-foreground/10">
        <div 
          className={cn("h-full transition-all duration-100 ease-linear", config.progressBg)}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Content */}
      <div className="px-3 py-2.5 flex items-start gap-2.5">
        {IconComponent && (
          <IconComponent 
            className={cn("h-4 w-4 shrink-0 mt-0.5", config.iconColor)} 
            aria-hidden="true" 
          />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium leading-tight line-clamp-1">
            {title}
          </p>
          {description && (
            <p className="text-xs mt-0.5 text-muted-foreground leading-snug line-clamp-2">
              {description}
            </p>
          )}
        </div>
        
        {/* Action buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Undo button - prominent styling */}
          {undoAction && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUndo}
              disabled={isUndoing}
              className={cn(
                "h-7 px-2.5 text-xs font-semibold",
                "bg-background hover:bg-background/80",
                "border-2 border-primary/30 hover:border-primary/50",
                "text-primary hover:text-primary",
                "transition-all duration-150",
                "shadow-sm hover:shadow-md",
                "min-w-[70px]"
              )}
            >
              {isUndoing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <Undo2 className="h-3 w-3 mr-1" />
                  {undoLabel}
                </>
              )}
            </Button>
          )}
          
          {/* Close button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDismiss("right");
            }}
            className={cn(
              "shrink-0 p-1.5 rounded-md",
              "hover:bg-foreground/10 active:bg-foreground/20",
              "transition-colors duration-150",
              "min-w-[28px] min-h-[28px] flex items-center justify-center"
            )}
            aria-label="Tutup notifikasi"
          >
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Toast container for managing multiple toasts
interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  undoAction?: () => Promise<void> | void;
  undoLabel?: string;
}

interface EnhancedToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  position?: "top" | "bottom";
}

export function EnhancedToastContainer({ 
  toasts, 
  onDismiss,
  position = "top" 
}: EnhancedToastContainerProps) {
  return (
    <div 
      className={cn(
        "fixed z-[100] flex flex-col gap-2 pointer-events-none",
        "left-1/2 -translate-x-1/2",
        "w-full max-w-[380px] px-3",
        position === "top" 
          ? "top-3 sm:top-4" 
          : "bottom-16 sm:bottom-4"
      )}
    >
      {toasts.map((toast) => (
        <div key={toast.id} className="pointer-events-auto">
          <EnhancedToast
            id={toast.id}
            title={toast.title}
            description={toast.description}
            variant={toast.variant}
            duration={toast.duration}
            onDismiss={onDismiss}
            position={position}
            undoAction={toast.undoAction}
            undoLabel={toast.undoLabel}
          />
        </div>
      ))}
    </div>
  );
}

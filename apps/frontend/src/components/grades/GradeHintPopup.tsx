import React, { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Target, TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type HintTarget = "assignment" | "chapter" | "sts" | "sas" | "final";

interface GradeHintProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  studentName: string;
  kkm: number;
  currentValue: number | null;
  targetType: HintTarget;
  // Data for calculation
  chapterAvg?: number | null;
  stsValue?: number | null;
  sasValue?: number | null;
  otherAssignmentValues?: number[];
  totalAssignments?: number;
}

export function GradeHintPopup({
  isOpen,
  onClose,
  position,
  studentName,
  kkm,
  currentValue,
  targetType,
  chapterAvg,
  stsValue,
  sasValue,
  otherAssignmentValues = [],
  totalAssignments = 1,
}: GradeHintProps) {
  const popupRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  // Calculate required grade to meet KKM
  const calculateRequiredGrade = useCallback(() => {
    const results: { target: string; required: number | null; possible: boolean }[] = [];

    if (targetType === "assignment") {
      const otherSum = otherAssignmentValues.reduce((sum, v) => sum + (v ?? 0), 0);
      const requiredForChapter = kkm * totalAssignments - otherSum;
      const possibleForChapter = requiredForChapter <= 100;

      results.push({
        target: "Rata-rata BAB ≥ KKM",
        required: Math.max(0, requiredForChapter),
        possible: possibleForChapter && requiredForChapter >= 0,
      });
    }

    if (targetType === "sts" || targetType === "sas") {
      const hasChapters = chapterAvg !== null && chapterAvg !== undefined;
      const otherExam = targetType === "sts" ? (sasValue ?? 0) : (stsValue ?? 0);

      if (hasChapters) {
        const required = 4 * kkm - 2 * (chapterAvg ?? 0) - otherExam;
        results.push({
          target: "Nilai Rapor ≥ KKM",
          required: Math.max(0, required),
          possible: required <= 100,
        });
      } else {
        const required = 2 * kkm - otherExam;
        results.push({
          target: "Nilai Rapor ≥ KKM",
          required: Math.max(0, required),
          possible: required <= 100,
        });
      }
    }

    return results;
  }, [targetType, kkm, chapterAvg, stsValue, sasValue, otherAssignmentValues, totalAssignments]);

  // Adjust position to stay within viewport
  useEffect(() => {
    if (!popupRef.current || !isOpen) return;

    const popup = popupRef.current;
    const rect = popup.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 8;

    let newX = position.x;
    let newY = position.y;

    if (position.x + rect.width > viewportWidth - padding) {
      newX = viewportWidth - rect.width - padding;
    }
    if (newX < padding) newX = padding;

    if (position.y + rect.height > viewportHeight - padding) {
      newY = position.y - rect.height - 8;
    }
    if (newY < padding) newY = padding;

    setAdjustedPosition({ x: newX, y: newY });
  }, [position, isOpen]);

  // Close on scroll or resize
  useEffect(() => {
    if (!isOpen) return;

    const handleScroll = () => onClose();
    const handleResize = () => onClose();

    window.addEventListener("scroll", handleScroll, true);
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("scroll", handleScroll, true);
      window.removeEventListener("resize", handleResize);
    };
  }, [isOpen, onClose]);

  // Swipe gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
    };
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current) return;

    const touchEnd = {
      x: e.changedTouches[0].clientX,
      y: e.changedTouches[0].clientY,
    };

    const diffX = touchEnd.x - touchStartRef.current.x;
    const diffY = touchEnd.y - touchStartRef.current.y;

    // Swipe left or right to close (threshold: 60px, must be more horizontal than vertical)
    if (Math.abs(diffX) > 60 && Math.abs(diffX) > Math.abs(diffY)) {
      onClose();
    }

    touchStartRef.current = null;
  }, [onClose]);

  if (!isOpen) return null;

  const hints = calculateRequiredGrade();
  const currentStatus = currentValue !== null
    ? currentValue >= kkm + 5 ? "pass" : currentValue >= kkm ? "warning" : "fail"
    : null;

  const getTargetLabel = () => {
    switch (targetType) {
      case "assignment": return "Tugas";
      case "chapter": return "BAB";
      case "sts": return "STS";
      case "sas": return "SAS";
      case "final": return "Rapor";
      default: return "Nilai";
    }
  };

  // Truncate long names
  const truncatedName = studentName.length > 20 
    ? studentName.substring(0, 18) + "..." 
    : studentName;

  return (
    <div
      ref={popupRef}
      className={cn(
        "fixed z-[9999] bg-card border rounded-xl shadow-2xl p-3 w-72 max-w-[calc(100vw-1rem)]",
        "animate-fade-in touch-none pointer-events-auto"
      )}
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
      onClick={(e) => e.stopPropagation()}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground truncate" title={studentName}>
              {truncatedName}
            </p>
            <p className="text-sm font-semibold text-foreground">{getTargetLabel()}</p>
          </div>
        </div>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-8 w-8 shrink-0 hover:bg-destructive/10" 
          onClick={onClose}
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Current Value */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-muted/50 rounded-lg">
        <span className="text-xs text-muted-foreground">Nilai saat ini:</span>
        {currentValue !== null ? (
          <Badge 
            variant={currentStatus === "pass" ? "default" : currentStatus === "warning" ? "secondary" : "destructive"} 
            className="text-sm font-semibold"
          >
            {currentValue.toFixed(1)}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">Belum diisi</span>
        )}
        <span className="text-xs text-muted-foreground ml-auto">KKM: {kkm}</span>
      </div>

      {/* Hints */}
      <div className="space-y-2">
        <div className="flex items-center gap-1 text-xs font-medium text-foreground">
          <TrendingUp className="w-3.5 h-3.5 text-primary" />
          Prediksi Nilai yang Diperlukan:
        </div>

        {hints.length > 0 ? (
          hints.map((hint, i) => (
            <div
              key={i}
              className={cn(
                "p-2 rounded-lg text-xs",
                hint.possible
                  ? "bg-green-500/10 border border-green-500/20"
                  : "bg-red-500/10 border border-red-500/20"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{hint.target}</span>
                {hint.required !== null && (
                  <span
                    className={cn(
                      "font-bold",
                      hint.possible ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}
                  >
                    {hint.possible 
                      ? hint.required <= 0 
                        ? "✓ Sudah tercapai" 
                        : `≥ ${hint.required.toFixed(0)}`
                      : "Tidak mungkin tercapai"
                    }
                  </span>
                )}
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted-foreground p-2 bg-muted/50 rounded-lg">
            Lengkapi nilai lainnya untuk melihat prediksi.
          </p>
        )}
      </div>

      {/* Footer tip with swipe indicator */}
      <div className="mt-3 pt-2 border-t flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <ChevronLeft className="w-3 h-3" />
        <span>Geser atau tap di luar untuk menutup</span>
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  );
}

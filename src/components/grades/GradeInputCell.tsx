import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Updated: Warna berdasarkan KKM (Merah < KKM, Kuning KKM hingga KKM+5, Hijau > KKM+5)
export function getGradeColor(value: number | null, kkm: number): string {
  if (value === null) return "";
  if (value > kkm + 5) return "bg-grade-pass/20 text-grade-pass border-grade-pass/30";
  if (value >= kkm) return "bg-grade-warning/20 text-grade-warning border-grade-warning/30";
  return "bg-grade-fail/20 text-grade-fail border-grade-fail/30";
}

// Helper to get status label based on KKM
export function getGradeStatus(value: number | null, kkm: number): "pass" | "warning" | "fail" | null {
  if (value === null) return null;
  if (value > kkm + 5) return "pass";
  if (value >= kkm) return "warning";
  return "fail";
}

// Helper to get status label text - Updated: "Hampir Lulus" → "Cukup"
export function getGradeStatusLabel(status: "pass" | "warning" | "fail" | null): string {
  if (status === "pass") return "Lulus";
  if (status === "warning") return "Cukup";
  if (status === "fail") return "Belum Lulus";
  return "-";
}

interface GradeInputCellProps {
  studentId: string;
  gradeType: string;
  assignmentId?: string;
  kkm: number;
  value: number | null;
  onSave: (studentId: string, gradeType: string, value: number | null, assignmentId?: string) => void;
  isSaving: boolean;
  showRecommendation?: boolean;
}

export function GradeInputCell({
  studentId,
  gradeType,
  assignmentId,
  kkm,
  value,
  onSave,
  isSaving,
  showRecommendation = false,
}: GradeInputCellProps) {
  const [localValue, setLocalValue] = useState(value?.toString() || "");
  const [hasChanged, setHasChanged] = useState(false);
  const [validationError, setValidationError] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(value?.toString() || "");
    setHasChanged(false);
    setValidationError("");
  }, [value]);

  const validateAndSave = useCallback((valueStr: string) => {
    if (valueStr === "") {
      onSave(studentId, gradeType, null, assignmentId);
      setValidationError("");
      return;
    }

    const numValue = parseFloat(valueStr);
    if (isNaN(numValue)) {
      setValidationError("Nilai harus berupa angka");
      return;
    }
    if (numValue < 0 || numValue > 100) {
      setValidationError("Nilai harus antara 0-100");
      return;
    }

    setValidationError("");
    onSave(studentId, gradeType, numValue, assignmentId);
  }, [studentId, gradeType, assignmentId, onSave]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setHasChanged(true);

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Debounce auto-save (600ms) - balanced: not too slow, not too fast
    debounceRef.current = setTimeout(() => {
      validateAndSave(newValue);
    }, 600);
  };

  const handleBlur = () => {
    // Clear debounce and save immediately on blur
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    if (hasChanged) {
      validateAndSave(localValue);
      setHasChanged(false);
    }
  };

  // FIX: Prevent mouse wheel from changing number input value
  const handleWheel = useCallback((e: React.WheelEvent<HTMLInputElement>) => {
    // Prevent the default scroll-to-change-value behavior on number inputs
    e.currentTarget.blur();
  }, []);

  // Navigate to adjacent cells using arrow keys
  const navigateToCell = useCallback((direction: 'up' | 'down' | 'left' | 'right') => {
    const inputs = document.querySelectorAll<HTMLInputElement>('input[data-grade-cell="true"]');
    const inputsArray = Array.from(inputs);
    const currentIndex = inputsArray.indexOf(inputRef.current!);
    
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    
    if (direction === 'down') {
      const currentRect = inputRef.current!.getBoundingClientRect();
      for (let i = currentIndex + 1; i < inputsArray.length; i++) {
        const rect = inputsArray[i].getBoundingClientRect();
        if (rect.top > currentRect.bottom - 5 && Math.abs(rect.left - currentRect.left) < 30) {
          targetIndex = i;
          break;
        }
      }
    } else if (direction === 'up') {
      const currentRect = inputRef.current!.getBoundingClientRect();
      for (let i = currentIndex - 1; i >= 0; i--) {
        const rect = inputsArray[i].getBoundingClientRect();
        if (rect.bottom < currentRect.top + 5 && Math.abs(rect.left - currentRect.left) < 30) {
          targetIndex = i;
          break;
        }
      }
    } else if (direction === 'right') {
      if (currentIndex < inputsArray.length - 1) {
        targetIndex = currentIndex + 1;
      }
    } else if (direction === 'left') {
      if (currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
    }

    if (targetIndex !== currentIndex && inputsArray[targetIndex]) {
      inputsArray[targetIndex].focus();
      inputsArray[targetIndex].select();
    }
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Enter - save and move down
    if (e.key === "Enter") {
      e.preventDefault();
      if (hasChanged) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        validateAndSave(localValue);
        setHasChanged(false);
      }
      navigateToCell('down');
      return;
    }

    // Arrow Up/Down - navigate between rows (always)
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (hasChanged) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        validateAndSave(localValue);
        setHasChanged(false);
      }
      navigateToCell('down');
      return;
    }
    
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (hasChanged) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        validateAndSave(localValue);
        setHasChanged(false);
      }
      navigateToCell('up');
      return;
    }

    // Tab - navigate left/right
    if (e.key === "Tab") {
      e.preventDefault();
      if (hasChanged) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        validateAndSave(localValue);
        setHasChanged(false);
      }
      navigateToCell(e.shiftKey ? 'left' : 'right');
      return;
    }
  };

  const numValue = localValue === "" ? null : parseFloat(localValue);
  const colorClass = validationError ? "border-destructive bg-destructive/10" : getGradeColor(numValue, kkm);
  const status = getGradeStatus(numValue, kkm);
  
  // Calculate recommendation to reach KKM
  const recommendation = showRecommendation && numValue !== null && numValue < kkm
    ? `Tambah ${(kkm - numValue).toFixed(1)} poin untuk mencapai KKM`
    : null;

  // Status tooltip for accessibility
  const statusTooltip = numValue !== null ? `Nilai ${numValue.toFixed(1)}: ${getGradeStatusLabel(status)}` : null;

  // Get grade type label (STS/SAS)
  const gradeTypeLabel = gradeType === "sts" ? "STS" : gradeType === "sas" ? "SAS" : gradeType;

  return (
    <div className="relative">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Input
              ref={inputRef}
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              step="0.1"
              value={localValue}
              onChange={handleChange}
              onBlur={handleBlur}
              onKeyDown={handleKeyDown}
              onWheel={handleWheel}
              data-grade-cell="true"
              className={`w-20 text-center transition-colors ${colorClass} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
              placeholder="-"
              disabled={isSaving}
              aria-invalid={!!validationError}
              aria-describedby={validationError ? `error-${studentId}-${gradeType}` : undefined}
              aria-label={`Nilai ${gradeTypeLabel}${statusTooltip ? `, ${statusTooltip}` : ''}`}
            />
          </TooltipTrigger>
          {(validationError || recommendation || statusTooltip) && (
            <TooltipContent side="top" className={validationError ? "bg-destructive" : ""}>
              <p>{validationError || recommendation || statusTooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>
      
      {isSaving && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/50 rounded-md">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        </div>
      )}
      
      {validationError && (
        <p 
          id={`error-${studentId}-${gradeType}`} 
          className="sr-only" 
          role="alert"
          aria-live="polite"
        >
          {validationError}
        </p>
      )}
    </div>
  );
}

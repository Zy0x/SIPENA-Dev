import * as React from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SliderWithButtonsProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  buttonStep?: number;
  onValueChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export function SliderWithButtons({
  value,
  min,
  max,
  step = 1,
  buttonStep,
  onValueChange,
  className,
  disabled,
}: SliderWithButtonsProps) {
  const incrementStep = buttonStep ?? step;
  const decrement = () => {
    const next = Math.max(min, value - incrementStep);
    onValueChange(parseFloat(next.toFixed(4)));
  };
  const increment = () => {
    const next = Math.min(max, value + incrementStep);
    onValueChange(parseFloat(next.toFixed(4)));
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 flex-shrink-0 touch-manipulation"
        onClick={decrement}
        disabled={disabled || value <= min}
      >
        <Minus className="w-3 h-3" />
      </Button>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onValueChange(v[0] ?? value)}
        disabled={disabled}
        className="flex-1"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        className="h-7 w-7 flex-shrink-0 touch-manipulation"
        onClick={increment}
        disabled={disabled || value >= max}
      >
        <Plus className="w-3 h-3" />
      </Button>
    </div>
  );
}

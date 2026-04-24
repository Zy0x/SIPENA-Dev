import * as React from "react";
import { useState, useId } from "react";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, Check, X } from "lucide-react";

interface FloatingLabelInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  success?: boolean;
  icon?: React.ReactNode;
  showPasswordToggle?: boolean;
}

export const FloatingLabelInput = React.forwardRef<HTMLInputElement, FloatingLabelInputProps>(
  ({ 
    label, 
    error, 
    success, 
    icon, 
    showPasswordToggle, 
    className, 
    type = "text",
    value,
    onChange,
    onFocus,
    onBlur,
    ...props 
  }, ref) => {
    const id = useId();
    const [isFocused, setIsFocused] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const hasValue = value !== undefined && value !== "";
    const isFloating = isFocused || hasValue;
    
    const inputType = showPasswordToggle 
      ? (showPassword ? "text" : "password") 
      : type;

    return (
      <div className="relative">
        <div className="relative group">
          {/* Icon */}
          {icon && (
            <div 
              className={cn(
                "absolute left-4 top-1/2 -translate-y-1/2 transition-colors duration-200 z-10",
                isFocused ? "text-primary" : "text-muted-foreground"
              )}
            >
              {icon}
            </div>
          )}

          {/* Input */}
          <input
            ref={ref}
            id={id}
            type={inputType}
            value={value}
            onChange={onChange}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            className={cn(
              "peer w-full h-14 rounded-xl border-2 bg-background px-4 pt-5 pb-2 text-base text-foreground outline-none transition-all duration-200",
              "caret-white [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_9999s_ease-in-out_0s] [&:-webkit-autofill]:[caret-color:white]",
              icon && "pl-12",
              showPasswordToggle && "pr-12",
              !error && !success && "border-border focus:border-primary",
              error && "border-destructive focus:border-destructive",
              success && "border-green-500 focus:border-green-500",
              "placeholder-transparent",
              className
            )}
            placeholder={label}
            {...props}
          />

          {/* Floating Label */}
          <label
            htmlFor={id}
            className={cn(
              "absolute transition-all duration-200 pointer-events-none",
              icon ? "left-12" : "left-4",
              isFloating 
                ? "top-2 text-xs font-medium" 
                : "top-1/2 -translate-y-1/2 text-base",
              isFocused ? "text-primary" : "text-muted-foreground",
              error && "text-destructive",
              success && "text-green-500"
            )}
          >
            {label}
          </label>

          {/* Password Toggle */}
          {showPasswordToggle && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </button>
          )}

          {/* Validation Icon */}
          {!showPasswordToggle && (error || success) && (
            <div 
              className={cn(
                "absolute right-4 top-1/2 -translate-y-1/2",
                error && "text-destructive",
                success && "text-green-500"
              )}
            >
              {error ? <X className="w-5 h-5" /> : <Check className="w-5 h-5" />}
            </div>
          )}

          {/* Focus Ring */}
          <div 
            className={cn(
              "absolute inset-0 rounded-xl pointer-events-none transition-all duration-200",
              isFocused && !error && "ring-4 ring-primary/10",
              isFocused && error && "ring-4 ring-destructive/10"
            )}
          />
        </div>

        {/* Error Message */}
        {error && (
          <p className="mt-1.5 text-sm text-destructive animate-fade-in">
            {error}
          </p>
        )}
      </div>
    );
  }
);

FloatingLabelInput.displayName = "FloatingLabelInput";

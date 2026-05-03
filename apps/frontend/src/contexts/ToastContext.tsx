import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from "react";
import { EnhancedToastContainer } from "@/components/ui/enhanced-toast";

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant?: "default" | "success" | "error" | "warning" | "info";
  duration?: number;
  undoAction?: () => Promise<void> | void;
  undoLabel?: string;
}

interface ToastContextType {
  toasts: ToastItem[];
  toast: (options: Omit<ToastItem, "id">) => string;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  warning: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  // Simplified: Execute immediately, show toast, allow undo within duration
  toastWithUndo: (options: {
    title: string;
    description?: string;
    variant?: ToastItem["variant"];
    duration?: number;
    onExecute: () => Promise<void>;
    onUndo?: () => Promise<void> | void;
    undoLabel?: string;
  }) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let toastIdCounter = 0;

// Global toast functions for use outside React components
let globalToast: ToastContextType["toast"] | null = null;
let globalSuccess: ToastContextType["success"] | null = null;
let globalError: ToastContextType["error"] | null = null;
let globalWarning: ToastContextType["warning"] | null = null;
let globalInfo: ToastContextType["info"] | null = null;
let globalToastWithUndo: ToastContextType["toastWithUndo"] | null = null;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const executedActionsRef = useRef<Set<string>>(new Set());

  const generateId = useCallback(() => {
    return `toast-${++toastIdCounter}-${Date.now()}`;
  }, []);

  const addToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = generateId();
    setToasts((prev) => {
      // Deduplicate: if a toast with same title+description+variant exists, replace it
      const duplicateIdx = prev.findIndex(
        (t) => t.title === toast.title && t.description === toast.description && t.variant === toast.variant
      );
      let updated: ToastItem[];
      if (duplicateIdx !== -1) {
        // Replace existing duplicate with new id (resets timer)
        updated = [...prev];
        updated[duplicateIdx] = { ...toast, id };
      } else {
        updated = [...prev, { ...toast, id }];
      }
      // Limit max visible toasts to 3 - remove oldest
      return updated.length > 3 ? updated.slice(-3) : updated;
    });
    return id;
  }, [generateId]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismissAll = useCallback(() => {
    setToasts([]);
  }, []);

  const toast = useCallback((options: Omit<ToastItem, "id">) => {
    return addToast(options);
  }, [addToast]);

  const success = useCallback((title: string, description?: string) => {
    return addToast({ title, description, variant: "success", duration: 4000 });
  }, [addToast]);

  const error = useCallback((title: string, description?: string) => {
    return addToast({ title, description, variant: "error", duration: 5000 });
  }, [addToast]);

  const warning = useCallback((title: string, description?: string) => {
    return addToast({ title, description, variant: "warning", duration: 4500 });
  }, [addToast]);

  const info = useCallback((title: string, description?: string) => {
    return addToast({ title, description, variant: "info", duration: 4000 });
  }, [addToast]);

  /**
   * NEW APPROACH: Execute action IMMEDIATELY, show countdown toast for undo
   * If user clicks undo within duration, call onUndo to reverse the action
   * This ensures the action ALWAYS executes (no timing issues)
   */
  const toastWithUndo = useCallback(async (options: {
    title: string;
    description?: string;
    variant?: ToastItem["variant"];
    duration?: number;
    onExecute: () => Promise<void>;
    onUndo?: () => Promise<void> | void;
    undoLabel?: string;
  }) => {
    const duration = options.duration || 5000;
    const toastId = generateId();
    const executionId = `exec-${toastId}`;
    
    console.log("================================================================");
    console.log("[ToastContext] toastWithUndo called");
    console.log("[ToastContext] Toast ID:", toastId);
    console.log("[ToastContext] Duration:", duration);
    console.log("================================================================");

    // STEP 1: Show toast with countdown FIRST
    const undoAction = async () => {
      console.log("[ToastContext] UNDO clicked for:", toastId);
      
      // Mark as undone so we don't show success
      executedActionsRef.current.add(`undone-${toastId}`);
      
      // Dismiss toast immediately
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      
      // Call undo handler
      if (options.onUndo) {
        try {
          await options.onUndo();
          console.log("[ToastContext] Undo handler completed");
        } catch (err) {
          console.error("[ToastContext] Undo handler error:", err);
        }
      }
    };

    setToasts((prev) => [...prev, {
      id: toastId,
      title: options.title,
      description: options.description,
      variant: options.variant || "warning",
      duration: duration,
      undoAction,
      undoLabel: options.undoLabel || "Batalkan",
    }]);

    // STEP 2: Execute the action IMMEDIATELY
    console.log("[ToastContext] EXECUTING ACTION IMMEDIATELY...");
    
    try {
      await options.onExecute();
      executedActionsRef.current.add(executionId);
      console.log("[ToastContext] ✅ ACTION EXECUTED SUCCESSFULLY!");
    } catch (err) {
      console.error("[ToastContext] ❌ ACTION EXECUTION FAILED:", err);
      // Dismiss toast on error
      setToasts((prev) => prev.filter((t) => t.id !== toastId));
      throw err;
    }
    
    // The toast will auto-dismiss after duration via EnhancedToast component
    
  }, [generateId]);

  // Set global functions
  useEffect(() => {
    globalToast = toast;
    globalSuccess = success;
    globalError = error;
    globalWarning = warning;
    globalInfo = info;
    globalToastWithUndo = toastWithUndo;
    
    return () => {
      globalToast = null;
      globalSuccess = null;
      globalError = null;
      globalWarning = null;
      globalInfo = null;
      globalToastWithUndo = null;
    };
  }, [toast, success, error, warning, info, toastWithUndo]);

  return (
    <ToastContext.Provider value={{ 
      toasts, 
      toast, 
      success, 
      error, 
      warning, 
      info, 
      dismiss, 
      dismissAll,
      toastWithUndo,
    }}>
      {children}
      <EnhancedToastContainer toasts={toasts} onDismiss={dismiss} position="top" />
    </ToastContext.Provider>
  );
}

export function useEnhancedToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error("useEnhancedToast must be used within a ToastProvider");
  }
  return context;
}

// Export global toast functions for use outside React
export const showToast = (options: Omit<ToastItem, "id">) => globalToast?.(options);
export const showSuccess = (title: string, description?: string) => globalSuccess?.(title, description);
export const showError = (title: string, description?: string) => globalError?.(title, description);
export const showWarning = (title: string, description?: string) => globalWarning?.(title, description);
export const showInfo = (title: string, description?: string) => globalInfo?.(title, description);
export const showToastWithUndo = (options: Parameters<ToastContextType["toastWithUndo"]>[0]) => globalToastWithUndo?.(options);

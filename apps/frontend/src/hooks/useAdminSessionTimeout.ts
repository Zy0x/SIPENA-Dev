import { useEffect, useCallback, useRef, useState } from "react";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_BEFORE = 2 * 60 * 1000; // 2 minutes before timeout

interface UseAdminSessionTimeoutOptions {
  onTimeout: () => void;
  onWarning?: () => void;
  enabled?: boolean;
}

export function useAdminSessionTimeout({
  onTimeout,
  onWarning,
  enabled = true,
}: UseAdminSessionTimeoutOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(Date.now());
  const [timeRemaining, setTimeRemaining] = useState<number>(INACTIVITY_TIMEOUT);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningRef.current) {
      clearTimeout(warningRef.current);
      warningRef.current = null;
    }
  }, []);

  const resetTimer = useCallback(() => {
    if (!enabled) return;

    clearTimers();
    lastResetRef.current = Date.now();
    setTimeRemaining(INACTIVITY_TIMEOUT);

    // Set warning timer (13 minutes)
    if (onWarning) {
      warningRef.current = setTimeout(() => {
        onWarning();
      }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
    }

    // Set timeout timer (15 minutes)
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, INACTIVITY_TIMEOUT);
  }, [enabled, clearTimers, onTimeout, onWarning]);

  // Initial timer setup when enabled
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    resetTimer();

    return () => {
      clearTimers();
    };
  }, [enabled, resetTimer, clearTimers]);

  // Reactive countdown interval
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, INACTIVITY_TIMEOUT - (Date.now() - lastResetRef.current));
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  // Manual session refresh to extend it on backend and database
  const refreshSession = useCallback(async (): Promise<boolean> => {
    const token = localStorage.getItem("admin_session_token");
    if (!token) return false;

    setIsRefreshing(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "refresh", token }),
      });

      if (!response.ok) throw new Error("Failed to refresh session on backend");
      
      const result = await response.json();
      if (result.success && result.token) {
        localStorage.setItem("admin_session_token", result.token);
        // Reset local timer
        resetTimer();
        setIsRefreshing(false);
        return true;
      }
    } catch (error) {
      console.error("[Timeout] Failed to refresh admin session:", error);
    }
    setIsRefreshing(false);
    return false;
  }, [resetTimer]);

  const m = Math.floor(timeRemaining / 60000);
  const s = Math.floor((timeRemaining % 60000) / 1000);
  const formattedTimeRemaining = `${m}m ${String(s).padStart(2, "0")}d`;

  return {
    resetTimer,
    timeRemaining,
    formattedTimeRemaining,
    refreshSession,
    isRefreshing,
  };
}

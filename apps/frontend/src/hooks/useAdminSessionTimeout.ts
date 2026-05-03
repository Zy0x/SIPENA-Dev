import { useEffect, useCallback, useRef } from "react";

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
  const lastActivityRef = useRef<number>(Date.now());

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
    lastActivityRef.current = Date.now();

    // Set warning timer
    if (onWarning) {
      warningRef.current = setTimeout(() => {
        onWarning();
      }, INACTIVITY_TIMEOUT - WARNING_BEFORE);
    }

    // Set timeout timer
    timeoutRef.current = setTimeout(() => {
      onTimeout();
    }, INACTIVITY_TIMEOUT);
  }, [enabled, clearTimers, onTimeout, onWarning]);

  // Setup activity listeners
  useEffect(() => {
    if (!enabled) {
      clearTimers();
      return;
    }

    const activityEvents = [
      "mousedown",
      "mousemove",
      "keydown",
      "scroll",
      "touchstart",
      "click",
    ];

    const handleActivity = () => {
      resetTimer();
    };

    // Initial timer setup
    resetTimer();

    // Add event listeners
    activityEvents.forEach((event) => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearTimers();
      activityEvents.forEach((event) => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [enabled, resetTimer, clearTimers]);

  return {
    resetTimer,
    getTimeRemaining: () => {
      const elapsed = Date.now() - lastActivityRef.current;
      return Math.max(0, INACTIVITY_TIMEOUT - elapsed);
    },
  };
}

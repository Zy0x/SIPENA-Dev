import { useEffect, useCallback, useRef, useState } from "react";

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
  const [timeRemaining, setTimeRemaining] = useState<number>(INACTIVITY_TIMEOUT);

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
    setTimeRemaining(INACTIVITY_TIMEOUT);

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

  // Reactive countdown interval
  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      const remaining = Math.max(0, INACTIVITY_TIMEOUT - (Date.now() - lastActivityRef.current));
      setTimeRemaining(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [enabled]);

  const m = Math.floor(timeRemaining / 60000);
  const s = Math.floor((timeRemaining % 60000) / 1000);
  const formattedTimeRemaining = `${m}m ${String(s).padStart(2, "0")}d`;

  return {
    resetTimer,
    timeRemaining,
    formattedTimeRemaining,
  };
}

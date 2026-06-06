import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { APP_VERSION } from "@/config/version";
import { captureViewportTelemetrySnapshot, type ViewportTelemetrySnapshot } from "@/lib/viewportTelemetry";

const LAST_VIEWPORT_TELEMETRY_KEY = "sipena_viewport_telemetry_last_v1";
const VIEWPORT_TELEMETRY_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000;

interface LastTelemetryState {
  key: string;
  sentAt: number;
}

function readLastTelemetryState(): LastTelemetryState | null {
  try {
    const raw = localStorage.getItem(LAST_VIEWPORT_TELEMETRY_KEY);
    return raw ? (JSON.parse(raw) as LastTelemetryState) : null;
  } catch {
    return null;
  }
}

function writeLastTelemetryState(state: LastTelemetryState) {
  try {
    localStorage.setItem(LAST_VIEWPORT_TELEMETRY_KEY, JSON.stringify(state));
  } catch {
    // Telemetry must never affect the UI.
  }
}

function shouldSendTelemetry(snapshot: ViewportTelemetrySnapshot): boolean {
  const last = readLastTelemetryState();
  if (!last) return true;
  if (last.key !== snapshot.viewport_key) return true;
  return Date.now() - last.sentAt > VIEWPORT_TELEMETRY_MIN_INTERVAL_MS;
}

export function useViewportTelemetry() {
  const { user } = useAuth();
  const location = useLocation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;

    const sendSnapshot = () => {
      if (document.visibilityState === "hidden") return;

      const snapshot = captureViewportTelemetrySnapshot(location.pathname || "/");
      if (snapshot.viewport_width <= 0 || snapshot.viewport_height <= 0) return;
      if (!shouldSendTelemetry(snapshot)) return;

      writeLastTelemetryState({ key: snapshot.viewport_key, sentAt: Date.now() });

      void supabase
        .from("viewport_observations")
        .insert({
          user_id: user.id,
          route_path: snapshot.route_path,
          viewport_profile: snapshot.viewport_profile,
          viewport_width: snapshot.viewport_width,
          viewport_height: snapshot.viewport_height,
          visual_viewport_width: snapshot.visual_viewport_width,
          visual_viewport_height: snapshot.visual_viewport_height,
          visual_viewport_offset_top: snapshot.visual_viewport_offset_top,
          visual_viewport_offset_left: snapshot.visual_viewport_offset_left,
          screen_width: snapshot.screen_width,
          screen_height: snapshot.screen_height,
          screen_avail_width: snapshot.screen_avail_width,
          screen_avail_height: snapshot.screen_avail_height,
          device_pixel_ratio: snapshot.device_pixel_ratio,
          orientation: snapshot.orientation,
          display_mode: snapshot.display_mode,
          touch_points: snapshot.touch_points,
          safe_area_top: snapshot.safe_area_top,
          safe_area_right: snapshot.safe_area_right,
          safe_area_bottom: snapshot.safe_area_bottom,
          safe_area_left: snapshot.safe_area_left,
          has_display_cutout: snapshot.has_display_cutout,
          viewport_key: snapshot.viewport_key,
          metadata: {
            app_version: APP_VERSION,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
          },
        })
        .then(() => undefined, () => undefined);
    };

    const scheduleSnapshot = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(sendSnapshot, 1200);
    };

    scheduleSnapshot();

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", scheduleSnapshot);
    window.addEventListener("orientationchange", scheduleSnapshot);
    window.addEventListener("pageshow", scheduleSnapshot);
    document.addEventListener("visibilitychange", scheduleSnapshot);
    visualViewport?.addEventListener("resize", scheduleSnapshot);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      window.removeEventListener("resize", scheduleSnapshot);
      window.removeEventListener("orientationchange", scheduleSnapshot);
      window.removeEventListener("pageshow", scheduleSnapshot);
      document.removeEventListener("visibilitychange", scheduleSnapshot);
      visualViewport?.removeEventListener("resize", scheduleSnapshot);
    };
  }, [location.pathname, user]);
}

export function ViewportTelemetryReporter() {
  useViewportTelemetry();
  return null;
}

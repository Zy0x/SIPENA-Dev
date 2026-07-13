import { useEffect, useState } from "react";
import {
  applyDevicePerformanceProfile,
  readDevicePerformanceHints,
  resolveDevicePerformanceProfile,
  type DevicePerformanceProfile,
  type NavigatorWithPerformanceHints,
} from "@/lib/devicePerformance";

export function shouldUseLightMotion(): boolean {
  return resolveDevicePerformanceProfile() !== "full";
}

export function useDevicePerformanceProfile(): DevicePerformanceProfile {
  const [profile, setProfile] = useState(() => resolveDevicePerformanceProfile());

  useEffect(() => {
    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const pointerQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    const connection = (navigator as NavigatorWithPerformanceHints).connection;
    const update = () => {
      const nextProfile = resolveDevicePerformanceProfile(readDevicePerformanceHints());
      applyDevicePerformanceProfile(nextProfile);
      setProfile(nextProfile);
    };

    update();
    reducedQuery.addEventListener("change", update);
    pointerQuery.addEventListener("change", update);
    standaloneQuery.addEventListener("change", update);
    connection?.addEventListener?.("change", update);

    return () => {
      reducedQuery.removeEventListener("change", update);
      pointerQuery.removeEventListener("change", update);
      standaloneQuery.removeEventListener("change", update);
      connection?.removeEventListener?.("change", update);
    };
  }, []);

  return profile;
}

export function useAdaptiveMotion(): boolean {
  return useDevicePerformanceProfile() !== "full";
}

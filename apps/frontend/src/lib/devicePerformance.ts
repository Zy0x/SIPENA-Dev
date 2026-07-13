export type DevicePerformanceProfile = "full" | "balanced" | "lite";

export interface DevicePerformanceHints {
  userAgent: string;
  deviceMemory?: number;
  hardwareConcurrency?: number;
  saveData: boolean;
  effectiveType?: string;
  reducedMotion: boolean;
  coarsePointer: boolean;
  standalone: boolean;
}

type NavigatorWithPerformanceHints = Navigator & {
  connection?: {
    saveData?: boolean;
    effectiveType?: string;
    addEventListener?: (type: "change", listener: () => void) => void;
    removeEventListener?: (type: "change", listener: () => void) => void;
  };
  deviceMemory?: number;
};

export function readDevicePerformanceHints(): DevicePerformanceHints {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return {
      userAgent: "",
      saveData: false,
      reducedMotion: false,
      coarsePointer: false,
      standalone: false,
    };
  }

  const nav = navigator as NavigatorWithPerformanceHints;
  return {
    userAgent: nav.userAgent || "",
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
    saveData: nav.connection?.saveData === true,
    effectiveType: nav.connection?.effectiveType,
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    coarsePointer: window.matchMedia("(hover: none), (pointer: coarse)").matches,
    standalone: window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function resolveDevicePerformanceProfile(
  hints: DevicePerformanceHints = readDevicePerformanceHints(),
): DevicePerformanceProfile {
  const slowConnection = hints.effectiveType === "slow-2g" || hints.effectiveType === "2g";
  const lowMemory = typeof hints.deviceMemory === "number" && hints.deviceMemory <= 4;
  const lowCpu = typeof hints.hardwareConcurrency === "number" && hints.hardwareConcurrency <= 4;
  const android = /android/i.test(hints.userAgent);

  if (
    android
    || hints.reducedMotion
    || hints.saveData
    || slowConnection
    || lowMemory
    || lowCpu
  ) {
    return "lite";
  }

  if (hints.coarsePointer || hints.standalone) {
    return "balanced";
  }

  return "full";
}

export function applyDevicePerformanceProfile(profile = resolveDevicePerformanceProfile()): DevicePerformanceProfile {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.performanceProfile = profile;
    document.documentElement.dataset.motionProfile = profile === "full" ? "full" : "light";
  }
  return profile;
}

export function getAppliedDevicePerformanceProfile(): DevicePerformanceProfile {
  if (typeof document === "undefined") return "full";
  const profile = document.documentElement.dataset.performanceProfile;
  return profile === "lite" || profile === "balanced" ? profile : "full";
}

export function shouldLoadAnimatedAssets(): boolean {
  return getAppliedDevicePerformanceProfile() === "full";
}

export type { NavigatorWithPerformanceHints };

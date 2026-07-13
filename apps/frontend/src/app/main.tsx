import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "../index.css";
import { initInputModality } from "../lib/inputModality";
import { applyDevicePerformanceProfile } from "../lib/devicePerformance";
import { createPwaUpdateScheduler } from "../lib/pwaUpdateScheduler";

declare global {
  interface Window {
    __sipenaPwaNeedsUpdate?: boolean;
    __sipenaPwaUpdate?: ((reloadPage?: boolean) => Promise<void>) | null;
    __sipenaPwaTargetVersion?: string | null;
  }
}

// Resolve the Android/low-end profile before components can request heavy assets.
applyDevicePerformanceProfile();
initInputModality();
// Initialize theme before render to prevent flash - Default to LIGHT mode
const initializeTheme = () => {
  const savedTheme = localStorage.getItem("theme");
  
  // Only apply dark mode if explicitly saved as dark
  if (savedTheme === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
};

const notifyPwaState = (detail: { needsUpdate?: boolean; offlineReady?: boolean }) => {
  window.dispatchEvent(new CustomEvent("sipena:pwa-state", { detail }));
};

const notifyPwaUpdateTarget = (targetVersion: string | null, source: string) => {
  if (!targetVersion || targetVersion === __APP_BUILD_VERSION__) return;
  window.__sipenaPwaTargetVersion = targetVersion;
  window.dispatchEvent(new CustomEvent("sipena:pwa-update-target", {
    detail: { targetVersion, source },
  }));
};

const fetchLatestBuildVersion = async (): Promise<string | null> => {
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { version?: unknown };
    return typeof payload.version === "string" ? payload.version : null;
  } catch {
    return null;
  }
};

const initializePWA = () => {
  if (!("serviceWorker" in navigator)) return;



  const updateServiceWorker = registerSW({
    immediate: false,
    onNeedRefresh() {
      window.__sipenaPwaNeedsUpdate = true;
      notifyPwaState({ needsUpdate: true });
      void fetchLatestBuildVersion().then((version) => notifyPwaUpdateTarget(version, "service-worker"));
    },
    onOfflineReady() {
      notifyPwaState({ offlineReady: true });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      const scheduler = createPwaUpdateScheduler({
        check: async () => {
          await registration.update().catch(() => undefined);
          const version = await fetchLatestBuildVersion();
          notifyPwaUpdateTarget(version, "scheduler");
        },
      });
      scheduler.start();
    },
    onRegisterError(error) {
      console.log("[PWA] Service Worker registration failed:", error);
    },
  });

  window.__sipenaPwaUpdate = async (reloadPage = true) => {
    await updateServiceWorker(reloadPage);
  };
};

initializeTheme();
initializePWA();

createRoot(document.getElementById("root")!).render(<App />);

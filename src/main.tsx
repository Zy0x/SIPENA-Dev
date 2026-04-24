import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { initGSAPReducedMotion } from "./hooks/useReducedMotion";

declare global {
  interface Window {
    __sipenaPwaNeedsUpdate?: boolean;
    __sipenaPwaUpdate?: ((reloadPage?: boolean) => Promise<void>) | null;
  }
}

// Initialize GSAP reduced motion before render
initGSAPReducedMotion();
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

const initializePWA = () => {
  if (!("serviceWorker" in navigator)) return;

  // Cleanup any old manually-registered /sw.js (legacy from index.html) so the
  // vite-plugin-pwa virtual SW becomes the single source of truth. Without this
  // cleanup, browsers with old caches keep serving stale content and never
  // surface the update banner.
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((reg) => {
      if (reg.active?.scriptURL && reg.active.scriptURL.endsWith("/sw.js")) {
        reg.unregister().catch(() => undefined);
      }
    });
  }).catch(() => undefined);

  const updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      window.__sipenaPwaNeedsUpdate = true;
      notifyPwaState({ needsUpdate: true });
    },
    onOfflineReady() {
      notifyPwaState({ offlineReady: true });
    },
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registration.update().catch(() => undefined);
      // Aggressive update polling: every 30s + on tab focus + on online event.
      // This ensures the update banner appears quickly even when the browser
      // is heavily cached, eliminating the need for incognito mode.
      const poll = () => registration.update().catch(() => undefined);
      setInterval(poll, 60_000);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") poll();
      });
      window.addEventListener("online", poll);
      window.addEventListener("focus", poll);
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

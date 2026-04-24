import { useEffect, useCallback, useRef } from "react";
import { SUPABASE_EXTERNAL_PROJECT_ID } from "@/lib/supabase-external";

declare global {
  interface Window {
    grecaptcha: {
      ready: (callback: () => void) => void;
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
    };
  }
}

const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY || "";
// IS_PRODUCTION: true hanya jika build production DAN bukan dev mode eksplisit
// Pastikan VITE_DEV_MODE=true ada di .env.development dan .env.staging
const IS_PRODUCTION = import.meta.env.PROD === true && import.meta.env.VITE_DEV_MODE !== "true";

const EDGE_FUNCTIONS_BASE = `https://${SUPABASE_EXTERNAL_PROJECT_ID}.supabase.co/functions/v1`;

export function useReCaptcha() {
  const isLoaded = useRef(false);

  useEffect(() => {
    if (!RECAPTCHA_SITE_KEY || isLoaded.current) return;

    if (document.querySelector('script[src*="recaptcha"]')) {
      isLoaded.current = true;
      return;
    }

    const script = document.createElement("script");
    script.src = `https://www.google.com/recaptcha/api.js?render=${RECAPTCHA_SITE_KEY}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
    isLoaded.current = true;
  }, []);

  /**
   * Tunggu hingga grecaptcha object tersedia di window.
   * Polling dengan timeout 10 detik — mencegah race condition saat
   * script belum selesai load ketika user langsung klik submit.
   */
  const waitForGrecaptcha = useCallback((): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.grecaptcha) {
        resolve(true);
        return;
      }

      const maxWait = 10_000; // 10 detik
      const interval = 100;  // cek setiap 100ms
      let elapsed = 0;

      const timer = setInterval(() => {
        elapsed += interval;
        if (window.grecaptcha) {
          clearInterval(timer);
          resolve(true);
        } else if (elapsed >= maxWait) {
          clearInterval(timer);
          console.warn("reCAPTCHA: waitForGrecaptcha timeout setelah 10 detik");
          resolve(false);
        }
      }, interval);
    });
  }, []);

  /**
   * Eksekusi reCAPTCHA v3 dan dapatkan token.
   * Menunggu script siap sebelum execute (fix race condition).
   */
  const executeRecaptcha = useCallback(
    async (action: string = "submit"): Promise<string | null> => {
      if (!RECAPTCHA_SITE_KEY) return null;

      const isReady = await waitForGrecaptcha();
      if (!isReady) {
        console.warn("reCAPTCHA: script tidak tersedia, melewati verifikasi");
        return null;
      }

      return new Promise((resolve) => {
        window.grecaptcha.ready(async () => {
          try {
            const token = await window.grecaptcha.execute(RECAPTCHA_SITE_KEY, {
              action,
            });
            resolve(token);
          } catch (error) {
            console.error("reCAPTCHA execute error:", error);
            resolve(null);
          }
        });
      });
    },
    [waitForGrecaptcha]
  );

  /**
   * Verifikasi token reCAPTCHA via Edge Function (server-side).
   * Returns true jika valid, false jika skor terlalu rendah.
   * Graceful degradation: return true jika server error agar user tidak terblokir.
   */
  const verifyRecaptcha = useCallback(
    async (token: string, action: string = "submit"): Promise<boolean> => {
      if (!RECAPTCHA_SITE_KEY || !token) return true;

      try {
        const response = await fetch(`${EDGE_FUNCTIONS_BASE}/verify-recaptcha`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action }),
        });

        const data = await response.json();
        return data.success === true;
      } catch (error) {
        console.error("reCAPTCHA server verify error:", error);
        return true; // graceful — jangan blokir user jika server error
      }
    },
    []
  );

  /**
   * Jalankan reCAPTCHA + verifikasi server dalam satu panggilan.
   *
   * Return true (allow) jika:
   * - RECAPTCHA_SITE_KEY tidak dikonfigurasi
   * - Script gagal load / timeout (graceful degradation)
   * - Server verify error (graceful degradation)
   *
   * Return false hanya jika skor Google < threshold (bot terdeteksi).
   */
  const executeAndVerify = useCallback(
    async (action: string = "submit"): Promise<boolean> => {
      if (!RECAPTCHA_SITE_KEY) return true;

      // Di environment non-production (localhost, preview, staging),
      // Google reCAPTCHA v3 secara konsisten memberi score rendah (0.0–0.1)
      // karena traffic dianggap tidak organik. Skip server verification.
      if (!IS_PRODUCTION) {
        console.info("reCAPTCHA: non-production env, melewati server verification");
        return true;
      }

      const token = await executeRecaptcha(action);
      if (!token) {
        console.warn("reCAPTCHA: token null, melewati server verification");
        return true; // graceful degradation
      }

      return verifyRecaptcha(token, action);
    },
    [executeRecaptcha, verifyRecaptcha]
  );

  return {
    executeRecaptcha,
    verifyRecaptcha,
    executeAndVerify,
    isConfigured: !!RECAPTCHA_SITE_KEY,
  };
}

/** Sembunyikan badge reCAPTCHA v3 (Google mewajibkan disclosure sebagai gantinya) */
export function ReCaptchaBadgeHider() {
  useEffect(() => {
    const style = document.createElement("style");
    style.innerHTML = `.grecaptcha-badge { visibility: hidden !important; }`;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) document.head.removeChild(style);
    };
  }, []);
  return null;
}

/** Disclosure text wajib Google untuk reCAPTCHA v3 */
export function ReCaptchaDisclosure() {
  if (!RECAPTCHA_SITE_KEY) return null;
  return (
    <p className="text-xs text-white/30 text-center mt-3">
      Dilindungi reCAPTCHA &middot;{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white/50 underline transition-colors"
      >
        Privasi
      </a>{" "}
      &amp;{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="hover:text-white/50 underline transition-colors"
      >
        Ketentuan
      </a>
    </p>
  );
}
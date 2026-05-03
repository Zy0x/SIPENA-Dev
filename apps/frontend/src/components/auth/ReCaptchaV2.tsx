import { useEffect, useRef, useCallback, useState } from "react";
import { SUPABASE_EXTERNAL_PROJECT_ID } from "@/core/repositories/supabase-compat.repository";

// Use window as any to avoid type conflicts with v3 declaration
const getGrecaptcha = (): any => (window as any).grecaptcha;

const RECAPTCHA_V2_SITE_KEY = import.meta.env.VITE_RECAPTCHA_V2_SITE_KEY || "";
const EDGE_FUNCTIONS_BASE = `https://${SUPABASE_EXTERNAL_PROJECT_ID}.supabase.co/functions/v1`;

interface ReCaptchaV2Props {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
}

export function ReCaptchaV2Widget({ onVerify, onExpire, onError }: ReCaptchaV2Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const renderAttemptedRef = useRef(false);

  useEffect(() => {
    if (!RECAPTCHA_V2_SITE_KEY) return;

    // Reset on re-mount
    renderAttemptedRef.current = false;
    widgetIdRef.current = null;

    const renderWidget = () => {
      const gc = getGrecaptcha();
      if (!containerRef.current || widgetIdRef.current !== null || !gc?.render || renderAttemptedRef.current) return;
      
      renderAttemptedRef.current = true;
      
      try {
        widgetIdRef.current = gc.render(containerRef.current, {
          sitekey: RECAPTCHA_V2_SITE_KEY,
          callback: onVerify,
          "expired-callback": onExpire,
          "error-callback": onError,
          theme: "dark",
          size: "normal",
        });
      } catch (e) {
        console.error("[reCAPTCHA-v2] Render error:", e);
        renderAttemptedRef.current = false;
      }
    };

    // v3 script may already be loaded — grecaptcha.render is available from the v3 script too
    // Poll until grecaptcha.render is available (v3 script loads it)
    const pollTimer = setInterval(() => {
      const gc = getGrecaptcha();
      if (gc?.render) {
        clearInterval(pollTimer);
        renderWidget();
      }
    }, 200);

    // Timeout after 15 seconds — if no grecaptcha available, try loading v2 explicit script
    const loadTimeout = setTimeout(() => {
      clearInterval(pollTimer);
      if (widgetIdRef.current !== null) return; // Already rendered
      
      // Load v2 explicit script as fallback if v3 script didn't provide grecaptcha
      const existingScript = document.querySelector('script[src*="recaptcha/api.js"]');
      if (existingScript && !getGrecaptcha()?.render) {
        // Script exists but render not available — wait more
        const retryTimer = setInterval(() => {
          if (getGrecaptcha()?.render) {
            clearInterval(retryTimer);
            renderWidget();
          }
        }, 300);
        setTimeout(() => clearInterval(retryTimer), 10000);
        return;
      }
      
      if (!existingScript) {
        (window as any).onRecaptchaV2Load = renderWidget;
        const script = document.createElement("script");
        script.src = `https://www.google.com/recaptcha/api.js?onload=onRecaptchaV2Load&render=explicit`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
    }, 3000);

    return () => {
      clearInterval(pollTimer);
      clearTimeout(loadTimeout);
      if (widgetIdRef.current !== null) {
        try { getGrecaptcha()?.reset(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
      renderAttemptedRef.current = false;
    };
  }, [onVerify, onExpire, onError]);

  if (!RECAPTCHA_V2_SITE_KEY) return null;

  return (
    <div className="flex justify-center my-2">
      <div ref={containerRef} />
    </div>
  );
}

export function useReCaptchaV2() {
  const [token, setToken] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);

  const onVerify = useCallback((captchaToken: string) => {
    setToken(captchaToken);
    setVerified(true);
  }, []);

  const onExpire = useCallback(() => {
    setToken(null);
    setVerified(false);
  }, []);

  const onError = useCallback(() => {
    setToken(null);
    setVerified(false);
  }, []);

  const verifyOnServer = useCallback(async (): Promise<boolean> => {
    if (!token) return false;
    
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_BASE}/verify-recaptcha-v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error("[reCAPTCHA-v2] Server verify error:", error);
      return true;
    }
  }, [token]);

  const reset = useCallback(() => {
    setToken(null);
    setVerified(false);
    try { getGrecaptcha()?.reset(); } catch {}
  }, []);

  return {
    token,
    verified,
    onVerify,
    onExpire,
    onError,
    verifyOnServer,
    reset,
    isConfigured: !!RECAPTCHA_V2_SITE_KEY,
  };
}

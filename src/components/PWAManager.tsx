/**
 * PWAManager.tsx — SIPENA
 *
 * Update detection via dual strategy:
 * 1. HTTP polling /version.json (reliable for ALL browsers, PWA or not)
 * 2. Service Worker updatefound / needsUpdate event (PWA-specific)
 *
 * The HTTP approach is the primary signal — it works even in regular browser
 * tabs where SW events don't fire reliably.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import gsap from 'gsap';
import { Shield, Download, X, RefreshCw, WifiOff, Share, Plus, Monitor, CheckCircle, Info } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

// ─── Version polling ───────────────────────────────────────────────────────────
const VERSION_URL = "/version.json";
// Poll every 90s in background; also triggered on focus/visibility/online
const POLL_INTERVAL_MS = 90_000;
let _seenVersion: string | null = null;

async function fetchCurrentVersion(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

// ─── iOS Guide ────────────────────────────────────────────────────────────────
function IOSGuide({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current)
      gsap.fromTo(ref.current, { opacity: 0, y: 60 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.7)' });
  }, []);

  const close = () => {
    if (ref.current)
      gsap.to(ref.current, { opacity: 0, y: 40, duration: 0.25, ease: 'power2.in', onComplete: onClose });
    else onClose();
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div ref={ref} className="w-full max-w-sm bg-card rounded-3xl border border-border shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow shadow-primary/30">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <p className="font-bold text-sm text-foreground">Install SIPENA</p>
              <p className="text-xs text-muted-foreground">iOS — ikuti langkah berikut</p>
            </div>
          </div>
          <button onClick={close} className="p-1.5 rounded-full hover:bg-muted">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-2.5">
          {[
            { icon: <Share className="w-4 h-4" />, title: 'Tap ikon Share', desc: 'Kotak dengan panah ↑ di bagian bawah Safari', color: 'bg-blue-500/15 text-blue-500' },
            { icon: <Plus className="w-4 h-4" />, title: '"Add to Home Screen"', desc: 'Scroll ke bawah, pilih "Tambahkan ke Layar Utama"', color: 'bg-green-500/15 text-green-600' },
            { icon: <CheckCircle className="w-4 h-4" />, title: 'Tap "Tambah"', desc: 'Pojok kanan atas untuk menyelesaikan instalasi', color: 'bg-primary/15 text-primary' },
          ].map((s, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/30 border border-border/50">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${s.color}`}>{s.icon}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 pb-5">
          <p className="text-[11px] text-muted-foreground text-center mb-3">Gunakan <strong>Safari</strong>, bukan Chrome/Firefox di iOS</p>
          <button onClick={close} className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all">
            Mengerti
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Desktop Info ─────────────────────────────────────────────────────────────
function DesktopInfo({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, scale: 0.95 }, { opacity: 1, scale: 1, duration: 0.3, ease: 'back.out(1.7)' });
  }, []);
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div ref={ref} className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center"><Info className="w-4 h-4 text-blue-500" /></div>
            <p className="font-bold text-sm">Cara Install SIPENA</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
          Browser ini tidak mendukung instalasi otomatis. Gunakan <strong>Chrome</strong> atau <strong>Edge</strong> untuk install SIPENA sebagai app.
        </p>
        <button onClick={onClose} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition-all">
          Mengerti
        </button>
      </div>
    </div>
  );
}

// ─── Install Banner ───────────────────────────────────────────────────────────
interface BannerProps {
  onInstall: () => void;
  onDismiss: () => void;
  isIOS: boolean;
  isDesktop: boolean;
  hasNativePrompt: boolean;
}

function InstallBanner({ onInstall, onDismiss, isIOS, isDesktop, hasNativePrompt }: BannerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current,
      { opacity: 0, y: isDesktop ? -80 : 80, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)', delay: 0.5 }
    );
  }, [isDesktop]);

  const dismiss = () => {
    if (!ref.current) { onDismiss(); return; }
    gsap.to(ref.current, {
      opacity: 0, y: isDesktop ? -60 : 60, scale: 0.96, duration: 0.3,
      ease: 'power2.in', onComplete: onDismiss,
    });
  };

  const label = isIOS ? 'Cara Install' : !hasNativePrompt ? 'Panduan Install' : 'Install Sekarang';
  const desc  = isIOS ? 'Safari → Share → Add to Home Screen'
              : !hasNativePrompt ? 'Gunakan Chrome/Edge untuk install'
              : 'Akses cepat · Offline · Notifikasi real-time';
  const pills = isIOS
    ? ['📱 Tampilan penuh', '⚡ Akses cepat']
    : ['⚡ Lebih cepat', '📱 Fullscreen', '🔔 Notifikasi'];

  return (
    <div ref={ref} className={`fixed z-[100] ${isDesktop ? 'top-4 right-4 max-w-sm' : 'bottom-4 left-4 right-4 max-w-sm mx-auto'}`}>
      <div className="relative bg-card border border-border/80 rounded-3xl shadow-2xl overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40" />
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center shadow shadow-primary/25 shrink-0">
              {isDesktop ? <Monitor className="w-5 h-5 text-primary-foreground" /> : <Shield className="w-5 h-5 text-primary-foreground" />}
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between">
                <p className="font-bold text-sm text-foreground">Install SIPENA</p>
                <button onClick={dismiss} className="p-1 rounded-full hover:bg-muted/60 ml-1">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
            </div>
          </div>
          <div className="flex gap-1.5 mb-3 flex-wrap">
            {pills.map((p, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground font-medium border border-border/40">{p}</span>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={onInstall} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 active:scale-[0.97] transition-all">
              <Download className="w-4 h-4" />{label}
            </button>
            <button onClick={dismiss} className="px-4 py-2.5 rounded-2xl bg-muted text-muted-foreground text-sm font-medium hover:bg-accent transition-all">
              Nanti
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Update Banner ────────────────────────────────────────────────────────────
function UpdateBanner({ onUpdate, onDismiss }: { onUpdate: () => void; onDismiss: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' });
  }, []);
  return (
    <div
      ref={ref}
      className="fixed top-4 left-4 right-4 z-[999990] max-w-sm mx-auto"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="bg-card border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
          <RefreshCw className="w-4 h-4 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">Pembaruan tersedia</p>
          <p className="text-[10px] text-muted-foreground">Versi terbaru SIPENA siap digunakan</p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(); }}
            className="px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-all"
            style={{ pointerEvents: 'auto' }}
          >
            Update
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDismiss(); }} className="p-1 hover:bg-muted rounded-lg" style={{ pointerEvents: 'auto' }}>
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Offline Indicator ────────────────────────────────────────────────────────
function OfflineIndicator() {
  return (
    <div className="fixed top-0 inset-x-0 z-[150] flex justify-center pointer-events-none">
      <div className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full bg-foreground/90 backdrop-blur-sm text-background text-xs font-semibold shadow-lg">
        <WifiOff className="w-3.5 h-3.5" />Mode Offline — Data tersimpan lokal
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PWAManager() {
  const pwa = usePWA();
  const [showIOSGuide,    setShowIOSGuide]    = useState(false);
  const [showDesktopInfo, setShowDesktopInfo] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const dismissedRef = useRef(false);

  const triggerUpdate = useCallback(() => {
    if (!dismissedRef.current) setShowUpdateBanner(true);
  }, []);

  // Primary: react to usePWA hook's needsUpdate state (SW updatefound event)
  useEffect(() => {
    if (pwa.needsUpdate) triggerUpdate();
  }, [pwa.needsUpdate, triggerUpdate]);

  // Primary 2: HTTP polling /version.json — works for ALL browsers including
  // regular tabs, non-PWA contexts, and browsers with aggressive SW caching.
  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      if (cancelled || dismissedRef.current) return;
      const v = await fetchCurrentVersion();
      if (cancelled || dismissedRef.current || !v) return;

      if (_seenVersion === null) {
        // First load — record current version, don't show update
        _seenVersion = v;
        return;
      }
      if (v !== _seenVersion) {
        // Version changed since app loaded → show update banner
        triggerUpdate();
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    const onOnline  = () => check();
    const onFocus   = () => check();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
    };
  }, [triggerUpdate]);

  // Fallback: also check SW registration directly (belt-and-suspenders)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const checkSW = async () => {
      if (dismissedRef.current) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) { triggerUpdate(); return; }
        await reg?.update();
      } catch { /* ignore */ }
    };

    const interval = setInterval(checkSW, 120_000); // every 2 min (light)
    return () => clearInterval(interval);
  }, [triggerUpdate]);

  const handleUpdate = useCallback(() => {
    dismissedRef.current = true;
    setShowUpdateBanner(false);
    pwa.applyUpdate();
  }, [pwa]);

  const handleDismissUpdate = useCallback(() => {
    dismissedRef.current = true;
    setShowUpdateBanner(false);
  }, []);

  const handleInstall = useCallback(() => {
    if (pwa.isIOS) {
      setShowIOSGuide(true);
    } else if (!pwa.hasNativePrompt) {
      setShowDesktopInfo(true);
    } else {
      pwa.promptInstall();
    }
  }, [pwa]);

  return (
    <>
      {!pwa.isOnline && <OfflineIndicator />}

      {pwa.showBanner && (
        <InstallBanner
          onInstall={handleInstall}
          onDismiss={pwa.dismissBanner}
          isIOS={pwa.isIOS}
          isDesktop={!('ontouchstart' in window)}
          hasNativePrompt={pwa.hasNativePrompt}
        />
      )}

      {showUpdateBanner && (
        <UpdateBanner
          onUpdate={handleUpdate}
          onDismiss={handleDismissUpdate}
        />
      )}

      {showIOSGuide && (
        <IOSGuide onClose={() => { setShowIOSGuide(false); pwa.dismissBanner(); }} />
      )}

      {showDesktopInfo && (
        <DesktopInfo onClose={() => { setShowDesktopInfo(false); pwa.dismissBanner(); }} />
      )}
    </>
  );
}

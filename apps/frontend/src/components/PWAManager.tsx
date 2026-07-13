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
// Poll every 45s in background; also triggered on focus/visibility/pageshow/online
const POLL_INTERVAL_MS = 45_000;
const RESUME_RECHECK_DELAY_MS = 1800;
const UPDATE_AUTO_APPLY_SECONDS = 10;
const UPDATE_WAIT_MS = 2 * 60_000;
const UPDATE_HARD_RELOAD_MS = 12_000;
const UPDATE_RESOLVED_RELOAD_MS = 700;
const UPDATE_LOCK_KEY = "sipena_pwa_update_lock_v1";
const UPDATE_LOCK_MAX_AGE_MS = 10 * 60_000;
const UPDATE_MAX_AUTO_ATTEMPTS = 2;
const UPDATE_RESUME_APPLY_DELAY_MS = 900;
let versionCheckPromise: Promise<string | null> | null = null;
let lastVersionCheckAt = 0;
let lastVersionValue: string | null = null;

type PwaUpdateStatus = "available" | "applying" | "stalled";

interface PwaUpdateLock {
  targetVersion: string;
  startedAt: number;
  attempt: number;
  status: "pending" | "applying" | "stalled";
  source: string;
}

function isDevelopmentBuild(): boolean {
  return import.meta.env.DEV;
}

function debugPwaUpdate(message: string, data?: Record<string, unknown>) {
  if (!isDevelopmentBuild()) return;
  console.debug(`[PWA update] ${message}`, data ?? {});
}

function readUpdateLock(): PwaUpdateLock | null {
  try {
    const raw = localStorage.getItem(UPDATE_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PwaUpdateLock>;
    if (
      typeof parsed.targetVersion !== "string" ||
      typeof parsed.startedAt !== "number" ||
      typeof parsed.attempt !== "number" ||
      typeof parsed.source !== "string"
    ) {
      return null;
    }
    if (Date.now() - parsed.startedAt > UPDATE_LOCK_MAX_AGE_MS) {
      localStorage.removeItem(UPDATE_LOCK_KEY);
      return null;
    }
    return {
      targetVersion: parsed.targetVersion,
      startedAt: parsed.startedAt,
      attempt: parsed.attempt,
      status: parsed.status === "stalled" || parsed.status === "pending" ? parsed.status : "applying",
      source: parsed.source,
    };
  } catch {
    return null;
  }
}

function writeUpdateLock(lock: PwaUpdateLock) {
  try {
    localStorage.setItem(UPDATE_LOCK_KEY, JSON.stringify(lock));
  } catch {
    // Storage may be unavailable in hardened/private browsers. The in-memory
    // state still prevents duplicate banners in the current page lifetime.
  }
}

function clearUpdateLock() {
  try {
    localStorage.removeItem(UPDATE_LOCK_KEY);
  } catch {
    // ignore
  }
}

async function fetchCurrentVersion(): Promise<string | null> {
  if (versionCheckPromise) return versionCheckPromise;
  if (Date.now() - lastVersionCheckAt < 5_000) return lastVersionValue;

  versionCheckPromise = (async () => {
    try {
      const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      lastVersionValue = typeof data?.version === "string" ? data.version : null;
      lastVersionCheckAt = Date.now();
      return lastVersionValue;
    } catch {
      return null;
    } finally {
      versionCheckPromise = null;
    }
  })();

  return versionCheckPromise;
}

function scheduleFollowUpCheck(check: () => void) {
  const timer = window.setTimeout(() => check(), RESUME_RECHECK_DELAY_MS);
  return () => window.clearTimeout(timer);
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
function UpdateBanner({
  onUpdate,
  onWait,
  status,
  countdown,
}: {
  onUpdate: () => void;
  onWait: () => void;
  status: PwaUpdateStatus;
  countdown: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) gsap.fromTo(ref.current, { opacity: 0, y: -60 }, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(1.4)' });
  }, []);

  const isApplying = status === "applying";
  const isStalled = status === "stalled";

  return (
    <div
      ref={ref}
      className="fixed left-3 right-3 top-4 z-[999990] mx-auto w-auto max-w-xl sm:left-4 sm:right-4"
      style={{ pointerEvents: 'auto' }}
    >
      <div
        className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-xl sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:px-5"
        style={{ pointerEvents: 'auto' }}
        aria-live="polite"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isApplying ? 'bg-primary/15' : isStalled ? 'bg-amber-500/15' : 'bg-blue-500/15'}`}>
          <RefreshCw className={`w-4 h-4 ${isApplying ? 'text-primary animate-spin' : isStalled ? 'text-amber-600' : 'text-blue-500'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">
            {isApplying ? 'Menerapkan pembaruan...' : isStalled ? 'Update belum selesai' : 'Pembaruan tersedia'}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {isApplying
              ? 'Browser sedang mengaktifkan versi terbaru. Mohon tunggu sebentar.'
              : isStalled
                ? 'Browser masih memuat versi lama. Muat ulang sekali lagi untuk menyelesaikan update.'
                : `Otomatis diterapkan dalam ${Math.max(0, countdown)} detik. Simpan pekerjaan dulu jika perlu.`}
          </p>
        </div>
        <div className="col-span-2 flex min-w-0 items-center justify-end gap-2 sm:col-span-1 sm:shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onUpdate(); }}
            disabled={isApplying}
            className={`min-h-9 min-w-0 flex-1 rounded-xl px-3 py-2 text-xs font-bold transition-all sm:flex-none sm:whitespace-nowrap ${
              isApplying
                ? 'bg-primary/80 text-primary-foreground cursor-wait'
                : 'bg-primary text-primary-foreground hover:opacity-90'
            }`}
            style={{ pointerEvents: 'auto' }}
          >
            {isApplying ? 'Memperbarui...' : isStalled ? 'Muat ulang lagi' : 'Update sekarang'}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onWait(); }}
            disabled={isApplying}
            className={`min-h-9 rounded-xl px-3 py-2 text-xs font-semibold sm:whitespace-nowrap ${isApplying ? 'opacity-40 cursor-not-allowed' : 'bg-muted text-muted-foreground hover:bg-accent'}`}
            style={{ pointerEvents: 'auto' }}
          >
            Tunggu
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
  const { applyUpdate } = pwa;
  const [showIOSGuide,    setShowIOSGuide]    = useState(false);
  const [showDesktopInfo, setShowDesktopInfo] = useState(false);
  const [showUpdateBanner, setShowUpdateBanner] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<PwaUpdateStatus>("available");
  const [updateCountdown, setUpdateCountdown] = useState(UPDATE_AUTO_APPLY_SECONDS);
  const dismissedRef = useRef(false);
  const waitUntilRef = useRef(0);
  const waitTargetRef = useRef<string | null>(null);
  const updateTargetVersionRef = useRef<string | null>(null);
  const updateBannerVisibleRef = useRef(false);
  const isUpdatingRef = useRef(false);

  useEffect(() => {
    updateBannerVisibleRef.current = showUpdateBanner;
  }, [showUpdateBanner]);

  useEffect(() => {
    isUpdatingRef.current = isUpdating;
  }, [isUpdating]);

  const requestUpdate = useCallback((targetVersion: string | null, source: string) => {
    if (!targetVersion) return;
    if (targetVersion === __APP_BUILD_VERSION__) {
      clearUpdateLock();
      return;
    }

    const currentLock = readUpdateLock();
    if (
      currentLock?.targetVersion === targetVersion &&
      (currentLock.status === "applying" || currentLock.status === "stalled")
    ) {
      updateTargetVersionRef.current = targetVersion;
      setUpdateStatus(currentLock.status === "stalled" ? "stalled" : "applying");
      setIsUpdating(currentLock.status !== "stalled");
      setShowUpdateBanner(true);
      updateBannerVisibleRef.current = true;
      debugPwaUpdate("reuse active lock", { source, targetVersion, status: currentLock.status });
      return;
    }

    if (waitTargetRef.current === targetVersion && Date.now() < waitUntilRef.current) return;
    if (updateTargetVersionRef.current === targetVersion && (updateBannerVisibleRef.current || isUpdatingRef.current)) return;

    dismissedRef.current = false;
    updateTargetVersionRef.current = targetVersion;
    setUpdateStatus("available");
    setUpdateCountdown(UPDATE_AUTO_APPLY_SECONDS);
    setShowUpdateBanner(true);
    updateBannerVisibleRef.current = true;
    debugPwaUpdate("update requested", { source, currentVersion: __APP_BUILD_VERSION__, targetVersion });
  }, []);

  const handleUpdate = useCallback(async () => {
    if (isUpdating) return;
    const targetVersion = updateTargetVersionRef.current ?? await fetchCurrentVersion();
    if (!targetVersion || targetVersion === __APP_BUILD_VERSION__) {
      clearUpdateLock();
      setShowUpdateBanner(false);
      updateBannerVisibleRef.current = false;
      setIsUpdating(false);
      setUpdateStatus("available");
      return;
    }

    const existingLock = readUpdateLock();
    const nextAttempt = existingLock?.targetVersion === targetVersion ? existingLock.attempt + 1 : 1;
    const startedAt = existingLock?.targetVersion === targetVersion ? existingLock.startedAt : Date.now();
    writeUpdateLock({
      targetVersion,
      startedAt,
      attempt: nextAttempt,
      status: "applying",
      source: existingLock?.source ?? "manual",
    });

    dismissedRef.current = true;
    setShowUpdateBanner(true);
    updateBannerVisibleRef.current = true;
    setUpdateStatus("applying");
    setIsUpdating(true);
    isUpdatingRef.current = true;
    debugPwaUpdate("apply start", { currentVersion: __APP_BUILD_VERSION__, targetVersion, attempt: nextAttempt });

    const forceReload = () => {
      debugPwaUpdate("reload", { targetVersion, attempt: nextAttempt });
      window.location.reload();
    };

    window.setTimeout(forceReload, UPDATE_HARD_RELOAD_MS);

    try {
      await applyUpdate();
      window.setTimeout(forceReload, UPDATE_RESOLVED_RELOAD_MS);
    } catch (error) {
      console.warn('[PWA] applyUpdate failed, forcing reload:', error);
      forceReload();
    }
  }, [applyUpdate, isUpdating]);

  useEffect(() => {
    const lock = readUpdateLock();
    if (!lock) return;

    if (lock.targetVersion === __APP_BUILD_VERSION__) {
      debugPwaUpdate("target version reached", { targetVersion: lock.targetVersion });
      clearUpdateLock();
      return;
    }

    updateTargetVersionRef.current = lock.targetVersion;
    setShowUpdateBanner(true);
    updateBannerVisibleRef.current = true;

    if (lock.attempt >= UPDATE_MAX_AUTO_ATTEMPTS || lock.status === "stalled") {
      writeUpdateLock({ ...lock, status: "stalled" });
      setUpdateStatus("stalled");
      setIsUpdating(false);
      isUpdatingRef.current = false;
      debugPwaUpdate("update stalled", {
        currentVersion: __APP_BUILD_VERSION__,
        targetVersion: lock.targetVersion,
        attempt: lock.attempt,
      });
      return;
    }

    setUpdateStatus("applying");
    setIsUpdating(true);
    isUpdatingRef.current = true;
    const timer = window.setTimeout(() => {
      void handleUpdate();
    }, UPDATE_RESUME_APPLY_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [handleUpdate]);

  useEffect(() => {
    if (!showUpdateBanner || isUpdating || updateStatus !== "available") return;
    setUpdateCountdown(UPDATE_AUTO_APPLY_SECONDS);

    const interval = window.setInterval(() => {
      setUpdateCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(interval);
          void handleUpdate();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [handleUpdate, isUpdating, showUpdateBanner, updateStatus]);

  // Primary: react to usePWA hook's needsUpdate state (SW updatefound event)
  useEffect(() => {
    if (!pwa.needsUpdate) return;
    let cancelled = false;
    fetchCurrentVersion().then((targetVersion) => {
      if (!cancelled) requestUpdate(targetVersion, "service-worker");
    });
    return () => {
      cancelled = true;
    };
  }, [pwa.needsUpdate, requestUpdate]);

  // Primary 2: HTTP polling /version.json — works for ALL browsers including
  // regular tabs, non-PWA contexts, and browsers with aggressive SW caching.
  useEffect(() => {
    let cancelled = false;
    let clearResumeRetry: (() => void) | null = null;

    const check = async () => {
      if (cancelled || dismissedRef.current) return;
      const v = await fetchCurrentVersion();
      if (cancelled || dismissedRef.current || !v) return;

      if (v !== __APP_BUILD_VERSION__) {
        // Compare against the version embedded in the currently running bundle.
        // This catches "old app shell + new server deploy" immediately,
        // even on the first poll, without requiring a manual refresh first.
        requestUpdate(v, "version-json");
      }
    };

    check();
    const interval = setInterval(check, POLL_INTERVAL_MS);

    const runResumeChecks = () => {
      check();
      clearResumeRetry?.();
      clearResumeRetry = scheduleFollowUpCheck(check);
    };

    const onVisible = () => { if (document.visibilityState === 'visible') runResumeChecks(); };
    const onOnline  = () => runResumeChecks();
    const onFocus   = () => runResumeChecks();
    const onPageShow = () => runResumeChecks();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onOnline);
    window.addEventListener('focus', onFocus);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      cancelled = true;
      clearResumeRetry?.();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [requestUpdate]);

  // Fallback: also check SW registration directly (belt-and-suspenders)
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let clearResumeRetry: (() => void) | null = null;

    const checkSW = async () => {
      if (dismissedRef.current) return;
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.waiting) {
          const targetVersion = await fetchCurrentVersion();
          requestUpdate(targetVersion, "waiting-service-worker");
          return;
        }
        await reg?.update();
      } catch { /* ignore */ }
    };

    checkSW();
    const interval = setInterval(checkSW, 120_000); // every 2 min (light)
    const runResumeChecks = () => {
      checkSW();
      clearResumeRetry?.();
      clearResumeRetry = scheduleFollowUpCheck(checkSW);
    };
    const onVisible = () => { if (document.visibilityState === 'visible') runResumeChecks(); };
    const onFocus = () => runResumeChecks();
    const onOnline = () => runResumeChecks();
    const onPageShow = () => runResumeChecks();

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('pageshow', onPageShow);

    return () => {
      clearResumeRetry?.();
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [requestUpdate]);

  const handleWaitUpdate = useCallback(() => {
    if (isUpdating) return;
    waitTargetRef.current = updateTargetVersionRef.current;
    waitUntilRef.current = Date.now() + UPDATE_WAIT_MS;
    setShowUpdateBanner(false);
    updateBannerVisibleRef.current = false;
    setUpdateStatus("available");
    setUpdateCountdown(UPDATE_AUTO_APPLY_SECONDS);
  }, [isUpdating]);

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
          onWait={handleWaitUpdate}
          status={updateStatus}
          countdown={updateCountdown}
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

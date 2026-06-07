import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  BellOff,
  Database,
  Download,
  Globe2,
  Loader2,
  RefreshCw,
  Shield,
  Smartphone,
  Trash2,
  Wifi,
  WifiOff,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { usePWA } from "@/hooks/usePWA";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/config/version";

const NOTIFICATION_PREF_KEY = "sipena_notifications_enabled";
const LEGACY_NOTIFICATION_PREF_KEY = "notifications";
const PUSH_PUBLIC_KEY =
  import.meta.env.VITE_VAPID_PUBLIC_KEY || import.meta.env.VITE_PUSH_PUBLIC_KEY || "";

type RuntimeAction = "update" | "clear-cache" | "notification" | "install" | null;

type ServiceWorkerSnapshot = {
  supported: boolean;
  registered: boolean;
  state: "unsupported" | "not-registered" | "installing" | "waiting" | "active" | "error";
  hasController: boolean;
  scriptUrl: string | null;
};

type CacheSnapshot = {
  supported: boolean;
  count: number;
  names: string[];
  checkedAt: Date | null;
};

type PushSyncState =
  | "idle"
  | "subscribed"
  | "local-only"
  | "missing-user"
  | "unsupported"
  | "failed";

type UntypedSupabaseClient = {
  from: (table: string) => any;
};

const supabaseUntyped = supabase as unknown as UntypedSupabaseClient;

function formatCheckedAt(date: Date | null) {
  if (!date) return "belum dicek";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

function readNotificationPreference() {
  try {
    const saved = localStorage.getItem(NOTIFICATION_PREF_KEY) ?? localStorage.getItem(LEGACY_NOTIFICATION_PREF_KEY);
    return saved === "true";
  } catch {
    return false;
  }
}

function persistNotificationPreference(enabled: boolean) {
  try {
    localStorage.setItem(NOTIFICATION_PREF_KEY, String(enabled));
    localStorage.setItem(LEGACY_NOTIFICATION_PREF_KEY, String(enabled));
  } catch {
    // Browser storage can be disabled in private contexts.
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function waitForServiceWorkerReady(timeoutMs = 8000) {
  if (!("serviceWorker" in navigator)) return Promise.resolve<ServiceWorkerRegistration | null>(null);

  return Promise.race<ServiceWorkerRegistration | null>([
    navigator.serviceWorker.ready,
    new Promise((resolve) => window.setTimeout(() => resolve(null), timeoutMs)),
  ]);
}

function getSubscriptionKeys(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: json.endpoint ?? subscription.endpoint,
    p256dh: json.keys?.p256dh ?? "",
    authKey: json.keys?.auth ?? "",
  };
}

function getServiceWorkerLabel(snapshot: ServiceWorkerSnapshot) {
  if (!snapshot.supported) return "Tidak didukung";
  if (!snapshot.registered) return "Belum terdaftar";
  if (snapshot.state === "waiting") return "Update siap";
  if (snapshot.state === "installing") return "Memasang";
  if (snapshot.state === "active") return "Aktif";
  if (snapshot.state === "error") return "Error";
  return "Belum aktif";
}

function getNotificationLabel(
  preferenceEnabled: boolean,
  permission: NotificationPermission | "unsupported",
  pushSyncState: PushSyncState,
) {
  if (permission === "unsupported") return "Tidak didukung";
  if (permission === "denied") return "Diblokir";
  if (permission !== "granted") return "Belum aktif";
  if (!preferenceEnabled) return "Izin aktif";
  if (pushSyncState === "subscribed") return "Aktif";
  if (pushSyncState === "local-only") return "Lokal aktif";
  if (pushSyncState === "failed") return "Perlu dicek";
  return "Aktif";
}

function RuntimeRow({
  icon,
  title,
  description,
  value,
  valueClassName,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  value: ReactNode;
  valueClassName?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 text-muted-foreground">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 pl-7 sm:pl-0">
        <div className={cn("text-sm font-semibold text-foreground", valueClassName)}>{value}</div>
        {actions}
      </div>
    </div>
  );
}

export function PwaNotificationSettingsSection() {
  const pwa = usePWA();
  const { user } = useAuth();
  const { success, error: showError, info, warning } = useEnhancedToast();
  const [runtimeAction, setRuntimeAction] = useState<RuntimeAction>(null);
  const [notificationPreference, setNotificationPreference] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => getNotificationPermission(),
  );
  const [pushSyncState, setPushSyncState] = useState<PushSyncState>("idle");
  const [serviceWorker, setServiceWorker] = useState<ServiceWorkerSnapshot>({
    supported: "serviceWorker" in navigator,
    registered: false,
    state: "not-registered",
    hasController: Boolean(navigator.serviceWorker?.controller),
    scriptUrl: null,
  });
  const [cacheSnapshot, setCacheSnapshot] = useState<CacheSnapshot>({
    supported: "caches" in window,
    count: 0,
    names: [],
    checkedAt: null,
  });

  const refreshServiceWorkerStatus = useCallback(async () => {
    if (!("serviceWorker" in navigator)) {
      setServiceWorker({
        supported: false,
        registered: false,
        state: "unsupported",
        hasController: false,
        scriptUrl: null,
      });
      return;
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (!registration) {
        setServiceWorker({
          supported: true,
          registered: false,
          state: "not-registered",
          hasController: Boolean(navigator.serviceWorker.controller),
          scriptUrl: null,
        });
        return;
      }

      const activeWorker = registration.active ?? registration.waiting ?? registration.installing ?? null;
      setServiceWorker({
        supported: true,
        registered: true,
        state: registration.waiting ? "waiting" : registration.installing ? "installing" : "active",
        hasController: Boolean(navigator.serviceWorker.controller),
        scriptUrl: activeWorker?.scriptURL ?? null,
      });
    } catch (err) {
      console.error("[PWA settings] Failed to read service worker status:", err);
      setServiceWorker((current) => ({ ...current, supported: true, state: "error" }));
    }
  }, []);

  const refreshCacheSnapshot = useCallback(async () => {
    if (!("caches" in window)) {
      setCacheSnapshot({ supported: false, count: 0, names: [], checkedAt: new Date() });
      return;
    }

    const names = await caches.keys();
    const counts = await Promise.all(
      names.map(async (name) => {
        try {
          const cache = await caches.open(name);
          return (await cache.keys()).length;
        } catch {
          return 0;
        }
      }),
    );

    setCacheSnapshot({
      supported: true,
      count: counts.reduce((total, count) => total + count, 0),
      names,
      checkedAt: new Date(),
    });
  }, []);

  useEffect(() => {
    setNotificationPreference(readNotificationPreference());
    setNotificationPermission(getNotificationPermission());
    void refreshServiceWorkerStatus();
    void refreshCacheSnapshot();

    const refreshOnlineRuntime = () => {
      void refreshServiceWorkerStatus();
      void refreshCacheSnapshot();
    };

    window.addEventListener("online", refreshOnlineRuntime);
    window.addEventListener("offline", refreshOnlineRuntime);
    window.addEventListener("appinstalled", refreshOnlineRuntime);
    navigator.serviceWorker?.addEventListener("controllerchange", refreshOnlineRuntime);

    return () => {
      window.removeEventListener("online", refreshOnlineRuntime);
      window.removeEventListener("offline", refreshOnlineRuntime);
      window.removeEventListener("appinstalled", refreshOnlineRuntime);
      navigator.serviceWorker?.removeEventListener("controllerchange", refreshOnlineRuntime);
    };
  }, [refreshCacheSnapshot, refreshServiceWorkerStatus]);

  useEffect(() => {
    setNotificationPermission(pwa.notifPermission);
  }, [pwa.notifPermission]);

  const cacheDescription = useMemo(() => {
    if (!cacheSnapshot.supported) return "Cache API tidak didukung browser ini.";
    const cacheNames = cacheSnapshot.names.length > 0 ? cacheSnapshot.names.join(", ") : "belum ada cache";
    return `${cacheSnapshot.count} item cache aplikasi - dicek ${formatCheckedAt(cacheSnapshot.checkedAt)} - ${cacheNames}`;
  }, [cacheSnapshot]);

  const installModeLabel = useMemo(() => {
    if (pwa.isStandalone || pwa.isInstalled) return "Aplikasi";
    if (pwa.isIOS) return "iOS Safari";
    return "Browser";
  }, [pwa.isIOS, pwa.isInstalled, pwa.isStandalone]);

  const notificationEnabled = notificationPreference && notificationPermission === "granted";
  const notificationLabel = getNotificationLabel(notificationPreference, notificationPermission, pushSyncState);

  const handleCheckUpdate = useCallback(async () => {
    setRuntimeAction("update");
    try {
      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : null;
      await registration?.update();
      await refreshServiceWorkerStatus();

      const response = await fetch(`/version.json?t=${Date.now()}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      }).catch(() => null);
      const deployedVersion = response?.ok ? (await response.json().catch(() => null))?.version : null;
      const hasNewBuild = typeof deployedVersion === "string" && deployedVersion !== __APP_BUILD_VERSION__;
      const waitingWorker = Boolean(registration?.waiting || pwa.needsUpdate || hasNewBuild);

      if (waitingWorker) {
        success("Pembaruan ditemukan", "SIPENA akan menerapkan versi terbaru sekarang.");
        await pwa.applyUpdate();
        return;
      }

      success("SIPENA sudah terbaru", `Versi aplikasi saat ini v${APP_VERSION}.`);
    } catch (err) {
      console.error("[PWA settings] Failed to check update:", err);
      showError("Gagal cek update", err instanceof Error ? err.message : "Browser tidak dapat memeriksa service worker.");
    } finally {
      setRuntimeAction(null);
    }
  }, [pwa, refreshServiceWorkerStatus, showError, success]);

  const handleClearCache = useCallback(async () => {
    setRuntimeAction("clear-cache");
    try {
      if (!("caches" in window)) {
        showError("Cache tidak didukung", "Browser ini tidak menyediakan Cache API.");
        return;
      }

      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await navigator.serviceWorker?.getRegistration().then((registration) => registration?.update()).catch(() => undefined);
      await refreshCacheSnapshot();
      await refreshServiceWorkerStatus();
      success("Cache PWA dibersihkan", `${names.length} cache aplikasi telah dihapus dari perangkat ini.`);
    } catch (err) {
      console.error("[PWA settings] Failed to clear cache:", err);
      showError("Gagal membersihkan cache", err instanceof Error ? err.message : "Cache browser tidak dapat dihapus.");
    } finally {
      setRuntimeAction(null);
    }
  }, [refreshCacheSnapshot, refreshServiceWorkerStatus, showError, success]);

  const syncPushSubscription = useCallback(async (registration: ServiceWorkerRegistration | null) => {
    if (!registration || !("PushManager" in window) || !registration.pushManager) {
      setPushSyncState("unsupported");
      return;
    }

    if (!PUSH_PUBLIC_KEY) {
      setPushSyncState("local-only");
      info(
        "Izin notifikasi aktif",
        "Tambahkan VITE_VAPID_PUBLIC_KEY agar notifikasi push dari server bisa dikirim ke perangkat ini.",
      );
      return;
    }

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUSH_PUBLIC_KEY),
      });
    }

    if (!user?.id) {
      setPushSyncState("missing-user");
      warning("Subscription belum disimpan", "Login ulang diperlukan sebelum perangkat ini bisa disimpan ke akun.");
      return;
    }

    const keys = getSubscriptionKeys(subscription);
    if (!keys.endpoint || !keys.p256dh || !keys.authKey) {
      setPushSyncState("failed");
      throw new Error("Browser tidak mengembalikan key subscription lengkap.");
    }

    const { error } = await supabaseUntyped
      .from("push_subscriptions")
      .upsert(
        {
          user_id: user.id,
          endpoint: keys.endpoint,
          p256dh: keys.p256dh,
          auth_key: keys.authKey,
        },
        { onConflict: "user_id,endpoint" },
      );

    if (error) {
      setPushSyncState("failed");
      throw error;
    }

    setPushSyncState("subscribed");
  }, [info, user?.id, warning]);

  const showTestNotification = useCallback(async (registration: ServiceWorkerRegistration | null) => {
    const payload = {
      body: "Notifikasi SIPENA sudah aktif di perangkat ini.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: "sipena-notification-test",
      data: { url: "/dashboard" },
    };

    if (registration?.showNotification) {
      await registration.showNotification("SIPENA", payload);
      return;
    }

    new Notification("SIPENA", payload);
  }, []);

  const handleEnableNotifications = useCallback(async () => {
    setRuntimeAction("notification");
    try {
      if (!("Notification" in window)) {
        setNotificationPermission("unsupported");
        persistNotificationPreference(false);
        setNotificationPreference(false);
        showError("Notifikasi tidak didukung", "Browser ini tidak menyediakan Notification API.");
        return;
      }

      let permission = Notification.permission;
      if (permission === "default") {
        permission = await Notification.requestPermission();
      }

      setNotificationPermission(permission);

      if (permission !== "granted") {
        persistNotificationPreference(false);
        setNotificationPreference(false);
        if (permission === "denied") {
          showError("Notifikasi diblokir", "Buka pengaturan situs di browser untuk mengizinkan notifikasi SIPENA.");
        } else {
          warning("Notifikasi belum aktif", "Izin browser belum diberikan.");
        }
        return;
      }

      const registration = await waitForServiceWorkerReady();
      await syncPushSubscription(registration ?? (await navigator.serviceWorker?.getRegistration()) ?? null);
      await showTestNotification(registration);
      persistNotificationPreference(true);
      setNotificationPreference(true);
      success("Notifikasi aktif", "Perangkat ini sudah menerima notifikasi uji dari SIPENA.");
    } catch (err) {
      console.error("[PWA settings] Failed to enable notifications:", err);
      persistNotificationPreference(false);
      setNotificationPreference(false);
      showError("Gagal mengaktifkan notifikasi", err instanceof Error ? err.message : "Subscription push gagal dibuat.");
    } finally {
      setRuntimeAction(null);
    }
  }, [showError, showTestNotification, success, syncPushSubscription, warning]);

  const handleDisableNotifications = useCallback(async () => {
    setRuntimeAction("notification");
    try {
      persistNotificationPreference(false);
      setNotificationPreference(false);

      const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.ready.catch(() => null) : null;
      const subscription = await registration?.pushManager?.getSubscription();
      const endpoint = subscription?.endpoint;
      await subscription?.unsubscribe();

      if (user?.id && endpoint) {
        await supabaseUntyped
          .from("push_subscriptions")
          .delete()
          .eq("user_id", user.id)
          .eq("endpoint", endpoint);
      }

      setPushSyncState("idle");
      success("Notifikasi dinonaktifkan", "Preferensi SIPENA dimatikan dan subscription perangkat dilepas.");
    } catch (err) {
      console.error("[PWA settings] Failed to disable notifications:", err);
      showError("Gagal menonaktifkan notifikasi", err instanceof Error ? err.message : "Subscription belum bisa dilepas.");
    } finally {
      setRuntimeAction(null);
    }
  }, [showError, success, user?.id]);

  const handleNotificationAction = useCallback(() => {
    if (notificationEnabled) {
      void handleDisableNotifications();
      return;
    }

    void handleEnableNotifications();
  }, [handleDisableNotifications, handleEnableNotifications, notificationEnabled]);

  const handleInstall = useCallback(async () => {
    setRuntimeAction("install");
    try {
      if (pwa.isInstalled || pwa.isStandalone) {
        info("SIPENA sudah terpasang", "Aplikasi sedang berjalan dalam mode PWA.");
        return;
      }

      if (pwa.hasNativePrompt) {
        await pwa.promptInstall();
        return;
      }

      pwa.installPrompt();
      if (pwa.isIOS) {
        info("Install di iOS", "Buka Safari, pilih Share, lalu Tambah ke Layar Utama.");
      } else {
        info("Prompt install belum tersedia", "Gunakan Chrome atau Edge, lalu pilih ikon install di address bar jika muncul.");
      }
    } finally {
      setRuntimeAction(null);
    }
  }, [info, pwa]);

  return (
    <Card className="animate-fade-in-up delay-150 border border-border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Smartphone className="h-5 w-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">PWA & Notifikasi</CardTitle>
            <p className="text-xs text-muted-foreground">Status aplikasi offline, update, install, dan izin notifikasi</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <RuntimeRow
          icon={pwa.isOnline ? <Wifi className="h-4 w-4 text-grade-pass" /> : <WifiOff className="h-4 w-4 text-destructive" />}
          title="Status Koneksi"
          value={pwa.isOnline ? "Online" : "Offline"}
          valueClassName={pwa.isOnline ? "text-grade-pass" : "text-destructive"}
        />
        <Separator />
        <RuntimeRow
          icon={<Shield className="h-4 w-4 text-blue-500" />}
          title="Service Worker"
          description={serviceWorker.scriptUrl ? serviceWorker.scriptUrl.replace(window.location.origin, "") : undefined}
          value={
            <span className="flex flex-wrap items-center justify-end gap-2">
              {serviceWorker.registered && <span className="h-2 w-2 rounded-full bg-grade-pass" />}
              <span>{getServiceWorkerLabel(serviceWorker)}</span>
              <span className="font-mono text-xs text-muted-foreground">v{APP_VERSION}</span>
            </span>
          }
          valueClassName={serviceWorker.registered ? "text-grade-pass" : "text-muted-foreground"}
        />
        <Separator />
        <RuntimeRow
          icon={<Database className="h-4 w-4 text-primary" />}
          title="Cache PWA"
          description={cacheDescription}
          value={`${cacheSnapshot.count} item`}
          valueClassName={cacheSnapshot.count > 0 ? "text-foreground" : "text-muted-foreground"}
          actions={
            <>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCheckUpdate}
                disabled={runtimeAction !== null}
                className="h-9"
              >
                {runtimeAction === "update" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Check Update
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={handleClearCache}
                disabled={runtimeAction !== null || !cacheSnapshot.supported}
                className="h-9"
              >
                {runtimeAction === "clear-cache" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Bersihkan Cache
              </Button>
            </>
          }
        />
        <Separator />
        <RuntimeRow
          icon={<Globe2 className="h-4 w-4 text-sky-500" />}
          title="Mode Instalasi"
          value={
            <span className="flex items-center gap-2">
              <Badge variant={pwa.isInstalled || pwa.isStandalone ? "pass" : "secondary"}>{installModeLabel}</Badge>
            </span>
          }
        />
        <Separator />
        <RuntimeRow
          icon={notificationEnabled ? <Bell className="h-4 w-4 text-grade-pass" /> : <BellOff className="h-4 w-4" />}
          title="Notifikasi Aplikasi"
          description={
            notificationPermission === "granted"
              ? pushSyncState === "subscribed"
                ? "Izin browser aktif dan subscription perangkat tersimpan."
                : "Izin browser aktif. Push server memerlukan VITE_VAPID_PUBLIC_KEY."
              : notificationPermission === "denied"
                ? "Izin diblokir oleh browser dan harus diubah dari pengaturan situs."
                : "Klik Aktifkan untuk meminta izin browser dan mengirim notifikasi uji."
          }
          value={notificationLabel}
          valueClassName={notificationEnabled ? "text-grade-pass" : "text-muted-foreground"}
          actions={
            <Button
              type="button"
              variant={notificationEnabled ? "outline" : "default"}
              size="sm"
              onClick={handleNotificationAction}
              disabled={runtimeAction !== null}
              className="h-9"
            >
              {runtimeAction === "notification" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : notificationEnabled ? (
                <BellOff className="h-4 w-4" />
              ) : (
                <Bell className="h-4 w-4" />
              )}
              {notificationEnabled ? "Nonaktifkan" : "Aktifkan"}
            </Button>
          }
        />
        <Separator />
        <div className="pt-4">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleInstall}
            disabled={runtimeAction !== null || pwa.isInstalled || pwa.isStandalone}
            className="h-10"
          >
            {runtimeAction === "install" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            Install SIPENA ke Perangkat
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

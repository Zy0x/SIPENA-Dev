import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bell,
  RefreshCw,
  Loader2,
  UserPlus,
  Trash2,
  CheckCircle,
  X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";

interface AdminNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  read: boolean;
  created_at: string;
}

interface AdminNotificationsPanelProps {
  adminPassword: string;
}

export function AdminNotificationsPanel({ adminPassword }: AdminNotificationsPanelProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const request = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-event-notifications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        apikey: SUPABASE_EXTERNAL_ANON_KEY,
        "x-admin-session-token": localStorage.getItem("admin_session_token") || "",
      },
      body: JSON.stringify({ action, password: adminPassword, ...payload }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.success) {
      const message = typeof result.error === "string" ? result.error : `Aksi notifikasi gagal (${response.status})`;
      throw new Error(message);
    }
    return result;
  }, [adminPassword]);

  const fetchNotifications = useCallback(async () => {
    if (!adminPassword) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const result = await request("list");
      setNotifications((result.notifications || []).map((item: AdminNotification & { event_type?: string }) => ({
        ...item,
        type: item.event_type || item.type,
      })));
      setIsLive(true);
    } catch (error) {
      setIsLive(false);
      const message = error instanceof Error ? error.message : "Layanan notifikasi Admin tidak merespons";
      setLoadError(message);
      toast({ variant: "destructive", title: "Gagal memuat notifikasi Admin", description: message });
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword, request, toast]);

  useEffect(() => {
    if (adminPassword) fetchNotifications();
  }, [adminPassword, fetchNotifications]);

  useEffect(() => {
    if (!adminPassword) return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchNotifications();
    }, 30_000);
    return () => window.clearInterval(interval);
  }, [adminPassword, fetchNotifications]);

  const markAsRead = async (notificationId: string) => {
    try {
      await request("mark-read", { id: notificationId });
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    } catch {}
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await request("delete", { id: notificationId });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast({ title: "Notifikasi Dihapus" });
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await request("mark-all-read");
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "Semua Ditandai Dibaca" });
    } catch {}
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_user_registration":
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      case "guest_teacher_access":
      case "quick_guest_registration":
        return <UserPlus className="w-4 h-4 text-emerald-500" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!adminPassword) return null;

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-violet-400" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border border-card flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Notifikasi Admin</p>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Sinkron otomatis
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aktivitas penting — pendaftaran pengguna baru, dll
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tandai Semua</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground/60">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Memuat notifikasi...</p>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <Bell className="h-9 w-9 text-destructive/60" />
            <div>
              <p className="text-sm font-semibold text-foreground">Notifikasi belum dapat dimuat</p>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">{loadError}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={fetchNotifications}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              Coba lagi
            </Button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground/60">
            <Bell className="w-10 h-10 opacity-20" />
            <p className="text-sm text-center">Belum ada notifikasi admin</p>
          </div>
        ) : (
          <ScrollArea className="h-[280px] pr-1">
            <div className="space-y-1.5">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`
                    group relative flex items-start gap-3 p-3.5 rounded-lg transition-all duration-150 border
                    ${!notification.read
                      ? "bg-muted/50 border-border/50 border-l-2 border-l-violet-500"
                      : "bg-muted/10 border-transparent hover:bg-muted/30 border-l-2 border-l-transparent"
                    }
                  `}
                >
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-muted-foreground/75 mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: id,
                      })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    {!notification.read && (
                      <button
                        type="button"
                        onClick={() => markAsRead(notification.id)}
                        className="p-1 rounded text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 transition-colors"
                        aria-label="Tandai dibaca"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 rounded text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      aria-label="Hapus"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}

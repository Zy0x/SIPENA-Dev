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
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
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

  const fetchNotifications = useCallback(async () => {
    if (!adminPassword) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setNotifications((data as AdminNotification[]) || []);
      setIsLive(true);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat notifikasi admin" });
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword, toast]);

  useEffect(() => {
    if (adminPassword) fetchNotifications();
  }, [adminPassword, fetchNotifications]);

  useEffect(() => {
    if (!adminPassword) return;
    const channel = supabase
      .channel("admin-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: "user_id=eq.00000000-0000-0000-0000-000000000000",
        },
        (payload) => {
          setNotifications((prev) => [payload.new as AdminNotification, ...prev]);
          toast({ title: "🔔 Notifikasi Baru", description: (payload.new as AdminNotification).title });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [adminPassword, toast]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
      setNotifications((prev) => prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)));
    } catch {}
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast({ title: "Notifikasi Dihapus" });
    } catch {}
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .eq("read", false);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({ title: "Semua Ditandai Dibaca" });
    } catch {}
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_user_registration":
        return <UserPlus className="w-4 h-4 text-blue-400" />;
      default:
        return <Bell className="w-4 h-4 text-slate-400" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!adminPassword) return null;

  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-900/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/70 bg-slate-900/80">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
              <Bell className="w-4 h-4 text-violet-400" />
            </div>
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-red-500 border border-slate-900 flex items-center justify-center text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-100">Notifikasi Admin</p>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Real-time
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
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
              className="h-8 gap-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-slate-800"
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
            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-200 hover:bg-slate-800"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-8 text-slate-600">
            <Loader2 className="w-6 h-6 animate-spin" />
            <p className="text-sm">Memuat notifikasi...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-slate-600">
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
                      ? "bg-slate-800/50 border-slate-700/50 border-l-2 border-l-violet-500"
                      : "bg-slate-800/20 border-transparent hover:bg-slate-800/40 border-l-2 border-l-transparent"
                    }
                  `}
                >
                  <div className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-slate-200 truncate">
                        {notification.title}
                      </p>
                      {!notification.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                      {notification.message}
                    </p>
                    <p className="text-[11px] text-slate-600 mt-1">
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
                        className="p-1 rounded text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        aria-label="Tandai dibaca"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => deleteNotification(notification.id)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
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

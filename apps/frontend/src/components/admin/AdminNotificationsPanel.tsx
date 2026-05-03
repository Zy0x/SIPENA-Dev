import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  RefreshCw,
  Loader2,
  UserPlus,
  Trash2,
  CheckCircle,
  Zap,
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
      // Fetch admin notifications (system notifications with user_id = placeholder)
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications((data as AdminNotification[]) || []);
      setIsLive(true);
    } catch (error) {
      console.error("Failed to fetch admin notifications:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat notifikasi admin",
      });
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword, toast]);

  // Auto-fetch on mount
  useEffect(() => {
    if (adminPassword) {
      fetchNotifications();
    }
  }, [adminPassword, fetchNotifications]);

  // Subscribe to realtime notifications
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
          toast({
            title: "🔔 Notifikasi Baru",
            description: (payload.new as AdminNotification).title,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [adminPassword, toast]);

  const markAsRead = async (notificationId: string) => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      setNotifications((prev) =>
        prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n))
      );
    } catch (error) {
      console.error("Failed to mark as read:", error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await supabase.from("notifications").delete().eq("id", notificationId);
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
      toast({
        title: "Notifikasi Dihapus",
      });
    } catch (error) {
      console.error("Failed to delete notification:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", "00000000-0000-0000-0000-000000000000")
        .eq("read", false);

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast({
        title: "Semua Ditandai Dibaca",
      });
    } catch (error) {
      console.error("Failed to mark all as read:", error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "new_user_registration":
        return <UserPlus className="w-4 h-4 text-grade-pass" />;
      default:
        return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!adminPassword) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifikasi Admin
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {unreadCount} baru
                </Badge>
              )}
            </CardTitle>
            {isLive && (
              <Badge variant="default" className="gap-1 bg-grade-pass/90 hover:bg-grade-pass">
                <Zap className="w-3 h-3" />
                Real-time
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                <CheckCircle className="w-4 h-4 mr-1" />
                Tandai Semua
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={fetchNotifications} disabled={isLoading}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        <CardDescription>
          Notifikasi tentang aktivitas penting seperti pendaftaran pengguna baru
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p>Belum ada notifikasi admin</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {notifications.map((notification, index) => (
                <div key={notification.id}>
                  <div
                    className={`flex items-start gap-3 p-3 rounded-lg transition-colors ${
                      !notification.read ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <div className="mt-0.5">{getNotificationIcon(notification.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">{notification.title}</p>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: id,
                        })}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => markAsRead(notification.id)}
                          title="Tandai dibaca"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteNotification(notification.id)}
                        title="Hapus"
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  {index < notifications.length - 1 && <Separator className="my-1" />}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

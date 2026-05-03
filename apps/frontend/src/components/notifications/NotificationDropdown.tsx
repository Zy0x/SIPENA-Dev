import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, CheckCheck, Trash2, User, ExternalLink, AlertTriangle, Sparkles, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications } from "@/hooks/useNotifications";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { GuestActivityDialog } from "./GuestActivityDialog";
import { formatDistanceToNow } from "date-fns";
import { id } from "date-fns/locale";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";

export function NotificationDropdown() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const { success, error: showError } = useEnhancedToast();
  const [open, setOpen] = useState(false);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<{
    data?: {
      guest_name?: string;
      guest_email?: string;
      class_name?: string;
      subject_name?: string;
      shared_link_id?: string;
    };
  } | null>(null);
  const [showActivityDialog, setShowActivityDialog] = useState(false);

  const handleMarkAsRead = (notificationId: string) => {
    markAsRead.mutate(notificationId);
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead.mutate();
    success("Semua Dibaca", "Semua notifikasi telah ditandai sebagai dibaca.");
  };

  const handleDelete = (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteNotification.mutate(notificationId);
  };

  const handleDeleteAll = async () => {
    if (!user?.id) return;
    
    setIsDeletingAll(true);
    try {
      // Use database function to delete all notifications
      const { error } = await supabase.rpc('delete_all_user_notifications', {
        p_user_id: user.id
      });

      if (error) throw error;

      success("Notifikasi Dihapus", "Semua notifikasi telah dihapus.");
      setShowDeleteAllDialog(false);
      setOpen(false);
    } catch (err) {
      console.error("Error deleting all notifications:", err);
      showError("Gagal Menghapus", "Terjadi kesalahan saat menghapus notifikasi.");
    } finally {
      setIsDeletingAll(false);
    }
  };

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.read) {
      handleMarkAsRead(notification.id);
    }
    
    // If it's a guest access notification, show the activity dialog
    if (notification.type === "guest_access" && notification.data) {
      setSelectedNotification({ data: notification.data as typeof selectedNotification['data'] });
      setShowActivityDialog(true);
      setOpen(false);
    }
    
    // If it's a system notification with changelog, navigate to changelog
    if (notification.type === "system" && notification.data?.show_changelog) {
      navigate("/changelog");
      setOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "guest_access":
        return <User className="w-4 h-4 text-primary" />;
      case "grade_input":
        return <Check className="w-4 h-4 text-grade-pass" />;
      case "system":
        return <Sparkles className="w-4 h-4 text-accent" />;
      case "info":
        return <Info className="w-4 h-4 text-primary" />;
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <Badge 
                variant="fail" 
                className="absolute -top-1 -right-1 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs"
              >
                {unreadCount > 99 ? "99+" : unreadCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80 bg-popover">
          <DropdownMenuLabel className="flex items-center justify-between gap-2">
            <span>Notifikasi</span>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={handleMarkAllAsRead}
                  title="Tandai semua sebagai dibaca"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={() => setShowDeleteAllDialog(true)}
                  title="Hapus semua notifikasi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              )}
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <ScrollArea className="h-[300px]">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Belum ada notifikasi</p>
              </div>
            ) : (
              notifications.map((notification) => (
                <DropdownMenuItem
                  key={notification.id}
                  className={`flex items-start gap-3 p-3 cursor-pointer group ${
                    !notification.read ? "bg-primary/5" : ""
                  }`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm ${!notification.read ? "font-medium" : ""}`}>
                        {notification.title}
                      </p>
                      {notification.type === "guest_access" && notification.data && (
                        <ExternalLink className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {notification.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(notification.created_at), { 
                        addSuffix: true,
                        locale: id 
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity"
                    onClick={(e) => handleDelete(notification.id, e)}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Hapus Semua Notifikasi?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini akan menghapus semua notifikasi Anda secara permanen.
              Apakah Anda yakin ingin melanjutkan?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAll}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? "Menghapus..." : "Hapus Semua"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Guest Activity Dialog */}
      <GuestActivityDialog
        isOpen={showActivityDialog}
        onClose={() => setShowActivityDialog(false)}
        notificationData={selectedNotification?.data}
      />
    </>
  );
}

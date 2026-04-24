import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { formatDistanceToNow, format } from "date-fns";
import { id } from "date-fns/locale";
import { 
  User, 
  Clock, 
  FileSpreadsheet, 
  BookOpen, 
  Settings, 
  PlusCircle, 
  Trash2, 
  Edit,
  Calendar,
  Eye,
  Mail,
  Activity,
} from "lucide-react";

interface GuestAuditLog {
  id: string;
  action: string;
  details: unknown;
  created_at: string;
  guest_name?: string;
  guest_email?: string;
}

interface GuestUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
  last_access_at?: string;
  updated_at?: string;
}

interface GuestActivityDialogProps {
  isOpen: boolean;
  onClose: () => void;
  notificationData?: {
    guest_name?: string;
    guest_email?: string;
    class_name?: string;
    subject_name?: string;
    shared_link_id?: string;
    access_time?: string;
  };
}

export function GuestActivityDialog({ isOpen, onClose, notificationData }: GuestActivityDialogProps) {
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<GuestAuditLog[]>([]);
  const [guestUser, setGuestUser] = useState<GuestUser | null>(null);
  const [accessCount, setAccessCount] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      try {
        // If we have shared_link_id, load audit logs
        if (notificationData?.shared_link_id) {
          const { data: logs, error: logsError } = await supabase
            .from("guest_audit_logs")
            .select("*")
            .eq("shared_link_id", notificationData.shared_link_id)
            .order("created_at", { ascending: false })
            .limit(50);

          if (!logsError && logs) {
            setAuditLogs(logs);
            setAccessCount(logs.filter(l => l.action === "access").length);
          }
        }

        // Try to load guest user info by email
        if (notificationData?.guest_email) {
          const { data: guest } = await supabase
            .from("guest_users")
            .select("*")
            .eq("email", notificationData.guest_email)
            .maybeSingle();
          
          if (guest) {
            setGuestUser(guest);
          }
        }
      } catch (error) {
        console.error("Error loading guest activity:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [isOpen, notificationData]);

  const getActionIcon = (action: string) => {
    switch (action) {
      case "grade_input":
        return <FileSpreadsheet className="w-4 h-4 text-primary" />;
      case "add_chapter":
        return <PlusCircle className="w-4 h-4 text-grade-pass" />;
      case "add_assignment":
        return <PlusCircle className="w-4 h-4 text-accent" />;
      case "delete_chapter":
      case "delete_assignment":
        return <Trash2 className="w-4 h-4 text-destructive" />;
      case "update_kkm":
        return <Settings className="w-4 h-4 text-grade-warning" />;
      case "access":
        return <Eye className="w-4 h-4 text-muted-foreground" />;
      case "view_grades":
        return <FileSpreadsheet className="w-4 h-4 text-primary" />;
      default:
        return <Edit className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActionLabel = (action: string, details: unknown) => {
    const d = (typeof details === 'object' && details !== null) ? details as Record<string, unknown> : {};
    switch (action) {
      case "grade_input":
        return `Input nilai${d.student_name ? ` untuk ${d.student_name}` : ''}: ${d.value ?? '-'}`;
      case "add_chapter":
        return `Tambah BAB: ${d.chapter_name || '-'}`;
      case "add_assignment":
        return `Tambah Tugas: ${d.assignment_name || '-'}`;
      case "delete_chapter":
        return `Hapus BAB: ${d.chapter_name || '-'}`;
      case "delete_assignment":
        return `Hapus Tugas: ${d.assignment_name || '-'}`;
      case "update_kkm":
        return `Ubah KKM: ${d.old_kkm || '-'} → ${d.new_kkm || '-'}`;
      case "access":
        return "Membuka halaman nilai";
      case "view_grades":
        return "Melihat daftar nilai";
      default:
        return action;
    }
  };

  const hasData = notificationData?.guest_name || notificationData?.guest_email || guestUser;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Detail Guru Tamu
          </DialogTitle>
          <DialogDescription>
            Informasi dan riwayat aktivitas guru tamu
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="space-y-4 py-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !hasData ? (
          <div className="text-center py-8 text-muted-foreground">
            <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">Tidak ada data guru tamu</p>
            <p className="text-xs mt-1">Data detail tidak tersedia untuk notifikasi ini</p>
          </div>
        ) : (
          <div className="space-y-4 overflow-hidden">
            {/* Guest Info Card */}
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20">
              <CardContent className="p-4 space-y-4">
                {/* Profile Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg">
                    <User className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg truncate">
                      {notificationData?.guest_name || guestUser?.name || "Guru Tamu"}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">
                        {notificationData?.guest_email || guestUser?.email || "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                    <BookOpen className="w-4 h-4 text-primary" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Kelas</p>
                      <p className="text-sm font-medium truncate">{notificationData?.class_name || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
                    <FileSpreadsheet className="w-4 h-4 text-accent" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Mapel</p>
                      <p className="text-sm font-medium truncate">{notificationData?.subject_name || "-"}</p>
                    </div>
                  </div>
                </div>

                {/* Access Info */}
                <div className="flex items-center justify-between text-sm border-t pt-3 border-border/50">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {notificationData?.access_time ? (
                      <span>
                        {format(new Date(notificationData.access_time), "d MMM yyyy, HH:mm", { locale: id })}
                      </span>
                    ) : guestUser?.last_access_at ? (
                      <span>
                        Terakhir akses {formatDistanceToNow(new Date(guestUser.last_access_at), { addSuffix: true, locale: id })}
                      </span>
                    ) : (
                      <span>-</span>
                    )}
                  </div>
                  {accessCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      <Activity className="w-3 h-3 mr-1" />
                      {accessCount}x akses
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Activity History */}
            <div>
              <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Riwayat Aktivitas
                <Badge variant="outline" className="text-xs">{auditLogs.length}</Badge>
              </h4>

              <ScrollArea className="h-[200px]">
                {auditLogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Belum ada aktivitas tercatat</p>
                    <p className="text-xs mt-1">
                      Aktivitas akan muncul ketika guru tamu melakukan aksi
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 pr-2">
                    {auditLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="mt-0.5 p-1.5 rounded-full bg-background">
                          {getActionIcon(log.action)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">
                            {getActionLabel(log.action, log.details)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(log.created_at), { addSuffix: true, locale: id })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

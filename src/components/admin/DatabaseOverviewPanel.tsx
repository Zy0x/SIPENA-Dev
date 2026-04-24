import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";

interface DatabaseStats {
  [key: string]: number;
}

interface DatabaseOverviewPanelProps {
  adminPassword: string;
}

// Default table icons mapping
const TABLE_ICONS: Record<string, string> = {
  academic_years: "📅",
  semesters: "📆",
  classes: "🏫",
  students: "👨‍🎓",
  subjects: "📚",
  chapters: "📖",
  assignments: "📝",
  grades: "💯",
  attendance: "📋",
  user_preferences: "⚙️",
  profiles: "👤",
  user_roles: "🔐",
  guest_users: "👥",
  shared_links: "🔗",
  guest_audit_logs: "📊",
  activity_logs: "📋",
  notifications: "🔔",
  password_reset_tokens: "🔑",
  account_deletion_requests: "🗑️",
  team_profiles: "👥",
};

// Generate friendly label from table name
function getTableLabel(tableName: string): string {
  const labelMap: Record<string, string> = {
    academic_years: "Tahun Akademik",
    semesters: "Semester",
    classes: "Kelas",
    students: "Siswa",
    subjects: "Mata Pelajaran",
    chapters: "Bab/Chapter",
    assignments: "Tugas",
    grades: "Nilai",
    attendance: "Presensi",
    user_preferences: "Preferensi User",
    profiles: "Profil",
    user_roles: "Role User",
    guest_users: "Pengguna Tamu",
    shared_links: "Link Berbagi",
    guest_audit_logs: "Log Audit Tamu",
    activity_logs: "Log Aktivitas",
    notifications: "Notifikasi",
    password_reset_tokens: "Token Reset Password",
    account_deletion_requests: "Request Hapus Akun",
    team_profiles: "Profil Tim",
  };
  
  return labelMap[tableName] || tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function getTableIcon(tableName: string): string {
  return TABLE_ICONS[tableName] || "📁";
}

export function DatabaseOverviewPanel({ adminPassword }: DatabaseOverviewPanelProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [discoveredTables, setDiscoveredTables] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch detailed stats via Edge Function (now dynamic)
  const fetchDetailedStats = useCallback(async () => {
    if (!adminPassword) {
      return;
    }

    setStatsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "stats",
          password: adminPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStats(result.stats);
        setTotalRecords(result.totalRecords || 0);
        setDiscoveredTables(result.discoveredTables || Object.keys(result.stats));
        setIsLive(true);
        setLastUpdate(new Date());
      } else {
        setError(result.error || "Terjadi kesalahan");
        toast({
          variant: "destructive",
          title: "Gagal Memuat Statistik",
          description: result.error || "Terjadi kesalahan",
        });
      }
    } catch (err) {
      console.error("Stats fetch error:", err);
      setError("Gagal terhubung ke server");
      toast({
        variant: "destructive",
        title: "Error Koneksi",
        description: "Gagal terhubung ke server",
      });
    } finally {
      setStatsLoading(false);
    }
  }, [adminPassword, toast]);

  // Auto-fetch on mount when password is available
  useEffect(() => {
    if (adminPassword && !stats) {
      fetchDetailedStats();
    }
  }, [adminPassword, stats, fetchDetailedStats]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Database className="w-5 h-5" />
              Database Overview
            </CardTitle>
            {isLive && (
              <Badge variant="default" className="gap-1 bg-grade-pass/90 hover:bg-grade-pass">
                <Zap className="w-3 h-3" />
                Live Sync
              </Badge>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchDetailedStats}
            disabled={statsLoading || !adminPassword}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
            Refresh Stats
          </Button>
        </div>
        <CardDescription>
          {totalRecords > 0 ? (
            <>
              Total: {totalRecords.toLocaleString()} record dari {discoveredTables.length} tabel (dinamis)
              {lastUpdate && (
                <span className="ml-2 text-xs">
                  • Diperbarui: {lastUpdate.toLocaleTimeString("id-ID")}
                </span>
              )}
            </>
          ) : (
            "Database akan dimuat secara otomatis saat password valid"
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!adminPassword ? (
          <div className="flex items-center gap-3 py-8 justify-center text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <p>Masukkan password backend di tab <strong>Kredensial</strong> untuk memuat data</p>
          </div>
        ) : statsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-8 text-muted-foreground">
            <AlertCircle className="w-8 h-8 text-destructive" />
            <p className="text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDetailedStats}>
              Coba Lagi
            </Button>
          </div>
        ) : stats && discoveredTables.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {discoveredTables.map((tableName) => (
              <div
                key={tableName}
                className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition group"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span>{getTableIcon(tableName)}</span>
                  <span className="text-xs font-medium truncate group-hover:text-primary transition-colors">
                    {getTableLabel(tableName)}
                  </span>
                </div>
                <p className="text-xl font-bold text-primary">
                  {(stats[tableName] || 0).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Data akan dimuat secara otomatis...
          </p>
        )}
      </CardContent>
    </Card>
  );
}

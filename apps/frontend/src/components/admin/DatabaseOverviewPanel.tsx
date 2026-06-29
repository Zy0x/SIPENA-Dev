import { useState, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Database, Zap, AlertCircle, TrendingUp, Lock, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

interface DatabaseStats {
  [key: string]: number;
}

interface DatabaseOverviewPanelProps {
  adminPassword: string;
}

const TABLE_ICONS: Record<string, string> = {
  academic_years: "📅",
  semesters: "📆",
  classes: "🏫",
  students: "👨‍🎓",
  subjects: "📚",
  chapters: "📖",
  assignments: "📝",
  grades: "💯",
  grade_formula_settings: "Fx",
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
  admin_sessions: "🔐",
};

function getTableLabel(tableName: string): string {
  const labelMap: Record<string, string> = {
    academic_years: "Tahun Akademik",
    semesters: "Semester",
    classes: "Kelas",
    students: "Murid",
    subjects: "Mata Pelajaran",
    chapters: "Bab/Chapter",
    assignments: "Tugas",
    grades: "Nilai",
    grade_formula_settings: "Rumus Nilai",
    attendance: "Presensi",
    user_preferences: "Preferensi User",
    profiles: "Profil",
    user_roles: "Role User",
    guest_users: "Pengguna Tamu",
    shared_links: "Link Berbagi",
    guest_audit_logs: "Log Audit Tamu",
    activity_logs: "Log Aktivitas",
    notifications: "Notifikasi",
    password_reset_tokens: "Token Reset",
    account_deletion_requests: "Request Hapus",
    team_profiles: "Profil Tim",
    admin_sessions: "Sesi Admin",
  };
  return labelMap[tableName] || tableName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getTableIcon(tableName: string): string {
  return TABLE_ICONS[tableName] || "📁";
}

// Color accent per table type
function getTableColor(tableName: string): string {
  const colorMap: Record<string, string> = {
    students: "text-blue-400",
    grades: "text-emerald-400",
    attendance: "text-violet-400",
    classes: "text-amber-400",
    subjects: "text-pink-400",
    assignments: "text-orange-400",
    profiles: "text-cyan-400",
    notifications: "text-yellow-400",
    activity_logs: "text-slate-400",
    admin_sessions: "text-red-400",
  };
  return colorMap[tableName] || "text-slate-400";
}

export function DatabaseOverviewPanel({ adminPassword }: DatabaseOverviewPanelProps) {
  const { toast } = useToast();
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [discoveredTables, setDiscoveredTables] = useState<string[]>([]);
  const [rlsStatuses, setRlsStatuses] = useState<Record<string, boolean>>({});
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  const [isLive, setIsLive] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchDetailedStats = useCallback(async () => {
    if (!adminPassword) return;
    setStatsLoading(true);
    setError(null);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({ action: "stats", password: adminPassword }),
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
        setTotalRecords(result.totalRecords || 0);
        setDiscoveredTables(result.discoveredTables || Object.keys(result.stats));
        setRlsStatuses(result.rlsStatuses || {});
        setIsLive(true);
        setLastUpdate(new Date());
      } else {
        setError(result.error || "Terjadi kesalahan");
        toast({ variant: "destructive", title: "Gagal Memuat Statistik", description: result.error });
      }
    } catch {
      setError("Gagal terhubung ke server");
      toast({ variant: "destructive", title: "Error Koneksi", description: "Gagal terhubung ke server" });
    } finally {
      setStatsLoading(false);
    }
  }, [adminPassword, toast]);

  useEffect(() => {
    if (adminPassword && !stats) fetchDetailedStats();
  }, [adminPassword, stats, fetchDetailedStats]);

  const unsecuredTables = discoveredTables.filter((t) => rlsStatuses[t] === false);

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/80">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Database className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Database Overview & Security Monitor</p>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalRecords > 0
                ? `${totalRecords.toLocaleString("id-ID")} record dari ${discoveredTables.length} tabel`
                : "Memuat data dari Supabase..."}
              {lastUpdate && (
                <span className="ml-2 opacity-60">
                  • {lastUpdate.toLocaleTimeString("id-ID")}
                </span>
              )}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDetailedStats}
          disabled={statsLoading || !adminPassword}
          className="h-8 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${statsLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline text-xs">Refresh</span>
        </Button>
      </div>

      {/* Content */}
      <div className="p-5">
        {!adminPassword ? (
          <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground/60">
            <AlertCircle className="w-10 h-10 opacity-30" />
            <p className="text-sm text-center">
              Masukkan password backend di tab{" "}
              <span className="text-foreground font-medium">Kredensial</span> untuk memuat data
            </p>
          </div>
        ) : statsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-10">
            <AlertCircle className="w-10 h-10 text-red-400/60" />
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchDetailedStats} className="border-border text-muted-foreground hover:text-foreground">
              Coba Lagi
            </Button>
          </div>
        ) : stats && discoveredTables.length > 0 ? (
          <>
            {/* Security Alerts Banner */}
            {unsecuredTables.length > 0 ? (
              <div className="flex items-start gap-3 p-4 mb-4 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">Celah Keamanan Terdeteksi: RLS Dinonaktifkan</p>
                  <p className="text-xs text-red-300 mt-1 leading-relaxed">
                    Tabel berikut tidak memiliki Row Level Security (RLS) aktif:{" "}
                    <span className="font-semibold text-white">{unsecuredTables.join(", ")}</span>. 
                    Hal ini dapat menyebabkan kebocoran data. Segera aktifkan RLS di SQL Editor Supabase.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 mb-4 p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-emerald-400 text-xs font-medium">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>Monitoring Keamanan: Semua tabel aktif memiliki proteksi Row Level Security (RLS) aktif.</span>
              </div>
            )}

            {/* Total summary */}
            <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-muted/40 border border-border">
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Total:{" "}
                <span className="text-foreground font-bold tabular-nums">
                  {totalRecords.toLocaleString("id-ID")}
                </span>{" "}
                record dari {discoveredTables.length} tabel aktif
              </span>
            </div>

            {/* Table grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {discoveredTables.map((tableName) => (
                <div
                  key={tableName}
                  className="group p-3.5 rounded-lg border border-border/40 bg-muted/20 hover:bg-muted/50 hover:border-border/60 transition-all duration-150"
                >
                  <div className="flex items-center justify-between gap-1.5 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-base leading-none">{getTableIcon(tableName)}</span>
                      <span className="text-[11px] font-medium text-muted-foreground/70 truncate group-hover:text-muted-foreground transition-colors">
                        {getTableLabel(tableName)}
                      </span>
                    </div>
                    {rlsStatuses[tableName] === false ? (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/10 border border-red-500/20 text-red-400 font-semibold uppercase flex items-center gap-0.5 shrink-0" title="RLS Dinonaktifkan!">
                        <Lock className="w-2.5 h-2.5" /> Off
                      </span>
                    ) : (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold uppercase flex items-center gap-0.5 shrink-0" title="RLS Aktif (Aman)">
                        <ShieldCheck className="w-2.5 h-2.5" /> RLS
                      </span>
                    )}
                  </div>
                  <p className={`text-2xl font-bold tabular-nums leading-none ${getTableColor(tableName)}`}>
                    {(stats[tableName] || 0).toLocaleString("id-ID")}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-center text-muted-foreground/65 py-10 text-sm">
            Data akan dimuat secara otomatis...
          </p>
        )}
      </div>
    </div>
  );
}

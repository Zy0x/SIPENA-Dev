import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { 
  Database, Download, Upload, Trash2, RefreshCw, 
  Loader2, CheckCircle, XCircle, AlertTriangle,
  HardDrive, FileJson, Clock, Eye, Table2,
  ChevronLeft, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

// Icons for known tables
const TABLE_ICONS: Record<string, string> = {
  academic_years: "📅", semesters: "📆", classes: "🏫", students: "👨‍🎓",
  subjects: "📚", chapters: "📖", assignments: "📝", grades: "💯", grade_formula_settings: "Fx",
  attendance: "📋", user_preferences: "⚙️", profiles: "👤", user_roles: "🔐",
  guest_users: "👥", shared_links: "🔗", guest_audit_logs: "📊",
  activity_logs: "📋", notifications: "🔔", password_reset_tokens: "🔑",
  account_deletion_requests: "🗑️", team_profiles: "👥", parent_portal_configs: "👪",
  maintenance_alerts: "🔔",
};

const TABLE_LABELS: Record<string, string> = {
  academic_years: "Tahun Akademik", semesters: "Semester", classes: "Kelas",
  students: "Siswa", subjects: "Mata Pelajaran", chapters: "Bab/Chapter",
  assignments: "Tugas", grades: "Nilai", grade_formula_settings: "Rumus Nilai", attendance: "Presensi",
  user_preferences: "Preferensi User", profiles: "Profil", user_roles: "Role User",
  guest_users: "Pengguna Tamu", shared_links: "Link Berbagi",
  guest_audit_logs: "Log Audit Tamu", activity_logs: "Log Aktivitas",
  notifications: "Notifikasi", password_reset_tokens: "Token Reset Password",
  account_deletion_requests: "Request Hapus Akun", team_profiles: "Profil Tim",
  parent_portal_configs: "Portal Orang Tua", maintenance_alerts: "Alert Maintenance",
};

function getTableLabel(name: string): string {
  return TABLE_LABELS[name] || name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}
function getTableIcon(name: string): string {
  return TABLE_ICONS[name] || "📁";
}

interface DatabaseStats { [key: string]: number; }

interface BackupData {
  version: string;
  schemaVersion: string;
  exportedAt: string;
  sourceUrl: string;
  tables: Record<string, any[]>;
  metadata: {
    tableCount: number;
    totalRecords: number;
    recordsByTable: Record<string, number>;
    userIds: string[];
  };
}

interface DatabaseManagementPanelProps {
  adminPassword: string;
}

export function DatabaseManagementPanel({ adminPassword }: DatabaseManagementPanelProps) {
  const { toast } = useToast();
  
  // Dynamic stats (from edge function, like DatabaseOverviewPanel)
  const [stats, setStats] = useState<DatabaseStats | null>(null);
  const [discoveredTables, setDiscoveredTables] = useState<string[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(0);
  
  // Table detail modal
  const [detailTable, setDetailTable] = useState<string | null>(null);
  const [detailData, setDetailData] = useState<any[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailPage, setDetailPage] = useState(1);
  const [detailPageSize, setDetailPageSize] = useState(50);
  const [detailTotalCount, setDetailTotalCount] = useState(0);
  
  // Backup/Restore/Delete
  const [backupLoading, setBackupLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [showDeletePanel, setShowDeletePanel] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"idle" | "testing" | "success" | "error">("idle");

  // Fetch stats dynamically (same as DatabaseOverviewPanel)
  const fetchDetailedStats = useCallback(async () => {
    if (!adminPassword) {
      toast({ variant: "destructive", title: "Password Diperlukan", description: "Masukkan password backend terlebih dahulu di tab Kredensial" });
      return;
    }
    setStatsLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "stats", password: adminPassword }),
      });
      const result = await response.json();
      if (result.success) {
        setStats(result.stats);
        setTotalRecords(result.totalRecords || 0);
        setDiscoveredTables(result.discoveredTables || Object.keys(result.stats));
        toast({ title: "Statistik Dimuat", description: `Total ${result.totalRecords.toLocaleString()} record dari ${(result.discoveredTables || Object.keys(result.stats)).length} tabel` });
      } else {
        toast({ variant: "destructive", title: "Gagal Memuat Statistik", description: result.error || "Terjadi kesalahan" });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error Koneksi", description: "Gagal terhubung ke server" });
    } finally {
      setStatsLoading(false);
    }
  }, [adminPassword, toast]);

  // Fetch table detail data
  const fetchTableDetail = useCallback(async (tableName: string, pageNum = 1, pageSizeNum = 50) => {
    if (!adminPassword) return;
    setDetailTable(tableName);
    setDetailPage(pageNum);
    setDetailPageSize(pageSizeNum);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ 
          action: "table-detail", 
          password: adminPassword, 
          table: tableName,
          page: pageNum,
          pageSize: pageSizeNum
        }),
      });
      const result = await response.json();
      if (result.success) {
        setDetailData(result.data || []);
        setDetailTotalCount(result.totalCount || 0);
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.error || "Gagal memuat detail tabel" });
        setDetailTable(null);
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat detail tabel" });
      setDetailTable(null);
    } finally {
      setDetailLoading(false);
    }
  }, [adminPassword, toast]);

  // Test connection
  const testConnection = useCallback(async () => {
    if (!adminPassword) return;
    setConnectionStatus("testing");
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "test-connection", password: adminPassword }),
      });
      const result = await response.json();
      setConnectionStatus(result.success ? "success" : "error");
      toast({ title: result.success ? "Koneksi Berhasil" : "Koneksi Gagal", description: result.message, variant: result.success ? "default" : "destructive" });
    } catch (error) {
      setConnectionStatus("error");
      toast({ variant: "destructive", title: "Error", description: "Gagal terhubung ke Edge Function" });
    }
  }, [adminPassword, toast]);

  // Backup
  const handleBackup = useCallback(async () => {
    if (!adminPassword) return;
    setBackupLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "backup", password: adminPassword, sourceUrl: window.location.origin }),
      });
      const result = await response.json();
      if (result.success) {
        const dataStr = JSON.stringify(result.data, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `sipena-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setLastBackup(new Date().toLocaleString("id-ID"));
        toast({ title: "Backup Berhasil", description: `${result.data.metadata.totalRecords.toLocaleString()} record dari ${result.data.metadata.tableCount} tabel` });
      } else {
        toast({ variant: "destructive", title: "Backup Gagal", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Gagal melakukan backup" });
    } finally {
      setBackupLoading(false);
    }
  }, [adminPassword, toast]);

  // Restore
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === "application/json" || file.name.endsWith(".json"))) {
      setRestoreFile(file);
    } else {
      toast({ variant: "destructive", title: "Format Salah", description: "Pilih file JSON backup yang valid" });
    }
  };

  const handleRestore = useCallback(async () => {
    if (!adminPassword || !restoreFile) return;
    setRestoreLoading(true);
    try {
      const fileContent = await restoreFile.text();
      const backupData: BackupData = JSON.parse(fileContent);
      if (!backupData.version || !backupData.tables) {
        toast({ variant: "destructive", title: "Format Invalid", description: "File backup tidak valid" });
        setRestoreLoading(false);
        return;
      }
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "restore", password: adminPassword, backupData }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: "Restore Berhasil", description: `${result.summary.totalSuccess.toLocaleString()} record diimpor` });
        setRestoreFile(null);
        fetchDetailedStats();
      } else {
        toast({ variant: "destructive", title: "Restore Gagal", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Gagal restore. Pastikan file JSON valid." });
    } finally {
      setRestoreLoading(false);
    }
  }, [adminPassword, restoreFile, toast, fetchDetailedStats]);

  // Delete
  const toggleTable = (key: string) => {
    const s = new Set(selectedTables);
    if (s.has(key)) {
      s.delete(key);
    } else {
      s.add(key);
    }
    setSelectedTables(s);
  };

  const selectAllTables = () => {
    if (selectedTables.size === discoveredTables.length) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(discoveredTables));
    }
  };

  const handleDelete = useCallback(async () => {
    if (!adminPassword || selectedTables.size === 0 || deleteConfirm !== "HAPUS") {
      toast({ variant: "destructive", title: "Konfirmasi Salah", description: "Ketik HAPUS untuk mengonfirmasi" });
      return;
    }
    setDeleteLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "delete", password: adminPassword, tables: Array.from(selectedTables) }),
      });
      const result = await response.json();
      if (result.success) {
        toast({ title: "Penghapusan Berhasil", description: `${result.summary.totalRecordsDeleted.toLocaleString()} record dihapus` });
        setSelectedTables(new Set());
        setDeleteConfirm("");
        setShowDeletePanel(false);
        fetchDetailedStats();
      } else {
        toast({ variant: "destructive", title: "Gagal", description: result.error });
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: "Gagal menghapus data" });
    } finally {
      setDeleteLoading(false);
    }
  }, [adminPassword, selectedTables, deleteConfirm, toast, fetchDetailedStats]);

  if (!adminPassword) {
    return (
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-400">
          Password backend belum diatur. Buka tab <span className="text-amber-400 font-medium">Kredensial</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection & Actions */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-border bg-card/50">
        <Button
          variant="ghost"
          size="sm"
          onClick={testConnection}
          disabled={connectionStatus === "testing"}
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          {connectionStatus === "testing" ? <Loader2 className="w-4 h-4 animate-spin" /> :
           connectionStatus === "success" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> :
           connectionStatus === "error" ? <XCircle className="w-4 h-4 text-red-400" /> :
           <HardDrive className="w-4 h-4" />}
          <span className="text-xs">Test Koneksi</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchDetailedStats}
          disabled={statsLoading}
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCw className={`w-4 h-4 ${statsLoading ? "animate-spin" : ""}`} />
          <span className="text-xs">Refresh</span>
        </Button>
        {connectionStatus === "success" && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium ml-auto">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Terhubung
          </span>
        )}
      </div>

      {/* Dynamic Stats Grid */}
      <Card className="border-border bg-card/50">
        <CardHeader className="border-b border-border bg-card/85">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-blue-400" />
            Statistik Detail Per Tabel
          </CardTitle>
          <CardDescription className="text-xs">
            {totalRecords > 0
              ? `Total: ${totalRecords.toLocaleString()} record dari ${discoveredTables.length} tabel • Klik tabel untuk detail`
              : "Klik 'Refresh' untuk memuat statistik"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : stats && discoveredTables.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {discoveredTables.map((tableName) => (
                <button
                  key={tableName}
                  onClick={() => fetchTableDetail(tableName)}
                  className="p-3 rounded-lg border bg-card hover:bg-accent/50 hover:border-primary/40 transition-all text-left group cursor-pointer"
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
                  <div className="flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Eye className="w-3 h-3 text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground">Lihat detail</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Klik "Refresh Stats" untuk memuat statistik detail
            </p>
          )}
        </CardContent>
      </Card>

      {/* Table Detail Modal */}
      <Dialog open={!!detailTable} onOpenChange={() => setDetailTable(null)}>
        <DialogContent className="sm:max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Table2 className="w-5 h-5" />
              {detailTable && `${getTableIcon(detailTable)} ${getTableLabel(detailTable)}`}
              {detailData && (
                <Badge variant="secondary" className="ml-2">
                  Total {detailTotalCount.toLocaleString()} records
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailData && detailData.length > 0 ? (
            <>
              <ScrollArea className="flex-1 min-h-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-card z-10">
                      <tr>
                        {Object.keys(detailData[0]).map(col => (
                          <th key={col} className="px-2 py-1.5 text-left font-semibold text-muted-foreground border-b border-border whitespace-nowrap">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {detailData.map((row, i) => (
                        <tr key={i} className="hover:bg-muted/50 transition-colors">
                          {Object.values(row).map((val: any, j) => (
                            <td key={j} className="px-2 py-1.5 border-b border-border/50 max-w-[200px] truncate" title={String(val ?? "")}>
                              {val === null ? <span className="text-muted-foreground/40 italic">null</span> : String(val)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
              
              {/* Table Detail Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border mt-2 gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Halaman {detailPage} dari {Math.ceil(detailTotalCount / detailPageSize) || 1}
                  </span>
                  <span className="text-muted-foreground/30 text-xs">|</span>
                  <span className="text-xs text-muted-foreground">
                    Tampil {detailData.length} records
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => fetchTableDetail(detailTable!, detailPage - 1, detailPageSize)}
                    disabled={detailPage === 1 || detailLoading}
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => fetchTableDetail(detailTable!, detailPage + 1, detailPageSize)}
                    disabled={detailPage >= Math.ceil(detailTotalCount / detailPageSize) || detailLoading}
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Tabel kosong</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Section */}
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Backup Database</CardTitle>
          <CardDescription>Ekspor seluruh database ke file JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalRecords > 50000 && (
            <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">Peringatan Ukuran Database Besar</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Database Anda memiliki <span className="font-semibold text-foreground">{totalRecords.toLocaleString()}</span> records. Melakukan ekspor JSON melalui browser untuk database &gt; 50.000 records dapat menyebabkan memori browser habis atau request timeout. Disarankan menggunakan tool native seperti <code>pg_dump</code> atau Supabase CLI untuk backup skala enterprise.
                </p>
              </div>
            </div>
          )}
          <Button onClick={handleBackup} disabled={backupLoading} className="w-full sm:w-auto">
            {backupLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sedang Backup...</> : <><Download className="w-4 h-4 mr-2" />Backup Sekarang</>}
          </Button>
          {lastBackup && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
               <Clock className="w-3 h-3" />Backup terakhir: {lastBackup}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Restore Section */}
      <Card className="border-border bg-card/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Upload className="w-5 h-5" />Restore Database</CardTitle>
          <CardDescription>Impor data dari file backup JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Perhatian</AlertTitle>
            <AlertDescription className="text-xs">
              Restore akan menambahkan data ke database. Data yang sudah ada dengan ID yang sama akan diperbarui.
            </AlertDescription>
          </Alert>
          <div className="flex items-center gap-3">
            <Input type="file" accept=".json" onChange={handleFileSelect} className="flex-1 bg-background text-foreground border-border" />
            <Button onClick={handleRestore} disabled={restoreLoading || !restoreFile}>
              {restoreLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Upload className="w-4 h-4 mr-2" />}
              Restore
            </Button>
          </div>
          {restoreFile && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <FileJson className="w-3 h-3" />{restoreFile.name} ({(restoreFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Delete Section */}
      <Card className="border-destructive/30 bg-destructive/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive"><Trash2 className="w-5 h-5" />Hapus Data</CardTitle>
          <CardDescription>Hapus seluruh data dari tabel yang dipilih</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!showDeletePanel ? (
            <Button variant="destructive" onClick={() => { setShowDeletePanel(true); fetchDetailedStats(); }}>
              <Trash2 className="w-4 h-4 mr-2" />Buka Panel Penghapusan
            </Button>
          ) : (
            <>
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>PERINGATAN!</AlertTitle>
                <AlertDescription className="text-xs">
                  Data yang dihapus tidak dapat dikembalikan. Pastikan Anda sudah backup terlebih dahulu.
                </AlertDescription>
              </Alert>
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Pilih Tabel ({selectedTables.size} dipilih)</Label>
                <Button variant="ghost" size="sm" onClick={selectAllTables} className="text-xs h-7">
                  {selectedTables.size === discoveredTables.length ? "Batalkan Semua" : "Pilih Semua"}
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                {(discoveredTables.length > 0 ? discoveredTables : []).map(tableName => (
                  <label key={tableName} className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer text-xs">
                    <Checkbox checked={selectedTables.has(tableName)} onCheckedChange={() => toggleTable(tableName)} />
                    <span>{getTableIcon(tableName)}</span>
                    <span className="truncate">{getTableLabel(tableName)}</span>
                  </label>
                ))}
              </div>
              {selectedTables.size > 0 && (
                <div className="space-y-3 pt-2">
                  <Separator />
                  <div className="space-y-2">
                    <Label className="text-xs">Ketik <strong>HAPUS</strong> untuk konfirmasi</Label>
                    <Input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="HAPUS" className="font-mono" />
                  </div>
                  <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading || deleteConfirm !== "HAPUS"}>
                    {deleteLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
                    Hapus {selectedTables.size} Tabel
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

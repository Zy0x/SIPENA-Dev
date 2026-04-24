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
  HardDrive, FileJson, Clock, Eye, Table2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";

// Icons for known tables
const TABLE_ICONS: Record<string, string> = {
  academic_years: "📅", semesters: "📆", classes: "🏫", students: "👨‍🎓",
  subjects: "📚", chapters: "📖", assignments: "📝", grades: "💯",
  attendance: "📋", user_preferences: "⚙️", profiles: "👤", user_roles: "🔐",
  guest_users: "👥", shared_links: "🔗", guest_audit_logs: "📊",
  activity_logs: "📋", notifications: "🔔", password_reset_tokens: "🔑",
  account_deletion_requests: "🗑️", team_profiles: "👥", parent_portal_configs: "👪",
  maintenance_alerts: "🔔",
};

const TABLE_LABELS: Record<string, string> = {
  academic_years: "Tahun Akademik", semesters: "Semester", classes: "Kelas",
  students: "Siswa", subjects: "Mata Pelajaran", chapters: "Bab/Chapter",
  assignments: "Tugas", grades: "Nilai", attendance: "Presensi",
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
  const fetchTableDetail = useCallback(async (tableName: string) => {
    if (!adminPassword) return;
    setDetailTable(tableName);
    setDetailLoading(true);
    setDetailData(null);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-database`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}` },
        body: JSON.stringify({ action: "table-detail", password: adminPassword, table: tableName }),
      });
      const result = await response.json();
      if (result.success) {
        setDetailData(result.data || []);
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
    s.has(key) ? s.delete(key) : s.add(key);
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
      <Card className="border-status-connecting/50 bg-status-connecting/5">
        <CardContent className="flex items-center gap-3 py-6">
          <AlertTriangle className="w-5 h-5 text-status-connecting" />
          <span>Password backend belum diatur. Buka tab <strong>Kredensial</strong>.</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection & Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" size="sm" onClick={testConnection} disabled={connectionStatus === "testing"}>
          {connectionStatus === "testing" ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> :
           connectionStatus === "success" ? <CheckCircle className="w-4 h-4 mr-2 text-grade-pass" /> :
           connectionStatus === "error" ? <XCircle className="w-4 h-4 mr-2 text-destructive" /> :
           <HardDrive className="w-4 h-4 mr-2" />}
          Test Koneksi
        </Button>
        <Button variant="outline" size="sm" onClick={fetchDetailedStats} disabled={statsLoading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? "animate-spin" : ""}`} />
          Refresh Stats
        </Button>
        {connectionStatus === "success" && (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="w-3 h-3" />
            Terhubung
          </Badge>
        )}
      </div>

      {/* Dynamic Stats Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Statistik Detail Per Tabel
          </CardTitle>
          <CardDescription>
            {totalRecords > 0
              ? `Total: ${totalRecords.toLocaleString()} record dari ${discoveredTables.length} tabel • Klik tabel untuk melihat detail`
              : "Klik 'Refresh Stats' untuk memuat statistik"}
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
                <Badge variant="secondary" className="ml-2">{detailData.length} records</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : detailData && detailData.length > 0 ? (
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
                    {detailData.slice(0, 100).map((row, i) => (
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
                {detailData.length > 100 && (
                  <p className="text-center text-xs text-muted-foreground py-3">
                    Menampilkan 100 dari {detailData.length} record
                  </p>
                )}
              </div>
            </ScrollArea>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <Database className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Tabel kosong</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Download className="w-5 h-5" />Backup Database</CardTitle>
          <CardDescription>Ekspor seluruh database ke file JSON</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
      <Card>
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
            <Input type="file" accept=".json" onChange={handleFileSelect} className="flex-1" />
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
      <Card className="border-destructive/30">
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

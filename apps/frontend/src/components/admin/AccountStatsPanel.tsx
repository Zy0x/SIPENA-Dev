import { useState, useCallback, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RefreshCcw, Search, ChevronDown, ChevronUp, Trash2, AlertTriangle } from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface AccountStat {
  userId: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  emailConfirmed: boolean;
  stats: {
    academicYears: number;
    classes: number;
    students: number;
    subjects: number;
    grades: number;
    assignments: number;
    total: number;
  };
}

interface AccountStatsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  adminPassword: string;
}

const DATA_CATEGORIES = [
  { key: "academic_years", label: "Tahun Akademik", icon: "📅" },
  { key: "semesters", label: "Semester", icon: "📆" },
  { key: "classes", label: "Kelas", icon: "🏫" },
  { key: "students", label: "Siswa", icon: "👨‍🎓" },
  { key: "subjects", label: "Mata Pelajaran", icon: "📚" },
  { key: "chapters", label: "Bab/Chapter", icon: "📖" },
  { key: "assignments", label: "Tugas", icon: "📝" },
  { key: "grades", label: "Nilai", icon: "💯" },
  { key: "user_preferences", label: "Preferensi", icon: "⚙️" },
  { key: "shared_links", label: "Link Berbagi", icon: "🔗" },
  { key: "activity_logs", label: "Log Aktivitas", icon: "📊" },
] as const;

export function AccountStatsPanel({ isOpen, onClose, adminPassword }: AccountStatsPanelProps) {
  const { toast } = useEnhancedToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AccountStat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "records">("recent");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  // Fetch account stats
  const fetchAccountStats = useCallback(async () => {
    if (!adminPassword) {
      toast({
        title: "Password Diperlukan",
        description: "Masukkan password backend terlebih dahulu",
        variant: "error",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-account-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "get-account-stats",
          password: adminPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStats(result.stats || []);
        toast({
          title: "Statistik Dimuat",
          description: `${result.totalAccounts} akun ditemukan`,
        });
      } else {
        toast({
          title: "Gagal Memuat",
          description: result.error || "Terjadi kesalahan",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal mengambil data statistik",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [adminPassword, toast]);

  // Auto-load when dialog opens
  useEffect(() => {
    if (isOpen && stats.length === 0) {
      fetchAccountStats();
    }
  }, [isOpen, stats.length, fetchAccountStats]);

  // Delete user data categories
  const handleDeleteDataCategories = useCallback(async (userId: string) => {
    if (selectedCategories.size === 0) {
      toast({
        title: "Pilih Kategori",
        description: "Pilih minimal satu kategori untuk dihapus",
        variant: "error",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-account-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "delete-user-data",
          password: adminPassword,
          userId,
          tables: Array.from(selectedCategories),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setSelectedCategories(new Set());
        fetchAccountStats();
        toast({
          title: "Data Dihapus",
          description: `${result.deletedCount} record berhasil dihapus`,
        });
      } else {
        toast({
          title: "Gagal Menghapus",
          description: result.error || "Terjadi kesalahan",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus data",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [selectedCategories, adminPassword, toast, fetchAccountStats]);

  // Delete entire user account
  const handleDeleteEntireUser = useCallback(async (userId: string, email: string) => {
    if (deleteConfirm !== `HAPUS ${email.toUpperCase()}`) {
      toast({
        title: "Konfirmasi Salah",
        description: "Ketik teks konfirmasi dengan benar",
        variant: "error",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-account-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "delete-entire-user",
          password: adminPassword,
          userId,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setDeletingUserId(null);
        setDeleteConfirm("");
        fetchAccountStats();
        toast({
          title: "Akun Dihapus",
          description: `Akun ${email} dan semua datanya telah dihapus`,
        });
      } else {
        toast({
          title: "Gagal Menghapus",
          description: result.error || "Terjadi kesalahan",
          variant: "error",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Gagal menghapus akun",
        variant: "error",
      });
    } finally {
      setIsDeleting(false);
    }
  }, [deleteConfirm, adminPassword, toast, fetchAccountStats]);

  // Filter dan sort data
  const filteredStats = stats
    .filter((stat) =>
      stat.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stat.userId.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "records") {
        return b.stats.total - a.stats.total;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

  const toggleCategory = (category: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Statistik & Manajemen Per Akun</DialogTitle>
          <DialogDescription>
            Kelola data dan hapus akun dengan kontrol administratif profesional
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 flex-1 overflow-hidden">
          {/* Search & Controls */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari email atau user ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "recent" | "records")}
                className="px-3 py-2 border rounded-md text-sm bg-background"
              >
                <option value="recent">Terbaru</option>
                <option value="records">Paling Banyak Data</option>
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchAccountStats}
                disabled={isLoading}
              >
                <RefreshCcw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Stats List */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Memuat data akun...</p>
                </div>
              </div>
            ) : filteredStats.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? "Tidak ada akun yang cocok" : "Belum ada akun"}
                </p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {filteredStats.map((account) => (
                  <div
                    key={account.userId}
                    className="border rounded-lg bg-card overflow-hidden"
                  >
                    {/* Header - Click to expand */}
                    <button
                      onClick={() =>
                        setExpandedUser(
                          expandedUser === account.userId ? null : account.userId
                        )
                      }
                      className="w-full p-3 hover:bg-accent/50 transition flex items-center justify-between"
                    >
                      <div className="flex-1 text-left min-w-0">
                        <p className="font-medium text-sm truncate">{account.email}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          ID: {account.userId.slice(0, 12)}...
                        </p>
                      </div>
                      <div className="flex gap-2 items-center flex-wrap justify-end">
                        {account.emailConfirmed ? (
                          <Badge variant="default" className="text-xs">
                            ✓ Verified
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Unverified
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs font-semibold">
                          {account.stats.total} Records
                        </Badge>
                        {expandedUser === account.userId ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </button>

                    {/* Expanded Content */}
                    {expandedUser === account.userId && (
                      <>
                        <Separator />
                        <div className="p-4 space-y-4">
                          {/* Data Breakdown Grid */}
                          <div>
                            <p className="text-xs font-semibold mb-2 text-muted-foreground">
                              BREAKDOWN DATA
                            </p>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Tahun</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.academicYears}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Kelas</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.classes}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Siswa</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.students}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Mapel</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.subjects}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Nilai</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.grades}
                                </p>
                              </div>
                              <div className="p-2 bg-muted rounded text-center">
                                <p className="text-xs text-muted-foreground">Tugas</p>
                                <p className="text-lg font-semibold">
                                  {account.stats.assignments}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Delete Categories Section */}
                          <div>
                            <p className="text-xs font-semibold mb-2 text-muted-foreground">
                              HAPUS DATA KATEGORI
                            </p>
                            <div className="border rounded-lg p-3 bg-muted/30 space-y-2 max-h-40 overflow-y-auto">
                              {DATA_CATEGORIES.map((category) => (
                                <div
                                  key={category.key}
                                  className="flex items-center gap-2"
                                >
                                  <Checkbox
                                    id={`${account.userId}-${category.key}`}
                                    checked={selectedCategories.has(category.key)}
                                    onCheckedChange={() => toggleCategory(category.key)}
                                  />
                                  <label
                                    htmlFor={`${account.userId}-${category.key}`}
                                    className="text-xs cursor-pointer flex items-center gap-1"
                                  >
                                    <span>{category.icon}</span>
                                    <span>{category.label}</span>
                                  </label>
                                </div>
                              ))}
                            </div>
                            {selectedCategories.size > 0 && (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteDataCategories(account.userId)}
                                disabled={isDeleting}
                                className="w-full mt-2"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Hapus {selectedCategories.size} Kategori
                              </Button>
                            )}
                          </div>

                          {/* Delete Entire Account Section */}
                          <div>
                            <p className="text-xs font-semibold mb-2 text-destructive">
                              HAPUS AKUN SEPENUHNYA
                            </p>
                            {deletingUserId === account.userId ? (
                              <div className="space-y-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                                <Alert variant="destructive">
                                  <AlertTriangle className="h-4 w-4" />
                                  <AlertTitle>Peringatan Serius</AlertTitle>
                                  <AlertDescription className="text-xs">
                                    Tindakan ini akan menghapus akun dan SEMUA data pengguna secara
                                    permanen. Tidak dapat dibatalkan!
                                  </AlertDescription>
                                </Alert>
                                <div className="space-y-2">
                                  <label className="text-xs font-medium">
                                    Ketik:{" "}
                                    <span className="font-mono font-bold text-destructive">
                                      HAPUS {account.email.toUpperCase()}
                                    </span>
                                  </label>
                                  <Input
                                    placeholder="Konfirmasi penghapusan..."
                                    value={deleteConfirm}
                                    onChange={(e) => setDeleteConfirm(e.target.value)}
                                    className="text-xs"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setDeletingUserId(null);
                                      setDeleteConfirm("");
                                    }}
                                    disabled={isDeleting}
                                    className="flex-1"
                                  >
                                    Batal
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() =>
                                      handleDeleteEntireUser(
                                        account.userId,
                                        account.email
                                      )
                                    }
                                    disabled={
                                      isDeleting ||
                                      deleteConfirm !==
                                        `HAPUS ${account.email.toUpperCase()}`
                                    }
                                    className="flex-1"
                                  >
                                    {isDeleting ? (
                                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-4 h-4 mr-2" />
                                    )}
                                    Hapus Sekarang
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setDeletingUserId(account.userId)}
                                className="w-full"
                              >
                                <AlertTriangle className="w-4 h-4 mr-2" />
                                Hapus Akun & Semua Data
                              </Button>
                            )}
                          </div>

                          {/* Account Info */}
                          <Separator />
                          <div className="text-xs text-muted-foreground space-y-1">
                            <p>
                              Terdaftar:{" "}
                              {new Date(account.createdAt).toLocaleDateString(
                                "id-ID"
                              )}
                            </p>
                            {account.lastSignInAt ? (
                              <p>
                                Akses terakhir:{" "}
                                {new Date(account.lastSignInAt).toLocaleDateString(
                                  "id-ID",
                                  {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  }
                                )}
                              </p>
                            ) : (
                              <p>Belum pernah login</p>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Summary Footer */}
          {filteredStats.length > 0 && (
            <div className="border-t pt-3 text-xs text-muted-foreground">
              Menampilkan {filteredStats.length} dari {stats.length} akun • Total{" "}
              {filteredStats.reduce((sum, s) => sum + s.stats.total, 0)} records
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

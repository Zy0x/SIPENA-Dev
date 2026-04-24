import { useState, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  RefreshCcw,
  Search,
  ChevronDown,
  ChevronUp,
  Trash2,
  AlertTriangle,
  Users,
  Filter,
  Zap,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/lib/supabase-external";

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

interface InlineAccountStatsProps {
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

type SortBy = "recent" | "records" | "email-asc" | "email-desc";
type FilterBy = "all" | "verified" | "unverified" | "with-data" | "empty";

export function InlineAccountStats({ adminPassword }: InlineAccountStatsProps) {
  const { toast } = useEnhancedToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AccountStat[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Fetch account stats
  const fetchAccountStats = useCallback(async () => {
    if (!adminPassword) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-account-stats`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
        },
        body: JSON.stringify({
          action: "get-account-stats",
          password: adminPassword,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStats(result.stats || []);
        setIsLive(true);
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

  // Auto-load when password is available
  useEffect(() => {
    if (adminPassword && stats.length === 0) {
      fetchAccountStats();
    }
  }, [adminPassword, stats.length, fetchAccountStats]);

  // Delete user data categories
  const handleDeleteDataCategories = useCallback(
    async (userId: string) => {
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
            Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
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
    },
    [selectedCategories, adminPassword, toast, fetchAccountStats]
  );

  // Delete entire user account
  const handleDeleteEntireUser = useCallback(
    async (userId: string, email: string) => {
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
            Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
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
    },
    [deleteConfirm, adminPassword, toast, fetchAccountStats]
  );

  // Filter and sort data
  const filteredAndSortedStats = useMemo(() => {
    let result = stats.filter((stat) => {
      // Search filter
      const matchesSearch =
        stat.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        stat.userId.toLowerCase().includes(searchQuery.toLowerCase());

      // Category filter
      let matchesFilter = true;
      switch (filterBy) {
        case "verified":
          matchesFilter = stat.emailConfirmed;
          break;
        case "unverified":
          matchesFilter = !stat.emailConfirmed;
          break;
        case "with-data":
          matchesFilter = stat.stats.total > 0;
          break;
        case "empty":
          matchesFilter = stat.stats.total === 0;
          break;
      }

      return matchesSearch && matchesFilter;
    });

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "records":
          return b.stats.total - a.stats.total;
        case "email-asc":
          return a.email.localeCompare(b.email);
        case "email-desc":
          return b.email.localeCompare(a.email);
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

    return result;
  }, [stats, searchQuery, sortBy, filterBy]);

  // Paginated data
  const paginatedStats = useMemo(() => {
    return filteredAndSortedStats.slice(0, pageSize);
  }, [filteredAndSortedStats, pageSize]);

  const toggleCategory = (category: string) => {
    const newSet = new Set(selectedCategories);
    if (newSet.has(category)) {
      newSet.delete(category);
    } else {
      newSet.add(category);
    }
    setSelectedCategories(newSet);
  };

  if (!adminPassword) {
    return (
      <Alert className="border-warning/50 bg-warning/5">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <AlertDescription>
          Password backend diperlukan untuk memuat statistik akun. Buka tab{" "}
          <strong>Kredensial</strong>.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Manajemen Akun
            </CardTitle>
            {isLive && (
              <Badge variant="default" className="gap-1 bg-grade-pass/90 hover:bg-grade-pass">
                <Zap className="w-3 h-3" />
                Live Sync
              </Badge>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={fetchAccountStats} disabled={isLoading}>
            <RefreshCcw className={`w-4 h-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          {stats.length} akun terdaftar • Menampilkan {paginatedStats.length} dari{" "}
          {filteredAndSortedStats.length}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search & Controls */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari email atau user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select value={filterBy} onValueChange={(v) => setFilterBy(v as FilterBy)}>
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="unverified">Belum Verifikasi</SelectItem>
                <SelectItem value="with-data">Ada Data</SelectItem>
                <SelectItem value="empty">Kosong</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortBy)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Terbaru</SelectItem>
                <SelectItem value="records">Paling Banyak Data</SelectItem>
                <SelectItem value="email-asc">Email (A-Z)</SelectItem>
                <SelectItem value="email-desc">Email (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={pageSize.toString()}
              onValueChange={(v) => setPageSize(parseInt(v))}
            >
              <SelectTrigger className="w-[90px]">
                <SelectValue placeholder="Limit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Stats List */}
        <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Memuat data akun...</p>
              </div>
            </div>
          ) : paginatedStats.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-sm text-muted-foreground">
                {searchQuery || filterBy !== "all"
                  ? "Tidak ada akun yang cocok"
                  : "Belum ada akun"}
              </p>
            </div>
          ) : (
            paginatedStats.map((account) => (
              <div
                key={account.userId}
                className="border rounded-lg bg-card overflow-hidden"
              >
                {/* Header - Click to expand */}
                <button
                  onClick={() =>
                    setExpandedUser(expandedUser === account.userId ? null : account.userId)
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
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Tahun</p>
                            <p className="text-lg font-semibold">{account.stats.academicYears}</p>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Kelas</p>
                            <p className="text-lg font-semibold">{account.stats.classes}</p>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Siswa</p>
                            <p className="text-lg font-semibold">{account.stats.students}</p>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Mapel</p>
                            <p className="text-lg font-semibold">{account.stats.subjects}</p>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Nilai</p>
                            <p className="text-lg font-semibold">{account.stats.grades}</p>
                          </div>
                          <div className="p-2 bg-muted rounded text-center">
                            <p className="text-xs text-muted-foreground">Tugas</p>
                            <p className="text-lg font-semibold">{account.stats.assignments}</p>
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
                            <div key={category.key} className="flex items-center gap-2">
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
                        <p className="text-xs font-semibold mb-2 text-muted-foreground">
                          HAPUS SELURUH AKUN
                        </p>
                        {deletingUserId === account.userId ? (
                          <div className="border border-destructive/50 rounded-lg p-3 bg-destructive/5 space-y-3">
                            <p className="text-sm text-destructive">
                              ⚠️ Aksi ini tidak dapat dibatalkan. Semua data akun akan dihapus
                              permanen.
                            </p>
                            <Input
                              placeholder={`Ketik: HAPUS ${account.email.toUpperCase()}`}
                              value={deleteConfirm}
                              onChange={(e) => setDeleteConfirm(e.target.value)}
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setDeletingUserId(null);
                                  setDeleteConfirm("");
                                }}
                                className="flex-1"
                              >
                                Batal
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleDeleteEntireUser(account.userId, account.email)
                                }
                                disabled={isDeleting}
                                className="flex-1"
                              >
                                {isDeleting ? (
                                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4 mr-2" />
                                )}
                                Konfirmasi Hapus
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingUserId(account.userId)}
                            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <AlertTriangle className="w-4 h-4 mr-2" />
                            Hapus Akun dan Semua Data
                          </Button>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        {/* Show more indicator */}
        {filteredAndSortedStats.length > pageSize && (
          <p className="text-xs text-center text-muted-foreground pt-2">
            Menampilkan {pageSize} dari {filteredAndSortedStats.length} akun. Ubah limit untuk
            melihat lebih banyak.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

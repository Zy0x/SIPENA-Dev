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
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
  Users,
  Filter,
  Zap,
} from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

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
    grade_formula_settings?: number;
    assignments: number;
    total: number;
  } | null;
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
  { key: "grade_formula_settings", label: "Rumus Nilai", icon: "Fx" },
  { key: "user_preferences", label: "Preferensi", icon: "⚙️" },
  { key: "shared_links", label: "Link Berbagi", icon: "🔗" },
  { key: "activity_logs", label: "Log Aktivitas", icon: "📊" },
] as const;

type SortBy = "recent" | "records" | "email-asc" | "email-desc";
type FilterBy = "all" | "verified" | "unverified";

export function InlineAccountStats({ adminPassword }: InlineAccountStatsProps) {
  const { toast } = useEnhancedToast();
  const [isLoading, setIsLoading] = useState(false);
  const [stats, setStats] = useState<AccountStat[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [filterBy, setFilterBy] = useState<FilterBy>("all");
  const [pageSize, setPageSize] = useState<number>(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [userStatsLoading, setUserStatsLoading] = useState<Record<string, boolean>>({});

  // Fetch account stats with paginated/filter options
  const fetchAccountStats = useCallback(
    async (
      pageVal: number,
      sizeVal: number,
      searchVal: string,
      filterVal: string,
      sortVal: string
    ) => {
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
            page: pageVal,
            pageSize: sizeVal,
            search: searchVal,
            filter: filterVal,
            sort: sortVal,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setStats(result.stats || []);
          setTotalAccounts(result.totalAccounts || 0);
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
    },
    [adminPassword, toast]
  );

  // Lazy-load single user stats on expand
  const fetchSingleUserStats = useCallback(
    async (userId: string) => {
      if (!adminPassword || userStatsLoading[userId]) return;

      setUserStatsLoading((prev) => ({ ...prev, [userId]: true }));
      try {
        const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-account-stats`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          },
          body: JSON.stringify({
            action: "get-single-user-stats",
            password: adminPassword,
            userId,
          }),
        });

        const result = await response.json();

        if (result.success) {
          // Update the stats list with the loaded user stats
          setStats((prevStats) =>
            prevStats.map((s) =>
              s.userId === userId ? { ...s, stats: result.stats } : s
            )
          );
        } else {
          toast({
            title: "Gagal memuat detail data",
            description: result.error || "Terjadi kesalahan",
            variant: "error",
          });
        }
      } catch (error) {
        console.error("Error fetching single user stats:", error);
      } finally {
        setUserStatsLoading((prev) => ({ ...prev, [userId]: false }));
      }
    },
    [adminPassword, userStatsLoading, toast]
  );

  // Helper trigger to refresh current data
  const handleRefresh = useCallback(() => {
    fetchAccountStats(currentPage, pageSize, searchQuery, filterBy, sortBy);
  }, [currentPage, pageSize, searchQuery, filterBy, sortBy, fetchAccountStats]);

  // Debounce search query to search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setSearchQuery(searchTerm);
      setCurrentPage(1); // Reset page on new search query
    }, 400);

    return () => {
      clearTimeout(handler);
    };
  }, [searchTerm]);

  // Fetch data on page/filter/search changes
  useEffect(() => {
    if (adminPassword) {
      fetchAccountStats(currentPage, pageSize, searchQuery, filterBy, sortBy);
    }
  }, [adminPassword, currentPage, pageSize, searchQuery, filterBy, sortBy, fetchAccountStats]);

  const handleToggleExpand = (userId: string, currentStats: any) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      if (currentStats === null) {
        fetchSingleUserStats(userId);
      }
    }
  };

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
          handleRefresh();
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
    [selectedCategories, adminPassword, toast, handleRefresh]
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
          handleRefresh();
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
    [deleteConfirm, adminPassword, toast, handleRefresh]
  );

  // Paginated stats is directly the stats array since we paginate server-side
  const paginatedStats = stats;

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
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-slate-400">
          Password backend diperlukan untuk memuat statistik akun.{" "}
          <span className="text-amber-400 font-medium">Buka tab Kredensial</span>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card/85">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
            <Users className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">Manajemen Akun</p>
              {isLive && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live (Enterprise)
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalAccounts} akun terdaftar • Halaman {currentPage} dari {Math.ceil(totalAccounts / pageSize) || 1}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          disabled={isLoading}
          className="h-8 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <RefreshCcw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          <span className="hidden sm:inline text-xs">Refresh</span>
        </Button>
      </div>
      <div className="p-5 space-y-4">
        {/* Search & Controls */}
        <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
          <div className="flex-1 relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Cari email atau user ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Select 
              value={filterBy} 
              onValueChange={(v) => { 
                setFilterBy(v as FilterBy); 
                setCurrentPage(1); 
              }}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="verified">Terverifikasi</SelectItem>
                <SelectItem value="unverified">Belum Verifikasi</SelectItem>
              </SelectContent>
            </Select>
            <Select 
              value={sortBy} 
              onValueChange={(v) => { 
                setSortBy(v as SortBy); 
                setCurrentPage(1); 
              }}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Urutkan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recent">Terbaru</SelectItem>
                <SelectItem value="email-asc">Email (A-Z)</SelectItem>
                <SelectItem value="email-desc">Email (Z-A)</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={pageSize.toString()}
              onValueChange={(v) => {
                setPageSize(parseInt(v));
                setCurrentPage(1);
              }}
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
                {searchTerm || filterBy !== "all"
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
                  onClick={() => handleToggleExpand(account.userId, account.stats)}
                  className="w-full p-3 hover:bg-accent/50 transition flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
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
                      {account.stats !== null ? `${account.stats.total} Records` : "Klik detail..."}
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
                          BREAKDOWN DATA (LAZY-LOADED)
                        </p>
                        {userStatsLoading[account.userId] ? (
                          <div className="flex items-center justify-center py-6 bg-muted/30 rounded-lg">
                            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                            <span className="text-xs text-muted-foreground ml-2">Mengitung record...</span>
                          </div>
                        ) : account.stats === null ? (
                          <div className="flex flex-col items-center py-4 bg-muted/20 rounded-lg border border-dashed">
                            <p className="text-xs text-muted-foreground mb-2">Statistik belum dimuat</p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => fetchSingleUserStats(account.userId)}
                              className="text-xs h-7"
                            >
                              Hitung Data Akun
                            </Button>
                          </div>
                        ) : (
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
                        )}
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

        {/* Pagination Controls */}
        {totalAccounts > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between pt-4 border-t border-border mt-2 gap-2">
            <span className="text-xs text-muted-foreground">
              Total {totalAccounts} Akun • Halaman {currentPage} dari {Math.ceil(totalAccounts / pageSize) || 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1 || isLoading}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalAccounts / pageSize), p + 1))}
                disabled={currentPage >= Math.ceil(totalAccounts / pageSize) || isLoading}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

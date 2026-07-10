import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Bookmark,
  CalendarDays,
  Clock,
  FileSpreadsheet,
  HelpCircle,
  Info,
  LayoutDashboard,
  School,
  Search,
  Settings,
  Shield,
  Star,
  Trophy,
  Users,
  X,
} from "lucide-react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SearchItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
  category: string;
}

const searchableItems: SearchItem[] = [
  { title: "Dashboard", description: "Ringkasan data, statistik, dan prediksi nilai", href: "/dashboard", icon: LayoutDashboard, keywords: ["beranda", "home", "ringkasan", "statistik", "overview", "aktivitas", "progress", "kelas", "mapel"], category: "Halaman" },
  { title: "Kelas & Siswa", description: "Kelola kelas, tambah siswa, impor data", href: "/classes", icon: School, keywords: ["kelas", "siswa", "murid", "import", "tambah kelas", "daftar siswa", "hapus", "edit"], category: "Halaman" },
  { title: "Mata Pelajaran", description: "Kelola mata pelajaran, KKM, link berbagi", href: "/subjects", icon: BookOpen, keywords: ["mapel", "mata pelajaran", "kkm", "pelajaran", "subject", "tambah mapel", "kriteria"], category: "Halaman" },
  { title: "Input Nilai", description: "Input dan edit nilai siswa per mata pelajaran", href: "/grades", icon: FileSpreadsheet, keywords: ["nilai", "grade", "input", "spreadsheet", "bab", "tugas", "assignment", "sts", "sas", "rapor", "chapter"], category: "Halaman" },
  { title: "Presensi", description: "Kelola kehadiran siswa harian dan bulanan", href: "/attendance", icon: CalendarDays, keywords: ["presensi", "absensi", "kehadiran", "hadir", "izin", "sakit", "alpha", "dispensasi", "libur", "rekap", "bulanan", "harian"], category: "Halaman" },
  { title: "Laporan Nilai", description: "Lihat dan ekspor laporan nilai siswa", href: "/reports/grades", icon: BarChart3, keywords: ["laporan", "report", "ekspor", "pdf", "excel", "csv", "rapor", "cetak", "unduh"], category: "Laporan" },
  { title: "Ranking Siswa", description: "Peringkat siswa per mapel dan keseluruhan", href: "/reports/rankings", icon: Trophy, keywords: ["ranking", "peringkat", "juara", "terbaik", "rank", "top", "prestasi"], category: "Laporan" },
  { title: "Profil Saya", description: "Edit profil, foto, dan informasi akun", href: "/settings/profile", icon: Users, keywords: ["profil", "akun", "foto", "avatar", "nama", "email", "biodata"], category: "Pengaturan" },
  { title: "Keamanan Akun", description: "Ubah password dan pengaturan keamanan", href: "/settings/profile#security-section", icon: Shield, keywords: ["password", "keamanan", "security", "ubah password", "sandi", "2fa", "verifikasi"], category: "Pengaturan" },
  { title: "Pengaturan", description: "Pengaturan tampilan, tema, dan notifikasi", href: "/settings", icon: Settings, keywords: ["pengaturan", "settings", "tema", "dark mode", "gelap", "terang", "notifikasi", "palet", "warna"], category: "Pengaturan" },
  { title: "Tahun Ajaran", description: "Kelola tahun ajaran dan semester", href: "/settings", icon: Clock, keywords: ["tahun ajaran", "semester", "periode", "akademik", "ta"], category: "Pengaturan" },
  { title: "Panduan", description: "Bantuan dan panduan penggunaan aplikasi", href: "/help", icon: HelpCircle, keywords: ["bantuan", "help", "panduan", "cara", "tutorial", "faq", "petunjuk"], category: "Lainnya" },
  { title: "Tentang", description: "Informasi tentang SIPENA dan developer", href: "/about", icon: Info, keywords: ["tentang", "about", "versi", "developer", "info", "sipena", "changelog"], category: "Lainnya" },
  { title: "Ekspor Presensi", description: "Ekspor data kehadiran ke Excel, PDF, atau PNG", href: "/attendance", icon: CalendarDays, keywords: ["ekspor presensi", "cetak presensi", "download presensi", "png", "excel presensi"], category: "Fitur" },
  { title: "Hari Libur Kustom", description: "Tambah dan kelola hari libur sekolah", href: "/attendance", icon: Star, keywords: ["hari libur", "libur", "cuti", "holiday", "tanggal merah"], category: "Fitur" },
  { title: "Kegiatan Khusus", description: "Tandai tanggal khusus seperti ujian atau study tour", href: "/attendance", icon: Bookmark, keywords: ["kegiatan", "event", "ujian", "uts", "uas", "study tour", "class meeting", "kegiatan khusus"], category: "Fitur" },
  { title: "Struktur BAB", description: "Buat dan kelola BAB serta tugas per mata pelajaran", href: "/grades", icon: BookOpen, keywords: ["bab", "chapter", "struktur", "tugas", "assignment"], category: "Fitur" },
  { title: "Portal Orang Tua", description: "Buat laporan lengkap untuk dibagikan ke orang tua/wali", href: "/reports/portal", icon: Users, keywords: ["portal", "orang tua", "wali", "share", "link", "qr", "barcode", "laporan orang tua", "report"], category: "Laporan" },
];

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return searchableItems.filter((item) => item.category !== "Fitur");

    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);

    return searchableItems
      .map((item) => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const descLower = item.description.toLowerCase();

        if (titleLower === q) score += 100;
        else if (titleLower.startsWith(q)) score += 80;
        else if (titleLower.includes(q)) score += 60;

        if (descLower.includes(q)) score += 30;

        item.keywords.forEach((keyword) => {
          if (keyword === q) score += 70;
          else if (keyword.startsWith(q)) score += 50;
          else if (keyword.includes(q)) score += 35;
        });

        words.forEach((word) => {
          if (titleLower.includes(word)) score += 15;
          if (descLower.includes(word)) score += 8;
          item.keywords.forEach((keyword) => {
            if (keyword.includes(word)) score += 12;
          });
        });

        return { item, score };
      })
      .filter((result) => result.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.item);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (href: string) => {
      onOpenChange(false);
      navigate(href);
    },
    [navigate, onOpenChange],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      if (results.length === 0) return;

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (event.key === "Enter" && results[highlightedIndex]) {
        event.preventDefault();
        handleSelect(results[highlightedIndex].href);
      }
    },
    [handleSelect, highlightedIndex, results],
  );

  const grouped = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    results.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [results]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "sipena-global-search-dialog flex h-[min(calc(100dvh-1rem),720px)] w-[min(calc(100vw-1rem),42rem)] max-w-none max-h-none flex-col gap-0 overflow-hidden rounded-[1.5rem] border-border/80 bg-background p-0 shadow-2xl sm:h-[min(calc(100dvh-3rem),720px)] sm:w-[min(calc(100vw-3rem),42rem)]",
          "[&>button[aria-label='Tutup_dialog']]:right-3 [&>button[aria-label='Tutup_dialog']]:top-3 [&>button[aria-label='Tutup_dialog']]:h-8 [&>button[aria-label='Tutup_dialog']]:w-8",
          "[&>button[aria-label='Tutup_dialog']]:!border-border [&>button[aria-label='Tutup_dialog']]:!bg-background [&>button[aria-label='Tutup_dialog']]:!text-muted-foreground [&>button[aria-label='Tutup_dialog']]:shadow-sm",
          "[&>button[aria-label='Tutup_dialog']]:hover:!bg-muted [&>button[aria-label='Tutup_dialog']]:hover:!text-foreground",
        )}
      >
        <DialogTitle className="sr-only">Pencarian Global</DialogTitle>

        <div className="shrink-0 border-b border-border/70 bg-muted/20 px-4 py-4 pr-16 sm:px-5 sm:py-5 sm:pr-16">
          <div className="relative flex h-12 items-center rounded-2xl border border-border/80 bg-background shadow-sm transition-colors focus-within:border-primary/45 focus-within:ring-4 focus-within:ring-primary/10">
            <Search className="pointer-events-none absolute left-4 h-4 w-4 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Cari halaman, fitur, atau pengaturan..."
              className="h-full border-0 bg-transparent pl-11 pr-11 text-[15px] shadow-none outline-none placeholder:text-muted-foreground/75 focus-visible:ring-0"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 inline-flex h-8 w-8 touch-manipulation items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Bersihkan pencarian"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{results.length} hasil tersedia</span>
            <span className="hidden sm:inline">Ctrl/Cmd K</span>
          </div>
        </div>

        <div className="sipena-global-search-results sipena-scroll-chain-page min-h-0 flex-1 overflow-y-auto overscroll-auto scrollbar-thin">
          <div className="space-y-3 p-3 sm:p-4" role="listbox" aria-label="Hasil pencarian global">
            {results.length === 0 ? (
              <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center text-muted-foreground">
                <Search className="mb-3 h-9 w-9 opacity-30" />
                <p className="text-sm font-medium text-foreground">Tidak ditemukan untuk "{query}"</p>
                <p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">
                  Coba kata kunci lain seperti "nilai", "presensi", atau "ekspor".
                </p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <section key={category} className="space-y-1.5">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {category}
                  </p>
                  <div className="space-y-1">
                    {items.map((item) => {
                      flatIndex += 1;
                      const idx = flatIndex;
                      const Icon = item.icon;
                      const isHighlighted = highlightedIndex === idx;

                      return (
                        <button
                          key={`${item.href}-${item.title}`}
                          type="button"
                          onClick={() => handleSelect(item.href)}
                          role="option"
                          aria-selected={isHighlighted}
                          className={cn(
                            "group flex min-h-[56px] w-full touch-manipulation items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                            isHighlighted
                              ? "bg-primary/10 text-foreground ring-1 ring-primary/20"
                              : "text-foreground hover:bg-muted/70",
                          )}
                        >
                          <div
                            className={cn(
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors",
                              isHighlighted
                                ? "bg-primary/15 text-primary"
                                : "bg-muted/60 text-muted-foreground group-hover:text-foreground",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={cn("truncate text-sm font-semibold", isHighlighted && "text-primary")}>
                              {item.title}
                            </p>
                            <p className="truncate text-xs leading-5 text-muted-foreground">{item.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-muted/30 px-4 py-3 text-xs text-muted-foreground sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <kbd className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] leading-none text-foreground shadow-sm">
              Up/Down
            </kbd>
            <span>Navigasi</span>
            <kbd className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] leading-none text-foreground shadow-sm">
              Enter
            </kbd>
            <span>Pilih</span>
          </div>
          <div className="flex items-center gap-2">
            <kbd className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[10px] leading-none text-foreground shadow-sm">
              Esc
            </kbd>
            <span>Tutup</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GlobalSearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl transition-colors touch-manipulation",
            "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80",
          )}
          aria-label="Pencarian global (Ctrl+K)"
        >
          <Search className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-xs">
        Cari <kbd className="ml-1 rounded bg-muted px-1 py-0.5 font-mono text-[9px]">Ctrl+K</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

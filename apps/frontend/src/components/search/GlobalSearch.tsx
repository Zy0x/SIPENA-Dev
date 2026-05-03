import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, LayoutDashboard, School, BookOpen, FileSpreadsheet, CalendarDays, BarChart3, Settings, HelpCircle, Info, Trophy, Users, Shield, Clock, Bookmark, Star } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  // Deep search items
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
    if (!query.trim()) return searchableItems.filter(item => item.category !== "Fitur"); // Don't show deep items when empty
    const q = query.toLowerCase().trim();
    const words = q.split(/\s+/);
    
    return searchableItems
      .map(item => {
        let score = 0;
        const titleLower = item.title.toLowerCase();
        const descLower = item.description.toLowerCase();
        
        // Exact title match = highest
        if (titleLower === q) score += 100;
        else if (titleLower.startsWith(q)) score += 80;
        else if (titleLower.includes(q)) score += 60;
        
        // Description match
        if (descLower.includes(q)) score += 30;
        
        // Keyword match (most important for deep search)
        item.keywords.forEach(k => {
          if (k === q) score += 70;
          else if (k.startsWith(q)) score += 50;
          else if (k.includes(q)) score += 35;
        });
        
        // Multi-word matching
        words.forEach(word => {
          if (titleLower.includes(word)) score += 15;
          if (descLower.includes(word)) score += 8;
          item.keywords.forEach(k => {
            if (k.includes(word)) score += 12;
          });
        });
        
        return { item, score };
      })
      .filter(r => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(r => r.item);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => { setHighlightedIndex(0); }, [query]);

  const handleSelect = useCallback((href: string) => {
    onOpenChange(false);
    navigate(href);
  }, [navigate, onOpenChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === "Enter" && results[highlightedIndex]) {
      e.preventDefault();
      handleSelect(results[highlightedIndex].href);
    }
  }, [results, highlightedIndex, handleSelect]);

  // Group results by category
  const grouped = useMemo(() => {
    const groups: Record<string, SearchItem[]> = {};
    results.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [results]);

  let flatIndex = -1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Pencarian Global</DialogTitle>
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Cari halaman, fitur, atau pengaturan..."
            className="border-0 shadow-none focus-visible:ring-0 h-12 text-sm pr-8"
          />
          {query && (
            <button onClick={() => setQuery("")} className="p-1 rounded-md hover:bg-muted touch-manipulation min-w-[28px] min-h-[28px] flex items-center justify-center flex-shrink-0">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Results */}
        <ScrollArea className="max-h-[60vh]">
          <div className="p-2">
            {results.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Search className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-sm">Tidak ditemukan untuk "{query}"</p>
                <p className="text-[10px] mt-1 text-muted-foreground/60">Coba kata kunci lain seperti "nilai", "presensi", atau "ekspor"</p>
              </div>
            ) : (
              Object.entries(grouped).map(([category, items]) => (
                <div key={category} className="mb-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">{category}</p>
                  {items.map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const Icon = item.icon;
                    return (
                      <button
                        key={`${item.href}-${item.title}`}
                        onClick={() => handleSelect(item.href)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors touch-manipulation min-h-[44px]",
                          highlightedIndex === idx ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
                        )}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                          highlightedIndex === idx ? "bg-primary/20" : "bg-muted/60"
                        )}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">↑↓</kbd>
            <span>Navigasi</span>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">Enter</kbd>
            <span>Pilih</span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[9px] font-mono">Esc</kbd>
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
            "flex items-center justify-center w-9 h-9 rounded-xl transition-colors touch-manipulation",
            "text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
          )}
          aria-label="Pencarian global (Ctrl+K)"
        >
          <Search className="w-4 h-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4} className="text-xs">
        Cari <kbd className="ml-1 px-1 py-0.5 bg-muted rounded text-[9px] font-mono">⌘K</kbd>
      </TooltipContent>
    </Tooltip>
  );
}

import { useState, useMemo, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Users, Plus, Share2, Copy, Trash2, ExternalLink, Eye,
  QrCode, FileSpreadsheet, CalendarDays, Trophy, Brain,
  CheckCircle, Loader2, Settings, Link2, Clock, ChevronDown,
  ChevronRight, Download,
} from "lucide-react";
import { useClasses } from "@/hooks/useClasses";
import { useSubjects } from "@/hooks/useSubjects";
import { useParentPortal, PortalConfig } from "@/hooks/useParentPortal";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";

export default function ParentPortal() {
  const { classes } = useClasses();
  const { allSubjects } = useSubjects();
  const { configs, isLoading, createConfig, updateConfig, deleteConfig, toggleActive } = useParentPortal();
  const { success, error: showError } = useEnhancedToast();
  
  const [isCreating, setIsCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [qrTarget, setQrTarget] = useState<PortalConfig | null>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    show_grades: false,
    show_attendance: false,
    show_rankings: false,
    show_assignments: false,
    show_predictions: false,
  });
  
  // New config form state
  const [newConfig, setNewConfig] = useState({
    class_id: "",
    title: "Laporan Siswa",
    description: "",
    show_grades: true,
    show_attendance: true,
    show_rankings: true,
    show_assignments: true,
    show_predictions: false,
    subject_ids: [] as string[],
    semester_filter: "current",
    attendance_period: "all",
    is_active: true,
    expires_at: "",
    // Granular controls
    grades_detail: { show_average: true, show_kkm: true, show_per_chapter: true, selected_chapters: [] as string[] },
    attendance_detail: { show_summary: true, show_daily: true, show_chart: true },
    rankings_detail: { show_class_rank: true, show_subject_rank: true, show_overall: true },
  });

  // Fetch chapters/assignments for selected class subjects
  const { data: availableChapters = [] } = useQuery({
    queryKey: ["portal-chapters", newConfig.class_id],
    queryFn: async () => {
      if (!newConfig.class_id) return [];
      // Get subjects for this class's user
      const subjectIds = newConfig.subject_ids.length > 0 ? newConfig.subject_ids : allSubjects.map(s => s.id);
      if (subjectIds.length === 0) return [];
      const { data } = await (supabase as any)
        .from("chapters")
        .select("id, name, subject_id")
        .in("subject_id", subjectIds)
        .order("order_index");
      return (data || []) as { id: string; name: string; subject_id: string }[];
    },
    enabled: !!newConfig.class_id && newConfig.show_grades,
  });

  const handleCreate = useCallback(async () => {
    if (!newConfig.class_id) {
      showError("Error", "Pilih kelas terlebih dahulu");
      return;
    }
    setIsCreating(true);
    try {
      const result = await createConfig(newConfig);
      if (result) {
        success("Portal Dibuat", "Link portal berhasil dibuat dan siap dibagikan");
        setNewConfig(prev => ({ ...prev, class_id: "", title: "Laporan Siswa", description: "" }));
      }
    } catch (err: any) {
      showError("Gagal Membuat Portal", err?.message || "Pastikan tabel parent_portal_configs sudah dibuat di Supabase. Jalankan SQL di docs/MAINTENANCE_PARENT_PORTAL.sql");
    }
    setIsCreating(false);
  }, [newConfig, createConfig, success, showError]);

  const handleCopyLink = useCallback((config: PortalConfig) => {
    const url = `${window.location.origin}/portal/${config.share_code}`;
    navigator.clipboard.writeText(url);
    success("Link Disalin", "Link portal telah disalin ke clipboard");
  }, [success]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const ok = await deleteConfig(deleteTarget);
    if (ok) success("Dihapus", "Portal berhasil dihapus");
    setDeleteTarget(null);
  }, [deleteTarget, deleteConfig, success]);

  const handleDownloadQR = useCallback(() => {
    if (!qrTarget) return;
    const svg = document.getElementById("portal-qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 512, 512);
      const link = document.createElement("a");
      link.download = `portal-qr-${qrTarget.share_code}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }, [qrTarget]);

  const toggleSection = (key: string) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const dataVisibilityItems = [
    { 
      key: "show_grades", label: "Nilai & Tugas", icon: FileSpreadsheet,
      desc: "Menampilkan tabel nilai seluruh siswa per mata pelajaran. Contoh: rata-rata nilai Matematika kelas 6A = 78.5, status KKM (Lulus/Belum Lulus), dan detail skor per tugas/BAB.",
      details: [
        { key: "show_average", label: "Rata-rata Nilai — Rata-rata dari seluruh tugas per siswa" },
        { key: "show_kkm", label: "Status KKM — Lulus/Belum Lulus berdasarkan KKM mapel" },
        { key: "show_per_chapter", label: "Nilai Per BAB — Breakdown skor di setiap BAB/chapter" },
      ]
    },
    { 
      key: "show_attendance", label: "Presensi", icon: CalendarDays,
      desc: "Menampilkan rekap kehadiran siswa: Hadir (H), Izin (I), Sakit (S), Alpa (A), Dispensasi (D). Contoh: Ahmad — H:20 I:2 S:1 A:0 D:1.",
      details: [
        { key: "show_summary", label: "Ringkasan (H/I/S/A/D) — Jumlah total per status" },
        { key: "show_daily", label: "Detail Harian — Tabel tanggal & status per hari" },
        { key: "show_chart", label: "Grafik Kehadiran — Visualisasi persentase kehadiran" },
      ]
    },
    { 
      key: "show_rankings", label: "Ranking", icon: Trophy,
      desc: "Menampilkan peringkat siswa berdasarkan rata-rata nilai. Contoh: Peringkat 1 — Siti (Rata-rata 92.3), Peringkat 2 — Budi (89.1).",
      details: [
        { key: "show_class_rank", label: "Ranking Kelas — Urutan dari rata-rata tertinggi ke terendah" },
        { key: "show_subject_rank", label: "Ranking Per Mapel — Peringkat di setiap mata pelajaran" },
        { key: "show_overall", label: "Ranking Keseluruhan — Gabungan semua mapel" },
      ]
    },
    { 
      key: "show_assignments", label: "Detail Tugas", icon: FileSpreadsheet,
      desc: "Menampilkan daftar tugas per BAB beserta skornya. Contoh: BAB 1 Aljabar — Tugas 1: 85, Tugas 2: 78, Quiz: 90.",
      details: [
        { key: "show_assignment_names", label: "Nama Tugas — Judul setiap tugas yang diberikan" },
        { key: "show_assignment_scores", label: "Skor Per Tugas — Nilai yang diperoleh siswa" },
        { key: "show_chapter_breakdown", label: "Breakdown Per BAB — Grup tugas berdasarkan BAB" },
      ]
    },
    { 
      key: "show_predictions", label: "Prediksi AI", icon: Brain,
      desc: "Prediksi tren nilai siswa berdasarkan AI (fitur Beta — masih dalam pengembangan).",
      details: []
    },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="animate-fade-in">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
          Portal Orang Tua
        </h1>
        <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
          Buat dan kelola halaman laporan yang dapat dibagikan ke orang tua/wali siswa
        </p>
      </div>

      {/* Create New Portal */}
      <Card className="animate-fade-in-up border border-border shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Buat Portal Baru</CardTitle>
              <CardDescription>Pilih kelas dan kustomisasi data yang ditampilkan</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Kelas</Label>
              <Select value={newConfig.class_id} onValueChange={(v) => setNewConfig(prev => ({ ...prev, class_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih kelas..." />
                </SelectTrigger>
                <SelectContent>
                  {classes.map(cls => (
                    <SelectItem key={cls.id} value={cls.id}>{cls.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Judul Portal</Label>
              <Input
                value={newConfig.title}
                onChange={(e) => setNewConfig(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Laporan Siswa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Deskripsi (opsional)</Label>
            <Input
              value={newConfig.description}
              onChange={(e) => setNewConfig(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Deskripsi untuk portal ini..."
            />
          </div>

          <Separator />

          {/* Visibility toggles with granular controls */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Data yang Ditampilkan
            </Label>
            <div className="space-y-2">
              {dataVisibilityItems.map(item => {
                const isEnabled = (newConfig as any)[item.key];
                const hasDetails = item.details.length > 0;
                const isExpanded = expandedSections[item.key];

                return (
                  <div key={item.key} className="rounded-lg border border-border overflow-hidden">
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {hasDetails && (
                          <button 
                            onClick={() => toggleSection(item.key)} 
                            className="p-0.5 rounded hover:bg-muted transition-colors touch-manipulation"
                          >
                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
                          </button>
                        )}
                        <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.label}</p>
                          <p className="text-xs text-muted-foreground truncate">{item.desc}</p>
                        </div>
                      </div>
                      <Switch
                        checked={isEnabled}
                        onCheckedChange={(v) => setNewConfig(prev => ({ ...prev, [item.key]: v }))}
                      />
                    </div>
                    
                    {/* Granular detail controls */}
                    {hasDetails && isExpanded && isEnabled && (
                      <div className="px-3 pb-3 pt-0 ml-7 space-y-1.5 border-t border-border/50">
                        <p className="text-[10px] text-muted-foreground pt-2 uppercase tracking-wide font-semibold">Detail yang ditampilkan:</p>
                        {item.details.map(detail => {
                          const detailGroupKey = item.key === "show_grades" ? "grades_detail" 
                            : item.key === "show_attendance" ? "attendance_detail" 
                            : item.key === "show_assignments" ? "grades_detail"
                            : "rankings_detail";
                          const detailState = (newConfig as any)[detailGroupKey] || {};
                          
                          return (
                            <label key={detail.key} className="flex items-center gap-2 py-1 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={detailState[detail.key] ?? true}
                                onChange={(e) => {
                                  setNewConfig(prev => ({
                                    ...prev,
                                    [detailGroupKey]: {
                                      ...(prev as any)[detailGroupKey],
                                      [detail.key]: e.target.checked,
                                    }
                                  }));
                                }}
                                className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                              />
                              <span className="text-xs text-foreground">{detail.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Subject filter */}
          {newConfig.show_grades && allSubjects.length > 0 && (
            <>
              <div className="space-y-2">
                <Label>Filter Mata Pelajaran (opsional)</Label>
                <p className="text-xs text-muted-foreground">Kosongkan untuk tampilkan semua mapel</p>
                <div className="flex flex-wrap gap-1.5">
                  {allSubjects.map(subj => {
                    const isSelected = newConfig.subject_ids.includes(subj.id);
                    return (
                      <button
                        key={subj.id}
                        onClick={() => {
                          setNewConfig(prev => ({
                            ...prev,
                            subject_ids: isSelected
                              ? prev.subject_ids.filter(id => id !== subj.id)
                              : [...prev.subject_ids, subj.id]
                          }));
                        }}
                        className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                          isSelected 
                            ? "bg-primary text-primary-foreground border-primary" 
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {subj.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Separator />

              {/* Chapter/Assignment selector */}
              {newConfig.show_grades && availableChapters.length > 0 && (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4" />
                    Filter BAB/Tugas (opsional)
                  </Label>
                  <p className="text-xs text-muted-foreground">Pilih BAB spesifik yang ingin ditampilkan. Kosongkan untuk semua.</p>
                  <div className="flex flex-wrap gap-1.5 max-h-[200px] overflow-y-auto">
                    {availableChapters.map((ch: any) => {
                      const subj = allSubjects.find(s => s.id === ch.subject_id);
                      const isSelected = newConfig.grades_detail.selected_chapters.includes(ch.id);
                      return (
                        <button
                          key={ch.id}
                          onClick={() => {
                            setNewConfig(prev => ({
                              ...prev,
                              grades_detail: {
                                ...prev.grades_detail,
                                selected_chapters: isSelected
                                  ? prev.grades_detail.selected_chapters.filter((id: string) => id !== ch.id)
                                  : [...prev.grades_detail.selected_chapters, ch.id]
                              }
                            }));
                          }}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border transition-colors ${
                            isSelected 
                              ? "bg-primary text-primary-foreground border-primary" 
                              : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                          }`}
                        >
                          {subj ? `${subj.name} — ` : ""}{ch.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <Separator />
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Kedaluwarsa (opsional)
              </Label>
              <Input
                type="datetime-local"
                value={newConfig.expires_at}
                onChange={(e) => setNewConfig(prev => ({ ...prev, expires_at: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Periode Presensi</Label>
              <Select value={newConfig.attendance_period} onValueChange={(v) => setNewConfig(prev => ({ ...prev, attendance_period: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="current_month">Bulan Ini</SelectItem>
                  <SelectItem value="last_month">Bulan Lalu</SelectItem>
                  <SelectItem value="current_semester">Semester Ini</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreate} disabled={isCreating || !newConfig.class_id} className="w-full sm:w-auto gap-2">
            {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Buat Portal
          </Button>
        </CardContent>
      </Card>

      {/* Existing Portals */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : configs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Share2 className="w-12 h-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">Belum ada portal yang dibuat</p>
            <p className="text-xs text-muted-foreground mt-1">Buat portal pertama Anda di atas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Portal Aktif ({configs.length})</h2>
          {configs.map(config => {
            const cls = classes.find(c => c.id === config.class_id);
            const shareUrl = `${window.location.origin}/portal/${config.share_code}`;
            
            return (
              <Card key={config.id} className="animate-fade-in-up">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{config.title}</h3>
                        <Badge variant={config.is_active ? "default" : "secondary"} className="text-[10px]">
                          {config.is_active ? "Aktif" : "Nonaktif"}
                        </Badge>
                        {cls && (
                          <Badge variant="outline" className="text-[10px]">
                            <Users className="w-3 h-3 mr-1" />
                            {cls.name}
                          </Badge>
                        )}
                      </div>
                      {config.description && (
                        <p className="text-xs text-muted-foreground mt-1">{config.description}</p>
                      )}
                    </div>
                    <Switch
                      checked={config.is_active}
                      onCheckedChange={(v) => toggleActive(config.id!, v)}
                    />
                  </div>

                  {/* Share link */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                    <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
                    <code className="text-xs flex-1 truncate font-mono">{shareUrl}</code>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => handleCopyLink(config)}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" onClick={() => setQrTarget(config)}>
                      <QrCode className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 px-2 gap-1" asChild>
                      <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </Button>
                  </div>

                  {/* Stats & Actions */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {config.view_count} kali dilihat
                      </span>
                      {config.show_grades && <Badge variant="outline" className="text-[9px] px-1.5">Nilai</Badge>}
                      {config.show_attendance && <Badge variant="outline" className="text-[9px] px-1.5">Presensi</Badge>}
                      {config.show_rankings && <Badge variant="outline" className="text-[9px] px-1.5">Ranking</Badge>}
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive h-7 px-2"
                      onClick={() => setDeleteTarget(config.id!)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={!!qrTarget} onOpenChange={() => setQrTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">QR Code Portal</DialogTitle>
          </DialogHeader>
          {qrTarget && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="p-4 bg-white rounded-2xl shadow-md">
                <QRCodeSVG
                  id="portal-qr-svg"
                  value={`${window.location.origin}/portal/${qrTarget.share_code}`}
                  size={220}
                  level="H"
                  includeMargin
                />
              </div>
              <div className="text-center space-y-1">
                <p className="text-sm font-semibold">{qrTarget.title}</p>
                <code className="text-[10px] text-muted-foreground block">{window.location.origin}/portal/{qrTarget.share_code}</code>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleDownloadQR} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  Unduh PNG
                </Button>
                <Button size="sm" onClick={() => { handleCopyLink(qrTarget); }} className="gap-1.5">
                  <Copy className="w-3.5 h-3.5" />
                  Salin Link
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Portal?</AlertDialogTitle>
            <AlertDialogDescription>
              Link share akan berhenti berfungsi. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

import { useState, useCallback } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useNavigate } from "react-router-dom";
import { useThemes, themes } from "@/hooks/useThemes";
import {
  User,
  Moon,
  Sun,
  Bell,
  CheckCircle,
  Loader2,
  Trash2,
  AlertTriangle,
  Palette,
  RotateCcw,
  Check,
  Shield,
  ChevronRight,
  Calendar,
  FileSpreadsheet,
} from "lucide-react";
import BatchImportDialog from "@/components/import/BatchImportDialog";
import { SignatureSettingsSection } from "@/components/settings/SignatureSettingsSection";

export default function Settings() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const navigate = useNavigate();
  
  // Theme hook
  const { currentTheme, isDark, selectTheme, toggleDarkMode: toggleThemeDarkMode, resetToDefault } = useThemes();
  
  const [notifications, setNotifications] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  
  // Delete account state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [showFinalDeleteDialog, setShowFinalDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Load notifications preference on mount
  useState(() => {
    const savedNotifications = localStorage.getItem("notifications");
    if (savedNotifications !== null) {
      setNotifications(savedNotifications === "true");
    }
  });

  const showAutoSaveFeedback = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  const handleToggleDarkMode = useCallback(() => {
    toggleThemeDarkMode();
    showAutoSaveFeedback();
  }, [toggleThemeDarkMode, showAutoSaveFeedback]);
  
  const handleSelectTheme = useCallback((themeId: string) => {
    selectTheme(themeId);
    showAutoSaveFeedback();
  }, [selectTheme, showAutoSaveFeedback]);
  
  const handleResetTheme = useCallback(() => {
    resetToDefault();
    showAutoSaveFeedback();
    success("Tema Direset", "Tema dikembalikan ke default SIPENA");
  }, [resetToDefault, showAutoSaveFeedback, success]);

  const toggleNotifications = useCallback((value: boolean) => {
    setNotifications(value);
    localStorage.setItem("notifications", value.toString());
    showAutoSaveFeedback();
  }, [showAutoSaveFeedback]);

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "HAPUS AKUN") return;
    
    setIsDeleting(true);
    try {
      // Check for existing pending request
      const { data: existingRequest } = await supabase
        .from("account_deletion_requests")
        .select("id, status, expires_at")
        .eq("user_id", user?.id)
        .eq("status", "pending")
        .maybeSingle();

      if (existingRequest) {
        showError(
          "Permintaan sudah ada", 
          "Permintaan penghapusan sudah ada dan sedang menunggu persetujuan admin."
        );
        setIsDeleting(false);
        return;
      }

      // Create deletion request directly in database
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours
      const { data: newRequest, error: insertError } = await supabase
        .from("account_deletion_requests")
        .insert({
          user_id: user?.id,
          user_email: user?.email || "",
          user_name: user?.user_metadata?.full_name || null,
          reason: "Permintaan pengguna via halaman pengaturan",
          status: "pending",
          expires_at: expiresAt
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create notification for tracking
      await supabase
        .from("notifications")
        .insert({
          user_id: user?.id,
          title: "Permintaan Hapus Akun",
          message: `Permintaan penghapusan akun Anda telah dikirim. Akan otomatis dihapus dalam 24 jam jika tidak direspon admin.`,
          type: "account_deletion_request",
          data: { requestId: newRequest.id }
        });

      success(
        "Permintaan Penghapusan Terkirim", 
        "Permintaan telah dikirim ke admin. Jika tidak direspon dalam 24 jam, akun akan otomatis dihapus."
      );
      
      setShowFinalDeleteDialog(false);
      setDeleteConfirmText("");
    } catch (error: unknown) {
      console.error("Delete account error:", error);
      const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
      showError("Gagal mengirim permintaan", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  // Navigate to profile with section hash
  const handleNavigateToProfile = () => {
    navigate("/settings/profile#profile-info");
  };

  const handleNavigateToSecurity = () => {
    navigate("/settings/profile#security-section");
  };

  return (
    <>
      <div className="app-page app-page-narrow">
        {/* Header - Consistent with other pages */}
        <div className="animate-fade-in flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Palette className="w-[18px] h-[18px] sm:w-5 sm:h-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-base sm:text-lg font-bold text-foreground truncate">
                Pengaturan
              </h1>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Kelola preferensi dan keamanan akun Anda
              </p>
            </div>
          </div>
          
          {/* Auto-save status indicator */}
          <div className="flex items-center gap-2 text-sm flex-shrink-0">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-muted-foreground animate-pulse text-xs">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-grade-pass animate-fade-in text-xs">
                <CheckCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tersimpan</span>
              </span>
            )}
          </div>
        </div>

        {/* Profile Link Card - Navigates to Profile section */}
        <Card className="animate-fade-in-up group hover:shadow-lg transition-all duration-300 cursor-pointer border border-border" onClick={handleNavigateToProfile}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <User className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Profil Saya</h3>
                <p className="text-xs text-muted-foreground">
                  Kelola foto, nama, dan informasi profil
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>

        {/* Account Security Link Card - Navigates to Security section */}
        <Card className="animate-fade-in-up delay-50 group hover:shadow-lg transition-all duration-300 cursor-pointer border border-border" onClick={handleNavigateToSecurity}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                <Shield className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Keamanan Akun</h3>
                <p className="text-xs text-muted-foreground">
                  Password, verifikasi email, dan 2FA
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>

        {/* Batch Import */}
        <Card className="animate-fade-in-up delay-75 group hover:shadow-lg transition-all duration-300 cursor-pointer border border-border" onClick={() => setShowBatchImport(true)}>
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <FileSpreadsheet className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Import Batch Data</h3>
                <p className="text-xs text-muted-foreground">
                  Import kelas, siswa, mapel, nilai & presensi dalam satu file Excel
                </p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </CardContent>
        </Card>
        <Card className="animate-fade-in-up delay-75 border-dashed border-primary/30 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Tahun Ajaran & Semester</p>
              <p className="text-xs text-muted-foreground">
                Pengaturan periode akademik telah dipindahkan ke menu samping (sidebar) untuk akses yang lebih mudah.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Appearance */}
        <Card className="animate-fade-in-up delay-100 border border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center">
                {isDark ? (
                  <Moon className="w-5 h-5 text-amber-500" />
                ) : (
                  <Sun className="w-5 h-5 text-orange-500" />
                )}
              </div>
              <CardTitle className="text-lg">Tampilan</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dark/Light Mode Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground text-sm">Mode Gelap</p>
                <p className="text-xs text-muted-foreground">
                  Tampilan gelap untuk kenyamanan mata
                </p>
              </div>
              <Switch checked={isDark} onCheckedChange={handleToggleDarkMode} />
            </div>
            
            <Separator />
            
            {/* Color Palette Selector - Accordion */}
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="palette" className="border-none">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <div className="flex items-center justify-between w-full pr-2">
                    <div className="flex items-center gap-2">
                      <Palette className="w-4 h-4 text-primary" />
                      <div className="text-left">
                        <p className="font-medium text-foreground text-sm">Palet Warna</p>
                        <p className="text-xs text-muted-foreground font-normal">
                          {themes[currentTheme]?.name || 'Default'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mr-4">
                      {/* Current Theme Preview */}
                      <div className="flex gap-0.5 rounded overflow-hidden">
                        {themes[currentTheme]?.colors.slice(0, 4).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-4"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      {currentTheme !== "default" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleResetTheme();
                          }}
                          className="text-xs h-6 px-2"
                        >
                          <RotateCcw className="w-3 h-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-4">
                  <ScrollArea className="w-full">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 pb-2">
                      {Object.entries(themes).map(([themeId, theme]) => (
                        <button
                          key={themeId}
                          onClick={() => handleSelectTheme(themeId)}
                          className={`relative p-2 rounded-lg border-2 transition-all hover:scale-[1.02] active:scale-[0.98] ${
                            currentTheme === themeId
                              ? 'border-primary ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/50'
                          }`}
                        >
                          {/* Color Preview */}
                          <div className="flex gap-0.5 mb-1.5 rounded overflow-hidden">
                            {theme.colors.map((color, idx) => (
                              <div
                                key={idx}
                                className="h-5 flex-1"
                                style={{ backgroundColor: color }}
                              />
                            ))}
                          </div>
                          
                          {/* Theme Name */}
                          <p className="text-[10px] sm:text-xs font-medium text-foreground truncate text-center">
                            {theme.name}
                          </p>
                          
                          {/* Selected Indicator */}
                          {currentTheme === themeId && (
                            <div className="absolute top-1 right-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center">
                              <Check className="w-2.5 h-2.5 text-primary-foreground" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </ScrollArea>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="animate-fade-in-up delay-150 border border-border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-grade-warning/10 flex items-center justify-center">
                <Bell className="w-5 h-5 text-grade-warning" />
              </div>
              <CardTitle className="text-lg">Notifikasi</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground text-sm">Notifikasi Push</p>
                <p className="text-xs text-muted-foreground">
                  Terima pemberitahuan pembaruan
                </p>
              </div>
              <Switch checked={notifications} onCheckedChange={toggleNotifications} />
            </div>
          </CardContent>
        </Card>

        {/* Signature Settings */}
        <SignatureSettingsSection />

        {/* Danger Zone - Delete Account */}
        <Card className="animate-fade-in-up delay-200 border-destructive/30 border shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <CardTitle className="text-lg text-destructive">Zona Berbahaya</CardTitle>
                <CardDescription>Tindakan tidak dapat dibatalkan</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-medium text-foreground text-sm">Hapus Akun</p>
                <p className="text-xs text-muted-foreground">
                  Kirim permintaan hapus akun ke admin. Otomatis dihapus dalam 24 jam.
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                className="shrink-0"
              >
                <Trash2 className="w-4 h-4 mr-1.5" />
                Hapus Akun
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* First Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Hapus Akun?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-3">
                <p>
                  Tindakan ini akan mengirim <strong>permintaan penghapusan akun</strong> ke admin. Berikut yang perlu Anda ketahui:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Admin akan menerima notifikasi permintaan Anda</li>
                  <li>Jika admin <strong>tidak merespon dalam 24 jam</strong>, akun akan <strong>otomatis dihapus</strong></li>
                  <li>Semua data akan dihapus: kelas, siswa, nilai, link berbagi, dll.</li>
                  <li>Anda masih bisa membatalkan permintaan sebelum diproses</li>
                </ul>
                <p className="font-medium text-destructive">
                  Setelah dihapus, data TIDAK DAPAT dipulihkan!
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setShowFinalDeleteDialog(true);
                }}
              >
                Lanjutkan
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Final Delete Confirmation Dialog */}
        <AlertDialog open={showFinalDeleteDialog} onOpenChange={setShowFinalDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-5 h-5" />
                Konfirmasi Akhir
              </AlertDialogTitle>
              <AlertDialogDescription className="text-left space-y-4">
                <p>
                  Ketik <strong className="text-foreground">HAPUS AKUN</strong> di bawah untuk mengkonfirmasi:
                </p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Ketik HAPUS AKUN"
                  className="font-mono"
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
                Batal
              </AlertDialogCancel>
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== "HAPUS AKUN" || isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  "Kirim Permintaan"
                )}
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <BatchImportDialog open={showBatchImport} onOpenChange={setShowBatchImport} />
    </>
  );
}

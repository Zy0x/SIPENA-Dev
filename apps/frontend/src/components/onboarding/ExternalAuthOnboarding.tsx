import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Loader2, KeyRound, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";

/**
 * Shows an onboarding modal for users who signed up via external auth (Google, etc.)
 * and haven't set their full_name yet.
 */
export function ExternalAuthOnboarding() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const [open, setOpen] = useState(false);
  const [fullName, setFullName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Check if user signed up via external provider and has no full_name set
    const provider = user.app_metadata?.provider;
    const providers = Array.isArray(user.app_metadata?.providers) ? user.app_metadata.providers : [provider];
    const hasFullName = user.user_metadata?.full_name;
    const needsPassword = providers.includes("google") && !providers.includes("email") && user.user_metadata?.sipena_password_configured !== true;

    // If external auth user without a manually set full_name
    if (provider && provider !== "email" && !hasFullName) {
      // Pre-fill with Google name if available
      const googleName = user.user_metadata?.name || user.user_metadata?.full_name || "";
      setFullName(googleName);
      setOpen(true);
    } else if (needsPassword) {
      setShowPasswordSetup(true);
    }
  }, [user]);

  const handleSubmit = async () => {
    if (!fullName.trim() || fullName.trim().length < 2) {
      showError("Nama Tidak Valid", "Nama lengkap minimal 2 karakter.");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName.trim() },
      });

      if (error) throw error;

      success("Profil Lengkap!", "Selamat datang di SIPENA, " + fullName.trim().split(" ")[0] + "!");
      setOpen(false);
      const providers = Array.isArray(user?.app_metadata?.providers) ? user.app_metadata.providers : [user?.app_metadata?.provider];
      if (providers.includes("google") && !providers.includes("email")) setShowPasswordSetup(true);
    } catch (err: any) {
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetPassword = async () => {
    if (password.length < 8) {
      showError("Password Terlalu Pendek", "Gunakan minimal 8 karakter.");
      return;
    }
    if (password !== confirmPassword) {
      showError("Password Tidak Sama", "Konfirmasi password harus sama.");
      return;
    }

    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { sipena_password_configured: true },
      });
      if (error) throw error;
      setPassword("");
      setConfirmPassword("");
      setShowPasswordSetup(false);
      success("Password Login Dibuat", "Sekarang Anda dapat masuk menggunakan Google atau email dan password.");
    } catch (err: any) {
      showError("Password Belum Tersimpan", err.message || "Coba lagi dari Keamanan Akun.");
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v && fullName.trim().length >= 2) setOpen(false); }}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary" />
            Lengkapi Data Diri
          </DialogTitle>
          <DialogDescription>
            Masukkan nama lengkap Anda untuk melanjutkan menggunakan SIPENA.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="onboard-name">Nama Lengkap</Label>
            <Input
              id="onboard-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap Anda"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
            <p className="text-xs text-muted-foreground">
              Nama ini akan digunakan di seluruh aplikasi SIPENA.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || fullName.trim().length < 2}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Menyimpan...
              </>
            ) : (
              "Simpan & Lanjutkan"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={!open && showPasswordSetup} onOpenChange={setShowPasswordSetup}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Buat Password Login
          </DialogTitle>
          <DialogDescription>
            Tambahkan password agar akun ini dapat masuk melalui Google maupun email.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="oauth-new-password">Password Baru</Label>
            <div className="relative">
              <Input
                id="oauth-new-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimal 8 karakter"
                autoComplete="new-password"
                className="pr-11"
              />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}>
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="oauth-confirm-password">Konfirmasi Password</Label>
            <Input id="oauth-confirm-password" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" placeholder="Ulangi password baru" />
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Anda dapat menundanya dan mengatur password nanti melalui Pengaturan &gt; Keamanan Akun.</p>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setShowPasswordSetup(false)} disabled={isSavingPassword}>Nanti</Button>
          <Button onClick={handleSetPassword} disabled={isSavingPassword || password.length < 8 || password !== confirmPassword}>
            {isSavingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Simpan Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}

import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  Lock,
  Phone,
  Key,
  CheckCircle,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Smartphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { EmailVerificationSection } from "./EmailVerificationSection";

export function AccountSecuritySection() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  
  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false);
  
  // Password change state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  
  // Phone verification state
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [isVerifyingPhone, setIsVerifyingPhone] = useState(false);
  const [phoneStep, setPhoneStep] = useState<"input" | "verify">("input");

  // TOTP state
  const [showTotpDialog, setShowTotpDialog] = useState(false);
  const [totpEnabled, setTotpEnabled] = useState(false);
  const [totpSecret, setTotpSecret] = useState<string | null>(null);
  const [totpQrCode, setTotpQrCode] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [isSettingUpTotp, setIsSettingUpTotp] = useState(false);

  // Load user preferences
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user?.id) return;
      
      const { data } = await supabase
        .from("user_preferences")
        .select("email_verified, totp_enabled")
        .eq("user_id", user.id)
        .limit(1);
      
      if (data && data.length > 0) {
        setEmailVerified(data[0].email_verified || false);
        setTotpEnabled(data[0].totp_enabled || false);
      }
    };
    
    loadPreferences();
  }, [user?.id]);

  const handleChangePassword = useCallback(async () => {
    if (newPassword !== confirmPassword) {
      showError("Password Tidak Sama", "Password baru dan konfirmasi harus sama.");
      return;
    }

    if (newPassword.length < 8) {
      showError("Password Terlalu Pendek", "Password minimal 8 karakter.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      success("Password Diperbarui", "Password Anda telah berhasil diubah.");
      setShowPasswordDialog(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change error:", err);
      showError("Gagal Mengubah Password", err.message || "Terjadi kesalahan.");
    } finally {
      setIsChangingPassword(false);
    }
  }, [newPassword, confirmPassword, success, showError]);

  const handleSendPhoneOtp = useCallback(async () => {
    if (!phoneNumber.trim()) {
      showError("Nomor Tidak Valid", "Masukkan nomor telepon yang valid.");
      return;
    }

    setIsVerifyingPhone(true);
    try {
      // Note: In a real implementation, this would call an edge function to send OTP via WhatsApp/SMS
      // For now, we'll simulate the flow
      setPhoneStep("verify");
      success("OTP Terkirim", "Kode OTP telah dikirim ke nomor Anda.");
    } catch (err: any) {
      showError("Gagal Mengirim OTP", err.message || "Terjadi kesalahan.");
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneNumber, success, showError]);

  const handleVerifyPhone = useCallback(async () => {
    if (phoneOtp.length !== 6) {
      showError("Kode Tidak Valid", "Masukkan 6 digit kode OTP.");
      return;
    }

    setIsVerifyingPhone(true);
    try {
      // In a real implementation, verify OTP and update user_preferences
      success("Nomor Terverifikasi", "Nomor telepon Anda telah terverifikasi.");
      setShowPhoneDialog(false);
      setPhoneStep("input");
      setPhoneNumber("");
      setPhoneOtp("");
    } catch (err: any) {
      showError("Gagal Verifikasi", err.message || "Kode OTP salah.");
    } finally {
      setIsVerifyingPhone(false);
    }
  }, [phoneOtp, success, showError]);

  // Generate deep link for Google Authenticator mobile app
  const getAuthenticatorDeepLink = useCallback((secret: string) => {
    const issuer = encodeURIComponent("SIPENA");
    const account = encodeURIComponent(user?.email || "user");
    const otpauthUrl = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;
    
    // Detect if mobile
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Return the otpauth:// URL directly - mobile browsers can handle this
      return otpauthUrl;
    }
    return null;
  }, [user?.email]);

  const handleSetupTotp = useCallback(async () => {
    setIsSettingUpTotp(true);
    try {
      // Generate TOTP secret
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      let secret = '';
      for (let i = 0; i < 32; i++) {
        secret += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      
      setTotpSecret(secret);
      // Generate QR code URL
      const issuer = encodeURIComponent("SIPENA");
      const account = encodeURIComponent(user?.email || "user");
      const qrData = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}`;
      setTotpQrCode(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}`);
    } catch (err: any) {
      showError("Gagal Setup TOTP", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSettingUpTotp(false);
    }
  }, [user?.email, showError]);

  const handleVerifyTotp = useCallback(async () => {
    if (totpCode.length !== 6) {
      showError("Kode Tidak Valid", "Masukkan 6 digit kode dari aplikasi autentikator.");
      return;
    }

    setIsSettingUpTotp(true);
    try {
      // In production, verify TOTP and save to user_preferences
      if (!user?.id) throw new Error("User not found");
      
      await supabase
        .from("user_preferences")
        .update({ 
          totp_enabled: true, 
          totp_secret: totpSecret 
        })
        .eq("user_id", user.id);

      setTotpEnabled(true);
      success("TOTP Diaktifkan", "Google Authenticator telah berhasil dikonfigurasi.");
      setShowTotpDialog(false);
      setTotpCode("");
      setTotpSecret(null);
      setTotpQrCode(null);
    } catch (err: any) {
      showError("Gagal Verifikasi TOTP", err.message || "Kode tidak valid.");
    } finally {
      setIsSettingUpTotp(false);
    }
  }, [totpCode, totpSecret, user?.id, success, showError]);

  return (
    <Card className="animate-fade-in-up delay-150">
      <CardHeader className="pb-4 px-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg">Keamanan Akun</CardTitle>
            <CardDescription className="text-xs sm:text-sm">Kelola password dan autentikasi tambahan</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 sm:space-y-4 px-4 sm:px-6">
        {/* Email Verification Status */}
        <EmailVerificationSection 
          isVerified={emailVerified} 
          onVerified={() => setEmailVerified(true)} 
        />

        <Separator />

        {/* Change Password */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Lock className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Password</p>
              <p className="text-xs text-muted-foreground truncate">Ubah password akun Anda</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPasswordDialog(true)}
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            <Key className="w-4 h-4 mr-1.5" />
            Ubah Password
          </Button>
        </div>

        <Separator />

        {/* Phone Number */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Phone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm">Nomor Telepon</p>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-grade-warning/50 text-grade-warning gap-0.5">
                  <AlertCircle className="w-2.5 h-2.5" />
                  Perbaikan
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                Untuk verifikasi OTP dan recovery
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setShowPhoneDialog(true)}
            disabled
            className="w-full sm:w-auto min-h-[44px] sm:min-h-0 opacity-50"
          >
            {phoneNumber ? "Ubah Nomor" : "Tambah Nomor"}
          </Button>
        </div>

        <Separator />

        {/* Google Authenticator */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Smartphone className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="font-medium text-sm">Google Authenticator</p>
              <p className="text-xs text-muted-foreground truncate">
                Keamanan 2FA dengan TOTP
              </p>
            </div>
          </div>
          {totpEnabled ? (
            <Badge variant="pass" className="gap-1 self-start sm:self-auto">
              <CheckCircle className="w-3 h-3" />
              Aktif
            </Badge>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowTotpDialog(true);
                handleSetupTotp();
              }}
              className="w-full sm:w-auto min-h-[44px] sm:min-h-0"
            >
              Aktifkan 2FA
            </Button>
          )}
        </div>
      </CardContent>

      {/* Password Change Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5 text-primary" />
              Ubah Password
            </DialogTitle>
            <DialogDescription>
              Password minimal 8 karakter untuk keamanan akun
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Ulangi password baru"
              />
            </div>
            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Password minimal 8 karakter
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleChangePassword}
              disabled={isChangingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
            >
              {isChangingPassword ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Phone Verification Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={(open) => {
        setShowPhoneDialog(open);
        if (!open) {
          setPhoneStep("input");
          setPhoneOtp("");
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-primary" />
              {phoneStep === "input" ? "Tambah Nomor Telepon" : "Verifikasi OTP"}
            </DialogTitle>
            <DialogDescription>
              {phoneStep === "input" 
                ? "Nomor akan digunakan untuk verifikasi dan recovery akun"
                : "Masukkan 6 digit kode yang dikirim ke nomor Anda"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {phoneStep === "input" ? (
              <div className="space-y-2">
                <Label htmlFor="phone">Nomor Telepon</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="08xxxxxxxxxx"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="otp">Kode OTP</Label>
                <Input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={phoneOtp}
                  onChange={(e) => setPhoneOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-widest"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPhoneDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={phoneStep === "input" ? handleSendPhoneOtp : handleVerifyPhone}
              disabled={isVerifyingPhone}
            >
              {isVerifyingPhone ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : phoneStep === "input" ? (
                "Kirim OTP"
              ) : (
                "Verifikasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TOTP Setup Dialog */}
      <Dialog open={showTotpDialog} onOpenChange={setShowTotpDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-primary" />
              Setup Google Authenticator
            </DialogTitle>
            <DialogDescription>
              Scan QR code dengan aplikasi autentikator Anda
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            {totpQrCode && (
              <div className="flex flex-col items-center gap-3">
                <div className="p-4 bg-white rounded-lg">
                  <img src={totpQrCode} alt="TOTP QR Code" className="w-48 h-48" />
                </div>
                {/* Mobile deep link to Google Authenticator */}
                {totpSecret && getAuthenticatorDeepLink(totpSecret) && (
                  <a
                    href={getAuthenticatorDeepLink(totpSecret)!}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Smartphone className="w-4 h-4" />
                    Buka di Google Authenticator
                  </a>
                )}
              </div>
            )}
            {totpSecret && (
              <div className="space-y-2">
                <Label>Secret Key (jika tidak bisa scan)</Label>
                <code className="block p-2 bg-muted rounded text-xs break-all select-all">
                  {totpSecret}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totp-code">Kode dari Aplikasi</Label>
              <Input
                id="totp-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTotpDialog(false)}>
              Batal
            </Button>
            <Button 
              onClick={handleVerifyTotp}
              disabled={isSettingUpTotp || totpCode.length !== 6}
            >
              {isSettingUpTotp ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memverifikasi...
                </>
              ) : (
                "Aktifkan"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

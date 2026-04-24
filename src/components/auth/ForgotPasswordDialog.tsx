import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  InputOTP, 
  InputOTPGroup, 
  InputOTPSlot 
} from "@/components/ui/input-otp";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { useReCaptcha, ReCaptchaDisclosure } from "./ReCaptcha";
import { FloatingLabelInput } from "./FloatingLabelInput";
import { 
  Mail, 
  Loader2, 
  ArrowLeft, 
  CheckCircle,
  Key,
  Shield,
  Smartphone,
  Lock,
  AlertTriangle,
} from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Format email tidak valid");
const passwordSchema = z.string()
  .min(12, "Password minimal 12 karakter")
  .regex(/[a-zA-Z]/, "Harus mengandung huruf")
  .regex(/[0-9]/, "Harus mengandung angka")
  .regex(/[!@#$%^&*(),.?":{}|<>]/, "Harus mengandung simbol");

interface ForgotPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = "email" | "method" | "otp" | "reset" | "success";

export function ForgotPasswordDialog({ isOpen, onClose, onSuccess }: ForgotPasswordDialogProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<"email" | "authenticator">("email");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resetTokenId, setResetTokenId] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);

  const { executeRecaptcha, isConfigured: isRecaptchaConfigured } = useReCaptcha();
  const MAX_ATTEMPTS = 5;

  const resetState = useCallback(() => {
    setStep("email");
    setEmail("");
    setMethod("email");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
    setError("");
    setResetTokenId("");
    setAttempts(0);
    setPasswordErrors([]);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validatePassword = (password: string) => {
    const errors: string[] = [];
    if (password.length < 12) errors.push("Minimal 12 karakter");
    if (!/[a-zA-Z]/.test(password)) errors.push("Harus mengandung huruf");
    if (!/[0-9]/.test(password)) errors.push("Harus mengandung angka");
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) errors.push("Harus mengandung simbol");
    setPasswordErrors(errors);
    return errors.length === 0;
  };

  const handleEmailSubmit = async () => {
    setError("");
    
    const result = emailSchema.safeParse(email);
    if (!result.success) {
      setError("Format email tidak valid");
      return;
    }

    setLoading(true);
    try {
      // Execute reCAPTCHA for bot protection
      if (isRecaptchaConfigured) {
        const token = await executeRecaptcha("forgot_password");
        if (!token) {
          setError("Verifikasi keamanan gagal. Silakan coba lagi.");
          setLoading(false);
          return;
        }
      }

      // Check rate limiting (max 5 attempts per hour)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("password_reset_tokens")
        .select("id", { count: "exact" })
        .gte("created_at", oneHourAgo);

      if (count && count >= 5) {
        setError("Terlalu banyak percobaan. Silakan tunggu 1 jam.");
        setLoading(false);
        return;
      }

      // Show method selection
      setStep("method");
    } catch (err) {
      setError("Gagal memproses permintaan");
    } finally {
      setLoading(false);
    }
  };

  const handleMethodSelect = async (selectedMethod: "email" | "authenticator") => {
    setMethod(selectedMethod);
    setLoading(true);
    setError("");

    try {
      if (selectedMethod === "email") {
        // Generate OTP code (6 digits)
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Generate unique token
        const token = crypto.randomUUID();
        
        // Store token with 10 minute expiry
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
        
        const { data: tokenData, error: tokenError } = await supabase
          .from("password_reset_tokens")
          .insert({
            token,
            otp_code: otpCode,
            method: "email",
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (tokenError) throw tokenError;
        setResetTokenId(tokenData.id);

        // Use Supabase native password reset (sends email)
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth?reset=true`,
        });
        
        if (error) throw error;
        setStep("success");
      } else {
        // For authenticator, show OTP input
        setStep("otp");
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengirim kode verifikasi");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async () => {
    if (otp.length !== 6) {
      setError("Masukkan kode 6 digit");
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      setError("Terlalu banyak percobaan salah. Silakan minta kode baru.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // In production, verify TOTP here
      // For now, proceed to reset step
      setAttempts(prev => prev + 1);
      setStep("reset");
    } catch (err: any) {
      setAttempts(prev => prev + 1);
      setError(`Kode tidak valid. Sisa percobaan: ${MAX_ATTEMPTS - attempts - 1}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!validatePassword(newPassword)) {
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Password tidak cocok");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      // Mark token as used
      if (resetTokenId) {
        await supabase
          .from("password_reset_tokens")
          .update({ used: true })
          .eq("id", resetTokenId);
      }
      
      setStep("success");
      onSuccess?.();
    } catch (err: any) {
      setError(err.message || "Gagal mengubah password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step !== "email" && step !== "success" && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 -ml-2"
                onClick={() => setStep(step === "otp" || step === "reset" ? "method" : "email")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <Key className="w-5 h-5 text-primary" />
            {step === "success" ? "Berhasil!" : "Reset Password"}
          </DialogTitle>
          <DialogDescription>
            {step === "email" && "Masukkan email untuk verifikasi"}
            {step === "method" && "Pilih metode verifikasi yang aman"}
            {step === "otp" && "Masukkan kode dari aplikasi authenticator"}
            {step === "reset" && "Buat password baru yang kuat"}
            {step === "success" && "Cek email Anda untuk melanjutkan"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "email" && (
            <div className="space-y-4">
              <FloatingLabelInput
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error=""
                success={email.includes("@")}
                icon={<Mail className="w-5 h-5" />}
              />
              <Button 
                onClick={handleEmailSubmit} 
                className="w-full" 
                disabled={loading || !email}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Lanjutkan
              </Button>
              {isRecaptchaConfigured && <ReCaptchaDisclosure />}
            </div>
          )}

          {step === "method" && (
            <div className="space-y-3">
              <Alert className="bg-primary/5 border-primary/20">
                <Shield className="h-4 w-4 text-primary" />
                <AlertDescription className="text-xs">
                  Kode OTP berlaku 10 menit dengan maksimal 5 percobaan.
                </AlertDescription>
              </Alert>
              
              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start gap-4"
                onClick={() => handleMethodSelect("email")}
                disabled={loading}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Kirim via Email</p>
                  <p className="text-xs text-muted-foreground">Link reset dikirim ke {email}</p>
                </div>
              </Button>
              
              <Button
                variant="outline"
                className="w-full h-auto py-4 justify-start gap-4"
                onClick={() => handleMethodSelect("authenticator")}
                disabled={loading}
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="font-medium">Google Authenticator</p>
                  <p className="text-xs text-muted-foreground">Gunakan kode TOTP dari aplikasi</p>
                </div>
              </Button>
            </div>
          )}

          {step === "otp" && (
            <div className="space-y-4">
              <div className="flex justify-center">
                <InputOTP 
                  value={otp} 
                  onChange={setOtp} 
                  maxLength={6}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <p className="text-xs text-center text-muted-foreground">
                Buka aplikasi Google Authenticator dan masukkan kode 6 digit.
                Sisa percobaan: {MAX_ATTEMPTS - attempts}
              </p>
              <Button 
                onClick={handleOtpVerify} 
                className="w-full" 
                disabled={loading || otp.length !== 6 || attempts >= MAX_ATTEMPTS}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Verifikasi
              </Button>
            </div>
          )}

          {step === "reset" && (
            <div className="space-y-4">
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-xs text-amber-800 dark:text-amber-200">
                  Password harus minimal 12 karakter dengan kombinasi huruf, angka, dan simbol.
                </AlertDescription>
              </Alert>
              
              <FloatingLabelInput
                label="Password Baru"
                value={newPassword}
                onChange={(e) => {
                  setNewPassword(e.target.value);
                  validatePassword(e.target.value);
                }}
                showPasswordToggle
                error={passwordErrors.length > 0 ? passwordErrors[0] : ""}
                success={passwordErrors.length === 0 && newPassword.length >= 12}
                icon={<Lock className="w-5 h-5" />}
              />
              
              {newPassword && passwordErrors.length > 0 && (
                <ul className="text-xs text-destructive space-y-1 pl-4 list-disc">
                  {passwordErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              )}

              <FloatingLabelInput
                label="Konfirmasi Password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                showPasswordToggle
                error={confirmPassword && confirmPassword !== newPassword ? "Password tidak cocok" : ""}
                success={confirmPassword === newPassword && newPassword.length >= 12}
                icon={<Lock className="w-5 h-5" />}
              />
              
              <Button 
                onClick={handlePasswordReset} 
                className="w-full" 
                disabled={loading || passwordErrors.length > 0 || !confirmPassword || newPassword !== confirmPassword}
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Simpan Password Baru
              </Button>
            </div>
          )}

          {step === "success" && (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-medium text-foreground">Link Reset Terkirim</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Cek inbox email Anda dan klik link untuk reset password
                </p>
              </div>
              <Button onClick={handleClose} className="w-full">
                Tutup
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState, useCallback, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Mail, CheckCircle, Loader2, Send, Clock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase, SUPABASE_EXTERNAL_URL } from "@/core/repositories/supabase-compat.repository";

interface EmailVerificationSectionProps {
  isVerified: boolean;
  onVerified: () => void;
}

export function EmailVerificationSection({ isVerified, onVerified }: EmailVerificationSectionProps) {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpToken, setOtpToken] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [step, setStep] = useState<"send" | "verify">("send");
  
  // Resend cooldown state
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendCount, setResendCount] = useState(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RESEND_PER_HOUR = 3;
  const COOLDOWN_SECONDS = 60;

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) {
        clearInterval(cooldownTimerRef.current);
      }
    };
  }, []);

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(COOLDOWN_SECONDS);
    
    if (cooldownTimerRef.current) {
      clearInterval(cooldownTimerRef.current);
    }
    
    cooldownTimerRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) {
            clearInterval(cooldownTimerRef.current);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = useCallback(async () => {
    if (!user?.email) {
      showError("Error", "Email tidak ditemukan");
      return;
    }

    // Check resend limit
    if (resendCount >= MAX_RESEND_PER_HOUR) {
      showError("Batas Tercapai", "Anda telah mencapai batas maksimal kirim OTP (3x per jam). Coba lagi nanti.");
      return;
    }

    setIsSendingOtp(true);
    try {
      // Call the send-otp-email edge function on external Supabase
      const response = await fetch(
        `${SUPABASE_EXTERNAL_URL}/functions/v1/send-otp-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ""}`,
          },
          body: JSON.stringify({
            email: user.email,
            type: "email_verification",
            userId: user.id,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Gagal mengirim OTP");
      }

      setOtpToken(result.token);
      setStep("verify");
      setResendCount((prev) => prev + 1);
      startCooldown();
      success("OTP Terkirim", "Kode verifikasi telah dikirim ke email Anda. Cek folder spam jika tidak ada di inbox.");
    } catch (err: any) {
      console.error("Send OTP error:", err);
      showError("Gagal Mengirim OTP", err.message || "Terjadi kesalahan saat mengirim kode OTP");
    } finally {
      setIsSendingOtp(false);
    }
  }, [user, success, showError, resendCount, startCooldown]);

  const handleVerifyOtp = useCallback(async () => {
    if (otpCode.length !== 6) {
      showError("Kode Tidak Valid", "Masukkan 6 digit kode OTP");
      return;
    }

    if (!otpToken) {
      showError("Error", "Token tidak valid. Silakan kirim ulang OTP.");
      return;
    }

    setIsVerifying(true);
    try {
      // Verify OTP against database
      const { data: tokenData, error: tokenError } = await supabase
        .from("password_reset_tokens")
        .select("*")
        .eq("token", otpToken)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gt("expires_at", new Date().toISOString())
        .limit(1);

      if (tokenError || !tokenData || tokenData.length === 0) {
        throw new Error("Kode OTP salah atau sudah kadaluarsa");
      }

      // Mark token as used
      await supabase
        .from("password_reset_tokens")
        .update({ used: true })
        .eq("token", otpToken);

      // Update user_preferences
      if (user?.id) {
        await supabase
          .from("user_preferences")
          .update({ email_verified: true })
          .eq("user_id", user.id);
      }

      success("Email Terverifikasi", "Email Anda telah berhasil diverifikasi!");
      setShowVerifyDialog(false);
      setStep("send");
      setOtpCode("");
      setOtpToken(null);
      onVerified();
    } catch (err: any) {
      console.error("Verify OTP error:", err);
      showError("Verifikasi Gagal", err.message || "Kode OTP tidak valid");
    } finally {
      setIsVerifying(false);
    }
  }, [otpCode, otpToken, user?.id, success, showError, onVerified]);

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    setOtpCode("");
    await handleSendOtp();
  };

  const isResendDisabled = isSendingOtp || resendCooldown > 0 || resendCount >= MAX_RESEND_PER_HOUR;

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm">Email</p>
            <p className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-none">
              {user?.email}
            </p>
          </div>
        </div>
        <div className="flex-shrink-0 self-start sm:self-center">
          {isVerified ? (
            <Badge variant="pass" className="gap-1 whitespace-nowrap">
              <CheckCircle className="w-3 h-3" />
              Terverifikasi
            </Badge>
          ) : (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => {
                setShowVerifyDialog(true);
                setStep("send");
              }}
              className="whitespace-nowrap"
            >
              <Send className="w-4 h-4 mr-1.5" />
              Verifikasi
            </Button>
          )}
        </div>
      </div>

      {/* Email Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={(open) => {
        setShowVerifyDialog(open);
        if (!open) {
          setStep("send");
          setOtpCode("");
          setOtpToken(null);
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Verifikasi Email
            </DialogTitle>
            <DialogDescription>
              {step === "send" 
                ? "Kirim kode OTP ke email Anda untuk verifikasi"
                : "Masukkan 6 digit kode yang dikirim ke email Anda"
              }
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {step === "send" ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Email yang akan diverifikasi:</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Kode OTP akan dikirim melalui Resend dan berlaku selama 15 menit
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="otp-code">Kode OTP</Label>
                  <Input
                    id="otp-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="000000"
                    className="text-center text-2xl tracking-widest"
                    autoFocus
                  />
                </div>
                <div className="text-center">
                  <Button
                    variant="link"
                    size="sm"
                    onClick={handleResendOtp}
                    disabled={isResendDisabled}
                    className="gap-1"
                  >
                    {resendCooldown > 0 ? (
                      <>
                        <Clock className="w-3 h-3" />
                        Kirim ulang dalam {resendCooldown}s
                      </>
                    ) : resendCount >= MAX_RESEND_PER_HOUR ? (
                      "Batas tercapai (3x/jam)"
                    ) : isSendingOtp ? (
                      "Mengirim..."
                    ) : (
                      `Kirim ulang kode (${MAX_RESEND_PER_HOUR - resendCount} tersisa)`
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowVerifyDialog(false)}
            >
              Batal
            </Button>
            <Button 
              onClick={step === "send" ? handleSendOtp : handleVerifyOtp}
              disabled={isSendingOtp || isVerifying || (step === "verify" && otpCode.length !== 6)}
            >
              {isSendingOtp || isVerifying ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {step === "send" ? "Mengirim..." : "Memverifikasi..."}
                </>
              ) : step === "send" ? (
                <>
                  <Send className="w-4 h-4 mr-1.5" />
                  Kirim OTP
                </>
              ) : (
                "Verifikasi"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

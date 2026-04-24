import { useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FloatingLabelInput } from "./FloatingLabelInput";
import { ReCaptchaDisclosure, useReCaptcha } from "./ReCaptcha";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import {
  User,
  Mail,
  Lock,
  Phone,
  Loader2,
  UserCheck,
  Shield,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import { z } from "zod";

const formSchema = z.object({
  email: z.string().email("Format email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
  name: z.string().optional(),
  phone: z.string().optional(),
});

interface GuestAuthDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (guestData: { 
    guestId: string; 
    name: string; 
    email: string;
    isMainTeacher?: boolean;
    mainUserId?: string;
  }) => void;
  subjectName?: string;
  className?: string;
  shareToken?: string;
}

type FormMode = "initial" | "register";

export function GuestAuthDialog({
  isOpen,
  onClose,
  onSuccess,
  subjectName,
  className,
  shareToken,
}: GuestAuthDialogProps) {
  const [mode, setMode] = useState<FormMode>("initial");
  const [loading, setLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [accountInfo, setAccountInfo] = useState<{ type: "main" | "guest" | "new" | null; message: string }>({ type: null, message: "" });
  
  // Form data
  const [formData, setFormData] = useState({ 
    email: "", 
    password: "", 
    name: "", 
    phone: "" 
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  const { executeRecaptcha, isConfigured: isRecaptchaConfigured } = useReCaptcha();

  const resetForm = useCallback(() => {
    setFormData({ email: "", password: "", name: "", phone: "" });
    setFormErrors({});
    setError("");
    setSuccessMessage("");
    setAccountInfo({ type: null, message: "" });
    setMode("initial");
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateField = (field: string, value: string) => {
    if (field === "email") {
      const emailResult = z.string().email("Format email tidak valid").safeParse(value);
      setFormErrors((prev) => ({ 
        ...prev, 
        email: emailResult.success ? "" : emailResult.error.errors[0]?.message || "" 
      }));
    } else if (field === "password") {
      const isValid = value.length >= (mode === "register" ? 8 : 1);
      setFormErrors((prev) => ({ 
        ...prev, 
        password: isValid ? "" : mode === "register" ? "Password minimal 8 karakter" : "Password wajib diisi" 
      }));
    } else if (field === "name" && mode === "register") {
      const isValid = value.length >= 2;
      setFormErrors((prev) => ({ 
        ...prev, 
        name: isValid ? "" : "Nama minimal 2 karakter" 
      }));
    }
  };

  // Check if email exists and determine account type
  const checkAccountStatus = async (email: string): Promise<{ 
    exists: boolean; 
    type: "main" | "guest" | null;
  }> => {
    try {
      // Check guest_users table first
      const { data: guestUser } = await supabase
        .from("guest_users")
        .select("id, is_registered")
        .eq("email", email.toLowerCase())
        .maybeSingle();

      if (guestUser?.is_registered) {
        return { exists: true, type: "guest" };
      }

      // We can't directly check auth.users, but we'll try login later
      return { exists: false, type: null };
    } catch {
      return { exists: false, type: null };
    }
  };

  // Hash password using SHA-256
  const hashPassword = async (password: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  // Main unified login/register handler
  const handleSubmit = async () => {
    setError("");
    setSuccessMessage("");
    setAccountInfo({ type: null, message: "" });

    const emailLower = formData.email.trim().toLowerCase();

    // Validate email and password
    const emailResult = z.string().email().safeParse(emailLower);
    if (!emailResult.success) {
      setFormErrors(prev => ({ ...prev, email: "Format email tidak valid" }));
      return;
    }

    if (!formData.password || formData.password.length < 1) {
      setFormErrors(prev => ({ ...prev, password: "Password wajib diisi" }));
      return;
    }

    // In register mode, validate name too
    if (mode === "register") {
      if (!formData.name || formData.name.trim().length < 2) {
        setFormErrors(prev => ({ ...prev, name: "Nama minimal 2 karakter" }));
        return;
      }
      if (formData.password.length < 8) {
        setFormErrors(prev => ({ ...prev, password: "Password minimal 8 karakter" }));
        return;
      }
    }

    setLoading(true);

    try {
      // Execute reCAPTCHA
      if (isRecaptchaConfigured) {
        const token = await executeRecaptcha("guest_auth");
        if (!token) {
          setError("Verifikasi keamanan gagal. Silakan coba lagi.");
          setLoading(false);
          return;
        }
      }

      // STEP 1: Try main teacher login (Supabase Auth)
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailLower,
        password: formData.password,
      });

      if (authData?.user) {
        // Successfully logged in as main teacher!
        const userName = authData.user.user_metadata?.full_name || 
                        authData.user.email?.split('@')[0] || 
                        'Guru';

        setSuccessMessage("Login berhasil dengan akun utama!");
        setAccountInfo({ 
          type: "main", 
          message: "Anda masuk menggunakan akun guru utama SIPENA" 
        });
        
        setTimeout(() => {
          onSuccess({
            guestId: authData.user.id,
            name: userName,
            email: authData.user.email || emailLower,
            isMainTeacher: true,
            mainUserId: authData.user.id,
          });
          handleClose();
        }, 500);
        return;
      }

      // STEP 2: Try guest_users login
      const { data: guestUser, error: guestError } = await supabase
        .from("guest_users")
        .select("id, name, email, password_hash, is_registered")
        .eq("email", emailLower)
        .maybeSingle();

      if (guestUser?.is_registered && guestUser.password_hash) {
        // Check guest password
        const passwordHash = await hashPassword(formData.password);
        
        if (passwordHash === guestUser.password_hash) {
          setSuccessMessage("Login berhasil!");
          setAccountInfo({ 
            type: "guest", 
            message: "Anda masuk sebagai guru tamu terdaftar" 
          });
          
          setTimeout(() => {
            onSuccess({
              guestId: guestUser.id,
              name: guestUser.name,
              email: guestUser.email,
              isMainTeacher: false,
            });
            handleClose();
          }, 500);
          return;
        }
      }

      // STEP 3: No valid login - check what to do
      if (mode === "initial") {
        // Determine if we should suggest registration or show error
        if (authError && !authError.message.includes("Invalid login")) {
          // Some other error
          setError(authError.message);
        } else if (guestUser?.is_registered) {
          // Guest exists but password wrong
          setError("Email atau password salah. Pastikan Anda memasukkan password yang benar.");
        } else {
          // Email not found anywhere - suggest registration
          setAccountInfo({ 
            type: "new", 
            message: "Email belum terdaftar. Daftar akun baru untuk akses lebih mudah?" 
          });
          setMode("register");
          setFormErrors({});
        }
      } else if (mode === "register") {
        // STEP 4: Registration flow
        await handleRegistration(emailLower);
      }
    } catch (err: any) {
      setError(err.message || "Terjadi kesalahan");
    } finally {
      setLoading(false);
    }
  };

  const handleRegistration = async (emailLower: string) => {
    try {
      // Check if guest email exists (unregistered)
      const { data: existing } = await supabase
        .from("guest_users")
        .select("id, is_registered")
        .eq("email", emailLower)
        .maybeSingle();

      if (existing?.is_registered) {
        setError("Email sudah terdaftar. Silakan login dengan password yang benar.");
        setMode("initial");
        return;
      }

      // Hash password
      const passwordHash = await hashPassword(formData.password);

      let guestId: string;

      if (existing) {
        // Update existing guest to registered
        const { error: updateError } = await supabase
          .from("guest_users")
          .update({
            name: formData.name.trim(),
            password_hash: passwordHash,
            phone_number: formData.phone?.trim() || null,
            is_registered: true,
          })
          .eq("id", existing.id);

        if (updateError) throw updateError;
        guestId = existing.id;
      } else {
        // Create new registered guest
        const { data: newGuest, error: insertError } = await supabase
          .from("guest_users")
          .insert({
            name: formData.name.trim(),
            email: emailLower,
            password_hash: passwordHash,
            phone_number: formData.phone?.trim() || null,
            is_registered: true,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        guestId = newGuest.id;
      }

      setSuccessMessage("Akun berhasil dibuat!");
      
      setTimeout(() => {
        onSuccess({
          guestId,
          name: formData.name.trim(),
          email: emailLower,
          isMainTeacher: false,
        });
        handleClose();
      }, 500);
    } catch (err: any) {
      setError(err.message || "Gagal mendaftarkan akun");
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError("");
    
    // Store pending state for post-OAuth redirect
    if (shareToken) {
      sessionStorage.setItem('guest_google_auth_pending', 'true');
    }
    
    const redirectTo = shareToken
      ? `${window.location.origin}/share?token=${shareToken}`
      : `${window.location.origin}/share`;
    
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    
    if (oauthError) {
      setError('Google Sign-In gagal: ' + oauthError.message);
      setIsGoogleLoading(false);
      sessionStorage.removeItem('guest_google_auth_pending');
    }
  };

  const switchToRegister = () => {
    setMode("register");
    setError("");
    setAccountInfo({ type: null, message: "" });
  };

  const switchToLogin = () => {
    setMode("initial");
    setError("");
    setAccountInfo({ type: null, message: "" });
    setFormErrors({});
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-primary" />
            {mode === "register" ? "Daftar Akun" : "Login"}
          </DialogTitle>
          <DialogDescription>
            {subjectName 
              ? `Akses untuk input nilai ${subjectName}${className ? ` kelas ${className}` : ''}`
              : "Masukkan email dan password untuk melanjutkan"
            }
          </DialogDescription>
        </DialogHeader>

        {/* Info Banner */}
        <Alert className="bg-primary/5 border-primary/20">
          <Shield className="h-4 w-4 text-primary" />
          <AlertDescription className="text-xs">
            <strong>Akses tamu aman:</strong> Input nilai akan sinkron langsung dengan kelas pemilik link, 
            tanpa mengubah data pribadi akun Anda.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {successMessage && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-700 dark:text-green-300">
                {successMessage}
                {accountInfo.type && (
                  <span className="block text-xs mt-1 opacity-80">{accountInfo.message}</span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {accountInfo.type === "new" && !successMessage && (
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-700 dark:text-blue-300 text-xs">
                {accountInfo.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Google Sign-In untuk Guru Tamu */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || loading}
            className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-border bg-muted/50 hover:bg-muted text-foreground text-sm font-medium transition-all duration-200 touch-manipulation disabled:opacity-50 min-h-[48px]"
          >
            {isGoogleLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            )}
            {isGoogleLoading ? "Menghubungkan..." : "Masuk dengan Google"}
          </button>

          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">atau email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Registration fields (shown only in register mode) */}
          {mode === "register" && (
            <FloatingLabelInput
              label="Nama Lengkap"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              onBlur={() => validateField("name", formData.name)}
              error={formErrors.name}
              success={!formErrors.name && formData.name.length >= 2}
              icon={<User className="w-5 h-5" />}
              autoComplete="name"
            />
          )}

          {/* Email - always shown */}
          <FloatingLabelInput
            label="Email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            onBlur={() => validateField("email", formData.email)}
            error={formErrors.email}
            success={!formErrors.email && formData.email.includes("@")}
            icon={<Mail className="w-5 h-5" />}
            autoComplete="email"
          />

          {/* Password - always shown */}
          <FloatingLabelInput
            label={mode === "register" ? "Password (min. 8 karakter)" : "Password"}
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            onBlur={() => validateField("password", formData.password)}
            error={formErrors.password}
            success={!formErrors.password && formData.password.length >= (mode === "register" ? 8 : 1)}
            icon={<Lock className="w-5 h-5" />}
            showPasswordToggle
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />

          {/* Phone - only in register mode */}
          {mode === "register" && (
            <FloatingLabelInput
              label="No. Telepon (opsional)"
              type="tel"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              icon={<Phone className="w-5 h-5" />}
              autoComplete="tel"
            />
          )}

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            className="w-full h-12"
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <ArrowRight className="w-4 h-4 mr-2" />
            )}
            {mode === "register" ? "Daftar & Masuk" : "Masuk"}
          </Button>

          {/* Toggle between login and register */}
          <div className="text-center">
            {mode === "initial" ? (
              <button
                type="button"
                onClick={switchToRegister}
                className="text-xs text-primary hover:underline transition-colors min-h-[44px] px-4 inline-flex items-center"
              >
                Belum punya akun? Daftar di sini
              </button>
            ) : (
              <button
                type="button"
                onClick={switchToLogin}
                className="text-xs text-primary hover:underline transition-colors min-h-[44px] px-4 inline-flex items-center"
              >
                Sudah punya akun? Masuk di sini
              </button>
            )}
          </div>

          {/* Explanation */}
          <div className="text-xs text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
            <p>
              Gunakan <strong>email & password akun utama SIPENA</strong> untuk login langsung, 
              atau <strong>daftar akun baru</strong> jika Anda belum memiliki akun.
            </p>
          </div>
        </div>

        {isRecaptchaConfigured && <ReCaptchaDisclosure />}
      </DialogContent>
    </Dialog>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2, GraduationCap, Shield, CheckCircle } from "lucide-react";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { SipenaLogo } from "@/components/SipenaLogo";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ForgotPasswordDialog } from "@/components/auth/ForgotPasswordDialog";
import { useReCaptcha, ReCaptchaBadgeHider, ReCaptchaDisclosure } from "@/components/auth/ReCaptcha";
import { ReCaptchaV2Widget, useReCaptchaV2 } from "@/components/auth/ReCaptchaV2";

const ADMIN_EMAILS = ["admin", "admin@sipena.local"];

// Login attempt tracker per email
const loginAttempts: Record<string, number> = {};

const Auth = () => {
  const navigate = useNavigate();
  const { user, signIn, signUp, signInWithGoogle } = useAuth();
  const { error: showError, success: showSuccess } = useEnhancedToast();
  const prefersReducedMotion = useReducedMotion();
  const { executeAndVerify, isConfigured: recaptchaConfigured } = useReCaptcha();
  const recaptchaV2 = useReCaptchaV2();
  
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<"login" | "register">("login");
  const [sharedEmail, setSharedEmail] = useState("");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "", confirmPassword: "" });
  const [showForgotPassword, setShowForgotPassword] = useState(false);


  // GSAP Refs
  const pageRef = useRef<HTMLDivElement>(null);
  const bgGradientRef = useRef<HTMLDivElement>(null);
  const orb1Ref = useRef<HTMLDivElement>(null);
  const orb2Ref = useRef<HTMLDivElement>(null);
  const orb3Ref = useRef<HTMLDivElement>(null);
  const backBtnRef = useRef<HTMLButtonElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const badgesRef = useRef<HTMLDivElement>(null);
  const tabBarRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const footerRef = useRef<HTMLParagraphElement>(null);
  const duration = prefersReducedMotion ? 0.01 : 1;

  // Sync email
  useEffect(() => {
    if (sharedEmail) {
      setLoginForm(prev => ({ ...prev, email: sharedEmail }));
      setRegisterForm(prev => ({ ...prev, email: sharedEmail }));
    }
  }, [sharedEmail]);

  const handleEmailChange = (email: string, formType: 'login' | 'register') => {
    setSharedEmail(email);
    if (formType === 'login') setLoginForm(prev => ({ ...prev, email }));
    else setRegisterForm(prev => ({ ...prev, email }));
  };

  // Redirect if logged in
  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);
  // Reset Google loading state saat:
  // 1. Komponen mount ulang setelah OAuth redirect (tab kembali aktif)
  // 2. User kembali ke tab browser
  useEffect(() => {
    // Mount = komponen fresh, pastikan loading false
    setIsGoogleLoading(false);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setIsGoogleLoading(false);
      }
    };

    const handleFocus = () => {
      setIsGoogleLoading(false);
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // ── GSAP Master Animation ──
  useEffect(() => {
    if (prefersReducedMotion) {
      // Instantly show everything
      [backBtnRef, cardRef, logoRef, titleRef, badgesRef, tabBarRef, footerRef].forEach(r => {
        if (r.current) gsap.set(r.current, { opacity: 1, y: 0, scale: 1, filter: "none" });
      });
      return;
    }

    const ctx = gsap.context(() => {
      // Subtle organic orb floats
      [orb1Ref, orb2Ref, orb3Ref].forEach((ref, i) => {
        if (!ref.current) return;
        gsap.to(ref.current, {
          y: `${(i % 2 === 0 ? -1 : 1) * (15 + i * 5)}`,
          x: `${(i % 2 === 0 ? 1 : -1) * (10 + i * 4)}`,
          duration: 7 + i * 1.5,
          repeat: -1, yoyo: true, ease: "sine.inOut"
        });
        gsap.to(ref.current, {
          opacity: 0.4 + i * 0.1,
          duration: 4 + i,
          repeat: -1, yoyo: true, ease: "sine.inOut"
        });
      });

      // Master timeline – clean, natural sequence
      const tl = gsap.timeline({ delay: 0.2, defaults: { ease: "power3.out" } });

      // Back button – simple slide
      tl.fromTo(backBtnRef.current,
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.6 }
      );

      // Card – gentle rise
      tl.fromTo(cardRef.current,
        { opacity: 0, y: 40, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 },
        "-=0.3"
      );

      // Logo – scale in with soft spring
      tl.fromTo(logoRef.current,
        { opacity: 0, scale: 0.5 },
        { opacity: 1, scale: 1, duration: 0.7, ease: "back.out(1.4)" },
        "-=0.5"
      );

      // Title – fade up
      tl.fromTo(titleRef.current,
        { opacity: 0, y: 15 },
        { opacity: 1, y: 0, duration: 0.5 },
        "-=0.3"
      );

      // Feature badges – stagger
      if (badgesRef.current) {
        const badges = badgesRef.current.children;
        tl.fromTo(badges,
          { opacity: 0, y: 10, scale: 0.95 },
          { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.08 },
          "-=0.2"
        );
      }

      // Tab bar
      tl.fromTo(tabBarRef.current,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.4 },
        "-=0.2"
      );

      // Footer
      tl.fromTo(footerRef.current,
        { opacity: 0 },
        { opacity: 1, duration: 0.5 },
        "-=0.2"
      );
    }, pageRef);

    return () => ctx.revert();
  }, [prefersReducedMotion]);

  // ── Tab change animation ──
  useEffect(() => {
    if (!formRef.current || prefersReducedMotion) return;
    const dir = activeTab === "login" ? 1 : -1;
    gsap.fromTo(formRef.current,
      { opacity: 0, x: dir * 20, scale: 0.99 },
      { opacity: 1, x: 0, scale: 1, duration: 0.35, ease: "power2.out" }
    );
    // Stagger form groups
    setTimeout(() => {
      const groups = formRef.current?.querySelectorAll('.auth-field');
      if (groups) gsap.fromTo(groups,
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: 0.3, stagger: 0.06, ease: "power2.out" }
      );
    }, 50);
  }, [activeTab, prefersReducedMotion]);

  // ── Loading state ──
  useEffect(() => {
    if (!formRef.current || prefersReducedMotion) return;
    gsap.to(formRef.current, {
      opacity: isLoading ? 0.6 : 1,
      scale: isLoading ? 0.995 : 1,
      duration: 0.3, ease: "power2.out"
    });
  }, [isLoading, prefersReducedMotion]);

  // ── Feedback animation ──
  const animateFeedback = useCallback((ok: boolean) => {
    if (!formRef.current || prefersReducedMotion) return;
    if (ok) {
      gsap.fromTo(formRef.current, { scale: 0.99 }, { scale: 1, duration: 0.3, ease: "back.out(2)" });
    } else {
      const shakeTl = gsap.timeline();
      shakeTl.to(formRef.current, { x: -4, duration: 0.07 })
        .to(formRef.current, { x: 4, duration: 0.07 })
        .to(formRef.current, { x: -3, duration: 0.07 })
        .to(formRef.current, { x: 3, duration: 0.07 })
        .to(formRef.current, { x: 0, duration: 0.07 });
    }
  }, [prefersReducedMotion]);

  // ── Hover helpers ──
  const hoverScale = useCallback((el: HTMLElement | null, enter: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, { scale: enter ? 1.02 : 1, y: enter ? -1 : 0, duration: 0.25, ease: "power2.out" });
  }, [prefersReducedMotion]);

  const focusField = useCallback((el: HTMLElement | null, focused: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, { scale: focused ? 1.005 : 1, duration: 0.2, ease: "power2.out" });
  }, [prefersReducedMotion]);

  // ── Business logic (unchanged) ──
  const isAdminLogin = (email: string) => ADMIN_EMAILS.includes(email.toLowerCase().trim());
  const encodePassword = (pwd: string): string => {
    const ts = Date.now().toString(36);
    return `${ts}.${btoa(unescape(encodeURIComponent(pwd)))}`;
  };

  const handleAdminLogin = async (password: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase.functions.invoke("admin-auth", { body: { action: "login", password } });
      if (error) return false;
      if (data?.success && data?.token) {
        localStorage.setItem("admin_session_token", data.token);
        sessionStorage.setItem("admin_backend_key", encodePassword(password));
        return true;
      }
      return false;
    } catch { return false; }
  };

  // Field-level validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const validateLoginFields = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!loginForm.email.trim()) errors["login-email"] = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginForm.email) && !isAdminLogin(loginForm.email)) errors["login-email"] = "Format email tidak valid";
    if (!loginForm.password.trim()) errors["login-pw"] = "Password wajib diisi";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [loginForm]);

  const validateRegisterFields = useCallback(() => {
    const errors: Record<string, string> = {};
    if (!registerForm.name.trim()) errors["reg-name"] = "Nama lengkap wajib diisi";
    else if (registerForm.name.trim().length < 2) errors["reg-name"] = "Nama minimal 2 karakter";
    if (!registerForm.email.trim()) errors["reg-email"] = "Email wajib diisi";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registerForm.email)) errors["reg-email"] = "Format email tidak valid";
    if (!registerForm.password.trim()) errors["reg-pw"] = "Password wajib diisi";
    else if (registerForm.password.length < 6) errors["reg-pw"] = "Password minimal 6 karakter";
    if (!registerForm.confirmPassword.trim()) errors["reg-confirm"] = "Konfirmasi password wajib diisi";
    else if (registerForm.password !== registerForm.confirmPassword) errors["reg-confirm"] = "Password tidak cocok";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }, [registerForm]);

  // Clear field error on change
  const clearFieldError = useCallback((fieldId: string) => {
    setFieldErrors(prev => { const n = { ...prev }; delete n[fieldId]; return n; });
  }, []);

  const getAuthErrorMessage = (errorMsg: string, context: "login" | "register" = "login", email?: string): { title: string; message: string } => {
    const msg = errorMsg.toLowerCase();
    
    // Supabase returns "invalid_credentials" for both wrong password AND non-existent email
    if (msg.includes("invalid login") || msg.includes("invalid_credentials")) {
      if (email) {
        loginAttempts[email] = (loginAttempts[email] || 0) + 1;
      }
      const attempts = email ? loginAttempts[email] || 0 : 0;
      
      if (attempts >= 3) {
        return {
          title: "Login gagal",
          message: `Anda sudah ${attempts}x gagal. Cek kembali email & password, atau gunakan Lupa Password.`,
        };
      }
      return {
        title: "Email atau password salah",
        message: "Periksa kembali email dan password Anda.",
      };
    }
    if (msg.includes("email not confirmed")) {
      return {
        title: "Email belum diverifikasi",
        message: "Cek inbox/spam untuk link verifikasi.",
      };
    }
    if (msg.includes("too many requests") || msg.includes("rate limit")) {
      return {
        title: "Terlalu banyak percobaan",
        message: "Tunggu beberapa saat sebelum mencoba lagi.",
      };
    }
    if (msg.includes("user not found") || msg.includes("no user found")) {
      return {
        title: "Email tidak terdaftar",
        message: "Silakan daftar terlebih dahulu.",
      };
    }
    if (msg.includes("signup disabled") || msg.includes("signups not allowed")) {
      return {
        title: "Pendaftaran ditutup",
        message: "Hubungi administrator.",
      };
    }
    if (msg.includes("already registered") || msg.includes("already exists") || msg.includes("user already registered")) {
      return {
        title: "Email sudah terdaftar",
        message: "Gunakan email ini untuk login, atau reset password jika lupa.",
      };
    }
    if (msg.includes("weak password") || msg.includes("password")) {
      return {
        title: "Password terlalu lemah",
        message: "Minimal 6 karakter dengan kombinasi huruf dan angka.",
      };
    }
    if (msg.includes("network") || msg.includes("fetch")) {
      return {
        title: "Koneksi terputus",
        message: "Periksa internet Anda dan coba lagi.",
      };
    }
    return {
      title: context === "login" ? "Login gagal" : "Registrasi gagal",
      message: "Terjadi kesalahan. Coba lagi.",
    };
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateLoginFields()) { animateFeedback(false); return; }
    setIsLoading(true);
    try {
      // reCAPTCHA v3 — soft check, tidak hard-block user legitimate
      // Proteksi utama ada di: Supabase rate limit + RLS + loginAttempts tracker
      if (recaptchaConfigured) {
        const captchaOk = await executeAndVerify("login");
        if (!captchaOk) {
          // Log untuk monitoring, tapi tetap izinkan login lanjut
          // Hard-block hanya akan merugikan user legitimate dengan score rendah
          console.warn("[reCAPTCHA] Score rendah terdeteksi saat login, melanjutkan dengan monitoring");
        }
      }

      if (isAdminLogin(loginForm.email)) {
        const ok = await handleAdminLogin(loginForm.password);
        if (ok) { animateFeedback(true); showSuccess("Berhasil!", "Selamat datang, Administrator"); setTimeout(() => navigate("/admin"), 400); }
        else { animateFeedback(false); showError("Login Gagal", "Password yang Anda masukkan tidak sesuai. Pastikan password benar dan coba lagi."); }
        setIsLoading(false); return;
      }
      const { error } = await signIn(loginForm.email, loginForm.password);
      if (error) {
        animateFeedback(false);
        const err = getAuthErrorMessage(error.message || "", "login", loginForm.email);
        showError(err.title, err.message);
      } else { 
        if (loginForm.email) delete loginAttempts[loginForm.email];
        animateFeedback(true); 
        showSuccess("Berhasil!", "Selamat datang kembali"); 
        setTimeout(() => navigate("/dashboard"), 400); 
      }
    } catch { animateFeedback(false); showError("📡 Koneksi Gagal", "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."); }
    finally { setIsLoading(false); }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRegisterFields()) { animateFeedback(false); return; }

    // reCAPTCHA v2 checkbox verification (wajib untuk pendaftaran)
    if (recaptchaV2.isConfigured) {
      if (!recaptchaV2.verified) {
        showError("Verifikasi Diperlukan", "Silakan centang kotak CAPTCHA terlebih dahulu.");
        animateFeedback(false);
        return;
      }
      const v2Ok = await recaptchaV2.verifyOnServer();
      if (!v2Ok) {
        showError("Verifikasi Gagal", "CAPTCHA tidak valid. Silakan coba lagi.");
        recaptchaV2.reset();
        animateFeedback(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      // reCAPTCHA v3 — soft check untuk registrasi
      if (recaptchaConfigured) {
        const captchaOk = await executeAndVerify("register");
        if (!captchaOk) {
          console.warn("[reCAPTCHA] Score rendah terdeteksi saat register, melanjutkan dengan monitoring");
        }
      }

      const { error } = await signUp(registerForm.email, registerForm.password, registerForm.name);
      if (error) {
        animateFeedback(false);
        const err = getAuthErrorMessage(error.message || "", "register");
        showError(err.title, err.message);
      } else {
        animateFeedback(true);
        showSuccess("Akun Dibuat!", "Cek email untuk verifikasi, lalu login.");
        recaptchaV2.reset();
        setTimeout(() => { setActiveTab("login"); setLoginForm({ email: registerForm.email, password: "" }); }, 500);
      }
    } catch { animateFeedback(false); showError("Koneksi Gagal", "Tidak dapat terhubung ke server. Periksa koneksi internet Anda."); }
    finally { setIsLoading(false); }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);

    // Safety net: jika redirect tidak terjadi dalam 15 detik, reset state
    const safetyTimer = setTimeout(() => {
      setIsGoogleLoading(false);
    }, 15_000);

    try {
      const { error } = await signInWithGoogle();
      if (error) {
        clearTimeout(safetyTimer);
        showError("Google Sign-In Gagal", error.message || "Tidak dapat masuk dengan Google. Coba lagi.");
        setIsGoogleLoading(false);
      }
      // Jika sukses, redirect OAuth akan terjadi — komponen unmount,
      // timer akan di-clear via cleanup useEffect atau tidak relevan lagi
    } catch {
      clearTimeout(safetyTimer);
      showError("Koneksi Gagal", "Tidak dapat terhubung ke server.");
      setIsGoogleLoading(false);
    }
  };

  const features = [
    { icon: GraduationCap, text: "Untuk Guru" },
    { icon: Shield, text: "Data Aman" },
    { icon: CheckCircle, text: "Gratis" },
  ];

  // ── Render: iOS-inspired clean auth ──
  return (
    <div ref={pageRef} className="min-h-screen min-h-[100dvh] flex items-center justify-center relative overflow-hidden p-4 sm:p-6">
      {/* Background – deep gradient */}
      <div
        ref={bgGradientRef}
        className="absolute inset-0"
        style={{ background: "linear-gradient(160deg, hsl(221 83% 10%) 0%, hsl(221 60% 18%) 40%, hsl(200 50% 12%) 100%)" }}
      />

      {/* Subtle noise texture */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E\")"
      }} />

      {/* Orbs – soft, minimal */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div ref={orb1Ref} className="absolute -top-20 -left-20 w-64 sm:w-80 h-64 sm:h-80 bg-primary/10 rounded-full blur-[100px]" />
        <div ref={orb2Ref} className="absolute -bottom-20 -right-20 w-72 sm:w-96 h-72 sm:h-96 bg-accent/8 rounded-full blur-[120px]" />
        <div ref={orb3Ref} className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[150px]" />
      </div>

      <div className="w-full max-w-[420px] relative z-10">
        {/* Back button */}
        <Button
          ref={backBtnRef}
          variant="ghost" size="sm"
          onClick={() => navigate("/")}
          onPointerEnter={(e) => hoverScale(e.currentTarget, true)}
          onPointerLeave={(e) => hoverScale(e.currentTarget, false)}
          className="mb-4 sm:mb-6 gap-2 text-white/60 hover:text-white hover:bg-white/5 rounded-xl"
          style={{ opacity: 0 }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm">Kembali</span>
        </Button>

        {/* Main Card – frosted glass iOS style */}
        <div ref={cardRef} style={{ opacity: 0 }}>
          <div className="rounded-2xl sm:rounded-3xl border border-white/[0.08] bg-white/[0.04] backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
            {/* Top highlight line */}
            <div className="h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />

            {/* Header */}
            <div className="px-6 sm:px-8 pt-8 sm:pt-10 pb-4 text-center">
              {/* Logo */}
              <div ref={logoRef} className="flex justify-center mb-5" style={{ opacity: 0 }}>
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/15 rounded-2xl blur-2xl scale-[1.6]" />
                  <SipenaLogo size="lg" />
                </div>
              </div>

              {/* Title */}
              <div ref={titleRef} style={{ opacity: 0 }}>
                <h1 className="text-2xl sm:text-[28px] font-bold text-white tracking-tight">
                  {activeTab === "login" ? "Selamat Datang" : "Buat Akun Baru"}
                </h1>
                <p className="text-sm text-white/50 mt-1.5">
                  Sistem Informasi Penilaian Akademik
                </p>
              </div>

              {/* Feature badges */}
              <div ref={badgesRef} className="flex flex-wrap justify-center gap-2 mt-4">
                {features.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.06] text-white/60 text-[11px] font-medium border border-white/[0.06]">
                    <f.icon className="w-3 h-3" />
                    {f.text}
                  </span>
                ))}
              </div>

              {/* Google Sign-In Button */}
              <div className="mt-5 px-0">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading || isLoading}
                  className="w-full flex items-center justify-center gap-3 h-12 rounded-xl border border-white/[0.12] bg-white/[0.06] hover:bg-white/[0.10] text-white/80 hover:text-white text-sm font-medium transition-all duration-200 touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  {isGoogleLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  )}
                  {isGoogleLoading ? "Menghubungkan..." : "Masuk dengan Google"}
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3 mt-5 mb-1">
                <div className="flex-1 h-px bg-white/[0.08]" />
                <span className="text-[11px] text-white/30 font-medium tracking-wide">ATAU</span>
                <div className="flex-1 h-px bg-white/[0.08]" />
              </div>
            </div>

            {/* Tab bar – iOS segmented control */}
            <div className="px-6 sm:px-8 pb-4">
              <div ref={tabBarRef} className="flex bg-white/[0.05] rounded-xl p-1 border border-white/[0.05]" style={{ opacity: 0 }}>
                {(["login", "register"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 touch-manipulation min-h-[44px]",
                      activeTab === tab
                        ? "bg-primary text-white shadow-lg shadow-primary/30"
                        : "text-white/50 hover:text-white/70"
                    )}
                  >
                    {tab === "login" ? "Masuk" : "Daftar"}
                  </button>
                ))}
              </div>
            </div>

            {/* Form area */}
            <div className="px-6 sm:px-8 pb-8 sm:pb-10">
              {activeTab === "login" ? (
                <form ref={formRef} onSubmit={handleLogin} className="space-y-4">
                  <AuthField label="Email" id="login-email" icon={Mail}
                    type="email" placeholder="nama@email.com" value={loginForm.email}
                    onChange={(v) => { handleEmailChange(v, 'login'); clearFieldError('login-email'); }} disabled={isLoading} onFocus={focusField}
                    error={fieldErrors["login-email"]}
                  />
                  <AuthField label="Password" id="login-pw" icon={Lock}
                    type={showPassword ? "text" : "password"} placeholder="••••••••" value={loginForm.password}
                    onChange={(v) => { setLoginForm(p => ({ ...p, password: v })); clearFieldError('login-pw'); }} disabled={isLoading} onFocus={focusField}
                    showToggle showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)}
                    error={fieldErrors["login-pw"]}
                  />
                  <SubmitButton loading={isLoading} label="Masuk ke SIPENA" onHover={hoverScale} />
                  
                  {/* Forgot Password Link */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(true)}
                      className="text-xs text-white/40 hover:text-primary transition-colors touch-manipulation"
                    >
                      Lupa password?
                    </button>
                  </div>
                </form>
              ) : (
                <form ref={formRef} onSubmit={handleRegister} className="space-y-4">
                  <AuthField label="Nama Lengkap" id="reg-name" icon={User}
                    type="text" placeholder="Nama lengkap Anda" value={registerForm.name}
                    onChange={(v) => { setRegisterForm(p => ({ ...p, name: v })); clearFieldError('reg-name'); }} disabled={isLoading} onFocus={focusField}
                    error={fieldErrors["reg-name"]}
                  />
                  <AuthField label="Email" id="reg-email" icon={Mail}
                    type="email" placeholder="nama@email.com" value={registerForm.email}
                    onChange={(v) => { handleEmailChange(v, 'register'); clearFieldError('reg-email'); }} disabled={isLoading} onFocus={focusField}
                    error={fieldErrors["reg-email"]}
                  />
                  <AuthField label="Password" id="reg-pw" icon={Lock}
                    type={showPassword ? "text" : "password"} placeholder="Minimal 6 karakter" value={registerForm.password}
                    onChange={(v) => { setRegisterForm(p => ({ ...p, password: v })); clearFieldError('reg-pw'); }} disabled={isLoading} onFocus={focusField}
                    showToggle showPassword={showPassword} onTogglePassword={() => setShowPassword(!showPassword)}
                    error={fieldErrors["reg-pw"]}
                  />
                  <AuthField label="Konfirmasi Password" id="reg-confirm" icon={Lock}
                    type={showPassword ? "text" : "password"} placeholder="Ulangi password" value={registerForm.confirmPassword}
                    onChange={(v) => { setRegisterForm(p => ({ ...p, confirmPassword: v })); clearFieldError('reg-confirm'); }} disabled={isLoading} onFocus={focusField}
                    error={fieldErrors["reg-confirm"]}
                  />
                  
                  {/* reCAPTCHA v2 Checkbox - wajib untuk pendaftaran */}
                  {recaptchaV2.isConfigured && (
                    <div className="auth-field">
                      <ReCaptchaV2Widget 
                        onVerify={recaptchaV2.onVerify}
                        onExpire={recaptchaV2.onExpire}
                        onError={recaptchaV2.onError}
                      />
                    </div>
                  )}

                  <SubmitButton loading={isLoading} label="Buat Akun SIPENA" onHover={hoverScale} />
                </form>
              )}

              {/* reCAPTCHA Disclosure – wajib Google */}
              <ReCaptchaDisclosure />
            </div>
          </div>
        </div>

        {/* Footer */}
        <p ref={footerRef} className="text-center text-xs text-white/30 mt-5" style={{ opacity: 0 }}>
          Dengan masuk, Anda menyetujui{" "}
          <a href="/terms" className="underline hover:text-white/50 transition-colors">Syarat &amp; Ketentuan</a> SIPENA
        </p>
      </div>

      {/* reCAPTCHA Badge Hider */}
      <ReCaptchaBadgeHider />

      {/* Forgot Password Dialog */}
      <ForgotPasswordDialog
        isOpen={showForgotPassword}
        onClose={() => setShowForgotPassword(false)}
        onSuccess={() => {
          setShowForgotPassword(false);
          showSuccess("Link Reset Terkirim", "Cek inbox email Anda untuk reset password.");
        }}
      />
    </div>
  );
};

// ── Subcomponents ──

function AuthField({ label, id, icon: Icon, type, placeholder, value, onChange, disabled, onFocus, showToggle, showPassword, onTogglePassword, error }: {
  label: string; id: string; icon: React.ElementType; type: string; placeholder: string;
  value: string; onChange: (v: string) => void; disabled: boolean;
  onFocus: (el: HTMLElement | null, focused: boolean) => void;
  showToggle?: boolean; showPassword?: boolean; onTogglePassword?: () => void;
  error?: string;
}) {
  return (
    <div className="space-y-1.5 auth-field">
      <Label htmlFor={id} className="text-xs font-medium text-white/60 pl-0.5">{label}</Label>
      <div
        className="relative group"
        onFocus={(e) => onFocus(e.currentTarget, true)}
        onBlur={(e) => onFocus(e.currentTarget, false)}
      >
        <Icon className={cn(
          "absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 transition-colors duration-200",
          error ? "text-red-400" : "text-white/30 group-focus-within:text-primary"
        )} />
        <Input
          id={id} type={type} placeholder={placeholder} value={value}
          onChange={(e) => onChange(e.target.value)} disabled={disabled}
          className={cn(
            "pl-10 h-12 rounded-xl bg-white/[0.05] text-white placeholder:text-white/25 focus:ring-1 focus:bg-white/[0.07] transition-all duration-200 [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_rgb(15,28,58)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill:hover]:[-webkit-box-shadow:0_0_0_1000px_rgb(15,28,58)_inset] [&:-webkit-autofill:focus]:[-webkit-box-shadow:0_0_0_1000px_rgb(20,33,65)_inset]",
            error ? "border-red-400/60 focus:border-red-400/80 focus:ring-red-400/20" : "border-white/[0.08] focus:border-primary/50 focus:ring-primary/20"
          )}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        {showToggle && (
          <button type="button" onClick={onTogglePassword}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 p-1.5 rounded-lg transition-colors touch-manipulation">
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-red-400 pl-0.5 animate-fade-in" role="alert">{error}</p>
      )}
    </div>
  );
}

function SubmitButton({ loading, label, onHover }: {
  loading: boolean; label: string; onHover: (el: HTMLElement | null, enter: boolean) => void;
}) {
  return (
    <Button
      type="submit"
      className="w-full h-12 text-sm font-semibold rounded-xl bg-primary hover:bg-primary/90 shadow-xl shadow-primary/20 mt-2 transition-all duration-200"
      disabled={loading}
      onPointerEnter={(e) => onHover(e.currentTarget, true)}
      onPointerLeave={(e) => onHover(e.currentTarget, false)}
    >
      {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Memproses...</> : label}
    </Button>
  );
}

export default Auth;

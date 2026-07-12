import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { GuestAuthDialog } from "@/components/auth/GuestAuthDialog";
import { ReCaptchaDisclosure, ReCaptchaBadgeHider, useReCaptcha } from "@/components/auth/ReCaptcha";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  UserCircle,
  Mail,
  AlertCircle,
  Shield,
  Loader2,
  LogIn,
  XCircle,
  Clock,
  BookOpen,
  School,
  UserCheck,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  KeyRound,
  Wifi,
} from "lucide-react";
import { z } from "zod";

// Validation schema
const guestSchema = z.object({
  name: z.string().min(2, "Nama minimal 2 karakter").max(100, "Nama maksimal 100 karakter"),
  email: z.string().email("Email tidak valid").max(255, "Email maksimal 255 karakter"),
});

interface SubjectInfo {
  id: string;
  name: string;
  kkm: number;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface TokenValidation {
  id: string;
  is_valid: boolean;
  error_message?: string;
  subject_id: string;
  class_id: string;
  user_id: string;
}

interface GuestAccessShellProps {
  children: React.ReactNode;
  backHref?: string;
  compact?: boolean;
}

function GuestAccessShell({ children, backHref = "/", compact = false }: GuestAccessShellProps) {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-background sm:bg-muted/35 sm:px-4 sm:py-6 lg:py-10">
      <main
        className={`mx-auto flex min-h-[100dvh] w-full flex-col bg-background sm:min-h-0 sm:overflow-hidden sm:rounded-2xl sm:border sm:border-border/80 sm:shadow-xl sm:shadow-black/[0.07] ${compact ? "sm:max-w-md" : "sm:max-w-[600px]"}`}
      >
        <header className="flex min-h-16 items-center justify-between gap-3 border-b border-border/80 px-4 py-3 sm:px-6">
          <Button asChild variant="ghost" size="icon" className="h-11 w-11 shrink-0 touch-manipulation" aria-label="Kembali">
            <Link to={backHref}>
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>

          <div className="flex min-w-0 items-center gap-3">
            <img src="/sipena-icon-any-192-v2.png" alt="Logo SIPENA" className="h-10 w-10 shrink-0 object-contain" />
            <div className="min-w-0 text-left">
              <p className="truncate text-sm font-semibold text-foreground">SIPENA</p>
              <p className="truncate text-xs text-muted-foreground">Akses Guru Tamu</p>
            </div>
          </div>

          <div className="w-11 shrink-0" aria-hidden="true" />
        </header>

        <div className="flex-1 px-5 py-6 sm:px-7 sm:py-7">{children}</div>

        <footer className="border-t border-border/70 px-5 py-4 text-center text-xs leading-relaxed text-muted-foreground sm:px-7">
          Akses hanya berlaku untuk kelas dan mata pelajaran yang dibagikan.
        </footer>
      </main>
    </div>
  );
}

function AccessHeading({ icon: Icon, title, description }: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Icon className="h-7 w-7" />
      </div>
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{description}</p>
    </div>
  );
}

function AccessDetails({ loading, subjectName, className }: {
  loading: boolean;
  subjectName?: string;
  className?: string;
}) {
  return (
    <section className="border-y border-border/80 py-4" aria-label="Detail akses">
      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-3">
            <BookOpen className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Mata Pelajaran</p>
              <p className="truncate text-sm font-semibold text-foreground">{subjectName || "Belum tersedia"}</p>
            </div>
          </div>
          <div className="flex min-w-0 items-center gap-3">
            <School className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Kelas</p>
              <p className="truncate text-sm font-semibold text-foreground">{className || "Belum tersedia"}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

type GuestAccessRpcClient = {
  rpc: <T = unknown>(name: string, args?: Record<string, unknown>) => Promise<{ data: T | null; error: any }>;
};

const guestAccessRpc = supabase as unknown as GuestAccessRpcClient;

async function persistGuestAccessGrant(token: string | null, guestUserId?: string | null) {
  if (!token) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;

  const { error } = await guestAccessRpc.rpc("accept_guest_access", {
    p_token: token,
    p_guest_user_id: guestUserId || null,
  });

  if (error) {
    console.warn("[GuestAccess] Failed to persist guest access grant:", error);
  }
}

export default function GuestAccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { error: showError, success: showSuccess } = useEnhancedToast();
  const { user: signedInUser, loading: authLoading } = useAuth();
  
  // Memoize token to prevent unnecessary re-renders
  const token = useMemo(() => searchParams.get("token"), [searchParams]);

  // ALL HOOKS MUST BE CALLED AT TOP LEVEL - before any early returns
  const [tokenValidation, setTokenValidation] = useState<TokenValidation | null>(null);
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<{ name?: string; email?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subjectInfo, setSubjectInfo] = useState<SubjectInfo | null>(null);
  const [classInfo, setClassInfo] = useState<ClassInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [quickAccessOpen, setQuickAccessOpen] = useState(false);
  const [isContinuingAccount, setIsContinuingAccount] = useState(false);
  
  // Guest auth dialog state - MUST be at top level
  const [showGuestAuthDialog, setShowGuestAuthDialog] = useState(false);
  const { isConfigured: isRecaptchaConfigured } = useReCaptcha();

  const signedInUserName = useMemo(() => (
    signedInUser?.user_metadata?.full_name ||
    signedInUser?.email?.split("@")[0] ||
    "Guru"
  ), [signedInUser]);

  const signedInUserEmail = signedInUser?.email || "";

  // Auto-login for Google OAuth redirect - moved after handleGuestAuthSuccess definition

  // Validate token - only once on mount or token change
  useEffect(() => {
    let isCancelled = false;

    const validateToken = async () => {
      if (!token) {
        setValidating(false);
        return;
      }

      try {
        setValidating(true);
        setValidationError(null);

        const { data, error } = await supabase.rpc("validate_share_token", {
          p_token: token,
        });

        if (isCancelled) return;

        if (error) {
          console.error("[GuestAccess] Token validation error:", error);
          setValidationError("Gagal memvalidasi token");
          setTokenValidation(null);
        } else if (!data || data.length === 0) {
          setTokenValidation({ 
            id: '', 
            is_valid: false, 
            error_message: "Token tidak ditemukan",
            subject_id: '',
            class_id: '',
            user_id: ''
          });
        } else {
          setTokenValidation(data[0] as TokenValidation);
        }
      } catch (err) {
        console.error("[GuestAccess] Token validation exception:", err);
        if (!isCancelled) {
          setValidationError("Terjadi kesalahan saat memvalidasi");
        }
      } finally {
        if (!isCancelled) {
          setValidating(false);
        }
      }
    };

    validateToken();

    return () => {
      isCancelled = true;
    };
  }, [token]);

  // Load subject and class info when token is valid
  useEffect(() => {
    let isCancelled = false;

    const loadInfo = async () => {
      if (!tokenValidation?.is_valid || !tokenValidation.subject_id) return;

      setLoadingInfo(true);
      try {
        const [subjectRes, classRes] = await Promise.all([
          supabase
            .from("subjects")
            .select("id, name, kkm")
            .eq("id", tokenValidation.subject_id)
            .single(),
          supabase
            .from("classes")
            .select("id, name")
            .eq("id", tokenValidation.class_id)
            .single(),
        ]);

        if (isCancelled) return;

        if (subjectRes.data) setSubjectInfo(subjectRes.data);
        if (classRes.data) setClassInfo(classRes.data);
      } catch (error) {
        console.error("[GuestAccess] Error loading info:", error);
      } finally {
        if (!isCancelled) {
          setLoadingInfo(false);
        }
      }
    };

    loadInfo();

    return () => {
      isCancelled = true;
    };
  }, [tokenValidation?.is_valid, tokenValidation?.subject_id, tokenValidation?.class_id]);

  // Memoized handlers to prevent re-renders
  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
    if (errors.name) setErrors(prev => ({ ...prev, name: undefined }));
  }, [errors.name]);

  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
    if (errors.email) setErrors(prev => ({ ...prev, email: undefined }));
  }, [errors.email]);

  const handleGuestAuthSuccess = useCallback(async (guestData: { 
    guestId: string; 
    name: string; 
    email: string;
    isMainTeacher?: boolean;
    mainUserId?: string;
  }) => {
    if (!tokenValidation) return;

    try {
      // Determine guest_user_id - for main teachers, we may not have an entry in guest_users
      let guestUserId: string | null = guestData.isMainTeacher ? null : guestData.guestId;

      // For main teachers, create or get guest_users entry for tracking
      if (guestData.isMainTeacher && guestData.mainUserId) {
        // Check if there's already a guest entry for this main user email
        const { data: existingGuest } = await supabase
          .from("guest_users")
          .select("id")
          .eq("email", guestData.email)
          .maybeSingle();

        if (existingGuest) {
          guestUserId = existingGuest.id;
        } else {
          // Create a guest entry for tracking purposes (linked to main account)
          const { data: newGuest } = await supabase
            .from("guest_users")
            .insert({
              name: guestData.name,
              email: guestData.email,
              is_registered: true, // Main teacher accounts are considered registered
            })
            .select("id")
            .single();
          
          if (newGuest) {
            guestUserId = newGuest.id;
          }
        }
      }

      // Log guest access with detailed info
      await supabase.from("guest_audit_logs").insert({
        shared_link_id: tokenValidation.id,
        guest_user_id: guestUserId,
        action: guestData.isMainTeacher ? "main_teacher_access" : "guest_login",
        details: { 
          name: guestData.name, 
          email: guestData.email, 
          method: guestData.isMainTeacher ? "main_account" : "registered",
          main_user_id: guestData.mainUserId || null,
        },
      });

      // Update last_used_at
      await supabase
        .from("shared_links")
        .update({ 
          last_used_at: new Date().toISOString(),
          guest_user_id: guestUserId,
        })
        .eq("id", tokenValidation.id);

      await persistGuestAccessGrant(token, guestUserId);

      // Create notification for the link owner
      await supabase.from("notifications").insert({
        user_id: tokenValidation.user_id,
        type: "guest_access",
        title: guestData.isMainTeacher ? "Akses Guru Utama" : "Akses Guru Tamu",
        message: `${guestData.name} (${guestData.email}) mengakses link input nilai${guestData.isMainTeacher ? " menggunakan akun utama" : ""}`,
        data: {
          guest_name: guestData.name,
          guest_email: guestData.email,
          is_main_teacher: guestData.isMainTeacher || false,
          shared_link_id: tokenValidation.id,
          subject_id: tokenValidation.subject_id,
          class_id: tokenValidation.class_id,
        },
      });

      // Store guest info in session storage
      sessionStorage.setItem(
        "guest_session",
        JSON.stringify({
          guestId: guestUserId || guestData.guestId,
          name: guestData.name,
          email: guestData.email,
          token,
          sharedLinkId: tokenValidation.id,
          subjectId: tokenValidation.subject_id,
          classId: tokenValidation.class_id,
          userId: tokenValidation.user_id,
          isMainTeacher: guestData.isMainTeacher || false,
          mainUserId: guestData.mainUserId || null,
        })
      );

      const successMsg = guestData.isMainTeacher 
        ? "Login berhasil dengan akun utama Anda!" 
        : "Berhasil masuk sebagai Guru Tamu";
      
      showSuccess(successMsg, "Mengalihkan ke halaman input nilai...");
      navigate(`/guest/grades?token=${token}`);
    } catch (error: any) {
      console.error("[GuestAccess] Guest auth success handler error:", error);
      showError("Gagal", error.message || "Terjadi kesalahan");
    }
  }, [tokenValidation, token, navigate, showError, showSuccess]);

  // Auto-login for Google OAuth redirect
  useEffect(() => {
    const pending = sessionStorage.getItem('guest_google_auth_pending');
    if (!pending || !tokenValidation?.is_valid) return;
    
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        sessionStorage.removeItem('guest_google_auth_pending');
        const userName = session.user.user_metadata?.full_name || 
                        session.user.email?.split('@')[0] || 'Guru';
        handleGuestAuthSuccess({
          guestId: session.user.id,
          name: userName,
          email: session.user.email || '',
          isMainTeacher: true,
          mainUserId: session.user.id,
        });
      }
    };
    checkAuth();
  }, [tokenValidation?.is_valid, handleGuestAuthSuccess]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrors({});

    // Validate input
    const result = guestSchema.safeParse({ name, email });
    if (!result.success) {
      const fieldErrors: { name?: string; email?: string } = {};
      result.error.errors.forEach((err) => {
        if (err.path[0] === "name") fieldErrors.name = err.message;
        if (err.path[0] === "email") fieldErrors.email = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    if (!tokenValidation || !tokenValidation.is_valid) {
      showError("Token tidak valid", "Link akses tidak valid atau sudah kadaluarsa");
      return;
    }

    setIsSubmitting(true);
    try {
      // Check if guest already exists
      const { data: existing } = await supabase
        .from("guest_users")
        .select("id")
        .eq("email", email.trim())
        .maybeSingle();

      let guestId: string;

      if (existing) {
        guestId = existing.id;
      } else {
        // Register new guest
        const { data: newGuest, error: registerError } = await supabase
          .from("guest_users")
          .insert({
            name: name.trim(),
            email: email.trim(),
          })
          .select()
          .single();

        if (registerError) throw registerError;
        guestId = newGuest.id;
      }

      // Log guest access
      await supabase.from("guest_audit_logs").insert({
        shared_link_id: tokenValidation.id,
        guest_user_id: guestId,
        action: "guest_login",
        details: { name: name.trim(), email: email.trim() },
      });

      // Update last_used_at
      await supabase
        .from("shared_links")
        .update({ 
          last_used_at: new Date().toISOString(),
          guest_user_id: guestId,
        })
        .eq("id", tokenValidation.id);

      await persistGuestAccessGrant(token, guestId);

      // Store guest info in session storage
      sessionStorage.setItem(
        "guest_session",
        JSON.stringify({
          guestId,
          name: name.trim(),
          email: email.trim(),
          token,
          sharedLinkId: tokenValidation.id,
          subjectId: tokenValidation.subject_id,
          classId: tokenValidation.class_id,
          userId: tokenValidation.user_id,
        })
      );

      showSuccess("Berhasil masuk", "Mengalihkan ke halaman input nilai...");
      
      // Navigate to guest grade input
      navigate(`/guest/grades?token=${token}`);
    } catch (error: any) {
      console.error("[GuestAccess] Submit error:", error);
      showError("Gagal mendaftar", error.message || "Terjadi kesalahan saat mendaftar");
    } finally {
      setIsSubmitting(false);
    }
  }, [name, email, tokenValidation, token, navigate, showError, showSuccess, isSubmitting]);

  const handleContinueWithSignedInAccount = useCallback(async () => {
    if (!signedInUser || !tokenValidation?.is_valid || isContinuingAccount) return;

    setIsContinuingAccount(true);
    try {
      await handleGuestAuthSuccess({
        guestId: signedInUser.id,
        name: signedInUserName,
        email: signedInUserEmail,
        isMainTeacher: true,
        mainUserId: signedInUser.id,
      });
    } finally {
      setIsContinuingAccount(false);
    }
  }, [
    signedInUser,
    signedInUserEmail,
    signedInUserName,
    tokenValidation?.is_valid,
    handleGuestAuthSuccess,
    isContinuingAccount,
  ]);

  if (!token) {
    return (
      <GuestAccessShell compact>
        <div className="space-y-7 py-4">
          <AccessHeading
            icon={XCircle}
            title="Link Tidak Lengkap"
            description="Token akses tidak ditemukan. Buka kembali link lengkap yang dibagikan oleh guru pemilik kelas."
          />
          <Button asChild variant="outline" className="h-12 w-full touch-manipulation">
            <Link to="/">Kembali ke Beranda</Link>
          </Button>
        </div>
      </GuestAccessShell>
    );
  }

  if (validating || authLoading) {
    return (
      <GuestAccessShell compact>
        <div className="flex min-h-64 flex-col items-center justify-center py-8 text-center" role="status" aria-live="polite">
          <Loader2 className="mb-4 h-9 w-9 animate-spin text-primary" />
          <h1 className="text-lg font-semibold text-foreground">
            {validating ? "Memeriksa Link Akses" : "Memeriksa Sesi Akun"}
          </h1>
          <p className="mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">
            {validating
              ? "SIPENA sedang memastikan link masih aktif dan aman digunakan."
              : "SIPENA sedang memeriksa apakah akun Anda sudah aktif di perangkat ini."}
          </p>
        </div>
      </GuestAccessShell>
    );
  }

  if (validationError) {
    return (
      <GuestAccessShell compact>
        <div className="space-y-7 py-4">
          <AccessHeading icon={AlertCircle} title="Akses Belum Dapat Diperiksa" description={validationError} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Button onClick={() => window.location.reload()} className="h-12 touch-manipulation">Coba Lagi</Button>
            <Button asChild variant="outline" className="h-12 touch-manipulation">
              <Link to="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        </div>
      </GuestAccessShell>
    );
  }

  if (!tokenValidation?.is_valid) {
    const errorMsg = tokenValidation?.error_message || "Link tidak dapat digunakan";
    const normalizedError = errorMsg.toLowerCase();
    const isRevoked = normalizedError.includes("dicabut");
    const isExpired = normalizedError.includes("kadaluarsa") || normalizedError.includes("kedaluwarsa");
    const title = isRevoked
      ? "Akses Sudah Dicabut"
      : isExpired
        ? "Link Sudah Kedaluwarsa"
        : "Link Tidak Dapat Digunakan";

    return (
      <GuestAccessShell compact>
        <div className="space-y-7 py-4">
          <AccessHeading icon={isExpired ? Clock : XCircle} title={title} description={errorMsg} />
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Hubungi guru pemilik link untuk meminta akses baru.
            </AlertDescription>
          </Alert>
          <Button asChild variant="outline" className="h-12 w-full touch-manipulation">
            <Link to="/">Kembali ke Beranda</Link>
          </Button>
        </div>
      </GuestAccessShell>
    );
  }

  const isOwnerOpeningOwnLink = !!signedInUser && signedInUser.id === tokenValidation.user_id;
  const ownerGradesUrl = `/grades?classId=${encodeURIComponent(tokenValidation.class_id)}&subjectId=${encodeURIComponent(tokenValidation.subject_id)}`;

  if (isOwnerOpeningOwnLink) {
    return (
      <GuestAccessShell>
        <ReCaptchaBadgeHider />
        <div className="space-y-6">
          <AccessHeading
            icon={Shield}
            title="Ini Link Milik Anda"
            description="Anda terdeteksi sebagai pemilik kelas. Kelola mata pelajaran ini melalui halaman Input Nilai biasa."
          />
          <AccessDetails loading={loadingInfo} subjectName={subjectInfo?.name} className={classInfo?.name} />
          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild className="h-12 touch-manipulation">
              <Link to={ownerGradesUrl}>
                Buka Input Nilai Saya
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-12 touch-manipulation">
              <Link to="/dashboard">Kembali ke Dashboard</Link>
            </Button>
          </div>
        </div>
      </GuestAccessShell>
    );
  }

  if (signedInUser) {
    return (
      <GuestAccessShell>
        <ReCaptchaBadgeHider />
        <div className="space-y-6">
          <AccessHeading
            icon={UserCheck}
            title="Lanjut dengan Akun SIPENA"
            description="Akun aktif ditemukan. Konfirmasi untuk menyimpan akses ini sebagai akses guru tamu Anda."
          />
          <AccessDetails loading={loadingInfo} subjectName={subjectInfo?.name} className={classInfo?.name} />

          <section className="flex items-center gap-3 rounded-xl bg-muted/55 px-4 py-3" aria-label="Akun yang sedang aktif">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {signedInUserName.slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{signedInUserName}</p>
              <p className="truncate text-xs text-muted-foreground">{signedInUserEmail || "Akun SIPENA aktif"}</p>
            </div>
            <Badge variant="secondary" className="shrink-0">Aktif</Badge>
          </section>

          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Shield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="leading-relaxed">
              Akses tersimpan di akun ini dan dapat dibuka kembali dari Dashboard atau halaman Kelas selama link masih aktif.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button
              type="button"
              className="h-12 touch-manipulation sm:order-2"
              onClick={handleContinueWithSignedInAccount}
              disabled={isContinuingAccount}
            >
              {isContinuingAccount && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Lanjut Input Nilai
              {!isContinuingAccount && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
            <Button variant="outline" className="h-12 touch-manipulation sm:order-1" onClick={() => setShowGuestAuthDialog(true)} disabled={isContinuingAccount}>
              Gunakan Akun Lain
            </Button>
          </div>
        </div>

        <GuestAuthDialog
          isOpen={showGuestAuthDialog}
          onClose={() => setShowGuestAuthDialog(false)}
          onSuccess={handleGuestAuthSuccess}
          subjectName={subjectInfo?.name}
          className={classInfo?.name}
          shareToken={token || undefined}
        />
      </GuestAccessShell>
    );
  }

  // Valid token - show unified login/register form
  return (
    <GuestAccessShell>
      <ReCaptchaBadgeHider />
      <div className="space-y-6">
        <AccessHeading
          icon={UserCircle}
          title="Akses Input Nilai"
          description="Masuk sebagai guru tamu untuk mengisi nilai pada kelas dan mata pelajaran yang dibagikan."
        />
        <AccessDetails loading={loadingInfo} subjectName={subjectInfo?.name} className={classInfo?.name} />

        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <Wifi className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="leading-relaxed">
            Perubahan nilai tersinkron langsung dengan data guru pemilik tanpa mengubah data pribadi akun Anda.
          </p>
        </div>

        <Button
          type="button"
          className="h-auto min-h-14 w-full justify-start gap-3 px-4 py-3 text-left touch-manipulation"
          onClick={() => setShowGuestAuthDialog(true)}
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <UserCheck className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">Masuk / Daftar SIPENA</span>
            <span className="block text-xs font-normal leading-relaxed text-primary-foreground/80">Akses tersimpan dan dapat dibuka kembali</span>
          </span>
          <ArrowRight className="h-5 w-5 shrink-0" />
        </Button>

        <Collapsible open={quickAccessOpen} onOpenChange={setQuickAccessOpen} className="rounded-xl border border-border/80">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group flex min-h-14 w-full touch-manipulation items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              aria-label={quickAccessOpen ? "Tutup formulir masuk cepat" : "Buka formulir masuk cepat"}
            >
              <KeyRound className="h-5 w-5 shrink-0 text-muted-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">Masuk Cepat tanpa Akun</span>
                <span className="block text-xs leading-relaxed text-muted-foreground">Untuk penggunaan sekali; akses tidak tersimpan di Dashboard</span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <form onSubmit={handleSubmit} className="space-y-4 border-t border-border/80 px-4 pb-4 pt-5">
              <p className="text-xs leading-relaxed text-muted-foreground">
                Masukkan identitas yang dapat dikenali guru pemilik link. Pilihan ini tidak membuat akun SIPENA.
              </p>
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  onChange={handleNameChange}
                  className={`h-12 pl-10 ${errors.name ? "border-destructive" : ""}`}
                  disabled={isSubmitting}
                  autoComplete="name"
                />
              </div>
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className={`h-12 pl-10 ${errors.email ? "border-destructive" : ""}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <Button type="submit" variant="outline" className="h-12 w-full touch-manipulation" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Masuk Cepat
            </Button>
            </form>
          </CollapsibleContent>
        </Collapsible>

        <p className="text-center text-xs leading-relaxed text-muted-foreground">
          Dengan melanjutkan, Anda menyetujui ketentuan penggunaan SIPENA.
        </p>
        {isRecaptchaConfigured && <ReCaptchaDisclosure />}
      </div>

      {/* Guest Auth Dialog - Unified */}
      <GuestAuthDialog
        isOpen={showGuestAuthDialog}
        onClose={() => setShowGuestAuthDialog(false)}
        onSuccess={handleGuestAuthSuccess}
        subjectName={subjectInfo?.name}
        className={classInfo?.name}
        shareToken={token || undefined}
      />
    </GuestAccessShell>
  );
}

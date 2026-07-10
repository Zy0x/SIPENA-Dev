import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
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
          console.log("[GuestAccess] Token validated:", data[0]);
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
  }, [name, email, tokenValidation, token, navigate, showError, showSuccess]);

  const handleContinueWithSignedInAccount = useCallback(async () => {
    if (!signedInUser || !tokenValidation?.is_valid) return;

    await handleGuestAuthSuccess({
      guestId: signedInUser.id,
      name: signedInUserName,
      email: signedInUserEmail,
      isMainTeacher: true,
      mainUserId: signedInUser.id,
    });
  }, [
    signedInUser,
    signedInUserEmail,
    signedInUserName,
    tokenValidation?.is_valid,
    handleGuestAuthSuccess,
  ]);

  // No token provided
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Link Tidak Valid
            </h2>
            <p className="text-muted-foreground text-center mb-4">
              Token akses tidak ditemukan. Pastikan Anda menggunakan link yang benar.
            </p>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Beranda
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validating token
  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Memvalidasi akses...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Validation error
  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Terjadi Kesalahan
            </h2>
            <p className="text-muted-foreground text-center mb-4">
              {validationError}
            </p>
            <div className="flex gap-2">
              <Button onClick={() => window.location.reload()} variant="outline">
                Coba Lagi
              </Button>
              <Button asChild variant="ghost">
                <Link to="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Beranda
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Token invalid
  if (!tokenValidation?.is_valid) {
    const errorMsg = tokenValidation?.error_message || "Link tidak dapat digunakan";
    const isRevoked = errorMsg.includes("dicabut");
    const isExpired = errorMsg.includes("kadaluarsa");

    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              {isRevoked ? (
                <XCircle className="w-8 h-8 text-destructive" />
              ) : isExpired ? (
                <Clock className="w-8 h-8 text-amber-500" />
              ) : (
                <AlertCircle className="w-8 h-8 text-destructive" />
              )}
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Akses Tidak Valid
            </h2>
            <p className="text-muted-foreground text-center mb-4">
              {errorMsg}
            </p>
            <Alert variant="destructive" className="max-w-sm mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Hubungi wali kelas untuk mendapatkan link akses yang baru.
              </AlertDescription>
            </Alert>
            <Button asChild variant="outline">
              <Link to="/">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Kembali ke Beranda
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <Card className="w-full max-w-md animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-10 h-10 text-primary animate-spin mb-4" />
            <p className="text-muted-foreground">Memeriksa sesi akun...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isOwnerOpeningOwnLink = !!signedInUser && signedInUser.id === tokenValidation.user_id;
  const ownerGradesUrl = `/grades?classId=${encodeURIComponent(tokenValidation.class_id)}&subjectId=${encodeURIComponent(tokenValidation.subject_id)}`;

  if (isOwnerOpeningOwnLink) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <ReCaptchaBadgeHider />
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center relative">
            <div className="absolute left-4 top-4">
              <Button asChild variant="ghost" size="icon" className="h-12 w-12">
                <Link to="/">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
            </div>

            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Ini Link Milik Anda</CardTitle>
            <CardDescription>
              Link ini dibuat dari akun SIPENA yang sedang aktif.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              {loadingInfo ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Mapel:</span>
                    <Badge variant="secondary">{subjectInfo?.name || "-"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Kelas:</span>
                    <Badge variant="outline">{classInfo?.name || "-"}</Badge>
                  </div>
                </>
              )}
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Akses Pemilik Kelas</AlertTitle>
              <AlertDescription className="text-xs">
                Anda tidak perlu masuk sebagai guru tamu. Gunakan halaman Nilai biasa untuk mengelola mapel ini sebagai pemilik data.
              </AlertDescription>
            </Alert>

            <Button asChild className="w-full h-12">
              <Link to={ownerGradesUrl}>
                Buka Input Nilai Saya
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full h-12">
              <Link to="/dashboard">
                Kembali ke Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (signedInUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
        <ReCaptchaBadgeHider />
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader className="text-center relative">
            <div className="absolute left-4 top-4">
              <Button asChild variant="ghost" size="icon" className="h-12 w-12">
                <Link to="/">
                  <ArrowLeft className="w-5 h-5" />
                </Link>
              </Button>
            </div>

            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <UserCheck className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Lanjut dengan Akun SIPENA</CardTitle>
            <CardDescription>
              Anda sudah login. Gunakan akun ini sebagai guru tamu untuk akses yang dibagikan.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
              {loadingInfo ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Mapel:</span>
                    <Badge variant="secondary">{subjectInfo?.name || "-"}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <School className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Kelas:</span>
                    <Badge variant="outline">{classInfo?.name || "-"}</Badge>
                  </div>
                </>
              )}
            </div>

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Akses Aman & Tersimpan</AlertTitle>
              <AlertDescription className="text-xs">
                Akses ini akan tersimpan di akun {signedInUserEmail || signedInUserName}, sehingga bisa dibuka lagi dari Dashboard atau halaman Kelas selama link masih aktif.
              </AlertDescription>
            </Alert>

            <div className="rounded-lg border bg-card p-4">
              <p className="text-sm font-medium">{signedInUserName}</p>
              <p className="text-xs text-muted-foreground">{signedInUserEmail || "Akun SIPENA aktif"}</p>
            </div>

            <Button
              type="button"
              className="w-full h-12"
              onClick={handleContinueWithSignedInAccount}
            >
              Lanjut Input Nilai
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            <Button variant="outline" className="w-full h-12" onClick={() => setShowGuestAuthDialog(true)}>
              Gunakan Akun Lain
            </Button>
          </CardContent>
        </Card>

        <GuestAuthDialog
          isOpen={showGuestAuthDialog}
          onClose={() => setShowGuestAuthDialog(false)}
          onSuccess={handleGuestAuthSuccess}
          subjectName={subjectInfo?.name}
          className={classInfo?.name}
          shareToken={token || undefined}
        />
      </div>
    );
  }

  // Valid token - show unified login/register form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/50 p-4">
      <ReCaptchaBadgeHider />
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader className="text-center relative">
          {/* Back button */}
          <div className="absolute left-4 top-4">
            <Button asChild variant="ghost" size="icon" className="h-12 w-12">
              <Link to="/">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
          </div>
          
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-xl">Akses Input Nilai</CardTitle>
          <CardDescription>
            Pilih cara masuk untuk melanjutkan
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Subject & Class Info */}
          <div className="p-4 bg-muted/50 rounded-lg border space-y-2">
            {loadingInfo ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-32" />
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Mapel:</span>
                  <Badge variant="secondary">{subjectInfo?.name || "-"}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <School className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Kelas:</span>
                  <Badge variant="outline">{classInfo?.name || "-"}</Badge>
                </div>
              </>
            )}
          </div>

          {/* Privacy & Sync Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Akses Aman & Sinkron</AlertTitle>
            <AlertDescription className="text-xs">
              Input nilai akan langsung sinkron dengan kelas pemilik link, 
              tanpa mengubah data pribadi akun Anda.
            </AlertDescription>
          </Alert>

          {/* Main Login/Register Button */}
          <div className="space-y-3">
            <Button
              variant="default"
              className="w-full h-14 justify-start gap-4"
              onClick={() => setShowGuestAuthDialog(true)}
            >
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="text-left flex-1">
                <p className="font-medium">Login / Daftar</p>
                <p className="text-xs opacity-80">Untuk akun yang belum login di perangkat ini</p>
              </div>
              <ArrowRight className="w-5 h-5" />
            </Button>

            <Separator className="my-2" />

            <p className="text-xs text-center text-muted-foreground">
              Atau masuk cepat tanpa akun (data tidak tersimpan)
            </p>
          </div>

          {/* Quick Access Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nama Lengkap</Label>
              <div className="relative">
                <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="name"
                  placeholder="Masukkan nama lengkap"
                  value={name}
                  onChange={handleNameChange}
                  className={`pl-10 h-12 ${errors.name ? "border-destructive" : ""}`}
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
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={email}
                  onChange={handleEmailChange}
                  className={`pl-10 h-12 ${errors.email ? "border-destructive" : ""}`}
                  disabled={isSubmitting}
                  autoComplete="email"
                />
              </div>
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email}</p>
              )}
            </div>

            <Button type="submit" variant="outline" className="w-full h-12" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4 mr-2" />
              )}
              Masuk Cepat
            </Button>
          </form>

          {/* Terms */}
          <p className="text-xs text-center text-muted-foreground">
            Dengan melanjutkan, Anda menyetujui ketentuan penggunaan sistem.
          </p>

          {isRecaptchaConfigured && <ReCaptchaDisclosure />}
        </CardContent>
      </Card>

      {/* Guest Auth Dialog - Unified */}
      <GuestAuthDialog
        isOpen={showGuestAuthDialog}
        onClose={() => setShowGuestAuthDialog(false)}
        onSuccess={handleGuestAuthSuccess}
        subjectName={subjectInfo?.name}
        className={classInfo?.name}
        shareToken={token || undefined}
      />
    </div>
  );
}

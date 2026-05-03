import { useState, useRef, useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useNavigate, Link } from "react-router-dom";
import { ImageEditor } from "@/components/profile/ImageEditor";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { AccountSecuritySection } from "@/components/settings/AccountSecuritySection";
import {
  User,
  Camera,
  Upload,
  AlertCircle,
  CheckCircle,
  Loader2,
  Trash2,
  Edit2,
  Mail,
  Shield,
  Calendar,
  Settings,
  ChevronRight,
} from "lucide-react";

export default function Profile() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { createActivityLog } = useActivityLogs();
  
  // Section refs for scroll navigation
  const profileSectionRef = useRef<HTMLDivElement>(null);
  const securitySectionRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState(user?.user_metadata?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isSavingName, setIsSavingName] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);

  // Handle hash navigation for section scrolling
  // Uses location.key to detect re-navigation to same hash
  useEffect(() => {
    const hash = location.hash;
    if (hash) {
      const timer = setTimeout(() => {
        const id = hash.replace("#", "");
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      return () => clearTimeout(timer);
    } else {
      // No hash - scroll to profile section (top)
      profileSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, location.key]);

  // Load avatar on mount - Priority: Supabase storage > Google avatar
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.id) return;

      try {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(`${user.id}/avatar`);

        const response = await fetch(data.publicUrl, { method: "HEAD" });
        if (response.ok) {
          setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
          return;
        }
      } catch (error) {
        console.log("No storage avatar found");
      }
      
      // Fallback to Google avatar
      if (user?.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
      }
    };

    loadAvatar();
  }, [user?.id]);

  const showAutoSaveFeedback = useCallback(() => {
    setSaveStatus("saved");
    setTimeout(() => setSaveStatus("idle"), 2000);
  }, []);

  // Auto-save name with debounce
  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newName = e.target.value;
      setName(newName);
      setSaveStatus("saving");

      if (nameDebounceRef.current) {
        clearTimeout(nameDebounceRef.current);
      }

      nameDebounceRef.current = setTimeout(async () => {
        if (!user) return;

        setIsSavingName(true);
        try {
          const { error } = await supabase.auth.updateUser({
            data: { full_name: newName },
          });

          if (error) throw error;
          showAutoSaveFeedback();
          
          // Log activity
          createActivityLog.mutate({
            user_id: user.id,
            actor_type: "owner",
            action: "mengubah nama profil",
            entity_type: "profile",
            entity_name: newName,
          });
        } catch (error: unknown) {
          console.error("Error saving name:", error);
          const errorMessage = error instanceof Error ? error.message : "Terjadi kesalahan";
          showError("Gagal menyimpan", errorMessage);
          setSaveStatus("idle");
        } finally {
          setIsSavingName(false);
        }
      }, 800);
    },
    [user, showError, showAutoSaveFeedback, createActivityLog]
  );

  const handleDeleteAvatar = async () => {
    if (!user?.id) return;
    setIsDeletingAvatar(true);

    try {
      // Delete from storage
      await supabase.storage.from("avatars").remove([`${user.id}/avatar`]);

      // Update user metadata
      await supabase.auth.updateUser({ data: { avatar_url: null } });

      setAvatarUrl(null);
      success("Foto Dihapus", "Foto profil berhasil dihapus");
      
      // Log activity
      createActivityLog.mutate({
        user_id: user.id,
        actor_type: "owner",
        action: "menghapus foto profil",
        entity_type: "profile",
      });
    } catch (err) {
      showError("Gagal", "Gagal menghapus foto profil");
    } finally {
      setIsDeletingAvatar(false);
    }
  };

  const getInitials = () => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return "U";
  };

  // Format account creation date
  const createdAt = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "-";

  return (
    <>
      <div className="app-page app-page-narrow">
        {/* Header with Breadcrumb */}
        <div className="animate-fade-in flex items-center justify-between">
          <div>
            <nav className="flex items-center gap-2 mb-1 text-xs">
              <Link 
                to="/settings"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                Pengaturan
              </Link>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
              <span className="text-foreground font-medium">Profil</span>
            </nav>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground">
              Profil Saya
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm mt-0.5">
              Kelola informasi profil dan keamanan akun
            </p>
          </div>

          {/* Auto-save status indicator */}
          <div className="flex items-center gap-2 text-sm">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-2 text-muted-foreground animate-pulse">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-2 text-grade-pass animate-fade-in">
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Tersimpan</span>
              </span>
            )}
          </div>
        </div>

        {/* Profile Card */}
        <div ref={profileSectionRef} id="profile-info">
          <Card className="animate-fade-in-up overflow-hidden">
            {/* Gradient Header */}
            <div className="h-20 sm:h-24 bg-gradient-to-br from-primary via-primary/80 to-accent" />

            <CardContent className="relative px-4 sm:px-6 pb-6">
              {/* Avatar - overlapping header */}
              <div className="relative -mt-12 sm:-mt-14 mb-4">
                <div className="relative group inline-block">
                  <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-background shadow-xl">
                    <AvatarImage src={avatarUrl || undefined} alt={name} />
                    <AvatarFallback className="text-xl sm:text-2xl font-semibold bg-gradient-to-br from-primary to-accent text-white">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    aria-label="Ubah foto profil"
                  >
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </button>
                </div>
              </div>

              {/* User Name & Email */}
              <div className="mb-6">
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {name || "Pengguna SIPENA"}
                </h2>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Shield className="w-3 h-3" />
                    Guru
                  </Badge>
                  <Badge variant="outline" className="gap-1 text-xs">
                    <Calendar className="w-3 h-3" />
                    Bergabung {createdAt}
                  </Badge>
                </div>
              </div>

              <Separator className="mb-6" />

              {/* Photo Actions */}
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium">Foto Profil</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    JPG/PNG, maksimal 5MB
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Ubah Foto
                    </Button>
                    {avatarUrl && (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (avatarUrl) {
                              setPreviewUrl(avatarUrl);
                              setShowImageEditor(true);
                            }
                          }}
                          className="gap-1.5"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                          Edit Foto
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleDeleteAvatar}
                          disabled={isDeletingAvatar}
                          className="gap-1.5 text-destructive hover:text-destructive"
                        >
                          {isDeletingAvatar ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Hapus
                        </Button>
                      </>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={(e) => {
                      setUploadError(null);
                      const file = e.target.files?.[0];

                      if (!file) return;

                      if (
                        !file.type.startsWith("image/jpeg") &&
                        !file.type.startsWith("image/png")
                      ) {
                        setUploadError("Format file harus JPG atau PNG");
                        return;
                      }

                      if (file.size > 5 * 1024 * 1024) {
                        setUploadError("Ukuran file maksimal 5MB");
                        return;
                      }

                      setSelectedFile(file);
                      setPreviewUrl(URL.createObjectURL(file));
                      setShowImageEditor(true);

                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                  {uploadError && (
                    <p className="text-xs text-destructive flex items-center gap-1 mt-2">
                      <AlertCircle className="w-3 h-3" />
                      {uploadError}
                    </p>
                  )}
                </div>

                <Separator />

                {/* Name Input */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2 text-sm">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Nama Lengkap
                    {isSavingName && (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    )}
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={handleNameChange}
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                {/* Email Display */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Email
                  </Label>
                  <Input value={user?.email || ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Email tidak dapat diubah
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Account Security Section - Now inside Profile with ref */}
        <div ref={securitySectionRef} id="security-section">
          <AccountSecuritySection />
        </div>

        {/* Back to Settings Link */}
        <Card className="animate-fade-in-up delay-100">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </div>
              <div>
                <h3 className="font-medium text-sm">Pengaturan Lainnya</h3>
                <p className="text-xs text-muted-foreground">
                  Tema, notifikasi, dan lainnya
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
              Kembali
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Image Editor Modal */}
      <ImageEditor
        imageSrc={previewUrl || ""}
        isOpen={showImageEditor && !!previewUrl}
        onClose={() => {
          setShowImageEditor(false);
          setSelectedFile(null);
          setPreviewUrl(null);
        }}
        onSave={async (croppedBlob) => {
          if (!user?.id) return;

          try {
            const filePath = `${user.id}/avatar`;

            const { error: uploadError } = await supabase.storage
              .from("avatars")
              .upload(filePath, croppedBlob, {
                upsert: true,
                contentType: "image/jpeg",
              });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage
              .from("avatars")
              .getPublicUrl(filePath);

            const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;
            setAvatarUrl(newAvatarUrl);

            await supabase.auth.updateUser({
              data: { avatar_url: newAvatarUrl },
            });

            success("Foto Profil Diperbarui", "Foto profil berhasil diubah");
            
            // Log activity
            createActivityLog.mutate({
              user_id: user.id,
              actor_type: "owner",
              action: "mengubah foto profil",
              entity_type: "profile",
            });
            
            setShowImageEditor(false);
            setSelectedFile(null);
            setPreviewUrl(null);
          } catch (error: unknown) {
            console.error("Upload error:", error);
            const errorMessage = error instanceof Error ? error.message : "Gagal mengupload foto";
            showError("Gagal Upload", errorMessage);
          }
        }}
      />
    </>
  );
}

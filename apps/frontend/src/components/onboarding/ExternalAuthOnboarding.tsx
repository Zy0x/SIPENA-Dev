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
import { User, Loader2 } from "lucide-react";
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

  useEffect(() => {
    if (!user) return;

    // Check if user signed up via external provider and has no full_name set
    const provider = user.app_metadata?.provider;
    const hasFullName = user.user_metadata?.full_name;

    // If external auth user without a manually set full_name
    if (provider && provider !== "email" && !hasFullName) {
      // Pre-fill with Google name if available
      const googleName = user.user_metadata?.name || user.user_metadata?.full_name || "";
      setFullName(googleName);
      setOpen(true);
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
    } catch (err: any) {
      showError("Gagal Menyimpan", err.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
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
  );
}

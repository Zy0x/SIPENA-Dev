import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";

export interface SharedLink {
  id: string;
  user_id: string;
  subject_id: string;
  class_id: string;
  token: string;
  guest_user_id: string | null;
  created_at: string;
  expired_at: string;
  revoked: boolean;
  last_used_at: string | null;
}

export interface GuestUser {
  id: string;
  name: string;
  email: string;
  created_at: string;
}

export interface CreateSharedLinkInput {
  subject_id: string;
  class_id: string;
}

// Generate secure token
function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function useSharedLinks() {
  const { user } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const queryClient = useQueryClient();

  // Fetch all shared links for current user
  const sharedLinksQuery = useQuery({
    queryKey: ["shared_links", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from("shared_links")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SharedLink[];
    },
    enabled: !!user,
  });

  // Create a new shared link
  const createSharedLink = useMutation({
    mutationFn: async (input: CreateSharedLinkInput) => {
      if (!user) throw new Error("Pengguna tidak terautentikasi");

      const token = generateSecureToken();
      const expiredAt = new Date();
      expiredAt.setFullYear(expiredAt.getFullYear() + 1); // 1 year expiry

      const { data, error } = await supabase
        .from("shared_links")
        .insert({
          user_id: user.id,
          subject_id: input.subject_id,
          class_id: input.class_id,
          token,
          expired_at: expiredAt.toISOString(),
        })
        .select()
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new Error("Link untuk mapel dan kelas ini sudah ada");
        }
        throw error;
      }
      return data as SharedLink;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_links"] });
      success("Link Berhasil Dibuat", "Link akses guru tamu telah dibuat");
    },
    onError: (error: Error) => {
      showError("Gagal Membuat Link", error.message);
    },
  });

  // Revoke a shared link
  const revokeSharedLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("shared_links")
        .update({ revoked: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_links"] });
      success("Akses Dicabut", "Link akses telah dinonaktifkan");
    },
    onError: (error: Error) => {
      showError("Gagal Mencabut Akses", error.message);
    },
  });

  // Reactivate a shared link
  const reactivateSharedLink = useMutation({
    mutationFn: async (id: string) => {
      const expiredAt = new Date();
      expiredAt.setFullYear(expiredAt.getFullYear() + 1);

      const { error } = await supabase
        .from("shared_links")
        .update({ revoked: false, expired_at: expiredAt.toISOString() })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_links"] });
      success("Link Diaktifkan", "Akses guru tamu telah diaktifkan");
    },
    onError: (error: Error) => {
      showError("Gagal Mengaktifkan", error.message);
    },
  });

  // Delete a shared link
  const deleteSharedLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shared_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared_links"] });
      success("Link Dihapus", "Link akses telah dihapus");
    },
    onError: (error: Error) => {
      showError("Gagal Menghapus", error.message);
    },
  });

  // Get shared link for a specific subject and class
  const getSharedLinkForSubject = (subjectId: string, classId: string) => {
    return sharedLinksQuery.data?.find(
      (link) => link.subject_id === subjectId && link.class_id === classId
    );
  };

  return {
    sharedLinks: sharedLinksQuery.data || [],
    isLoading: sharedLinksQuery.isLoading,
    createSharedLink,
    revokeSharedLink,
    reactivateSharedLink,
    deleteSharedLink,
    getSharedLinkForSubject,
  };
}

// Hook for validating token (used by guest pages)
export function useValidateToken(token: string | null) {
  return useQuery({
    queryKey: ["validate_token", token],
    queryFn: async () => {
      if (!token) return null;

      const { data, error } = await supabase.rpc("validate_share_token", {
        p_token: token,
      });

      if (error) throw error;
      if (!data || data.length === 0) {
        return { is_valid: false, error_message: "Token tidak ditemukan" };
      }
      return data[0];
    },
    enabled: !!token,
  });
}

// Hook for guest user registration
export function useGuestRegistration() {
  const { error: showError } = useEnhancedToast();

  const registerGuest = useMutation({
    mutationFn: async (input: { name: string; email: string }) => {
      // Check if guest already exists
      const { data: existing } = await supabase
        .from("guest_users")
        .select("id")
        .eq("email", input.email)
        .maybeSingle();

      if (existing) {
        return existing;
      }

      const { data, error } = await supabase
        .from("guest_users")
        .insert({
          name: input.name,
          email: input.email,
        })
        .select()
        .single();

      if (error) throw error;
      return data as GuestUser;
    },
    onError: (error: Error) => {
      showError("Gagal Registrasi", error.message);
    },
  });

  return { registerGuest };
}

// Hook for guest audit logging
export function useGuestAuditLog() {
  const logAction = useMutation({
    mutationFn: async (input: {
      shared_link_id: string;
      guest_user_id?: string;
      action: string;
      details?: Record<string, unknown>;
    }) => {
      const { error } = await supabase.from("guest_audit_logs").insert({
        shared_link_id: input.shared_link_id,
        guest_user_id: input.guest_user_id || null,
        action: input.action,
        details: input.details ? JSON.parse(JSON.stringify(input.details)) : null,
      });

      if (error) console.error("Audit log error:", error);
    },
  });

  return { logAction };
}
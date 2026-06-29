import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { EDGE_FUNCTIONS_URL, SUPABASE_EXTERNAL_ANON_KEY } from "@/core/repositories/supabase-compat.repository";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, isReady, isLoading: flagsLoading } = useFeatureFlags();
  const { toast } = useToast();

  const [hasValidToken, setHasValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    const verifyToken = async () => {
      const token = localStorage.getItem("admin_session_token");
      if (!token) {
        setHasValidToken(false);
        return;
      }

      try {
        const parts = token.split(".");
        if (parts.length !== 2) {
          localStorage.removeItem("admin_session_token");
          setHasValidToken(false);
          return;
        }

        // Decode locally first as a quick expiration check
        const decoded = JSON.parse(atob(parts[0]));
        if (!decoded.authenticated || decoded.expires <= Date.now()) {
          localStorage.removeItem("admin_session_token");
          setHasValidToken(false);
          return;
        }

        // Verify signature and validity with the backend
        const response = await fetch(`${EDGE_FUNCTIONS_URL}/admin-auth`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_EXTERNAL_ANON_KEY}`,
          },
          body: JSON.stringify({ action: "verify", token }),
        });
        
        const result = await response.json();
        if (result.success && result.valid) {
          setHasValidToken(true);
        } else {
          localStorage.removeItem("admin_session_token");
          setHasValidToken(false);
        }
      } catch (error) {
        // If there's a connection/API error, fallback to local validation to prevent lockouts when offline
        try {
          const parts = token.split(".");
          const decoded = JSON.parse(atob(parts[0]));
          if (decoded.authenticated && decoded.expires > Date.now()) {
            setHasValidToken(true);
            return;
          }
        } catch {}
        setHasValidToken(false);
      }
    };

    verifyToken();
  }, []);

  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (isReady && !authLoading && user && !isAdmin && hasValidToken === false) {
      toast({
        variant: "destructive",
        title: "Akses Ditolak",
        description: "Anda tidak memiliki wewenang untuk mengakses halaman Admin.",
      });
    }
  }, [isReady, authLoading, user, isAdmin, hasValidToken, toast]);

  if (authLoading || !isReady || flagsLoading || hasValidToken === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Memverifikasi kredensial admin...</p>
        </div>
      </div>
    );
  }

  // Bypass other checks if the admin session token is valid
  if (hasValidToken) {
    return <>{children}</>;
  }

  // If no valid session token exists, the user must be logged in to Supabase
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // If logged in, they must have the admin role in the database
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default AdminRouteGuard;

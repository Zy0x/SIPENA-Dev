import React, { useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface AdminRouteGuardProps {
  children: React.ReactNode;
}

export function AdminRouteGuard({ children }: AdminRouteGuardProps) {
  const { user, loading: authLoading } = useAuth();
  const { roles, isReady, isLoading: flagsLoading } = useFeatureFlags();
  const { toast } = useToast();

  const isAdmin = roles.includes("admin");

  useEffect(() => {
    if (isReady && !authLoading && user && !isAdmin) {
      toast({
        variant: "destructive",
        title: "Akses Ditolak",
        description: "Anda tidak memiliki wewenang untuk mengakses halaman Admin.",
      });
    }
  }, [isReady, authLoading, user, isAdmin, toast]);

  if (authLoading || !isReady || flagsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground text-sm font-medium">Memverifikasi kredensial admin...</p>
        </div>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default AdminRouteGuard;

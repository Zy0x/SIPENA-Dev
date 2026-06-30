import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFeatureFlags } from "@/app/providers/useFeatureFlags";

interface FeatureGateProps {
  featureKey: string;
  children: ReactNode;
  fallback?: ReactNode;
}

export function FeatureGate({ featureKey, children, fallback = null }: FeatureGateProps) {
  const { getAccessStatus } = useFeatureFlags();
  return getAccessStatus(featureKey) === "allowed" ? <>{children}</> : <>{fallback}</>;
}

interface FeatureRouteGuardProps {
  featureKey: string;
  children: ReactNode;
  label?: string;
}

export function FeatureRouteGuard({ featureKey, children, label }: FeatureRouteGuardProps) {
  const { getAccessStatus, getFeature, refresh } = useFeatureFlags();
  
  // Bypass page.attendance-v2 route guard to allow testing and previewing V2 page directly
  if (featureKey === "page.attendance-v2") {
    return <>{children}</>;
  }

  const accessStatus = getAccessStatus(featureKey);

  if (accessStatus === "loading") {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-8 text-muted-foreground">
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Memeriksa akses fitur...
        </div>
      </div>
    );
  }

  if (accessStatus === "allowed") {
    return <>{children}</>;
  }

  const feature = getFeature(featureKey);
  const featureLabel = label || feature.name || "Fitur";

  if (accessStatus === "error") {
    return (
      <div className="min-h-[60vh] px-4 py-8 sm:px-6 lg:px-8">
        <Card className="mx-auto max-w-xl border-dashed">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
              <Lock className="h-8 w-8" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold text-foreground">
                Akses fitur belum bisa diperiksa
              </h1>
              <p className="text-sm text-muted-foreground">
                {featureLabel} belum ditampilkan sampai kontrol fitur dari admin berhasil dimuat.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button onClick={() => void refresh()}>Coba Lagi</Button>
              <Button asChild variant="outline">
                <Link to="/dashboard">Kembali ke Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] px-4 py-8 sm:px-6 lg:px-8">
      <Card className="mx-auto max-w-xl border-dashed">
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <div className="rounded-2xl bg-muted p-4 text-muted-foreground">
            <Lock className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">
              Fitur belum tersedia untuk akun ini
            </h1>
            <p className="text-sm text-muted-foreground">
              {featureLabel} sedang dibatasi oleh admin. Hubungi admin jika akun ini perlu akses.
            </p>
          </div>
          <Button asChild>
            <Link to="/dashboard">Kembali ke Dashboard</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

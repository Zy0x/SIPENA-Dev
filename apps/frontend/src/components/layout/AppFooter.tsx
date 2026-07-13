import { useEffect, useState } from "react";
import { Heart, HelpCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { APP_VERSION } from "@/config/version";

export default function AppFooter() {
  const [online, setOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  return (
    <footer className="flex min-h-10 items-center justify-between gap-3 border-t border-border/70 bg-background/90 px-4 py-2 text-xs text-muted-foreground">
      <div className="flex min-w-0 items-center gap-2">
        <span>&copy; {new Date().getFullYear()} <strong className="text-foreground">SIPENA</strong></span>
        <span
          className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-emerald-500" : "bg-amber-500"}`}
          aria-label={online ? "Terhubung" : "Offline"}
          title={online ? "Terhubung" : "Offline"}
        />
        <span className="truncate">v{APP_VERSION}</span>
      </div>
      <div className="flex items-center gap-1">
        <Link className="sipena-icon-button-touch-safe" to="/help" aria-label="Buka panduan">
          <HelpCircle className="h-4 w-4" />
        </Link>
        <span className="sipena-icon-button-touch-safe" aria-label="Dibuat untuk guru Indonesia" title="Dibuat untuk guru Indonesia">
          <Heart className="h-4 w-4 text-rose-500" />
        </span>
      </div>
    </footer>
  );
}

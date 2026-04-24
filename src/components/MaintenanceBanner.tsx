import { useState, useEffect, useRef, useCallback } from "react";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info, Wrench, XCircle, X } from "lucide-react";
import gsap from "gsap";

interface MaintenanceAlert {
  id: string;
  title: string;
  message: string;
  alert_type: "info" | "warning" | "critical" | "maintenance";
  is_active: boolean;
  is_marquee: boolean;
  display_mode: "flyout" | "flat";
  bg_color: string;
  text_color: string;
  icon: string;
  start_time: string | null;
  end_time: string | null;
}

const alertIcons: Record<string, React.ReactNode> = {
  info: <Info className="w-4 h-4 shrink-0" />,
  warning: <AlertTriangle className="w-4 h-4 shrink-0" />,
  critical: <XCircle className="w-4 h-4 shrink-0" />,
  maintenance: <Wrench className="w-4 h-4 shrink-0" />,
};

export function MaintenanceBanner() {
  const [alert, setAlert] = useState<MaintenanceAlert | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const breathingTlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const fetchAlert = async () => {
      const { data, error } = await (supabase as any)
        .from("maintenance_alerts")
        .select("*")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data && !error) {
        const now = new Date();
        if (data.start_time && new Date(data.start_time) > now) return;
        if (data.end_time && new Date(data.end_time) < now) return;
        setAlert({
          ...data,
          display_mode: data.display_mode || "flat",
        } as MaintenanceAlert);
      } else {
        setAlert(null);
      }
    };

    fetchAlert();

    const channel = supabase
      .channel("maintenance_alerts_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "maintenance_alerts" },
        () => { fetchAlert(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  // GSAP entrance + breathing animation
  useEffect(() => {
    if (!bannerRef.current || !alert || dismissed === alert.id) return;

    // Entrance animation
    gsap.fromTo(bannerRef.current,
      { opacity: 0, y: alert.display_mode === "flyout" ? -20 : -10 },
      { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }
    );

    // Breathing animation for flyout mode
    if (alert.display_mode === "flyout" && contentRef.current) {
      if (breathingTlRef.current) breathingTlRef.current.kill();
      
      const tl = gsap.timeline({ repeat: -1, yoyo: true });
      tl.to(contentRef.current, {
        opacity: 0.85,
        duration: 2.5,
        ease: "sine.inOut",
      });
      breathingTlRef.current = tl;
    }

    return () => {
      if (breathingTlRef.current) {
        breathingTlRef.current.kill();
        breathingTlRef.current = null;
      }
    };
  }, [alert, dismissed]);

  // Dismiss with GSAP
  const handleDismiss = useCallback(() => {
    if (!alert || !bannerRef.current) return;
    gsap.to(bannerRef.current, {
      opacity: 0,
      y: -20,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => setDismissed(alert.id),
    });
  }, [alert]);

  if (!alert || dismissed === alert.id) return null;

  const bgStyle = {
    backgroundColor: alert.bg_color || "hsl(var(--primary))",
    color: alert.text_color || "hsl(var(--primary-foreground))",
  };

  const isFlyout = alert.display_mode === "flyout";

  return (
    <div
      ref={bannerRef}
      className={cn(
        "z-[60]",
        isFlyout
          ? "fixed top-0 left-0 right-0 pointer-events-none"
          : "relative"
      )}
      style={{ opacity: 0 }}
    >
      <div
        ref={contentRef}
        className={cn(
          "overflow-hidden text-sm font-medium",
          isFlyout && "pointer-events-auto shadow-lg"
        )}
        style={bgStyle}
      >
        <div className="flex items-center gap-2 px-4 py-2">
          {alertIcons[alert.alert_type] || alertIcons.info}

          {alert.title && (
            <span className="font-bold shrink-0">{alert.title}:</span>
          )}

          <div className="flex-1 overflow-hidden min-w-0">
            {alert.is_marquee ? (
              <div className="whitespace-nowrap animate-marquee">
                <span className="inline-block pr-16">{alert.message}</span>
                <span className="inline-block pr-16">{alert.message}</span>
              </div>
            ) : (
              <span className="truncate block">{alert.message}</span>
            )}
          </div>

          {alert.alert_type !== "critical" && (
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 rounded-full hover:bg-white/20 transition-colors pointer-events-auto"
              aria-label="Tutup notifikasi"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

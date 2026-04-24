import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, Heart } from "lucide-react";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import { cn } from "@/lib/utils";
import { APP_VERSION } from "@/config/version";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import gsap from "gsap";

type ConnectionStatus = "connected" | "connecting" | "disconnected";

// ============================================
// Connection Indicator Component with GSAP
// ============================================
function ConnectionIndicator() {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [latency, setLatency] = useState<number | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const [isCheckingLatency, setIsCheckingLatency] = useState(false);
  const [hasShownOfflineToast, setHasShownOfflineToast] = useState(false);
  
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0.01 : 0.25;
  
  // DOM Refs
  const containerRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLDivElement>(null);
  const pulseRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Animation refs
  const pulseAnimRef = useRef<gsap.core.Tween | null>(null);
  const connectingAnimRef = useRef<gsap.core.Timeline | null>(null);
  const tooltipTlRef = useRef<gsap.core.Timeline | null>(null);

  const { warning, success } = useEnhancedToast();

  // Show toast callbacks - with duplicate prevention
  const showOfflineToast = useCallback(() => {
    if (!hasShownOfflineToast) {
      warning("Tidak Ada Koneksi", "Data tidak dapat disinkronkan. Periksa koneksi internet Anda.");
      setHasShownOfflineToast(true);
    }
  }, [warning, hasShownOfflineToast]);

  const showReconnectedToast = useCallback(() => {
    if (hasShownOfflineToast) {
      success("Terhubung Kembali", "Koneksi telah pulih. Data Anda akan disinkronkan.");
      setHasShownOfflineToast(false);
    }
  }, [success, hasShownOfflineToast]);

  // Check connection status
  useEffect(() => {
    let isMounted = true;

    const checkConnection = async () => {
      if (!isMounted) return;

      if (!navigator.onLine) {
        setLatency(null);
        setWasOffline(true);
        setStatus((prev) => {
          if (prev !== "disconnected") showOfflineToast();
          return "disconnected";
        });
        return;
      }

      try {
        const startTime = performance.now();
        const { error } = await supabase.from("team_profiles").select("id").limit(1);
        const endTime = performance.now();

        if (!isMounted) return;

        if (error) {
          setLatency(null);
          setWasOffline(true);
          setStatus((prev) => {
            if (prev !== "disconnected") showOfflineToast();
            return "disconnected";
          });
        } else {
          const previousStatus = status;
          setStatus("connected");
          setLatency(Math.round(endTime - startTime));
          
          // Show reconnected toast only if was offline before
          if (wasOffline && previousStatus === "disconnected") {
            showReconnectedToast();
          }
          setWasOffline(false);
        }
      } catch {
        if (!isMounted) return;
        setLatency(null);
        setWasOffline(true);
        setStatus((prev) => {
          if (prev !== "disconnected") showOfflineToast();
          return "disconnected";
        });
      }
    };

    checkConnection();
    const interval = window.setInterval(checkConnection, 30000);

    const handleOnline = () => {
      setStatus("connecting");
      checkConnection();
    };
    const handleOffline = () => {
      setLatency(null);
      setWasOffline(true);
      setStatus((prev) => {
        if (prev !== "disconnected") showOfflineToast();
        return "disconnected";
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [showOfflineToast, showReconnectedToast, wasOffline, status]);

  // GSAP: Pulse animation for connected status
  useEffect(() => {
    if (pulseAnimRef.current) {
      pulseAnimRef.current.kill();
      pulseAnimRef.current = null;
    }

    if (status === "connected" && pulseRef.current && !prefersReducedMotion) {
      gsap.set(pulseRef.current, { scale: 1, opacity: 0.5 });
      pulseAnimRef.current = gsap.to(pulseRef.current, {
        scale: 2.5,
        opacity: 0,
        duration: 2,
        repeat: -1,
        ease: "power2.out"
      });
    }

    return () => {
      if (pulseAnimRef.current) {
        pulseAnimRef.current.kill();
      }
    };
  }, [status, prefersReducedMotion]);

  // GSAP: Connecting animation
  useEffect(() => {
    if (connectingAnimRef.current) {
      connectingAnimRef.current.kill();
      connectingAnimRef.current = null;
    }

    if (status === "connecting" && dotRef.current && !prefersReducedMotion) {
      const tl = gsap.timeline({ repeat: -1 });
      tl.to(dotRef.current, {
        scale: 1.4,
        opacity: 0.5,
        duration: 0.5,
        ease: "power2.inOut"
      }).to(dotRef.current, {
        scale: 1,
        opacity: 1,
        duration: 0.5,
        ease: "power2.inOut"
      });
      connectingAnimRef.current = tl;
    } else if (dotRef.current) {
      gsap.set(dotRef.current, { scale: 1, opacity: 1 });
    }

    return () => {
      if (connectingAnimRef.current) {
        connectingAnimRef.current.kill();
      }
    };
  }, [status, prefersReducedMotion]);

  // GSAP: Tooltip timeline init
  useEffect(() => {
    const el = tooltipRef.current;
    if (!el) return;

    gsap.set(el, { display: "none", opacity: 0, y: 6, scale: 0.92 });

    const tl = gsap
      .timeline({ paused: true })
      .set(el, { display: "block" }, 0)
      .to(
        el,
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration,
          ease: "back.out(1.7)",
          overwrite: "auto",
        },
        0
      );

    tl.eventCallback("onReverseComplete", () => {
      if (tooltipRef.current) gsap.set(tooltipRef.current, { display: "none" });
    });

    tooltipTlRef.current = tl;
    return () => {
      tl.kill();
      tooltipTlRef.current = null;
    };
  }, [duration]);

  // GSAP: Tooltip show/hide + latency refresh
  useEffect(() => {
    const tl = tooltipTlRef.current;
    if (!tl) return;

    if (isHovered) {
      // Check latency on hover
      if (status === "connected") {
        const checkLatency = async () => {
          setIsCheckingLatency(true);
          try {
            const startTime = performance.now();
            await supabase.from("team_profiles").select("id").limit(1);
            const endTime = performance.now();
            setLatency(Math.round(endTime - startTime));
          } catch {
            // Ignore errors
          } finally {
            setIsCheckingLatency(false);
          }
        };
        checkLatency();
      }

      tl.play();
    } else {
      tl.reverse();
    }
  }, [isHovered, status]);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isHovered) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsHovered(false);
      }
    };

    // Delay to prevent immediate closing on click
    const timeoutId = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isHovered]);

  // Status config using semantic tokens
  const statusConfig = {
    connected: {
      colorClass: "bg-status-online",
      label: "Terhubung",
      textColorClass: "text-status-online",
    },
    connecting: {
      colorClass: "bg-status-connecting",
      label: "Menghubungkan...",
      textColorClass: "text-status-connecting",
    },
    disconnected: {
      colorClass: "bg-status-offline",
      label: "Tidak terhubung",
      textColorClass: "text-destructive",
    },
  };

  const config = statusConfig[status];

  // Latency quality using semantic tokens
  const getLatencyQuality = (ms: number) => {
    if (ms < 100) return { label: "Sangat Cepat", colorClass: "text-status-fast" };
    if (ms < 300) return { label: "Cepat", colorClass: "text-status-fast" };
    if (ms < 500) return { label: "Normal", colorClass: "text-status-normal" };
    return { label: "Lambat", colorClass: "text-status-slow" };
  };

  const latencyQuality = latency ? getLatencyQuality(latency) : null;

  return (
    <div 
      ref={containerRef}
      className="relative inline-flex items-center"
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => setIsHovered(false)}
      onClick={(e) => {
        // Click to toggle tooltip (works for both mouse and touch)
        e.stopPropagation();
        setIsHovered((v) => !v);
      }}
    >
      {/* Dot with pulse */}
      <div className="relative cursor-pointer p-1 rounded-lg hover:bg-muted/50 transition-colors">
        {/* Pulse ring - connected only */}
        {status === "connected" && (
          <div
            ref={pulseRef}
            className={cn("absolute inset-1 rounded-full pointer-events-none", config.colorClass)}
          />
        )}
        
        {/* Main dot */}
        <div
          ref={dotRef}
          className={cn("relative w-2 h-2 rounded-full", config.colorClass)}
        />
      </div>

      {/* Tooltip - positioned above */}
      <div
        ref={tooltipRef}
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-[100] pointer-events-none"
        style={{ display: "none" }}
      >
        <div className="relative bg-popover border border-border rounded-lg shadow-xl px-3 py-2 min-w-[120px]">
          {/* Arrow */}
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-popover border-r border-b border-border" />
          
          {/* Content */}
          <div className="relative space-y-1.5">
            {/* Status */}
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full shrink-0", config.colorClass)} />
              <span className={cn("text-xs font-medium", config.textColorClass)}>
                {config.label}
              </span>
            </div>
            
            {/* Latency - connected only */}
            {status === "connected" && (
              <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-border/50">
                <span className="text-[10px] text-muted-foreground">Latensi</span>
                {isCheckingLatency ? (
                  <div className="w-3 h-3 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" />
                ) : latency !== null ? (
                  <span className={cn("text-xs font-bold tabular-nums", latencyQuality?.colorClass)}>
                    {latency}ms
                  </span>
                ) : (
                  <span className="text-[10px] text-muted-foreground">--</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Main Footer Component with GSAP
// ============================================
const Footer = forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
  (props, ref) => {
    const currentYear = new Date().getFullYear();
    const footerRef = useRef<HTMLElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const leftRef = useRef<HTMLParagraphElement>(null);
    const rightRef = useRef<HTMLDivElement>(null);
    const sipenaBrandRef = useRef<HTMLSpanElement>(null);
    const helpRef = useRef<HTMLDivElement>(null);
    const heartRef = useRef<HTMLDivElement>(null);
    const heartAnimRef = useRef<gsap.core.Timeline | null>(null);
    
    const prefersReducedMotion = useReducedMotion();
    const duration = prefersReducedMotion ? 0.01 : 0.2;

    // GSAP: Heart pulse animation
    useEffect(() => {
      if (heartRef.current && !prefersReducedMotion) {
        const tl = gsap.timeline({ repeat: -1 });
        tl.to(heartRef.current, {
          scale: 1.15,
          duration: 0.6,
          ease: "power1.inOut"
        }).to(heartRef.current, {
          scale: 1,
          duration: 0.6,
          ease: "power1.inOut"
        });
        heartAnimRef.current = tl;
      }

      return () => {
        if (heartAnimRef.current) {
          heartAnimRef.current.kill();
        }
      };
    }, [prefersReducedMotion]);

    // GSAP: SIPENA hover effect
    const handleSipenaHover = useCallback((isEntering: boolean) => {
      if (sipenaBrandRef.current && !prefersReducedMotion) {
        gsap.to(sipenaBrandRef.current, {
          scale: isEntering ? 1.05 : 1,
          duration,
          ease: "power2.out"
        });
      }
    }, [prefersReducedMotion, duration]);

    // GSAP: Help icon hover
    const handleHelpHover = useCallback((isEntering: boolean) => {
      if (helpRef.current && !prefersReducedMotion) {
        gsap.to(helpRef.current, {
          rotation: isEntering ? 15 : 0,
          scale: isEntering ? 1.1 : 1,
          duration: duration * 1.25,
          ease: "back.out(1.7)"
        });
      }
    }, [prefersReducedMotion, duration]);
    
    return (
      <footer 
        ref={(el) => {
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
          (footerRef as React.MutableRefObject<HTMLElement | null>).current = el;
        }}
        className="py-2.5 px-3 sm:px-4 lg:px-6 border-t border-border bg-card/80 backdrop-blur-sm shrink-0"
        {...props}
      >
        <div ref={contentRef} className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left - Copyright & connection */}
            <p 
              ref={leftRef}
              className="text-[11px] text-muted-foreground flex items-center gap-1.5 flex-wrap"
            >
              <span className="flex items-center gap-1.5">
                © {currentYear}{" "}
                <span 
                  ref={sipenaBrandRef}
                  className="font-semibold text-foreground cursor-pointer inline-block hover:text-primary transition-colors"
                  onMouseEnter={() => handleSipenaHover(true)}
                  onMouseLeave={() => handleSipenaHover(false)}
                >
                  SIPENA
                </span>
                <ConnectionIndicator />
              </span>
              <span className="hidden sm:inline text-muted-foreground/70">
                v{APP_VERSION}
              </span>
            </p>
            
            {/* Right - Links */}
            <div 
              ref={rightRef}
              className="flex items-center gap-3 flex-wrap"
            >
              <Link 
                to="/help" 
                className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 group"
              >
                <div
                  ref={helpRef}
                  className="inline-block"
                  onMouseEnter={() => handleHelpHover(true)}
                  onMouseLeave={() => handleHelpHover(false)}
                >
                  <HelpCircle className="w-3 h-3 shrink-0" />
                </div>
                <span className="hidden xs:inline">Panduan</span>
              </Link>
              
              <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1">
                <div ref={heartRef} className="inline-block">
                  <Heart className="w-3 h-3 text-destructive shrink-0" />
                </div>
                <span className="hidden xs:inline">Indonesia</span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    );
  }
);

Footer.displayName = "Footer";

export default Footer;
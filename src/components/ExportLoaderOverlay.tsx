import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  setBackgroundInterval,
  setBackgroundTimeout,
  runBackgroundTween,
} from "@/lib/backgroundTimer";

interface ExportLoaderOverlayProps {
  visible: boolean;
  fileName?: string;
  fileSize?: string;
  onCancel?: () => void;
  onComplete?: () => void;
}

export function ExportLoaderOverlay({
  visible,
  fileName = "export.pdf",
  fileSize = "",
  onCancel,
  onComplete,
}: ExportLoaderOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<SVGCircleElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const phaseRef = useRef<HTMLSpanElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const cancelTweenRef = useRef<(() => void) | null>(null);
  const cancelLogTimerRef = useRef<(() => void) | null>(null);
  const cancelCompletionRef = useRef<(() => void) | null>(null);
  const [completed, setCompleted] = useState(false);
  const aliveRef = useRef(true);

  const circumference = 2 * Math.PI * 70;

  const logs = [
    "Menginisialisasi ekspor...",
    "Memproses data tabel...",
    "Memformat kolom & header...",
    "Mengompresi konten...",
    "Menyusun file akhir...",
    "Menulis ke disk...",
    "Ekspor selesai! ✓",
  ];

  const cleanupTimers = () => {
    cancelTweenRef.current?.();
    cancelLogTimerRef.current?.();
    cancelCompletionRef.current?.();
    cancelTweenRef.current = null;
    cancelLogTimerRef.current = null;
    cancelCompletionRef.current = null;
  };

  // Track component lifecycle
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      cleanupTimers();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      setCompleted(false);
      cleanupTimers();
      return;
    }

    // Reset DOM elements immediately
    if (ringRef.current) ringRef.current.style.strokeDashoffset = String(circumference);
    if (barRef.current) barRef.current.style.width = "0%";
    if (percentRef.current) percentRef.current.textContent = "0";
    if (phaseRef.current) phaseRef.current.textContent = "MEMULAI";
    if (logRef.current) logRef.current.innerHTML = "";
    setCompleted(false);

    // Entry animation — pure CSS transition, no GSAP needed
    if (panelRef.current) {
      const panel = panelRef.current;
      panel.style.transition = "none";
      panel.style.opacity = "0";
      panel.style.transform = "translateY(30px) scale(0.95)";
      // Force reflow then animate in
      void panel.offsetHeight;
      panel.style.transition = "opacity 600ms cubic-bezier(0.16, 1, 0.3, 1), transform 600ms cubic-bezier(0.16, 1, 0.3, 1)";
      panel.style.opacity = "1";
      panel.style.transform = "translateY(0) scale(1)";
    }

    // Start log feed using a background-resilient timer so it keeps ticking
    // when the tab is minimised or backgrounded.
    let logIndex = 0;
    cancelLogTimerRef.current = setBackgroundInterval(() => {
      if (!aliveRef.current) {
        cancelLogTimerRef.current?.();
        cancelLogTimerRef.current = null;
        return;
      }
      if (logIndex < logs.length && logRef.current) {
        const div = document.createElement("div");
        div.className = "text-xs font-mono";
        div.style.opacity = "0";
        div.style.transform = "translateY(4px)";
        div.style.transition = "opacity 300ms ease, transform 300ms ease";
        div.innerHTML = `<span class="text-primary/40 mr-2">›</span>${logs[logIndex]}`;
        logRef.current.appendChild(div);
        while (logRef.current.children.length > 4) logRef.current.removeChild(logRef.current.firstChild!);
        // Trigger animation on next frame
        requestAnimationFrame(() => {
          div.style.opacity = "1";
          div.style.transform = "translateY(0)";
        });
        logIndex++;
      }
    }, 600);

    // Drive the percentage tween via the background-resilient pump so
    // progress UI keeps moving even when the user minimises the window.
    cancelTweenRef.current = runBackgroundTween({
      from: 0,
      to: 100,
      durationMs: 4000,
      ease: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2), // power1.inOut
      onUpdate: (value) => {
        if (!aliveRef.current) return;
        const p = Math.round(value);
        if (percentRef.current) percentRef.current.textContent = String(p);
        if (ringRef.current) {
          ringRef.current.style.strokeDashoffset = String(circumference * (1 - value / 100));
        }
        if (barRef.current) barRef.current.style.width = `${value}%`;

        const phases = ["MEMULAI", "MEMPROSES", "MENYUSUN", "FINALISASI"];
        const idx = Math.min(Math.floor(value / 25), 3);
        if (phaseRef.current) phaseRef.current.textContent = phases[idx];
      },
      onComplete: () => {
        cancelLogTimerRef.current?.();
        cancelLogTimerRef.current = null;
        if (!aliveRef.current) return;
        setCompleted(true);
        cancelCompletionRef.current = setBackgroundTimeout(() => {
          if (aliveRef.current) onComplete?.();
        }, 800);
      },
    });

    return () => {
      cleanupTimers();
    };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!visible) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm"
      style={{ pointerEvents: "all" }}
    >
      <div
        ref={panelRef}
        className="relative w-[min(420px,90vw)] bg-card border border-border rounded-2xl p-6 sm:p-8 shadow-2xl"
        style={{ opacity: 0 }}
      >
        <div className="absolute top-0 left-6 right-6 h-px bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />

        <div className="flex items-start justify-between mb-6">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-primary font-semibold mb-1">↓ Mengekspor File</p>
            <p className="text-sm font-bold text-foreground truncate max-w-[200px]">{fileName}</p>
            {fileSize && <p className="text-[11px] text-muted-foreground mt-0.5">{fileSize}</p>}
          </div>
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-primary/10 border border-primary/20">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] tracking-wider text-primary font-medium">
              {completed ? "SELESAI" : "AKTIF"}
            </span>
          </div>
        </div>

        <div className="flex justify-center mb-6">
          <div className="relative w-28 h-28">
            <svg className="w-28 h-28 -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r="70" fill="none" className="stroke-muted/20" strokeWidth="3" />
              <circle
                ref={ringRef}
                cx="80" cy="80" r="70"
                fill="none"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference}
                style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.4))" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div>
                <span ref={percentRef} className="text-2xl font-bold text-foreground">0</span>
                <span className="text-xs text-primary ml-0.5">%</span>
              </div>
              <span ref={phaseRef} className="text-[9px] tracking-widest text-muted-foreground uppercase mt-1">MEMULAI</span>
            </div>
          </div>
        </div>

        <div className="mb-5">
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px] tracking-wider uppercase text-muted-foreground">Progress</span>
          </div>
          <div className="h-1 bg-muted/30 rounded-full overflow-visible relative">
            <div
              ref={barRef}
              className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary relative"
              style={{ width: "0%", boxShadow: "0 0 8px hsl(var(--primary) / 0.4)" }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.6)]" />
            </div>
          </div>
        </div>

        <div
          ref={logRef}
          className="bg-muted/30 border border-border rounded-lg p-3 h-[72px] overflow-hidden mb-5 space-y-1 text-muted-foreground"
        />

        {!completed && onCancel && (
          <div className="flex justify-end">
            <button
              onClick={() => {
                cleanupTimers();
                onCancel();
              }}
              className="px-4 py-2 text-xs tracking-wider uppercase text-muted-foreground border border-border rounded-lg hover:text-foreground hover:border-foreground/30 transition-colors"
            >
              Batalkan
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// Hook for easy usage — uses key-based remounting for reliable repeated exports
export function useExportLoader() {
  const [loaderKey, setLoaderKey] = useState(0);
  const [state, setState] = useState<{
    visible: boolean;
    fileName: string;
    fileSize: string;
  }>({ visible: false, fileName: "", fileSize: "" });
  const resolveRef = useRef<(() => void) | null>(null);
  const busyRef = useRef(false);

  const showLoader = useCallback((fileName: string, fileSize?: string) => {
    return new Promise<void>((resolve) => {
      // If a previous loader is still active, resolve it immediately and clean up
      if (busyRef.current && resolveRef.current) {
        resolveRef.current();
        resolveRef.current = null;
      }

      busyRef.current = true;
      resolveRef.current = resolve;

      // Force complete reset: hide first, then show with new key
      setState({ visible: false, fileName: "", fileSize: "" });

      // Use rAF + microtask to ensure React has flushed the hide before showing
      requestAnimationFrame(() => {
        setTimeout(() => {
          setLoaderKey(prev => prev + 1);
          setState({ visible: true, fileName, fileSize: fileSize || "" });
        }, 50);
      });
    });
  }, []);

  const handleCancel = useCallback(() => {
    busyRef.current = false;
    resolveRef.current = null;
    setState({ visible: false, fileName: "", fileSize: "" });
  }, []);

  const handleComplete = useCallback(() => {
    const resolve = resolveRef.current;
    busyRef.current = false;
    resolveRef.current = null;
    setState({ visible: false, fileName: "", fileSize: "" });
    // Resolve AFTER state update
    if (resolve) requestAnimationFrame(() => resolve());
  }, []);

  const overlay = (
    <ExportLoaderOverlay
      key={loaderKey}
      visible={state.visible}
      fileName={state.fileName}
      fileSize={state.fileSize}
      onCancel={handleCancel}
      onComplete={handleComplete}
    />
  );

  return { showLoader, overlay };
}

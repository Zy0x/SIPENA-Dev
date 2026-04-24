import { useState, useEffect } from "react";
import { RotateCcw, Smartphone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export function RotationOverlay() {
  const [showOverlay, setShowOverlay] = useState(false);
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    // Check if running as PWA
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsPWA(isStandalone);

    if (!isStandalone) return;

    const checkOrientation = () => {
      // Only show overlay on mobile devices (< 768px width in portrait)
      const isMobileDevice = window.innerWidth < 768 || window.innerHeight < 768;
      const isLandscape = window.innerWidth > window.innerHeight;
      
      // Show overlay when device is rotated to landscape on mobile in PWA mode
      setShowOverlay(isMobileDevice && isLandscape);
    };

    // Check on mount and orientation changes
    checkOrientation();

    window.addEventListener('resize', checkOrientation);
    window.addEventListener('orientationchange', checkOrientation);

    // Also listen to screen orientation API if available
    if (screen.orientation) {
      screen.orientation.addEventListener('change', checkOrientation);
    }

    return () => {
      window.removeEventListener('resize', checkOrientation);
      window.removeEventListener('orientationchange', checkOrientation);
      if (screen.orientation) {
        screen.orientation.removeEventListener('change', checkOrientation);
      }
    };
  }, []);

  // Don't render if not PWA or not showing overlay
  if (!isPWA) return null;

  return (
    <AnimatePresence>
      {showOverlay && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[99999] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-8"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="text-center space-y-6"
          >
            {/* Animated phone rotation icon */}
            <div className="relative mx-auto w-24 h-24">
              <motion.div
                animate={{ rotate: [0, -90, -90, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  times: [0, 0.3, 0.7, 1],
                }}
                className="relative"
              >
                <Smartphone className="w-24 h-24 text-primary" strokeWidth={1.5} />
              </motion.div>
              <motion.div
                className="absolute -right-2 top-1/2 -translate-y-1/2"
                animate={{ opacity: [0, 1, 1, 0] }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  repeatDelay: 1,
                  times: [0, 0.1, 0.9, 1],
                }}
              >
                <RotateCcw className="w-8 h-8 text-accent" />
              </motion.div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-foreground">
                Putar Perangkat Anda
              </h2>
              <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                Untuk pengalaman terbaik, gunakan SIPENA dalam mode portrait (tegak)
              </p>
            </div>

            {/* Dismiss button */}
            <button
              onClick={() => setShowOverlay(false)}
              className="text-sm text-muted-foreground hover:text-foreground underline transition-colors"
            >
              Abaikan untuk sementara
            </button>
          </motion.div>

          {/* Background decoration */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.1 }}
          >
            <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-primary rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-40 h-40 bg-accent rounded-full blur-3xl" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useState, useEffect } from "react";
import gsap from "gsap";

/**
 * Hook to detect user's reduced motion preference
 * Also configures GSAP globally for reduced motion
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
      // Configure GSAP globally
      gsap.config({
        autoSleep: 60,
        nullTargetWarn: false,
      });
      if (e.matches) {
        gsap.globalTimeline.timeScale(10); // Speed up animations to near-instant
      } else {
        gsap.globalTimeline.timeScale(1);
      }
    };

    // Initial configuration
    if (mediaQuery.matches) {
      gsap.globalTimeline.timeScale(10);
    }

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Get GSAP animation config adjusted for reduced motion
 */
export function getMotionConfig(reducedMotion: boolean) {
  return {
    duration: reducedMotion ? 0.01 : undefined,
    ease: reducedMotion ? "none" : undefined,
  };
}

/**
 * Global GSAP configuration for reduced motion
 * Call this once at app init
 */
export function initGSAPReducedMotion(): void {
  if (typeof window === "undefined") return;
  
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  
  gsap.config({
    autoSleep: 60,
    nullTargetWarn: false,
  });
  
  if (prefersReduced) {
    gsap.globalTimeline.timeScale(10);
  }
}

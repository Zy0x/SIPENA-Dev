import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface SplashScreenProps {
  onComplete: () => void;
  minDuration?: number;
}

export function SplashScreen({ onComplete, minDuration = 2500 }: SplashScreenProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const logoContainerRef = useRef<HTMLDivElement>(null);
  const logoRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const taglineRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const ringRefs = useRef<HTMLDivElement[]>([]);
  const glowRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isComplete, setIsComplete] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  
  useEffect(() => {
    if (prefersReducedMotion) {
      // Skip animation for reduced motion
      const timer = setTimeout(() => {
        onComplete();
      }, 500);
      return () => clearTimeout(timer);
    }
    
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        onComplete: () => {
          setIsComplete(true);
          // Exit animation
          gsap.to(containerRef.current, {
            opacity: 0,
            scale: 1.05,
            duration: 0.5,
            ease: "power2.inOut",
            onComplete: onComplete
          });
        }
      });
      
      // Create particles
      if (particlesRef.current) {
        for (let i = 0; i < 20; i++) {
          const particle = document.createElement("div");
          particle.className = "absolute w-1 h-1 bg-primary/60 rounded-full";
          particle.style.left = `${Math.random() * 100}%`;
          particle.style.top = `${Math.random() * 100}%`;
          particlesRef.current.appendChild(particle);
          
          gsap.to(particle, {
            x: (Math.random() - 0.5) * 200,
            y: (Math.random() - 0.5) * 200,
            opacity: 0,
            scale: 0,
            duration: 2 + Math.random() * 2,
            delay: 0.5 + Math.random() * 0.5,
            ease: "power2.out"
          });
        }
      }
      
      // Glow pulse animation
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          scale: 1.5,
          opacity: 0.3,
          duration: 1.5,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }
      
      // Rings animation
      ringRefs.current.forEach((ring, i) => {
        if (ring) {
          gsap.fromTo(ring,
            { scale: 0, opacity: 0.8, rotation: 0 },
            {
              scale: 2 + i * 0.5,
              opacity: 0,
              rotation: 180 + i * 45,
              duration: 2,
              delay: 0.3 + i * 0.2,
              ease: "power2.out",
              repeat: -1,
              repeatDelay: 0.5
            }
          );
        }
      });
      
      // Main timeline
      tl
        // Initial logo entrance - dramatic scale and rotation
        .fromTo(logoRef.current,
          { scale: 0, rotation: -180, opacity: 0 },
          { scale: 1, rotation: 0, opacity: 1, duration: 1, ease: "back.out(1.7)" }
        )
        // Logo bounce
        .to(logoRef.current, {
          y: -15,
          duration: 0.3,
          ease: "power2.out"
        })
        .to(logoRef.current, {
          y: 0,
          duration: 0.4,
          ease: "bounce.out"
        })
        // Text reveal with split animation
        .fromTo(textRef.current,
          { opacity: 0, y: 30, scale: 0.9 },
          { opacity: 1, y: 0, scale: 1, duration: 0.6, ease: "back.out(1.5)" },
          "-=0.2"
        )
        // Tagline slide in
        .fromTo(taglineRef.current,
          { opacity: 0, y: 20 },
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
          "-=0.3"
        )
        // Progress bar animation
        .fromTo(progressRef.current,
          { scaleX: 0 },
          { scaleX: 1, duration: 1.2, ease: "power2.inOut" },
          "-=0.2"
        );
        
    }, containerRef);
    
    // Minimum duration timer
    const timer = setTimeout(() => {
      // Timeline will complete naturally
    }, minDuration);
    
    return () => {
      ctx.revert();
      clearTimeout(timer);
    };
  }, [onComplete, minDuration, prefersReducedMotion]);
  
  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(135deg, hsl(221 83% 12%) 0%, hsl(221 83% 20%) 50%, hsl(173 80% 15%) 100%)"
      }}
    >
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_hsl(221_83%_8%/0.8)_100%)]" />
      
      {/* Particle container */}
      <div ref={particlesRef} className="absolute inset-0 pointer-events-none" />
      
      {/* Central glow */}
      <div
        ref={glowRef}
        className="absolute w-64 h-64 bg-primary/30 rounded-full blur-3xl"
      />
      
      {/* Expanding rings */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          ref={(el) => { if (el) ringRefs.current[i] = el; }}
          className="absolute w-32 h-32 border-2 border-primary/40 rounded-full"
          style={{ opacity: 0 }}
        />
      ))}
      
      {/* Main content */}
      <div ref={logoContainerRef} className="relative z-10 flex flex-col items-center">
        {/* Logo with glow effect */}
        <div ref={logoRef} className="relative mb-6" style={{ opacity: 0 }}>
          {/* Logo glow background */}
          <div className="absolute inset-0 bg-primary/20 rounded-2xl blur-xl scale-150" />
          
          {/* Logo container */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden shadow-2xl shadow-primary/50 ring-2 ring-primary/30">
            <img
              src="/icon.png"
              alt="SIPENA Logo"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
        
        {/* App name */}
        <div ref={textRef} className="text-center" style={{ opacity: 0 }}>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white tracking-tight mb-2">
            SIPENA
          </h1>
        </div>
        
        {/* Tagline */}
        <div ref={taglineRef} className="text-center" style={{ opacity: 0 }}>
          <p className="text-sm sm:text-base lg:text-lg text-white/70 font-medium max-w-xs sm:max-w-sm">
            Sistem Informasi Penilaian Akademik
          </p>
          <p className="text-xs sm:text-sm text-white/50 mt-1">
            untuk Guru Indonesia
          </p>
        </div>
        
        {/* Progress bar */}
        <div className="mt-8 w-48 sm:w-56 h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            ref={progressRef}
            className="h-full bg-gradient-to-r from-primary via-accent to-primary rounded-full origin-left"
            style={{ transform: "scaleX(0)" }}
          />
        </div>
      </div>
      
      {/* Version badge */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2">
        <p className="text-xs text-white/40 font-mono">Memuat...</p>
      </div>
    </div>
  );
}

export default SplashScreen;

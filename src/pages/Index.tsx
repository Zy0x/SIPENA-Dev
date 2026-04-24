import { useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Footer from "@/components/Footer";
import { SipenaLogoIcon } from "@/components/SipenaLogo";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { 
  ArrowRight, 
  CheckCircle, 
  BarChart3, 
  FileSpreadsheet, 
  Users,
  Sparkles,
  Shield,
  Zap,
  Globe,
  GraduationCap,
  ClipboardCheck,
  TrendingUp,
  Download,
  Star,
  ChevronDown,
  Bot,
  Smartphone,
  Clock,
  PenTool,
  BookOpen,
  CalendarCheck,
} from "lucide-react";

// Register GSAP plugins
gsap.registerPlugin(ScrollTrigger);

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  
  // Refs for GSAP animations
  const containerRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const heroContentRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const benefitsRef = useRef<HTMLDivElement>(null);
  const scrollIndicatorRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const featureCardsRef = useRef<HTMLDivElement[]>([]);
  const statsRef = useRef<HTMLDivElement>(null);
  const statItemsRef = useRef<HTMLDivElement[]>([]);
  const ctaSectionRef = useRef<HTMLDivElement>(null);
  const orbsRef = useRef<HTMLDivElement[]>([]);
  const logoRef = useRef<HTMLDivElement>(null);
  const howItWorksRef = useRef<HTMLDivElement>(null);
  const howItWorksCardsRef = useRef<HTMLDivElement[]>([]);

  useEffect(() => {
    if (!loading && user) {
      navigate("/dashboard");
    }
  }, [user, loading, navigate]);

  // Main GSAP animation
  useEffect(() => {
    if (loading || prefersReducedMotion) return;
    
    const ctx = gsap.context(() => {
      // Header entrance
      gsap.fromTo(headerRef.current,
        { y: -50, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8, ease: "power3.out", delay: 0.2 }
      );
      
      // Floating orbs animation
      orbsRef.current.forEach((orb, i) => {
        if (orb) {
          gsap.to(orb, {
            y: `${(i % 2 === 0 ? -1 : 1) * (30 + i * 10)}`,
            x: `${(i % 2 === 0 ? 1 : -1) * (20 + i * 5)}`,
            scale: 1 + (i * 0.1),
            duration: 4 + i,
            repeat: -1,
            yoyo: true,
            ease: "sine.inOut"
          });
        }
      });
      
      // Logo simple floating animation
      if (logoRef.current) {
        // Subtle floating effect
        gsap.to(logoRef.current, {
          y: -5,
          duration: 2,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut"
        });
      }
      
      // Hero content stagger animation
      const heroTl = gsap.timeline({ delay: 0.3 });
      
      // Badge entrance with bounce
      heroTl.fromTo(badgeRef.current,
        { scale: 0, opacity: 0, y: 20 },
        { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "back.out(1.7)" }
      );
      
      // Title split animation - character by character effect
      heroTl.fromTo(titleRef.current,
        { opacity: 0, y: 50, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "power3.out" },
        "-=0.3"
      );
      
      // Subtitle slide in
      heroTl.fromTo(subtitleRef.current,
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power3.out" },
        "-=0.4"
      );
      
      // CTA buttons entrance with spring
      heroTl.fromTo(ctaRef.current?.children || [],
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.1, ease: "back.out(1.5)" },
        "-=0.3"
      );
      
      // Benefits icons stagger
      heroTl.fromTo(benefitsRef.current?.children || [],
        { opacity: 0, x: -20 },
        { opacity: 1, x: 0, duration: 0.4, stagger: 0.1, ease: "power2.out" },
        "-=0.2"
      );
      
      // Scroll indicator bounce
      if (scrollIndicatorRef.current) {
        gsap.to(scrollIndicatorRef.current, {
          y: 10,
          duration: 1,
          repeat: -1,
          yoyo: true,
          ease: "power1.inOut"
        });
      }
      
      // ============= PARALLAX EFFECTS - SMOOTH & CLEAN =============
      
      // Hero section parallax dengan animasi yang reversible
      if (heroRef.current) {
        // Background orbs parallax dengan kecepatan berbeda
        orbsRef.current.forEach((orb, i) => {
          if (orb) {
            gsap.to(orb, {
              y: () => window.innerHeight * (0.2 + i * 0.08),
              scrollTrigger: {
                trigger: heroRef.current,
                start: "top top",
                end: "bottom top",
                scrub: 1,
                invalidateOnRefresh: true
              }
            });
          }
        });
        
        // Hero content parallax - fade out smoothly
        gsap.to(heroContentRef.current, {
          y: 200,
          opacity: 0,
          scrollTrigger: {
            trigger: heroRef.current,
            start: "top top",
            end: "bottom top",
            scrub: 0.5,
            invalidateOnRefresh: true
          }
        });
      }
      
      // Feature cards scroll animation
      featureCardsRef.current.forEach((card) => {
        if (card) {
          gsap.fromTo(card,
            { opacity: 0, y: 80, scale: 0.9, rotationX: 10 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              rotationX: 0,
              duration: 0.8,
              ease: "power3.out",
              scrollTrigger: {
                trigger: card,
                start: "top 85%",
                toggleActions: "play none none reverse"
              }
            }
          );
        }
      });

      // How it works cards animation
      howItWorksCardsRef.current.forEach((card, i) => {
        if (card) {
          gsap.fromTo(
            card,
            { opacity: 0, y: 40, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.55,
              delay: i * 0.08,
              ease: "power3.out",
              scrollTrigger: {
                trigger: howItWorksRef.current,
                start: "top 82%",
                toggleActions: "play none none reverse"
              }
            }
          );
        }
      });
      
      // Stats counter animation
      statItemsRef.current.forEach((stat, i) => {
        if (stat) {
          gsap.fromTo(stat,
            { opacity: 0, y: 50, scale: 0.8 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              duration: 0.6,
              delay: i * 0.1,
              ease: "back.out(1.5)",
              scrollTrigger: {
                trigger: statsRef.current,
                start: "top 80%",
                toggleActions: "play none none reverse"
              }
            }
          );
        }
      });
      
      // CTA section parallax
      if (ctaSectionRef.current) {
        gsap.fromTo(ctaSectionRef.current,
          { opacity: 0, y: 60, scale: 0.95 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: ctaSectionRef.current,
              start: "top 85%",
              toggleActions: "play none none reverse"
            }
          }
        );
      }
    }, containerRef);
    
    return () => ctx.revert();
  }, [loading, prefersReducedMotion]);

  // GSAP hover animations
  const handleButtonHover = useCallback((el: HTMLElement | null, isEntering: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, {
      scale: isEntering ? 1.05 : 1,
      y: isEntering ? -2 : 0,
      duration: 0.25,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  const handleCardHover = useCallback((el: HTMLElement | null, isEntering: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, {
      y: isEntering ? -8 : 0,
      scale: isEntering ? 1.02 : 1,
      boxShadow: isEntering 
        ? "0 25px 50px -12px hsl(221 83% 53% / 0.25)" 
        : "0 10px 15px -3px hsl(221 83% 53% / 0.1)",
      duration: 0.35,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  const features = [
    {
      icon: Users,
      title: "Manajemen Kelas & Siswa",
      description: "Organisasi data kelas dan siswa secara sistematis. Import massal dari Excel/CSV dengan validasi otomatis.",
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: FileSpreadsheet,
      title: "Input Nilai Spreadsheet",
      description: "Antarmuka spreadsheet profesional dengan auto-save, keyboard navigation, dan perhitungan realtime.",
      color: "from-emerald-500 to-teal-500"
    },
    {
      icon: BarChart3,
      title: "Analitik & Laporan",
      description: "Dashboard visual dengan grafik statistik, ranking siswa, dan ekspor laporan dalam berbagai format.",
      color: "from-violet-500 to-purple-500"
    },
    {
      icon: ClipboardCheck,
      title: "Sistem KKM Terintegrasi",
      description: "Indikator visual otomatis berdasarkan Kriteria Ketuntasan Minimal. Mudah identifikasi siswa yang butuh perhatian.",
      color: "from-orange-500 to-amber-500"
    },
    {
      icon: Bot,
      title: "Morphe AI Assistant",
      description: "Asisten AI cerdas untuk analisis data nilai, prediksi performa siswa, dan saran pengajaran berbasis data.",
      color: "from-pink-500 to-rose-500"
    },
    {
      icon: CalendarCheck,
      title: "Presensi Digital",
      description: "Rekap presensi harian, mingguan, dan bulanan dengan status Hadir, Izin, Sakit, Alfa. Export siap cetak.",
      color: "from-sky-500 to-indigo-500"
    },
  ];

  const howItWorks = [
    { step: "01", title: "Buat Kelas & Mapel", desc: "Daftarkan kelas dan mata pelajaran yang diampu dalam hitungan detik.", icon: BookOpen },
    { step: "02", title: "Input Nilai", desc: "Gunakan tampilan spreadsheet untuk input nilai cepat seperti Excel — dengan auto-save.", icon: FileSpreadsheet },
    { step: "03", title: "Rekam Presensi", desc: "Catat kehadiran siswa harian secara digital. Otomatis rekap bulanan.", icon: CalendarCheck },
    { step: "04", title: "Ekspor & Cetak", desc: "Download laporan nilai dalam format PDF, Excel, atau CSV — siap dilaporkan ke sekolah.", icon: PenTool },
  ];

  const benefits = [
    { icon: Zap, label: "Input Nilai Cepat" },
    { icon: Shield, label: "Data Aman & Terenkripsi" },
    { icon: Globe, label: "Akses dari Mana Saja" },
    { icon: Download, label: "PWA - Install di HP" },
  ];

  const stats = [
    { value: "100%", label: "Gratis Selamanya", icon: Star },
    { value: "PWA", label: "Installable App", icon: Smartphone },
    { value: "AI", label: "Asisten Cerdas", icon: Bot },
    { value: "∞", label: "Tanpa Batas Data", icon: Zap },
  ];

  const animatedEntryStyle = prefersReducedMotion ? undefined : { opacity: 0 };

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {/* ================== HERO SECTION ================== */}
      <div ref={heroRef} className="relative min-h-screen flex flex-col overflow-hidden">
        {/* Animated gradient background */}
        <div className="absolute inset-0 hero-gradient" />
        
        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div 
            ref={(el) => { if (el) orbsRef.current[0] = el; }}
            className="absolute -top-20 -right-20 w-72 sm:w-96 h-72 sm:h-96 bg-primary/20 rounded-full blur-3xl"
          />
          <div 
            ref={(el) => { if (el) orbsRef.current[1] = el; }}
            className="absolute -bottom-40 -left-40 w-80 sm:w-[500px] h-80 sm:h-[500px] bg-accent/15 rounded-full blur-3xl"
          />
          <div 
            ref={(el) => { if (el) orbsRef.current[2] = el; }}
            className="absolute top-1/3 left-1/4 w-48 sm:w-72 h-48 sm:h-72 bg-white/5 rounded-full blur-3xl"
          />
          <div 
            ref={(el) => { if (el) orbsRef.current[3] = el; }}
            className="absolute top-1/2 right-1/4 w-40 sm:w-56 h-40 sm:h-56 bg-primary/10 rounded-full blur-3xl"
          />
        </div>

        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "50px 50px"
          }}
        />

        {/* Header */}
        <div ref={headerRef} className="relative z-20 p-4 md:p-6" style={animatedEntryStyle}>
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div ref={logoRef}>
                <SipenaLogoIcon size="lg" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl sm:text-2xl font-bold text-white tracking-tight">SIPENA</span>
                <span className="text-[10px] sm:text-xs text-white/60 -mt-0.5 hidden sm:block">Penilaian Akademik</span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Button 
                variant="ghost" 
                className="text-white/80 hover:text-white hover:bg-white/10 hidden sm:inline-flex"
                onClick={() => navigate("/help")}
              >
                Panduan
              </Button>
              <Button 
                variant="glass" 
                onClick={() => navigate("/auth")}
                onPointerEnter={(e) => handleButtonHover(e.currentTarget, true)}
                onPointerLeave={(e) => handleButtonHover(e.currentTarget, false)}
                className="gap-2"
              >
                Masuk
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Hero Content */}
        <div ref={heroContentRef} className="flex-1 flex items-center justify-center relative z-10 px-4 md:px-6 py-8 md:py-12">
          <div className="max-w-5xl mx-auto text-center">
            {/* Premium Badge */}
            <div 
              ref={badgeRef}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-2 sm:py-2.5 rounded-full bg-white/10 backdrop-blur-md text-white text-xs sm:text-sm mb-6 sm:mb-8 border border-white/20 shadow-xl"
              style={animatedEntryStyle}
            >
              <div className="relative">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <div className="absolute inset-0 animate-ping">
                  <Sparkles className="w-4 h-4 text-amber-400 opacity-75" />
                </div>
              </div>
              <span className="font-medium">Platform Gratis untuk Guru Indonesia</span>
              <GraduationCap className="w-4 h-4 text-accent hidden sm:block" />
            </div>
            
            {/* Main Title */}
            <h1 
              ref={titleRef}
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-4 sm:mb-6 leading-[1.1] tracking-tight"
              style={animatedEntryStyle}
            >
              Sistem Informasi
              <br />
              <span className="relative">
                <span className="bg-gradient-to-r from-white via-accent to-white bg-clip-text text-transparent">
                  Penilaian Akademik
                </span>
                {/* Animated underline */}
                <span className="absolute -bottom-2 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-50 rounded-full" />
              </span>
            </h1>
            
            {/* Subtitle */}
            <p 
              ref={subtitleRef}
              className="text-base sm:text-lg md:text-xl text-white/70 mb-8 sm:mb-10 max-w-3xl mx-auto leading-relaxed px-4"
              style={animatedEntryStyle}
            >
              Kelola nilai siswa dengan <strong className="text-white">mudah</strong>, <strong className="text-white">cepat</strong>, dan <strong className="text-white">profesional</strong>. 
              Input seperti Excel, analitik cerdas, dan ekspor laporan dalam satu platform modern.
            </p>
            
            {/* CTA Buttons */}
            <div ref={ctaRef} className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4">
              <Button
                size="xl"
                variant="gradient"
                onClick={() => navigate("/auth")}
                onPointerEnter={(e) => handleButtonHover(e.currentTarget, true)}
                onPointerLeave={(e) => handleButtonHover(e.currentTarget, false)}
                className="shadow-2xl shadow-primary/40 h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg font-semibold group relative overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Mulai Sekarang — Gratis
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
                {/* Button shine effect */}
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              </Button>
              <Button 
                size="xl" 
                variant="glass" 
                onClick={() => navigate("/help")}
                onPointerEnter={(e) => handleButtonHover(e.currentTarget, true)}
                onPointerLeave={(e) => handleButtonHover(e.currentTarget, false)}
                className="h-14 sm:h-16 px-8 sm:px-10 text-base sm:text-lg"
              >
                <TrendingUp className="w-5 h-5 mr-2" />
                Lihat Demo
              </Button>
            </div>

            {/* Quick Benefits */}
            <div ref={benefitsRef} className="flex flex-wrap justify-center gap-4 sm:gap-6 mt-10 sm:mt-12 px-4">
              {benefits.map((benefit, i) => (
                <div 
                  key={i} 
                  className="flex items-center gap-2 text-white/70 hover:text-white transition-colors cursor-default group"
                >
                  <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                    <benefit.icon className="w-4 h-4" />
                  </div>
                  <span className="text-xs sm:text-sm font-medium">{benefit.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div 
          ref={scrollIndicatorRef}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2 text-white/50"
        >
          <span className="text-xs font-medium">Scroll untuk melihat fitur</span>
          <ChevronDown className="w-5 h-5" />
        </div>

        {/* Wave separator */}
        <div className="relative z-10 mt-auto">
          <svg
            viewBox="0 0 1440 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full"
            preserveAspectRatio="none"
          >
            <path
              d="M0 120L60 105C120 90 240 60 360 45C480 30 600 30 720 37.5C840 45 960 60 1080 67.5C1200 75 1320 75 1380 75L1440 75V120H1380C1320 120 1200 120 1080 120C960 120 840 120 720 120C600 120 480 120 360 120C240 120 120 120 60 120H0Z"
              className="fill-background"
            />
          </svg>
        </div>
      </div>

      {/* ================== FEATURES SECTION ================== */}
      <div ref={featuresRef} className="py-16 md:py-24 lg:py-32 px-4 md:px-6 relative">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-64 h-64 bg-accent/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-6xl mx-auto relative">
          {/* Section header */}
          <div className="text-center mb-12 md:mb-16 lg:mb-20">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-4 font-medium">
              <CheckCircle className="w-4 h-4" />
              Fitur Lengkap & Profesional
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold text-foreground mb-4 tracking-tight">
              Semua yang Guru Butuhkan
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-base sm:text-lg">
              Dari input nilai hingga cetak rapor, semua dalam satu aplikasi yang intuitif dan mudah digunakan
            </p>
          </div>

          {/* Feature cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 lg:gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                ref={(el) => { if (el) featureCardsRef.current[index] = el; }}
                className="group p-5 md:p-6 rounded-2xl bg-card border border-border transition-all duration-300 cursor-default"
                onPointerEnter={(e) => handleCardHover(e.currentTarget, true)}
                onPointerLeave={(e) => handleCardHover(e.currentTarget, false)}
                style={animatedEntryStyle}
              >
                <div className="flex items-start gap-4 md:gap-5">
                  {/* Icon with gradient background */}
                  <div className={`w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br ${feature.color} flex items-center justify-center shadow-lg flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="w-7 h-7 md:w-8 md:h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg md:text-xl font-bold text-foreground mb-2 group-hover:text-primary transition-colors">
                      {feature.title}
                    </h3>
                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================== HOW IT WORKS SECTION ================== */}
      <div ref={howItWorksRef} className="py-12 md:py-16 lg:py-20 px-4 md:px-6 bg-muted/20 relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>
        <div className="max-w-5xl mx-auto relative">
          <div className="text-center mb-10 md:mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent text-sm mb-4 font-medium">
              <Clock className="w-4 h-4" />
              Mulai dalam Hitungan Menit
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4 tracking-tight">
              Cara Kerja SIPENA
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto text-base sm:text-lg">
              4 langkah sederhana untuk mulai mengelola nilai siswa secara digital
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
            {howItWorks.map((item, i) => (
              <div
                key={i}
                ref={(el) => { if (el) howItWorksCardsRef.current[i] = el; }}
                className="relative p-5 rounded-2xl bg-card border border-border text-center group hover:border-primary/30 transition-colors"
                style={animatedEntryStyle}
              >
                <div className="text-4xl font-black text-primary/10 absolute top-3 right-4 select-none">
                  {item.step}
                </div>
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1.5">{item.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================== STATS SECTION ================== */}
      <div ref={statsRef} className="py-12 md:py-16 px-4 md:px-6 bg-muted/30 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        </div>

        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {stats.map((stat, i) => (
              <div 
                key={i}
                ref={(el) => { if (el) statItemsRef.current[i] = el; }}
                className="text-center group cursor-default"
                style={animatedEntryStyle}
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 mb-3 group-hover:bg-primary/20 transition-colors">
                  <stat.icon className="w-6 h-6 text-primary" />
                </div>
                <p className="text-3xl md:text-4xl font-bold text-primary mb-1 group-hover:scale-110 transition-transform">{stat.value}</p>
                <p className="text-muted-foreground text-sm md:text-base">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ================== CTA SECTION ================== */}
      <section className="py-12 md:py-16 lg:py-20 px-4 md:px-6">
        <div className="max-w-4xl mx-auto">
          <div 
            ref={ctaSectionRef}
            className="relative overflow-hidden rounded-3xl lg:rounded-[2rem] bg-gradient-to-br from-primary via-primary to-accent p-8 md:p-12 lg:p-16 text-center shadow-2xl shadow-primary/30"
            style={animatedEntryStyle}
          >
            {/* Background decorations */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
            </div>

            <div className="relative z-10">
              {/* Icon */}
              <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-white/20 backdrop-blur-sm mb-6 shadow-xl">
                <GraduationCap className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-4 leading-tight">
                Siap Mengelola Nilai<br className="hidden sm:block" /> Lebih Efisien?
              </h2>
              <p className="text-white/80 mb-8 md:mb-10 max-w-xl mx-auto text-base sm:text-lg md:text-xl leading-relaxed">
                Daftar gratis sekarang dan rasakan kemudahan mengelola nilai siswa dengan SIPENA — platform penilaian akademik modern untuk pendidik Indonesia.
              </p>
              <Button
                size="xl"
                onClick={() => navigate("/auth")}
                onPointerEnter={(e) => handleButtonHover(e.currentTarget, true)}
                onPointerLeave={(e) => handleButtonHover(e.currentTarget, false)}
                className="bg-white text-primary hover:bg-white/90 shadow-xl h-14 sm:h-16 px-10 sm:px-12 text-base sm:text-lg font-bold group"
              >
                <span className="flex items-center gap-2">
                  Daftar Gratis Sekarang
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Button>
              
              {/* Trust badges */}
              <div className="flex flex-wrap justify-center gap-4 mt-8 text-white/60 text-sm">
                <span className="flex items-center gap-1.5">
                  <Shield className="w-4 h-4" />
                  Data Terenkripsi
                </span>
                <span className="flex items-center gap-1.5">
                  <Zap className="w-4 h-4" />
                  Tanpa Biaya
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="w-4 h-4" />
                  100% Indonesia
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
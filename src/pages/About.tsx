import { useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabaseExternal as supabase } from "@/lib/supabase-external";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Info,
  Users,
  MessageCircle,
  Github,
  ExternalLink,
  Heart,
  Code,
  BookOpen,
  Shield,
  BadgeCheck,
  Sparkles,
  Zap,
  Database,
  Smartphone,
  Globe,
  History,
  ChevronRight,
  Linkedin,
  Twitter,
  Instagram,
  Youtube,
  Mail,
  Link2,
  Facebook,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { APP_VERSION } from "@/config/version";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface SocialLinkEntry {
  platform: string;
  url: string;
}

interface TeamProfile {
  id: string;
  name: string;
  role: string;
  description: string | null;
  avatar_url: string | null;
  social_links: SocialLinkEntry[] | Record<string, string> | null;
  order_index: number;
}

function normalizeSocialLinks(raw: TeamProfile["social_links"]): SocialLinkEntry[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is SocialLinkEntry => !!item && typeof item.platform === "string" && typeof item.url === "string")
      .map((item) => ({
        platform: item.platform,
        url: item.url,
      }));
  }

  return Object.entries(raw)
    .filter(([, url]) => typeof url === "string" && url.trim())
    .map(([platform, url]) => ({
      platform,
      url: url as string,
    }));
}

// Enhanced Verified Badge with GSAP animation
function AnimatedVerifiedBadge() {
  const badgeRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<SVGSVGElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      // Glow pulse
      if (glowRef.current) {
        gsap.to(glowRef.current, {
          scale: 1.4, opacity: 0.3,
          duration: 1.5, repeat: -1, yoyo: true, ease: "sine.inOut"
        });
      }
      // Subtle rotation
      if (badgeRef.current) {
        gsap.to(badgeRef.current, {
          rotation: 360, duration: 20, repeat: -1, ease: "none"
        });
      }
      // Check bounce
      if (checkRef.current) {
        gsap.to(checkRef.current, {
          scale: 1.15, duration: 0.8, repeat: -1, yoyo: true, ease: "power1.inOut"
        });
      }
    });
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  return (
    <div className="relative inline-flex items-center justify-center flex-shrink-0">
      {/* Glow */}
      <div ref={glowRef} className="absolute inset-0 bg-primary/20 rounded-full blur-sm" />
      {/* Rotating ring */}
      <div ref={badgeRef} className="absolute inset-[-2px] rounded-full border border-primary/30 border-dashed" />
      {/* Check icon */}
      <BadgeCheck ref={checkRef} className="w-5 h-5 text-primary relative z-10" />
    </div>
  );
}

// Enhanced role badge
function RoleBadge({ role }: { role: string }) {
  const isFounder = role.toLowerCase().includes("founder") || role.toLowerCase().includes("pengembang");
  const badgeRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (!isFounder || prefersReducedMotion || !badgeRef.current) return;
    gsap.fromTo(badgeRef.current, { opacity: 0, y: 8, scale: 0.9 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, delay: 0.3, ease: "back.out(1.4)" });
  }, [isFounder, prefersReducedMotion]);
  
  if (isFounder) {
    return (
      <div ref={badgeRef} className="inline-flex items-center gap-2 mt-2">
        <Badge className="gap-1.5 px-3 py-1 text-xs font-semibold bg-gradient-to-r from-primary to-accent text-white border-0 shadow-md shadow-primary/20">
          <Sparkles className="w-3 h-3" />
          {role}
        </Badge>
      </div>
    );
  }
  
  return (
    <Badge variant="secondary" className="mt-2 text-xs font-medium bg-secondary/80 hover:bg-secondary border border-border/50">
      {role}
    </Badge>
  );
}

export default function About() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  // Refs
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<HTMLDivElement[]>([]);
  const techRefs = useRef<HTMLDivElement[]>([]);
  const teamCardRefs = useRef<HTMLDivElement[]>([]);

  const { data: teamProfiles = [], isLoading } = useQuery({
    queryKey: ["team_profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_profiles")
        .select("*")
        .eq("is_active", true)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data as TeamProfile[];
    },
  });

  // GSAP entrance animations
  useEffect(() => {
    if (prefersReducedMotion) return;
    const ctx = gsap.context(() => {
      // Hero
      if (heroRef.current) {
        gsap.fromTo(heroRef.current, { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" });
      }
      // Sections with stagger
      sectionRefs.current.forEach((sec, i) => {
        if (sec) {
          gsap.fromTo(sec, { opacity: 0, y: 25 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.15 + i * 0.1, ease: "power3.out" });
        }
      });
    }, pageRef);
    return () => ctx.revert();
  }, [prefersReducedMotion]);

  // Tech cards stagger
  useEffect(() => {
    if (prefersReducedMotion) return;
    techRefs.current.forEach((el, i) => {
      if (el) gsap.fromTo(el,
        { opacity: 0, y: 15, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, delay: 0.3 + i * 0.08, ease: "back.out(1.2)" }
      );
    });
  }, [prefersReducedMotion]);

  // Team cards after data loads
  useEffect(() => {
    if (prefersReducedMotion || isLoading || !teamProfiles.length) return;
    teamCardRefs.current.forEach((el, i) => {
      if (el) gsap.fromTo(el, { opacity: 0, y: 20, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, delay: i * 0.12, ease: "power3.out" });
    });
  }, [prefersReducedMotion, isLoading, teamProfiles]);

  // Hover card effect
  const hoverCard = useCallback((el: HTMLElement | null, enter: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, { y: enter ? -3 : 0, scale: enter ? 1.015 : 1, duration: 0.25, ease: "power2.out" });
  }, [prefersReducedMotion]);

  const handleContactSupport = (platform: "telegram" | "github") => {
    if (platform === "telegram") {
      window.open("https://t.me/thuandmuda?text=Saya%20perlu%20bantuan%20terkait%20SIPENA,%20mengenai%20....", "_blank");
    } else {
      window.open("https://github.com/Zy0x", "_blank");
    }
  };

  const getInitials = (name: string) => {
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  const techStack = [
    { icon: Code, title: "React + TypeScript", desc: "Frontend Modern", color: "from-blue-500/90 to-blue-600/90" },
    { icon: Database, title: "Supabase", desc: "Backend & Database", color: "from-emerald-500/90 to-emerald-600/90" },
    { icon: Shield, title: "End-to-End Encryption", desc: "Data Aman", color: "from-purple-500/90 to-purple-600/90" },
    { icon: Smartphone, title: "PWA Ready", desc: "Install di HP", color: "from-orange-500/90 to-orange-600/90" },
  ];

  return (
    <>
      <div ref={pageRef} className="app-page app-page-readable">
        {/* Header */}
        <div ref={heroRef} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground tracking-tight">
              Tentang SIPENA
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1 truncate">
              Sistem Informasi Penilaian Akademik
            </p>
          </div>
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg flex-shrink-0">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </div>
        </div>

        {/* About Card */}
        <Card ref={el => { if (el) sectionRefs.current[0] = el; }} className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-4">
            <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
              <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
              <span className="truncate">Apa itu SIPENA?</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed text-justify">
              <strong className="text-foreground">SIPENA</strong> (Sistem Informasi Penilaian Akademik) merupakan aplikasi web terkini 
              yang dirancang khusus untuk mendukung guru dalam pengelolaan data penilaian akademik siswa 
              secara sistematis dan efektif. Fitur utamanya meliputi input nilai berbasis tampilan spreadsheet, 
              mekanisme berbagi akses bagi guru tamu, serta kemampuan prediksi nilai menggunakan teknologi 
              kecerdasan buatan (AI).
            </p>
            
            <Separator className="my-4 opacity-50" />

            {/* Tech Stack Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
              {techStack.map((tech, i) => (
                <div
                  key={i}
                  ref={el => { if (el) techRefs.current[i] = el; }}
                  onPointerEnter={(e) => hoverCard(e.currentTarget, true)}
                  onPointerLeave={(e) => hoverCard(e.currentTarget, false)}
                  className={cn(
                    "flex items-center gap-3 p-3 sm:p-4 rounded-xl bg-gradient-to-br border border-white/10 cursor-default transition-all duration-300",
                    tech.color
                  )}
                >
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center flex-shrink-0 shadow-inner">
                    <tech.icon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm sm:text-base text-white truncate">{tech.title}</p>
                    <p className="text-xs sm:text-sm text-white/80 truncate">{tech.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Team Section */}
        <Card ref={el => { if (el) sectionRefs.current[1] = el; }} className="overflow-hidden">
          <CardHeader className="pb-2 sm:pb-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                  <Users className="w-4 h-4 sm:w-5 sm:h-5 text-primary flex-shrink-0" />
                  <span className="truncate">Tim Pengembang</span>
                </CardTitle>
                <CardDescription className="text-[10px] sm:text-xs mt-0.5">
                  Orang-orang di balik SIPENA
                </CardDescription>
              </div>
              <Globe className="w-5 h-5 sm:w-6 sm:h-6 text-muted-foreground/50" />
            </div>
          </CardHeader>
          <CardContent className="px-3 sm:px-6">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl bg-muted/50 animate-pulse">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-muted flex-shrink-0" />
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="h-4 w-24 sm:w-32 bg-muted rounded" />
                      <div className="h-3 w-16 sm:w-20 bg-muted rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : teamProfiles.length > 0 ? (
              <div className="grid grid-cols-1 gap-3">
                {teamProfiles.map((profile, index) => {
                  const isFounder = profile.role.toLowerCase().includes("founder") || profile.role.toLowerCase().includes("pengembang");
                  return (
                    <div
                      key={profile.id}
                      ref={el => { if (el) teamCardRefs.current[index] = el; }}
                      onPointerEnter={(e) => hoverCard(e.currentTarget, true)}
                      onPointerLeave={(e) => hoverCard(e.currentTarget, false)}
                      className="group relative"
                    >
                      <div className="relative p-3 sm:p-4 rounded-xl bg-gradient-to-br from-card via-card to-muted/20 border border-border/50 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                        <div className="flex items-start gap-3 sm:gap-4">
                          {/* Avatar */}
                          <div className="relative flex-shrink-0">
                            {isFounder && (
                              <div className="absolute -inset-0.5 bg-gradient-to-br from-primary to-accent rounded-full opacity-50 blur-[2px] group-hover:opacity-75 transition-opacity" />
                            )}
                            <Avatar className="relative w-12 h-12 sm:w-14 sm:h-14 border-2 border-background">
                              <AvatarImage src={profile.avatar_url || undefined} alt={profile.name} />
                              <AvatarFallback className="text-sm sm:text-base font-semibold bg-gradient-to-br from-primary/20 to-accent/20 text-foreground">
                                {getInitials(profile.name)}
                              </AvatarFallback>
                            </Avatar>
                          </div>
                          
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-sm sm:text-base text-foreground truncate">
                                {profile.name}
                              </h3>
                              {isFounder && <AnimatedVerifiedBadge />}
                            </div>
                            <RoleBadge role={profile.role} />
                            {profile.description && (
                              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                                {profile.description}
                              </p>
                            )}
                            
                            {/* Social Links - below description */}
                            {normalizeSocialLinks(profile.social_links).length > 0 && (
                              <div className="flex items-center gap-1 mt-2.5 flex-wrap">
                                {normalizeSocialLinks(profile.social_links).map((link, socialIndex) => {
                                  const iconMap: Record<string, any> = {
                                    github: Github, telegram: MessageCircle, linkedin: Linkedin,
                                    twitter: Twitter, instagram: Instagram, youtube: Youtube,
                                    facebook: Facebook, email: Mail, website: Globe, other: Link2,
                                  };
                                  const Icon = iconMap[link.platform] || Link2;
                                  const labelMap: Record<string, string> = {
                                    github: "GitHub", telegram: "Telegram", linkedin: "LinkedIn",
                                    twitter: "Twitter/X", instagram: "Instagram", youtube: "YouTube",
                                    facebook: "Facebook", email: "Email", website: "Website",
                                  };
                                  return (
                                    <a
                                      key={`${link.platform}-${socialIndex}`}
                                      href={link.platform === "email" ? `mailto:${link.url}` : link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/50 hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors text-[10px] sm:text-xs"
                                      title={labelMap[link.platform] || link.platform}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <Icon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                      <span className="hidden sm:inline">{labelMap[link.platform] || link.platform}</span>
                                    </a>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-10 text-muted-foreground">
                <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 opacity-50" />
                <p className="text-xs sm:text-sm">Profil tim belum tersedia</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Version section */}
        <div ref={el => { if (el) sectionRefs.current[2] = el; }}
          className="rounded-2xl bg-card border border-border/50 overflow-hidden">
          <div className="px-5 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-[11px] text-muted-foreground">
              <span className="font-medium font-mono">SIPENA v{APP_VERSION}</span>
              <Separator orientation="vertical" className="h-3 hidden sm:block" />
              <span>© 2024 - {new Date().getFullYear()}</span>
              <Separator orientation="vertical" className="h-3 hidden sm:block" />
              <span className="flex items-center gap-1">
                Made with <Heart className="w-3 h-3 text-destructive" /> in Indonesia
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => navigate("/changelog#latest")} className="gap-1.5 text-xs rounded-xl h-9">
              <History className="w-3.5 h-3.5" />Changelog
            </Button>
          </div>
        </div>

        {/* Contact Support */}
        <Card ref={el => { if (el) sectionRefs.current[3] = el; }}>
          <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-3 py-4 sm:py-5 px-4 sm:px-6">
            <div className="text-center sm:text-left min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-foreground">Butuh Bantuan?</h3>
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">
                Hubungi tim support kami untuk pertanyaan atau masukan
              </p>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="min-w-[140px] sm:min-w-[160px] text-xs sm:text-sm rounded-xl">
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  Hubungi Support
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 sm:w-56">
                <DropdownMenuItem onClick={() => handleContactSupport("telegram")} className="cursor-pointer text-xs sm:text-sm">
                  <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2 text-primary" />
                  <span>Telegram</span>
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleContactSupport("github")} className="cursor-pointer text-xs sm:text-sm">
                  <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-2" />
                  <span>GitHub</span>
                  <ExternalLink className="w-2.5 h-2.5 sm:w-3 sm:h-3 ml-auto text-muted-foreground" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

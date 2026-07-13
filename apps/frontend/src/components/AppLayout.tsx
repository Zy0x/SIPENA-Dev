 import { useState, useEffect, useRef, useCallback, useMemo } from "react";
 import { Link, useLocation, useNavigate } from "react-router-dom";
 import { useAuth } from "@/contexts/AuthContext";
 import { cn } from "@/lib/utils";
 import { isEditableShortcutTarget } from "@/lib/keyboardShortcuts";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import Footer from "@/components/Footer";
 import { supabaseExternal as supabase } from "@/core/repositories/supabase-compat.repository";
 import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
 import { SipenaLogoIcon } from "@/components/SipenaLogo";
 import { MiniProfilePopup } from "@/components/MiniProfilePopup";
 import { ActiveYearBadge } from "@/components/layout/ActiveYearBadge";
 import { HeaderYearDisplay } from "@/components/layout/HeaderYearDisplay";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
 import { GlobalSearch, GlobalSearchTrigger } from "@/components/search/GlobalSearch";
 import { useFeatureFlags } from "@/app/providers/useFeatureFlags";
 import { FEATURE_KEYS } from "@/app/providers/featureAccess";
 import { useAdaptiveMotion } from "@/hooks/useAdaptiveMotion";
 import {
    LayoutDashboard,
    Users,
    BookOpen,
    FileSpreadsheet,
    BarChart3,
    Settings,
    School,
    HelpCircle,
    Info,
    CalendarDays,
    Trophy,
    Shield,
    UserCheck,
  } from "lucide-react";
 import { CollapsedNavItem, ExpandedNavItem } from "@/components/layout/SidebarNav";
 import morpheIconPure from "@/icon/icon_morphe_pure_96.png";

 // Morphe icon component using actual icon
 const MorpheIcon = ({ className }: { className?: string }) => (
   <img src={morpheIconPure} alt="Morphe" className={cn("rounded", className)} />
 );

 import {
   DashboardIcon,
   KelasIcon,
   MataPelajaranIcon,
   InputNilaiIcon,
   PresensiIcon,
   LaporanIcon,
   PengaturanIcon,
   PanduanIcon,
   TentangIcon,
   KeamananAkunIcon,
   LaporanNilaiIcon,
   PortalOrangtuaIcon,
   ProfilSayaIcon,
   RankingMuridIcon
 } from "@/components/ui/animated-icons";


 interface NavItem {
   href: string;
   label: string;
   icon: React.ComponentType<{ className?: string }>;
   featureKey?: string;
   isBeta?: boolean;
   children?: NavItem[];
 }
const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: DashboardIcon, featureKey: FEATURE_KEYS.dashboard },
  { href: "/classes", label: "Kelas & Murid", icon: KelasIcon, featureKey: FEATURE_KEYS.classes },
  { href: "/subjects", label: "Mata Pelajaran", icon: MataPelajaranIcon, featureKey: FEATURE_KEYS.subjects },
  { href: "/grades", label: "Input Nilai", icon: InputNilaiIcon, featureKey: FEATURE_KEYS.grades },
  { href: "/attendance", label: "Presensi", icon: PresensiIcon, isBeta: true, featureKey: FEATURE_KEYS.attendance },
  { href: "/attendance-v2", label: "Presensi V2", icon: PresensiIcon, isBeta: true, featureKey: FEATURE_KEYS.attendanceV2 },
  { 
    href: "/reports", 
    label: "Laporan", 
    icon: LaporanIcon,
    featureKey: FEATURE_KEYS.reports,
    children: [
      { href: "/reports/grades", label: "Laporan Nilai", icon: LaporanNilaiIcon, featureKey: FEATURE_KEYS.gradeReports },
      { href: "/reports/rankings", label: "Ranking Murid", icon: RankingMuridIcon, featureKey: FEATURE_KEYS.rankings },
      { href: "/reports/portal", label: "Portal Orang Tua", icon: PortalOrangtuaIcon, featureKey: FEATURE_KEYS.parentPortal },
    ]
  },
  { 
    href: "/settings", 
    label: "Pengaturan", 
    icon: PengaturanIcon,
    featureKey: FEATURE_KEYS.settings,
    children: [
      { href: "/settings/profile", label: "Profil Saya", icon: ProfilSayaIcon },
      { href: "/settings/profile#security-section", label: "Keamanan Akun", icon: KeamananAkunIcon },
    ]
  },
  { href: "/help", label: "Panduan", icon: PanduanIcon, featureKey: FEATURE_KEYS.help },
  { href: "/about", label: "Tentang", icon: TentangIcon, featureKey: FEATURE_KEYS.about },
  { href: "/morphe", label: "Morphe AI", icon: MorpheIcon, isBeta: true, featureKey: FEATURE_KEYS.morphe },
];

 interface AppLayoutProps {
   children: React.ReactNode;
 }

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true';
    }
    return false;
  });
  const [isDesktopSidebar, setIsDesktopSidebar] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showMiniProfile, setShowMiniProfile] = useState(false);
  const [expandedMenus, setExpandedMenus] = useState<string[]>([]);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  
  // Single shared triggerRef for MiniProfilePopup positioning
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  
   const sidebarRef = useRef<HTMLElement>(null);
   const overlayRef = useRef<HTMLDivElement>(null);
   const logoTextRef = useRef<HTMLDivElement>(null);
   const yearBadgeRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getAccessStatus } = useFeatureFlags();
  const lightMotion = useAdaptiveMotion();

  const visibleNavItems = useMemo(() => {
    const filterItem = (item: NavItem): NavItem | null => {
      if (item.featureKey && getAccessStatus(item.featureKey) !== "allowed") {
        return null;
      }

      const children = item.children
        ?.map(filterItem)
        .filter((child): child is NavItem => child !== null);

      return children ? { ...item, children } : item;
    };

    return navItems.map(filterItem).filter((item): item is NavItem => item !== null);
  }, [getAccessStatus]);

  // Sidebar width constants
  const SIDEBAR_EXPANDED_WIDTH = 260;
  const SIDEBAR_COLLAPSED_WIDTH = 72;
  const effectiveSidebarCollapsed = isDesktopSidebar && sidebarCollapsed;

  useEffect(() => {
    const syncSidebarMode = () => {
      setIsDesktopSidebar(window.innerWidth >= 1024);
    };

    syncSidebarMode();
    window.addEventListener("resize", syncSidebarMode);
    window.visualViewport?.addEventListener("resize", syncSidebarMode);

    return () => {
      window.removeEventListener("resize", syncSidebarMode);
      window.visualViewport?.removeEventListener("resize", syncSidebarMode);
    };
  }, []);

  // Global event listener to open sidebar programmatically
  useEffect(() => {
    const handleOpenSidebar = () => {
      if (window.innerWidth >= 1024) {
        setSidebarCollapsed(false);
      } else {
        setSidebarOpen(true);
      }
    };
    window.addEventListener("sipena:open-sidebar", handleOpenSidebar);
    return () => window.removeEventListener("sipena:open-sidebar", handleOpenSidebar);
  }, []);

  // Persist collapse state. CSS handles visual transitions so the application
  // shell does not evaluate an animation runtime during startup.
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());
  }, [sidebarCollapsed]);

  // Lock body scroll and contain overscroll when mobile sidebar is open
  useEffect(() => {
    if (typeof document === "undefined") return;

    if (!isDesktopSidebar && sidebarOpen) {
      const html = document.documentElement;
      const body = document.body;
      const previousHtmlOverflow = html.style.overflow;
      const previousHtmlOverscrollBehavior = html.style.overscrollBehavior;
      const previousBodyOverflow = body.style.overflow;
      const previousBodyOverscrollBehavior = body.style.overscrollBehavior;

      html.style.overflow = "hidden";
      html.style.overscrollBehavior = "contain";
      body.style.overflow = "hidden";
      body.style.overscrollBehavior = "contain";

      return () => {
        html.style.overflow = previousHtmlOverflow;
        html.style.overscrollBehavior = previousHtmlOverscrollBehavior;
        body.style.overflow = previousBodyOverflow;
        body.style.overscrollBehavior = previousBodyOverscrollBehavior;
      };
    }
  }, [sidebarOpen, isDesktopSidebar]);

  // Auto-expand menu if child is active (supports hash fragments)
  useEffect(() => {
    visibleNavItems.forEach(item => {
      if (item.children?.some(child => {
        const childPath = child.href.split('#')[0];
        const childHash = child.href.includes('#') ? `#${child.href.split('#')[1]}` : null;
        return childHash
          ? (location.pathname === childPath && location.hash === childHash)
          : location.pathname === child.href;
      })) {
        if (!expandedMenus.includes(item.href)) {
          setExpandedMenus(prev => [...prev, item.href]);
        }
      }
    });
  }, [location.pathname, location.hash, visibleNavItems, expandedMenus]);

  // Load avatar from storage for global sync
  useEffect(() => {
    const loadAvatar = async () => {
      if (!user?.id) return;
      
      if (user.user_metadata?.avatar_url) {
        setAvatarUrl(user.user_metadata.avatar_url);
        return;
      }
      
      try {
        const { data } = supabase.storage
          .from("avatars")
          .getPublicUrl(`${user.id}/avatar`);
        
        const response = await fetch(data.publicUrl, { method: 'HEAD' });
        if (response.ok) {
          setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
        }
      } catch (error) {
        console.log("No avatar found");
      }
    };
    
    loadAvatar();
  }, [user?.id, user?.user_metadata?.avatar_url]);

  const toggleMenu = useCallback((href: string, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setExpandedMenus(prev => 
      prev.includes(href) 
        ? prev.filter(h => h !== href)
        : [...prev, href]
    );
  }, []);

  const handleNavClick = useCallback((e: React.MouseEvent, href: string, hasChildren: boolean) => {
    const isOnThisPage = location.pathname === href;

    if (isOnThisPage) {
      // Already on this page or child page → toggle sidebar collapse (desktop)
      if (isDesktopSidebar) {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
        return;
      }
    }

    // When navigating to a parent with children, auto-expand its submenu
    if (hasChildren && !expandedMenus.includes(href)) {
      setExpandedMenus(prev => [...prev, href]);
    }
    
    if (!isDesktopSidebar) {
      setSidebarOpen(false);
    }
  }, [location.pathname, expandedMenus, isDesktopSidebar]);

   const closeMobileSidebar = useCallback(() => {
     setSidebarOpen(false);
   }, []);
 
   const userInitials = user?.user_metadata?.full_name
    ? user.user_metadata.full_name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || "U";

   // GSAP: Logo hover effects
   const logoDesktopRef = useRef<HTMLButtonElement>(null);
   const logoMobileRef = useRef<HTMLButtonElement>(null);
   const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);

   // Shell shortcuts stay here because they control layout-owned state.
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;
       if (isEditableShortcutTarget(e.target)) return;

       if (e.key.toLowerCase() === 'k') {
         e.preventDefault();
         setShowGlobalSearch(true);
         return;
       }

       if (e.key.toLowerCase() === 'b') {
         e.preventDefault();
         if (isDesktopSidebar) {
           setSidebarCollapsed((current) => !current);
         } else {
           setSidebarOpen((current) => !current);
         }
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, [isDesktopSidebar]);
 
   const handleGSAPHover = useCallback((el: HTMLElement | null, isEntering: boolean, config?: { scale?: number; rotation?: number }) => {
     if (!el) return;
     if (lightMotion) return;
     const scale = config?.scale || 1.05;
     const rotation = config?.rotation || 0;
      el.style.transition = "transform 180ms cubic-bezier(.2,.8,.2,1)";
      el.style.transform = isEntering ? `scale(${scale}) rotate(${rotation}deg)` : "scale(1) rotate(0deg)";
   }, [lightMotion]);
 
   const handleGSAPPress = useCallback((el: HTMLElement | null, isPressed: boolean) => {
     if (!el) return;
     if (lightMotion) return;
      el.style.transition = "transform 100ms ease-out";
      el.style.transform = isPressed ? "scale(.92)" : "scale(1)";
   }, [lightMotion]);
 
   return (
     <div className="min-h-screen bg-background flex w-full">
       {/* Mobile overlay */}
       <div
         ref={overlayRef}
         className={cn(
           "sipena-sidebar-overlay fixed inset-0 z-40 bg-black/70 backdrop-blur-md lg:hidden touch-none",
           sidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
         )}
         onClick={() => setSidebarOpen(false)}
         aria-hidden="true"
       />
 
       {/* Sidebar */}
       <aside
         ref={sidebarRef}
         className={cn(
           "fixed bottom-0 left-0 z-50 flex flex-col",
           "sipena-app-sidebar",
            "lg:bg-card lg:border-r lg:border-border",
            "bg-card/95 backdrop-blur-xl border-r border-border",
            "shadow-2xl shadow-black/10",
            "transition-[transform,width] duration-200 ease-out lg:translate-x-0",
           !isDesktopSidebar && sidebarOpen && "sipena-scroll-isolated"
         )}
         style={{
           top: "var(--banner-top-offset, 0px)",
           height: "calc(100vh - var(--banner-top-offset, 0px))",
           "--sipena-sidebar-expanded-width": `${SIDEBAR_EXPANDED_WIDTH}px`,
           "--sipena-sidebar-collapsed-width": `${SIDEBAR_COLLAPSED_WIDTH}px`,
         } as React.CSSProperties}
         data-sidebar-collapsed={effectiveSidebarCollapsed ? "true" : "false"}
         data-sidebar-state={sidebarOpen ? "open" : "closed"}
         aria-label="Navigasi utama"
         role="navigation"
       >
         {/* Logo section */}
          <div className={cn(
            "sipena-sidebar-header-elevated border-b border-border flex items-center shrink-0 relative bg-muted/30",
            effectiveSidebarCollapsed ? "h-14 justify-center px-2" : "h-14 gap-3 px-3"
          )}>
            <div
              className={cn(
                "hidden lg:flex items-center min-w-0",
                effectiveSidebarCollapsed ? "justify-center" : "gap-3 flex-1"
              )}
            >
             <Tooltip delayDuration={0}>
               <TooltipTrigger asChild>
                 <button
                   ref={logoDesktopRef}
                   onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                   onMouseEnter={() => handleGSAPHover(logoDesktopRef.current, true, { scale: 1.08 })}
                   onMouseLeave={() => handleGSAPHover(logoDesktopRef.current, false)}
                   onMouseDown={() => handleGSAPPress(logoDesktopRef.current, true)}
                   onMouseUp={() => handleGSAPPress(logoDesktopRef.current, false)}
                    className={cn(
                      "relative flex items-center justify-center rounded-xl transition-colors touch-manipulation",
                      "hover:bg-primary/10 active:bg-primary/20",
                      effectiveSidebarCollapsed ? "h-11 w-11 mx-auto" : "h-10 w-10"
                    )}
                   aria-label={effectiveSidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
                 >
                   <SipenaLogoIcon size={effectiveSidebarCollapsed ? "sm" : "md"} />
                    {effectiveSidebarCollapsed && (
                      <span className="absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-card" />
                    )}
                 </button>
               </TooltipTrigger>
               <TooltipContent side="right" sideOffset={8} className="font-medium">
                 {effectiveSidebarCollapsed ? "Buka sidebar (Ctrl+B)" : "Tutup sidebar (Ctrl+B)"}
               </TooltipContent>
             </Tooltip>
             
              <div
                ref={logoTextRef}
                className={cn(
                  "min-w-0 overflow-hidden transition-[width,opacity] duration-150",
                  effectiveSidebarCollapsed ? "w-0 opacity-0 pointer-events-none" : "flex-1 opacity-100",
                )}
              >
               <Link to="/dashboard" className="block">
                  <h1 className="font-bold text-lg text-foreground whitespace-nowrap hover:text-primary transition-colors">SIPENA</h1>
                  <p className="text-[10px] text-muted-foreground whitespace-nowrap truncate leading-tight">Sistem Informasi Penilaian Akademik</p>
                </Link>
             </div>
           </div>
           
           {/* Mobile logo */}
           <Tooltip delayDuration={0}>
             <TooltipTrigger asChild>
               <button
                 ref={logoMobileRef}
                 onClick={() => setSidebarOpen(false)}
                 onMouseEnter={() => handleGSAPHover(logoMobileRef.current, true, { scale: 1.02 })}
                 onMouseLeave={() => handleGSAPHover(logoMobileRef.current, false)}
                 onMouseDown={() => handleGSAPPress(logoMobileRef.current, true)}
                 onMouseUp={() => handleGSAPPress(logoMobileRef.current, false)}
                 className="lg:hidden flex items-center gap-3 rounded-xl py-2 px-2 -ml-2 hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation"
                 aria-label="Tutup menu"
               >
                 <div className="relative">
                   <SipenaLogoIcon size="md" />
                   <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-0.5">
                     <span className="w-1 h-1 rounded-full bg-primary/50" />
                     <span className="w-1 h-1 rounded-full bg-primary/30" />
                     <span className="w-1 h-1 rounded-full bg-primary/50" />
                   </div>
                 </div>
                 <div className="flex flex-col items-start">
                    <h1 className="font-bold text-base sm:text-lg text-foreground drop-shadow-sm">SIPENA</h1>
                    <p className="text-[9px] sm:text-xs text-foreground/70 font-medium leading-tight">Sistem Informasi Penilaian Akademik</p>
                 </div>
               </button>
             </TooltipTrigger>
             <TooltipContent side="bottom" sideOffset={4} className="text-xs lg:hidden">
               Ketuk logo untuk tutup menu
             </TooltipContent>
           </Tooltip>
         </div>
         
         {/* Active Year Badge */}
         {!effectiveSidebarCollapsed && (
           <div
             ref={yearBadgeRef}
             className="shrink-0 overflow-hidden border-b border-border/30 px-3 py-2"
             data-sidebar-year-badge="true"
           >
             <ActiveYearBadge variant="minimal" showSemester={true} />
           </div>
         )}
 
        {/* Navigation */}
        <nav 
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
             effectiveSidebarCollapsed ? "px-2 py-2" : "p-3"
          )} 
          aria-label="Menu navigasi"
          onWheel={(e) => {
            // Isolate sidebar scroll from page scroll
            const el = e.currentTarget;
            const isAtTop = el.scrollTop <= 0;
            const isAtBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
            if ((e.deltaY < 0 && isAtTop) || (e.deltaY > 0 && isAtBottom)) {
              // At edge — stop propagation so page doesn't scroll
              e.stopPropagation();
            }
          }}
        >
           <ul className="flex flex-col gap-1" role="list">
             {visibleNavItems.map((item) => {
               const isActive = location.pathname === item.href || 
                 (item.children && item.children.some(child => location.pathname === child.href));
               const isExpanded = expandedMenus.includes(item.href);
               
               return (
                 <li key={item.href}>
                   {effectiveSidebarCollapsed ? (
                     <CollapsedNavItem 
                       item={item} 
                       isActive={!!isActive}
                       onNavigate={handleNavClick}
                       onMobileClose={closeMobileSidebar}
                     />
                   ) : (
                     <ExpandedNavItem 
                       item={item} 
                       isActive={!!isActive} 
                       isExpanded={isExpanded}
                       onNavigate={handleNavClick}
                       onToggleMenu={toggleMenu}
                       onMobileClose={closeMobileSidebar}
                     />
                   )}
                 </li>
               );
             })}
           </ul>
         </nav>
       </aside>
 
       {/* Spacer for sidebar on desktop */}
       <div
         className={cn(
            "hidden lg:block shrink-0 transition-[width] duration-200 ease-out",
           effectiveSidebarCollapsed ? "w-[72px]" : "w-[260px]"
         )}
       />
 
       {/* Main content wrapper */}
       <div className="flex-1 flex flex-col min-w-0">
         {/* Mobile header */}
          <header className="sipena-app-header-elevated lg:hidden sticky top-0 z-30 bg-muted/30 backdrop-blur-xl border-b border-border shadow-sm safe-area-inset">
            <div className="flex items-center justify-between px-3 sm:px-4 h-14">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Tooltip delayDuration={300}>
                  <TooltipTrigger asChild>
                    <button
                      ref={mobileMenuBtnRef}
                      onClick={() => setSidebarOpen(true)}
                      onMouseEnter={() => handleGSAPHover(mobileMenuBtnRef.current, true)}
                      onMouseLeave={() => handleGSAPHover(mobileMenuBtnRef.current, false)}
                      onMouseDown={() => handleGSAPPress(mobileMenuBtnRef.current, true)}
                      onMouseUp={() => handleGSAPPress(mobileMenuBtnRef.current, false)}
                      aria-label="Buka menu navigasi"
                      aria-expanded={sidebarOpen}
                      className="relative flex items-center justify-center h-10 w-10 rounded-xl hover:bg-primary/10 active:bg-primary/20 transition-colors touch-manipulation flex-shrink-0"
                    >
                      <SipenaLogoIcon size="sm" />
                      <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                        <span className="w-0.5 h-0.5 rounded-full bg-primary/50" />
                        <span className="w-0.5 h-0.5 rounded-full bg-primary/30" />
                        <span className="w-0.5 h-0.5 rounded-full bg-primary/50" />
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4} className="text-xs">
                    Ketuk untuk buka menu
                  </TooltipContent>
                </Tooltip>
                
                <HeaderYearDisplay variant="mobile" />
              </div>
             
             <div className="flex items-center gap-2">
                <GlobalSearchTrigger onClick={() => setShowGlobalSearch(true)} />
                <NotificationDropdown />
               <button
                 ref={avatarTriggerRef}
                 onClick={() => setShowMiniProfile(!showMiniProfile)}
                 onMouseEnter={() => handleGSAPHover(avatarTriggerRef.current, true)}
                 onMouseLeave={() => handleGSAPHover(avatarTriggerRef.current, false)}
                 onMouseDown={() => handleGSAPPress(avatarTriggerRef.current, true)}
                 onMouseUp={() => handleGSAPPress(avatarTriggerRef.current, false)}
                 className="flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-manipulation"
                 aria-label="Buka menu profil"
                 aria-expanded={showMiniProfile}
               >
                 <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all">
                   <AvatarImage src={avatarUrl || undefined} alt="Foto profil" />
                   <AvatarFallback className="bg-primary/10 text-foreground text-xs sm:text-sm font-semibold">
                     {userInitials}
                   </AvatarFallback>
                 </Avatar>
               </button>
             </div>
           </div>
         </header>
 
         {/* Desktop header */}
         <header className="sipena-app-header-elevated hidden lg:flex sticky top-0 z-30 bg-muted/30 backdrop-blur-xl border-b border-border shadow-sm items-center justify-between px-6 h-14">
            <HeaderYearDisplay variant="desktop" />
           
           <div className="flex items-center gap-2.5">
              <GlobalSearchTrigger onClick={() => setShowGlobalSearch(true)} />
              <NotificationDropdown />
             <button
               ref={(el) => {
                 // On desktop, point triggerRef to this button
                 // On mobile the ref is set above. The last one rendered wins,
                 // but we handle it via a callback to set the ref correctly.
                 if (el && isDesktopSidebar) {
                   (avatarTriggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                 }
               }}
               onClick={() => setShowMiniProfile(!showMiniProfile)}
               onMouseEnter={(e) => handleGSAPHover(e.currentTarget, true)}
               onMouseLeave={(e) => handleGSAPHover(e.currentTarget, false)}
               onMouseDown={(e) => handleGSAPPress(e.currentTarget, true)}
               onMouseUp={(e) => handleGSAPPress(e.currentTarget, false)}
               className="flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
               aria-label="Buka menu profil"
               aria-expanded={showMiniProfile}
             >
               <Avatar className="h-9 w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all">
                 <AvatarImage src={avatarUrl || undefined} alt="Foto profil" />
                 <AvatarFallback className="bg-primary/10 text-foreground text-sm font-semibold">
                   {userInitials}
                 </AvatarFallback>
               </Avatar>
             </button>
           </div>
         </header>

         {/* Single MiniProfilePopup instance (rendered once, works for both mobile & desktop) */}
         <MiniProfilePopup
           isOpen={showMiniProfile}
           onClose={() => setShowMiniProfile(false)}
           avatarUrl={avatarUrl}
           userInitials={userInitials}
           triggerRef={avatarTriggerRef}
         />
 
         {/* Page content */}
         <main className="flex-1 overflow-x-hidden" role="main" aria-label="Konten utama" data-app-scroll-container>
           {children}
         </main>
 
          {/* Footer */}
          <Footer />
          <GlobalSearch open={showGlobalSearch} onOpenChange={setShowGlobalSearch} />
        </div>
     </div>
   );
 }

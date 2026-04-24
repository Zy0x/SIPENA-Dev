 import { useState, useEffect, useRef, useCallback } from "react";
 import { Link, useLocation, useNavigate } from "react-router-dom";
 import { useAuth } from "@/contexts/AuthContext";
 import { useEnhancedToast } from "@/contexts/ToastContext";
 import { cn } from "@/lib/utils";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import Footer from "@/components/Footer";
 import { supabaseExternal as supabase } from "@/lib/supabase-external";
 import { NotificationDropdown } from "@/components/notifications/NotificationDropdown";
 import { SipenaLogoIcon } from "@/components/SipenaLogo";
 import { MiniProfilePopup } from "@/components/MiniProfilePopup";
 import { ActiveYearBadge } from "@/components/layout/ActiveYearBadge";
 import { HeaderYearDisplay } from "@/components/layout/HeaderYearDisplay";
 import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
 import { GlobalSearch, GlobalSearchTrigger } from "@/components/search/GlobalSearch";
 import gsap from "gsap";
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
    Power,
    UserCheck,
  } from "lucide-react";
 import { CollapsedNavItem, ExpandedNavItem } from "@/components/layout/SidebarNav";
 import morpheIconPure from "@/icon/icon_morphe_pure.png";

 // Morphe icon component using actual icon
 const MorpheIcon = ({ className }: { className?: string }) => (
   <img src={morpheIconPure} alt="Morphe" className={cn("rounded", className)} />
 );

 interface NavItem {
   href: string;
   label: string;
   icon: React.ComponentType<{ className?: string }>;
   isBeta?: boolean;
   children?: NavItem[];
 }

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classes", label: "Kelas & Siswa", icon: School },
  { href: "/subjects", label: "Mata Pelajaran", icon: BookOpen },
  { href: "/grades", label: "Input Nilai", icon: FileSpreadsheet },
  { href: "/attendance", label: "Presensi", icon: CalendarDays, isBeta: true },
  { 
    href: "/reports", 
    label: "Laporan", 
    icon: BarChart3,
    children: [
      { href: "/reports/grades", label: "Laporan Nilai", icon: FileSpreadsheet },
      { href: "/reports/rankings", label: "Ranking Siswa", icon: Trophy },
      { href: "/reports/portal", label: "Portal Orang Tua", icon: UserCheck },
    ]
  },
  { 
    href: "/settings", 
    label: "Pengaturan", 
    icon: Settings,
    children: [
      { href: "/settings/profile", label: "Profil Saya", icon: Users },
      { href: "/settings/profile#security-section", label: "Keamanan Akun", icon: Shield },
    ]
  },
  { href: "/help", label: "Panduan", icon: HelpCircle },
  { href: "/about", label: "Tentang", icon: Info },
  { href: "/morphe", label: "Morphe AI", icon: MorpheIcon, isBeta: true },
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
   const logoutTextRef = useRef<HTMLSpanElement>(null);
   const ctrlHintRef = useRef<HTMLParagraphElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { success, error: showError } = useEnhancedToast();

  // Sidebar width constants
  const SIDEBAR_EXPANDED_WIDTH = 260;
  const SIDEBAR_COLLAPSED_WIDTH = 72;

  // Persist collapse state + GSAP animations
  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', sidebarCollapsed.toString());

    if (logoTextRef.current) {
      gsap.to(logoTextRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
        x: sidebarCollapsed ? -10 : 0,
        width: sidebarCollapsed ? 0 : "auto",
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    if (yearBadgeRef.current) {
      gsap.to(yearBadgeRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
        height: sidebarCollapsed ? 0 : "auto",
        paddingTop: sidebarCollapsed ? 0 : 8,
        paddingBottom: sidebarCollapsed ? 0 : 8,
        duration: 0.25,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    if (logoutTextRef.current) {
      gsap.to(logoutTextRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
        width: sidebarCollapsed ? 0 : "auto",
        duration: 0.2,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    if (ctrlHintRef.current) {
      gsap.to(ctrlHintRef.current, {
        opacity: sidebarCollapsed ? 0 : 1,
        height: sidebarCollapsed ? 0 : "auto",
        duration: 0.2,
        ease: "power2.out",
        overwrite: "auto",
      });
    }

    // Stagger nav items on collapse/expand (desktop only)
    if (sidebarRef.current && window.innerWidth >= 1024) {
      const items = Array.from(
        sidebarRef.current.querySelectorAll<HTMLElement>("[data-sidebar-nav-item='true']")
      );

      if (items.length) {
        gsap.killTweensOf(items);
        gsap.fromTo(
          items,
          { opacity: 0, x: sidebarCollapsed ? -8 : 8 },
          {
            opacity: 1,
            x: 0,
            duration: 0.28,
            ease: "power3.out",
            stagger: 0.015,
            clearProps: "opacity,transform",
            overwrite: "auto",
          }
        );
      }
    }
  }, [sidebarCollapsed]);
 
   // GSAP: Mobile overlay animation
   useEffect(() => {
     if (!overlayRef.current) return;
 
     if (sidebarOpen) {
       gsap.set(overlayRef.current, { display: "block" });
       gsap.to(overlayRef.current, {
         opacity: 1,
         duration: 0.25,
         ease: "power2.out"
       });
     } else {
       gsap.to(overlayRef.current, {
         opacity: 0,
         duration: 0.2,
         ease: "power2.in",
         onComplete: () => {
           if (overlayRef.current) {
             gsap.set(overlayRef.current, { display: "none" });
           }
         }
       });
     }
   }, [sidebarOpen]);
 
   // GSAP: Mobile sidebar slide animation + Desktop initial setup
   useEffect(() => {
     if (!sidebarRef.current) return;
 
     const isDesktop = window.innerWidth >= 1024;
 
     if (isDesktop) {
       gsap.set(sidebarRef.current, { x: 0 });
     } else {
       if (sidebarOpen) {
         gsap.to(sidebarRef.current, {
           x: 0,
           duration: 0.3,
           ease: "power3.out"
         });
       } else {
         gsap.to(sidebarRef.current, {
           x: "-100%",
           duration: 0.25,
           ease: "power2.in"
         });
       }
     }
   }, [sidebarOpen]);
 
   // Handle window resize for sidebar visibility
   useEffect(() => {
     const handleResize = () => {
       if (!sidebarRef.current) return;
       const isDesktop = window.innerWidth >= 1024;
       
       if (isDesktop) {
         gsap.set(sidebarRef.current, { x: 0 });
       } else if (!sidebarOpen) {
         gsap.set(sidebarRef.current, { x: "-100%" });
       }
     };
 
     window.addEventListener("resize", handleResize);
     handleResize();
 
     return () => window.removeEventListener("resize", handleResize);
   }, [sidebarOpen]);

  // Auto-expand menu if child is active (supports hash fragments)
  useEffect(() => {
    navItems.forEach(item => {
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
  }, [location.pathname, location.hash]);

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
    const isOnChildPage = hasChildren && navItems.find(i => i.href === href)?.children?.some(c => {
      const childPath = c.href.split('#')[0];
      return location.pathname === childPath;
    });

    if (isOnThisPage || isOnChildPage) {
      // Already on this page or child page → toggle sidebar collapse (desktop)
      if (window.innerWidth >= 1024) {
        e.preventDefault();
        setSidebarCollapsed(prev => !prev);
        return;
      }
    }

    // When navigating to a parent with children, auto-expand its submenu
    if (hasChildren && !expandedMenus.includes(href)) {
      setExpandedMenus(prev => [...prev, href]);
    }
    
    if (window.innerWidth < 1024) {
      setSidebarOpen(false);
    }
  }, [location.pathname, expandedMenus]);

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

   // Logout handler - proper route
    const handleLogout = useCallback(async () => {
     try {
       await signOut();
       // Clear all sensitive storage
       localStorage.removeItem("admin_session_token");
       sessionStorage.clear();
       // Force full reload to clear all React state and caches
       window.location.replace("/auth");
     } catch (error) {
       showError("Gagal keluar dari akun");
     }
   }, [signOut, showError]);

   // GSAP: Logo hover effects
   const logoDesktopRef = useRef<HTMLButtonElement>(null);
   const logoMobileRef = useRef<HTMLButtonElement>(null);
   const mobileMenuBtnRef = useRef<HTMLButtonElement>(null);
   const logoutBtnRef = useRef<HTMLButtonElement>(null);
   const logoutBtnExpandedRef = useRef<HTMLButtonElement>(null);

   // Global search keyboard shortcut (Ctrl+K / Cmd+K)
   useEffect(() => {
     const handleKeyDown = (e: KeyboardEvent) => {
       if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
         e.preventDefault();
         setShowGlobalSearch(true);
       }
     };
     window.addEventListener('keydown', handleKeyDown);
     return () => window.removeEventListener('keydown', handleKeyDown);
   }, []);
 
   const handleGSAPHover = useCallback((el: HTMLElement | null, isEntering: boolean, config?: { scale?: number; rotation?: number }) => {
     if (!el) return;
     const scale = config?.scale || 1.05;
     const rotation = config?.rotation || 0;
     gsap.to(el, {
       scale: isEntering ? scale : 1,
       rotation: isEntering ? rotation : 0,
       duration: 0.2,
       ease: isEntering ? "back.out(1.7)" : "power2.out"
     });
   }, []);
 
   const handleGSAPPress = useCallback((el: HTMLElement | null, isPressed: boolean) => {
     if (!el) return;
     gsap.to(el, {
       scale: isPressed ? 0.92 : 1,
       duration: 0.1,
       ease: "power2.out"
     });
   }, []);
 
   return (
     <div className="min-h-screen bg-background flex w-full">
       {/* Mobile overlay */}
       <div
         ref={overlayRef}
         className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 lg:hidden"
         onClick={() => setSidebarOpen(false)}
         style={{ display: "none", opacity: 0 }}
         aria-hidden="true"
       />
 
       {/* Sidebar */}
       <aside
         ref={sidebarRef}
         className={cn(
           "fixed inset-y-0 left-0 z-50 flex flex-col",
            "lg:bg-card lg:border-r lg:border-border",
            "bg-card/95 backdrop-blur-xl border-r border-border",
            "shadow-2xl shadow-black/10",
           "lg:translate-x-0 transition-[width] duration-300 ease-out",
           sidebarCollapsed ? "lg:w-[72px]" : "lg:w-[260px]",
           "w-[260px]"
         )}
         style={{ transform: "translateX(-100%)" }}
         aria-label="Navigasi utama"
         role="navigation"
       >
         {/* Logo section */}
         <div className={cn(
           "border-b border-border/50 flex items-center shrink-0 relative bg-card/80",
           sidebarCollapsed ? "p-3 justify-center h-16" : "px-4 py-3 gap-3 h-16"
         )}>
            <div
              className={cn(
                "hidden lg:flex items-center min-w-0",
                sidebarCollapsed ? "justify-center" : "gap-3 flex-1"
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
                     sidebarCollapsed ? "w-12 h-12 mx-auto" : "w-10 h-10 -ml-1"
                   )}
                   aria-label={sidebarCollapsed ? "Buka sidebar" : "Tutup sidebar"}
                 >
                   <SipenaLogoIcon size={sidebarCollapsed ? "sm" : "md"} />
                   <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                     <span className="w-1 h-1 rounded-full bg-primary/50" />
                     <span className="w-1 h-1 rounded-full bg-primary/30" />
                     <span className="w-1 h-1 rounded-full bg-primary/50" />
                   </div>
                 </button>
               </TooltipTrigger>
               <TooltipContent side="right" sideOffset={8} className="font-medium">
                 {sidebarCollapsed ? "Buka sidebar (Ctrl+B)" : "Tutup sidebar (Ctrl+B)"}
               </TooltipContent>
             </Tooltip>
             
             <div
               ref={logoTextRef}
               className="overflow-hidden min-w-0"
               style={{ opacity: sidebarCollapsed ? 0 : 1 }}
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
         <div
           ref={yearBadgeRef}
           className="px-4 border-b border-border/30 shrink-0 overflow-hidden"
           style={{ opacity: sidebarCollapsed ? 0 : 1, height: sidebarCollapsed ? 0 : "auto" }}
         >
           <ActiveYearBadge variant="minimal" showSemester={true} />
         </div>
 
        {/* Navigation */}
        <nav 
          className={cn(
            "flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain",
            "scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent",
            sidebarCollapsed ? "p-2 pt-3" : "p-3"
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
           <ul className="space-y-1" role="list">
             {navItems.map((item) => {
               const isActive = location.pathname === item.href || 
                 (item.children && item.children.some(child => location.pathname === child.href));
               const isExpanded = expandedMenus.includes(item.href);
               
               return (
                 <li key={item.href}>
                   {sidebarCollapsed ? (
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
 
         {/* Logout section */}
         <div className={cn(
           "shrink-0 mt-auto border-t border-border/40 bg-card/50",
           sidebarCollapsed ? "p-2" : "px-3 py-1.5"
         )}>
           {sidebarCollapsed ? (
             <Tooltip delayDuration={0}>
               <TooltipTrigger asChild>
                 <button
                   ref={logoutBtnRef}
                   onClick={handleLogout}
                   onMouseEnter={() => handleGSAPHover(logoutBtnRef.current, true)}
                   onMouseLeave={() => handleGSAPHover(logoutBtnRef.current, false)}
                   onMouseDown={() => handleGSAPPress(logoutBtnRef.current, true)}
                   onMouseUp={() => handleGSAPPress(logoutBtnRef.current, false)}
                   className={cn(
                     "flex items-center justify-center w-12 h-12 mx-auto rounded-xl transition-colors touch-manipulation",
                     "text-destructive hover:bg-destructive/10"
                   )}
                 >
                   <Power className="w-5 h-5" aria-hidden="true" />
                 </button>
               </TooltipTrigger>
               <TooltipContent side="right" sideOffset={12} className="font-medium">
                 Keluar
               </TooltipContent>
             </Tooltip>
           ) : (
             <div className="space-y-1">
               <button
                 ref={logoutBtnExpandedRef}
                 onClick={handleLogout}
                 onMouseEnter={() => handleGSAPHover(logoutBtnExpandedRef.current, true, { scale: 1.01 })}
                 onMouseLeave={() => handleGSAPHover(logoutBtnExpandedRef.current, false)}
                 onMouseDown={() => handleGSAPPress(logoutBtnExpandedRef.current, true)}
                 onMouseUp={() => handleGSAPPress(logoutBtnExpandedRef.current, false)}
                 className={cn(
                   "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all touch-manipulation min-h-[40px]",
                   "text-destructive hover:bg-destructive/10"
                 )}
               >
                 <Power className="w-5 h-5 shrink-0" aria-hidden="true" />
                 <span ref={logoutTextRef} className="truncate flex-1 text-left">Keluar</span>
               </button>
               
               <p ref={ctrlHintRef} className="hidden lg:block text-[9px] text-muted-foreground/50 text-center pb-0.5 overflow-hidden">
                 <kbd className="px-1 py-0.5 bg-muted/50 rounded text-[8px] font-mono">Ctrl+B</kbd> toggle
               </p>
             </div>
           )}
         </div>
       </aside>
 
       {/* Spacer for sidebar on desktop */}
       <div
         className={cn(
           "hidden lg:block shrink-0 transition-all duration-300 ease-out",
           sidebarCollapsed ? "w-[72px]" : "w-[260px]"
         )}
       />
 
       {/* Main content wrapper */}
       <div className="flex-1 flex flex-col min-w-0">
         {/* Mobile header */}
          <header className="lg:hidden sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border shadow-sm safe-area-inset">
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
             
             <div className="flex items-center gap-1 sm:gap-1.5">
                <GlobalSearchTrigger onClick={() => setShowGlobalSearch(true)} />
                <NotificationDropdown />
               <button
                 ref={avatarTriggerRef}
                 onClick={() => setShowMiniProfile(!showMiniProfile)}
                 onMouseEnter={() => handleGSAPHover(avatarTriggerRef.current, true)}
                 onMouseLeave={() => handleGSAPHover(avatarTriggerRef.current, false)}
                 onMouseDown={() => handleGSAPPress(avatarTriggerRef.current, true)}
                 onMouseUp={() => handleGSAPPress(avatarTriggerRef.current, false)}
                 className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 touch-manipulation"
                 aria-label="Buka menu profil"
                 aria-expanded={showMiniProfile}
               >
                 <Avatar className="h-8 w-8 sm:h-9 sm:w-9 cursor-pointer ring-2 ring-transparent hover:ring-primary/50 transition-all">
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
         <header className="hidden lg:flex sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border shadow-sm items-center justify-between px-6 h-14">
            <HeaderYearDisplay variant="desktop" />
           
           <div className="flex items-center gap-2">
              <GlobalSearchTrigger onClick={() => setShowGlobalSearch(true)} />
              <NotificationDropdown />
             <button
               ref={(el) => {
                 // On desktop, point triggerRef to this button
                 // On mobile the ref is set above. The last one rendered wins,
                 // but we handle it via a callback to set the ref correctly.
                 if (el && window.innerWidth >= 1024) {
                   (avatarTriggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = el;
                 }
               }}
               onClick={() => setShowMiniProfile(!showMiniProfile)}
               onMouseEnter={(e) => handleGSAPHover(e.currentTarget, true)}
               onMouseLeave={(e) => handleGSAPHover(e.currentTarget, false)}
               onMouseDown={(e) => handleGSAPPress(e.currentTarget, true)}
               onMouseUp={(e) => handleGSAPPress(e.currentTarget, false)}
               className="rounded-full focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
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
         <main className="flex-1 overflow-x-hidden" role="main" aria-label="Konten utama">
           {children}
         </main>
 
          {/* Footer */}
          <Footer />
          <GlobalSearch open={showGlobalSearch} onOpenChange={setShowGlobalSearch} />
        </div>
     </div>
   );
 }

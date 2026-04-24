import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAuth } from "@/contexts/AuthContext";
import { useEnhancedToast } from "@/contexts/ToastContext";
import { supabaseExternal as supabase } from "@/lib/supabase-external";
import {
  Moon,
  Sun,
  Settings,
  LogOut,
  User,
  Shield,
  HelpCircle,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import gsap from "gsap";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface MiniProfilePopupProps {
  isOpen: boolean;
  onClose: () => void;
  avatarUrl: string | null;
  userInitials: string;
  triggerRef: React.RefObject<HTMLElement>;
}

export function MiniProfilePopup({
  isOpen,
  onClose,
  avatarUrl,
  userInitials,
  triggerRef,
}: MiniProfilePopupProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { success, error: showError } = useEnhancedToast();
  const popupRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const menuItemsRef = useRef<HTMLDivElement[]>([]);
  const avatarRef = useRef<HTMLDivElement>(null);
  
  const [darkMode, setDarkMode] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const [isMobile, setIsMobile] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  const prefersReducedMotion = useReducedMotion();
  const duration = prefersReducedMotion ? 0.01 : 0.25;

  // Check if mobile - ONLY use viewport width, not ontouchstart
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Initialize dark mode from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(savedTheme === "dark" || (!savedTheme && prefersDark));
  }, []);

  // Calculate position relative to trigger (desktop only)
  useEffect(() => {
    if (isOpen && triggerRef.current && !isMobile) {
      const rect = triggerRef.current.getBoundingClientRect();
      const padding = 8;
      setPosition({
        top: rect.bottom + padding,
        right: Math.max(8, window.innerWidth - rect.right),
      });
    }
  }, [isOpen, triggerRef, isMobile]);

  // GSAP entrance/exit animation (desktop only)
  useEffect(() => {
    if (isMobile) {
      setIsVisible(isOpen);
      return;
    }

    if (isOpen) {
      setIsVisible(true);
      
      // Reset refs array
      menuItemsRef.current = menuItemsRef.current.filter(Boolean);
      
      requestAnimationFrame(() => {
        // Animate backdrop
        if (backdropRef.current) {
          gsap.fromTo(backdropRef.current,
            { opacity: 0 },
            { opacity: 1, duration: duration * 0.6, ease: "power2.out" }
          );
        }

        // Animate popup container
        if (popupRef.current) {
          gsap.fromTo(popupRef.current,
            { opacity: 0, scale: 0.92, y: -12 },
            { 
              opacity: 1, 
              scale: 1, 
              y: 0, 
              duration,
              ease: "back.out(1.7)"
            }
          );
        }

        // Stagger menu items
        const validItems = menuItemsRef.current.filter(Boolean);
        if (validItems.length > 0) {
          gsap.fromTo(validItems,
            { opacity: 0, x: -15 },
            { 
              opacity: 1, 
              x: 0, 
              duration: duration * 0.8,
              stagger: 0.035,
              delay: 0.08,
              ease: "back.out(1.5)"
            }
          );
        }

        // Animate avatar with bounce
        if (avatarRef.current) {
          gsap.fromTo(avatarRef.current,
            { scale: 0.7, opacity: 0, rotation: -10 },
            { 
              scale: 1, 
              opacity: 1, 
              rotation: 0,
              duration: duration * 1.2,
              delay: 0.05,
              ease: "back.out(2.5)"
            }
          );
        }
      });
    } else if (isVisible) {
      // Exit animation
      const tl = gsap.timeline({
        onComplete: () => setIsVisible(false)
      });

      if (popupRef.current) {
        tl.to(popupRef.current, {
          opacity: 0,
          scale: 0.96,
          y: -8,
          duration: duration * 0.5,
          ease: "power2.in"
        }, 0);
      }

      if (backdropRef.current) {
        tl.to(backdropRef.current, {
          opacity: 0,
          duration: duration * 0.4,
          ease: "power2.in"
        }, 0);
      }
    }
  }, [isOpen, isMobile, duration, isVisible]);

  // Close on click outside (desktop only)
  useEffect(() => {
    if (!isOpen || isMobile) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !triggerRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };

    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose, triggerRef, isMobile]);

  // Close on escape
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  const toggleDarkMode = useCallback(() => {
    const newValue = !darkMode;
    setDarkMode(newValue);
    if (newValue) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [darkMode]);

  const handleSignOut = useCallback(async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    onClose();
    
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('supabase') || 
          key.includes('sb-') || 
          key.includes('auth') ||
          key.includes('token')
        )) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      sessionStorage.clear();
      
      document.cookie.split(";").forEach((c) => {
        const eqPos = c.indexOf("=");
        const name = eqPos > -1 ? c.substring(0, eqPos).trim() : c.trim();
        if (name.includes('sb-') || name.includes('supabase')) {
          document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
        }
      });
      
      await supabase.auth.signOut({ scope: 'global' });
      await signOut();
      
      success("Berhasil Keluar", "Anda telah berhasil logout dari akun.");
      window.location.href = "/auth";
      
    } catch (err) {
      console.error("Logout exception:", err);
      showError("Gagal Keluar", "Terjadi kesalahan. Halaman akan di-refresh.");
      localStorage.clear();
      sessionStorage.clear();
      setTimeout(() => {
        window.location.href = "/auth";
      }, 1000);
    }
  }, [isLoggingOut, onClose, signOut, success, showError]);

  const handleNavigate = useCallback((path: string) => {
    onClose();
    setTimeout(() => {
      navigate(path);
    }, 80);
  }, [navigate, onClose]);

  // GSAP hover for menu items
  const handleItemHover = useCallback((el: HTMLElement | null, isEntering: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, {
      x: isEntering ? 4 : 0,
      scale: isEntering ? 1.01 : 1,
      duration: 0.15,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  const handleItemPress = useCallback((el: HTMLElement | null, isPressed: boolean) => {
    if (!el || prefersReducedMotion) return;
    gsap.to(el, {
      scale: isPressed ? 0.97 : 1,
      duration: 0.1,
      ease: "power2.out"
    });
  }, [prefersReducedMotion]);

  // Register menu item ref
  const addMenuItemRef = useCallback((el: HTMLDivElement | null, index: number) => {
    if (el) menuItemsRef.current[index] = el;
  }, []);

  if (!isOpen && !isVisible) return null;

  // Menu content shared between mobile drawer and desktop popup
  const MenuContent = () => (
    <div ref={contentRef}>
      {/* Header with user info */}
      <div className="relative p-4 bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 80%, hsl(var(--primary) / 0.15) 0%, transparent 50%), radial-gradient(circle at 80% 20%, hsl(var(--accent) / 0.15) 0%, transparent 50%)",
          }}
        />
        
        <div className="flex items-center gap-3 relative">
          <div ref={avatarRef}>
            <Avatar className="h-14 w-14 border-2 border-primary/20 shadow-lg">
              <AvatarImage src={avatarUrl || undefined} alt="Foto profil" />
              <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg font-bold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
          </div>
          
          <div className="flex-1 min-w-0 pr-8">
            <p className="font-semibold text-foreground truncate">
              {user?.user_metadata?.full_name || "Pengguna"}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {/* Menu items */}
      <div className="p-2">
        {/* Theme Toggle */}
        <div
          ref={(el) => addMenuItemRef(el, 0)}
          className="w-full flex items-center justify-between px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer min-h-[48px]"
          onClick={(e) => { e.stopPropagation(); toggleDarkMode(); }}
          onKeyDown={(e) => e.key === 'Enter' && toggleDarkMode()}
          onPointerEnter={(e) => handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          role="button"
          tabIndex={0}
          aria-label="Toggle mode gelap"
        >
          <div className="flex items-center gap-3">
            {darkMode ? (
              <Moon className="w-5 h-5 text-highlight-moon" />
            ) : (
              <Sun className="w-5 h-5 text-highlight-sun" />
            )}
            <span className="font-medium text-sm">Mode Gelap</span>
          </div>
          <Switch
            checked={darkMode}
            onCheckedChange={(checked) => {
              // Direct handler for Switch component
              setDarkMode(checked);
              if (checked) {
                document.documentElement.classList.add("dark");
                localStorage.setItem("theme", "dark");
              } else {
                document.documentElement.classList.remove("dark");
                localStorage.setItem("theme", "light");
              }
            }}
          />
        </div>

        <Separator className="my-1" />

        {/* Profil Saya */}
        <div
          ref={(el) => addMenuItemRef(el, 1)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer min-h-[48px]"
          onClick={() => handleNavigate("/settings/profile")}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate("/settings/profile")}
          onPointerEnter={(e) => handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          onPointerDown={(e) => handleItemPress(e.currentTarget, true)}
          onPointerUp={(e) => handleItemPress(e.currentTarget, false)}
          role="button"
          tabIndex={0}
        >
          <User className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">Profil Saya</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>

        {/* Keamanan Akun */}
        <div
          ref={(el) => addMenuItemRef(el, 2)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer min-h-[48px]"
          onClick={() => handleNavigate("/settings/profile#security-section")}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate("/settings/profile#security-section")}
          onPointerEnter={(e) => handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          onPointerDown={(e) => handleItemPress(e.currentTarget, true)}
          onPointerUp={(e) => handleItemPress(e.currentTarget, false)}
          role="button"
          tabIndex={0}
        >
          <Shield className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">Keamanan Akun</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>

        {/* Pengaturan */}
        <div
          ref={(el) => addMenuItemRef(el, 3)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer min-h-[48px]"
          onClick={() => handleNavigate("/settings")}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate("/settings")}
          onPointerEnter={(e) => handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          onPointerDown={(e) => handleItemPress(e.currentTarget, true)}
          onPointerUp={(e) => handleItemPress(e.currentTarget, false)}
          role="button"
          tabIndex={0}
        >
          <Settings className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">Pengaturan</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>

        {/* Bantuan */}
        <div
          ref={(el) => addMenuItemRef(el, 4)}
          className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-muted/50 active:bg-muted transition-colors cursor-pointer min-h-[48px]"
          onClick={() => handleNavigate("/help")}
          onKeyDown={(e) => e.key === 'Enter' && handleNavigate("/help")}
          onPointerEnter={(e) => handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          onPointerDown={(e) => handleItemPress(e.currentTarget, true)}
          onPointerUp={(e) => handleItemPress(e.currentTarget, false)}
          role="button"
          tabIndex={0}
        >
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
          <span className="font-medium text-sm flex-1">Bantuan</span>
          <ChevronRight className="w-4 h-4 text-muted-foreground/50" />
        </div>

        <Separator className="my-1" />

        {/* Logout */}
        <div
          ref={(el) => addMenuItemRef(el, 5)}
          className={cn(
            "w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-destructive/10 active:bg-destructive/20 transition-colors cursor-pointer min-h-[48px]",
            isLoggingOut && "opacity-50 cursor-not-allowed"
          )}
          onClick={() => !isLoggingOut && handleSignOut()}
          onKeyDown={(e) => e.key === 'Enter' && !isLoggingOut && handleSignOut()}
          onPointerEnter={(e) => !isLoggingOut && handleItemHover(e.currentTarget, true)}
          onPointerLeave={(e) => handleItemHover(e.currentTarget, false)}
          role="button"
          tabIndex={isLoggingOut ? -1 : 0}
          aria-label="Keluar dari akun"
        >
          {isLoggingOut ? (
            <Loader2 className="w-5 h-5 text-destructive animate-spin" />
          ) : (
            <LogOut className="w-5 h-5 text-destructive" />
          )}
          <span className="font-medium text-sm text-destructive">
            {isLoggingOut ? "Keluar..." : "Keluar"}
          </span>
        </div>
      </div>
    </div>
  );

  // Mobile: Use Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>Menu Profil</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto pb-safe">
            <MenuContent />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use positioned popup with GSAP animation
  return (
    <>
      {/* Backdrop */}
      <div
        ref={backdropRef}
        className="fixed inset-0 z-[9998]"
        onClick={onClose}
        aria-hidden="true"
        style={{ opacity: 0 }}
      />

      {/* Popup */}
      <div
        ref={popupRef}
        className="fixed z-[9999] w-72 max-w-[calc(100vw-1rem)] bg-card border rounded-xl shadow-2xl overflow-hidden"
        style={{
          top: position.top,
          right: position.right,
          opacity: 0,
        }}
        role="dialog"
        aria-label="Menu profil"
      >
        <MenuContent />
      </div>
    </>
  );
}

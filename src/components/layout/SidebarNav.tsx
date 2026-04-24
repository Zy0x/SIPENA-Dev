import { useRef, useEffect, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import gsap from "gsap";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, ChevronDown, Sparkles } from "lucide-react";
import { useReducedMotion } from "@/hooks/useReducedMotion";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isBeta?: boolean;
  children?: NavItem[];
}

// ─── Collapsed (icon-only) nav item ───
interface CollapsedNavItemProps {
  item: NavItem;
  isActive: boolean;
  onNavigate: (e: React.MouseEvent, href: string, hasChildren: boolean) => void;
  onMobileClose: () => void;
}

export function CollapsedNavItem({ item, isActive, onNavigate, onMobileClose }: CollapsedNavItemProps) {
  const itemRef = useRef<HTMLAnchorElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const dur = prefersReducedMotion ? 0.01 : 0.2;

  const handleEnter = useCallback(() => {
    if (itemRef.current && !prefersReducedMotion) {
      gsap.to(itemRef.current, { scale: 1.06, duration: dur, ease: "power2.out" });
    }
  }, [prefersReducedMotion, dur]);

  const handleLeave = useCallback(() => {
    if (itemRef.current) gsap.to(itemRef.current, { scale: 1, duration: dur * 0.7, ease: "power2.out" });
  }, [dur]);

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <Link
          ref={itemRef}
          to={item.href}
          data-sidebar-nav-item="true"
          onClick={(e) => onNavigate(e, item.href, !!item.children)}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          className="relative block touch-manipulation"
        >
          <div className={cn(
            "flex items-center justify-center w-11 h-11 mx-auto rounded-[13px] transition-colors relative",
            "min-w-[44px] min-h-[44px]",
            isActive
              ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
          )}>
            <item.icon className="w-[20px] h-[20px]" aria-hidden="true" />
          </div>
          {item.isBeta && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-status-connecting rounded-full" />
          )}
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={12} className="font-medium text-xs px-3 py-1.5 rounded-lg">
        <div className="flex items-center gap-2">
          {item.label}
          {item.isBeta && (
            <Badge variant="outline" className="text-[9px] px-1 py-0 border-status-connecting/50 text-status-connecting">
              <Sparkles className="w-2 h-2 mr-0.5" />Beta
            </Badge>
          )}
        </div>
        {item.children && (
          <div className="mt-1.5 pt-1.5 border-t border-border/50 space-y-1">
            {item.children.map(child => (
              <Link key={child.href} to={child.href}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground py-0.5"
                onClick={onMobileClose}>
                <child.icon className="w-3 h-3" />{child.label}
              </Link>
            ))}
          </div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Expanded nav item (iOS Settings style) ───
interface ExpandedNavItemProps {
  item: NavItem;
  isActive: boolean;
  isExpanded: boolean;
  onNavigate: (e: React.MouseEvent, href: string, hasChildren: boolean) => void;
  onToggleMenu: (href: string, e?: React.MouseEvent) => void;
  onMobileClose: () => void;
}

export function ExpandedNavItem({ item, isActive, isExpanded, onNavigate, onToggleMenu, onMobileClose }: ExpandedNavItemProps) {
  const location = useLocation();
  const hasChildren = item.children && item.children.length > 0;
  const prefersReducedMotion = useReducedMotion();
  const dur = prefersReducedMotion ? 0.01 : 0.2;

  const rowRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLDivElement>(null);
  const submenuRef = useRef<HTMLUListElement>(null);
  const childRefs = useRef<(HTMLLIElement | null)[]>([]);

  // Consolidated GSAP submenu effect — handles both mount and transitions
  const isMountedRef = useRef(false);
  const prevExpandedRef = useRef(isExpanded);

  useEffect(() => {
    if (!submenuRef.current || !arrowRef.current) return;

    if (!isMountedRef.current) {
      // First mount — set state instantly without animation
      isMountedRef.current = true;
      if (isExpanded) {
        gsap.set(submenuRef.current, { display: "block", height: "auto", opacity: 1 });
        gsap.set(arrowRef.current, { rotation: 180 });
      } else {
        gsap.set(submenuRef.current, { display: "none", height: 0, opacity: 0 });
        gsap.set(arrowRef.current, { rotation: 0 });
      }
      prevExpandedRef.current = isExpanded;
      return;
    }

    // Only animate when isExpanded actually changes
    if (prevExpandedRef.current === isExpanded) return;
    prevExpandedRef.current = isExpanded;

    // Animate chevron rotation
    gsap.to(arrowRef.current, { rotation: isExpanded ? 180 : 0, duration: dur * 1.2, ease: "power2.inOut" });

    // Animate submenu expand/collapse
    if (isExpanded) {
      gsap.set(submenuRef.current, { display: "block", height: "auto" });
      const h = submenuRef.current.scrollHeight;
      gsap.fromTo(submenuRef.current,
        { height: 0, opacity: 0 },
        {
          height: h, opacity: 1, duration: dur * 1.5, ease: "power3.out",
          onComplete: () => { if (submenuRef.current) gsap.set(submenuRef.current, { height: "auto" }); }
        }
      );
      if (!prefersReducedMotion) {
        childRefs.current.forEach((c, i) => {
          if (c) gsap.fromTo(c, { opacity: 0, x: -8 }, { opacity: 1, x: 0, duration: dur, delay: i * 0.03, ease: "power2.out" });
        });
      }
    } else {
      gsap.to(submenuRef.current, {
        height: 0, opacity: 0, duration: dur, ease: "power2.in",
        onComplete: () => { if (submenuRef.current) gsap.set(submenuRef.current, { display: "none" }); }
      });
    }
  }, [isExpanded, dur, prefersReducedMotion]);

  // Hover – subtle iOS-like highlight
  const handleEnter = useCallback(() => {
    if (rowRef.current && !isActive && !prefersReducedMotion) {
      gsap.to(rowRef.current, { x: 2, duration: dur, ease: "power2.out" });
    }
  }, [isActive, prefersReducedMotion, dur]);

  const handleLeave = useCallback(() => {
    if (rowRef.current && !isActive) gsap.to(rowRef.current, { x: 0, duration: dur * 0.7, ease: "power2.out" });
  }, [isActive, dur]);

  const handleChildHover = useCallback((el: HTMLLIElement | null, enter: boolean) => {
    if (el && !prefersReducedMotion) gsap.to(el, { x: enter ? 3 : 0, duration: dur * 0.7, ease: "power2.out" });
  }, [prefersReducedMotion, dur]);

  return (
    <div className="relative">
      {/* Unified row container – single rounded box for both link + chevron */}
      <div className={cn(
        "flex items-center rounded-[13px] transition-colors overflow-hidden",
        "min-h-[44px]",
        isActive
          ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
          : "text-foreground/75 hover:bg-muted/50 hover:text-foreground"
      )}>
        <Link to={item.href} data-sidebar-nav-item="true"
          onClick={(e) => {
            onNavigate(e, item.href, !!hasChildren);
          }}
          onMouseEnter={handleEnter} onMouseLeave={handleLeave}
          className="flex-1 block touch-manipulation"
        >
          <div ref={rowRef} className="flex items-center gap-3 px-3 py-2.5 text-[13px] font-medium relative">
            {/* Icon container – iOS-style rounded square */}
            <div className={cn(
              "w-[30px] h-[30px] rounded-[8px] flex items-center justify-center flex-shrink-0 transition-colors",
              isActive
                ? "bg-white/20"
                : "bg-muted/60"
            )}>
              <item.icon className="w-[16px] h-[16px]" aria-hidden="true" />
            </div>
            <span className="truncate flex-1">{item.label}</span>
            {item.isBeta && (
              <Badge variant="outline" className={cn(
                "text-[9px] px-1.5 py-0 gap-0.5 shrink-0",
                isActive ? "border-white/40 text-white" : "border-status-connecting/50 text-status-connecting"
              )}>
                <Sparkles className="w-2 h-2" />Beta
              </Badge>
            )}
            {isActive && !item.isBeta && !hasChildren && (
              <ChevronRight className="w-4 h-4 shrink-0 opacity-70" aria-hidden="true" />
            )}
          </div>
        </Link>

        {hasChildren && (
          <button onClick={(e) => onToggleMenu(item.href, e)}
            className={cn(
              "flex items-center justify-center w-10 min-h-[44px] touch-manipulation transition-colors",
              isActive
                ? "text-primary-foreground hover:bg-white/10"
                : "text-muted-foreground hover:bg-muted/40"
            )}
            aria-label={isExpanded ? "Tutup submenu" : "Buka submenu"}
          >
            <div ref={arrowRef}><ChevronDown className="w-3.5 h-3.5" /></div>
          </button>
        )}
      </div>

      {hasChildren && (
        <ul
          ref={submenuRef}
          className="mt-0.5 ml-5 space-y-0.5 border-l-[1.5px] border-border/30 pl-3 overflow-hidden"
          // Tidak ada inline style display/height di sini.
          // State awal dikendalikan sepenuhnya oleh GSAP mount effect di atas,
          // sehingga tidak ada konflik antara React dan GSAP.
        >
          {item.children!.map((child, idx) => {
            const childPath = child.href.split('#')[0];
            const childHash = child.href.includes('#') ? child.href.split('#')[1] : null;
            const isChildActive = childHash
              ? (location.pathname === childPath && location.hash === `#${childHash}`)
              : location.pathname === child.href;
            return (
              <li key={child.href} ref={el => { childRefs.current[idx] = el; }}
                onMouseEnter={(e) => handleChildHover(e.currentTarget, true)}
                onMouseLeave={(e) => handleChildHover(e.currentTarget, false)}
              >
                <Link to={child.href} onClick={(e) => {
                    e.stopPropagation();
                    if (window.innerWidth < 1024) onMobileClose();
                  }} className="block">
                  <div className={cn(
                    "flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-xs font-medium transition-colors",
                    isChildActive ? "bg-primary/12 text-primary" : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                  )}>
                    <child.icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">{child.label}</span>
                    {isChildActive && <ChevronRight className="w-3 h-3 shrink-0 ml-auto opacity-60" />}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

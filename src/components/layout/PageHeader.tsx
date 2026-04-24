import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({ icon, title, subtitle, breadcrumbs, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("animate-fade-in space-y-1.5", className)}>
      {/* Breadcrumb */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-[10px] sm:text-xs text-muted-foreground overflow-x-auto scrollbar-none">
          <Link to="/dashboard" className="flex items-center gap-1 hover:text-foreground transition-colors shrink-0">
            <Home className="w-3 h-3" />
            <span className="hidden sm:inline">Beranda</span>
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1 shrink-0">
              <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
              {crumb.href ? (
                <Link to={crumb.href} className="hover:text-foreground transition-colors truncate max-w-[120px]">
                  {crumb.label}
                </Link>
              ) : (
                <span className="text-foreground font-medium truncate max-w-[120px]">{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-[12px] bg-primary/10 flex items-center justify-center flex-shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-bold text-foreground truncate">{title}</h1>
            {subtitle && (
              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

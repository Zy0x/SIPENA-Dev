import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  limit: number;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  className?: string;
}

const LIMIT_OPTIONS = [5, 10, 15, 20, 25, 50, 100, 500, 1000, -1]; // -1 = Semua

export function PaginationControls({
  currentPage,
  totalPages,
  totalItems,
  limit,
  onPageChange,
  onLimitChange,
  className,
}: PaginationControlsProps) {
  const isShowAll = limit === -1 || limit >= totalItems;
  const effectiveLimit = isShowAll ? totalItems : limit;
  const effectiveTotalPages = isShowAll ? 1 : totalPages;
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * effectiveLimit + 1;
  const endItem = isShowAll ? totalItems : Math.min(currentPage * effectiveLimit, totalItems);

  // Smart pagination: show max 5 page buttons with ellipsis
  const getPageNumbers = (): (number | "...")[] => {
    if (effectiveTotalPages <= 7) return Array.from({ length: effectiveTotalPages }, (_, i) => i + 1);

    const pages: (number | "...")[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", effectiveTotalPages);
    } else if (currentPage >= effectiveTotalPages - 2) {
      pages.push(1, "...", effectiveTotalPages - 3, effectiveTotalPages - 2, effectiveTotalPages - 1, effectiveTotalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", effectiveTotalPages);
    }
    return pages;
  };

  if (totalItems === 0) return null;

  return (
    <div className={cn("flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-1", className)}>
      {/* Info text */}
      <p className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap order-2 sm:order-1">
        {isShowAll
          ? `Menampilkan semua ${totalItems.toLocaleString("id-ID")} siswa`
          : `Menampilkan ${startItem}–${endItem} dari ${totalItems.toLocaleString("id-ID")} siswa`
        }
      </p>

      {/* Controls */}
      <div className="flex items-center gap-2 order-1 sm:order-2 flex-wrap justify-center">
        {/* Limit selector */}
        <Select value={limit.toString()} onValueChange={(v) => onLimitChange(Number(v))}>
          <SelectTrigger className="h-8 w-[80px] text-xs rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt.toString()} className="text-xs">
                {opt === -1 ? "Semua" : opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Navigation buttons — hidden when showing all */}
        {!isShowAll && (
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => onPageChange(1)}
              disabled={currentPage <= 1}
              aria-label="Halaman pertama"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              aria-label="Halaman sebelumnya"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>

            {/* Page numbers */}
            <div className="flex items-center gap-0.5">
              {getPageNumbers().map((page, idx) =>
                page === "..." ? (
                  <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-muted-foreground">
                    …
                  </span>
                ) : (
                  <Button
                    key={page}
                    variant={page === currentPage ? "default" : "ghost"}
                    size="icon"
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-medium",
                      page === currentPage && "shadow-sm"
                    )}
                    onClick={() => onPageChange(page)}
                  >
                    {page}
                  </Button>
                )
              )}
            </div>

            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= effectiveTotalPages}
              aria-label="Halaman berikutnya"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={() => onPageChange(effectiveTotalPages)}
              disabled={currentPage >= effectiveTotalPages}
              aria-label="Halaman terakhir"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

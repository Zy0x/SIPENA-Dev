import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 sm:p-4 space-y-3 ${className}`}>
      <div className="flex items-center gap-3">
        <Skeleton className="w-9 h-9 rounded-xl" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <Skeleton className="h-2 w-full" />
    </div>
  );
}

export function SkeletonStatsGrid() {
  return (
    <div className="grid grid-cols-4 gap-1.5 sm:gap-2 lg:gap-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-card p-2 sm:p-3 lg:p-4 space-y-2">
          <Skeleton className="w-8 h-8 rounded-xl" />
          <Skeleton className="h-5 w-10" />
          <Skeleton className="h-2.5 w-12" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-1">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2 sm:p-3">
          <Skeleton className="w-7 h-7 rounded-full" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="h-2 w-20" />
          </div>
          <Skeleton className="h-7 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-0.5">
      <div className="flex gap-0.5 p-2">
        {[...Array(cols)].map((_, i) => (
          <Skeleton key={i} className="h-6 flex-1 rounded" />
        ))}
      </div>
      {[...Array(rows)].map((_, r) => (
        <div key={r} className="flex gap-0.5 p-1.5">
          {[...Array(cols)].map((_, c) => (
            <Skeleton key={c} className="h-5 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  );
}

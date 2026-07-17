import { Skeleton } from "@/components/ui/skeleton"

export function SkeletonRequestList({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-2">
        <Skeleton variant="shimmer" className="h-8 w-24 rounded-full" />
        <Skeleton variant="shimmer" className="h-8 w-20 rounded-full" />
      </div>

      <div className="flex flex-col divide-y divide-border rounded-md border border-border bg-card">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <Skeleton variant="shimmer" className="h-9 w-9 shrink-0 rounded-full" />
              <div className="flex flex-col gap-1.5">
                <Skeleton variant="shimmer" className="h-[13px] w-32" />
                <Skeleton variant="shimmer" className="h-[13px] w-48" />
                <Skeleton variant="shimmer" className="h-[22px] w-20 rounded-full" />
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Skeleton variant="shimmer" className="h-3 w-16" />
              <Skeleton variant="shimmer" className="h-9 w-28 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

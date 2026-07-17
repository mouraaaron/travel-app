import { Skeleton } from "@/components/ui/skeleton"

const STATUS_FILTER_COUNT = 6
const ROW_COUNT = 6

export default function RequestsLoading() {
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Minhas solicitações</h1>
        <Skeleton variant="shimmer" className="h-10 w-[150px] rounded-md" />
      </div>

      <div className="flex flex-wrap gap-2">
        {Array.from({ length: STATUS_FILTER_COUNT }, (_, i) => (
          <Skeleton key={i} variant="shimmer" className="h-[26px] w-24 rounded-full" />
        ))}
      </div>

      <div className="flex flex-col divide-y divide-border rounded-md border border-border">
        {Array.from({ length: ROW_COUNT }, (_, i) => (
          <div
            key={i}
            className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
          >
            <div className="flex flex-col gap-1.5">
              <Skeleton variant="shimmer" className="h-[13px] w-32" />
              <Skeleton variant="shimmer" className="h-[11px] w-40" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <Skeleton variant="shimmer" className="h-[13px] w-20" />
              <Skeleton variant="shimmer" className="h-[13px] w-16" />
              <Skeleton variant="shimmer" className="h-[22px] w-24 rounded-full" />
              <Skeleton variant="shimmer" className="h-[11px] w-28" />
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Skeleton variant="shimmer" className="h-9 w-28 rounded-sm" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

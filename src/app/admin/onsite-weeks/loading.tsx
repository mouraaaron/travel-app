import { SkeletonTable } from "@/components/admin/skeleton-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function OnsiteWeeksLoading() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Semanas Presenciais</h1>
        <Skeleton variant="shimmer" className="h-9 w-[220px] rounded-sm" />
      </div>

      <SkeletonTable
        withCard={false}
        rows={6}
        columns={[
          { widthClassName: "w-[16%]" },
          { widthClassName: "w-[20%]" },
          { widthClassName: "w-[12%]" },
          { widthClassName: "w-[14%]" },
        ]}
      />
    </div>
  )
}

import { SkeletonTable } from "@/components/admin/skeleton-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function EmployeesLoading() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Funcionários</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Skeleton variant="shimmer" className="h-10 w-[280px] rounded-md" />
        <Skeleton variant="shimmer" className="h-10 w-[150px] rounded-md" />
        <Skeleton variant="shimmer" className="h-10 w-[150px] rounded-md" />
        <Skeleton variant="shimmer" className="h-10 w-[150px] rounded-md" />
      </div>

      <SkeletonTable
        withCard={false}
        rows={6}
        columns={[
          { widthClassName: "w-[22%]" },
          { widthClassName: "w-[16%]" },
          { widthClassName: "w-[12%]" },
        ]}
      />
    </div>
  )
}

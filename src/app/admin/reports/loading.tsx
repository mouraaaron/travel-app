import { SkeletonTable } from "@/components/admin/skeleton-table"

export default function ReportsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Relatórios</h1>

      <SkeletonTable
        withCard
        titleWidthClassName="w-44"
        rows={6}
        columns={[{ widthClassName: "w-[20%]" }, { widthClassName: "w-[14%]" }, { widthClassName: "w-[14%]" }]}
      />
    </div>
  )
}

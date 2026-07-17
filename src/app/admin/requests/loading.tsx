import { SkeletonRequestList } from "@/components/admin/skeleton-request-list"

export default function RequestsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Solicitações</h1>
      <SkeletonRequestList rows={6} />
    </div>
  )
}

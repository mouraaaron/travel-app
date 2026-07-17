import { SkeletonFieldGroup } from "@/components/admin/skeleton-field-group"
import { Skeleton } from "@/components/ui/skeleton"

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold text-foreground">Configurações</h1>

      <div className="flex flex-col gap-1.5">
        <Skeleton variant="shimmer" className="h-[18px] w-64" />
        <Skeleton variant="shimmer" className="h-[13px] w-full max-w-md" />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }, (_, i) => (
          <SkeletonFieldGroup key={i} fields={4} />
        ))}
      </div>
    </div>
  )
}

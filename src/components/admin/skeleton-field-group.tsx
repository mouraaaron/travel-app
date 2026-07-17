import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function SkeletonFieldGroup({ fields = 4 }: { fields?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton variant="shimmer" className="h-4 w-32" />
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {Array.from({ length: fields }, (_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton variant="shimmer" className="h-3 w-1/2" />
            <Skeleton variant="shimmer" className="h-10 w-full rounded-md" />
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

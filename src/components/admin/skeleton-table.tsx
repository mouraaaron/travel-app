import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

interface SkeletonTableColumn {
  widthClassName: string
}

interface SkeletonTableProps {
  rows?: number
  withCard?: boolean
  titleWidthClassName?: string
  columns: SkeletonTableColumn[]
}

function SkeletonTableRows({ rows, columns }: { rows: number; columns: SkeletonTableColumn[] }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }, (_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 py-3.5 first:pt-0 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-border"
        >
          <Skeleton variant="shimmer" className="h-8 w-8 shrink-0 rounded-full" />
          {columns.map((column, columnIndex) => (
            <Skeleton key={columnIndex} variant="shimmer" className={`h-[13px] ${column.widthClassName}`} />
          ))}
          <Skeleton variant="shimmer" className="ml-auto h-[22px] w-[70px] shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonTable({ rows = 6, withCard = true, titleWidthClassName = "w-40", columns }: SkeletonTableProps) {
  if (!withCard) {
    return <SkeletonTableRows rows={rows} columns={columns} />
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Skeleton variant="shimmer" className={`h-4 ${titleWidthClassName}`} />
        </CardTitle>
      </CardHeader>
      <CardContent>
        <SkeletonTableRows rows={rows} columns={columns} />
      </CardContent>
    </Card>
  )
}

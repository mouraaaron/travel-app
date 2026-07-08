"use client"

import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse [animation-duration:var(--pulse-dur)] rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

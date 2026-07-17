"use client"

import { cn } from "@/lib/utils"

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "pulse" | "shimmer"
}

function Skeleton({ className, variant = "pulse", ...props }: SkeletonProps) {
  if (variant === "shimmer") {
    return <div className={cn("rounded-md t-admin-skeleton-shimmer", className)} {...props} />
  }

  return (
    <div
      className={cn("animate-pulse [animation-duration:var(--pulse-dur)] rounded-md bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }

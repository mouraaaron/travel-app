"use client"

import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-sm text-sm font-medium ring-offset-background transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        success:
          "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-sm px-3",
        lg: "h-11 rounded-sm px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export type ButtonVariant = NonNullable<VariantProps<typeof buttonVariants>["variant"]>

/**
 * Which sweep color reads correctly over each variant's background:
 * light band for colored/dark fills, dark band for light/transparent ones.
 */
export const SWEEP_TONE: Record<ButtonVariant, "light" | "dark"> = {
  default: "light",
  destructive: "light",
  secondary: "light",
  success: "light",
  outline: "dark",
  ghost: "dark",
  link: "dark",
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, asChild = false, loading = false, disabled, children, ...props },
    ref
  ) => {
    const Comp = asChild ? Slot : "button"
    // Slot renders its single child as-is, so the sweep (an extra sibling)
    // can only be injected for real <button> elements.
    const showSweep = loading && !asChild
    const tone = SWEEP_TONE[variant ?? "default"]

    return (
      <Comp
        className={cn(
          buttonVariants({ variant, size, className }),
          showSweep && "relative overflow-hidden"
        )}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {showSweep ? (
          <>
            <span
              aria-hidden="true"
              className={cn(
                "t-button-sweep",
                tone === "light" ? "t-button-sweep--light" : "t-button-sweep--dark"
              )}
            />
            <span className="relative z-[2]">{children}</span>
          </>
        ) : (
          children
        )}
      </Comp>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

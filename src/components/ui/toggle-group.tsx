"use client"

import * as React from "react"
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group"
import { type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { toggleVariants } from "@/components/ui/toggle"
import { useSpringPill } from "@/components/ui/use-spring-pill"

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants> & { pill?: boolean }
>({
  size: "default",
  variant: "default",
  pill: false,
})

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root> &
    VariantProps<typeof toggleVariants> & {
      /**
       * Renders a spring-animated pill behind the selected item instead of each
       * item painting its own background on selection. Only meaningful for
       * `type="single"` groups. Defaults to `false`.
       */
      pill?: boolean
    }
>(({ className, variant, size, pill = false, orientation, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const { pillRef, sync } = useSpringPill(orientation === "vertical" ? "vertical" : "horizontal")

  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref]
  )

  React.useLayoutEffect(() => {
    if (!pill) return
    const list = listRef.current
    if (!list) return

    const findActive = () => list.querySelector<HTMLElement>('[data-state="on"]')

    const waitForActiveAndSnap = (attempt = 0) => {
      const active = findActive()
      if (!active && attempt < 60) {
        requestAnimationFrame(() => waitForActiveAndSnap(attempt + 1))
        return
      }
      sync(active, true)
    }
    const raf = requestAnimationFrame(() => waitForActiveAndSnap())

    const mo = new MutationObserver(() => sync(findActive(), false))
    list
      .querySelectorAll("[data-state]")
      .forEach((el) => mo.observe(el, { attributes: true, attributeFilter: ["data-state"] }))

    const ro = new ResizeObserver(() => sync(findActive(), false))
    ro.observe(list)

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pill])

  return (
    <ToggleGroupPrimitive.Root
      ref={setRefs}
      orientation={orientation}
      className={cn(
        "flex gap-1",
        orientation === "vertical" ? "flex-col items-stretch" : "items-center justify-center",
        pill && "relative p-1",
        className
      )}
      {...props}
    >
      {pill && (
        <span
          ref={(node) => {
            pillRef.current = node
          }}
          aria-hidden="true"
          className="pointer-events-none absolute left-1 top-1 z-0 rounded-md bg-accent opacity-0"
        />
      )}
      <ToggleGroupContext.Provider value={{ variant, size, pill }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive.Root>
  )
})

ToggleGroup.displayName = ToggleGroupPrimitive.Root.displayName

const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> &
    VariantProps<typeof toggleVariants>
>(({ className, children, variant, size, ...props }, ref) => {
  const context = React.useContext(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      ref={ref}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        context.pill &&
          "relative z-10 bg-transparent hover:bg-transparent data-[state=on]:bg-transparent",
        className
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
})
ToggleGroupItem.displayName = ToggleGroupPrimitive.Item.displayName

export { ToggleGroup, ToggleGroupItem }

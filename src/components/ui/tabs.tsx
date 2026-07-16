"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"
import { useSpringPill } from "@/components/ui/use-spring-pill"

const Tabs = TabsPrimitive.Root

type TabsIndicatorMode = "underline" | "pill" | "none"

function normalizeIndicator(indicator: boolean | TabsIndicatorMode): TabsIndicatorMode {
  if (indicator === true) return "underline"
  if (indicator === false) return "none"
  return indicator
}

const TabsIndicatorContext = React.createContext<TabsIndicatorMode>("underline")

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * "underline" (default) renders a sliding underline that tweens between the
   * active trigger's position and width (transitions-dev "tabs sliding", 250ms /
   * cubic-bezier(0.22,1,0.36,1)). "pill" renders a spring-animated pill behind
   * the active trigger instead (segmented-control spring transition spec,
   * docs/superpowers/specs/2026-07-16-segmented-control-spring-transition-design.md).
   * "none" renders neither — each trigger paints its own active background
   * instead (default shadcn look). `true`/`false` are accepted as aliases for
   * "underline"/"none" for backward compatibility with existing call sites.
   */
  indicator?: boolean | TabsIndicatorMode
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, indicator = "underline", children, ...props }, ref) => {
  const mode = normalizeIndicator(indicator)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const barRef = React.useRef<HTMLSpanElement | null>(null)
  const { pillRef, sync: syncPill } = useSpringPill("horizontal")

  // Merge the forwarded ref with our internal measuring ref.
  const setRefs = React.useCallback(
    (node: HTMLDivElement | null) => {
      listRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref)
        (ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    },
    [ref]
  )

  // Underline mode: existing CSS-transition-driven bar (unchanged behavior).
  React.useLayoutEffect(() => {
    if (mode !== "underline") return
    const list = listRef.current
    const bar = barRef.current
    if (!list || !bar) return

    const move = (animate: boolean) => {
      const active = list.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]'
      )
      if (!active) {
        bar.style.opacity = "0"
        return
      }
      const left = active.offsetLeft
      const width = active.offsetWidth
      if (!animate) {
        const prev = bar.style.transition
        bar.style.transition = "none"
        bar.style.transform = `translateX(${left}px)`
        bar.style.width = `${width}px`
        bar.style.opacity = "1"
        void bar.offsetWidth
        bar.style.transition = prev
      } else {
        bar.style.transform = `translateX(${left}px)`
        bar.style.width = `${width}px`
        bar.style.opacity = "1"
      }
    }

    const raf = requestAnimationFrame(() => move(false))

    let lastChangeAt = 0
    const mo = new MutationObserver(() => {
      lastChangeAt = performance.now()
      move(true)
    })
    list
      .querySelectorAll('[role="tab"]')
      .forEach((t) =>
        mo.observe(t, { attributes: true, attributeFilter: ["data-state"] })
      )

    let lastWidth = list.offsetWidth
    const ro = new ResizeObserver(() => {
      const w = list.offsetWidth
      if (w === lastWidth) return
      lastWidth = w
      move(performance.now() - lastChangeAt < 400)
    })
    ro.observe(list)

    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => move(false)).catch(() => {})
    }

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // Pill mode: spring-animated pill (segmented control spring transition spec).
  React.useLayoutEffect(() => {
    if (mode !== "pill") return
    const list = listRef.current
    if (!list) return

    const findActive = () =>
      list.querySelector<HTMLElement>('[role="tab"][data-state="active"]')

    const waitForActiveAndSnap = (attempt = 0) => {
      const active = findActive()
      if (!active && attempt < 60) {
        requestAnimationFrame(() => waitForActiveAndSnap(attempt + 1))
        return
      }
      syncPill(active, true)
    }
    const raf = requestAnimationFrame(() => waitForActiveAndSnap())

    const mo = new MutationObserver(() => syncPill(findActive(), false))
    list
      .querySelectorAll('[role="tab"]')
      .forEach((t) =>
        mo.observe(t, { attributes: true, attributeFilter: ["data-state"] })
      )

    const ro = new ResizeObserver(() => syncPill(findActive(), false))
    ro.observe(list)

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  return (
    <TabsIndicatorContext.Provider value={mode}>
      <TabsPrimitive.List
        ref={setRefs}
        className={cn(
          "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
          mode !== "none" && "relative [&_[role=tab]]:!border-b-transparent",
          className
        )}
        {...props}
      >
        {mode === "pill" && (
          <span
            ref={(node) => {
              pillRef.current = node
            }}
            aria-hidden="true"
            className="pointer-events-none absolute left-1 top-1 z-0 rounded-sm bg-background opacity-0 shadow-sm"
          />
        )}
        {children}
        {mode === "underline" && (
          <span
            ref={barRef}
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-0 rounded-full bg-[#18181b] opacity-0 [transition-property:transform,width,opacity] [transition-duration:var(--tabs-dur)] [transition-timing-function:var(--tabs-ease)] [will-change:transform,width] motion-reduce:!transition-none"
          />
        )}
      </TabsPrimitive.List>
    </TabsIndicatorContext.Provider>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => {
  const mode = React.useContext(TabsIndicatorContext)
  return (
    <TabsPrimitive.Trigger
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:text-foreground",
        mode !== "pill" && "data-[state=active]:bg-background data-[state=active]:shadow-sm",
        mode === "pill" && "relative z-10",
        className
      )}
      {...props}
    />
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }

"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"

import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  /**
   * Renders a sliding underline indicator that tweens between the active
   * trigger's position and width (transitions-dev "tabs sliding", 250ms /
   * cubic-bezier(0.22,1,0.36,1)). Defaults to `true`, matching this repo's
   * house underline-tab style. Set `false` for the default pill segmented
   * control (e.g. status filter tabs) where the per-tab background already
   * signals the active option.
   */
  indicator?: boolean
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, indicator = true, children, ...props }, ref) => {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const barRef = React.useRef<HTMLSpanElement | null>(null)

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

  React.useLayoutEffect(() => {
    if (!indicator) return
    const list = listRef.current
    const bar = barRef.current
    if (!list || !bar) return

    // Write the active tab's offsetLeft / offsetWidth onto the bar. When
    // `animate` is false we suspend the transition and force a reflow so the
    // bar snaps into place (first paint, resize, font load) instead of
    // sliding in from translateX(0) / width:0.
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

    // Snap to the active tab once layout settles.
    const raf = requestAnimationFrame(() => move(false))

    // Slide whenever Radix flips data-state on a trigger (tab change). Stamp
    // the time so the resize handler below knows an animation is in flight.
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

    // Container resize. A tab change can itself change the page height and
    // toggle the scrollbar, which resizes this w-full list — so a plain snap
    // here would stomp the slide. Only hard-snap on a real resize; if a tab
    // change just fired, re-place WITH animation so the slide survives.
    let lastWidth = list.offsetWidth
    const ro = new ResizeObserver(() => {
      const w = list.offsetWidth
      if (w === lastWidth) return
      lastWidth = w
      move(performance.now() - lastChangeAt < 400)
    })
    ro.observe(list)

    // Poligon loads async — re-snap once metrics settle so the bar width
    // matches the final tab widths.
    if (typeof document !== "undefined" && "fonts" in document) {
      document.fonts.ready.then(() => move(false)).catch(() => {})
    }

    return () => {
      cancelAnimationFrame(raf)
      mo.disconnect()
      ro.disconnect()
    }
    // Run once per indicator toggle; the observers handle subsequent changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicator])

  return (
    <TabsPrimitive.List
      ref={setRefs}
      className={cn(
        "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
        // Indicator mode: position context + hide the per-trigger static
        // underline so only the single sliding bar is visible.
        indicator && "relative [&_[role=tab]]:!border-b-transparent",
        className
      )}
      {...props}
    >
      {children}
      {indicator && (
        <span
          ref={barRef}
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-px left-0 h-0.5 w-0 rounded-full bg-[#18181b] opacity-0 [transition-property:transform,width,opacity] [transition-duration:var(--tabs-dur)] [transition-timing-function:var(--tabs-ease)] [will-change:transform,width] motion-reduce:!transition-none"
        />
      )}
    </TabsPrimitive.List>
  )
})
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-[color,background-color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
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

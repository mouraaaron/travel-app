# Segmented Control Spring Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the instant/CSS-only selection highlight on four mutually-exclusive button groups (trip type, two admin `Tabs` groups, and a results-page sort selector) with a physics-based spring "pill" that tracks the selected option and preserves velocity across rapid clicks.

**Architecture:** A pure physics function `stepSpring` (`src/lib/spring.ts`) is wrapped by a `useSpringPill` hook (`src/components/ui/use-spring-pill.ts`) that mutates a pill `<span>`'s inline style directly inside a `requestAnimationFrame` loop (no per-frame React re-render). `ToggleGroup` (`src/components/ui/toggle-group.tsx`) and `TabsList` (`src/components/ui/tabs.tsx`) — both already Radix-based, already providing keyboard nav and ARIA — are extended to optionally render this pill behind the selected item instead of each item painting its own background. Four call sites opt in; one of them (`results/page.tsx`'s sort selector) is converted from native radio inputs to `ToggleGroup` as part of opting in.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Tailwind + `class-variance-authority`, Radix UI (`@radix-ui/react-toggle-group`, `@radix-ui/react-tabs`), Vitest (`environment: "node"`, no jsdom/React Testing Library installed).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-16-segmented-control-spring-transition-design.md`. Physics constants are fixed: `stiffness = 520`, `damping = 38`, `mass = 1`, frame `dt` clamped to `0.032`s, settle threshold `|velocity| < 0.02 && |value - target| < 0.02` on every animated scalar.
- **No new dependencies.** Framer Motion is already installed but deliberately not used here (see spec §"Decisions made with the user", point 2) — do not import it in any file touched by this plan.
- **No new colors/tokens.** The pill reuses `bg-accent` (plain `ToggleGroup` groups) or `bg-background shadow-sm` (`Tabs` groups with a `bg-muted` track) — exactly what the selected state already renders today, just moved into one shared, animated element.
- Selection state must never reset velocity on a new click mid-flight — this is the whole point of the exercise. Only the very first mount measurement (before any button geometry exists) and `prefers-reduced-motion` snap without animating.
- This repo has **no jsdom / React Testing Library** (`vitest.config.ts` uses `environment: "node"`; the only existing UI-directory test, `src/components/ui/button.test.ts`, tests plain extracted data, not DOM/rendering). Do not add that infrastructure. Real Vitest unit tests apply only to `src/lib/spring.ts` (pure, DOM-free). Every other file in this plan is verified with `npx tsc --noEmit` plus a manual `npm run dev` pass.
- Radix (`ToggleGroupPrimitive`, `TabsPrimitive`) keeps owning keyboard navigation, focus, and ARIA roles throughout — no custom keyboard handling is added anywhere in this plan.
- Scope is exactly the four call sites listed in the design spec. Do not touch the multi-select status filter chips in `requests-list.tsx` or any other control the spec explicitly excluded.
- Commit after each task (or logical sub-step within a task) using this repo's existing Conventional Commits style (`feat:`), matching `git log`.

---

### Task 1: Spring physics engine

**Files:**
- Create: `src/lib/spring.ts`
- Create: `src/lib/spring.test.ts`

**Interfaces:**
- Produces: `SpringScalar` (`{ value: number; velocity: number; target: number }`), `createSpringScalar(value: number): SpringScalar`, `stepSpring(s: SpringScalar, dt: number, stiffness?: number, damping?: number, mass?: number): boolean` (mutates `s` in place, returns whether it has settled). Consumed by Task 2's `useSpringPill`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/spring.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createSpringScalar, stepSpring } from "./spring";

describe("stepSpring", () => {
  it("converges to the target and reports settled", () => {
    const scalar = createSpringScalar(0);
    scalar.target = 100;

    let settled = false;
    for (let i = 0; i < 500 && !settled; i++) {
      settled = stepSpring(scalar, 1 / 60);
    }

    expect(settled).toBe(true);
    expect(scalar.value).toBeCloseTo(100, 0);
  });

  it("preserves velocity when the target changes mid-flight instead of resetting it", () => {
    const scalar = createSpringScalar(0);
    scalar.target = 100;
    for (let i = 0; i < 5; i++) stepSpring(scalar, 1 / 60);

    const velocityBeforeRetarget = scalar.velocity;
    expect(velocityBeforeRetarget).not.toBe(0);

    // Simulate a new click landing before the pill finishes animating to the
    // previous target — this must not zero the velocity.
    scalar.target = 250;

    expect(scalar.velocity).toBe(velocityBeforeRetarget);
  });

  it("settles immediately when created already at its target", () => {
    const scalar = createSpringScalar(50);
    const settled = stepSpring(scalar, 1 / 60);

    expect(settled).toBe(true);
    expect(scalar.value).toBe(50);
    expect(scalar.velocity).toBe(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/spring.test.ts`
Expected: FAIL — `Cannot find module './spring'` (the module doesn't exist yet).

- [ ] **Step 3: Implement `spring.ts`**

Create `src/lib/spring.ts`:

```ts
export interface SpringScalar {
  value: number;
  velocity: number;
  target: number;
}

export function createSpringScalar(value: number): SpringScalar {
  return { value, velocity: 0, target: value };
}

// Advances one scalar by dt (seconds; callers must pre-clamp to <=0.032 per
// the handoff spec so slow/tab-switched frames don't overshoot). Mutates `s`
// in place and returns whether it has settled on its target.
export function stepSpring(
  s: SpringScalar,
  dt: number,
  stiffness = 520,
  damping = 38,
  mass = 1
): boolean {
  const force = -stiffness * (s.value - s.target);
  const dampingForce = -damping * s.velocity;
  s.velocity += ((force + dampingForce) / mass) * dt;
  s.value += s.velocity * dt;
  return Math.abs(s.velocity) < 0.02 && Math.abs(s.value - s.target) < 0.02;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/spring.test.ts`
Expected: PASS — 3 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/spring.ts src/lib/spring.test.ts
git commit -m "feat: add spring physics engine for segmented control pill"
```

---

### Task 2: `useSpringPill` hook

**Files:**
- Create: `src/components/ui/use-spring-pill.ts`

**Interfaces:**
- Consumes: `createSpringScalar`, `stepSpring` from `src/lib/spring.ts` (Task 1).
- Produces: `useSpringPill(orientation?: "horizontal" | "vertical"): { pillRef: React.MutableRefObject<HTMLElement | null>; sync: (activeEl: HTMLElement | null, snap: boolean) => void }`. Consumed by Task 3 (`ToggleGroup`) and Task 4 (`TabsList`).

- [ ] **Step 1: Create the hook**

Create `src/components/ui/use-spring-pill.ts`:

```ts
"use client";

import * as React from "react";
import { createSpringScalar, stepSpring, type SpringScalar } from "@/lib/spring";

export type SpringPillOrientation = "horizontal" | "vertical";

interface PillSprings {
  main: SpringScalar; // left (horizontal) / top (vertical)
  mainSize: SpringScalar; // width (horizontal) / height (vertical)
  crossSize: SpringScalar; // height (horizontal) / width (vertical)
}

interface UseSpringPillResult {
  pillRef: React.MutableRefObject<HTMLElement | null>;
  /**
   * Call on mount (once the active element is measurable, `snap: true`), on
   * every selection change (`snap: false`), and from a resize observer
   * (`snap: false`, so a resize mid-flight doesn't kill velocity). Pass
   * `null` when nothing is selected (hides the pill).
   */
  sync: (activeEl: HTMLElement | null, snap: boolean) => void;
}

export function useSpringPill(
  orientation: SpringPillOrientation = "horizontal"
): UseSpringPillResult {
  const pillRef = React.useRef<HTMLElement | null>(null);
  const springsRef = React.useRef<PillSprings | null>(null);
  const rafRef = React.useRef<number | null>(null);
  const lastTRef = React.useRef<number | null>(null);

  const applyStyle = React.useCallback(() => {
    const pill = pillRef.current;
    const springs = springsRef.current;
    if (!pill || !springs) return;
    if (orientation === "horizontal") {
      pill.style.left = `${springs.main.value}px`;
      pill.style.width = `${springs.mainSize.value}px`;
      pill.style.height = `${springs.crossSize.value}px`;
    } else {
      pill.style.top = `${springs.main.value}px`;
      pill.style.height = `${springs.mainSize.value}px`;
      pill.style.width = `${springs.crossSize.value}px`;
    }
  }, [orientation]);

  const ensureLoop = React.useCallback(() => {
    if (rafRef.current !== null) return;
    lastTRef.current = performance.now();
    const step = (t: number) => {
      const springs = springsRef.current;
      if (!springs) {
        rafRef.current = null;
        return;
      }
      const dt = Math.min((t - (lastTRef.current ?? t)) / 1000, 0.032);
      lastTRef.current = t;
      const settledMain = stepSpring(springs.main, dt);
      const settledMainSize = stepSpring(springs.mainSize, dt);
      const settledCrossSize = stepSpring(springs.crossSize, dt);
      applyStyle();
      if (settledMain && settledMainSize && settledCrossSize) {
        rafRef.current = null;
        return;
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
  }, [applyStyle]);

  const sync = React.useCallback(
    (activeEl: HTMLElement | null, snap: boolean) => {
      const pill = pillRef.current;
      if (!pill) return;
      if (!activeEl) {
        pill.style.opacity = "0";
        return;
      }

      const main = orientation === "horizontal" ? activeEl.offsetLeft : activeEl.offsetTop;
      const mainSize =
        orientation === "horizontal" ? activeEl.offsetWidth : activeEl.offsetHeight;
      const crossSize =
        orientation === "horizontal" ? activeEl.offsetHeight : activeEl.offsetWidth;

      if (!springsRef.current) {
        springsRef.current = {
          main: createSpringScalar(main),
          mainSize: createSpringScalar(mainSize),
          crossSize: createSpringScalar(crossSize),
        };
      }
      const springs = springsRef.current;
      springs.main.target = main;
      springs.mainSize.target = mainSize;
      springs.crossSize.target = crossSize;

      const prefersReducedMotion =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (snap || prefersReducedMotion) {
        springs.main.value = main;
        springs.main.velocity = 0;
        springs.mainSize.value = mainSize;
        springs.mainSize.velocity = 0;
        springs.crossSize.value = crossSize;
        springs.crossSize.velocity = 0;
        applyStyle();
        pill.style.opacity = "1";
        return;
      }

      pill.style.opacity = "1";
      ensureLoop();
    },
    [orientation, applyStyle, ensureLoop]
  );

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return { pillRef, sync };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0). The hook isn't consumed anywhere yet, so this only confirms it's internally type-correct.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/use-spring-pill.ts
git commit -m "feat: add useSpringPill hook for segmented control pill animation"
```

---

### Task 3: `ToggleGroup` pill support, wired into the trip type selector

**Files:**
- Modify: `src/components/ui/toggle-group.tsx`
- Modify: `src/components/trip/search-criteria-form.tsx:116-132`

**Interfaces:**
- Consumes: `useSpringPill` (Task 2).
- Produces: `ToggleGroup` gains `pill?: boolean` (default `false`) and forwards `orientation?: "horizontal" | "vertical"` to Radix. Consumed by Task 5 (results-page sort selector).

- [ ] **Step 1: Replace `toggle-group.tsx`**

Replace the full contents of `src/components/ui/toggle-group.tsx`:

```tsx
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

interface ToggleGroupProps
  extends React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>,
    VariantProps<typeof toggleVariants> {
  /**
   * Renders a spring-animated pill behind the selected item instead of each
   * item painting its own background on selection. Only meaningful for
   * `type="single"` groups. Defaults to `false`.
   */
  pill?: boolean
}

const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  ToggleGroupProps
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 3: Manually verify no regression on the trip type selector (pill not yet wired)**

Run: `npm run dev`, open `/` (the trip search page), confirm "Ida e volta / Só ida / Multi-cidade" still renders and switches exactly as before (instant background highlight — `pill` defaults to `false`, so nothing should look different yet).

- [ ] **Step 4: Commit the component change**

```bash
git add src/components/ui/toggle-group.tsx
git commit -m "feat: add pill spring animation support to ToggleGroup"
```

- [ ] **Step 5: Wire `pill` into the trip type selector**

In `src/components/trip/search-criteria-form.tsx`, the `ToggleGroup` currently reads (lines 116–132):

```tsx
                    <ToggleGroup
                      type="single"
                      value={field.value}
                      onValueChange={(next) => {
                        if (!next) return;
                        field.onChange(next);
                        if (next !== "multi_city") {
                          const first = form.getValues("slices")[0];
                          form.setValue("slices", [first]);
                        }
                      }}
                      className="justify-start"
                    >
                      <ToggleGroupItem value="round_trip">Ida e volta</ToggleGroupItem>
                      <ToggleGroupItem value="one_way">Só ida</ToggleGroupItem>
                      <ToggleGroupItem value="multi_city">Multi-cidade</ToggleGroupItem>
                    </ToggleGroup>
```

Change the opening tag to add `pill`:

```tsx
                    <ToggleGroup
                      type="single"
                      pill
                      value={field.value}
                      onValueChange={(next) => {
                        if (!next) return;
                        field.onChange(next);
                        if (next !== "multi_city") {
                          const first = form.getValues("slices")[0];
                          form.setValue("slices", [first]);
                        }
                      }}
                      className="justify-start"
                    >
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 7: Manually verify the pill animation**

Run: `npm run dev`, open `/`, and on the trip type control:
- Click between "Ida e volta", "Só ida", and "Multi-cidade" — a pill should slide/resize between them instead of each button instantly repainting.
- Click rapidly back and forth several times (mash-click) — the pill should not visibly stutter or restart from a standstill on each click.
- Resize the browser window while the pill is mid-flight — it should re-measure without snapping or freezing.
- In OS/browser settings, enable "reduce motion", reload, and click between options — the pill should jump directly to the target with no animation.

- [ ] **Step 8: Commit the call-site change**

```bash
git add src/components/trip/search-criteria-form.tsx
git commit -m "feat: animate trip type selector pill with spring physics"
```

---

### Task 4: `Tabs` pill indicator mode, wired into the admin queue and employee detail tabs

**Files:**
- Modify: `src/components/ui/tabs.tsx`
- Modify: `src/components/admin/requests-queue.tsx:55`
- Modify: `src/components/admin/employee-detail.tsx:29`

**Interfaces:**
- Consumes: `useSpringPill` (Task 2).
- Produces: `TabsList`'s `indicator` prop widens from `boolean` to `boolean | "underline" | "pill" | "none"` (boolean values still accepted; `true` behaves as `"underline"`, `false` as `"none"`).

- [ ] **Step 1: Replace `tabs.tsx`**

Replace the full contents of `src/components/ui/tabs.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 3: Commit the component change**

```bash
git add src/components/ui/tabs.tsx
git commit -m "feat: add pill indicator mode to TabsList"
```

- [ ] **Step 4: Wire `indicator=\"pill\"` into the admin requests queue**

In `src/components/admin/requests-queue.tsx:55`, change:

```tsx
          <TabsList indicator={false}>
```

to:

```tsx
          <TabsList indicator="pill">
```

- [ ] **Step 5: Wire `indicator=\"pill\"` into the employee detail tabs**

In `src/components/admin/employee-detail.tsx:29`, change:

```tsx
      <TabsList indicator={false}>
```

to:

```tsx
      <TabsList indicator="pill">
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 7: Manually verify both admin tab groups**

Run: `npm run dev`, sign in as admin (or use whatever the repo's demo login is), then:
- Open `/admin/requests` — click between "Pendentes" and "Todas"; a pill should slide between them (same white/`bg-background` look as before, now animated), including on rapid clicks.
- Open any `/admin/employees/[id]` detail page — click between "Todas", "Gasto mensal", and "Desvios de política"; same pill behavior across three options.
- Confirm the underline-style `Tabs` elsewhere in the app (if any are found while testing) are unaffected — this repo currently has none in active use beyond these two files, but the default (`indicator` unset) must still render the old sliding underline if some other page adds one later.

- [ ] **Step 8: Commit the call-site changes**

```bash
git add src/components/admin/requests-queue.tsx src/components/admin/employee-detail.tsx
git commit -m "feat: animate admin tab indicators with spring physics"
```

---

### Task 5: Convert the results-page sort selector to a vertical pill `ToggleGroup`

**Files:**
- Modify: `src/app/(app)/results/page.tsx:1-67`

**Interfaces:**
- Consumes: `ToggleGroup`/`ToggleGroupItem` with `pill` + `orientation="vertical"` (Task 3).

- [ ] **Step 1: Add the import**

In `src/app/(app)/results/page.tsx`, the import block currently reads (in part):

```tsx
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { OfferCard } from "@/components/trip/offer-card";
```

Add the new import between `Switch` and `OfferCard`:

```tsx
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { OfferCard } from "@/components/trip/offer-card";
```

- [ ] **Step 2: Replace the radio list with a vertical pill `ToggleGroup`**

The "Ordenar por" block currently reads (lines 57–67):

```tsx
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Ordenar por</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {(["price", "duration", "departure"] as const).map((key) => (
            <label key={key} className="flex items-center gap-2">
              <input type="radio" name="sort" checked={sortKey === key} onChange={() => onSortKeyChange(key)} />
              {key === "price" ? "Preço" : key === "duration" ? "Duração" : "Horário de partida"}
            </label>
          ))}
        </div>
      </div>
```

Replace it with:

```tsx
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Ordenar por</p>
        <ToggleGroup
          type="single"
          pill
          orientation="vertical"
          value={sortKey}
          onValueChange={(next) => {
            if (!next) return;
            onSortKeyChange(next as SortKey);
          }}
        >
          <ToggleGroupItem value="price" className="justify-start">
            Preço
          </ToggleGroupItem>
          <ToggleGroupItem value="duration" className="justify-start">
            Duração
          </ToggleGroupItem>
          <ToggleGroupItem value="departure" className="justify-start">
            Horário de partida
          </ToggleGroupItem>
        </ToggleGroup>
      </div>
```

`SortKey` is already declared at the top of this file (`type SortKey = "price" | "duration" | "departure";`) — no new type needed.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no output (exit code 0).

- [ ] **Step 4: Manually verify**

Run: `npm run dev`, perform a search so `/results` has offers, open the filters panel (desktop sidebar or the mobile `Sheet`), and on "Ordenar por":
- Click between "Preço", "Duração", and "Horário de partida" — a pill should slide vertically between the three full-width rows.
- Confirm the results list actually re-sorts on each click (unchanged `sortKey` wiring — this is a regression check, not new behavior).
- Confirm "Horário de partida" doesn't wrap or overflow the filters panel width.
- Mash-click between all three rapidly and confirm no jank/reset.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/results/page.tsx"
git commit -m "feat: convert results sort selector to vertical pill ToggleGroup"
```

---

### Task 6: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the 3 new `src/lib/spring.test.ts` cases from Task 1.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors (pre-existing warnings unrelated to this change, if any, are fine).

- [ ] **Step 3: Run a full build**

Run: `npm run build`
Expected: build succeeds. This catches type errors across page boundaries that `tsc --noEmit` alone can miss in Next.js.

- [ ] **Step 4: Manual end-to-end pass across all four controls**

Run: `npm run dev` and, in one pass:
1. `/` — trip type selector: click through all 3 options, mash-click, resize mid-animation.
2. `/admin/requests` — queue tabs: click through both options, mash-click.
3. `/admin/employees/[id]` — detail tabs: click through all 3 options, mash-click.
4. `/results` — sort selector: click through all 3 options, mash-click, confirm no wrap on "Horário de partida".
5. Enable OS "reduce motion", reload each page above, and confirm every pill snaps instantly with no animation.

- [ ] **Step 5: Commit only if any fixes were needed during this pass**

If Steps 1–4 required any code changes, commit them individually with `fix:` messages describing what was wrong. If everything passed as-is, there is nothing to commit for this task.

---

## Self-Review Notes

- **Spec coverage:** All 4 call sites (trip type, admin queue tabs, employee detail tabs, sort selector) are covered (Tasks 3–5); the shared spring engine and hook match the handoff's physics and mount-timing/resize/reduced-motion requirements (Tasks 1–2); no new dependency or token is introduced anywhere (Global Constraints); testing follows the repo's existing pure-logic-only convention (Task 1, Global Constraints).
- **Type consistency:** `stepSpring`/`createSpringScalar`/`SpringScalar` (Task 1) are used with identical names and shapes in `useSpringPill` (Task 2); `useSpringPill`'s `{ pillRef, sync }` return shape is used identically in both `toggle-group.tsx` (Task 3) and `tabs.tsx` (Task 4); `TabsList`'s `indicator` prop type change is backward-compatible (`boolean` still accepted) so no other existing call site (there are none besides the two migrated here) can break.
- **No placeholders:** every step above shows the complete resulting code, not a description of it.

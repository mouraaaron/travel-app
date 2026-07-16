# Segmented control spring transition — design

## Context

Design handoff (`Spring transition implementation.zip` → `design_handoff_segmented_control/`)
defines a pill-style segmented control where the selection highlight ("pill") tracks
the selected option using physics-based spring motion instead of a CSS transition —
so it preserves velocity across rapid/overlapping clicks instead of restarting from
zero each time.

A codebase sweep found four mutually-exclusive "mode selector" button groups that
this behavior applies to, across the traveler and admin flows. Three already render
as a row of buttons; one is currently a vertical list of native radio inputs and
needs its markup changed to fit the pattern.

## Handoff spec (source of truth for behavior fidelity)

- Pill is an absolutely-positioned element sitting behind the option buttons
  (`z-index: 0`), sized/positioned to match the selected button's
  `offsetLeft/offsetWidth/offsetHeight`.
- Spring integration, per animated scalar (`left`/`top`, `width`, `height`),
  independently, run on `requestAnimationFrame`:
  ```
  stiffness = 520, damping = 38, mass = 1
  // dt clamped to 32ms per frame so slow/tab-switched frames don't overshoot
  force        = -stiffness * (value - target)
  dampingForce = -damping * velocity
  acceleration = (force + dampingForce) / mass
  velocity    += acceleration * dt
  value       += velocity * dt
  ```
  Settles (loop stops) once `|velocity| < 0.02` and `|value - target| < 0.02` for
  every animated scalar; restarts automatically next time a target changes.
- **Critical behavior**: a new click mid-animation does not reset velocity to zero —
  the pill's current velocity carries into the new target calculation. This is what
  makes rapid/mashed clicking feel continuous instead of jerky.
- **Mount-timing gotcha**: the first snap (placing the pill on the initially-selected
  button, no animation) must wait until the button DOM elements are actually laid out
  before reading their geometry — measuring synchronously on mount reads zero-size
  elements and the pill never recovers. Defer via polling `requestAnimationFrame`.
- Re-measure on window `resize` without resetting velocity.

## Decisions made with the user

1. **Scope — 4 call sites** (see table below): trip type selector, admin requests
   queue tabs, employee detail tabs, and the results-page sort selector. The sort
   selector is currently native `<input type="radio">` stacked vertically and gets
   converted to a button-based control as part of this work — everything else keeps
   its current markup.
2. **Implementation approach — hand-rolled spring, no Framer Motion.** Framer Motion
   is already a dependency, but only loaded on `/admin/onsite-weeks/[id]` and
   `/admin/reports` today. Using it here would add its runtime weight to three routes
   that don't currently ship it — including `/`, the traveler-facing search page,
   likely the app's highest-traffic route. Porting the reference integrator by hand
   keeps this consistent with the rest of the app's motion work (`transitions.css`),
   which is 100% hand-rolled with no animation library, and adds zero new dependency
   weight anywhere.
3. **Architecture — extend existing primitives, don't replace them.** `ToggleGroup`
   (`@radix-ui/react-toggle-group`) and `Tabs` (`@radix-ui/react-tabs`) already
   provide roving-tabindex keyboard navigation and correct ARIA roles for these
   exact interaction patterns. Rather than building a new custom component (which
   would mean reimplementing that accessibility from scratch), the spring pill is
   added as a decorative overlay on top of these two existing primitives — the same
   shape as `TabsList`'s current sliding-underline indicator, generalized and
   upgraded from CSS-transition to spring physics.
4. **Visual variants — no new colors/tokens.** The pill re-uses whatever color the
   selected state already has at each call site:
   - Admin `Tabs` (already have a `bg-muted` track): pill becomes `bg-background
     shadow-sm`, identical to today's active-tab look, just as one sliding element
     instead of each trigger painting its own background.
   - `ToggleGroup` (no track): pill becomes `bg-accent`, identical to today's
     `data-[state=on]:bg-accent`, just animated instead of instant.
5. **Orientation.** The sort selector stays a vertical stack (avoids wrapping on the
   long "Horário de partida" label in the narrow filters panel) — its pill animates
   `top`/`height` with `left`/`width` fixed to the container's inner bounds. The
   other three stay horizontal, animating `left`/`width` with `top`/`height` per the
   handoff.

## Shared spring engine

New file `src/lib/spring.ts` — pure, DOM-free physics, extracted the same way
`SWEEP_TONE` was pulled out of `button.tsx` for isolated unit testing:

```ts
export interface SpringScalar {
  value: number;
  velocity: number;
  target: number;
}

export function createSpringScalar(value: number): SpringScalar {
  return { value, velocity: 0, target: value };
}

// Advances one scalar by dt (seconds, expected pre-clamped to <=0.032 by the
// caller's rAF loop). Returns true once value/velocity have settled on target.
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

`stepSpring` mutates in place and returns its own settled flag; a caller animating
several scalars together (e.g. `left`+`width`+`height`) is settled only once every
scalar reports settled — matching the handoff's "loop stops once all scalars in a
group are settled" rule.

## `useSpringPill` hook

New file `src/components/ui/use-spring-pill.ts`, shared by both `ToggleGroup` and
`Tabs`. Unlike the reference prototype (which drives the pill through React
`setState` every frame), the hook mutates the pill element's inline style directly
via a ref inside the rAF loop — the same technique `tabs.tsx`'s existing indicator
already uses for its CSS-transitioned bar (`bar.style.transform = ...`). This avoids
a React re-render on every animation frame while producing an identical visual
result.

```ts
function useSpringPill(orientation: "horizontal" | "vertical" = "horizontal"): {
  containerRef: React.RefObject<HTMLElement>;
  pillRef: React.RefObject<HTMLElement>;
  sync: (activeEl: HTMLElement | null, snap: boolean) => void;
};
```

- `sync(activeEl, snap)` is called: once on mount (deferred via the
  `requestAnimationFrame`-polling snap technique — `snap: true`), on every
  selection change (`snap: false`), and from a `ResizeObserver` on the container
  (`snap: false`, so a resize during flight doesn't kill the pill's velocity).
- Reads `offsetLeft/offsetTop/offsetWidth/offsetHeight` off `activeEl`; for
  `orientation="horizontal"` it drives `left`/`width`/`height` (top fixed); for
  `"vertical"` it drives `top`/`height`/`width` (left fixed).
- Runs the same `stiffness=520, damping=38` integration as `spring.ts`, once per
  frame, applying `Math.min(dt, 0.032)`.
- Checks `window.matchMedia("(prefers-reduced-motion: reduce)")` once per `sync`
  call: when reduced motion is preferred, it snaps the pill straight to the target
  with no animation frames at all — the JS equivalent of the `@media
  (prefers-reduced-motion: reduce)` guard every other block in `transitions.css`
  ships with, adapted because this motion is JS-driven rather than a CSS keyframe.

## `ToggleGroup` changes

`src/components/ui/toggle-group.tsx`:
- New `pill?: boolean` prop on `ToggleGroup` (default `false`, opt-in — the
  component is used elsewhere in the design system for plain checkbox-style
  toggling where a sliding pill wouldn't make sense).
- New `orientation?: "horizontal" | "vertical"` prop, forwarded to
  `ToggleGroupPrimitive.Root` (Radix already handles arrow-key direction based on
  this) and to `useSpringPill`.
- When `pill` is true: renders the pill `<span aria-hidden>` absolutely positioned
  behind the items (`bg-accent`, rounded to match `toggleVariants`' radius), wires
  `useSpringPill`'s `sync` to a `MutationObserver` watching each item's
  `data-state` attribute (same mechanism `tabs.tsx` already uses), and suppresses
  `ToggleGroupItem`'s own `data-[state=on]:bg-accent` (text-color transition only,
  `transition-colors`) so the pill is the only thing that visually moves.
- Container needs `position: relative` and `p-1` padding added when `pill` is true
  (matches the handoff's 4px container padding and gives the pill room to render
  inside the group's bounds).

## `Tabs` changes

`src/components/ui/tabs.tsx`:
- `TabsList`'s `indicator` prop changes from `boolean` to
  `"underline" | "pill" | "none"` (boolean `true`/`false` still accepted and mapped
  to `"underline"`/`"none"` respectively, so no existing call site breaks by
  default — though both current call sites explicitly pass `false` today and will
  be migrated to `"pill"` as part of this change, per the table below).
- `"pill"` mode reuses the same `useSpringPill` hook (horizontal only — no vertical
  `Tabs` usage exists), rendering the pill as `bg-background shadow-sm` instead of
  the underline's thin bottom bar, and removes `TabsTrigger`'s own
  `data-[state=active]:bg-background` / `shadow-sm` (replaced by the pill) while
  keeping its `data-[state=active]:text-foreground` color change.
- The existing mount-snap / `MutationObserver` / `ResizeObserver` wiring in
  `TabsList` is reused as-is — only the `move()` function's internals change
  (spring integration instead of relying on the CSS `transition-property`), shared
  via the same `useSpringPill` hook the `ToggleGroup` change uses.

## Call site changes

| # | File | Control | Options | Change |
|---|---|---|---|---|
| 1 | `src/components/trip/search-criteria-form.tsx` | Trip type `ToggleGroup` | Ida e volta / Só ida / Multi-cidade | Add `pill` prop (orientation stays default horizontal) |
| 2 | `src/components/admin/requests-queue.tsx` | Queue `Tabs` | Pendentes / Todas | `indicator={false}` → `indicator="pill"` |
| 3 | `src/components/admin/employee-detail.tsx` | Employee detail `Tabs` | Todas / Gasto mensal / Desvios de política | `indicator={false}` → `indicator="pill"` |
| 4 | `src/app/(app)/results/page.tsx` | Sort selector | Preço / Duração / Horário de partida | Replace the `<input type="radio">` list in `FiltersPanel` with `ToggleGroup type="single" pill orientation="vertical"` / `ToggleGroupItem`, bound to the existing `sortKey`/`onSortKeyChange` props (no state-shape change) |

No other button group in the app qualifies: status filter chips in
`requests-list.tsx` are multi-select (not mutually exclusive), and every other
candidate found in the sweep is a `Select` dropdown, a binary `Switch`, a
checkbox group, a sortable table header, or plain page navigation — none of which
this pattern applies to.

## Testing

- `src/lib/spring.test.ts` (new): `stepSpring` converges to target and reports
  settled within a bounded number of steps for a fixed `dt`; velocity is preserved
  (not reset) when `target` changes mid-flight, i.e. calling `stepSpring` a few
  times toward target A then changing `target` to B does not zero `velocity`
  first; settles correctly when starting exactly at target (zero velocity, zero
  distance).
- No DOM/rAF-timing test for `useSpringPill` itself — no precedent for that in
  `src/components/ui` (only `button.test.ts` exists there today, and it tests pure
  extracted logic the same way `spring.ts` does here).
- `results/page.tsx`'s existing behavior around `sortKey` is unchanged (same prop
  contract), so no test updates expected there beyond whatever already covers
  `FiltersPanel`, if anything does.
- Manual verification: `npm run dev`, exercise all four controls, including
  rapid/mashed clicking on each to confirm the pill absorbs overlapping retargets
  without jank, and a resize mid-animation on the trip-type control.

# Flight Map International Plane Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** replace the hand-drawn chevron (`<polygon>`) currently animated along every flight's curve in `FlightPathMap` with the real lucide `Plane` glyph, but **only** for international routes (origin or destination outside Brazil) — domestic routes keep today's chevron unchanged, because their shorter curves don't give the more detailed glyph room to read well.

**Architecture:** a new pure helper, `isInternationalRoute(originCode, destinationCode)`, is added to `src/lib/airports.ts` next to the existing `isInternational(iataCode)` (which stays untouched — it only checks one side and is still used by `policy.ts`/`flight-map-selection.ts` for unrelated eligibility logic). `flight-path-map.tsx` calls the new helper per rendered flight, using the `origin.code`/`destination.code` it already has, and branches the animated marker: international flights get a `<path>` built from the lucide `Plane` icon's raw `d` data (copied as a constant, not imported as a React component, since it must live inside an SVG driven by SMIL `<animateMotion>`); domestic flights keep the existing `<polygon>`. Both share the exact same `<animateMotion>`/`prefers-reduced-motion` static-position logic already in the file.

**Tech Stack:** Next.js 14 / React 18 / TypeScript, Vitest (`environment: "node"`), SVG SMIL animation (no CSS/JS animation loop), lucide-react (icon path source only, not the component).

## Global Constraints

- Design source of truth: `docs/superpowers/specs/2026-07-17-flight-map-international-plane-icon-design.md`. This plan implements it in full.
- `isInternational(iataCode)` in `src/lib/airports.ts` must NOT change — it is consumed elsewhere (`policy.ts`, `flight-map-selection.ts`) for a different purpose (map-slot eligibility / policy caps), not for icon choice.
- Domestic flights (`isInternationalRoute` returns `false`) must render byte-for-byte the same chevron markup as today — no visual regression.
- No new npm dependency — the lucide icon path is copied as a string constant, the component is never imported/rendered inside the `<svg>`.
- No CSS `offset-path`, no `foreignObject`, no `setInterval`/`requestAnimationFrame` — the plane's motion stays 100% SMIL (`<animateMotion>`), matching the file's existing "no re-render loop" invariant.
- Commit after each task using Conventional Commits style (`feat:`), matching this repo's existing commit history.

---

### Task 1: `isInternationalRoute` — route-level international check

**Files:**
- Modify: `src/lib/airports.ts`
- Modify: `src/lib/airports.test.ts`

**Interfaces:**
- Consumes: `isInternational(iataCode: string): boolean` (existing, in the same file).
- Produces: `isInternationalRoute(originCode: string, destinationCode: string): boolean` — consumed by Task 2's `flight-path-map.tsx`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/airports.test.ts`, add a new `describe` block immediately after the existing `describe("isInternational", ...)` block (after its closing `});` on line 52, before `describe("COUNTRIES", ...)`):

```ts
describe("isInternationalRoute", () => {
  it("returns false when both origin and destination are domestic", () => {
    expect(isInternationalRoute("GRU", "CNF")).toBe(false);
  });

  it("returns true when only the destination is international", () => {
    expect(isInternationalRoute("GRU", "JFK")).toBe(true);
  });

  it("returns true when only the origin is international (return leg)", () => {
    expect(isInternationalRoute("JFK", "GRU")).toBe(true);
  });

  it("returns true when both origin and destination are international", () => {
    expect(isInternationalRoute("JFK", "LHR")).toBe(true);
  });

  it("returns false when both codes are unknown (fail safe, treat as domestic)", () => {
    expect(isInternationalRoute("ZZZ", "YYY")).toBe(false);
  });
});
```

Update the import on line 2 to include the new function:

```ts
import { COUNTRIES, findAirportByCode, isInternational, isInternationalRoute, searchAirports } from "./airports";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/lib/airports.test.ts`
Expected: FAIL — `isInternationalRoute is not defined` (or a TypeScript module-export error, depending on how Vitest reports the missing named export).

- [ ] **Step 3: Implement `isInternationalRoute`**

In `src/lib/airports.ts`, add this function immediately after the existing `isInternational` function (after its closing `}` on line 258):

```ts
export function isInternationalRoute(originCode: string, destinationCode: string): boolean {
  return isInternational(originCode) || isInternational(destinationCode);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/lib/airports.test.ts`
Expected: PASS (all existing tests plus the 5 new ones in `isInternationalRoute`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/airports.ts src/lib/airports.test.ts
git commit -m "$(cat <<'EOF'
feat: add isInternationalRoute helper for origin-or-destination international check

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Render the lucide plane glyph for international flights in `FlightPathMap`

**Files:**
- Modify: `src/components/admin/flight-path-map.tsx`

**Interfaces:**
- Consumes: `isInternationalRoute` (Task 1) from `@/lib/airports`.
- No new exports — `InCourseFlight` and `FlightPathMap`'s external interface are unchanged.

**Note on automated tests:** this file has no automated tests today (see `docs/superpowers/specs/2026-07-16-flight-map-design.md`'s testing section: "componentes são verificados manualmente + `tsc --noEmit`/`build`/`lint`"). This task follows that same established convention — no new test file, verification is typecheck + manual browser check (Steps 3-6 below).

- [ ] **Step 1: Add the import and the icon path constant**

In `src/components/admin/flight-path-map.tsx`, update the import from `@/lib/flight-map-geometry` (lines 11-20) by adding a new import line right after it:

```tsx
import {
  bezierPointAt,
  curvedPath,
  curveControlPoint,
  FLIGHT_MAP_PROJECTION,
  FLIGHT_MAP_REGION,
  flightProgress,
  flightTimingSeconds,
  projectPoint,
} from "@/lib/flight-map-geometry";
import { isInternationalRoute } from "@/lib/airports";
```

Then, after the `FLIGHT_COLOR` constant (after its closing `};` on line 35), add:

```tsx
// Path copied from node_modules/lucide-react/dist/esm/icons/plane.mjs — viewBox 24x24.
// Copied as a raw string (not imported as a React component) so it can be driven
// by SMIL <animateMotion> directly inside the map's <svg>.
const PLANE_ICON_PATH =
  "M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z";

// Lucide's Plane glyph is authored pointing toward the upper-right at rest, not
// along +x. animateMotion's rotate="auto" already orients the element along the
// curve's tangent assuming a resting orientation of "pointing along +x" (that's
// why the domestic chevron below is drawn pointing along +x with no rotation
// offset). This constant corrects the mismatch; tune it in Step 5's manual check
// if the nose doesn't visibly point along the direction of travel.
const PLANE_ICON_ROTATION_OFFSET_DEG = -45;

// Scales the 24x24 lucide glyph down into the map's 800x400 unit space, landing
// at roughly the same visual weight as an international curve can support
// (~14 units wide). Tune in Step 5's manual check together with the rotation offset.
const PLANE_ICON_SCALE = 0.6;
```

- [ ] **Step 2: Compute `isIntl` per flight and branch the marker**

In the `flights.map((flight, index) => { ... })` callback, after the existing line:

```tsx
                const staticPlanePoint = bezierPointAt(progress, start, control, end);
                const color = FLIGHT_COLOR[flight.status];
```

add:

```tsx
                const isIntl = isInternationalRoute(flight.origin.code, flight.destination.code);
```

Then replace the `<polygon>` block inside `<TooltipTrigger asChild><g ...>` (today's lines 172-182):

```tsx
                          <polygon points="-4,-2.5 4,0 -4,2.5 -2,0" fill={color}>
                            {!shouldReduceMotion && (
                              <animateMotion
                                path={path}
                                dur={`${durationSeconds}s`}
                                begin={`${beginOffsetSeconds}s`}
                                fill="freeze"
                                rotate="auto"
                              />
                            )}
                          </polygon>
```

with:

```tsx
                          {isIntl ? (
                            <path
                              d={PLANE_ICON_PATH}
                              fill={color}
                              transform={`scale(${PLANE_ICON_SCALE}) rotate(${PLANE_ICON_ROTATION_OFFSET_DEG}) translate(-12, -12)`}
                            >
                              {!shouldReduceMotion && (
                                <animateMotion
                                  path={path}
                                  dur={`${durationSeconds}s`}
                                  begin={`${beginOffsetSeconds}s`}
                                  fill="freeze"
                                  rotate="auto"
                                />
                              )}
                            </path>
                          ) : (
                            <polygon points="-4,-2.5 4,0 -4,2.5 -2,0" fill={color}>
                              {!shouldReduceMotion && (
                                <animateMotion
                                  path={path}
                                  dur={`${durationSeconds}s`}
                                  begin={`${beginOffsetSeconds}s`}
                                  fill="freeze"
                                  rotate="auto"
                                />
                              )}
                            </polygon>
                          )}
```

The `transform` attribute lives on the exact same `<path>` element that carries `<animateMotion>` (not on a wrapping `<g>`) — this matters: SVG composes an element's own static `transform` with `animateMotion`'s implicit motion transform on that same element, in the element's own local space, then moves the already-centered/scaled/rotated result along `path` (which is defined in the outer 800x400 space). Putting the static transform on an ancestor `<g>` instead would scale/rotate/offset the coordinate system `animateMotion` measures `path` against, making the icon fly along a distorted curve.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Build and lint**

Run: `npm run build`
Expected: build succeeds.

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 5: Manual browser verification — orientation and scale tuning**

Run: `npm run dev`, log in as `admin@demo.com` (password `Admin#Demo2026`), open `/admin`.

The seed data (`scripts/seed-demo-data.ts`, `ROUTES`) already includes `GRU → JFK` and `GRU → MIA` marked `international: true`, alongside domestic-only routes like `GRU → GIG`/`GRU → BSB`/`GRU → CNF`/`GRU → SSA`. If the "Viagens em curso" card doesn't currently show a `GRU → JFK`/`GRU → MIA` flight (in-course or completed), run:

```bash
npm run seed:reset
```

then reload `/admin` — the seeded data cycles through both international and domestic routes, so a reload (or checking the card right after a fresh seed) should surface at least one of each.

Confirm, adjusting `PLANE_ICON_ROTATION_OFFSET_DEG` and `PLANE_ICON_SCALE` in Step 1's constants and re-running `npm run dev` until true:
- A domestic flight (e.g. `GRU → GIG`) shows the exact same small chevron as before this change — no visual difference.
- An international flight (`GRU → JFK` or `GRU → MIA`) shows the lucide plane glyph instead of the chevron, legibly sized against the curve.
- The plane's nose visibly points along the direction of travel at both the start and the end of the curve (not sideways or backwards) — if it doesn't, adjust `PLANE_ICON_ROTATION_OFFSET_DEG` in 45-degree increments (try `0`, `45`, `90`, `135`, `180`, `-90`, `-135`) and reload until it tracks correctly.
- The international plane's fill color matches its status: blue (`#0ea5e9`) if in-course, slate (`#94a3b8`) if completed — same rule as the domestic chevron.
- Hovering the international plane icon shows the same tooltip content (employee name, route, departure/arrival times, "Concluído" if applicable) as hovering a domestic chevron.

- [ ] **Step 6: Manual browser verification — return-leg and reduced-motion cases**

Still on `/admin`:

- To see the "origin international, destination domestic" case (the one `isInternational(destination)` alone would miss), use the same SQL technique as `docs/superpowers/plans/2026-07-16-flight-map-admin-integration.md` Task 5 Step 4: pick or create an `approved` request, then update one slice's `origin`/`destination` to `JFK`/`GRU` and its times to straddle `now()`:

```sql
update requests
set selected_offer_snapshot = jsonb_set(
  jsonb_set(
    jsonb_set(
      jsonb_set(
        selected_offer_snapshot,
        '{slices,0,origin}', '"JFK"'
      ),
      '{slices,0,destination}', '"GRU"'
    ),
    '{slices,0,departure_datetime}',
    to_jsonb((now() - interval '2 hours')::text)
  ),
  '{slices,0,arrival_datetime}',
  to_jsonb((now() + interval '3 hours')::text)
)
where id = '<the request id you picked>';
```

  Reload `/admin` and confirm this `JFK → GRU` flight also shows the plane glyph (not the chevron), proving `isInternationalRoute` catches the return-leg case. Then revert with `npm run seed:reset` (if it was seed data) or restore the original values you noted before overwriting.

- Open Chrome DevTools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion: reduce", reload `/admin`. Confirm the international plane icon renders statically at the correct point along its curve (no animation), same as the domestic chevron does today under reduced motion. Turn the emulation back off afterward.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/flight-path-map.tsx
git commit -m "$(cat <<'EOF'
feat: animate the real plane icon for international flights on the admin flight map

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Full verification pass

**Files:**
- None (verification only)

**Interfaces:**
- Consumes: everything from Tasks 1-2.

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `isInternationalRoute` cases in `airports.test.ts`.

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 3: Run a full build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 4: Confirm no domestic regression**

On `/admin` (from Task 2's Step 5 session or a fresh `npm run dev`), confirm every domestic route (e.g. `GRU → GIG`, `GRU → BSB`, `GRU → CNF`, `GRU → SSA`) still renders the plain chevron, pixel-for-pixel the same as before this change — no domestic flight anywhere on the map should show the plane glyph.

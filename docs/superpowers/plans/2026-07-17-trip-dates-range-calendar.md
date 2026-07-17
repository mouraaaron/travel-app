# Trip Dates Range Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the plain `<input type="date">` fields for "Data de ida" / "Data de volta" (round trip, one way) and per-leg dates (multi-city) in `search-criteria-form.tsx` with a calendar popover built on the project's existing `react-day-picker`-based `Calendar` component, styled after the HeroUI range-calendar look, without adding any new npm dependency.

**Architecture:** A new `Popover` shadcn primitive (Radix, already a dependency) wraps the existing `Calendar` component inside a new `TripDatesPopover` component. For round trip / one way, one `TripDatesPopover` in `mode="range"` (2 months, footer "Confirmar" button enabled as soon as a departure date is picked — this is what makes it usable for one-way with no return date) replaces the old two separate date fields. For each multi-city leg, a `TripDatesPopover` in `mode="single"` (1 month, closes immediately on pick) replaces that leg's date input. Pure formatting/enable-rule logic lives in a dependency-free helper module so it can be unit tested with the project's existing `vitest` (node environment, no component-rendering infra exists in this repo).

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui conventions, `react-day-picker` v9 (already installed), `@radix-ui/react-popover` (already installed), `react-hook-form` + `zod`, `vitest`.

## Global Constraints

- No new npm dependencies — reuse `react-day-picker`, `@radix-ui/react-popover`, and plain JS/TS already available.
- No `dark:` Tailwind classes in any new file — the app has no dark mode configured (verified: no `next-themes`, no `.dark` class anywhere in `globals.css`).
- No changes to `src/lib/search-schema.ts` or `tripSearchToCriteria` — the shape of form values submitted stays identical.
- No React component-rendering tests — the repo's `vitest.config.ts` runs with `environment: "node"` and there is no `@testing-library/react`/`jsdom`/`.test.tsx` anywhere; only plain-logic `.test.ts` tests exist. New testable logic must be extracted into dependency-free functions.
- Match existing shadcn/ui file conventions in `src/components/ui/`: `"use client"` at the top, `cn()` from `@/lib/utils` for class merging, `React.forwardRef` + `displayName` for Radix wrapper primitives (see `dialog.tsx`).
- Form date values are plain `"yyyy-MM-dd"` strings (as produced by `<input type="date">` today) — all new code must read/write that exact string format, and must avoid `new Date(isoString).toISOString()`-style conversions, which shift by one day in timezones on either side of UTC. Use local-time `year, monthIndex, day` construction/extraction instead (see Task 2).

---

### Task 1: Add the shadcn Popover primitive

**Files:**
- Create: `src/components/ui/popover.tsx`

**Interfaces:**
- Produces: `Popover`, `PopoverTrigger`, `PopoverContent`, `PopoverAnchor` — standard Radix Popover wrapper components, used by Task 4's `TripDatesPopover`.

No existing `.tsx` UI primitive in this repo has an automated test (e.g. `dialog.tsx` has none) — this task is create + manual smoke check only, consistent with that convention.

- [ ] **Step 1: Create the Popover primitive**

```tsx
"use client"

import * as React from "react"
import * as PopoverPrimitive from "@radix-ui/react-popover"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

const PopoverAnchor = PopoverPrimitive.Anchor

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 4, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={cn(
        "z-50 w-auto rounded-md border border-border bg-popover p-0 text-popover-foreground shadow-md outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        className
      )}
      {...props}
    />
  </PopoverPrimitive.Portal>
))
PopoverContent.displayName = PopoverPrimitive.Content.displayName

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor }
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `popover.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/popover.tsx
git commit -m "Add shadcn Popover primitive"
```

---

### Task 2: Add dependency-free date helpers for the trip dates widget

**Files:**
- Create: `src/components/trip/trip-dates-popover-utils.ts`
- Test: `src/components/trip/trip-dates-popover-utils.test.ts`

**Interfaces:**
- Produces:
  - `parseFormDate(value: string | undefined): Date | undefined` — parses a `"yyyy-MM-dd"` form value into a local-time `Date` (midnight, local timezone). Used by Task 4's `TripDatesPopover` to feed `Calendar`'s `selected`/`disabled`/`defaultMonth` props.
  - `formatFormDate(date: Date): string` — the inverse: turns a local-time `Date` (as produced by `Calendar`'s `onSelect`) back into a `"yyyy-MM-dd"` string, using local getters (`getFullYear`/`getMonth`/`getDate`), never `toISOString()`.
  - `formatTripDateLabel(departureDate: string | undefined, mode: "range" | "single", returnDate?: string): string` — the popover trigger button label, e.g. `"17 jul — 24 jul"`, `"17 jul"`, or `"Selecione a data"`.
  - `isConfirmEnabled(departureDate: string | undefined): boolean` — true once a departure date exists; a return date is never required (this is the one-way rule).
- Consumes: nothing (pure functions, no imports beyond built-ins).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  formatFormDate,
  formatTripDateLabel,
  isConfirmEnabled,
  parseFormDate,
} from "./trip-dates-popover-utils";

describe("parseFormDate", () => {
  it("parses a yyyy-MM-dd string into a local Date at midnight", () => {
    expect(parseFormDate("2026-07-17")).toEqual(new Date(2026, 6, 17));
  });

  it("returns undefined for an empty or missing value", () => {
    expect(parseFormDate("")).toBeUndefined();
    expect(parseFormDate(undefined)).toBeUndefined();
  });
});

describe("formatFormDate", () => {
  it("formats a local Date back into yyyy-MM-dd", () => {
    expect(formatFormDate(new Date(2026, 6, 17))).toBe("2026-07-17");
  });

  it("pads single-digit months and days", () => {
    expect(formatFormDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("formatTripDateLabel", () => {
  it("shows a placeholder when no departure date is set", () => {
    expect(formatTripDateLabel(undefined, "range")).toBe("Selecione a data");
  });

  it("shows only the departure date in single mode", () => {
    expect(formatTripDateLabel("2026-07-17", "single")).toBe("17 jul");
  });

  it("shows only the departure date in range mode with no return date (one-way)", () => {
    expect(formatTripDateLabel("2026-07-17", "range")).toBe("17 jul");
  });

  it("shows both dates in range mode with a return date", () => {
    expect(formatTripDateLabel("2026-07-17", "range", "2026-07-24")).toBe(
      "17 jul — 24 jul"
    );
  });
});

describe("isConfirmEnabled", () => {
  it("is true once a departure date exists, even without a return date", () => {
    expect(isConfirmEnabled("2026-07-17")).toBe(true);
  });

  it("is false with no departure date", () => {
    expect(isConfirmEnabled(undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/components/trip/trip-dates-popover-utils.test.ts`
Expected: FAIL — `trip-dates-popover-utils` module not found.

- [ ] **Step 3: Implement the helpers**

```ts
const MONTH_ABBREVIATIONS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

export function parseFormDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatFormDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLabelDate(value: string): string {
  const date = parseFormDate(value) as Date;
  return `${date.getDate()} ${MONTH_ABBREVIATIONS[date.getMonth()]}`;
}

export function formatTripDateLabel(
  departureDate: string | undefined,
  mode: "range" | "single",
  returnDate?: string
): string {
  if (!departureDate) return "Selecione a data";
  if (mode === "single" || !returnDate) return formatLabelDate(departureDate);
  return `${formatLabelDate(departureDate)} — ${formatLabelDate(returnDate)}`;
}

export function isConfirmEnabled(departureDate: string | undefined): boolean {
  return Boolean(departureDate);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/components/trip/trip-dates-popover-utils.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/trip/trip-dates-popover-utils.ts src/components/trip/trip-dates-popover-utils.test.ts
git commit -m "Add date helpers for the trip dates popover"
```

---

### Task 3: Build the TripDatesPopover component

**Files:**
- Create: `src/components/trip/trip-dates-popover.tsx`

**Interfaces:**
- Consumes: `Popover`/`PopoverTrigger`/`PopoverContent` (Task 1), `Calendar` (`@/components/ui/calendar`, pre-existing), `Button` (`@/components/ui/button`, pre-existing), `parseFormDate`/`formatFormDate`/`formatTripDateLabel`/`isConfirmEnabled` (Task 2).
- Produces: `TripDatesPopover(props: TripDatesPopoverProps)` where

```ts
type TripDatesPopoverProps =
  | {
      mode: "single";
      date: string;
      onChange: (value: string) => void;
      minDate?: Date;
    }
  | {
      mode: "range";
      departureDate: string;
      returnDate: string | undefined;
      onChangeDeparture: (value: string) => void;
      onChangeReturn: (value: string | undefined) => void;
      minDate?: Date;
    };
```

Used by Task 4 in `search-criteria-form.tsx`.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  formatFormDate,
  formatTripDateLabel,
  isConfirmEnabled,
  parseFormDate,
} from "@/components/trip/trip-dates-popover-utils";

type TripDatesPopoverProps =
  | {
      mode: "single";
      date: string;
      onChange: (value: string) => void;
      minDate?: Date;
    }
  | {
      mode: "range";
      departureDate: string;
      returnDate: string | undefined;
      onChangeDeparture: (value: string) => void;
      onChangeReturn: (value: string | undefined) => void;
      minDate?: Date;
    };

export function TripDatesPopover(props: TripDatesPopoverProps) {
  const [open, setOpen] = useState(false);

  if (props.mode === "single") {
    const { date, onChange, minDate } = props;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="w-full justify-start font-normal">
            {formatTripDateLabel(date, "single")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start">
          <Calendar
            mode="single"
            numberOfMonths={1}
            selected={parseFormDate(date)}
            defaultMonth={parseFormDate(date) ?? minDate}
            disabled={minDate ? { before: minDate } : undefined}
            onSelect={(selected) => {
              if (!selected) return;
              onChange(formatFormDate(selected));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    );
  }

  const { departureDate, returnDate, onChangeDeparture, onChangeReturn, minDate } = props;
  const range: DateRange = {
    from: parseFormDate(departureDate),
    to: parseFormDate(returnDate),
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="w-full justify-start font-normal">
          {formatTripDateLabel(departureDate, "range", returnDate)}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start">
        <Calendar
          mode="range"
          numberOfMonths={2}
          selected={range}
          defaultMonth={range.from ?? minDate}
          disabled={minDate ? { before: minDate } : undefined}
          onSelect={(selected) => {
            onChangeDeparture(selected?.from ? formatFormDate(selected.from) : "");
            onChangeReturn(selected?.to ? formatFormDate(selected.to) : undefined);
          }}
        />
        <div className="flex justify-end border-t border-border p-3">
          <Button
            type="button"
            size="sm"
            disabled={!isConfirmEnabled(departureDate)}
            onClick={() => setOpen(false)}
          >
            Confirmar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `trip-dates-popover.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/trip-dates-popover.tsx
git commit -m "Add TripDatesPopover component"
```

---

### Task 4: Wire TripDatesPopover into the search criteria form

**Files:**
- Modify: `src/components/trip/search-criteria-form.tsx`

**Interfaces:**
- Consumes: `TripDatesPopover` (Task 3), `parseFormDate` (Task 2).

This task replaces two pieces of `search-criteria-form.tsx`:
1. The `departureDate` `FormField` inside the `fields.map(...)` loop (currently renders an `<Input type="date">`).
2. The standalone `returnDate` `FormField` rendered after the loop when `tripType === "round_trip"` (removed entirely — merged into the same widget as departure).

- [ ] **Step 1: Add imports**

In `src/components/trip/search-criteria-form.tsx`, add these two imports alongside the existing ones (e.g. right after the `CityAirportCombobox` import):

```tsx
import { TripDatesPopover } from "@/components/trip/trip-dates-popover";
import { parseFormDate } from "@/components/trip/trip-dates-popover-utils";
```

- [ ] **Step 2: Replace the departureDate FormField inside the slices loop**

Find this exact block (inside `{fields.map((field, index) => ( ... ))}`, right after the destination `FormField`):

```tsx
                    <FormField
                      control={form.control}
                      name={`slices.${index}.departureDate`}
                      render={({ field: dateField }) => (
                        <FormItem>
                          <FormLabel>Data de ida</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              min={index === 0 ? TODAY : form.watch(`slices.${index - 1}.departureDate`) || TODAY}
                              {...dateField}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
```

Replace it with:

```tsx
                    {tripType === "multi_city" ? (
                      <FormField
                        control={form.control}
                        name={`slices.${index}.departureDate`}
                        render={({ field: dateField }) => (
                          <FormItem>
                            <FormLabel>Data de ida</FormLabel>
                            <FormControl>
                              <TripDatesPopover
                                mode="single"
                                date={dateField.value}
                                onChange={dateField.onChange}
                                minDate={
                                  parseFormDate(
                                    index === 0
                                      ? TODAY
                                      : form.watch(`slices.${index - 1}.departureDate`) || TODAY
                                  )
                                }
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    ) : (
                      <FormItem>
                        <FormLabel>{tripType === "round_trip" ? "Ida e volta" : "Data de ida"}</FormLabel>
                        <FormControl>
                          <TripDatesPopover
                            mode="range"
                            departureDate={form.watch(`slices.${index}.departureDate`)}
                            returnDate={tripType === "round_trip" ? form.watch("returnDate") : undefined}
                            onChangeDeparture={(value) =>
                              form.setValue(`slices.${index}.departureDate`, value, { shouldValidate: true })
                            }
                            onChangeReturn={(value) =>
                              form.setValue("returnDate", value ?? "", { shouldValidate: true })
                            }
                            minDate={parseFormDate(TODAY)}
                          />
                        </FormControl>
                        {form.formState.errors.slices?.[index]?.departureDate?.message ? (
                          <p className="text-xs text-destructive">
                            {form.formState.errors.slices[index]?.departureDate?.message}
                          </p>
                        ) : null}
                        {tripType === "round_trip" && form.formState.errors.returnDate?.message ? (
                          <p className="text-xs text-destructive">{form.formState.errors.returnDate.message}</p>
                        ) : null}
                      </FormItem>
                    )}
```

- [ ] **Step 3: Remove the standalone returnDate FormField**

Find and delete this exact block (it comes after the `{tripType === "multi_city" && fields.length < 4 ? (...) : null}` "Trecho" button block):

```tsx
              {tripType === "round_trip" ? (
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem className="max-w-xs">
                      <FormLabel>Data de volta</FormLabel>
                      <FormControl>
                        <Input type="date" min={form.watch("slices.0.departureDate") || TODAY} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}
```

Delete it entirely (no replacement — it's now handled by the combined widget from Step 2).

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `search-criteria-form.tsx`. If `Input` is reported as unused, it is not — it is still used by the passenger/time inputs further down in the same file.

- [ ] **Step 5: Run the existing test suite**

Run: `npm run test`
Expected: PASS — no existing test covers `search-criteria-form.tsx`, so this only confirms nothing else broke (e.g. `search-schema.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add src/components/trip/search-criteria-form.tsx
git commit -m "Use TripDatesPopover for round trip, one way, and multi-city dates"
```

---

### Task 5: Manual verification in the browser

**Files:** none (verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`

- [ ] **Step 2: Verify round trip**

Navigate to the trip search page (`/`, or wherever `SearchCriteriaForm` is mounted per `src/app/(app)/page.tsx`). With "Ida e volta" selected:
- Click the dates button — a popover opens showing 2 months side by side.
- Click a start date, then an end date — both highlight as a range.
- Confirm "Confirmar" is disabled until the start date is clicked, then enabled.
- Click "Confirmar" — popover closes, button label shows both dates (e.g. "17 jul — 24 jul").
- Submit the form and confirm `/results` receives the right `departure_date`/return leg (via the existing trip flow store).

- [ ] **Step 3: Verify one way**

Switch to "Só ida":
- Open the popover, click a single date.
- Confirm "Confirmar" is already enabled after just that one click.
- Click "Confirmar" — popover closes, button shows only that one date.
- Submit and confirm only one slice is sent (no return leg), matching today's behavior.

- [ ] **Step 4: Verify multi-city**

Switch to "Multi-cidade", add a second leg:
- Confirm each leg's date popover is single-month and closes immediately on click (no "Confirmar" button).
- Confirm the second leg's calendar disables dates before the first leg's chosen departure date.

- [ ] **Step 5: Visual check (light mode)**

Confirm the popover and calendar render with light backgrounds/text (no unreadable dark-on-dark or light-on-light regions) — expected automatically since no `dark:` classes were introduced and the app has no dark mode toggle.

- [ ] **Step 6: Stop the dev server**

Stop the process started in Step 1 (e.g. `Ctrl+C` in that terminal).

---

## Self-Review Notes

- **Spec coverage:** Popover primitive (Task 1) ✅, range/single TripDatesPopover behavior including one-way's "confirm enabled with only departure date" rule (Tasks 2–3) ✅, wiring into round trip / one way / multi-city (Task 4) ✅, min-date rules preserved via `Calendar`'s `disabled` matcher (Task 4) ✅, no schema changes (verified — Task 4 only touches the form component) ✅, testing approach adjusted to the repo's real test infra (Task 2, no component-render tests) ✅, manual verification (Task 5) ✅.
- **Type consistency:** `TripDatesPopoverProps` in Task 3 matches the call sites written in Task 4 exactly (`mode`, `date`/`onChange` for single; `departureDate`/`returnDate`/`onChangeDeparture`/`onChangeReturn` for range). `parseFormDate`/`formatFormDate`/`formatTripDateLabel`/`isConfirmEnabled` signatures in Task 2 match their usage in Task 3.
- **No placeholders:** every step has complete, exact code or exact commands; no "add appropriate handling"-style steps.

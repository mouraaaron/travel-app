# Trip Dates Range Calendar — Design Spec

Date: 2026-07-17

## Goal

Replace the plain `<input type="date">` fields used for "Data de ida" / "Data de volta" (and per-leg dates in Multi-cidade) in `search-criteria-form.tsx` with a calendar popover, styled after the HeroUI range-calendar (21st.dev), while keeping the app free of new dependencies and working correctly for one-way trips (no return date required).

## Background / Constraints discovered

- The travel-app has no dark mode configured (no `next-themes`, no `.dark` classes in `globals.css`) — the app is light-mode-only today, so no explicit "force light mode" work is needed.
- The HeroUI range-calendar component from 21st.dev is package-based (`@heroui/react` + `@heroui/styles` + `react-aria-components`), not a copy-paste snippet, and is range-only (no native single-date mode). Adopting it would pull in an entire second design system with its own theming, risking conflicts with the existing shadcn/Tailwind CSS variable tokens.
- The project already has `react-day-picker` v9 installed and a working shadcn `Calendar` wrapper at `src/components/ui/calendar.tsx`, which natively supports both `range` and `single` selection modes. It is currently unused anywhere in the app.
- `@radix-ui/react-popover` is already a dependency, but there is no shadcn `popover.tsx` wrapper in `src/components/ui/` yet.
- Current date fields are backed by plain string form values (`slices.{index}.departureDate`, `returnDate`) validated by `tripSearchSchema` in `src/lib/search-schema.ts`. No schema changes are needed — only the UI feeding these fields changes.

## Decision

Build the range-calendar UX using the existing `react-day-picker`-based `Calendar` component instead of installing HeroUI. This delivers the same visual/UX goal (a popover-driven range calendar, usable for one-way with no return date) without adding a second component/design system.

## Components

### `src/components/ui/popover.tsx` (new)

Standard shadcn Popover wrapper (`Popover`, `PopoverTrigger`, `PopoverContent`) around `@radix-ui/react-popover`, following the same structural conventions as the existing `dialog.tsx` in the same directory (data-slot attributes, `cn()` usage, no `dark:` classes).

### `src/components/trip/trip-dates-popover.tsx` (new)

A controlled component wrapping `Popover` + `Calendar` (from `@/components/ui/calendar`).

Props:
- `mode: "range" | "single"`
- `numberOfMonths: number`
- Value/onChange pairs matching the two use cases:
  - Range mode: `departureDate: string`, `returnDate: string | undefined`, `onChangeDeparture`, `onChangeReturn`, `onConfirm` (called when the user clicks "Confirmar")
  - Single mode: `date: string`, `onChange`
- `minDate?: Date` — lower bound passed through to `Calendar`'s `disabled` matcher

Trigger button displays the formatted selection:
- Range mode: `"17 jul — 24 jul"` (both selected) or `"17 jul"` (only departure selected, e.g. mid-selection or one-way) using `toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })`.
- Single mode: `"17 jul"` or a placeholder ("Selecione a data") when empty.

Popover content:
- Range mode: `Calendar` with `mode="range"`, `numberOfMonths={2}`, plus a footer row with a "Confirmar" button.
  - "Confirmar" is enabled once the departure date is set (return date is optional) — this is what makes the same range-picking UI work for one-way trips: the user can click just one date and confirm.
  - Clicking "Confirmar" calls `onConfirm`, closes the popover.
- Single mode: `Calendar` with `mode="single"`, `numberOfMonths={1}`. Selecting a date immediately calls `onChange` and closes the popover (no footer/confirm button).

### `search-criteria-form.tsx` changes

- Replace the existing `departureDate`/`returnDate` `FormField` block (currently rendered for `slices[0]` + the conditional `round_trip` returnDate field) with a single `TripDatesPopover` in `mode="range"` when `tripType` is `round_trip` or `one_way`. It is bound to `slices.0.departureDate` and `returnDate` via `form.watch`/`form.setValue` (matching the existing pattern used elsewhere in this file, e.g. the `Stepper` controls).
  - When `tripType === "one_way"`, the popover only needs to be visually aware that there's no return concept: the trigger button never shows a return date range (since `returnDate` isn't part of one-way's semantics and isn't rendered/validated by the schema in that case — same as today).
- Each Multi-cidade slice's `departureDate` `FormField` (currently an `<Input type="date">`) is replaced with `TripDatesPopover` in `mode="single"`.
- Date-bound rules preserved via the `Calendar`'s native `disabled` matcher instead of `<input min>`:
  - First slice's departure cannot be before today (`TODAY`).
  - Each subsequent multi-city slice's departure cannot be before the previous slice's departure.
  - `returnDate` cannot be before `slices.0.departureDate`.
- Trip-type switching behavior is preserved as today: switching away from `round_trip` clears/ignores `returnDate` (schema already treats it as optional outside round_trip); switching between `round_trip` and `one_way` keeps the already-selected departure date.

## Styling

No new tokens. Reuses the same Tailwind/shadcn CSS variables already used by `calendar.tsx` (`bg-background`, `border-border`, `bg-primary`, etc.). No `dark:` classes are introduced in either new file, consistent with the app having no dark mode today.

## Testing

- New unit test `src/components/trip/trip-dates-popover.test.tsx` covering:
  - Range mode: selecting two dates and clicking "Confirmar" calls both onChange callbacks and `onConfirm`.
  - Range mode: "Confirmar" is enabled with only a departure date selected (one-way case).
  - Single mode: selecting a date calls `onChange` and closes the popover without a confirm step.
- No existing test file covers `search-criteria-form.tsx` today, so no existing tests need updating; a new one is not required by this change but could be added if desired during implementation (not required for scope).

## Out of scope

- No changes to `search-schema.ts` or `tripSearchToCriteria` — the data shape produced by the form stays identical.
- No dark mode / theme provider work (app has none today).
- Not installing `@heroui/react`, `@heroui/styles`, or `react-aria-components`.

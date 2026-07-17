# Onsite Week Dates — Reuse Trip Dates Popover — Design Spec

Date: 2026-07-17

## Goal

Replace the two native `<input type="date">` fields ("Data de ida" / "Data de volta") in the "Organizar semana presencial" flow with the same calendar popover already used for flight ticket dates, so both flows share one date-picking UX.

## Background

- `src/components/admin/organize-onsite-week-flow.tsx` currently renders two side-by-side `Input type="date"` fields bound to `weekStartDate` / `weekEndDate` (plain ISO `YYYY-MM-DD` strings).
- `src/components/trip/trip-dates-popover.tsx` (`TripDatesPopover`) already implements a range-mode calendar popover, used by `search-criteria-form.tsx` for flight departure/return dates. It operates on the same ISO string format via `parseFormDate`/`formatFormDate` from `src/components/trip/trip-dates-popover-utils.ts`.
- No schema or API changes are needed — only the form UI changes; `weekStartDate`/`weekEndDate` keep their existing shape and are consumed unchanged by `handlePreview`/`handleConfirm`.

## Decision

Reuse `TripDatesPopover` in `mode="range"` with `allowRange={true}` (the onsite week always has a real departure and return date, unlike flight one-way trips).

## Change

In `organize-onsite-week-flow.tsx`:

- Remove the two-column `Input type="date"` grid.
- Add a `TODAY` constant (`new Date().toISOString().slice(0, 10)`), matching the pattern in `search-criteria-form.tsx`.
- Render a single labeled `TripDatesPopover`:
  - `mode="range"`
  - `departureDate={weekStartDate}`
  - `returnDate={weekEndDate || undefined}`
  - `onChangeDeparture={setWeekStartDate}`
  - `onChangeReturn={(value) => setWeekEndDate(value ?? "")}`
  - `minDate={parseFormDate(TODAY)}` — disables past dates in the calendar
  - `allowRange`
- Keep the existing `handlePreview` validation (empty fields / end-before-start) as a safety net.
- Remove the now-unused `Input` import; add imports for `TripDatesPopover` and `parseFormDate`.

## Out of scope

- No changes to `TripDatesPopover`, `Calendar`, or the flight search form.
- No changes to the onsite-week API, preview logic, or downstream steps (review table, confirm).

## Testing

- Manually exercise the form: open the popover, pick a start and end date, confirm the label updates, confirm past dates are disabled, confirm "Avançar" still validates empty selection.

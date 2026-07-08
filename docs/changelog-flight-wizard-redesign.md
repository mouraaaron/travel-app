# Changelog — Flight Request Wizard Redesign

Date: 2026-07-08

## Summary

Replaced the home screen with a 2-step flight-request wizard, inspired by
two Navan reference screenshots (city autocomplete dropdown, "travel
window" date range, checkbox-gated optional time preferences). Moved the
existing dashboard from `/` to `/requests`.

## Routes

| Route | Before | After |
|---|---|---|
| `/` | Dashboard ("Minhas Solicitações") | **New**: flight request wizard ("Buscar Viagem") |
| `/requests` | (didn't exist) | Dashboard ("Minhas Solicitações"), moved from `/` |
| `/search` | Combined Tabs (Passagens/Hospedagem) search form | **Removed** — superseded by the wizard |
| `/search/results` | Unchanged | Unchanged (still reached via the same query params) |

Top bar: "Minhas Solicitações" now points to `/requests`; "Buscar Viagem"
now points to `/`. Visual position in the nav (top-right) is unchanged.

## New flow: 2-step wizard

**Step 1 — Trip criteria** (`FlightCriteriaStep`):
- Origin/Destination: city-name autocomplete (`CityAirportCombobox`,
  backed by a new mock `src/lib/airports.ts` dataset) instead of raw
  3-letter IATA code text fields. Cities with more than one airport (São
  Paulo, Rio de Janeiro, Nova York, Buenos Aires) show one dropdown row
  per airport for the user to pick.
- Travel window: Ida (depart) + Volta opcional (return) dates — unchanged
  behavior, just relabeled as a "Janela de viagem" section.
- Número de passageiros (1–9).
- Classe (unchanged: economy/premium_economy/business/first).
- Two optional, checkbox-gated time preferences: "Sugerir horário limite
  de chegada" (outbound) and "Sugerir horário mínimo de partida na volta"
  (return leg, only shown once a return date is set).
- "Avançar" validates (`flightSearchSchema`, extended with the new fields)
  and moves to Step 2.

**Step 2 — Passenger details** (`PassengerDetailsStep`):
- One repeating block per passenger (count fixed from Step 1, no
  add/remove control): first name, last name, date of birth, gender,
  email, phone — the fields needed to issue a flight ticket.
- "Voltar" returns to Step 1 with its values preserved. "Buscar" validates
  (`passengersSchema`) and navigates to `/search/results` with the same
  query params the old form used (`mode`, `origin`, `destination`,
  `departureAt`, `returnAt`, `cabinClass`).

## Known, intentional limitations (not bugs)

- **Passenger data isn't persisted or used yet.** Step 2's data is
  validated and held in the wizard's local state, then discarded once
  `/search/results` is reached — there's no backend/Duffel order-creation
  in this phase for it to feed into. This will be wired in when a real
  booking flow exists.
- **Hospedagem (stay) search is no longer reachable from the UI.** Per
  the instruction to focus only on the flight scheme for now, the old
  combined Tabs form and its `/search` route were removed. `staySearchSchema`
  and all other stay-related library code/tests are untouched and still
  pass — reintroducing a stay search entry point is future work, not a
  rewrite.
- The city/airport dataset in `src/lib/airports.ts` is a small hand-picked
  mock (the cities already used by `src/lib/mock-data.ts`'s offers, plus a
  few extras) — not a real geocoding/airport API.

## Files touched

**New:**
- `src/lib/airports.ts`, `src/lib/airports.test.ts`
- `src/lib/passenger-schema.ts`, `src/lib/passenger-schema.test.ts`
- `src/components/ui/checkbox.tsx`
- `src/components/trip/city-airport-combobox.tsx`
- `src/components/trip/flight-criteria-step.tsx`
- `src/components/trip/passenger-details-step.tsx`
- `src/components/trip/flight-request-wizard.tsx`
- `src/app/requests/page.tsx`

**Modified:**
- `src/lib/search-schema.ts`, `src/lib/search-schema.test.ts` (extended `flightSearchSchema`)
- `src/app/page.tsx` (now the wizard, was the dashboard)
- `src/components/layout/top-bar.tsx` (nav hrefs swapped)

**Deleted:**
- `src/components/trip/trip-search-form.tsx`
- `src/app/search/page.tsx`

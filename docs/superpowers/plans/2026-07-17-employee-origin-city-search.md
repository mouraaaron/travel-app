# Employee Origin City Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In `/admin/employees/[id]`, replace the free-text IATA input for the employee's travel-profile origin with the same city-search combobox already used in trip search, and relabel the field to "Cidade de origem".

**Architecture:** `CityAirportCombobox` (`src/components/trip/city-airport-combobox.tsx`) is already a generic, framework-agnostic `value`/`onChange` component backed by the Duffel Places API with a local-list fallback (`src/lib/airports.ts`, `src/lib/use-place-suggestions.ts`). `employee-travel-profile-form.tsx` currently manages `origin_airport_code` with plain `useState`, so the combobox drops in with no new wiring beyond an import and a prop swap. Separately, the combobox's initial-display fallback (`findAirportByCode(value)?.label ?? ""`) is widened to `?? value` so a previously saved IATA code that isn't in the local ~27-city list still shows something instead of a blank field — a one-line fix that benefits every consumer of the component, not just this form.

**Tech Stack:** Next.js 14 (App Router, client components), React 18 `useState`, existing `CityAirportCombobox` + Duffel Places integration, Vitest.

## Global Constraints

- `CityAirportCombobox`'s public prop contract (`value: string`, `onChange: (code: string) => void`, `label: string`, `placeholder: string`, `autoFocus?: boolean`) does not change.
- No changes to the Duffel Places API integration, `/api/places/suggestions` route, `usePlaceSuggestions`, `searchAirports`, or `CITIES` — the search engine itself is untouched.
- No backend/API validation changes: `PATCH /api/admin/employees/[id]/travel-profile` keeps validating `origin_airport_code` with `z.string().length(3)`.
- No new automated tests for the UI wiring — matches the existing repo convention that neither `city-airport-combobox.tsx` nor `employee-travel-profile-form.tsx` have unit tests (only pure logic like `airports.ts`/`duffel/map-place.ts` is unit-tested). Verification here is manual, with exact commands given in each task.
- The label text must read exactly "Cidade de origem" (not "Aeroporto de origem" in any form).

---

### Task 1: Fallback to raw IATA code when it's outside the local city list

**Files:**
- Modify: `travel-app/src/components/trip/city-airport-combobox.tsx:22`

**Interfaces:**
- Consumes: `findAirportByCode(code: string): AirportOption | undefined` from `@/lib/airports` (unchanged, already imported).
- Produces: no new exports — this only changes the initial value of the component's internal `query` state, which callers never read directly.

- [ ] **Step 1: Make the one-line change**

In `travel-app/src/components/trip/city-airport-combobox.tsx`, change line 22 from:

```ts
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
```

to:

```ts
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? value);
```

- [ ] **Step 2: Run the full test suite to confirm no regression**

Run: `npm test`
Expected: same pass/fail counts as before this change — specifically, `src/lib/admin-requests.test.ts` has one pre-existing unrelated failure (`keeps only pending_admin requests on the pending tab, oldest first`, an ordering assertion unrelated to this feature); every other test file passes. No new failures should appear.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Manual verification**

Run: `npm run dev`, then in the browser open the trip search page (`/`, or wherever `search-criteria-form.tsx` renders — the flight search "De onde você sai?" field) and confirm it still opens empty and behaves exactly as before (type a city, pick an option, value updates). This form always starts with `value === ""`, so `findAirportByCode("")` is `undefined` and the fallback becomes `?? ""` in practice — confirming the change is a no-op for this existing consumer.

- [ ] **Step 5: Commit**

```bash
cd travel-app
git add src/components/trip/city-airport-combobox.tsx
git commit -m "fix: fall back to raw IATA code when initial value isn't in the local city list"
```

---

### Task 2: Wire the admin employee travel-profile form to CityAirportCombobox

**Files:**
- Modify: `travel-app/src/components/admin/employee-travel-profile-form.tsx:1-10` (imports), `:68-78` (the origin field block)

**Interfaces:**
- Consumes: `CityAirportCombobox` from `@/components/trip/city-airport-combobox` (props: `value: string`, `onChange: (code: string) => void`, `label: string`, `placeholder: string`), unchanged by Task 1.
- Produces: no new exports — internal to the form component.

- [ ] **Step 1: Add the import**

In `travel-app/src/components/admin/employee-travel-profile-form.tsx`, add this import alongside the existing ones (after the `Label` import on line 8):

```tsx
import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";
```

- [ ] **Step 2: Replace the origin field block**

Replace this block (current lines 68-78):

```tsx
        <div className="flex flex-col gap-1.5">
          <Label>Aeroporto de origem (IATA)</Label>
          <Input
            value={values.origin_airport_code}
            maxLength={3}
            placeholder="Ex: GRU"
            onChange={(e) =>
              setValues((v) => ({ ...v, origin_airport_code: e.target.value.toUpperCase() }))
            }
          />
        </div>
```

with:

```tsx
        <CityAirportCombobox
          value={values.origin_airport_code}
          onChange={(code) => setValues((v) => ({ ...v, origin_airport_code: code }))}
          label="Cidade de origem"
          placeholder="Ex: São Paulo (GRU)"
        />
```

Note this drops the wrapping `<div className="flex flex-col gap-1.5">` — `CityAirportCombobox` already renders its own `<div className="relative flex flex-col gap-1.5">` wrapper with its own `<label>`, so nesting it inside another `flex flex-col` div would be redundant, not incorrect, but the cleaner replacement removes the outer div entirely and lets the combobox sit directly as a grid item (same as the other fields already do — the grid is `grid grid-cols-1 gap-3 sm:grid-cols-2` at line 67, and each direct child is one form field).

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors. (This also catches unused-import errors if `Input` or `Label` were no longer used elsewhere in the file — both remain used by the other fields, so no unused-import cleanup is needed.)

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: same result as Task 1 Step 2 (one pre-existing unrelated failure in `admin-requests.test.ts`, everything else passing).

- [ ] **Step 5: Manual verification — existing profile with a code in the local list**

Run: `npm run dev`, log in as an admin, open `/admin/employees/[id]` for an employee whose `origin_airport_code` is already set to a code in the local list (e.g. `GRU`). Confirm:
- The field label reads "Cidade de origem" (not "Aeroporto de origem").
- The field opens pre-filled with the city label (e.g. "São Paulo (GRU)"), not blank and not just the raw code.

- [ ] **Step 6: Manual verification — search and save a new city**

In the same form, clear the field, type "Amsterd" (a city outside the local ~27-city list), confirm suggestions appear (from the Duffel Places API — allow a moment for the debounced network call), select the Amsterdam option, click "Salvar perfil de viagem", confirm the success toast appears, then reload the page and confirm the field still shows the Amsterdam option (not blank, not the raw code) — this exercises Task 1's fallback for a real saved value outside the local list.

- [ ] **Step 7: Manual verification — save rejection when no option is selected**

In the same form, click into the origin field, type a few characters, and click "Salvar perfil de viagem" *without* selecting an option from the dropdown. Confirm the request fails and an error toast appears (`origin_airport_code` is `""` at that point, which fails the API's `z.string().length(3)` check) — matching the existing behavior of the old free-text input when left incomplete.

- [ ] **Step 8: Commit**

```bash
cd travel-app
git add src/components/admin/employee-travel-profile-form.tsx
git commit -m "feat: use CityAirportCombobox for employee travel profile origin field"
```

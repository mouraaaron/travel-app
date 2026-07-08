# Flight Request Wizard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the home screen with a 2-step flight-request wizard (trip criteria → passenger details), inspired by two Navan reference screenshots, and move the existing "Minhas Solicitações" dashboard from `/` to `/requests`.

**Architecture:** Two new pure-logic modules (`src/lib/airports.ts` for a city→airport autocomplete dataset, `src/lib/passenger-schema.ts` for passenger validation) back three new Client Components (`CityAirportCombobox`, `FlightCriteriaStep`, `PassengerDetailsStep`) composed by a `FlightRequestWizard` container that owns the 2-step state machine. The wizard becomes the new `/` page; the old dashboard content moves verbatim to `/requests`; the old combined Tabs (Passagens/Hospedagem) search form and its `/search` page are deleted (superseded by the wizard) — `staySearchSchema` and all other stay-related code/tests are left in place, just unused by the UI for now. `/search/results` is untouched: the wizard's final step still navigates there with the exact same query params the old form used.

**Tech Stack:** Next.js 14 (App Router), React 18, TypeScript (strict), react-hook-form + zod + shadcn Form pattern (matching the existing convention), Vitest (pure-logic tests only, node environment), npm.

## Global Constraints

- Frontend only — no backend, no real Duffel integration, no persistence beyond what already exists (`localStorage` via `RequestsProvider`). Passenger data collected in Step 2 is **not** threaded into `/search/results` or the `TripRequest` shape in this phase — this is an intentional, documented limitation (see Task 9's changelog), not a bug to silently fix.
- Keep this project's existing Paggo brand tokens (`bg-brand-gradient`, existing color tokens in `tailwind.config.ts`) — borrow only the Navan screenshots' UX *patterns* (labeled inputs, grouped card sections, autocomplete dropdown with primary+secondary text per row, checkbox-gated optional time field), not Navan's purple color scheme.
- Testing strategy matches the existing project convention exactly: Vitest, `environment: "node"`, pure-logic tests only (co-located `*.test.ts`) — no DOM/component tests. UI composition is verified manually (headlessly, via `npm run build` + `curl`, per the lesson from the original plan's Task 11).
- Package manager is npm. UI copy in pt-BR, code identifiers in English — matching the existing project.
- Do not delete `staySearchSchema`, `StaySearchFormValues`, or any other currently-passing stay-related code/tests — only stop routing the UI to the old combined search form.
- Every commit ends with `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Reference screenshots for this task: `C:\Users\aaron\bootcamp\navan1.png`, `C:\Users\aaron\bootcamp\navan2.png` (Navan's "Create an event" flow — city autocomplete dropdown and "Travel windows" section with checkbox-gated time preferences).

---

### Task 1: Copy the Checkbox primitive

**Files:**
- Create: `src/components/ui/checkbox.tsx`

**Interfaces:**
- Produces: `Checkbox` (Radix-based, `checked`/`onCheckedChange` props) — consumed by Task 6 (`FlightCriteriaStep`) and Task 7 (`PassengerDetailsStep`'s gender field uses `Select`, not `Checkbox`, but `FlightCriteriaStep`'s two "sugerir horário" toggles do).

- [ ] **Step 1: Install the Radix dependency**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npm install @radix-ui/react-checkbox
```

- [ ] **Step 2: Copy and adapt the component**

```bash
cp "C:/Users/aaron/bootcamp/reference/paggo-university-prototypes/src/components/ui/checkbox.tsx" \
   "C:/Users/aaron/bootcamp/travel-app/src/components/ui/checkbox.tsx"

sed -i \
  -e 's/!bg-white-pure/bg-white/g' \
  -e 's/!text-white-pure/text-white/g' \
  "C:/Users/aaron/bootcamp/travel-app/src/components/ui/checkbox.tsx"

sed -i '1i "use client"\n' "C:/Users/aaron/bootcamp/travel-app/src/components/ui/checkbox.tsx"

grep -n "white-pure\|black-pure" "C:/Users/aaron/bootcamp/travel-app/src/components/ui/checkbox.tsx"
head -3 "C:/Users/aaron/bootcamp/travel-app/src/components/ui/checkbox.tsx"
```

Expected: the `grep` prints nothing (no `-pure` classes remain); `head -3` shows `"use client"` as the first line, a blank line, then `import * as React from "react"`.

- [ ] **Step 3: Verify**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/checkbox.tsx package.json package-lock.json
git commit -m "$(cat <<'EOF'
feat: copy Checkbox primitive for the flight wizard's time-preference toggles

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Airports mock dataset (TDD)

**Files:**
- Create: `src/lib/airports.ts`
- Test: `src/lib/airports.test.ts`

**Interfaces:**
- Produces: `AirportOption { code: string; label: string; sublabel: string }`, `searchAirports(query: string): AirportOption[]`, `findAirportByCode(code: string): AirportOption | undefined` — consumed by Task 5 (`CityAirportCombobox`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { findAirportByCode, searchAirports } from "./airports";

describe("searchAirports", () => {
  it("returns both airports for a city with more than one", () => {
    const result = searchAirports("São Paulo");
    expect(result.map((o) => o.code).sort()).toEqual(["CGH", "GRU"]);
  });

  it("matches without diacritics (accent-insensitive)", () => {
    const result = searchAirports("brasilia");
    expect(result.map((o) => o.code)).toEqual(["BSB"]);
  });

  it("matches by airport code directly", () => {
    const result = searchAirports("jfk");
    expect(result.map((o) => o.code)).toEqual(["JFK"]);
  });

  it("returns an empty array for an empty query", () => {
    expect(searchAirports("")).toEqual([]);
  });

  it("returns an empty array when nothing matches", () => {
    expect(searchAirports("xyzxyz")).toEqual([]);
  });
});

describe("findAirportByCode", () => {
  it("finds an airport by its code, case-insensitively", () => {
    const result = findAirportByCode("gru");
    expect(result?.label).toBe("São Paulo (GRU)");
  });

  it("returns undefined for an unknown code", () => {
    expect(findAirportByCode("ZZZ")).toBeUndefined();
  });
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/airports.test.ts`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/airports.test.ts
```

Expected: FAIL — `Cannot find module './airports'`.

- [ ] **Step 3: Implement `airports.ts`**

```ts
export interface Airport {
  code: string;
  name: string;
}

export interface City {
  city: string;
  country: string;
  airports: Airport[];
}

export interface AirportOption {
  code: string;
  label: string;
  sublabel: string;
}

export const CITIES: City[] = [
  {
    city: "São Paulo",
    country: "Brasil",
    airports: [
      { code: "GRU", name: "Aeroporto Internacional de Guarulhos" },
      { code: "CGH", name: "Aeroporto de Congonhas" },
    ],
  },
  {
    city: "Rio de Janeiro",
    country: "Brasil",
    airports: [
      { code: "GIG", name: "Aeroporto Internacional do Galeão" },
      { code: "SDU", name: "Aeroporto Santos Dumont" },
    ],
  },
  {
    city: "Brasília",
    country: "Brasil",
    airports: [{ code: "BSB", name: "Aeroporto Internacional de Brasília" }],
  },
  {
    city: "Salvador",
    country: "Brasil",
    airports: [{ code: "SSA", name: "Aeroporto Internacional de Salvador" }],
  },
  {
    city: "Curitiba",
    country: "Brasil",
    airports: [{ code: "CWB", name: "Aeroporto Internacional Afonso Pena" }],
  },
  {
    city: "Nova York",
    country: "Estados Unidos",
    airports: [
      { code: "JFK", name: "John F. Kennedy International Airport" },
      { code: "LGA", name: "LaGuardia Airport" },
    ],
  },
  {
    city: "Miami",
    country: "Estados Unidos",
    airports: [{ code: "MIA", name: "Miami International Airport" }],
  },
  {
    city: "Buenos Aires",
    country: "Argentina",
    airports: [
      { code: "EZE", name: "Aeroporto Internacional Ministro Pistarini" },
      { code: "AEP", name: "Aeroparque Jorge Newbery" },
    ],
  },
  {
    city: "Lisboa",
    country: "Portugal",
    airports: [{ code: "LIS", name: "Aeroporto Humberto Delgado" }],
  },
];

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function searchAirports(query: string): AirportOption[] {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length === 0) return [];

  const options: AirportOption[] = [];
  for (const city of CITIES) {
    for (const airport of city.airports) {
      const haystack = normalize(
        `${city.city} ${city.country} ${airport.code} ${airport.name}`
      );
      if (haystack.includes(normalizedQuery)) {
        options.push({
          code: airport.code,
          label: `${city.city} (${airport.code})`,
          sublabel: airport.name,
        });
      }
    }
  }
  return options;
}

export function findAirportByCode(code: string): AirportOption | undefined {
  const normalizedCode = code.trim().toUpperCase();
  for (const city of CITIES) {
    for (const airport of city.airports) {
      if (airport.code === normalizedCode) {
        return {
          code: airport.code,
          label: `${city.city} (${airport.code})`,
          sublabel: airport.name,
        };
      }
    }
  }
  return undefined;
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/airports.ts`.

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/lib/airports.test.ts
```

Expected: `7 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/airports.ts src/lib/airports.test.ts
git commit -m "$(cat <<'EOF'
feat: add mock city/airport dataset with accent-insensitive search

Covers every city already used by src/lib/mock-data.ts's mock offers,
plus a few extras (Salvador, Curitiba, LaGuardia, Aeroparque) so
multi-airport cities (São Paulo, Rio, Nova York, Buenos Aires) have a
real disambiguation case to demo.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Passenger schema (TDD)

**Files:**
- Create: `src/lib/passenger-schema.ts`
- Test: `src/lib/passenger-schema.test.ts`

**Interfaces:**
- Produces: `passengerSchema`, `PassengerFormValues`, `passengersSchema`, `PassengersFormValues`, `buildEmptyPassenger(): PassengerFormValues` — consumed by Task 7 (`PassengerDetailsStep`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { buildEmptyPassenger, passengersSchema } from "./passenger-schema";

const VALID_PASSENGER = {
  firstName: "Ana",
  lastName: "Souza",
  dateOfBirth: "1990-05-10",
  gender: "f" as const,
  email: "ana@example.com",
  phone: "+55 11 91234-5678",
};

describe("passengersSchema", () => {
  it("accepts a list with one valid passenger", () => {
    const result = passengersSchema.safeParse({ passengers: [VALID_PASSENGER] });
    expect(result.success).toBe(true);
  });

  it("accepts multiple valid passengers", () => {
    const result = passengersSchema.safeParse({
      passengers: [VALID_PASSENGER, { ...VALID_PASSENGER, firstName: "Bruno", gender: "m" }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty passenger list", () => {
    const result = passengersSchema.safeParse({ passengers: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid email", () => {
    const result = passengersSchema.safeParse({
      passengers: [{ ...VALID_PASSENGER, email: "not-an-email" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects a missing first name", () => {
    const result = passengersSchema.safeParse({
      passengers: [{ ...VALID_PASSENGER, firstName: "" }],
    });
    expect(result.success).toBe(false);
  });
});

describe("buildEmptyPassenger", () => {
  it("returns a passenger shape with all fields blank and gender defaulted to f", () => {
    expect(buildEmptyPassenger()).toEqual({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "f",
      email: "",
      phone: "",
    });
  });
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/passenger-schema.test.ts`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/passenger-schema.test.ts
```

Expected: FAIL — `Cannot find module './passenger-schema'`.

- [ ] **Step 3: Implement `passenger-schema.ts`**

```ts
import { z } from "zod";

export const passengerSchema = z.object({
  firstName: z.string().trim().min(1, "Informe o nome"),
  lastName: z.string().trim().min(1, "Informe o sobrenome"),
  dateOfBirth: z.string().min(1, "Informe a data de nascimento"),
  gender: z.enum(["f", "m"], { required_error: "Selecione o sexo" }),
  email: z.string().trim().email("E-mail inválido"),
  phone: z.string().trim().min(8, "Informe um telefone válido"),
});

export type PassengerFormValues = z.infer<typeof passengerSchema>;

export const passengersSchema = z.object({
  passengers: z.array(passengerSchema).min(1, "Informe ao menos um passageiro"),
});

export type PassengersFormValues = z.infer<typeof passengersSchema>;

export function buildEmptyPassenger(): PassengerFormValues {
  return {
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "f",
    email: "",
    phone: "",
  };
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/passenger-schema.ts`.

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/lib/passenger-schema.test.ts
```

Expected: `6 passed`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/passenger-schema.ts src/lib/passenger-schema.test.ts
git commit -m "$(cat <<'EOF'
feat: add passenger details schema for the flight wizard's step 2

Fields match what's needed to issue a flight ticket (name, DOB,
gender, email, phone) per the Duffel passenger contract noted in
PLANO-TRAVEL-APP.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Extend the flight search schema; remove the obsolete combined search form

**Files:**
- Modify: `src/lib/search-schema.ts`
- Modify: `src/lib/search-schema.test.ts`
- Delete: `src/components/trip/trip-search-form.tsx`
- Delete: `src/app/search/page.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `flightSearchSchema` now additionally requires `passengerCount: number`, `latestArrivalEnabled: boolean`, `latestArrivalTime?: string`, `earliestReturnDepartureEnabled: boolean`, `earliestReturnDepartureTime?: string`. `FlightSearchFormValues` (its inferred type) is consumed by Task 6 (`FlightCriteriaStep`) and Task 8 (`FlightRequestWizard`). `staySearchSchema`/`StaySearchFormValues` are unchanged.

**Why the deletions happen in this task:** `trip-search-form.tsx`'s `FLIGHT_DEFAULTS` object will no longer satisfy the updated `FlightSearchFormValues` type once this task's schema change lands (it's missing the 5 new required fields), which breaks `tsc --noEmit`. Since this old combined form is being fully superseded by the new wizard (Tasks 5-8), delete it and its only route here rather than patching a component you're about to throw away. The `/search` route will 404 and the top bar's "Buscar Viagem" link will point at it until Task 8 fixes the nav and adds the wizard as the new `/` — that's an expected, low-risk transitional state for one task's worth of commits, not a regression to ship.

- [ ] **Step 1: Write the failing test additions**

Replace the full contents of `src/lib/search-schema.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import { flightSearchSchema, staySearchSchema } from "./search-schema";

describe("flightSearchSchema", () => {
  const valid = {
    mode: "flight" as const,
    origin: "GRU",
    destination: "JFK",
    departureAt: "2026-08-10",
    returnAt: "2026-08-17",
    passengerCount: 1,
    cabinClass: "economy" as const,
    latestArrivalEnabled: false,
    latestArrivalTime: "",
    earliestReturnDepartureEnabled: false,
    earliestReturnDepartureTime: "",
  };

  it("accepts a valid round-trip search", () => {
    expect(flightSearchSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects origin and destination being the same", () => {
    const result = flightSearchSchema.safeParse({ ...valid, destination: "gru" });
    expect(result.success).toBe(false);
  });

  it("rejects a return date before the departure date", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      departureAt: "2026-08-17",
      returnAt: "2026-08-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an origin that isn't a 3-letter IATA code", () => {
    const result = flightSearchSchema.safeParse({ ...valid, origin: "SAOPAULO" });
    expect(result.success).toBe(false);
  });

  it("rejects zero passengers", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects more than 9 passengers", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: 10 });
    expect(result.success).toBe(false);
  });

  it("coerces a numeric string passenger count", () => {
    const result = flightSearchSchema.safeParse({ ...valid, passengerCount: "2" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.passengerCount).toBe(2);
  });

  it("requires a time when latest arrival is enabled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      latestArrivalEnabled: true,
      latestArrivalTime: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts latest arrival time when enabled and filled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      latestArrivalEnabled: true,
      latestArrivalTime: "18:00",
    });
    expect(result.success).toBe(true);
  });

  it("requires a return date before enabling earliest return departure time", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      returnAt: "",
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "09:00",
    });
    expect(result.success).toBe(false);
  });

  it("requires a time when earliest return departure is enabled", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts earliest return departure time when enabled, filled, and a return date is set", () => {
    const result = flightSearchSchema.safeParse({
      ...valid,
      earliestReturnDepartureEnabled: true,
      earliestReturnDepartureTime: "09:00",
    });
    expect(result.success).toBe(true);
  });
});

describe("staySearchSchema", () => {
  const valid = {
    mode: "stay" as const,
    city: "Rio de Janeiro",
    checkIn: "2026-08-10",
    checkOut: "2026-08-13",
  };

  it("accepts a valid stay search", () => {
    expect(staySearchSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects check-out on or before check-in", () => {
    const result = staySearchSchema.safeParse({ ...valid, checkOut: "2026-08-10" });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx vitest run src/lib/search-schema.test.ts
```

Expected: FAIL — the new assertions fail because `flightSearchSchema` doesn't have the new fields/refines yet (e.g. `passengerCount: 0` currently passes because the field doesn't exist).

- [ ] **Step 3: Update `flightSearchSchema`**

Replace the full contents of `src/lib/search-schema.ts` with:

```ts
import { z } from "zod";

export const flightSearchSchema = z
  .object({
    mode: z.literal("flight"),
    origin: z.string().trim().length(3, "Selecione uma origem na lista"),
    destination: z.string().trim().length(3, "Selecione um destino na lista"),
    departureAt: z.string().min(1, "Informe a data de ida"),
    returnAt: z.string().optional(),
    passengerCount: z.coerce
      .number({ invalid_type_error: "Informe o número de passageiros" })
      .int()
      .min(1, "Mínimo 1 passageiro")
      .max(9, "Máximo 9 passageiros"),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    latestArrivalEnabled: z.boolean(),
    latestArrivalTime: z.string().optional(),
    earliestReturnDepartureEnabled: z.boolean(),
    earliestReturnDepartureTime: z.string().optional(),
  })
  .refine(
    (data) => data.origin.toUpperCase() !== data.destination.toUpperCase(),
    { message: "Origem e destino não podem ser iguais", path: ["destination"] }
  )
  .refine((data) => !data.returnAt || data.returnAt >= data.departureAt, {
    message: "A volta não pode ser antes da ida",
    path: ["returnAt"],
  })
  .refine((data) => !data.latestArrivalEnabled || Boolean(data.latestArrivalTime), {
    message: "Informe o horário limite de chegada",
    path: ["latestArrivalTime"],
  })
  .refine(
    (data) => !data.earliestReturnDepartureEnabled || Boolean(data.earliestReturnDepartureTime),
    {
      message: "Informe o horário mínimo de partida da volta",
      path: ["earliestReturnDepartureTime"],
    }
  )
  .refine((data) => !data.earliestReturnDepartureEnabled || Boolean(data.returnAt), {
    message: "Defina a data de volta antes de configurar esse horário",
    path: ["earliestReturnDepartureTime"],
  });

export type FlightSearchFormValues = z.infer<typeof flightSearchSchema>;

export const staySearchSchema = z
  .object({
    mode: z.literal("stay"),
    city: z.string().trim().min(2, "Informe a cidade"),
    checkIn: z.string().min(1, "Informe a data de check-in"),
    checkOut: z.string().min(1, "Informe a data de check-out"),
  })
  .refine((data) => data.checkOut > data.checkIn, {
    message: "Check-out deve ser depois do check-in",
    path: ["checkOut"],
  });

export type StaySearchFormValues = z.infer<typeof staySearchSchema>;
```

- [ ] **Step 4: Run the test again and confirm it passes**

```bash
npx vitest run src/lib/search-schema.test.ts
```

Expected: `14 passed`.

- [ ] **Step 5: Delete the obsolete combined search form and its route**

```bash
rm "C:/Users/aaron/bootcamp/travel-app/src/components/trip/trip-search-form.tsx"
rm "C:/Users/aaron/bootcamp/travel-app/src/app/search/page.tsx"
```

- [ ] **Step 6: Verify the rest of the project still builds**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx tsc --noEmit
npm run build
```

Expected: both succeed. The build's route summary no longer lists `/search` (only `/search/results`) — that's expected; Task 8 adds the wizard at `/`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/search-schema.ts src/lib/search-schema.test.ts
git rm src/components/trip/trip-search-form.tsx src/app/search/page.tsx
git commit -m "$(cat <<'EOF'
feat: extend flightSearchSchema for the wizard; remove the old combined form

Adds passengerCount, latestArrivalEnabled/Time, and
earliestReturnDepartureEnabled/Time with matching refines.
staySearchSchema is untouched. The old Tabs-based
trip-search-form.tsx and its /search page are removed — they're
superseded by the new flight wizard (following tasks); /search
transiently 404s until the wizard lands at / in a later task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: City/Airport autocomplete combobox

**Files:**
- Create: `src/components/trip/city-airport-combobox.tsx`

**Interfaces:**
- Consumes: `searchAirports`, `findAirportByCode`, `AirportOption` from `@/lib/airports` (Task 2); `cn` from `@/lib/utils`.
- Produces: `<CityAirportCombobox value={code} onChange={(code) => void} label={string} placeholder={string} />` — a controlled input whose `value`/`onChange` carry the resolved IATA code (not the display text) — consumed by Task 6 (`FlightCriteriaStep`).

No dedicated unit test for this task — it's a presentational/interactive component with no pure logic of its own (the matching logic it calls is already tested in Task 2). Verified manually per this project's established convention.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useId, useRef, useState } from "react";
import { findAirportByCode, searchAirports, type AirportOption } from "@/lib/airports";
import { cn } from "@/lib/utils";

export function CityAirportCombobox({
  value,
  onChange,
  label,
  placeholder,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  placeholder: string;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const options = open ? searchAirports(query) : [];

  function handleSelect(option: AirportOption) {
    onChange(option.code);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        value={query}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          onChange("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          blurTimeout.current = setTimeout(() => setOpen(false), 150);
        }}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:text-sm"
      />
      {open && options.length > 0 ? (
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-input bg-popover shadow-md">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-accent"
                )}
              >
                <span className="font-medium">{option.label}</span>
                <span className="text-xs text-muted-foreground">{option.sublabel}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/trip/city-airport-combobox.tsx`.

- [ ] **Step 2: Verify**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx tsc --noEmit
npm run build
```

Expected: both succeed (this file isn't imported anywhere yet, so it can't break an existing route, but it must still type-check and compile cleanly).

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/city-airport-combobox.tsx
git commit -m "$(cat <<'EOF'
feat: add city-name autocomplete combobox resolving to an IATA code

Typing a city shows one dropdown row per airport (so a city with two
airports, like São Paulo, shows both codes); selecting a row sets the
field to that airport's code. The onMouseDown preventDefault + delayed
blur is the standard pattern for keeping a text-input-driven dropdown
open through a click.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Flight criteria step (wizard step 1)

**Files:**
- Create: `src/components/trip/flight-criteria-step.tsx`

**Interfaces:**
- Consumes: `flightSearchSchema`, `FlightSearchFormValues` from `@/lib/search-schema` (Task 4); `CityAirportCombobox` from `@/components/trip/city-airport-combobox` (Task 5); `Checkbox` from `@/components/ui/checkbox` (Task 1); existing `Form`/`FormField`/`FormItem`/`FormLabel`/`FormControl`/`FormMessage`, `Input`, `Select*`, `Card*`, `Button`.
- Produces: `FLIGHT_CRITERIA_DEFAULTS: FlightSearchFormValues`, `<FlightCriteriaStep defaultValues={...} onContinue={(values: FlightSearchFormValues) => void} />` — consumed by Task 8 (`FlightRequestWizard`).

No dedicated unit test — presentational/interactive, verified manually (the schema it validates against is already tested in Task 4).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";
import { flightSearchSchema, type FlightSearchFormValues } from "@/lib/search-schema";

export const FLIGHT_CRITERIA_DEFAULTS: FlightSearchFormValues = {
  mode: "flight",
  origin: "",
  destination: "",
  departureAt: "",
  returnAt: "",
  passengerCount: 1,
  cabinClass: "economy",
  latestArrivalEnabled: false,
  latestArrivalTime: "",
  earliestReturnDepartureEnabled: false,
  earliestReturnDepartureTime: "",
};

export function FlightCriteriaStep({
  defaultValues,
  onContinue,
}: {
  defaultValues: FlightSearchFormValues;
  onContinue: (values: FlightSearchFormValues) => void;
}) {
  const form = useForm<FlightSearchFormValues>({
    resolver: zodResolver(flightSearchSchema),
    defaultValues,
  });

  const hasReturn = Boolean(form.watch("returnAt"));
  const latestArrivalEnabled = form.watch("latestArrivalEnabled");
  const earliestReturnDepartureEnabled = form.watch("earliestReturnDepartureEnabled");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buscar Viagem</CardTitle>
        <CardDescription>
          Preencha os detalhes da viagem para ver as passagens disponíveis.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onContinue)} className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="origin"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CityAirportCombobox
                        label="Origem"
                        placeholder="Digite a cidade de origem"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <CityAirportCombobox
                        label="Destino"
                        placeholder="Digite a cidade de destino"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-medium">Janela de viagem</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="departureAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ida</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnAt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Volta (opcional)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="passengerCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de passageiros</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} max={9} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cabinClass"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Classe</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="economy">Econômica</SelectItem>
                        <SelectItem value="premium_economy">Premium economy</SelectItem>
                        <SelectItem value="business">Executiva</SelectItem>
                        <SelectItem value="first">Primeira classe</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex flex-col gap-3 rounded-md border border-dashed border-input p-4">
              <FormField
                control={form.control}
                name="latestArrivalEnabled"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-3 space-y-0">
                    <FormControl>
                      <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Sugerir horário limite de chegada
                    </FormLabel>
                  </FormItem>
                )}
              />
              {latestArrivalEnabled ? (
                <FormField
                  control={form.control}
                  name="latestArrivalTime"
                  render={({ field }) => (
                    <FormItem className="max-w-[200px]">
                      <FormControl>
                        <Input type="time" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : null}

              {hasReturn ? (
                <>
                  <FormField
                    control={form.control}
                    name="earliestReturnDepartureEnabled"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center gap-3 space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                        <FormLabel className="font-normal">
                          Sugerir horário mínimo de partida na volta
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  {earliestReturnDepartureEnabled ? (
                    <FormField
                      control={form.control}
                      name="earliestReturnDepartureTime"
                      render={({ field }) => (
                        <FormItem className="max-w-[200px]">
                          <FormControl>
                            <Input type="time" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button
                type="submit"
                className="bg-brand-gradient hover:bg-brand-gradient-hover text-white"
              >
                Avançar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/trip/flight-criteria-step.tsx`.

- [ ] **Step 2: Verify**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx tsc --noEmit
npm run build
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/flight-criteria-step.tsx
git commit -m "$(cat <<'EOF'
feat: add flight criteria step (wizard step 1)

Origin/destination use the new city autocomplete; travel window,
passenger count, cabin class, and the two checkbox-gated time
preferences (latest arrival / earliest return departure) are new
fields inspired by the Navan reference screenshots.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Passenger details step (wizard step 2)

**Files:**
- Create: `src/components/trip/passenger-details-step.tsx`

**Interfaces:**
- Consumes: `passengersSchema`, `PassengersFormValues`, `buildEmptyPassenger` from `@/lib/passenger-schema` (Task 3); existing `Form*`, `Input`, `Select*`, `Card*`, `Separator`, `Button`.
- Produces: `<PassengerDetailsStep passengerCount={number} onBack={() => void} onSubmit={(values: PassengersFormValues) => void} />` — consumed by Task 8 (`FlightRequestWizard`).

No dedicated unit test — presentational/interactive, verified manually (the schema is already tested in Task 3).

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  buildEmptyPassenger,
  passengersSchema,
  type PassengersFormValues,
} from "@/lib/passenger-schema";

export function PassengerDetailsStep({
  passengerCount,
  onBack,
  onSubmit,
}: {
  passengerCount: number;
  onBack: () => void;
  onSubmit: (values: PassengersFormValues) => void;
}) {
  const form = useForm<PassengersFormValues>({
    resolver: zodResolver(passengersSchema),
    defaultValues: {
      passengers: Array.from({ length: passengerCount }, () => buildEmptyPassenger()),
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Dados dos passageiros</CardTitle>
        <CardDescription>
          Preencha as informações necessárias para emitir as passagens.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
            {Array.from({ length: passengerCount }, (_, index) => (
              <div key={index} className="flex flex-col gap-4">
                {index > 0 ? <Separator /> : null}
                <p className="text-sm font-medium">Passageiro {index + 1}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.firstName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.lastName`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sobrenome</FormLabel>
                        <FormControl>
                          <Input {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.dateOfBirth`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de nascimento</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.gender`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sexo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="f">Feminino</SelectItem>
                            <SelectItem value="m">Masculino</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.email`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>E-mail</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`passengers.${index}.phone`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input type="tel" placeholder="+55 11 91234-5678" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            ))}

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={onBack}>
                Voltar
              </Button>
              <Button
                type="submit"
                className="bg-brand-gradient hover:bg-brand-gradient-hover text-white"
              >
                Buscar
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/trip/passenger-details-step.tsx`.

**Note:** `passengerCount` is fixed at mount from Step 1's value — there's no add/remove-passenger control in this step, since the count was already declared. This is deliberately simpler than `useFieldArray`'s dynamic add/remove machinery, which isn't needed here.

- [ ] **Step 2: Verify**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx tsc --noEmit
npm run build
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/passenger-details-step.tsx
git commit -m "$(cat <<'EOF'
feat: add passenger details step (wizard step 2)

Renders exactly `passengerCount` repeating blocks (from step 1),
collecting the fields needed to issue a ticket: name, date of birth,
gender, email, phone.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Wizard container, route/nav wiring

**Files:**
- Create: `src/components/trip/flight-request-wizard.tsx`
- Create: `src/app/requests/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/components/layout/top-bar.tsx`

**Interfaces:**
- Consumes: `FlightCriteriaStep`, `FLIGHT_CRITERIA_DEFAULTS` from `@/components/trip/flight-criteria-step` (Task 6); `PassengerDetailsStep` from `@/components/trip/passenger-details-step` (Task 7); `FlightSearchFormValues` from `@/lib/search-schema`; `PassengersFormValues` from `@/lib/passenger-schema`; `useRequests`, `offerTitle`, `formatDate`, `PolicyBadges`, `RequestStatusBadge`, `EmptyState` (all already used by the current `src/app/page.tsx`, being relocated).
- Produces: `<FlightRequestWizard />` — the new `/` page's content. `/requests` — the relocated dashboard route.

- [ ] **Step 1: Write the wizard container**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  FLIGHT_CRITERIA_DEFAULTS,
  FlightCriteriaStep,
} from "@/components/trip/flight-criteria-step";
import { PassengerDetailsStep } from "@/components/trip/passenger-details-step";
import type { PassengersFormValues } from "@/lib/passenger-schema";
import type { FlightSearchFormValues } from "@/lib/search-schema";

export function FlightRequestWizard() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [criteria, setCriteria] = useState<FlightSearchFormValues>(FLIGHT_CRITERIA_DEFAULTS);

  function handleCriteriaContinue(values: FlightSearchFormValues) {
    setCriteria(values);
    setStep(2);
  }

  function handlePassengersSubmit(_values: PassengersFormValues) {
    // Passenger data is collected here (needed to issue a ticket later) but
    // isn't threaded into /search/results or persisted yet — there's no
    // backend/Duffel order-creation in this phase. See the change log for
    // this round for details; this is intentional, not a bug.
    const query = new URLSearchParams({
      mode: "flight",
      origin: criteria.origin.toUpperCase(),
      destination: criteria.destination.toUpperCase(),
      departureAt: criteria.departureAt,
      returnAt: criteria.returnAt ?? "",
      cabinClass: criteria.cabinClass,
    });
    router.push(`/search/results?${query.toString()}`);
  }

  if (step === 1) {
    return <FlightCriteriaStep defaultValues={criteria} onContinue={handleCriteriaContinue} />;
  }

  return (
    <PassengerDetailsStep
      passengerCount={criteria.passengerCount}
      onBack={() => setStep(1)}
      onSubmit={handlePassengersSubmit}
    />
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/trip/flight-request-wizard.tsx`.

- [ ] **Step 2: Move the dashboard to `/requests`**

```bash
mkdir -p "C:/Users/aaron/bootcamp/travel-app/src/app/requests"
cp "C:/Users/aaron/bootcamp/travel-app/src/app/page.tsx" \
   "C:/Users/aaron/bootcamp/travel-app/src/app/requests/page.tsx"
sed -i 's/DashboardPage/RequestsPage/' "C:/Users/aaron/bootcamp/travel-app/src/app/requests/page.tsx"
```

- [ ] **Step 3: Replace `src/app/page.tsx` with the wizard**

```tsx
import { FlightRequestWizard } from "@/components/trip/flight-request-wizard";

export default function HomePage() {
  return <FlightRequestWizard />;
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/page.tsx` (overwrite).

- [ ] **Step 4: Point the top bar's links at the new routes**

In `src/components/layout/top-bar.tsx`, change the `NAV_ITEMS` array from:

```ts
const NAV_ITEMS = [
  { href: "/", label: "Minhas Solicitações" },
  { href: "/search", label: "Buscar Viagem" },
];
```

to:

```ts
const NAV_ITEMS = [
  { href: "/requests", label: "Minhas Solicitações" },
  { href: "/", label: "Buscar Viagem" },
];
```

Do not change anything else in this file — the array order (and therefore the visual left-to-right position within the top-right nav cluster) stays exactly as it is.

- [ ] **Step 5: Verify**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npx tsc --noEmit
npm run build
```

Expected: both succeed. The build's route summary now lists `/` (the wizard), `/requests` (the dashboard), `/requests/[id]`, `/search/results` — no `/search`.

- [ ] **Step 6: Manual verification (headless)**

```bash
npm run dev
```
(in the background)

```bash
curl -s http://localhost:3000/ | grep -o "Buscar Viagem" 
curl -s http://localhost:3000/ | grep -o "Janela de viagem"
curl -s http://localhost:3000/requests | grep -o "Minhas Solicitações"
```

Expected: each `grep` finds its match (confirms the wizard renders at `/` with its new fields, and the relocated dashboard renders at `/requests`). Stop the dev server. Note in your report that the interactive 2-step flow (filling step 1, clicking "Avançar", filling step 2, clicking "Buscar", landing on `/search/results`) requires a real browser and could not be exercised headlessly.

- [ ] **Step 7: Commit**

```bash
git add src/components/trip/flight-request-wizard.tsx src/app/page.tsx src/app/requests/page.tsx src/components/layout/top-bar.tsx
git commit -m "$(cat <<'EOF'
feat: wire the flight wizard as the new home page; move dashboard to /requests

"Buscar Viagem" is now the default screen at /; "Minhas Solicitações"
moves to /requests (still top-right in the nav, same position as
before — only its href changed).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Final verification and change log

**Files:**
- Create: `docs/changelog-flight-wizard-redesign.md`

**Interfaces:** N/A (closing task).

- [ ] **Step 1: Run the full test suite**

```bash
cd C:/Users/aaron/bootcamp/travel-app
npm test
```

Expected: all suites pass, 0 failing (the exact total will be higher than the pre-existing 30 by this plan's new test files — sanity-check the count if you like, but 0 failing is the real bar, not an exact number).

- [ ] **Step 2: Type-check, lint, build**

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all clean. Build route summary: `/`, `/_not-found`, `/requests`, `/requests/[id]`, `/search/results`.

- [ ] **Step 3: Headless manual walkthrough**

```bash
npm run dev
```
(in the background)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/requests
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/search/results
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/requests/does-not-exist
```

Expected: all four return `200`. Stop the dev server. Note in your report that the full interactive flow (fill step 1 → Avançar → fill step 2 → Buscar → land on results, plus the city autocomplete dropdown itself) needs a real-browser spot-check before this is demo-ready — this cannot be verified headlessly and is a known, disclosed limitation, not a shortcut.

- [ ] **Step 4: Write the change log**

```markdown
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
```

Save as `C:/Users/aaron/bootcamp/travel-app/docs/changelog-flight-wizard-redesign.md`.

- [ ] **Step 5: Commit and push**

```bash
cd C:/Users/aaron/bootcamp/travel-app
git add docs/changelog-flight-wizard-redesign.md
git commit -m "$(cat <<'EOF'
docs: add change log for the flight wizard redesign

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
git push
```

Expected: push succeeds; `git log --oneline -10` shows this round's commits on top of the existing history.

---

## What's deliberately not in this plan

- **Passenger data flowing into `/search/results` or `TripRequest`** — collected and validated, but not yet threaded further; no backend exists for it to serve.
- **A "Hospedagem" (stay) entry point in the redesigned home UI** — `staySearchSchema` and its tests remain, unused by the UI for now.
- **A real airports/geocoding API** — `src/lib/airports.ts` is a small hand-picked mock dataset.
- **Admin panel, backend, Duffel integration, Vercel deployment** — unchanged from the original plan's scope notes.

# Backend Supabase + Duffel Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect the existing Employee-only frontend (currently `localStorage` + mocked Duffel-shaped data) to a real backend: Supabase Auth (2 seeded accounts, Employee/Admin), Postgres via Supabase (RLS-enforced `requests` table), and the real Duffel Sandbox API for flight search — without building the Travel Admin approval flow yet (placeholder page only).

**Architecture:** Next.js Route Handlers (`src/app/api/`) + Server Components read/write Postgres through a cookie-scoped Supabase client that respects Row Level Security — there is no manual "filter by employee_id" application code, Postgres itself enforces it via the policies in `supabase/migrations/0001_init.sql` (already applied). A new `(app)` route group wraps the existing Employee pages with an auth-guarded sidebar layout; `/login` and `/admin` (placeholder) sit outside it. `src/lib/requests-store.tsx` (the `localStorage`-backed Context) is deleted entirely — Server Components fetch directly, mutations go through Route Handlers followed by `router.refresh()`.

**Tech Stack:** Next.js 14 App Router, TypeScript, `@supabase/ssr` + `@supabase/supabase-js`, react-hook-form + zod, shadcn/ui (Radix) + Tailwind, sonner, vitest.

## Global Constraints

- **Protected — byte-for-byte untouched:** `tailwind.config.ts`, `components.json`, `src/styles/paggo-shadcn-vars.css`, `src/lib/policy.ts` (the Policy Engine stays hardcoded in this phase — migrating it to a `policy_rules` table was explicitly deferred, see `docs/SchemaGuide.md`).
- **Env vars already set** in `travel-app/.env.local` (gitignored, already applied to a live Supabase project): `DUFFEL_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. **The service role key is not used anywhere in this plan's application code** — every Supabase call goes through the cookie-scoped client (`src/lib/supabase/server.ts`), so RLS is the actual enforcement mechanism, not a manual filter. The service role key exists only for one-off admin scripts (the two demo users were already created with it, manually, before this plan).
- **Demo accounts already created** in Supabase Auth + `profiles`: Employee `employee@demo.com` / `Employee#Demo2026`; Admin `admin@demo.com` / `Admin#Demo2026`. Do not recreate them.
- **Database already migrated**: `organizations`, `profiles`, `requests` tables + RLS policies exist in Supabase (`supabase/migrations/0001_init.sql`, already run). Schema reference: `docs/SchemaGuide.md`.
- **Route group `(app)`**: a Next.js route group — the parenthesized folder name is not part of the URL. Moving `src/app/page.tsx` to `src/app/(app)/page.tsx` keeps it served at `/`.
- **Testing convention (existing repo precedent, do not deviate):** this repo has no component-rendering test setup (`vitest.config.ts` uses `environment: "node"`, no `@testing-library/react`). Pure-logic files in `src/lib/**/*.ts` get real vitest unit tests in a co-located `*.test.ts`. React components/pages/Route Handlers get **no** automated test — verify with `npm run build`, `npm run lint`, and the manual checklist in the final task.
- **Commands to run after every task** (from `travel-app/`): `npm test` (vitest run) and `npm run lint`; additionally `npm run build` after every task in Phase 1 onward (routing/auth changes are easy to silently break).
- **Money/date/duration formatting:** reuse `formatCurrency`/`formatDate`/`formatDuration` etc. from `src/lib/offer-format.ts` — never inline a new `Intl` call.
- **Icons:** `lucide-react` only.
- **Dead code removed in Phase 3, not before:** `src/lib/requests-store.tsx` and `src/lib/requests-reducer.ts` (+ its test) are read by `src/components/layout/app-providers.tsx` and the pages being rewritten — delete only after every consumer has been migrated (Task 21), never earlier.

---

## Phase 0 — Supabase & Duffel foundations

### Task 1: Install Supabase client dependencies

**Files:**
- Modify: `package.json`

**Interfaces:**
- Produces: `@supabase/supabase-js`, `@supabase/ssr` available as imports for every later task in this plan.

- [ ] **Step 1: Add the dependencies**

In `travel-app/package.json`, add to `"dependencies"` (keep alphabetical order with the existing entries):

```json
    "@supabase/ssr": "^0.5.2",
    "@supabase/supabase-js": "^2.45.4",
```

- [ ] **Step 2: Install**

Run (from `travel-app/`): `npm install`
Expected: installs cleanly, `package-lock.json` updates, no peer-dependency errors.

- [ ] **Step 3: Verify the packages resolve**

Run: `node -e "require('@supabase/supabase-js'); require('@supabase/ssr'); console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add supabase client dependencies"
```

### Task 2: Supabase browser + server clients

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`

**Interfaces:**
- Produces: `createSupabaseBrowserClient()` (for Client Components), `createSupabaseServerClient()` (for Server Components and Route Handlers — both read and write cookies, works in both contexts per the standard `@supabase/ssr` Next.js App Router pattern).
- Consumed by: every task from here on that touches auth or the database.

- [ ] **Step 1: Create the browser client**

`src/lib/supabase/client.ts`:

```ts
import { createBrowserClient } from "@supabase/ssr";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Create the server client**

`src/lib/supabase/server.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createSupabaseServerClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called during a Server Component render, where cookies are
            // read-only. The middleware (Task 4) refreshes the session
            // cookie on the next request, so this is safe to ignore.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors (these files aren't imported by anything yet, so this mostly checks syntax).

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase/client.ts src/lib/supabase/server.ts
git commit -m "feat: add supabase browser and server client factories"
```

### Task 3: Session helper (`getCurrentProfile`)

**Files:**
- Create: `src/lib/session.ts`
- Test: `src/lib/session.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` from Task 2.
- Produces: `getCurrentProfile(): Promise<CurrentProfile | null>`, `CurrentProfile { id, organizationId, role: "employee" | "admin", fullName }` — used by the `(app)` layout (Task 8), `/admin` page (Task 12), and anywhere else that needs "who is logged in".

- [ ] **Step 1: Write the failing test**

`src/lib/session.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock("./supabase/server", () => ({
  createSupabaseServerClient: () => ({
    auth: { getUser: mockGetUser },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: mockSingle,
        }),
      }),
    }),
  }),
}));

import { getCurrentProfile } from "./session";

describe("getCurrentProfile", () => {
  it("returns null when there is no authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("returns null when the user has no profile row", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({ data: null });
    const result = await getCurrentProfile();
    expect(result).toBeNull();
  });

  it("maps a profile row into CurrentProfile", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "u1" } } });
    mockSingle.mockResolvedValueOnce({
      data: { id: "u1", organization_id: "org1", role: "admin", full_name: "Admin Demo" },
    });
    const result = await getCurrentProfile();
    expect(result).toEqual({
      id: "u1",
      organizationId: "org1",
      role: "admin",
      fullName: "Admin Demo",
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/session.test.ts`
Expected: FAIL — `Cannot find module './session'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

`src/lib/session.ts`:

```ts
import { createSupabaseServerClient } from "./supabase/server";

export interface CurrentProfile {
  id: string;
  organizationId: string;
  role: "employee" | "admin";
  fullName: string;
}

export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, organization_id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.id,
    organizationId: profile.organization_id,
    role: profile.role as "employee" | "admin",
    fullName: profile.full_name,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/session.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/session.ts src/lib/session.test.ts
git commit -m "feat: add getCurrentProfile session helper"
```

### Task 4: Auth middleware

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` env vars directly (middleware runs in the Edge runtime, before `src/lib/supabase/server.ts`'s `next/headers` cookie API is available in the same form — it needs its own request/response-bound cookie handling).
- Produces: redirects any unauthenticated request (except `/login`, `/api/*`, and Next internals) to `/login`.

- [ ] **Step 1: Create the middleware**

`src/middleware.ts`:

```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|login|api).*)"],
};
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat: add auth middleware redirecting unauthenticated users to /login"
```

(This will make every page 404-loop-free-redirect to a not-yet-existing `/login` until Task 11 — that's expected and fixed within this same plan, not left broken across a released state.)

### Task 5: Duffel raw response types + offer mapping (with tests)

**Files:**
- Create: `src/lib/duffel/types.ts`
- Create: `src/lib/duffel/map-offer.ts`
- Test: `src/lib/duffel/map-offer.test.ts`

**Interfaces:**
- Consumes: `SearchCriteria`, `FlightOffer`, `CabinClass`, `OfferSegment`, `OfferSlice` from `../types` (existing, unchanged).
- Produces: `DuffelRawOffer`, `DuffelOfferRequestResponse`, `DuffelErrorResponse` types; `mapDuffelOfferToFlightOffer(raw: DuffelRawOffer, criteria: SearchCriteria): FlightOffer` — consumed by `src/lib/duffel/client.ts` (Task 6).

- [ ] **Step 1: Create the raw Duffel types**

`src/lib/duffel/types.ts`:

```ts
export interface DuffelRawPlace {
  iata_code: string;
  name: string;
  iata_country_code?: string;
}

export interface DuffelRawSegmentPassenger {
  passenger_id: string;
  cabin_class: string;
  baggages: { type: "carry_on" | "checked"; quantity: number }[];
}

export interface DuffelRawSegment {
  id: string;
  origin: DuffelRawPlace;
  destination: DuffelRawPlace;
  departing_at: string;
  arriving_at: string;
  duration: string;
  marketing_carrier: { iata_code: string; name: string };
  operating_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  aircraft: { name: string } | null;
  origin_terminal: string | null;
  destination_terminal: string | null;
  passengers: DuffelRawSegmentPassenger[];
}

export interface DuffelRawSlice {
  id: string;
  origin: DuffelRawPlace;
  destination: DuffelRawPlace;
  duration: string;
  fare_brand_name: string | null;
  segments: DuffelRawSegment[];
}

export interface DuffelRawConditionDetail {
  allowed: boolean;
  penalty_amount?: string | null;
  penalty_currency?: string | null;
}

export interface DuffelRawOffer {
  id: string;
  total_amount: string;
  total_currency: string;
  expires_at: string;
  owner: { iata_code: string; name: string; logo_symbol_url: string | null };
  slices: DuffelRawSlice[];
  conditions: {
    refund_before_departure: DuffelRawConditionDetail | null;
    change_before_departure: DuffelRawConditionDetail | null;
  };
  passenger_identity_documents_required: boolean;
  total_emissions_kg: string | null;
}

export interface DuffelOfferRequestResponse {
  data: {
    offers: DuffelRawOffer[];
  };
}

export interface DuffelErrorResponse {
  errors: { title: string; message: string; code: string }[];
}
```

- [ ] **Step 2: Write the failing test for the mapping function**

`src/lib/duffel/map-offer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelRawOffer } from "./types";
import type { SearchCriteria } from "../types";

const CRITERIA: SearchCriteria = {
  slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }],
  passengers: [{ type: "adult" }],
  cabin_class: "economy",
};

const RAW_OFFER: DuffelRawOffer = {
  id: "off_00009hj8QQBiixQQOfvL",
  total_amount: "2850.00",
  total_currency: "BRL",
  expires_at: "2026-08-01T12:00:00Z",
  owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "https://example.com/latam.svg" },
  slices: [
    {
      id: "sli_1",
      origin: { iata_code: "GRU", name: "São Paulo Guarulhos", iata_country_code: "BR" },
      destination: { iata_code: "JFK", name: "New York JFK", iata_country_code: "US" },
      duration: "PT10H30M",
      fare_brand_name: "Economy Basic",
      segments: [
        {
          id: "seg_1",
          origin: { iata_code: "GRU", name: "São Paulo Guarulhos" },
          destination: { iata_code: "JFK", name: "New York JFK" },
          departing_at: "2026-08-10T22:30:00Z",
          arriving_at: "2026-08-11T09:00:00Z",
          duration: "PT10H30M",
          marketing_carrier: { iata_code: "LA", name: "LATAM" },
          operating_carrier: { iata_code: "LA", name: "LATAM" },
          marketing_carrier_flight_number: "8084",
          aircraft: { name: "Boeing 787-9" },
          origin_terminal: "3",
          destination_terminal: "4",
          passengers: [
            {
              passenger_id: "pas_1",
              cabin_class: "economy",
              baggages: [
                { type: "carry_on", quantity: 1 },
                { type: "checked", quantity: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
    change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
  },
  passenger_identity_documents_required: true,
  total_emissions_kg: "180",
};

describe("mapDuffelOfferToFlightOffer", () => {
  it("maps the flat legacy fields from the raw Duffel offer", () => {
    const offer = mapDuffelOfferToFlightOffer(RAW_OFFER, CRITERIA);

    expect(offer.id).toBe("off_00009hj8QQBiixQQOfvL");
    expect(offer.origin).toBe("GRU");
    expect(offer.destination).toBe("JFK");
    expect(offer.destinationCountry).toBe("US");
    expect(offer.airline).toBe("LATAM");
    expect(offer.stops).toBe(0);
    expect(offer.refundable).toBe(false);
    expect(offer.totalAmount).toBe(2850);
    expect(offer.currency).toBe("BRL");
    expect(offer.cabinClass).toBe("economy");
  });

  it("maps the Duffel-shaped fields (slices, owner, conditions)", () => {
    const offer = mapDuffelOfferToFlightOffer(RAW_OFFER, CRITERIA);

    expect(offer.slices).toHaveLength(1);
    expect(offer.slices?.[0].segments[0].baggages).toEqual([
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: 1 },
    ]);
    expect(offer.owner?.iata_code).toBe("LA");
    expect(offer.conditions?.change_before_departure.allowed).toBe(true);
    expect(offer.passengerIdentityDocumentsRequired).toBe(true);
    expect(offer.totalEmissionsKg).toBe(180);
    expect(offer.longestSegmentHours).toBeCloseTo(10.5);
  });

  it("computes a round-trip destination as the outbound slice's destination", () => {
    const roundTripCriteria: SearchCriteria = {
      slices: [
        { origin: "GRU", destination: "JFK", departure_date: "2026-08-10" },
        { origin: "JFK", destination: "GRU", departure_date: "2026-08-17" },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    };
    const roundTripOffer: DuffelRawOffer = {
      ...RAW_OFFER,
      slices: [
        RAW_OFFER.slices[0],
        {
          ...RAW_OFFER.slices[0],
          id: "sli_2",
          origin: { iata_code: "JFK", name: "New York JFK", iata_country_code: "US" },
          destination: { iata_code: "GRU", name: "São Paulo Guarulhos", iata_country_code: "BR" },
        },
      ],
    };

    const offer = mapDuffelOfferToFlightOffer(roundTripOffer, roundTripCriteria);
    expect(offer.origin).toBe("GRU");
    expect(offer.destination).toBe("JFK");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: FAIL — `Cannot find module './map-offer'`.

- [ ] **Step 4: Write the implementation**

`src/lib/duffel/map-offer.ts`:

```ts
import type { CabinClass, FlightOffer, OfferSegment, OfferSlice, SearchCriteria } from "../types";
import type { DuffelRawOffer, DuffelRawSlice } from "./types";

function parseDurationHours(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  if (!match) return 0;
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  return hours + minutes / 60;
}

function mapSlice(raw: DuffelRawSlice): OfferSlice {
  return {
    id: raw.id,
    origin: raw.origin.iata_code,
    destination: raw.destination.iata_code,
    duration: raw.duration,
    fare_brand_name: raw.fare_brand_name ?? "",
    segments: raw.segments.map(
      (segment): OfferSegment => ({
        id: segment.id,
        origin: { iata_code: segment.origin.iata_code, name: segment.origin.name },
        destination: { iata_code: segment.destination.iata_code, name: segment.destination.name },
        departing_at: segment.departing_at,
        arriving_at: segment.arriving_at,
        duration: segment.duration,
        marketing_carrier: segment.marketing_carrier,
        operating_carrier: segment.operating_carrier,
        marketing_carrier_flight_number: segment.marketing_carrier_flight_number,
        aircraft: { name: segment.aircraft?.name ?? "" },
        origin_terminal: segment.origin_terminal,
        destination_terminal: segment.destination_terminal,
        // Duffel guarda bagagem por passageiro; a UI mostra um resumo único
        // por trecho, então usamos o primeiro passageiro como referência.
        baggages: segment.passengers[0]?.baggages ?? [],
      })
    ),
  };
}

export function mapDuffelOfferToFlightOffer(
  raw: DuffelRawOffer,
  criteria: SearchCriteria
): FlightOffer {
  const slices = raw.slices.map(mapSlice);
  const firstSlice = slices[0];
  const lastSlice = slices[slices.length - 1];
  const isRoundTrip = slices.length === 2 && lastSlice?.destination === firstSlice?.origin;

  const longestSegmentHours = slices.reduce(
    (max, slice) => Math.max(max, parseDurationHours(slice.duration)),
    0
  );

  const rawFirstSegmentPassenger = raw.slices[0]?.segments[0]?.passengers[0];
  const cabinClass = (rawFirstSegmentPassenger?.cabin_class as CabinClass | undefined) ?? criteria.cabin_class;

  return {
    id: raw.id,
    mode: "flight",
    origin: firstSlice?.origin ?? criteria.slices[0]?.origin ?? "",
    destination: isRoundTrip ? (firstSlice?.destination ?? "") : (lastSlice?.destination ?? ""),
    destinationCountry: raw.slices[0]?.destination.iata_country_code ?? "",
    departureAt: firstSlice?.segments[0]?.departing_at ?? "",
    returnAt: isRoundTrip ? lastSlice?.segments[0]?.departing_at : undefined,
    cabinClass,
    airline: raw.owner.name,
    stops: (firstSlice?.segments.length ?? 1) - 1,
    refundable: raw.conditions.refund_before_departure?.allowed ?? false,
    totalAmount: Number(raw.total_amount),
    currency: raw.total_currency,
    expiresAt: raw.expires_at,
    owner: {
      iata_code: raw.owner.iata_code,
      name: raw.owner.name,
      logo_symbol_url: raw.owner.logo_symbol_url ?? "",
      brand_color: "",
    },
    slices,
    conditions: {
      refund_before_departure: raw.conditions.refund_before_departure ?? { allowed: false },
      change_before_departure: raw.conditions.change_before_departure ?? { allowed: false },
    },
    passengerIdentityDocumentsRequired: raw.passenger_identity_documents_required,
    totalEmissionsKg: raw.total_emissions_kg ? Number(raw.total_emissions_kg) : undefined,
    // Duffel's ancillary-services schema is richer than this MVP's UI needs
    // (it only renders the list when non-empty, and never did even with
    // mock data) — left empty deliberately, matching current behavior.
    availableServices: [],
    fareBrandName: firstSlice?.fare_brand_name,
    longestSegmentHours,
  };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/duffel/types.ts src/lib/duffel/map-offer.ts src/lib/duffel/map-offer.test.ts
git commit -m "feat: map raw Duffel offers into the existing FlightOffer shape"
```

### Task 6: Duffel search client

**Files:**
- Create: `src/lib/duffel/client.ts`

**Interfaces:**
- Consumes: `mapDuffelOfferToFlightOffer` (Task 5), `DUFFEL_API_KEY` env var.
- Produces: `searchFlights(criteria: SearchCriteria): Promise<FlightOffer[]>`, `DuffelSearchError` — consumed by `src/app/api/flights/search/route.ts` (Task 13).

- [ ] **Step 1: Create the client**

`src/lib/duffel/client.ts`:

```ts
import type { FlightOffer, SearchCriteria } from "../types";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelErrorResponse, DuffelOfferRequestResponse } from "./types";

const DUFFEL_API_BASE = "https://api.duffel.com";

export class DuffelSearchError extends Error {}

export async function searchFlights(criteria: SearchCriteria): Promise<FlightOffer[]> {
  const apiKey = process.env.DUFFEL_API_KEY;
  if (!apiKey) {
    throw new DuffelSearchError("DUFFEL_API_KEY não configurada no servidor.");
  }

  const response = await fetch(`${DUFFEL_API_BASE}/air/offer_requests?return_offers=true`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Duffel-Version": "v2",
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      data: {
        slices: criteria.slices,
        passengers: criteria.passengers,
        cabin_class: criteria.cabin_class,
        ...(criteria.max_connections !== undefined
          ? { max_connections: criteria.max_connections }
          : {}),
      },
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as DuffelErrorResponse | null;
    const message = body?.errors?.[0]?.message ?? `Duffel respondeu ${response.status}.`;
    throw new DuffelSearchError(message);
  }

  const json = (await response.json()) as DuffelOfferRequestResponse;
  return json.data.offers.map((offer) => mapDuffelOfferToFlightOffer(offer, criteria));
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/duffel/client.ts
git commit -m "feat: add Duffel offer_requests search client"
```

---

## Phase 1 — Route restructuring + auth pages

### Task 7: Move Employee pages into the `(app)` route group

**Files:**
- Move: `src/app/page.tsx` → `src/app/(app)/page.tsx`
- Move: `src/app/offer/` → `src/app/(app)/offer/`
- Move: `src/app/request/` → `src/app/(app)/request/`
- Move: `src/app/requests/` → `src/app/(app)/requests/`
- Move: `src/app/results/` → `src/app/(app)/results/`

**Interfaces:**
- No code changes in this task — file moves only. URLs are unaffected (route groups aren't part of the path).

- [ ] **Step 1: Move the files**

Run (from `travel-app/`):

```bash
mkdir -p "src/app/(app)"
git mv src/app/page.tsx "src/app/(app)/page.tsx"
git mv src/app/offer "src/app/(app)/offer"
git mv src/app/request "src/app/(app)/request"
git mv src/app/requests "src/app/(app)/requests"
git mv src/app/results "src/app/(app)/results"
```

- [ ] **Step 2: Verify the build still resolves routes**

Run: `npm run build`
Expected: succeeds. The route list Next.js prints should still show `/`, `/offer/[id]`, `/request/passengers/[offerId]`, `/request/review`, `/requests`, `/requests/[id]`, `/results` unchanged.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: move Employee pages into the (app) route group"
```

### Task 8: `(app)` layout — sidebar + session guard

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Modify: `src/app/layout.tsx` (strip sidebar/main wrapper out, keep only html/body/providers)

**Interfaces:**
- Consumes: `getCurrentProfile` (Task 3), `AppSidebar` (rewritten in Task 9).
- Produces: every route under `(app)` renders with the sidebar and a guaranteed non-null `profile`.

- [ ] **Step 1: Create the `(app)` layout**

`src/app/(app)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { getCurrentProfile } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect("/login");
  }

  return (
    <>
      <AppSidebar fullName={profile.fullName} />
      <main className="min-h-screen lg:pl-[248px]">
        <div className="px-6 pb-16 pt-8">{children}</div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Slim down the root layout**

Replace the full contents of `src/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/layout/app-providers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Travel App",
  description: "Solicitação de viagens corporativas — pré-viagem",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.variable} font-sans antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify (will still fail to build until Task 9 updates `AppSidebar`'s props — that's expected, continue to the next task before checking)**

No standalone verification here; Task 9 must land first for `npm run build` to succeed again.

- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/layout.tsx" src/app/layout.tsx
git commit -m "feat: add auth-guarded (app) layout, slim down root layout"
```

### Task 9: Real user identity in the sidebar + sign-out

**Files:**
- Create: `src/components/layout/sign-out-button.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient` (Task 2).
- Produces: `AppSidebar({ fullName }: { fullName: string })` (breaking prop change from the old zero-prop version — this is why Task 8 had to land first), `SignOutButton` (also reused in Task 12).

- [ ] **Step 1: Create the sign-out button**

`src/components/layout/sign-out-button.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" className={className} onClick={handleSignOut}>
      <LogOut className="mr-1.5 h-4 w-4" /> Sair
    </Button>
  );
}
```

- [ ] **Step 2: Rewrite the sidebar to take `fullName` as a prop**

Replace the full contents of `src/components/layout/app-sidebar.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "./sign-out-button";

const NAV_ITEMS = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
] as const;

function initialsFromName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function AppSidebar({ fullName }: { fullName: string }) {
  const pathname = usePathname();
  const initials = initialsFromName(fullName);

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="flex h-14 items-center px-6">
          <img src="/paggo-logo-light.svg" alt="Paggo" className="h-6 w-auto" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  active && "bg-sidebar-accent text-sidebar-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-col gap-3 border-t border-sidebar-border px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </span>
            <span className="text-sm font-medium">{fullName}</span>
          </div>
          <SignOutButton />
        </div>
      </aside>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-sidebar-border bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <img src="/paggo-icon.svg" alt="Paggo" className="h-6 w-6" />
        <nav className="flex items-center gap-4">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "text-sm font-medium text-sidebar-foreground/70",
                pathname === item.href && "text-sidebar-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
          {initials}
        </span>
      </header>
    </>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed (the sidebar's prop type now matches how `(app)/layout.tsx` calls it).

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/sign-out-button.tsx src/components/layout/app-sidebar.tsx
git commit -m "feat: show the real logged-in user in the sidebar, add sign-out"
```

### Task 10: Simplify `AppProviders`

**Files:**
- Modify: `src/components/layout/app-providers.tsx`

**Interfaces:**
- Produces: `AppProviders` no longer wraps `RequestsProvider`/`TravelRequestsProvider` (those are deleted in Task 21 — this task just stops using them so the deletion doesn't require touching this file again).

- [ ] **Step 1: Remove the two localStorage-backed providers**

Replace the full contents of `src/components/layout/app-providers.tsx` with:

```tsx
"use client";

import type { ReactNode } from "react";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TripFlowProvider>
      <TooltipProvider delayDuration={150}>
        {children}
        <Toaster position="bottom-center" />
      </TooltipProvider>
    </TripFlowProvider>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: new errors will appear in files still importing `useRequests`/`useTravelRequests` (the review and requests pages) — that's expected, they're fixed in Phase 3. Confirm the *only* new errors are in `src/app/(app)/request/review/page.tsx`, `src/app/(app)/requests/page.tsx`, `src/app/(app)/requests/[id]/page.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/app-providers.tsx
git commit -m "refactor: drop localStorage-backed request providers from AppProviders"
```

### Task 11: Login page

**Files:**
- Create: `src/app/login/page.tsx`

**Interfaces:**
- Consumes: `createSupabaseBrowserClient` (Task 2).
- Produces: `/login` route, outside the `(app)` group (no sidebar), reachable without a session (excluded from the middleware's protected matcher).

- [ ] **Step 1: Create the login page**

`src/app/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const loginSchema = z.object({
  email: z.string().email("Informe um email válido"),
  password: z.string().min(1, "Informe a senha"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const DEMO_CREDENTIALS = [
  { role: "Employee", email: "employee@demo.com", password: "Employee#Demo2026" },
  { role: "Admin", email: "admin@demo.com", password: "Admin#Demo2026" },
] as const;

export default function LoginPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginFormValues) {
    setSubmitting(true);
    const supabase = createSupabaseBrowserClient();
    const { data, error } = await supabase.auth.signInWithPassword(values);

    if (error || !data.user) {
      toast.error("Email ou senha inválidos.");
      setSubmitting(false);
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(profile?.role === "admin" ? "/admin" : "/");
    router.refresh();
  }

  function fillDemo(email: string, password: string) {
    form.setValue("email", email);
    form.setValue("password", password);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex flex-col items-center gap-2">
          <img src="/paggo-icon.svg" alt="Paggo" className="h-10 w-10" />
          <h1 className="text-xl font-semibold text-foreground">Travel App</h1>
        </div>

        <Card>
          <CardContent className="p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="voce@empresa.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Senha</FormLabel>
                      <FormControl>
                        <Input type="password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brand-gradient hover:bg-brand-gradient-hover"
                >
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex flex-col gap-3 p-6">
            <p className="text-xs font-medium uppercase text-muted-foreground">
              Contas de demonstração
            </p>
            {DEMO_CREDENTIALS.map((cred) => (
              <button
                key={cred.role}
                type="button"
                onClick={() => fillDemo(cred.email, cred.password)}
                className="flex flex-col items-start gap-0.5 rounded-md border border-border p-3 text-left text-xs hover:border-foreground/30"
              >
                <span className="font-semibold text-foreground">{cred.role}</span>
                <span className="text-muted-foreground">
                  {cred.email} · {cred.password}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, open `http://localhost:3000/login`, click the "Employee" demo card (fills the form), submit. Expected: redirected to `/` and the sidebar shows "Funcionário Demo". Then sign out via the sidebar button, log in with the "Admin" card. Expected: redirected to `/admin` (a 404 is expected until Task 12 lands — come back and re-check after that task).

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: add login page with Supabase Auth and visible demo credentials"
```

### Task 12: Admin placeholder page

**Files:**
- Create: `src/app/admin/page.tsx`

**Interfaces:**
- Consumes: `getCurrentProfile` (Task 3), `SignOutButton` (Task 9).
- Produces: `/admin` route, outside the `(app)` group (no Employee sidebar) — real session required (enforced by middleware), then a same-organization role check redirects non-admins to `/`.

- [ ] **Step 1: Create the page**

`src/app/admin/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/session";
import { SignOutButton } from "@/components/layout/sign-out-button";

export default async function AdminPlaceholderPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "admin") redirect("/");

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <img src="/paggo-icon.svg" alt="Paggo" className="h-10 w-10" />
      <h1 className="text-xl font-semibold text-foreground">Admin Panel em construção</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        Olá, {profile.fullName}. A aprovação de solicitações e o painel do Travel Admin ainda não
        foram implementados nesta fase do projeto.
      </p>
      <SignOutButton />
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Manual check**

With the dev server running, log in as `admin@demo.com`. Expected: lands on `/admin`, sees the placeholder with "Olá, Admin Demo." and a working "Sair" button. Log in as `employee@demo.com` and manually navigate to `/admin`. Expected: redirected back to `/`.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: add Admin placeholder page with role-based redirect"
```

---

## Phase 2 — Real Duffel search

### Task 13: `/api/flights/search` Route Handler

**Files:**
- Create: `src/app/api/flights/search/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2), `searchFlights`/`DuffelSearchError` (Task 6).
- Produces: `POST /api/flights/search` — body is a `SearchCriteria` JSON object, response is `{ offers: FlightOffer[] }` (200) or `{ error: string }` (401/400/502/500).

- [ ] **Step 1: Create the route**

`src/app/api/flights/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DuffelSearchError, searchFlights } from "@/lib/duffel/client";
import type { SearchCriteria } from "@/lib/types";

const searchCriteriaSchema = z.object({
  slices: z
    .array(
      z.object({
        origin: z.string().length(3),
        destination: z.string().length(3),
        departure_date: z.string().min(1),
      })
    )
    .min(1),
  passengers: z
    .array(z.object({ type: z.enum(["adult", "child", "infant_without_seat"]) }))
    .min(1),
  cabin_class: z.enum(["economy", "premium_economy", "business", "first"]),
  max_connections: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  preferences: z
    .object({
      arrive_by_outbound: z.string().optional(),
      depart_after_return: z.string().optional(),
    })
    .optional(),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = searchCriteriaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Critérios de busca inválidos." }, { status: 400 });
  }

  try {
    const offers = await searchFlights(parsed.data as SearchCriteria);
    return NextResponse.json({ offers });
  } catch (error) {
    if (error instanceof DuffelSearchError) {
      return NextResponse.json({ error: error.message }, { status: 502 });
    }
    return NextResponse.json({ error: "Erro inesperado ao buscar voos." }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Manual check (real Duffel sandbox call)**

With `npm run dev` running and logged in (cookie present in the browser you `curl` from won't apply — test via the browser's devtools Network tab instead, or temporarily allow one unauthenticated manual call by checking the terminal logs). Simplest: leave this manual check to Task 14's end-to-end check, since driving it through the browser flow both proves auth and the mapping at once.

- [ ] **Step 4: Commit**

```bash
git add "src/app/api/flights/search/route.ts"
git commit -m "feat: add POST /api/flights/search route handler calling Duffel"
```

### Task 14: Wire `results/page.tsx` to the real search endpoint

**Files:**
- Modify: `src/app/(app)/results/page.tsx`

**Interfaces:**
- Removes: `generateOffers` import from `@/lib/mock-data`.
- Consumes: `ErrorState` from `@/components/ui/error-state` (existing component, unused until now).

- [ ] **Step 1: Replace the mock search effect with a real fetch**

In `src/app/(app)/results/page.tsx`, remove this import:

```tsx
import { generateOffers } from "@/lib/mock-data";
```

Add this import:

```tsx
import { ErrorState } from "@/components/ui/error-state";
```

Replace the existing `useEffect` block:

```tsx
  useEffect(() => {
    if (!criteria) return;
    startLoadingOffers();
    const timeout = setTimeout(() => {
      setOffers(generateOffers(criteria));
    }, 1200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria]);
```

with:

```tsx
  const [searchError, setSearchError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!criteria) return;
    let cancelled = false;

    async function runSearch() {
      startLoadingOffers();
      setSearchError(null);
      try {
        const response = await fetch("/api/flights/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(criteria),
        });
        const body = await response.json();
        if (!response.ok) {
          throw new Error(body.error ?? "Não foi possível buscar voos agora.");
        }
        if (!cancelled) setOffers(body.offers as FlightOffer[]);
      } catch (err) {
        if (!cancelled) {
          setOffers([]);
          setSearchError(err instanceof Error ? err.message : "Não foi possível buscar voos agora.");
        }
      }
    }

    runSearch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria, retryKey]);
```

(`useState` is already imported at the top of the file alongside `useEffect`/`useMemo` — no new import needed for that.)

- [ ] **Step 2: Show the error state instead of results when the search failed**

Replace this block:

```tsx
          {loadingOffers ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
          ) : filtered.length === 0 ? (
```

with:

```tsx
          {searchError ? (
            <ErrorState
              title="Não foi possível buscar voos"
              description={searchError}
              onRetry={() => setRetryKey((k) => k + 1)}
            />
          ) : loadingOffers ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
          ) : filtered.length === 0 ? (
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Manual end-to-end check**

`npm run dev`, log in as `employee@demo.com`, run a search for a real route (e.g. origin `LHR`, destination `JFK`, a departure date a few weeks out — Duffel's test mode has the richest sample data for major routes like this one; `GRU`/`JFK` may also work but has less guaranteed sandbox coverage). Expected: after a real network round-trip (not the old fixed 1200ms), a list of real airline offers renders. Confirm: prices look plausible, clicking into an offer's detail page still works, and temporarily disconnecting network + retrying shows the `ErrorState` with a working "Tentar novamente" button.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/results/page.tsx"
git commit -m "feat: search real Duffel flights on the results page, handle errors"
```

---

## Phase 3 — Requests persistence in Supabase

### Task 15: Requests row → `TravelRequest` mapper (with test)

**Files:**
- Create: `src/lib/requests-mapper.ts`
- Test: `src/lib/requests-mapper.test.ts`

**Interfaces:**
- Consumes: `TravelRequest` type from `./types` (unchanged).
- Produces: `RequestRow` (shape of a `requests` table row), `toTravelRequest(row: RequestRow): TravelRequest` — consumed by every Route Handler and Server Component in this phase.

- [ ] **Step 1: Write the failing test**

`src/lib/requests-mapper.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toTravelRequest, type RequestRow } from "./requests-mapper";

const ROW: RequestRow = {
  id: "req_1",
  organization_id: "org_1",
  employee_id: "emp_1",
  status: "pending_admin",
  total_amount: 2850,
  total_currency: "BRL",
  created_at: "2026-07-10T14:00:00Z",
  search_criteria: {
    slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
  },
  selected_offer_snapshot: {
    offer_id: "off_1",
    total_amount: "2850.00",
    total_currency: "BRL",
    owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
    slices: [],
    conditions: {
      refund_before_departure: { allowed: false },
      change_before_departure: { allowed: false },
    },
    passenger_identity_documents_required: false,
    expires_at: "2026-08-01T00:00:00Z",
  },
  passengers: [],
  corporate: {
    trip_purpose: "client_meeting",
    cost_center: "Engenharia",
    business_justification: "Reunião com cliente estratégico.",
  },
  policy_evaluation: {
    compliant: true,
    violations: [],
    flags: { international_travel: true, cost_above_threshold: false },
  },
  events: [{ at: "2026-07-10T14:00:00Z", kind: "created" }],
};

describe("toTravelRequest", () => {
  it("maps a database row into the TravelRequest shape the UI expects", () => {
    const result = toTravelRequest(ROW);
    expect(result.id).toBe("req_1");
    expect(result.status).toBe("pending_admin");
    expect(result.corporate.cost_center).toBe("Engenharia");
    expect(result.events).toHaveLength(1);
    expect(result.selected_offer_snapshot.owner.name).toBe("LATAM");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/requests-mapper.test.ts`
Expected: FAIL — `Cannot find module './requests-mapper'`.

- [ ] **Step 3: Write the implementation**

`src/lib/requests-mapper.ts`:

```ts
import type { TravelRequest } from "./types";

export interface RequestRow {
  id: string;
  organization_id: string;
  employee_id: string;
  status: TravelRequest["status"];
  total_amount: number;
  total_currency: string;
  created_at: string;
  search_criteria: TravelRequest["search_criteria"];
  selected_offer_snapshot: TravelRequest["selected_offer_snapshot"];
  passengers: TravelRequest["passengers"];
  corporate: TravelRequest["corporate"];
  policy_evaluation: TravelRequest["policy_evaluation"];
  events: TravelRequest["events"];
}

export function toTravelRequest(row: RequestRow): TravelRequest {
  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    created_at: row.created_at,
    status: row.status,
    search_criteria: row.search_criteria,
    selected_offer_snapshot: row.selected_offer_snapshot,
    passengers: row.passengers,
    corporate: row.corporate,
    policy_evaluation: row.policy_evaluation,
    events: row.events,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/requests-mapper.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/requests-mapper.ts src/lib/requests-mapper.test.ts
git commit -m "feat: add requests table row -> TravelRequest mapper"
```

### Task 16: `POST /api/requests` — create a request

**Files:**
- Create: `src/app/api/requests/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2), `toTravelRequest` (Task 15).
- Produces: `POST /api/requests` — body matches the fields the client already builds in the review page (Task 18 sends this shape); response is `{ request: TravelRequest }` (201) or `{ error: string }`.

- [ ] **Step 1: Create the route**

`src/app/api/requests/route.ts`:

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";

const requestCreateSchema = z.object({
  search_criteria: z.object({
    slices: z
      .array(
        z.object({
          origin: z.string(),
          destination: z.string(),
          departure_date: z.string(),
        })
      )
      .min(1),
    passengers: z.array(z.object({ type: z.enum(["adult", "child", "infant_without_seat"]) })).min(1),
    cabin_class: z.enum(["economy", "premium_economy", "business", "first"]),
    max_connections: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
    preferences: z
      .object({ arrive_by_outbound: z.string().optional(), depart_after_return: z.string().optional() })
      .optional(),
  }),
  selected_offer_snapshot: z.object({
    offer_id: z.string(),
    total_amount: z.string(),
    total_currency: z.string(),
    owner: z.object({ iata_code: z.string(), name: z.string(), logo_symbol_url: z.string() }),
    slices: z.array(z.any()),
    conditions: z.any(),
    passenger_identity_documents_required: z.boolean(),
    total_emissions_kg: z.number().optional(),
    expires_at: z.string(),
  }),
  passengers: z.array(z.any()).min(1),
  corporate: z.object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"]),
    cost_center: z.string(),
    project_code: z.string().optional(),
    business_justification: z.string(),
    out_of_policy_justification: z.string().optional(),
  }),
  policy_evaluation: z.object({
    compliant: z.boolean(),
    violations: z.array(z.any()),
    flags: z.object({ international_travel: z.boolean(), cost_above_threshold: z.boolean() }),
  }),
  events: z.array(
    z.object({ at: z.string(), kind: z.string(), actor_id: z.string().optional(), note: z.string().optional() })
  ),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile) {
    return NextResponse.json({ error: "Perfil não encontrado." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados da solicitação inválidos." }, { status: 400 });
  }

  const totalAmount = Number(parsed.data.selected_offer_snapshot.total_amount);

  const { data: inserted, error } = await supabase
    .from("requests")
    .insert({
      organization_id: profile.organization_id,
      employee_id: user.id,
      status: "pending_admin",
      total_amount: totalAmount,
      total_currency: parsed.data.selected_offer_snapshot.total_currency,
      search_criteria: parsed.data.search_criteria,
      selected_offer_snapshot: parsed.data.selected_offer_snapshot,
      passengers: parsed.data.passengers,
      corporate: parsed.data.corporate,
      policy_evaluation: parsed.data.policy_evaluation,
      events: parsed.data.events,
    })
    .select()
    .single();

  if (error || !inserted) {
    return NextResponse.json({ error: "Não foi possível salvar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(inserted) }, { status: 201 });
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/requests/route.ts"
git commit -m "feat: add POST /api/requests route handler"
```

### Task 17: `POST /api/requests/[id]/cancel`

**Files:**
- Create: `src/app/api/requests/[id]/cancel/route.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` (Task 2), `toTravelRequest` (Task 15), `TravelRequestEvent` type.
- Produces: `POST /api/requests/:id/cancel` — response is `{ request: TravelRequest }` (200), or 401/404/409/500 with `{ error: string }`.

- [ ] **Step 1: Create the route**

`src/app/api/requests/[id]/cancel/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import type { TravelRequestEvent } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: existing } = await supabase
    .from("requests")
    .select("id, status, events")
    .eq("id", params.id)
    .single();

  if (!existing) {
    return NextResponse.json({ error: "Solicitação não encontrada." }, { status: 404 });
  }
  if (existing.status !== "pending_admin") {
    return NextResponse.json(
      { error: "Só é possível cancelar solicitações aguardando aprovação." },
      { status: 409 }
    );
  }

  const cancelEvent: TravelRequestEvent = { at: new Date().toISOString(), kind: "cancelled" };
  const events = [...(existing.events as TravelRequestEvent[]), cancelEvent];

  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "cancelled", events })
    .eq("id", params.id)
    .select()
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível cancelar a solicitação." }, { status: 500 });
  }

  return NextResponse.json({ request: toTravelRequest(updated) });
}
```

- [ ] **Step 2: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/requests/[id]/cancel/route.ts"
git commit -m "feat: add POST /api/requests/:id/cancel route handler"
```

### Task 18: Wire `request/review/page.tsx` to `POST /api/requests`

**Files:**
- Modify: `src/app/(app)/request/review/page.tsx`

**Interfaces:**
- Removes: `useTravelRequests` import from `@/lib/requests-store`, the local `TravelRequest` construction with a client-generated id/`org-paggo`/`emp-aaron-moura`.

- [ ] **Step 1: Update imports**

Remove:

```tsx
import { useTravelRequests } from "@/lib/requests-store";
import type { TravelRequest } from "@/lib/types";
```

Add:

```tsx
import { useState } from "react";
```

(`useRouter`, `useForm`, `zodResolver`, `toast`, and the UI components stay as they are.)

- [ ] **Step 2: Replace the component body's data hook and submit handler**

Replace:

```tsx
  const { criteria, selectedOffer: offer, passengers, corporate, reset } = useTripFlow();
  const { addTravelRequest } = useTravelRequests();
  const evaluation = offer ? evaluateDuffelOffer(offer) : null;
```

with:

```tsx
  const { criteria, selectedOffer: offer, passengers, corporate, reset } = useTripFlow();
  const evaluation = offer ? evaluateDuffelOffer(offer) : null;
  const [submitting, setSubmitting] = useState(false);
```

Replace the entire `onSubmit` function:

```tsx
  function onSubmit(values: CorporateContextFormValues) {
    if (!criteria || !offer || !passengers || !evaluation) return;
    const now = new Date().toISOString();
    const request: TravelRequest = {
      id: `req_${Math.random().toString(36).slice(2, 10)}`,
      organization_id: "org-paggo",
      employee_id: "emp-aaron-moura",
      created_at: now,
      status: "pending_admin",
      search_criteria: criteria,
      selected_offer_snapshot: {
        offer_id: offer.id,
        total_amount: String(offer.totalAmount),
        total_currency: offer.currency,
        owner: {
          iata_code: offer.owner?.iata_code ?? "",
          name: offer.airline,
          logo_symbol_url: offer.owner?.logo_symbol_url ?? "",
        },
        slices: (offer.slices ?? []).map((slice) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_datetime: slice.segments[0]?.departing_at ?? "",
          arrival_datetime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
          duration: slice.duration,
          segments_count: slice.segments.length,
          fare_brand_name: slice.fare_brand_name,
        })),
        conditions: offer.conditions ?? {
          refund_before_departure: { allowed: false },
          change_before_departure: { allowed: false },
        },
        passenger_identity_documents_required: offer.passengerIdentityDocumentsRequired ?? false,
        total_emissions_kg: offer.totalEmissionsKg,
        expires_at: offer.expiresAt ?? now,
      },
      passengers,
      corporate: {
        trip_purpose: values.trip_purpose,
        cost_center: values.cost_center,
        project_code: values.project_code || undefined,
        business_justification: values.business_justification,
        out_of_policy_justification: values.isOutOfPolicy ? values.out_of_policy_justification : undefined,
      },
      policy_evaluation: {
        compliant: evaluation.compliant,
        violations: evaluation.violations,
        flags: evaluation.flags,
      },
      events: [{ at: now, kind: "created" }],
    };

    addTravelRequest(request);
    reset();
    toast.success("Solicitação enviada. Aguardando aprovação do Travel Admin.");
    router.push(`/requests/${request.id}`);
  }
```

with:

```tsx
  async function onSubmit(values: CorporateContextFormValues) {
    if (!criteria || !offer || !passengers || !evaluation) return;
    const now = new Date().toISOString();

    const payload = {
      search_criteria: criteria,
      selected_offer_snapshot: {
        offer_id: offer.id,
        total_amount: String(offer.totalAmount),
        total_currency: offer.currency,
        owner: {
          iata_code: offer.owner?.iata_code ?? "",
          name: offer.airline,
          logo_symbol_url: offer.owner?.logo_symbol_url ?? "",
        },
        slices: (offer.slices ?? []).map((slice) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_datetime: slice.segments[0]?.departing_at ?? "",
          arrival_datetime: slice.segments[slice.segments.length - 1]?.arriving_at ?? "",
          duration: slice.duration,
          segments_count: slice.segments.length,
          fare_brand_name: slice.fare_brand_name,
        })),
        conditions: offer.conditions ?? {
          refund_before_departure: { allowed: false },
          change_before_departure: { allowed: false },
        },
        passenger_identity_documents_required: offer.passengerIdentityDocumentsRequired ?? false,
        total_emissions_kg: offer.totalEmissionsKg,
        expires_at: offer.expiresAt ?? now,
      },
      passengers,
      corporate: {
        trip_purpose: values.trip_purpose,
        cost_center: values.cost_center,
        project_code: values.project_code || undefined,
        business_justification: values.business_justification,
        out_of_policy_justification: values.isOutOfPolicy ? values.out_of_policy_justification : undefined,
      },
      policy_evaluation: {
        compliant: evaluation.compliant,
        violations: evaluation.violations,
        flags: evaluation.flags,
      },
      events: [{ at: now, kind: "created" }],
    };

    setSubmitting(true);
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    setSubmitting(false);

    if (!response.ok) {
      toast.error(body.error ?? "Não foi possível enviar a solicitação.");
      return;
    }

    reset();
    toast.success("Solicitação enviada. Aguardando aprovação do Travel Admin.");
    router.push(`/requests/${body.request.id}`);
  }
```

- [ ] **Step 3: Disable the submit button while submitting**

Replace:

```tsx
            <Button type="submit" size="lg" className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Enviar solicitação
            </Button>
```

with:

```tsx
            <Button
              type="submit"
              size="lg"
              disabled={submitting}
              className="bg-brand-gradient hover:bg-brand-gradient-hover"
            >
              {submitting ? "Enviando..." : "Enviar solicitação"}
            </Button>
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(app)/request/review/page.tsx"
git commit -m "feat: submit requests to the backend instead of localStorage"
```

### Task 19: Extract `RequestsList`, rewrite `/requests` as a Server Component

**Files:**
- Create: `src/components/trip/requests-list.tsx`
- Modify: `src/app/(app)/requests/page.tsx` (full rewrite)

**Interfaces:**
- Produces: `RequestsList({ requests: TravelRequest[] })` (Client Component — filtering chips + cancel button, calls `POST /api/requests/:id/cancel` then `router.refresh()`).

- [ ] **Step 1: Create the Client Component**

`src/components/trip/requests-list.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { formatCurrency, formatDate, getRouteLabel } from "@/lib/offer-format";
import type { TravelRequest, TravelRequestStatus } from "@/lib/types";

const STATUS_FILTERS: { value: TravelRequestStatus; label: string }[] = [
  { value: "pending_admin", label: "Aguardando aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "needs_review", label: "Requer revisão" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
];

export function RequestsList({ requests }: { requests: TravelRequest[] }) {
  const router = useRouter();
  const [activeStatuses, setActiveStatuses] = useState<Set<TravelRequestStatus>>(new Set());
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const filtered =
    activeStatuses.size === 0 ? requests : requests.filter((r) => activeStatuses.has(r.status));

  function toggleStatus(status: TravelRequestStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  async function handleCancel(id: string) {
    setCancellingId(id);
    await fetch(`/api/requests/${id}/cancel`, { method: "POST" });
    setCancellingId(null);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Minhas solicitações</h1>
        <Button className="bg-brand-gradient hover:bg-brand-gradient-hover" onClick={() => router.push("/")}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova viagem
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => {
          const active = activeStatuses.has(filter.value);
          return (
            <button
              key={filter.value}
              type="button"
              onClick={() => toggleStatus(filter.value)}
              className={
                active
                  ? "rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background"
                  : "rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:border-foreground/30"
              }
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {requests.length === 0 ? (
        <EmptyState
          icon={Plane}
          title="Você ainda não tem solicitações"
          description="Comece uma nova viagem."
          button={{ label: "Nova viagem", onClick: () => router.push("/") }}
        />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-md border border-border">
          {filtered.map((request) => {
            const snapshot = request.selected_offer_snapshot;
            const { origin, destination } = getRouteLabel(snapshot.slices);
            return (
              <div
                key={request.id}
                className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {origin} → {destination}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {snapshot.slices.length > 1 ? "Ida e volta" : "Só ida"} ·{" "}
                    {formatDate(snapshot.slices[0]?.departure_datetime ?? request.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 sm:contents">
                  <span className="text-sm text-muted-foreground">
                    {request.passengers.length} passageiro{request.passengers.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                  </span>
                  <RequestStatusBadge status={request.status} />
                  <span className="text-xs text-muted-foreground">
                    Criada em {formatDate(request.created_at)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {request.status === "pending_admin" ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={cancellingId === request.id}
                      onClick={() => handleCancel(request.id)}
                    >
                      {cancellingId === request.id ? "Cancelando..." : "Cancelar"}
                    </Button>
                  ) : null}
                  <Button type="button" variant="secondary" size="sm" asChild>
                    <Link href={`/requests/${request.id}`}>Ver detalhes</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Rewrite the page as a Server Component**

Replace the full contents of `src/app/(app)/requests/page.tsx` with:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestsList } from "@/components/trip/requests-list";

export default async function RequestsPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("requests")
    .select("*")
    .order("created_at", { ascending: false });

  const requests = (rows ?? []).map(toTravelRequest);

  return <RequestsList requests={requests} />;
}
```

- [ ] **Step 3: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 4: Manual check**

As `employee@demo.com`, complete a full search → offer → passengers → review → submit flow (from Task 14's end-to-end check). Expected: lands on `/requests/<id>` (Task 20 makes that page work), and `/requests` lists the new request with status "Aguardando aprovação" and a working "Cancelar" button that updates the row and re-renders without a full page reload.

- [ ] **Step 5: Commit**

```bash
git add src/components/trip/requests-list.tsx "src/app/(app)/requests/page.tsx"
git commit -m "feat: fetch requests from Supabase, extract RequestsList component"
```

### Task 20: Extract `RequestDetailView`, rewrite `/requests/[id]` as a Server Component

**Files:**
- Create: `src/components/trip/request-detail-view.tsx`
- Create: `src/components/trip/request-not-found.tsx`
- Modify: `src/app/(app)/requests/[id]/page.tsx` (full rewrite)

**Interfaces:**
- Produces: `RequestDetailView({ request: TravelRequest })` (Client Component — sensitive-data toggle + cancel dialog, calls `POST /api/requests/:id/cancel` then `router.refresh()`), `RequestNotFound` (small Client Component so the "not found" `EmptyState`'s `onClick` can stay client-side even though the page itself is now a Server Component).

- [ ] **Step 1: Create the not-found Client Component**

`src/components/trip/request-not-found.tsx`:

```tsx
"use client";

import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";

export function RequestNotFound() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-[1080px]">
      <EmptyState
        title="Solicitação não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        button={{ label: "Minhas solicitações", onClick: () => router.push("/requests") }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Create the detail Client Component**

`src/components/trip/request-detail-view.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getTravelRequestTimelineLabel } from "@/lib/badge-variants";
import { formatCurrency, formatDate, formatDateTime, getRouteLabel } from "@/lib/offer-format";
import { maskEmail, maskGivenName, maskPhone } from "@/lib/passenger-masking";
import type { TravelRequest } from "@/lib/types";

const TRIP_PURPOSE_LABELS: Record<string, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};

export function RequestDetailView({ request }: { request: TravelRequest }) {
  const router = useRouter();
  const [showSensitive, setShowSensitive] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const snapshot = request.selected_offer_snapshot;
  const rejectionEvent = [...request.events].reverse().find((event) => event.kind === "rejected");
  const { origin: routeOrigin, destination: routeDestination } = getRouteLabel(snapshot.slices);

  async function handleCancelConfirm() {
    setCancelling(true);
    await fetch(`/api/requests/${request.id}/cancel`, { method: "POST" });
    setCancelling(false);
    setCancelOpen(false);
    router.refresh();
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/requests")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        ← Minhas solicitações
      </button>

      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold text-foreground">
          {routeOrigin} → {routeDestination}
          {snapshot.slices.length > 1 ? " (ida e volta)" : ""}
        </h1>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Criada em {formatDateTime(request.created_at)}
      </p>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Viagem</h2>
                <span className="font-semibold text-foreground">
                  {formatCurrency(Number(snapshot.total_amount), snapshot.total_currency)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{snapshot.owner.name}</p>
              {snapshot.slices.map((slice, index) => (
                <div key={`${slice.origin}-${slice.destination}-${index}`} className="text-sm">
                  {index === 0 ? "Ida" : "Volta"} {formatDate(slice.departure_datetime)} · {slice.origin} →{" "}
                  {slice.destination} · {slice.fare_brand_name}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-foreground">Passageiros</h2>
                <button
                  type="button"
                  onClick={() => setShowSensitive((v) => !v)}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {showSensitive ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  {showSensitive ? "Ocultar dados sensíveis" : "Mostrar dados sensíveis"}
                </button>
              </div>
              {request.passengers.map((passenger) => (
                <div key={passenger.id} className="text-sm">
                  <p className="font-medium text-foreground">
                    {showSensitive
                      ? `${passenger.given_name} ${passenger.family_name}`
                      : maskGivenName(passenger.given_name, passenger.family_name)}
                    {" · "}
                    {passenger.type === "adult" ? "Adulto" : passenger.type === "child" ? "Criança" : "Bebê"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {showSensitive ? passenger.email : maskEmail(passenger.email)} ·{" "}
                    {showSensitive ? passenger.phone_number : maskPhone(passenger.phone_number)}
                    {passenger.identity_documents?.length ? " · Passaporte ******" : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-2 p-6 text-sm">
              <h2 className="text-base font-semibold text-foreground">Contexto corporativo</h2>
              <p>Motivo: {TRIP_PURPOSE_LABELS[request.corporate.trip_purpose]}</p>
              <p>Centro de custo: {request.corporate.cost_center}</p>
              {request.corporate.project_code ? <p>Projeto: {request.corporate.project_code}</p> : null}
              <p className="text-muted-foreground">{request.corporate.business_justification}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <h2 className="text-base font-semibold text-foreground">Avaliação de política</h2>
              <PolicyBadges evaluation={request.policy_evaluation} />
              {!request.policy_evaluation.compliant ? (
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {request.policy_evaluation.violations.map((violation) => (
                    <li key={violation.rule_id}>{violation.message}</li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-6">
              <p className="text-xs font-medium uppercase text-muted-foreground">Status</p>
              <RequestStatusBadge status={request.status} />
              {request.status === "rejected" && rejectionEvent?.note ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p className="font-medium">Motivo:</p>
                  <p>{rejectionEvent.note}</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-3 border-l-2 border-border pl-4">
                {request.events.map((event, index) => (
                  <div key={index} className="text-xs">
                    <p className="font-medium text-foreground">{getTravelRequestTimelineLabel(event.kind)}</p>
                    <p className="text-muted-foreground">{formatDateTime(event.at)}</p>
                    {event.note ? <p className="text-muted-foreground">{event.note}</p> : null}
                  </div>
                ))}
              </div>
              {request.status === "pending_admin" ? (
                <Button variant="secondary" className="text-destructive" onClick={() => setCancelOpen(true)}>
                  Cancelar solicitação
                </Button>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar solicitação</DialogTitle>
            <DialogDescription>Essa ação não pode ser desfeita.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Manter
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={handleCancelConfirm}>
              {cancelling ? "Cancelando..." : "Cancelar solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the page as a Server Component**

Replace the full contents of `src/app/(app)/requests/[id]/page.tsx` with:

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toTravelRequest } from "@/lib/requests-mapper";
import { RequestDetailView } from "@/components/trip/request-detail-view";
import { RequestNotFound } from "@/components/trip/request-not-found";

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("requests").select("*").eq("id", params.id).single();

  if (!row) {
    return <RequestNotFound />;
  }

  return <RequestDetailView request={toTravelRequest(row)} />;
}
```

- [ ] **Step 4: Verify**

Run: `npm run build && npm run lint`
Expected: both succeed.

- [ ] **Step 5: Manual check**

Open `/requests/<id>` for a request created in Task 19's check. Expected: full detail renders (route, passengers with mask toggle, corporate context, policy evaluation, event timeline), and the "Cancelar solicitação" dialog works end to end (status flips to "Cancelada", event added, page re-renders via `router.refresh()`). Then navigate to a nonexistent id (e.g. `/requests/does-not-exist`). Expected: "Solicitação não encontrada" empty state with a working button back to `/requests`.

- [ ] **Step 6: Commit**

```bash
git add src/components/trip/request-detail-view.tsx src/components/trip/request-not-found.tsx "src/app/(app)/requests/[id]/page.tsx"
git commit -m "feat: fetch request detail from Supabase, extract RequestDetailView component"
```

### Task 21: Delete the localStorage-backed request store (dead code)

**Files:**
- Delete: `src/lib/requests-store.tsx`
- Delete: `src/lib/requests-reducer.ts`
- Delete: `src/lib/requests-reducer.test.ts`

**Interfaces:**
- Nothing imports these anymore after Tasks 10, 18, 19, 20 — this task only removes files, no code changes elsewhere.

- [ ] **Step 1: Confirm nothing still imports them**

Run: `grep -rn "requests-store\|requests-reducer" src/` (from `travel-app/`)
Expected: no output (empty).

- [ ] **Step 2: Delete the files**

```bash
git rm src/lib/requests-store.tsx src/lib/requests-reducer.ts src/lib/requests-reducer.test.ts
```

- [ ] **Step 3: Verify**

Run: `npm test && npm run lint && npm run build`
Expected: all three succeed (the deleted test file's tests simply no longer run — that's correct, they tested a reducer that no longer exists).

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: delete localStorage-backed request store (superseded by Supabase)"
```

---

## Phase 4 — Final verification

### Task 22: Full regression pass + manual smoke test

**Files:** none (verification only).

- [ ] **Step 1: Full automated check**

Run (from `travel-app/`): `npm test && npm run lint && npm run build`
Expected: all green. `npm test` should show the existing suites (`airports`, `badge-variants`, `corporate-schema`, `mock-data`, `offer-format`, `passenger-masking`, `passenger-schema`, `policy`, `search-offers`, `search-schema`, `trip-flow-reducer`) still passing, plus the four new ones added in this plan (`session`, `duffel/map-offer`, `requests-mapper`) — `requests-reducer.test.ts` is gone (Task 21), not failing.

- [ ] **Step 2: Manual smoke test checklist**

With `npm run dev` running, in a fresh incognito browser window:

1. Visit `/` while logged out. Expected: redirected to `/login`.
2. Log in as Employee (via the demo-credential quick-fill). Expected: lands on `/`, sidebar shows "Funcionário Demo".
3. Search a real route (e.g. `LHR` → `JFK`, a date a few weeks out). Expected: real Duffel results after a genuine loading state (not the old fixed 1200ms).
4. Open an offer's detail page, proceed to passengers, fill them in, proceed to review, submit.
5. Land on `/requests/<id>` showing the just-created request with status "Aguardando aprovação".
6. Go to `/requests`, confirm the same request appears in the list; toggle a status filter chip; cancel the request from the list view; confirm it flips to "Cancelada" without a full page reload.
7. Sign out. Confirm redirected to `/login` and `/` now redirects back to `/login` again.
8. Log in as Admin. Expected: lands on `/admin`, sees the placeholder with "Olá, Admin Demo.", sidebar/Employee nav is not shown.
9. Sign out from `/admin`.

- [ ] **Step 3: Record any manual-check failures as follow-up tasks**

If any step in Step 2 fails, do not consider this plan complete — open a follow-up task describing the exact failure (which step, what happened vs. expected) before moving on.

- [ ] **Step 4: Final commit (if Step 2 required fixes)**

```bash
git add -A
git commit -m "fix: address issues found in manual smoke test"
```

(Skip this step if Step 2 passed cleanly with no code changes needed.)

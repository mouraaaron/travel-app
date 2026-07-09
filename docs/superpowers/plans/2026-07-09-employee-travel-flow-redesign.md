# Employee Travel Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recreate the 7-screen employee travel-request flow (search → results → offer detail → passengers → review → my requests → request detail) as real React/TSX in `travel-app`, matching the design handoff (`HANDOFF DE DESIGN.zip`) with high visual fidelity, on a fully Duffel-shaped data model.

**Architecture:** Additive extension of `src/lib/types.ts`, `src/lib/policy.ts`, `src/lib/search-schema.ts`, `src/lib/passenger-schema.ts` (new exports only, zero changes to existing exported signatures/tests) plus new Duffel-shaped mock data, a new in-memory `TripFlowProvider` for cross-step wizard state, a new dark sidebar layout, and 7 new/rebuilt route pages under `src/app/`. Ends by deleting the 5 truly-obsolete old wizard components and rebuilding 4 more in place.

**Tech Stack:** Next.js 14 App Router, TypeScript, react-hook-form + zod, shadcn/ui (Radix) + Tailwind, sonner toasts, vitest.

## Global Constraints

- **Protected — byte-for-byte untouched:** `tailwind.config.ts`, `components.json`, `src/styles/paggo-shadcn-vars.css`. Never edit these files in any task.
- **Protected — additive only:** `src/lib/policy.ts`, `src/lib/search-schema.ts`, `src/lib/passenger-schema.ts`. Every existing exported symbol, type, and test in `policy.test.ts` / `search-schema.test.ts` / `passenger-schema.test.ts` must keep passing unmodified. New behavior is added as new exports (new functions/types/schemas) appended to these files — never rename or remove an existing export.
- **Theme default:** light content area (existing `--background`/`--card` tokens), dark sidebar/topbar using the already-defined `--sidebar-*` tokens (`#333131`). Do not enable app-wide dark mode by default — this follows `PROMPT-CLAUDE-DESIGN-EMPLOYEE-VIEW.md`, not the screenshots (which render everything dark; confirmed with user as a rendering artifact, not the design intent).
- **Token mapping** (design handoff's raw Paggo DS `--twc-*` vars → this repo's existing shadcn/Tailwind tokens; do not import the raw `--twc-*` bundle):
  | Handoff token | Use in this repo |
  |---|---|
  | `--twc-surface-neutral-fill-high` (card bg) | `bg-card` |
  | `--twc-surface-neutral-fill-low` (page bg) | `bg-background` |
  | `--twc-surface-neutral-border-default` | `border-border` |
  | `--twc-content-neutral-high` | `text-foreground` |
  | `--twc-content-neutral-default` / `-mid` | `text-foreground/80` |
  | `--twc-content-neutral-low` | `text-muted-foreground` |
  | `--twc-content-branded-default` | `text-primary` |
  | `--twc-element-branded-fill-default` / `-low` | `bg-primary` / `bg-primary/10` |
  | `--twc-surface-danger-*` / `--twc-content-danger-default` | `bg-destructive/10 border-destructive/30 text-destructive` |
  | `--twc-surface-success-*` (new — no existing token) | literal `bg-emerald-50 border-emerald-200 text-emerald-700` (`dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300`) |
  | `--twc-surface-warning-*` (new) | literal `bg-amber-50 border-amber-200 text-amber-800` (`dark:bg-amber-950 dark:border-amber-800 dark:text-amber-300`) |
  | `--twc-surface-info` (new, "Internacional" badge) | literal `bg-sky-50 border-sky-200 text-sky-700` (`dark:bg-sky-950 dark:border-sky-800 dark:text-sky-300`) |
  | `--twc-surface-magic` (new, "Custo acima do teto" badge) | literal `bg-violet-50 border-violet-200 text-violet-700` (`dark:bg-violet-950 dark:border-violet-800 dark:text-violet-300`) |
  | `#333131` sidebar | already-wired `bg-sidebar` / `text-sidebar-foreground` utilities in `paggo-shadcn-vars.css` |
  | `.text-title-big` | `text-2xl font-semibold` |
  | `.text-title-mid` | `text-xl font-semibold` |
  | `.text-title-small` | `text-base font-semibold` |
  | `.text-body-small` | `text-sm` |
  | `.text-body-tiny` | `text-xs` |
  | Font | stays Inter (`font-sans`, from protected `tailwind.config.ts`) — do **not** load Poligon. |
- **Testing convention:** this repo has no component-rendering test setup (`vitest.config.ts` uses `environment: "node"`, no `@testing-library/react` dependency). Follow the existing pattern: every `src/lib/*.ts` change gets a real vitest unit test in the co-located `*.test.ts`. React components/pages get **no** automated test — verify them by running `npm run build`, `npm run lint`, and (final task) manually in a browser against the 7 reference screenshots. Do not introduce a new component-testing framework.
- **Old-component disposition** (the 9 files the user confirmed for removal split into two groups — do not conflate them):
  - **Hard delete** (task 27, no replacement at the same path): `src/app/search/results/page.tsx`, `src/components/trip/flight-request-wizard.tsx`, `src/components/trip/flight-criteria-step.tsx`, `src/components/trip/passenger-details-step.tsx`, `src/components/trip/justification-dialog.tsx`.
  - **Rewritten in place** (same file path, new implementation, done in tasks 16-18 below — not deferred to the deletion task): `src/components/trip/city-airport-combobox.tsx`, `src/components/trip/offer-card.tsx`, `src/components/trip/policy-badges.tsx`, `src/components/trip/request-status-badge.tsx`.
- **Scope clarification beyond the original discard list:** `src/app/requests/page.tsx` and `src/app/requests/[id]/page.tsx` import `PolicyBadges`/`RequestStatusBadge`, both being rewritten with new prop shapes, and the handoff's screens 6-7 redesign these two routes anyway — they are rebuilt in tasks 24-25.
- **Commands to run after every task:** `npm test` (vitest run), `npm run lint`, and after Phase 2 tasks also `npm run build` (all run from `travel-app/`).
- **Money/date formatting:** reuse `formatCurrency`/`formatDate` from `src/lib/offer-format.ts` (extended in task 7) wherever currency/dates are rendered — never hardcode `Intl` calls inline in components.
- **Icons:** `lucide-react` only, matching the exact glyphs named in the spec (`PencilLine`, `Clock`, `SearchX`, `CircleAlert`, `TriangleAlert`, `CircleCheck`, `CircleX`, `Leaf`, `ShieldCheck`, `Globe`, `CircleDollarSign`, `BookUser`, `Backpack`, `Plane`, plus `ChevronDown`/`ChevronRight`/`ArrowLeft`/`Plus`/`Minus`/`X` for interaction affordances).

---

## Phase 0 — Data & logic foundation

### Task 1: Extend `src/lib/types.ts` with Duffel-shaped types

**Files:**
- Modify: `src/lib/types.ts` (append only — do not change lines 1-77)

**Interfaces:**
- Produces: `OfferOwner`, `OfferSegment`, `OfferSlice`, `OfferConditions`, `AvailableService`, `SearchSlice`, `SearchPassengerSpec`, `SearchCriteria`, `PassengerTitle`, `PassengerGender`, `IdentityDocument`, `DuffelPassenger`, `TripPurpose`, `CorporateContext`, `TravelRequestStatus`, `SelectedOfferSnapshot`, `TravelRequestEvent`, `TravelRequest` — all consumed by later tasks (mock-data generator, schemas, screens).
- Modifies `FlightOffer` by adding new **optional** fields only (existing 13 required fields untouched, so every existing `FlightOffer` literal in `mock-data.ts`/`policy.test.ts`/`requests-reducer.test.ts` remains valid without changes).

- [ ] **Step 1: Append the new types to the end of `src/lib/types.ts`**

Insert this block immediately after the existing `export interface TripRequest { ... }` (last line of the file today):

```ts

// --- Duffel-shaped additions (additive; nothing above this line is modified) ---

export interface OfferOwner {
  iata_code: string;
  name: string;
  logo_symbol_url: string;
  brand_color: string;
}

export interface OfferSegmentBaggage {
  type: "carry_on" | "checked";
  quantity: number;
}

export interface OfferSegment {
  id: string;
  origin: { iata_code: string; name: string };
  destination: { iata_code: string; name: string };
  departing_at: string;
  arriving_at: string;
  duration: string; // ISO 8601 duration, e.g. "PT4H5M"
  marketing_carrier: { iata_code: string; name: string };
  operating_carrier: { iata_code: string; name: string };
  marketing_carrier_flight_number: string;
  aircraft: { name: string };
  origin_terminal: string | null;
  destination_terminal: string | null;
  baggages: OfferSegmentBaggage[];
}

export interface OfferSlice {
  id: string;
  origin: string;
  destination: string;
  duration: string;
  fare_brand_name: string;
  segments: OfferSegment[];
}

export interface OfferConditionDetail {
  allowed: boolean;
  penalty_amount?: string;
  penalty_currency?: string;
}

export interface OfferConditions {
  refund_before_departure: OfferConditionDetail;
  change_before_departure: OfferConditionDetail;
}

export interface AvailableService {
  type: string;
  title: string;
  total_amount: string;
  total_currency: string;
}

export interface SearchSlice {
  origin: string;
  destination: string;
  departure_date: string;
}

export type SearchPassengerSpec = { type: "adult" | "child" | "infant_without_seat" };

export interface SearchCriteria {
  slices: SearchSlice[];
  passengers: SearchPassengerSpec[];
  cabin_class: CabinClass;
  max_connections?: 0 | 1 | 2;
  preferences?: {
    arrive_by_outbound?: string;
    depart_after_return?: string;
  };
}

export type PassengerTitle = "mr" | "mrs" | "ms" | "miss" | "dr";
export type PassengerGender = "m" | "f";

export interface IdentityDocument {
  type: "passport";
  unique_identifier: string;
  issuing_country_code: string;
  expires_on: string;
}

export interface DuffelPassenger {
  id: string;
  type: "adult" | "child" | "infant_without_seat";
  title: PassengerTitle;
  given_name: string;
  family_name: string;
  born_on: string;
  gender: PassengerGender;
  email: string;
  phone_number: string;
  identity_documents?: IdentityDocument[];
  infant_passenger_id?: string;
}

export type TripPurpose =
  | "client_meeting"
  | "conference"
  | "internal_meeting"
  | "training"
  | "other";

export interface CorporateContext {
  trip_purpose: TripPurpose;
  cost_center: string;
  project_code?: string;
  business_justification: string;
  out_of_policy_justification?: string;
}

export type TravelRequestStatus =
  | "pending_admin"
  | "approved"
  | "rejected"
  | "needs_review"
  | "confirmed"
  | "cancelled";

export interface SelectedOfferSnapshot {
  offer_id: string;
  total_amount: string;
  total_currency: string;
  owner: { iata_code: string; name: string; logo_symbol_url: string };
  slices: Array<{
    origin: string;
    destination: string;
    departure_datetime: string;
    arrival_datetime: string;
    duration: string;
    segments_count: number;
    fare_brand_name?: string;
  }>;
  conditions: OfferConditions;
  passenger_identity_documents_required: boolean;
  total_emissions_kg?: number;
  expires_at: string;
}

export interface TravelRequestEvent {
  at: string;
  kind: "created" | "approved" | "rejected" | "needs_review" | "confirmed" | "cancelled";
  actor_id?: string;
  note?: string;
}

export interface DuffelPolicyViolationRecord {
  rule_id: string;
  message: string;
  field: string;
  expected: string;
  actual: string;
}

export interface TravelRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  created_at: string;
  status: TravelRequestStatus;
  search_criteria: SearchCriteria;
  selected_offer_snapshot: SelectedOfferSnapshot;
  passengers: DuffelPassenger[];
  corporate: CorporateContext;
  policy_evaluation: {
    compliant: boolean;
    violations: DuffelPolicyViolationRecord[];
    flags: { international_travel: boolean; cost_above_threshold: boolean };
  };
  events: TravelRequestEvent[];
}
```

- [ ] **Step 2: Add the new optional fields to the existing `FlightOffer` interface**

Change (lines 5-19 today):

```ts
export interface FlightOffer {
  id: string;
  mode: "flight";
  origin: string;
  destination: string;
  destinationCountry: string;
  departureAt: string;
  returnAt?: string;
  cabinClass: CabinClass;
  airline: string;
  stops: number;
  refundable: boolean;
  totalAmount: number;
  currency: string;
}
```

To:

```ts
export interface FlightOffer {
  id: string;
  mode: "flight";
  origin: string;
  destination: string;
  destinationCountry: string;
  departureAt: string;
  returnAt?: string;
  cabinClass: CabinClass;
  airline: string;
  stops: number;
  refundable: boolean;
  totalAmount: number;
  currency: string;
  // --- Duffel-shaped extension (optional; populated by generateOffers in mock-data.ts) ---
  expiresAt?: string;
  owner?: OfferOwner;
  slices?: OfferSlice[];
  conditions?: OfferConditions;
  passengerIdentityDocumentsRequired?: boolean;
  totalEmissionsKg?: number;
  availableServices?: AvailableService[];
  fareBrandName?: string;
  longestSegmentHours?: number;
}
```

(`OfferOwner`/`OfferSlice`/`OfferConditions`/`AvailableService` are defined further down the same file per Step 1 — TypeScript resolves forward references within a module fine.)

- [ ] **Step 3: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no new errors (existing `FlightOffer` literals in `mock-data.ts`, `policy.test.ts`, `requests-reducer.test.ts` still satisfy the type since all new fields are optional).

- [ ] **Step 4: Run full test suite to confirm nothing broke**

Run: `cd travel-app && npm test`
Expected: all existing tests still PASS (no test touches the new types yet).

- [ ] **Step 5: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(types): add Duffel-shaped offer/passenger/request types"
```

---

### Task 2: Extend `src/lib/policy.ts` with `evaluateDuffelOffer`

**Files:**
- Modify: `src/lib/policy.ts` (append only — do not change existing lines)
- Modify: `src/lib/policy.test.ts` (append a new `describe` block only)

**Interfaces:**
- Consumes: `FlightOffer` from `./types` (Task 1).
- Produces: `DuffelPolicyDefaults`, `DUFFEL_POLICY_DEFAULTS`, `DuffelPolicyViolation`, `DuffelPolicyFlags`, `DuffelPolicyEvaluation`, `evaluateDuffelOffer(offer: FlightOffer, defaults?: DuffelPolicyDefaults): DuffelPolicyEvaluation`. Later tasks (mock-data, offer-card, review screen) call `evaluateDuffelOffer`.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/policy.test.ts`:

```ts

describe("evaluateDuffelOffer", () => {
  const baseFlight: FlightOffer = {
    id: "flt-duffel-1",
    mode: "flight",
    origin: "GRU",
    destination: "GIG",
    destinationCountry: "BR",
    departureAt: "2026-08-01T10:00:00.000Z",
    cabinClass: "economy",
    airline: "Azul",
    stops: 0,
    refundable: false,
    totalAmount: 1200,
    currency: "BRL",
  };

  it("is compliant for a cheap domestic economy flight with no flags", () => {
    const result = evaluateDuffelOffer(baseFlight);
    expect(result.compliant).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.flags).toEqual({ international_travel: false, cost_above_threshold: false });
  });

  it("violates the domestic cost cap above R$3500", () => {
    const result = evaluateDuffelOffer({ ...baseFlight, totalAmount: 4000 });
    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.rule_id)).toEqual(["cost-cap"]);
  });

  it("applies the international cost cap of R$12000 instead of the domestic one", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      destination: "JFK",
      destinationCountry: "US",
      totalAmount: 10000,
    });
    expect(result.compliant).toBe(true);
    expect(result.flags.international_travel).toBe(true);
  });

  it("flags cost_above_threshold above R$8000 even when compliant", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      destination: "JFK",
      destinationCountry: "US",
      totalAmount: 9000,
    });
    expect(result.compliant).toBe(true);
    expect(result.flags.cost_above_threshold).toBe(true);
  });

  it("violates business cabin on a short-haul segment", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      cabinClass: "business",
      longestSegmentHours: 2,
    });
    expect(result.compliant).toBe(false);
    expect(result.violations.map((v) => v.rule_id)).toEqual(["cabin-long-haul"]);
  });

  it("allows business cabin on a long-haul segment of 8h or more", () => {
    const result = evaluateDuffelOffer({
      ...baseFlight,
      cabinClass: "business",
      longestSegmentHours: 9,
      totalAmount: 3000,
    });
    expect(result.compliant).toBe(true);
  });

  it("accepts custom defaults", () => {
    const result = evaluateDuffelOffer(
      { ...baseFlight, totalAmount: 1000 },
      { domesticCapBRL: 500, internationalCapBRL: 12000, longHaulCabinHours: 8, costFlagBRL: 8000 }
    );
    expect(result.compliant).toBe(false);
  });
});
```

Add `evaluateDuffelOffer` to the existing top import line (`import { evaluateOffer, HIGH_COST_THRESHOLD } from "./policy";` → `import { evaluateDuffelOffer, evaluateOffer, HIGH_COST_THRESHOLD } from "./policy";`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/policy.test.ts`
Expected: FAIL — `evaluateDuffelOffer is not exported`.

- [ ] **Step 3: Append the implementation to `src/lib/policy.ts`**

```ts

// --- Duffel-shaped policy evaluation (additive; evaluateOffer above is unchanged) ---

export interface DuffelPolicyDefaults {
  domesticCapBRL: number;
  internationalCapBRL: number;
  longHaulCabinHours: number;
  costFlagBRL: number;
}

export const DUFFEL_POLICY_DEFAULTS: DuffelPolicyDefaults = {
  domesticCapBRL: 3500,
  internationalCapBRL: 12000,
  longHaulCabinHours: 8,
  costFlagBRL: 8000,
};

export interface DuffelPolicyViolation {
  rule_id: string;
  message: string;
  field: string;
  expected: string;
  actual: string;
}

export interface DuffelPolicyFlags {
  international_travel: boolean;
  cost_above_threshold: boolean;
}

export interface DuffelPolicyEvaluation {
  compliant: boolean;
  violations: DuffelPolicyViolation[];
  flags: DuffelPolicyFlags;
}

export function evaluateDuffelOffer(
  offer: FlightOffer,
  defaults: DuffelPolicyDefaults = DUFFEL_POLICY_DEFAULTS
): DuffelPolicyEvaluation {
  const violations: DuffelPolicyViolation[] = [];
  const isInternational = offer.destinationCountry !== "BR";
  const cap = isInternational ? defaults.internationalCapBRL : defaults.domesticCapBRL;

  if (offer.totalAmount > cap) {
    violations.push({
      rule_id: "cost-cap",
      message: `Preço R$ ${offer.totalAmount.toFixed(2)} excede o teto de R$ ${cap.toFixed(2)} para voos ${
        isInternational ? "internacionais" : "domésticos"
      }.`,
      field: "totalAmount",
      expected: `<= ${cap}`,
      actual: String(offer.totalAmount),
    });
  }

  const isLongHaulCabin = offer.cabinClass === "business" || offer.cabinClass === "first";
  const longestSegmentHours = offer.longestSegmentHours ?? 0;
  if (isLongHaulCabin && longestSegmentHours < defaults.longHaulCabinHours) {
    violations.push({
      rule_id: "cabin-long-haul",
      message: `Classes executiva/primeira só são permitidas em trechos de ${defaults.longHaulCabinHours}h ou mais (este trecho tem ${longestSegmentHours.toFixed(
        1
      )}h).`,
      field: "cabinClass",
      expected: `duration >= ${defaults.longHaulCabinHours}h`,
      actual: `${longestSegmentHours.toFixed(1)}h`,
    });
  }

  return {
    compliant: violations.length === 0,
    violations,
    flags: {
      international_travel: isInternational,
      cost_above_threshold: offer.totalAmount > defaults.costFlagBRL,
    },
  };
}
```

Also update the type-only import at the top of `policy.ts` from:
```ts
import type { Offer, Policy, PolicyEvaluation, PolicyFlag, PolicyRule } from "./types";
```
to:
```ts
import type { FlightOffer, Offer, Policy, PolicyEvaluation, PolicyFlag, PolicyRule } from "./types";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/policy.test.ts`
Expected: PASS, all tests including the pre-existing `evaluateOffer` describe block.

- [ ] **Step 5: Commit**

```bash
git add src/lib/policy.ts src/lib/policy.test.ts
git commit -m "feat(policy): add evaluateDuffelOffer with handoff cost/cabin rules"
```

---

### Task 3: Extend `src/lib/airports.ts` with 27 airports + `COUNTRIES`

**Files:**
- Modify: `src/lib/airports.ts` (append only)
- Modify: `src/lib/airports.test.ts` (append only)

**Interfaces:**
- Produces: `COUNTRIES: PhoneCountry[]`, `PhoneCountry` type (`{ name: string; iso2: string; dialCode: string }`), `isInternational(iataCode: string): boolean`, and 18 new entries merged into the existing `CITIES` array (append, don't replace, so `searchAirports`/`findAirportByCode` keep working for the existing 9 cities too).
- Consumed by: Task 5 (passenger-schema `toE164`), Task 15 (`CityAirportCombobox` rewrite), Task 19/22 screens.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/airports.test.ts` (read the existing file first to match its `describe`/import style before appending):

```ts

describe("isInternational", () => {
  it("returns false for a Brazilian airport", () => {
    expect(isInternational("GRU")).toBe(false);
  });

  it("returns true for a non-Brazilian airport", () => {
    expect(isInternational("JFK")).toBe(true);
  });

  it("returns false for an unknown code (fail safe, treat as domestic)", () => {
    expect(isInternational("ZZZ")).toBe(false);
  });
});

describe("COUNTRIES", () => {
  it("includes Brazil with dial code 55", () => {
    const brazil = COUNTRIES.find((c) => c.iso2 === "BR");
    expect(brazil).toEqual({ name: "Brasil", iso2: "BR", dialCode: "55" });
  });

  it("has at least 10 countries for the passport/phone dropdowns", () => {
    expect(COUNTRIES.length).toBeGreaterThanOrEqual(10);
  });
});

describe("extended CITIES coverage", () => {
  it("resolves new airports added for the Duffel-shaped mock scenarios", () => {
    expect(findAirportByCode("NRT")?.sublabel).toContain("Narita");
    expect(findAirportByCode("CNF")?.sublabel).toContain("Confins");
    expect(findAirportByCode("ABV")).toBeDefined();
  });
});
```

Update the top import to include `COUNTRIES` and `isInternational`:
```ts
import { COUNTRIES, findAirportByCode, isInternational, searchAirports } from "./airports";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/airports.test.ts`
Expected: FAIL — `isInternational`/`COUNTRIES` not exported, `NRT`/`CNF`/`ABV` not found.

- [ ] **Step 3: Append to `src/lib/airports.ts`**

Append 18 more cities to the existing `CITIES` array — change the array's closing `];` (currently after the Lisboa entry) by inserting these entries before it:

```ts
  {
    city: "Confins",
    country: "Brasil",
    airports: [{ code: "CNF", name: "Aeroporto Internacional de Confins" }],
  },
  {
    city: "Porto Alegre",
    country: "Brasil",
    airports: [{ code: "POA", name: "Aeroporto Internacional Salgado Filho" }],
  },
  {
    city: "Recife",
    country: "Brasil",
    airports: [{ code: "REC", name: "Aeroporto Internacional dos Guararapes" }],
  },
  {
    city: "Fortaleza",
    country: "Brasil",
    airports: [{ code: "FOR", name: "Aeroporto Internacional Pinto Martins" }],
  },
  {
    city: "Manaus",
    country: "Brasil",
    airports: [{ code: "MAO", name: "Aeroporto Internacional Eduardo Gomes" }],
  },
  {
    city: "Belo Horizonte",
    country: "Brasil",
    airports: [{ code: "PLU", name: "Aeroporto da Pampulha" }],
  },
  {
    city: "Londres",
    country: "Reino Unido",
    airports: [
      { code: "LHR", name: "Heathrow Airport" },
      { code: "LGW", name: "Gatwick Airport" },
    ],
  },
  {
    city: "Paris",
    country: "França",
    airports: [{ code: "CDG", name: "Aéroport Charles de Gaulle" }],
  },
  {
    city: "Madri",
    country: "Espanha",
    airports: [{ code: "MAD", name: "Aeropuerto Adolfo Suárez Madrid-Barajas" }],
  },
  {
    city: "Frankfurt",
    country: "Alemanha",
    airports: [{ code: "FRA", name: "Frankfurt Airport" }],
  },
  {
    city: "Tóquio",
    country: "Japão",
    airports: [{ code: "NRT", name: "Narita International Airport" }],
  },
  {
    city: "Santiago",
    country: "Chile",
    airports: [{ code: "SCL", name: "Aeropuerto Internacional Arturo Merino Benítez" }],
  },
  {
    city: "Bogotá",
    country: "Colômbia",
    airports: [{ code: "BOG", name: "Aeropuerto Internacional El Dorado" }],
  },
  {
    city: "Cidade do México",
    country: "México",
    airports: [{ code: "MEX", name: "Aeropuerto Internacional Benito Juárez" }],
  },
  {
    city: "Toronto",
    country: "Canadá",
    airports: [{ code: "YYZ", name: "Toronto Pearson International Airport" }],
  },
  {
    city: "Dubai",
    country: "Emirados Árabes Unidos",
    airports: [{ code: "DXB", name: "Dubai International Airport" }],
  },
  {
    city: "Joanesburgo",
    country: "África do Sul",
    airports: [{ code: "JNB", name: "OR Tambo International Airport" }],
  },
  {
    city: "Abuja",
    country: "Nigéria",
    airports: [{ code: "ABV", name: "Nnamdi Azikiwe International Airport" }],
  },
```

Then, after the `CITIES` array and its existing `normalize`/`searchAirports`/`findAirportByCode` functions, append:

```ts

export interface PhoneCountry {
  name: string;
  iso2: string;
  dialCode: string;
}

export const COUNTRIES: PhoneCountry[] = [
  { name: "Brasil", iso2: "BR", dialCode: "55" },
  { name: "Estados Unidos", iso2: "US", dialCode: "1" },
  { name: "Argentina", iso2: "AR", dialCode: "54" },
  { name: "Portugal", iso2: "PT", dialCode: "351" },
  { name: "Reino Unido", iso2: "GB", dialCode: "44" },
  { name: "França", iso2: "FR", dialCode: "33" },
  { name: "Espanha", iso2: "ES", dialCode: "34" },
  { name: "Alemanha", iso2: "DE", dialCode: "49" },
  { name: "Japão", iso2: "JP", dialCode: "81" },
  { name: "Chile", iso2: "CL", dialCode: "56" },
  { name: "Colômbia", iso2: "CO", dialCode: "57" },
  { name: "México", iso2: "MX", dialCode: "52" },
  { name: "Canadá", iso2: "CA", dialCode: "1" },
  { name: "Emirados Árabes Unidos", iso2: "AE", dialCode: "971" },
  { name: "África do Sul", iso2: "ZA", dialCode: "27" },
  { name: "Nigéria", iso2: "NG", dialCode: "234" },
];

export function isInternational(iataCode: string): boolean {
  const normalizedCode = iataCode.trim().toUpperCase();
  for (const city of CITIES) {
    if (city.airports.some((airport) => airport.code === normalizedCode)) {
      return city.country !== "Brasil";
    }
  }
  return false;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/airports.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/airports.ts src/lib/airports.test.ts
git commit -m "feat(airports): add international airports, COUNTRIES, isInternational"
```

---

### Task 4: Extend `src/lib/search-schema.ts` with `tripSearchSchema`

**Files:**
- Modify: `src/lib/search-schema.ts` (append only)
- Modify: `src/lib/search-schema.test.ts` (append only)

**Interfaces:**
- Produces: `sliceSchema`, `SliceFormValues`, `tripSearchSchema`, `TripSearchFormValues`, `tripSearchToCriteria(values: TripSearchFormValues): SearchCriteria`.
- Consumes: `SearchCriteria`, `SearchSlice`, `SearchPassengerSpec` from `./types` (Task 1).
- Consumed by: Task 19 (`/` search screen), Task 6 (mock-data generator takes `SearchCriteria`).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/search-schema.test.ts`:

```ts

describe("tripSearchSchema", () => {
  const validOneWay = {
    tripType: "one_way" as const,
    slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
    adults: 1,
    children: 0,
    infants: 0,
    cabinClass: "economy" as const,
    maxConnections: 1 as const,
    arriveByOutboundEnabled: false,
    departAfterReturnEnabled: false,
  };

  it("accepts a valid one-way search", () => {
    expect(tripSearchSchema.safeParse(validOneWay).success).toBe(true);
  });

  it("requires a return date for round trips", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, tripType: "round_trip" });
    expect(result.success).toBe(false);
  });

  it("accepts a round trip with a valid return date", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "round_trip",
      returnDate: "2026-08-17",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a return date before the first slice's departure", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "round_trip",
      returnDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("allows up to 4 slices for multi-city", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "multi_city",
      slices: [
        { origin: "GRU", destination: "GIG", departureDate: "2026-08-10" },
        { origin: "GIG", destination: "SSA", departureDate: "2026-08-12" },
        { origin: "SSA", destination: "CWB", departureDate: "2026-08-14" },
        { origin: "CWB", destination: "GRU", departureDate: "2026-08-16" },
      ],
    });
    expect(result.success).toBe(true);
  });

  it("rejects more than 4 slices", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      tripType: "multi_city",
      slices: Array.from({ length: 5 }, (_, i) => ({
        origin: "GRU",
        destination: "GIG",
        departureDate: `2026-08-${10 + i}`,
      })),
    });
    expect(result.success).toBe(false);
  });

  it("rejects origin equal to destination within a slice", () => {
    const result = tripSearchSchema.safeParse({
      ...validOneWay,
      slices: [{ origin: "GRU", destination: "GRU", departureDate: "2026-08-10" }],
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 9 total passengers", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, adults: 9, children: 1 });
    expect(result.success).toBe(false);
  });

  it("requires at least 1 adult", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, adults: 0, infants: 1 });
    expect(result.success).toBe(false);
  });

  it("requires a time when arrive-by-outbound is enabled", () => {
    const result = tripSearchSchema.safeParse({ ...validOneWay, arriveByOutboundEnabled: true });
    expect(result.success).toBe(false);
  });
});

describe("tripSearchToCriteria", () => {
  it("converts round-trip form values into a two-slice SearchCriteria payload", () => {
    const criteria = tripSearchToCriteria({
      tripType: "round_trip",
      slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
      returnDate: "2026-08-17",
      adults: 2,
      children: 1,
      infants: 1,
      cabinClass: "business",
      maxConnections: 0,
      arriveByOutboundEnabled: true,
      arriveByOutboundTime: "18:00",
      departAfterReturnEnabled: false,
    });

    expect(criteria).toEqual({
      slices: [
        { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
        { origin: "GIG", destination: "GRU", departure_date: "2026-08-17" },
      ],
      passengers: [
        { type: "adult" },
        { type: "adult" },
        { type: "child" },
        { type: "infant_without_seat" },
      ],
      cabin_class: "business",
      max_connections: 0,
      preferences: { arrive_by_outbound: "18:00" },
    });
  });

  it("keeps one-way as a single slice with no synthesized return leg", () => {
    const criteria = tripSearchToCriteria({
      tripType: "one_way",
      slices: [{ origin: "GRU", destination: "GIG", departureDate: "2026-08-10" }],
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      maxConnections: 1,
      arriveByOutboundEnabled: false,
      departAfterReturnEnabled: false,
    });

    expect(criteria.slices).toEqual([{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }]);
  });

  it("passes multi-city slices through unchanged", () => {
    const criteria = tripSearchToCriteria({
      tripType: "multi_city",
      slices: [
        { origin: "GRU", destination: "GIG", departureDate: "2026-08-10" },
        { origin: "GIG", destination: "SSA", departureDate: "2026-08-12" },
      ],
      adults: 1,
      children: 0,
      infants: 0,
      cabinClass: "economy",
      maxConnections: 2,
      arriveByOutboundEnabled: false,
      departAfterReturnEnabled: false,
    });

    expect(criteria.slices).toEqual([
      { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
      { origin: "GIG", destination: "SSA", departure_date: "2026-08-12" },
    ]);
  });
});
```

Update the top import to:
```ts
import { tripSearchSchema, tripSearchToCriteria, flightSearchSchema, staySearchSchema } from "./search-schema";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/search-schema.test.ts`
Expected: FAIL — `tripSearchSchema`/`tripSearchToCriteria` not exported.

- [ ] **Step 3: Append to `src/lib/search-schema.ts`**

Add `SearchCriteria` to a new type-only import at the top of the file:
```ts
import type { SearchCriteria } from "./types";
```

Append:

```ts

export const sliceSchema = z
  .object({
    origin: z.string().trim().length(3, "Selecione uma origem na lista"),
    destination: z.string().trim().length(3, "Selecione um destino na lista"),
    departureDate: z.string().min(1, "Informe a data"),
  })
  .refine((d) => d.origin.toUpperCase() !== d.destination.toUpperCase(), {
    message: "Origem e destino não podem ser iguais",
    path: ["destination"],
  });

export type SliceFormValues = z.infer<typeof sliceSchema>;

export const tripSearchSchema = z
  .object({
    tripType: z.enum(["round_trip", "one_way", "multi_city"]),
    slices: z.array(sliceSchema).min(1, "Informe ao menos um trecho").max(4, "Máximo 4 trechos"),
    returnDate: z.string().optional(),
    adults: z.coerce.number().int().min(1, "Pelo menos 1 adulto é obrigatório"),
    children: z.coerce.number().int().min(0),
    infants: z.coerce.number().int().min(0),
    cabinClass: z.enum(["economy", "premium_economy", "business", "first"]),
    maxConnections: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    arriveByOutboundEnabled: z.boolean(),
    arriveByOutboundTime: z.string().optional(),
    departAfterReturnEnabled: z.boolean(),
    departAfterReturnTime: z.string().optional(),
  })
  .refine((d) => d.adults + d.children + d.infants <= 9, {
    message: "Máximo 9 passageiros no total",
    path: ["adults"],
  })
  .refine((d) => d.tripType !== "round_trip" || Boolean(d.returnDate), {
    message: "Informe a data de volta",
    path: ["returnDate"],
  })
  .refine(
    (d) => !d.returnDate || d.slices.length === 0 || d.returnDate >= d.slices[0].departureDate,
    { message: "A volta não pode ser antes da ida", path: ["returnDate"] }
  )
  .refine((d) => !d.arriveByOutboundEnabled || Boolean(d.arriveByOutboundTime), {
    message: "Informe o horário limite de chegada",
    path: ["arriveByOutboundTime"],
  })
  .refine((d) => !d.departAfterReturnEnabled || Boolean(d.departAfterReturnTime), {
    message: "Informe o horário mínimo de partida da volta",
    path: ["departAfterReturnTime"],
  });

export type TripSearchFormValues = z.infer<typeof tripSearchSchema>;

export function tripSearchToCriteria(values: TripSearchFormValues): SearchCriteria {
  const slices =
    values.tripType === "round_trip"
      ? [
          {
            origin: values.slices[0].origin,
            destination: values.slices[0].destination,
            departure_date: values.slices[0].departureDate,
          },
          {
            origin: values.slices[0].destination,
            destination: values.slices[0].origin,
            departure_date: values.returnDate ?? values.slices[0].departureDate,
          },
        ]
      : values.slices.map((slice) => ({
          origin: slice.origin,
          destination: slice.destination,
          departure_date: slice.departureDate,
        }));

  const passengers = [
    ...Array.from({ length: values.adults }, () => ({ type: "adult" as const })),
    ...Array.from({ length: values.children }, () => ({ type: "child" as const })),
    ...Array.from({ length: values.infants }, () => ({ type: "infant_without_seat" as const })),
  ];

  const preferences: SearchCriteria["preferences"] = {};
  if (values.arriveByOutboundEnabled && values.arriveByOutboundTime) {
    preferences.arrive_by_outbound = values.arriveByOutboundTime;
  }
  if (values.departAfterReturnEnabled && values.departAfterReturnTime) {
    preferences.depart_after_return = values.departAfterReturnTime;
  }

  return {
    slices,
    passengers,
    cabin_class: values.cabinClass,
    max_connections: values.maxConnections,
    ...(Object.keys(preferences).length > 0 ? { preferences } : {}),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/search-schema.test.ts`
Expected: PASS, including the pre-existing `flightSearchSchema`/`staySearchSchema` blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/search-schema.ts src/lib/search-schema.test.ts
git commit -m "feat(search-schema): add tripSearchSchema for multi-city Duffel-shaped search"
```

---

### Task 5: Extend `src/lib/passenger-schema.ts` with `duffelPassengerSchema`

**Files:**
- Modify: `src/lib/passenger-schema.ts` (append only)
- Modify: `src/lib/passenger-schema.test.ts` (append only)

**Interfaces:**
- Consumes: `PhoneCountry`, `COUNTRIES` from `./airports` (Task 3).
- Produces: `duffelPassengerSchema`, `DuffelPassengerFormValues`, `duffelPassengersSchema`, `DuffelPassengersFormValues`, `buildEmptyDuffelPassenger(type, id): DuffelPassengerFormValues`, `toE164(dialCode: string, localNumber: string): string`.
- Consumed by: Task 22 (`/request/passengers/[offerId]` screen).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/passenger-schema.test.ts`:

```ts

const VALID_DUFFEL_PASSENGER = {
  id: "pas-1",
  type: "adult" as const,
  title: "mr" as const,
  given_name: "Aaron",
  family_name: "Moura",
  born_on: "1998-03-14",
  gender: "m" as const,
  email: "aaron@paggo.com",
  phoneCountry: "55",
  phoneLocalNumber: "41999998888",
  passportRequired: false,
};

describe("duffelPassengerSchema", () => {
  it("accepts a valid domestic adult passenger with no passport block", () => {
    expect(duffelPassengerSchema.safeParse(VALID_DUFFEL_PASSENGER).success).toBe(true);
  });

  it("rejects a given_name with accented characters", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, given_name: "João" });
    expect(result.success).toBe(false);
  });

  it("rejects a family_name longer than 20 characters", () => {
    const result = duffelPassengerSchema.safeParse({
      ...VALID_DUFFEL_PASSENGER,
      family_name: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("rejects a phone local number with letters", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, phoneLocalNumber: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects a phone local number shorter than 8 digits", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, phoneLocalNumber: "1234567" });
    expect(result.success).toBe(false);
  });

  it("requires passport fields when passportRequired is true", () => {
    const result = duffelPassengerSchema.safeParse({ ...VALID_DUFFEL_PASSENGER, passportRequired: true });
    expect(result.success).toBe(false);
  });

  it("accepts a full passport block when required", () => {
    const result = duffelPassengerSchema.safeParse({
      ...VALID_DUFFEL_PASSENGER,
      passportRequired: true,
      passportNumber: "FZ123456",
      passportIssuingCountry: "BR",
      passportExpiresOn: "2032-11-30",
    });
    expect(result.success).toBe(true);
  });
});

describe("duffelPassengersSchema — infant responsibility", () => {
  const adult = VALID_DUFFEL_PASSENGER;
  const infant = {
    ...VALID_DUFFEL_PASSENGER,
    id: "pas-2",
    type: "infant_without_seat" as const,
    born_on: "2025-01-01",
  };

  it("requires every infant to have exactly one responsible adult", () => {
    const result = duffelPassengersSchema.safeParse({ passengers: [adult, infant] });
    expect(result.success).toBe(false);
  });

  it("accepts when an adult is marked responsible for the infant", () => {
    const result = duffelPassengersSchema.safeParse({
      passengers: [{ ...adult, infantResponsibleFor: "pas-2" }, infant],
    });
    expect(result.success).toBe(true);
  });

  it("rejects when two adults claim responsibility for the same infant", () => {
    const secondAdult = { ...adult, id: "pas-3", infantResponsibleFor: "pas-2" };
    const result = duffelPassengersSchema.safeParse({
      passengers: [{ ...adult, infantResponsibleFor: "pas-2" }, secondAdult, infant],
    });
    expect(result.success).toBe(false);
  });
});

describe("toE164", () => {
  it("concatenates dial code and local number with a leading +", () => {
    expect(toE164("55", "41999998888")).toBe("+5541999998888");
  });
});

describe("buildEmptyDuffelPassenger", () => {
  it("returns a blank adult passenger with the given id", () => {
    expect(buildEmptyDuffelPassenger("adult", "pas-1")).toEqual({
      id: "pas-1",
      type: "adult",
      title: "mr",
      given_name: "",
      family_name: "",
      born_on: "",
      gender: "m",
      email: "",
      phoneCountry: "55",
      phoneLocalNumber: "",
      passportRequired: false,
      passportNumber: "",
      passportIssuingCountry: "",
      passportExpiresOn: "",
      infantResponsibleFor: undefined,
    });
  });
});
```

Update the top import to:
```ts
import {
  buildEmptyDuffelPassenger,
  buildEmptyPassenger,
  duffelPassengerSchema,
  duffelPassengersSchema,
  passengersSchema,
  toE164,
} from "./passenger-schema";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/passenger-schema.test.ts`
Expected: FAIL — new exports don't exist.

- [ ] **Step 3: Append to `src/lib/passenger-schema.ts`**

```ts

const DUFFEL_NAME_REGEX = /^[A-Za-z\-'\s]{1,20}$/;

export const duffelPassengerSchema = z
  .object({
    id: z.string(),
    type: z.enum(["adult", "child", "infant_without_seat"]),
    title: z.enum(["mr", "mrs", "ms", "miss", "dr"], { error: "Selecione um título" }),
    given_name: z
      .string()
      .trim()
      .regex(DUFFEL_NAME_REGEX, "Sem acentos, 1–20 caracteres, apenas letras/hífen/apóstrofo"),
    family_name: z
      .string()
      .trim()
      .regex(DUFFEL_NAME_REGEX, "Sem acentos, 1–20 caracteres, apenas letras/hífen/apóstrofo"),
    born_on: z.string().min(1, "Informe a data de nascimento"),
    gender: z.enum(["m", "f"], { error: "Selecione o gênero" }),
    email: z.string().trim().email("E-mail inválido"),
    phoneCountry: z.string().min(1, "Selecione o país"),
    phoneLocalNumber: z.string().regex(/^\d{8,13}$/, "8–13 dígitos, sem espaços ou símbolos"),
    passportRequired: z.boolean(),
    passportNumber: z.string().optional(),
    passportIssuingCountry: z.string().optional(),
    passportExpiresOn: z.string().optional(),
    infantResponsibleFor: z.string().optional(),
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportNumber), {
    message: "Informe o número do passaporte",
    path: ["passportNumber"],
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportIssuingCountry), {
    message: "Informe o país emissor",
    path: ["passportIssuingCountry"],
  })
  .refine((d) => !d.passportRequired || Boolean(d.passportExpiresOn), {
    message: "Informe a validade do passaporte",
    path: ["passportExpiresOn"],
  });

export type DuffelPassengerFormValues = z.infer<typeof duffelPassengerSchema>;

export const duffelPassengersSchema = z
  .object({ passengers: z.array(duffelPassengerSchema).min(1, "Informe ao menos um passageiro") })
  .refine(
    (d) => {
      const infants = d.passengers.filter((p) => p.type === "infant_without_seat");
      const responsibleIds = d.passengers
        .map((p) => p.infantResponsibleFor)
        .filter((v): v is string => Boolean(v));
      const uniqueResponsible = new Set(responsibleIds);
      return (
        infants.every((inf) => responsibleIds.includes(inf.id)) &&
        uniqueResponsible.size === responsibleIds.length
      );
    },
    {
      message:
        "Cada bebê precisa de exatamente um adulto responsável, e cada adulto pode ser responsável por no máximo um bebê",
      path: ["passengers"],
    }
  );

export type DuffelPassengersFormValues = z.infer<typeof duffelPassengersSchema>;

export function toE164(dialCode: string, localNumber: string): string {
  return `+${dialCode}${localNumber}`;
}

export function buildEmptyDuffelPassenger(
  type: "adult" | "child" | "infant_without_seat",
  id: string
): DuffelPassengerFormValues {
  return {
    id,
    type,
    title: "mr",
    given_name: "",
    family_name: "",
    born_on: "",
    gender: "m",
    email: "",
    phoneCountry: "55",
    phoneLocalNumber: "",
    passportRequired: false,
    passportNumber: "",
    passportIssuingCountry: "",
    passportExpiresOn: "",
    infantResponsibleFor: undefined,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/passenger-schema.test.ts`
Expected: PASS, including the pre-existing `passengersSchema`/`buildEmptyPassenger` blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/passenger-schema.ts src/lib/passenger-schema.test.ts
git commit -m "feat(passenger-schema): add Duffel-shaped passenger schema with E.164/passport/infant rules"
```

---

### Task 6: Extend `src/lib/mock-data.ts` with `generateOffers`

**Files:**
- Modify: `src/lib/mock-data.ts` (append only)
- Modify: `src/lib/mock-data.test.ts` (create — this file doesn't exist yet, following the project's co-located `*.test.ts` convention)

**Interfaces:**
- Consumes: `SearchCriteria` (Task 1), `isInternational` (Task 3).
- Produces: `generateOffers(criteria: SearchCriteria): FlightOffer[]`, `CARRIERS` (owner data used by task 16's `OfferCard`).
- Consumed by: Task 20 (`/results` screen calls `generateOffers`).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/mock-data.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { generateOffers } from "./mock-data";
import type { SearchCriteria } from "./types";

function criteria(overrides: Partial<SearchCriteria> = {}): SearchCriteria {
  return {
    slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
    passengers: [{ type: "adult" }],
    cabin_class: "economy",
    max_connections: 1,
    ...overrides,
  };
}

describe("generateOffers", () => {
  it("returns a non-empty deterministic list for a domestic route", () => {
    const first = generateOffers(criteria());
    const second = generateOffers(criteria());
    expect(first.length).toBeGreaterThan(0);
    expect(first.map((o) => o.id)).toEqual(second.map((o) => o.id));
  });

  it("returns an empty list when the destination is ABV", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "ABV", departure_date: "2026-08-10" }] })
    );
    expect(offers).toEqual([]);
  });

  it("marks every domestic offer as not requiring identity documents", () => {
    const offers = generateOffers(criteria());
    expect(offers.every((o) => o.passengerIdentityDocumentsRequired === false)).toBe(true);
  });

  it("marks every international offer as requiring identity documents", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "JFK", departure_date: "2026-08-10" }] })
    );
    expect(offers.length).toBeGreaterThan(0);
    expect(offers.every((o) => o.passengerIdentityDocumentsRequired === true)).toBe(true);
  });

  it("includes full slice/segment detail on every offer", () => {
    const [offer] = generateOffers(criteria());
    expect(offer.slices?.[0]?.segments.length).toBeGreaterThan(0);
    expect(offer.owner?.iata_code).toBeTruthy();
    expect(offer.expiresAt).toBeTruthy();
  });

  it("produces a two-slice offer for round-trip criteria", () => {
    const offers = generateOffers(
      criteria({
        slices: [
          { origin: "GRU", destination: "GIG", departure_date: "2026-08-10" },
          { origin: "GIG", destination: "GRU", departure_date: "2026-08-17" },
        ],
      })
    );
    expect(offers[0].slices).toHaveLength(2);
  });

  it("includes at least one offer expiring within 10 minutes for the near-expiry test route", () => {
    const offers = generateOffers(
      criteria({ slices: [{ origin: "GRU", destination: "CWB", departure_date: "2026-08-10" }] })
    );
    const now = Date.now();
    expect(
      offers.some((o) => new Date(o.expiresAt!).getTime() - now < 10 * 60 * 1000)
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/mock-data.test.ts`
Expected: FAIL — `generateOffers` not exported.

- [ ] **Step 3: Append to `src/lib/mock-data.ts`**

Add imports at the top (alongside the existing `import type { FlightOffer, Policy, StayOffer } from "./types";`):
```ts
import { isInternational } from "./airports";
import type { OfferSegment, OfferSlice, SearchCriteria } from "./types";
```

Append:

```ts

interface Carrier {
  iata_code: string;
  name: string;
  brand_color: string;
  aircraft: string[];
}

export const CARRIERS: Carrier[] = [
  { iata_code: "LA", name: "LATAM", brand_color: "#7c2e12", aircraft: ["Airbus A320", "Boeing 787-9"] },
  { iata_code: "G3", name: "Gol", brand_color: "#d4582f", aircraft: ["Boeing 737 MAX 8"] },
  { iata_code: "AD", name: "Azul", brand_color: "#c54220", aircraft: ["Embraer E195-E2", "Airbus A330-900"] },
  { iata_code: "AA", name: "American Airlines", brand_color: "#7c2e12", aircraft: ["Boeing 777-200"] },
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function buildSegment(
  origin: string,
  destination: string,
  departingAt: Date,
  durationHours: number,
  carrier: Carrier,
  flightNumberSeed: number
): OfferSegment {
  const arrivingAt = new Date(departingAt.getTime() + durationHours * 60 * 60 * 1000);
  const wholeHours = Math.floor(durationHours);
  const minutes = Math.round((durationHours - wholeHours) * 60);
  return {
    id: `seg_${flightNumberSeed}`,
    origin: { iata_code: origin, name: origin },
    destination: { iata_code: destination, name: destination },
    departing_at: departingAt.toISOString(),
    arriving_at: arrivingAt.toISOString(),
    duration: `PT${wholeHours}H${minutes}M`,
    marketing_carrier: { iata_code: carrier.iata_code, name: carrier.name },
    operating_carrier: { iata_code: carrier.iata_code, name: carrier.name },
    marketing_carrier_flight_number: String(1000 + (flightNumberSeed % 8999)),
    aircraft: { name: carrier.aircraft[flightNumberSeed % carrier.aircraft.length] },
    origin_terminal: null,
    destination_terminal: null,
    baggages: [
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: flightNumberSeed % 3 === 0 ? 0 : 1 },
    ],
  };
}

function buildSlice(
  origin: string,
  destination: string,
  departureDate: string,
  carrier: Carrier,
  fareBrand: string,
  seed: number
): OfferSlice {
  const departingAt = new Date(`${departureDate}T${8 + (seed % 10)}:${seed % 2 === 0 ? "00" : "30"}:00.000Z`);
  const hasStop = seed % 3 === 0;
  const segments: OfferSegment[] = hasStop
    ? [
        buildSegment(origin, "CNF", departingAt, 1.75, carrier, seed),
        buildSegment(
          "CNF",
          destination,
          new Date(departingAt.getTime() + (1.75 + 1.5) * 60 * 60 * 1000),
          2.25,
          carrier,
          seed + 1
        ),
      ]
    : [buildSegment(origin, destination, departingAt, 2 + (seed % 5), carrier, seed)];

  const totalHours = segments.reduce((sum, segment) => {
    const match = /PT(\d+)H(\d+)M/.exec(segment.duration);
    return sum + (match ? Number(match[1]) + Number(match[2]) / 60 : 0);
  }, hasStop ? 1.5 : 0);

  return {
    id: `sli_${seed}`,
    origin,
    destination,
    duration: `PT${Math.floor(totalHours)}H${Math.round((totalHours % 1) * 60)}M`,
    fare_brand_name: fareBrand,
    segments,
  };
}

const FARE_BRANDS = ["Light", "Plus", "Flex"];

export function generateOffers(criteria: SearchCriteria): FlightOffer[] {
  const firstSlice = criteria.slices[0];
  if (!firstSlice) return [];
  if (firstSlice.destination.toUpperCase() === "ABV") return [];

  const passengerCount = criteria.passengers.length || 1;
  const international = isInternational(firstSlice.destination);
  const offerCount = 5;
  const now = Date.now();

  return Array.from({ length: offerCount }, (_, index) => {
    const seed = hashString(`${firstSlice.origin}${firstSlice.destination}${firstSlice.departure_date}${index}`);
    const carrier = CARRIERS[seed % CARRIERS.length];
    const fareBrand = FARE_BRANDS[seed % FARE_BRANDS.length];
    const basePrice = international ? 4500 + (seed % 8000) : 350 + (seed % 3200);
    const cabinClass =
      criteria.cabin_class === "economy" && seed % 7 === 0 ? "business" : criteria.cabin_class;

    const slices = criteria.slices.map((slice, sliceIndex) =>
      buildSlice(slice.origin, slice.destination, slice.departure_date, carrier, fareBrand, seed + sliceIndex * 100)
    );

    const totalDurationHours = slices.reduce((sum, slice) => {
      const match = /PT(\d+)H(\d+)M/.exec(slice.duration);
      return Math.max(sum, match ? Number(match[1]) + Number(match[2]) / 60 : 0);
    }, 0);

    const expiresInMinutes = index === 0 ? 8 : 30 + (seed % 90);

    return {
      id: `off_mock_${seed}`,
      mode: "flight",
      origin: firstSlice.origin,
      destination: firstSlice.destination,
      destinationCountry: international ? "US" : "BR",
      departureAt: slices[0].segments[0].departing_at,
      returnAt: slices[1]?.segments[0]?.departing_at,
      cabinClass,
      airline: carrier.name,
      stops: slices[0].segments.length - 1,
      refundable: seed % 2 === 0,
      totalAmount: basePrice * passengerCount,
      currency: "BRL",
      expiresAt: new Date(now + expiresInMinutes * 60 * 1000).toISOString(),
      owner: {
        iata_code: carrier.iata_code,
        name: carrier.name,
        logo_symbol_url: "",
        brand_color: carrier.brand_color,
      },
      slices,
      conditions: {
        refund_before_departure:
          seed % 2 === 0
            ? { allowed: true, penalty_amount: "350.00", penalty_currency: "BRL" }
            : { allowed: false },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "BRL" },
      },
      passengerIdentityDocumentsRequired: international,
      totalEmissionsKg: Math.round(80 + (seed % 400)),
      availableServices: [],
      fareBrandName: fareBrand,
      longestSegmentHours: totalDurationHours,
    } satisfies FlightOffer;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/mock-data.test.ts`
Expected: PASS. Also run `cd travel-app && npm test` to confirm the whole suite (including the untouched `MOCK_FLIGHT_OFFERS`/`ORGANIZATION_POLICY` exports) is still green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/mock-data.ts src/lib/mock-data.test.ts
git commit -m "feat(mock-data): add generateOffers Duffel-shaped offer generator"
```

---

### Task 7: Extend `src/lib/offer-format.ts` with duration/stops/baggage/time formatters

**Files:**
- Modify: `src/lib/offer-format.ts` (append only)
- Modify: `src/lib/offer-format.test.ts` (append only)

**Interfaces:**
- Consumes: `OfferSegment`, `OfferSlice` from `./types` (Task 1).
- Produces: `formatDuration(iso: string): string`, `formatTimeRange(departingAt: string, arrivingAt: string): string`, `formatStopsLabel(segments: OfferSegment[]): string`, `formatBaggageSummary(segments: OfferSegment[]): string`.
- Consumed by: Task 16 (`OfferCard`), Task 20/21 (results/offer-detail screens).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/offer-format.test.ts` (extend the top import line to `import { formatBaggageSummary, formatCurrency, formatDate, formatDuration, formatStopsLabel, formatTimeRange, offerTitle } from "./offer-format";` and add `import type { OfferSegment } from "./types";`):

```ts

function buildSegment(overrides: Partial<OfferSegment> = {}): OfferSegment {
  return {
    id: "seg-1",
    origin: { iata_code: "GRU", name: "Guarulhos" },
    destination: { iata_code: "CNF", name: "Confins" },
    departing_at: "2026-08-10T14:30:00.000Z",
    arriving_at: "2026-08-10T16:15:00.000Z",
    duration: "PT1H45M",
    marketing_carrier: { iata_code: "LA", name: "LATAM" },
    operating_carrier: { iata_code: "LA", name: "LATAM" },
    marketing_carrier_flight_number: "4643",
    aircraft: { name: "Embraer E195-E2" },
    origin_terminal: null,
    destination_terminal: null,
    baggages: [
      { type: "carry_on", quantity: 1 },
      { type: "checked", quantity: 1 },
    ],
    ...overrides,
  };
}

describe("formatDuration", () => {
  it("formats an ISO 8601 duration as Xh YYmin", () => {
    expect(formatDuration("PT4H5M")).toBe("4h 05min");
  });

  it("pads single-digit minutes", () => {
    expect(formatDuration("PT1H5M")).toBe("1h 05min");
  });

  it("handles zero minutes", () => {
    expect(formatDuration("PT2H0M")).toBe("2h 00min");
  });
});

describe("formatTimeRange", () => {
  it("formats departure and arrival as HH:mm → HH:mm in pt-BR", () => {
    expect(formatTimeRange("2026-08-10T14:30:00.000Z", "2026-08-10T18:35:00.000Z")).toBe(
      `${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
        new Date("2026-08-10T14:30:00.000Z")
      )} → ${new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(
        new Date("2026-08-10T18:35:00.000Z")
      )}`
    );
  });
});

describe("formatStopsLabel", () => {
  it("returns Direto for a single segment", () => {
    expect(formatStopsLabel([buildSegment()])).toBe("Direto");
  });

  it("returns a connection label with the layover airport for 2 segments", () => {
    const first = buildSegment({ arriving_at: "2026-08-10T16:15:00.000Z" });
    const second = buildSegment({
      id: "seg-2",
      origin: { iata_code: "CNF", name: "Confins" },
      destination: { iata_code: "GIG", name: "Galeão" },
      departing_at: "2026-08-10T17:45:00.000Z",
      arriving_at: "2026-08-10T19:00:00.000Z",
    });
    expect(formatStopsLabel([first, second])).toBe("1 escala em CNF (1h 30min)");
  });

  it("returns an N escalas label for 3+ segments", () => {
    const segments = [buildSegment(), buildSegment({ id: "seg-2" }), buildSegment({ id: "seg-3" })];
    expect(formatStopsLabel(segments)).toBe("2 escalas");
  });
});

describe("formatBaggageSummary", () => {
  it("summarizes carry-on always included plus checked bag count", () => {
    expect(formatBaggageSummary([buildSegment()])).toBe(
      "Mochila incluída · Mala de mão incluída · Despachada 1× 23kg"
    );
  });

  it("says despachada não incluída when no segment has checked baggage", () => {
    const segment = buildSegment({ baggages: [{ type: "carry_on", quantity: 1 }] });
    expect(formatBaggageSummary([segment])).toBe(
      "Mochila incluída · Mala de mão incluída · Despachada não incluída"
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/offer-format.test.ts`
Expected: FAIL — new functions not exported.

- [ ] **Step 3: Append to `src/lib/offer-format.ts`**

Add `import type { OfferSegment } from "./types";` to the top (alongside the existing `import type { Offer } from "./types";` — merge into one line: `import type { Offer, OfferSegment } from "./types";`).

Append:

```ts

export function formatDuration(iso: string): string {
  const match = /PT(\d+)H(\d+)M/.exec(iso);
  if (!match) return iso;
  const hours = match[1];
  const minutes = match[2].padStart(2, "0");
  return `${hours}h ${minutes}min`;
}

export function formatTimeRange(departingAt: string, arrivingAt: string): string {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `${formatter.format(new Date(departingAt))} → ${formatter.format(new Date(arrivingAt))}`;
}

function segmentDurationHours(segment: OfferSegment): number {
  const match = /PT(\d+)H(\d+)M/.exec(segment.duration);
  return match ? Number(match[1]) + Number(match[2]) / 60 : 0;
}

export function formatStopsLabel(segments: OfferSegment[]): string {
  if (segments.length <= 1) return "Direto";
  if (segments.length === 2) {
    const layoverAirport = segments[0].destination.iata_code;
    const layoverMs =
      new Date(segments[1].departing_at).getTime() - new Date(segments[0].arriving_at).getTime();
    const layoverHours = layoverMs / (1000 * 60 * 60);
    const wholeHours = Math.floor(layoverHours);
    const minutes = Math.round((layoverHours - wholeHours) * 60);
    return `1 escala em ${layoverAirport} (${wholeHours}h ${minutes.toString().padStart(2, "0")}min)`;
  }
  return `${segments.length - 1} escalas`;
}

export function formatBaggageSummary(segments: OfferSegment[]): string {
  const checkedCount = segments.reduce((max, segment) => {
    const checked = segment.baggages.find((b) => b.type === "checked");
    return Math.max(max, checked?.quantity ?? 0);
  }, 0);
  const checkedLabel = checkedCount > 0 ? `Despachada ${checkedCount}× 23kg` : "Despachada não incluída";
  return `Mochila incluída · Mala de mão incluída · ${checkedLabel}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/offer-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/offer-format.ts src/lib/offer-format.test.ts
git commit -m "feat(offer-format): add duration/stops/baggage/time-range formatters"
```

---

### Task 8: Add success/warning/info/magic variants to `src/components/ui/badge.tsx`

**Files:**
- Modify: `src/components/ui/badge.tsx`

**Interfaces:**
- Extends `badgeVariants`' `variant` union with `"success" | "warning" | "info" | "magic"`, additive to the existing `"default" | "secondary" | "destructive" | "outline"`.
- Consumed by: Task 9 (`badge-variants.ts` Duffel helpers reference these new variant names).

- [ ] **Step 1: Modify the CVA config**

Change:
```ts
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

To:
```ts
const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        success:
          "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
        warning:
          "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300",
        info:
          "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300",
        magic:
          "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)
```

- [ ] **Step 2: Typecheck and run existing suite**

Run: `cd travel-app && npx tsc --noEmit && npm test`
Expected: no errors; `badge-variants.test.ts` still PASS (it only asserts the 4 old variants, unaffected by new additions).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/badge.tsx
git commit -m "feat(ui): add success/warning/info/magic badge variants"
```

---

### Task 9: Extend `src/lib/badge-variants.ts` with Duffel-shaped badge helpers

**Files:**
- Modify: `src/lib/badge-variants.ts` (append only, plus one additive type-union edit)
- Modify: `src/lib/badge-variants.test.ts` (append only)

**Interfaces:**
- Consumes: `DuffelPolicyEvaluation` from `./policy` (Task 2), `TravelRequestStatus` from `./types` (Task 1).
- Produces: `getDuffelPolicyBadge(evaluation: DuffelPolicyEvaluation): BadgeSpec`, `getDuffelFlagBadges(evaluation: DuffelPolicyEvaluation): BadgeSpec[]`, `getTravelRequestStatusBadge(status: TravelRequestStatus): BadgeSpec`, `getTravelRequestTimelineLabel(kind: TravelRequestEvent["kind"]): string`.
- Consumed by: Task 17 (`PolicyBadges` rewrite), Task 18 (`RequestStatusBadge` rewrite), Task 25 (`/requests/[id]` timeline).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/badge-variants.test.ts`:

```ts

describe("getDuffelPolicyBadge", () => {
  it("labels a compliant Duffel evaluation as within policy (success)", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelPolicyBadge(evaluation)).toEqual({ label: "Dentro da política", variant: "success" });
  });

  it("labels a non-compliant Duffel evaluation as out of policy (warning)", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: false,
      violations: [
        { rule_id: "cost-cap", message: "excede o teto", field: "totalAmount", expected: "<=3500", actual: "4000" },
      ],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelPolicyBadge(evaluation)).toEqual({ label: "Fora da política", variant: "warning" });
  });
});

describe("getDuffelFlagBadges", () => {
  it("returns an info badge for international travel and a magic badge for cost above threshold", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: true, cost_above_threshold: true },
    };
    expect(getDuffelFlagBadges(evaluation)).toEqual([
      { label: "Internacional", variant: "info" },
      { label: "Custo acima do teto", variant: "magic" },
    ]);
  });

  it("returns an empty array when no flags are set", () => {
    const evaluation: DuffelPolicyEvaluation = {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    };
    expect(getDuffelFlagBadges(evaluation)).toEqual([]);
  });
});

describe("getTravelRequestStatusBadge", () => {
  it.each([
    ["pending_admin", "Aguardando aprovação", "outline"],
    ["approved", "Aprovada", "success"],
    ["rejected", "Rejeitada", "destructive"],
    ["needs_review", "Requer revisão", "warning"],
    ["confirmed", "Confirmada", "info"],
    ["cancelled", "Cancelada", "secondary"],
  ] as const)("maps %s to { %s, %s }", (status, label, variant) => {
    expect(getTravelRequestStatusBadge(status)).toEqual({ label, variant });
  });
});

describe("getTravelRequestTimelineLabel", () => {
  it.each([
    ["created", "Criada por você"],
    ["approved", "Aprovada por Travel Admin"],
    ["rejected", "Rejeitada por Travel Admin"],
    ["needs_review", "Marcada para revisão"],
    ["confirmed", "Reserva confirmada"],
    ["cancelled", "Cancelada"],
  ] as const)("maps %s to %s", (kind, label) => {
    expect(getTravelRequestTimelineLabel(kind)).toBe(label);
  });
});
```

Update the top imports to:
```ts
import {
  getDuffelFlagBadges,
  getDuffelPolicyBadge,
  getFlagBadges,
  getPolicyBadge,
  getStatusBadge,
  getTravelRequestStatusBadge,
  getTravelRequestTimelineLabel,
} from "./badge-variants";
import type { DuffelPolicyEvaluation } from "./policy";
import type { PolicyEvaluation, TravelRequestEvent } from "./types";
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/badge-variants.test.ts`
Expected: FAIL — new exports don't exist.

- [ ] **Step 3: Extend `src/lib/badge-variants.ts`**

Change the `BadgeVariant` type (additive union, existing 4 members untouched):
```ts
export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";
```
to:
```ts
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "outline"
  | "success"
  | "warning"
  | "info"
  | "magic";
```

Add a type-only import for `DuffelPolicyEvaluation` and `TravelRequestStatus`/`TravelRequestEvent`:
```ts
import type { DuffelPolicyEvaluation } from "./policy";
import type { PolicyEvaluation, PolicyFlag, RequestStatus, TravelRequestEvent, TravelRequestStatus } from "./types";
```

Append:

```ts

export function getDuffelPolicyBadge(evaluation: DuffelPolicyEvaluation): BadgeSpec {
  return evaluation.compliant
    ? { label: "Dentro da política", variant: "success" }
    : { label: "Fora da política", variant: "warning" };
}

export function getDuffelFlagBadges(evaluation: DuffelPolicyEvaluation): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  if (evaluation.flags.international_travel) {
    badges.push({ label: "Internacional", variant: "info" });
  }
  if (evaluation.flags.cost_above_threshold) {
    badges.push({ label: "Custo acima do teto", variant: "magic" });
  }
  return badges;
}

const TRAVEL_REQUEST_STATUS_BADGES: Record<TravelRequestStatus, BadgeSpec> = {
  pending_admin: { label: "Aguardando aprovação", variant: "outline" },
  approved: { label: "Aprovada", variant: "success" },
  rejected: { label: "Rejeitada", variant: "destructive" },
  needs_review: { label: "Requer revisão", variant: "warning" },
  confirmed: { label: "Confirmada", variant: "info" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export function getTravelRequestStatusBadge(status: TravelRequestStatus): BadgeSpec {
  return TRAVEL_REQUEST_STATUS_BADGES[status];
}

const TIMELINE_LABELS: Record<TravelRequestEvent["kind"], string> = {
  created: "Criada por você",
  approved: "Aprovada por Travel Admin",
  rejected: "Rejeitada por Travel Admin",
  needs_review: "Marcada para revisão",
  confirmed: "Reserva confirmada",
  cancelled: "Cancelada",
};

export function getTravelRequestTimelineLabel(kind: TravelRequestEvent["kind"]): string {
  return TIMELINE_LABELS[kind];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/badge-variants.test.ts`
Expected: PASS, including the pre-existing `getPolicyBadge`/`getFlagBadges`/`getStatusBadge` blocks.

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge-variants.ts src/lib/badge-variants.test.ts
git commit -m "feat(badge-variants): add Duffel policy/status/timeline badge helpers"
```

---

### Task 10: Create `src/lib/trip-flow-reducer.ts` + `src/lib/trip-flow-store.tsx`

**Files:**
- Create: `src/lib/trip-flow-reducer.ts`
- Create: `src/lib/trip-flow-reducer.test.ts`
- Create: `src/lib/trip-flow-store.tsx`
- Modify: `src/components/layout/app-providers.tsx`

**Interfaces:**
- Consumes: `SearchCriteria`, `FlightOffer`, `DuffelPassenger`, `CorporateContext` from `./types` (Task 1).
- Produces: `TripFlowState`, `INITIAL_TRIP_FLOW_STATE`, `TripFlowAction`, `tripFlowReducer(state, action): TripFlowState` (in `trip-flow-reducer.ts`); `TripFlowProvider`, `useTripFlow(): TripFlowContextValue` (in `trip-flow-store.tsx`, "use client").
- Consumed by: Tasks 19-23 (all 5 wizard-flow screens read/write flow state via `useTripFlow()`). This state is in-memory only (no localStorage) — it should reset on a full page reload, matching the handoff's "guards redirect to `/` if required state doesn't exist" behavior.

- [ ] **Step 1: Write the failing test**

Create `src/lib/trip-flow-reducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { INITIAL_TRIP_FLOW_STATE, tripFlowReducer } from "./trip-flow-reducer";
import type { FlightOffer, SearchCriteria } from "./types";

const criteria: SearchCriteria = {
  slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
  passengers: [{ type: "adult" }],
  cabin_class: "economy",
};

const offer: FlightOffer = {
  id: "off-1",
  mode: "flight",
  origin: "GRU",
  destination: "GIG",
  destinationCountry: "BR",
  departureAt: "2026-08-10T10:00:00.000Z",
  cabinClass: "economy",
  airline: "Azul",
  stops: 0,
  refundable: false,
  totalAmount: 500,
  currency: "BRL",
};

describe("tripFlowReducer", () => {
  it("sets criteria and clears any prior offers/selection", () => {
    const seeded = { ...INITIAL_TRIP_FLOW_STATE, offers: [offer], selectedOfferId: "off-1" };
    const next = tripFlowReducer(seeded, { type: "SET_CRITERIA", payload: criteria });
    expect(next.criteria).toEqual(criteria);
    expect(next.offers).toEqual([]);
    expect(next.selectedOfferId).toBeNull();
  });

  it("toggles loadingOffers on START_LOADING_OFFERS and clears it on SET_OFFERS", () => {
    const loading = tripFlowReducer(INITIAL_TRIP_FLOW_STATE, { type: "START_LOADING_OFFERS" });
    expect(loading.loadingOffers).toBe(true);

    const loaded = tripFlowReducer(loading, { type: "SET_OFFERS", payload: [offer] });
    expect(loaded.loadingOffers).toBe(false);
    expect(loaded.offers).toEqual([offer]);
  });

  it("stores the selected offer id", () => {
    const next = tripFlowReducer(INITIAL_TRIP_FLOW_STATE, { type: "SELECT_OFFER", payload: "off-1" });
    expect(next.selectedOfferId).toBe("off-1");
  });

  it("resets to the initial state", () => {
    const dirty = { ...INITIAL_TRIP_FLOW_STATE, criteria, selectedOfferId: "off-1" };
    expect(tripFlowReducer(dirty, { type: "RESET" })).toEqual(INITIAL_TRIP_FLOW_STATE);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/trip-flow-reducer.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `src/lib/trip-flow-reducer.ts`**

```ts
import type { CorporateContext, DuffelPassenger, FlightOffer, SearchCriteria } from "./types";

export interface TripFlowState {
  criteria: SearchCriteria | null;
  offers: FlightOffer[];
  loadingOffers: boolean;
  selectedOfferId: string | null;
  passengers: DuffelPassenger[] | null;
  corporate: CorporateContext | null;
}

export const INITIAL_TRIP_FLOW_STATE: TripFlowState = {
  criteria: null,
  offers: [],
  loadingOffers: false,
  selectedOfferId: null,
  passengers: null,
  corporate: null,
};

export type TripFlowAction =
  | { type: "SET_CRITERIA"; payload: SearchCriteria }
  | { type: "START_LOADING_OFFERS" }
  | { type: "SET_OFFERS"; payload: FlightOffer[] }
  | { type: "SELECT_OFFER"; payload: string }
  | { type: "SET_PASSENGERS"; payload: DuffelPassenger[] }
  | { type: "SET_CORPORATE"; payload: CorporateContext }
  | { type: "RESET" };

export function tripFlowReducer(state: TripFlowState, action: TripFlowAction): TripFlowState {
  switch (action.type) {
    case "SET_CRITERIA":
      return { ...state, criteria: action.payload, offers: [], selectedOfferId: null };
    case "START_LOADING_OFFERS":
      return { ...state, loadingOffers: true };
    case "SET_OFFERS":
      return { ...state, offers: action.payload, loadingOffers: false };
    case "SELECT_OFFER":
      return { ...state, selectedOfferId: action.payload };
    case "SET_PASSENGERS":
      return { ...state, passengers: action.payload };
    case "SET_CORPORATE":
      return { ...state, corporate: action.payload };
    case "RESET":
      return INITIAL_TRIP_FLOW_STATE;
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/trip-flow-reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/lib/trip-flow-store.tsx`**

```tsx
"use client";

import { createContext, useContext, useMemo, useReducer, type ReactNode } from "react";
import { INITIAL_TRIP_FLOW_STATE, tripFlowReducer, type TripFlowState } from "./trip-flow-reducer";
import type { CorporateContext, DuffelPassenger, FlightOffer, SearchCriteria } from "./types";

interface TripFlowContextValue extends TripFlowState {
  selectedOffer: FlightOffer | null;
  setCriteria: (criteria: SearchCriteria) => void;
  startLoadingOffers: () => void;
  setOffers: (offers: FlightOffer[]) => void;
  selectOffer: (offerId: string) => void;
  setPassengers: (passengers: DuffelPassenger[]) => void;
  setCorporate: (corporate: CorporateContext) => void;
  reset: () => void;
}

const TripFlowContext = createContext<TripFlowContextValue | null>(null);

export function TripFlowProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tripFlowReducer, INITIAL_TRIP_FLOW_STATE);

  const value = useMemo<TripFlowContextValue>(() => {
    const selectedOffer = state.offers.find((offer) => offer.id === state.selectedOfferId) ?? null;
    return {
      ...state,
      selectedOffer,
      setCriteria: (criteria) => dispatch({ type: "SET_CRITERIA", payload: criteria }),
      startLoadingOffers: () => dispatch({ type: "START_LOADING_OFFERS" }),
      setOffers: (offers) => dispatch({ type: "SET_OFFERS", payload: offers }),
      selectOffer: (offerId) => dispatch({ type: "SELECT_OFFER", payload: offerId }),
      setPassengers: (passengers) => dispatch({ type: "SET_PASSENGERS", payload: passengers }),
      setCorporate: (corporate) => dispatch({ type: "SET_CORPORATE", payload: corporate }),
      reset: () => dispatch({ type: "RESET" }),
    };
  }, [state]);

  return <TripFlowContext.Provider value={value}>{children}</TripFlowContext.Provider>;
}

export function useTripFlow(): TripFlowContextValue {
  const ctx = useContext(TripFlowContext);
  if (!ctx) {
    throw new Error("useTripFlow must be used within a TripFlowProvider");
  }
  return ctx;
}
```

- [ ] **Step 6: Wire `TripFlowProvider` into `src/components/layout/app-providers.tsx`**

Change:
```tsx
"use client";

import type { ReactNode } from "react";
import { RequestsProvider } from "@/lib/requests-store";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RequestsProvider>
      {children}
      <Toaster position="top-right" />
    </RequestsProvider>
  );
}
```
to:
```tsx
"use client";

import type { ReactNode } from "react";
import { RequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <RequestsProvider>
      <TripFlowProvider>
        {children}
        <Toaster position="top-right" />
      </TripFlowProvider>
    </RequestsProvider>
  );
}
```

- [ ] **Step 7: Typecheck and run full suite**

Run: `cd travel-app && npx tsc --noEmit && npm test`
Expected: no errors, all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/trip-flow-reducer.ts src/lib/trip-flow-reducer.test.ts src/lib/trip-flow-store.tsx src/components/layout/app-providers.tsx
git commit -m "feat(trip-flow): add in-memory wizard flow state provider"
```

---

### Task 11: Extend `src/lib/requests-reducer.ts` and `src/lib/requests-store.tsx` with `TravelRequest` persistence

**Files:**
- Modify: `src/lib/requests-reducer.ts` (append only)
- Modify: `src/lib/requests-reducer.test.ts` (append only)
- Modify: `src/lib/requests-store.tsx` (append only — add a second provider/hook in the same file)

**Interfaces:**
- Consumes: `TravelRequest` from `./types` (Task 1).
- Produces: `TravelRequestAction`, `travelRequestsReducer(state, action): TravelRequest[]` (reducer file); `TravelRequestsProvider`, `useTravelRequests(): { travelRequests: TravelRequest[]; addTravelRequest: (r: TravelRequest) => void; cancelTravelRequest: (id: string, at: string) => void }` (store file).
- Consumed by: Task 23 (review screen submits via `addTravelRequest`), Tasks 24-25 (`/requests`, `/requests/[id]` read `travelRequests` and call `cancelTravelRequest`).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/requests-reducer.test.ts` (extend the top import to `import { requestsReducer, travelRequestsReducer } from "./requests-reducer";` and add `import type { TravelRequest, TripRequest } from "./types";`):

```ts

function buildTravelRequest(overrides: Partial<TravelRequest> = {}): TravelRequest {
  return {
    id: "treq-1",
    organization_id: "org-1",
    employee_id: "emp-1",
    created_at: "2026-07-08T10:00:00.000Z",
    status: "pending_admin",
    search_criteria: {
      slices: [{ origin: "GRU", destination: "GIG", departure_date: "2026-08-10" }],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    },
    selected_offer_snapshot: {
      offer_id: "off-1",
      total_amount: "500.00",
      total_currency: "BRL",
      owner: { iata_code: "AD", name: "Azul", logo_symbol_url: "" },
      slices: [],
      conditions: {
        refund_before_departure: { allowed: false },
        change_before_departure: { allowed: false },
      },
      passenger_identity_documents_required: false,
      expires_at: "2026-08-10T09:00:00.000Z",
    },
    passengers: [],
    corporate: {
      trip_purpose: "conference",
      cost_center: "Engenharia",
      business_justification: "Conferência anual do setor.",
    },
    policy_evaluation: {
      compliant: true,
      violations: [],
      flags: { international_travel: false, cost_above_threshold: false },
    },
    events: [{ at: "2026-07-08T10:00:00.000Z", kind: "created" }],
    ...overrides,
  };
}

describe("travelRequestsReducer", () => {
  it("adds a travel request to an empty list", () => {
    const next = travelRequestsReducer([], { type: "ADD_TRAVEL_REQUEST", payload: buildTravelRequest() });
    expect(next).toEqual([buildTravelRequest()]);
  });

  it("prepends new travel requests, newest first", () => {
    const existing = buildTravelRequest({ id: "treq-old" });
    const incoming = buildTravelRequest({ id: "treq-new" });
    const next = travelRequestsReducer([existing], { type: "ADD_TRAVEL_REQUEST", payload: incoming });
    expect(next.map((r) => r.id)).toEqual(["treq-new", "treq-old"]);
  });

  it("cancels a request by id, setting status and appending a cancelled event", () => {
    const existing = buildTravelRequest();
    const next = travelRequestsReducer([existing], {
      type: "CANCEL_TRAVEL_REQUEST",
      payload: { id: "treq-1", at: "2026-07-09T10:00:00.000Z" },
    });
    expect(next[0].status).toBe("cancelled");
    expect(next[0].events).toHaveLength(2);
    expect(next[0].events[1]).toEqual({ at: "2026-07-09T10:00:00.000Z", kind: "cancelled" });
  });

  it("leaves other requests untouched when cancelling one", () => {
    const a = buildTravelRequest({ id: "treq-a" });
    const b = buildTravelRequest({ id: "treq-b" });
    const next = travelRequestsReducer([a, b], {
      type: "CANCEL_TRAVEL_REQUEST",
      payload: { id: "treq-a", at: "2026-07-09T10:00:00.000Z" },
    });
    expect(next[1]).toEqual(b);
  });

  it("replaces state wholesale on HYDRATE_TRAVEL", () => {
    const existing = buildTravelRequest({ id: "treq-old" });
    const hydrated = [buildTravelRequest({ id: "treq-a" })];
    const next = travelRequestsReducer([existing], { type: "HYDRATE_TRAVEL", payload: hydrated });
    expect(next).toEqual(hydrated);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd travel-app && npx vitest run src/lib/requests-reducer.test.ts`
Expected: FAIL — `travelRequestsReducer` not exported.

- [ ] **Step 3: Append to `src/lib/requests-reducer.ts`**

Add `TravelRequest` to the top type import: `import type { TravelRequest, TripRequest } from "./types";`

Append:

```ts

export type TravelRequestAction =
  | { type: "ADD_TRAVEL_REQUEST"; payload: TravelRequest }
  | { type: "CANCEL_TRAVEL_REQUEST"; payload: { id: string; at: string } }
  | { type: "HYDRATE_TRAVEL"; payload: TravelRequest[] };

export function travelRequestsReducer(
  state: TravelRequest[],
  action: TravelRequestAction
): TravelRequest[] {
  switch (action.type) {
    case "ADD_TRAVEL_REQUEST":
      return [action.payload, ...state];
    case "CANCEL_TRAVEL_REQUEST":
      return state.map((request) =>
        request.id === action.payload.id
          ? {
              ...request,
              status: "cancelled",
              events: [...request.events, { at: action.payload.at, kind: "cancelled" as const }],
            }
          : request
      );
    case "HYDRATE_TRAVEL":
      return action.payload;
    default:
      return state;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd travel-app && npx vitest run src/lib/requests-reducer.test.ts`
Expected: PASS, including the pre-existing `requestsReducer` block.

- [ ] **Step 5: Append `TravelRequestsProvider`/`useTravelRequests` to `src/lib/requests-store.tsx`**

Add `travelRequestsReducer` to the existing reducer import and `TravelRequest` to the type import:
```tsx
import { requestsReducer, travelRequestsReducer } from "./requests-reducer";
import type { TravelRequest, TripRequest } from "./types";
```

Append (after the existing `useRequests` function):

```tsx

const TRAVEL_STORAGE_KEY = "travel-app.travel-requests.v1";

interface TravelRequestsContextValue {
  travelRequests: TravelRequest[];
  addTravelRequest: (request: TravelRequest) => void;
  cancelTravelRequest: (id: string, at: string) => void;
}

const TravelRequestsContext = createContext<TravelRequestsContextValue | null>(null);

export function TravelRequestsProvider({ children }: { children: ReactNode }) {
  const [travelRequests, dispatch] = useReducer(travelRequestsReducer, []);

  useEffect(() => {
    const raw = window.localStorage.getItem(TRAVEL_STORAGE_KEY);
    if (!raw) return;
    try {
      dispatch({ type: "HYDRATE_TRAVEL", payload: JSON.parse(raw) as TravelRequest[] });
    } catch {
      // Corrupt/incompatible localStorage data — ignore and keep the initial empty state.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(TRAVEL_STORAGE_KEY, JSON.stringify(travelRequests));
  }, [travelRequests]);

  const value = useMemo<TravelRequestsContextValue>(
    () => ({
      travelRequests,
      addTravelRequest: (request) => dispatch({ type: "ADD_TRAVEL_REQUEST", payload: request }),
      cancelTravelRequest: (id, at) => dispatch({ type: "CANCEL_TRAVEL_REQUEST", payload: { id, at } }),
    }),
    [travelRequests]
  );

  return (
    <TravelRequestsContext.Provider value={value}>{children}</TravelRequestsContext.Provider>
  );
}

export function useTravelRequests(): TravelRequestsContextValue {
  const ctx = useContext(TravelRequestsContext);
  if (!ctx) {
    throw new Error("useTravelRequests must be used within a TravelRequestsProvider");
  }
  return ctx;
}
```

- [ ] **Step 6: Wire `TravelRequestsProvider` into `src/components/layout/app-providers.tsx`**

Change (building on Task 10's edit):
```tsx
import { RequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
```
to:
```tsx
import { RequestsProvider, TravelRequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
```
and wrap `<RequestsProvider>` with `<TravelRequestsProvider>` (outermost):
```tsx
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TravelRequestsProvider>
      <RequestsProvider>
        <TripFlowProvider>
          {children}
          <Toaster position="top-right" />
        </TripFlowProvider>
      </RequestsProvider>
    </TravelRequestsProvider>
  );
}
```

- [ ] **Step 7: Typecheck and run full suite**

Run: `cd travel-app && npx tsc --noEmit && npm test`
Expected: no errors, all tests PASS (old `RequestsProvider`/`useRequests` untouched and still tested indirectly via `requestsReducer.test.ts`).

- [ ] **Step 8: Commit**

```bash
git add src/lib/requests-reducer.ts src/lib/requests-reducer.test.ts src/lib/requests-store.tsx src/components/layout/app-providers.tsx
git commit -m "feat(requests-store): add TravelRequestsProvider for Duffel-shaped requests"
```

---

## Phase 1 — Design system & shared components

### Task 12: Add missing shadcn/ui primitives

**Files:**
- Create: `src/components/ui/accordion.tsx`, `src/components/ui/switch.tsx`, `src/components/ui/slider.tsx`, `src/components/ui/toggle-group.tsx`, `src/components/ui/toggle.tsx`, `src/components/ui/tooltip.tsx`, `src/components/ui/progress.tsx`, `src/components/ui/sheet.tsx` (generated by the shadcn CLI — exact content is whatever the CLI emits for this project's `components.json`).
- Modify: `package.json` / `package-lock.json` (new Radix dependencies added by the CLI).

**Interfaces:**
- Produces: `Accordion`/`AccordionItem`/`AccordionTrigger`/`AccordionContent`, `Switch`, `Slider`, `ToggleGroup`/`ToggleGroupItem`, `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider`, `Progress`, `Sheet`/`SheetTrigger`/`SheetContent`/`SheetHeader`/`SheetTitle` — standard shadcn component APIs.
- Consumed by: Task 17 (`Tooltip` in `PolicyBadges`), Task 19 (`ToggleGroup` for trip-type segmented control), Task 20 (`Switch`/`Slider` in results filters, `Sheet` for the mobile filters drawer), Task 22 (`Accordion` for passenger blocks).

- [ ] **Step 1: Run the shadcn CLI**

Run: `cd travel-app && npx shadcn@latest add accordion switch slider toggle-group tooltip progress sheet`

Expected: CLI reports each component added, creates the 8 files listed above under `src/components/ui/`, and adds the corresponding `@radix-ui/react-*` packages to `package.json` (`Sheet` reuses `@radix-ui/react-dialog`, already installed, so it may add no new package for that one).

- [ ] **Step 2: Verify the protected config files were not modified**

Run: `cd travel-app && git diff --stat tailwind.config.ts components.json src/styles/paggo-shadcn-vars.css`
Expected: empty output. If the CLI modified any of these three files (some shadcn CLI versions rewrite `tailwind.config.ts` when adding `accordion`'s keyframes), run `git checkout -- tailwind.config.ts components.json src/styles/paggo-shadcn-vars.css` to revert just those files, then manually re-add only the `accordion-down`/`accordion-up` keyframes/animations to `globals.css` instead (not the protected tailwind config) — `tailwindcss-animate` (already installed) already ships these keyframes as a plugin, so no manual keyframe addition should actually be necessary; confirm by checking `git diff tailwind.config.ts` is empty after `tailwindcss-animate`'s plugin handles it.

- [ ] **Step 3: Create `src/components/ui/error-state.tsx`**

The `PROMPT-CLAUDE-DESIGN-EMPLOYEE-VIEW.md` §10 explicitly asks for a reusable `<ErrorState />` to exist starting in this phase even though nothing calls it yet (everything is mocked/synchronous today; it becomes callable once a real Duffel/backend integration can fail). Follow the same presentational pattern as the existing `src/components/ui/empty-state.tsx`:

```tsx
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
  title: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorState({ title, description, onRetry, className }: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex w-full flex-col items-center gap-3 rounded-md border border-dashed border-destructive/40 p-10 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-destructive/10">
        <TriangleAlert className="size-5 text-destructive" strokeWidth={1.5} />
      </div>
      <div className="flex max-w-md flex-col items-center gap-1.5">
        <h3 className="text-base font-medium text-foreground">{title}</h3>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {onRetry ? (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Tentar novamente
        </Button>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 4: Typecheck, lint, and run the suite**

Run: `cd travel-app && npx tsc --noEmit && npm run lint && npm test`
Expected: no errors; all existing tests still PASS (new files aren't imported anywhere yet).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore(ui): add accordion, switch, slider, toggle-group, tooltip, progress, ErrorState"
```

---

### Task 13: Build `AppSidebar` and wire it into the root layout

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `public/paggo-logo-light.svg`, `public/paggo-icon.svg` (copied from the handoff package)
- Modify: `src/app/layout.tsx`
- Delete (flagged for Task 26, do not delete yet): `src/components/layout/top-bar.tsx` becomes unused by this task but stays on disk until Task 26's cleanup pass, to keep this task's diff focused on additive changes.

**Interfaces:**
- Produces: `AppSidebar()` — no props, reads `usePathname()` for active-link highlighting.
- Consumed by: `src/app/layout.tsx` (replaces `<TopBar />`).

- [ ] **Step 1: Copy the logo assets from the design handoff**

Run:
```bash
cp "C:\Users\aaron\AppData\Local\Temp\claude\C--Users-aaron-bootcamp\3b398cb0-7c24-4f1c-b8f0-802e90b14783\scratchpad\handoff\design_handoff_travel_employee\assets\icons\PaggoLogoLight.svg" travel-app/public/paggo-logo-light.svg
cp "C:\Users\aaron\AppData\Local\Temp\claude\C--Users-aaron-bootcamp\3b398cb0-7c24-4f1c-b8f0-802e90b14783\scratchpad\handoff\design_handoff_travel_employee\assets\icons\PaggoIcon.svg" travel-app/public/paggo-icon.svg
```
(If that scratchpad path has been cleaned up by the time this task runs, re-extract `HANDOFF DE DESIGN.zip` from `C:\Users\aaron\bootcamp\` first — the two SVGs live under `design_handoff_travel_employee/assets/icons/`.)

- [ ] **Step 2: Create `src/components/layout/app-sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Plane } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Nova viagem", icon: Plane },
  { href: "/requests", label: "Minhas solicitações", icon: ClipboardList },
] as const;

const CURRENT_USER = { name: "Aaron Moura", initials: "AM" };

export function AppSidebar() {
  const pathname = usePathname();

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
        <div className="flex items-center gap-3 border-t border-sidebar-border px-6 py-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {CURRENT_USER.initials}
          </span>
          <span className="text-sm font-medium">{CURRENT_USER.name}</span>
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
          {CURRENT_USER.initials}
        </span>
      </header>
    </>
  );
}
```

- [ ] **Step 3: Rewrite `src/app/layout.tsx` to use `AppSidebar`**

Change:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/layout/app-providers";
import { TopBar } from "@/components/layout/top-bar";
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
        <AppProviders>
          <TopBar />
          <main className="mx-auto max-w-6xl px-14 py-10">{children}</main>
        </AppProviders>
      </body>
    </html>
  );
}
```
to:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppProviders } from "@/components/layout/app-providers";
import { AppSidebar } from "@/components/layout/app-sidebar";
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
        <AppProviders>
          <AppSidebar />
          <main className="min-h-screen lg:pl-[248px]">
            <div className="px-6 pb-16 pt-8">{children}</div>
          </main>
        </AppProviders>
      </body>
    </html>
  );
}
```

Each of the 7 screen components (Tasks 19-25) is responsible for its own `mx-auto max-w-*` centering wrapper — the layout's `<div>` only provides outer padding, since the handoff specifies a different max-width per screen (688px / 1080px / 760px).

- [ ] **Step 4: Typecheck, lint, run suite**

Run: `cd travel-app && npx tsc --noEmit && npm run lint && npm test`
Expected: no errors (note: `top-bar.tsx` will now show as an unused-file lint concern only if a rule flags orphan files, which `next lint`'s default config does not — no action needed until Task 26).

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/app-sidebar.tsx public/paggo-logo-light.svg public/paggo-icon.svg src/app/layout.tsx
git commit -m "feat(layout): add dark 248px AppSidebar, replace TopBar in root layout"
```

---

### Task 14: Build `WizardStepper`

**Files:**
- Create: `src/components/trip/wizard-stepper.tsx`

**Interfaces:**
- Produces: `WizardStepper({ current }: { current: "criteria" | "passengers" | "review" })`, `WizardStepKey` type.
- Consumed by: Task 19 (`/`), Task 22 (`/request/passengers/[offerId]`), Task 23 (`/request/review`).

- [ ] **Step 1: Create `src/components/trip/wizard-stepper.tsx`**

```tsx
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { key: "criteria", label: "Critérios" },
  { key: "passengers", label: "Passageiros" },
  { key: "review", label: "Revisão" },
] as const;

export type WizardStepKey = (typeof STEPS)[number]["key"];

export function WizardStepper({ current }: { current: WizardStepKey }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <ol className="mx-auto flex w-full max-w-md items-center justify-center gap-2">
      {STEPS.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "active" : "upcoming";
        return (
          <li key={step.key} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                state === "active" && "bg-primary text-primary-foreground",
                state === "done" && "border border-primary text-primary",
                state === "upcoming" && "border border-border text-muted-foreground"
              )}
            >
              {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                state === "upcoming" ? "text-muted-foreground" : "text-foreground"
              )}
            >
              {step.label}
            </span>
            {index < STEPS.length - 1 ? <span className="mx-1 h-px flex-1 bg-border" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/wizard-stepper.tsx
git commit -m "feat(trip): add 3-step WizardStepper"
```

---

### Task 15: Rewrite `src/components/trip/city-airport-combobox.tsx`

**Files:**
- Modify (full rewrite in place — this is one of the 4 "rewritten" files from Global Constraints, not a hard delete): `src/components/trip/city-airport-combobox.tsx`

**Interfaces:**
- Produces: `CityAirportCombobox({ value, onChange, label, placeholder, autoFocus? })` — same core props as today plus a new optional `autoFocus` (needed because the handoff's Origem field auto-focuses). Interaction logic (150ms blur-close via `onMouseDown` preventDefault) is preserved verbatim from the current implementation — only the dropdown row markup and the ≥2-character-to-open rule change.
- Consumes: `searchAirports`, `findAirportByCode` from `./airports` (Task 3 already extended these to 27 airports; no further change needed here).
- Consumed by: Task 19 (search screen).

- [ ] **Step 1: Replace the full file contents**

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
  autoFocus,
}: {
  value: string;
  onChange: (code: string) => void;
  label: string;
  placeholder: string;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [query, setQuery] = useState(() => findAirportByCode(value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout>>();

  const options = open && query.trim().length >= 2 ? searchAirports(query) : [];

  function handleSelect(option: AirportOption) {
    onChange(option.code);
    setQuery(option.label);
    setOpen(false);
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        autoFocus={autoFocus}
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
        <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-popover shadow-md">
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                )}
              >
                <span className="flex h-6 min-w-[2.75rem] items-center justify-center rounded bg-primary/10 px-1.5 text-xs font-semibold text-primary">
                  {option.code}
                </span>
                <span className="flex flex-col">
                  <span className="font-medium text-foreground">{option.label}</span>
                  <span className="text-xs text-muted-foreground">{option.sublabel}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no new errors (existing importers — `flight-criteria-step.tsx`, deleted in Task 26 — still compile until then since the prop shape is backward compatible: `autoFocus` is optional).

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/city-airport-combobox.tsx
git commit -m "refactor(trip): restyle CityAirportCombobox with IATA chip rows"
```

---

### Task 16: Rewrite `src/components/trip/offer-card.tsx`

**Files:**
- Modify (full rewrite in place): `src/components/trip/offer-card.tsx`

**Interfaces:**
- Produces: `OfferCard({ offer: FlightOffer, onSelect: () => void, onViewDetails: () => void })`.
- Consumes: `evaluateDuffelOffer` (Task 2), `getDuffelPolicyBadge`/`getDuffelFlagBadges` (Task 9), `formatBaggageSummary`/`formatCurrency`/`formatDuration`/`formatStopsLabel`/`formatTimeRange` (Task 7).
- Consumed by: Task 20 (`/results` screen).

- [ ] **Step 1: Replace the full file contents**

```tsx
"use client";

import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import {
  formatBaggageSummary,
  formatCurrency,
  formatDuration,
  formatStopsLabel,
  formatTimeRange,
} from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import type { FlightOffer } from "@/lib/types";

function sliceLabel(index: number, total: number): string {
  if (total <= 1) return "Trecho único";
  if (index === 0) return "Ida";
  if (index === 1 && total === 2) return "Volta";
  return `Trecho ${index + 1}`;
}

export function OfferCard({
  offer,
  onSelect,
  onViewDetails,
}: {
  offer: FlightOffer;
  onSelect: () => void;
  onViewDetails: () => void;
}) {
  const evaluation = evaluateDuffelOffer(offer);
  const policyBadge = getDuffelPolicyBadge(evaluation);
  const flagBadges = getDuffelFlagBadges(evaluation);
  const slices = offer.slices ?? [];
  const expiresInMinutes = offer.expiresAt
    ? Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 60000)
    : null;
  const expiringSoon = expiresInMinutes !== null && expiresInMinutes < 10;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: offer.owner?.brand_color ?? "#9f3f14" }}
            >
              {offer.owner?.iata_code ?? offer.airline.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{offer.airline}</p>
              <p className="text-xs text-muted-foreground">Tarifa {offer.fareBrandName ?? "Light"}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
              {flagBadges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
            <p className="text-xl font-semibold text-foreground">
              {formatCurrency(offer.totalAmount, offer.currency)}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-y border-border py-3">
          {slices.map((slice, index) => (
            <div key={slice.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="w-16 shrink-0 font-medium text-muted-foreground">
                {sliceLabel(index, slices.length)}
              </span>
              <span className="flex-1">
                {formatTimeRange(
                  slice.segments[0].departing_at,
                  slice.segments[slice.segments.length - 1].arriving_at
                )}
                {"  ·  "}
                {slice.origin} → {slice.destination}
                {"  ·  "}
                {formatDuration(slice.duration)}
              </span>
              <span className="shrink-0 text-muted-foreground">{formatStopsLabel(slice.segments)}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <span>{formatBaggageSummary(slices[0]?.segments ?? [])}</span>
            {expiringSoon ? (
              <span className="flex items-center gap-1 font-medium text-amber-700 dark:text-amber-400">
                <Clock className="h-3.5 w-3.5" /> Expira em {Math.max(expiresInMinutes ?? 0, 0)} min
              </span>
            ) : null}
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={onViewDetails}>
              Ver detalhes
            </Button>
            <Button type="button" className="bg-brand-gradient hover:bg-brand-gradient-hover" onClick={onSelect}>
              Selecionar
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/offer-card.tsx
git commit -m "refactor(trip): rewrite OfferCard with slice/segment breakdown and Duffel policy badges"
```

---

### Task 17: Rewrite `src/components/trip/policy-badges.tsx`

**Files:**
- Modify (full rewrite in place): `src/components/trip/policy-badges.tsx`

**Interfaces:**
- Produces: `PolicyBadges({ evaluation: DuffelPolicyEvaluation })`.
- Consumes: `getDuffelPolicyBadge`/`getDuffelFlagBadges` (Task 9), `Tooltip`/`TooltipTrigger`/`TooltipContent`/`TooltipProvider` (Task 12).
- Consumed by: Task 21 (offer detail), Task 24/25 (`/requests`, `/requests/[id]`).

- [ ] **Step 1: Replace the full file contents**

```tsx
"use client";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getDuffelFlagBadges, getDuffelPolicyBadge } from "@/lib/badge-variants";
import type { DuffelPolicyEvaluation } from "@/lib/policy";

export function PolicyBadges({ evaluation }: { evaluation: DuffelPolicyEvaluation }) {
  const policyBadge = getDuffelPolicyBadge(evaluation);
  const flagBadges = getDuffelFlagBadges(evaluation);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {evaluation.compliant ? (
        <Badge variant={policyBadge.variant}>{policyBadge.label}</Badge>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant={policyBadge.variant} className="cursor-help">
              {policyBadge.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <ul className="list-disc space-y-0.5 pl-4 text-xs">
              {evaluation.violations.map((violation) => (
                <li key={violation.rule_id}>{violation.message}</li>
              ))}
            </ul>
          </TooltipContent>
        </Tooltip>
      )}
      {flagBadges.map((badge) => (
        <Badge key={badge.label} variant={badge.variant}>
          {badge.label}
        </Badge>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wrap the app in `TooltipProvider`**

Radix's `Tooltip` requires a `TooltipProvider` ancestor. Modify `src/components/layout/app-providers.tsx` (building on Tasks 10-11's edits) to import `TooltipProvider` from `@/components/ui/tooltip` and wrap the innermost children:

```tsx
"use client";

import type { ReactNode } from "react";
import { RequestsProvider, TravelRequestsProvider } from "@/lib/requests-store";
import { TripFlowProvider } from "@/lib/trip-flow-store";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <TravelRequestsProvider>
      <RequestsProvider>
        <TripFlowProvider>
          <TooltipProvider delayDuration={150}>
            {children}
            <Toaster position="bottom-center" />
          </TooltipProvider>
        </TripFlowProvider>
      </RequestsProvider>
    </TravelRequestsProvider>
  );
}
```

(Note: this changes `position` from the current `"top-right"` to `"bottom-center"` to match the handoff's bottom-centered toast — the only behavioral change in this step beyond adding `TooltipProvider`.)

- [ ] **Step 3: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/trip/policy-badges.tsx src/components/layout/app-providers.tsx
git commit -m "refactor(trip): rewrite PolicyBadges with violation tooltip, add TooltipProvider"
```

---

### Task 18: Rewrite `src/components/trip/request-status-badge.tsx`

**Files:**
- Modify (full rewrite in place): `src/components/trip/request-status-badge.tsx`

**Interfaces:**
- Produces: `RequestStatusBadge({ status: TravelRequestStatus })`.
- Consumes: `getTravelRequestStatusBadge` (Task 9).
- Consumed by: Task 24/25.

- [ ] **Step 1: Replace the full file contents**

```tsx
import { Badge } from "@/components/ui/badge";
import { getTravelRequestStatusBadge } from "@/lib/badge-variants";
import type { TravelRequestStatus } from "@/lib/types";

export function RequestStatusBadge({ status }: { status: TravelRequestStatus }) {
  const badge = getTravelRequestStatusBadge(status);
  return <Badge variant={badge.variant}>{badge.label}</Badge>;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/trip/request-status-badge.tsx
git commit -m "refactor(trip): rewrite RequestStatusBadge for TravelRequestStatus (6 statuses)"
```

---

## Phase 2 — Screens

### Task 19: `/` — Search criteria screen

**Files:**
- Create: `src/components/trip/search-criteria-form.tsx`
- Modify: `src/app/page.tsx` (full replacement)

**Interfaces:**
- Consumes: `tripSearchSchema`, `TripSearchFormValues`, `tripSearchToCriteria` (Task 4); `CityAirportCombobox` (Task 15); `WizardStepper` (Task 14); `useTripFlow` (Task 10).
- Produces: `SearchCriteriaForm()` — no props, self-contained, calls `router.push("/results")` on valid submit after calling `setCriteria(...)`.

- [ ] **Step 1: Create `src/components/trip/search-criteria-form.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { CityAirportCombobox } from "@/components/trip/city-airport-combobox";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import { tripSearchSchema, tripSearchToCriteria, type TripSearchFormValues } from "@/lib/search-schema";
import { useTripFlow } from "@/lib/trip-flow-store";

const TODAY = new Date().toISOString().slice(0, 10);

const DEFAULT_VALUES: TripSearchFormValues = {
  tripType: "round_trip",
  slices: [{ origin: "", destination: "", departureDate: "" }],
  returnDate: "",
  adults: 1,
  children: 0,
  infants: 0,
  cabinClass: "economy",
  maxConnections: 1,
  arriveByOutboundEnabled: false,
  arriveByOutboundTime: "",
  departAfterReturnEnabled: false,
  departAfterReturnTime: "",
};

function Stepper({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>
        <span className="w-4 text-center text-sm font-medium">{value}</span>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-7 w-7"
          onClick={() => onChange(value + 1)}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function SearchCriteriaForm() {
  const router = useRouter();
  const { setCriteria } = useTripFlow();
  const form = useForm<TripSearchFormValues>({
    resolver: zodResolver(tripSearchSchema),
    defaultValues: DEFAULT_VALUES,
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "slices" });
  const tripType = form.watch("tripType");
  const adults = form.watch("adults");
  const children = form.watch("children");
  const infants = form.watch("infants");
  const arriveByOutboundEnabled = form.watch("arriveByOutboundEnabled");
  const departAfterReturnEnabled = form.watch("departAfterReturnEnabled");

  function onSubmit(values: TripSearchFormValues) {
    setCriteria(tripSearchToCriteria(values));
    router.push("/results");
  }

  return (
    <div className="mx-auto flex w-full max-w-[688px] flex-col gap-6">
      <WizardStepper current="criteria" />
      <Card>
        <CardContent className="flex flex-col gap-6 p-8">
          <h1 className="text-2xl font-semibold text-foreground">Nova viagem</h1>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
              <FormField
                control={form.control}
                name="tripType"
                render={({ field }) => (
                  <FormItem>
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
                  </FormItem>
                )}
              />

              {fields.map((field, index) => (
                <div key={field.id} className="flex flex-col gap-3">
                  {tripType === "multi_city" ? (
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-muted-foreground">Trecho {index + 1}</span>
                      {index > 0 ? (
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => remove(index)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <FormField
                      control={form.control}
                      name={`slices.${index}.origin`}
                      render={({ field: originField }) => (
                        <FormItem>
                          <FormControl>
                            <CityAirportCombobox
                              value={originField.value}
                              onChange={originField.onChange}
                              label="De onde você sai?"
                              placeholder="Cidade ou aeroporto"
                              autoFocus={index === 0}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`slices.${index}.destination`}
                      render={({ field: destinationField }) => (
                        <FormItem>
                          <FormControl>
                            <CityAirportCombobox
                              value={destinationField.value}
                              onChange={destinationField.onChange}
                              label="Para onde?"
                              placeholder="Cidade ou aeroporto"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
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
                  </div>
                </div>
              ))}

              {tripType === "multi_city" && fields.length < 4 ? (
                <Button
                  type="button"
                  variant="outline"
                  className="self-start"
                  onClick={() => append({ origin: "", destination: "", departureDate: "" })}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" /> Trecho
                </Button>
              ) : null}

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

              <div className="flex flex-col gap-2">
                <Stepper
                  label="Passageiros"
                  value={adults + children + infants}
                  min={1}
                  onChange={(next) => form.setValue("adults", Math.max(1, adults + (next - (adults + children + infants))))}
                />
                <details className="text-sm">
                  <summary className="cursor-pointer text-primary">Detalhar tipos</summary>
                  <div className="mt-3 flex flex-col gap-2">
                    <Stepper label="Adultos" value={adults} min={1} onChange={(v) => form.setValue("adults", v)} />
                    <Stepper
                      label="Crianças (2–11)"
                      value={children}
                      min={0}
                      onChange={(v) => form.setValue("children", v)}
                    />
                    <Stepper
                      label="Bebês (colo)"
                      value={infants}
                      min={0}
                      onChange={(v) => form.setValue("infants", v)}
                    />
                    {infants > 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Cada bebê precisa de exatamente um adulto responsável (definido na tela de passageiros).
                      </p>
                    ) : null}
                  </div>
                </details>
                {form.formState.errors.adults?.message ? (
                  <p className="text-xs text-destructive">{form.formState.errors.adults.message}</p>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="cabinClass"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Classe de cabine</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="economy">Econômica</SelectItem>
                          <SelectItem value="premium_economy">Premium Econômica</SelectItem>
                          <SelectItem value="business">Executiva</SelectItem>
                          <SelectItem value="first">Primeira</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="maxConnections"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Escalas máximas</FormLabel>
                      <Select value={String(field.value)} onValueChange={(v) => field.onChange(Number(v))}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="0">Sem escalas</SelectItem>
                          <SelectItem value="1">Até 1 escala</SelectItem>
                          <SelectItem value="2">Até 2 escalas</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
              </div>

              <details className="rounded-md border border-border p-4 text-sm">
                <summary className="cursor-pointer font-medium text-foreground">Preferências</summary>
                <div className="mt-4 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id="arrive-by-outbound"
                      checked={arriveByOutboundEnabled}
                      onCheckedChange={(checked) => form.setValue("arriveByOutboundEnabled", Boolean(checked))}
                    />
                    <Label htmlFor="arrive-by-outbound">Chegar até um horário (ida)</Label>
                    {arriveByOutboundEnabled ? (
                      <Input
                        type="time"
                        className="w-32"
                        {...form.register("arriveByOutboundTime")}
                      />
                    ) : null}
                  </div>
                  {tripType === "round_trip" ? (
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id="depart-after-return"
                        checked={departAfterReturnEnabled}
                        onCheckedChange={(checked) => form.setValue("departAfterReturnEnabled", Boolean(checked))}
                      />
                      <Label htmlFor="depart-after-return">Sair a partir de um horário (volta)</Label>
                      {departAfterReturnEnabled ? (
                        <Input
                          type="time"
                          className="w-32"
                          {...form.register("departAfterReturnTime")}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </details>

              <div className="flex justify-end">
                <Button type="submit" size="lg" className="bg-brand-gradient hover:bg-brand-gradient-hover">
                  Buscar ofertas
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/page.tsx`**

```tsx
import { SearchCriteriaForm } from "@/components/trip/search-criteria-form";

export default function HomePage() {
  return <SearchCriteriaForm />;
}
```

- [ ] **Step 3: Typecheck, lint, build**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors. (`npm run build` is deferred to the end of Phase 2 in Task 26, once all routes exist — building mid-phase would fail on the not-yet-created `/results` link target only as a lint warning, not a build error, since Next.js doesn't validate `router.push` string targets at build time.)

- [ ] **Step 4: Manual smoke check**

Run: `cd travel-app && npm run dev`, open `http://localhost:3000/`, confirm the form renders, fill in a domestic round trip (e.g. GRU → GIG, dates a week apart), and click "Buscar ofertas" — it will currently 404 on `/results` until Task 20 lands; that's expected at this point in the plan.

- [ ] **Step 5: Commit**

```bash
git add src/components/trip/search-criteria-form.tsx src/app/page.tsx
git commit -m "feat(search): rebuild / as the trip-criteria wizard step"
```

---

### Task 20: `/results` — Results screen

**Files:**
- Create: `src/app/results/page.tsx`

**Interfaces:**
- Consumes: `useTripFlow` (Task 10), `generateOffers` (Task 6), `evaluateDuffelOffer` (Task 2), `OfferCard` (Task 16), `EmptyState` (existing: `{ title, description?, icon?: LucideIcon, button?: { label, onClick, hierarchy? } }`).
- Produces: default export `ResultsPage()`. Route guard: if `criteria` is null in `useTripFlow()`, render the "no search" empty state instead of redirecting (matches the handoff's guard behavior without a router-side-effect footgun).

- [ ] **Step 1: Create `src/app/results/page.tsx`**

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilLine, SearchX, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { OfferCard } from "@/components/trip/offer-card";
import { generateOffers } from "@/lib/mock-data";
import { formatDate } from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";
import type { FlightOffer } from "@/lib/types";

type SortKey = "price" | "duration" | "departure";

const CABIN_LABELS: Record<string, string> = {
  economy: "Econômica",
  premium_economy: "Premium Econômica",
  business: "Executiva",
  first: "Primeira",
};

interface FiltersPanelProps {
  sortKey: SortKey;
  onSortKeyChange: (key: SortKey) => void;
  carriers: string[];
  carrierFilter: Set<string>;
  onCarrierFilterChange: (next: Set<string>) => void;
  priceCeiling: number;
  effectiveMaxPrice: number;
  onMaxPriceChange: (value: number) => void;
  onlyInPolicy: boolean;
  onOnlyInPolicyChange: (value: boolean) => void;
}

function FiltersPanel({
  sortKey,
  onSortKeyChange,
  carriers,
  carrierFilter,
  onCarrierFilterChange,
  priceCeiling,
  effectiveMaxPrice,
  onMaxPriceChange,
  onlyInPolicy,
  onOnlyInPolicyChange,
}: FiltersPanelProps) {
  return (
    <div className="flex flex-col gap-6">
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
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Companhias</p>
        <div className="flex flex-col gap-1.5 text-sm">
          {carriers.map((carrier) => (
            <label key={carrier} className="flex items-center gap-2">
              <Checkbox
                checked={carrierFilter.size === 0 || carrierFilter.has(carrier)}
                onCheckedChange={(checked) => {
                  const next = new Set(carrierFilter.size === 0 ? carriers : carrierFilter);
                  if (checked) next.add(carrier);
                  else next.delete(carrier);
                  onCarrierFilterChange(next);
                }}
              />
              {carrier}
            </label>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-foreground">Preço até</p>
        <Slider
          min={0}
          max={priceCeiling || 1}
          step={50}
          value={[effectiveMaxPrice]}
          onValueChange={([value]) => onMaxPriceChange(value)}
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor="only-in-policy" className="text-sm">
          Somente dentro da política
        </Label>
        <Switch id="only-in-policy" checked={onlyInPolicy} onCheckedChange={onOnlyInPolicyChange} />
      </div>
    </div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const { criteria, offers, loadingOffers, setOffers, startLoadingOffers, selectOffer } = useTripFlow();

  const [sortKey, setSortKey] = useState<SortKey>("price");
  const [carrierFilter, setCarrierFilter] = useState<Set<string>>(new Set());
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [onlyInPolicy, setOnlyInPolicy] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (!criteria) return;
    startLoadingOffers();
    const timeout = setTimeout(() => {
      setOffers(generateOffers(criteria));
    }, 1200);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criteria]);

  const carriers = useMemo(() => Array.from(new Set(offers.map((o) => o.airline))), [offers]);
  const priceCeiling = useMemo(() => offers.reduce((max, o) => Math.max(max, o.totalAmount), 0), [offers]);
  const effectiveMaxPrice = maxPrice ?? priceCeiling;

  const filtered = useMemo(() => {
    let list = offers;
    if (carrierFilter.size > 0) list = list.filter((o) => carrierFilter.has(o.airline));
    list = list.filter((o) => o.totalAmount <= effectiveMaxPrice);
    if (onlyInPolicy) list = list.filter((o) => evaluateDuffelOffer(o).compliant);

    return [...list].sort((a, b) => {
      if (sortKey === "price") return a.totalAmount - b.totalAmount;
      if (sortKey === "duration") return (a.longestSegmentHours ?? 0) - (b.longestSegmentHours ?? 0);
      return new Date(a.departureAt).getTime() - new Date(b.departureAt).getTime();
    });
  }, [offers, carrierFilter, effectiveMaxPrice, onlyInPolicy, sortKey]);

  const expiringSoon = offers.some(
    (o) => o.expiresAt && new Date(o.expiresAt).getTime() - Date.now() < 10 * 60 * 1000
  );

  if (!criteria) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Nenhuma busca informada"
          description="Volte para a busca e informe origem, destino e datas."
          button={{ label: "Editar busca", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  const firstSlice = criteria.slices[0];
  const lastSlice = criteria.slices[criteria.slices.length - 1];
  const passengerCount = criteria.passengers.length;

  function handleSelect(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }

  function handleViewDetails(offer: FlightOffer) {
    selectOffer(offer.id);
    router.push(`/offer/${offer.id}`);
  }

  const filtersPanelProps: FiltersPanelProps = {
    sortKey,
    onSortKeyChange: setSortKey,
    carriers,
    carrierFilter,
    onCarrierFilterChange: setCarrierFilter,
    priceCeiling,
    effectiveMaxPrice,
    onMaxPriceChange: setMaxPrice,
    onlyInPolicy,
    onOnlyInPolicyChange: setOnlyInPolicy,
  };

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            {firstSlice.origin} → {lastSlice.destination}
          </h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(firstSlice.departure_date)}
            {criteria.slices.length > 1 ? ` — ${formatDate(lastSlice.departure_date)}` : ""} ·{" "}
            {passengerCount} passageiro{passengerCount > 1 ? "s" : ""} · {CABIN_LABELS[criteria.cabin_class]}
          </p>
        </div>
        <Button variant="secondary" onClick={() => router.push("/")}>
          <PencilLine className="mr-1.5 h-4 w-4" /> Editar busca
        </Button>
      </div>

      {expiringSoon ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Algumas ofertas expiram em breve. Preços podem mudar após a expiração.
        </div>
      ) : null}

      <div className="lg:hidden">
        <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
          <SheetTrigger asChild>
            <Button type="button" variant="outline" size="sm">
              <SlidersHorizontal className="mr-1.5 h-4 w-4" /> Filtros
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filtros</SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <FiltersPanel {...filtersPanelProps} />
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[224px_1fr]">
        <aside className="hidden lg:sticky lg:top-20 lg:flex lg:h-fit lg:flex-col">
          <FiltersPanel {...filtersPanelProps} />
        </aside>

        <div className="flex flex-col gap-3.5">
          {loadingOffers ? (
            Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-40 w-full rounded-lg" />)
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={SearchX}
              title="Nenhuma oferta encontrada"
              description="Tente ajustar as datas ou a cidade."
              button={{ label: "Editar busca", onClick: () => router.push("/"), hierarchy: "secondary" }}
            />
          ) : (
            filtered.map((offer) => (
              <OfferCard
                key={offer.id}
                offer={offer}
                onSelect={() => handleSelect(offer)}
                onViewDetails={() => handleViewDetails(offer)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run: `cd travel-app && npm run dev`, submit the search form from `/`, confirm: skeletons appear for ~1.2s, then 5 offer cards render with policy badges, sort/filter controls change the visible list, and the destination `ABV` (type any origin, destination "Abuja" to resolve to `ABV`) produces the empty state. Resize the browser below `1024px` (or use device emulation) and confirm the sidebar filters disappear and a "Filtros" button opens the same controls in a left-side sheet; changing a filter inside the sheet updates the list behind it live.

- [ ] **Step 4: Commit**

```bash
git add src/app/results/page.tsx
git commit -m "feat(results): add /results with filters, skeleton loading, empty state"
```

---

### Task 21: `/offer/[id]` — Offer detail screen

**Files:**
- Create: `src/app/offer/[id]/page.tsx`

**Interfaces:**
- Consumes: `useTripFlow` (`offers`, `selectedOffer`, `selectOffer`), `evaluateDuffelOffer` (Task 2), `PolicyBadges` (Task 17), `formatCurrency`/`formatDate`/`formatDuration`/`formatTimeRange` (Task 7), `EmptyState`.
- Produces: default export `OfferDetailPage()`, reading `id` via `useParams<{ id: string }>()`.

- [ ] **Step 1: Create `src/app/offer/[id]/page.tsx`**

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { formatCurrency, formatDuration, formatTimeRange } from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import { useTripFlow } from "@/lib/trip-flow-store";

export default function OfferDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { offers, selectOffer } = useTripFlow();
  const offer = offers.find((o) => o.id === id);

  if (!offer) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Oferta não encontrada"
          description="Ela pode ter expirado, ou a busca ainda não foi refeita nesta sessão."
          button={{ label: "Voltar aos resultados", onClick: () => router.push("/results") }}
        />
      </div>
    );
  }

  const evaluation = evaluateDuffelOffer(offer);
  const expiresInMinutes = offer.expiresAt
    ? Math.round((new Date(offer.expiresAt).getTime() - Date.now()) / 60000)
    : null;
  const expiringSoon = expiresInMinutes !== null && expiresInMinutes < 5;
  const isExpired = expiresInMinutes !== null && expiresInMinutes <= 0;

  function handleSelectOffer() {
    if (!offer) return;
    selectOffer(offer.id);
    router.push(`/request/passengers/${offer.id}`);
  }

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-6">
      <button
        type="button"
        onClick={() => router.push("/results")}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" /> Voltar aos resultados
      </button>

      {expiringSoon ? (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Esta oferta {isExpired ? "expirou" : "está expirando"}. {isExpired ? "Volte aos resultados para buscar novamente." : "Selecione rápido para garantir o preço."}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          {(offer.slices ?? []).map((slice, sliceIndex) => (
            <Card key={slice.id}>
              <CardContent className="flex flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-semibold text-foreground">
                    {sliceIndex === 0 ? "Ida" : "Volta"} — {slice.origin} → {slice.destination}
                  </h2>
                  <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold text-background">
                    {slice.fare_brand_name}
                  </span>
                </div>
                <div className="flex flex-col gap-4 border-l-2 border-border pl-4">
                  {slice.segments.map((segment, segmentIndex) => (
                    <div key={segment.id} className="flex flex-col gap-1">
                      <p className="text-sm font-medium text-foreground">
                        {formatTimeRange(segment.departing_at, segment.arriving_at)} · {segment.origin.name} →{" "}
                        {segment.destination.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {segment.marketing_carrier.name} {segment.marketing_carrier_flight_number} ·{" "}
                        {segment.aircraft.name} · {formatDuration(segment.duration)}
                        {segment.operating_carrier.iata_code !== segment.marketing_carrier.iata_code
                          ? ` · operado por ${segment.operating_carrier.name}`
                          : ""}
                      </p>
                      {segmentIndex < slice.segments.length - 1 ? (
                        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                          Conexão em {segment.destination.iata_code} — aguarde a próxima etapa do trecho
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardContent className="flex flex-col gap-3 p-6 text-sm">
              <h2 className="text-base font-semibold text-foreground">Condições da tarifa</h2>
              <p>
                Reembolsável antes da partida:{" "}
                {offer.conditions?.refund_before_departure.allowed ? "Sim" : "Não"}
                {offer.conditions?.refund_before_departure.allowed &&
                offer.conditions?.refund_before_departure.penalty_amount
                  ? ` (penalidade de ${formatCurrency(
                      Number(offer.conditions.refund_before_departure.penalty_amount),
                      offer.conditions.refund_before_departure.penalty_currency ?? "BRL"
                    )})`
                  : ""}
              </p>
              <p>
                Alterável antes da partida: {offer.conditions?.change_before_departure.allowed ? "Sim" : "Não"}
                {offer.conditions?.change_before_departure.allowed &&
                offer.conditions?.change_before_departure.penalty_amount
                  ? ` (penalidade de ${formatCurrency(
                      Number(offer.conditions.change_before_departure.penalty_amount),
                      offer.conditions.change_before_departure.penalty_currency ?? "BRL"
                    )})`
                  : ""}
              </p>
              <p>Emissões estimadas: {offer.totalEmissionsKg ?? 0} kg CO₂</p>
            </CardContent>
          </Card>

          {offer.availableServices && offer.availableServices.length > 0 ? (
            <Card>
              <CardContent className="flex flex-col gap-2 p-6 text-sm">
                <h2 className="text-base font-semibold text-foreground">Serviços disponíveis</h2>
                <p className="text-xs text-muted-foreground">
                  Apenas informativo nesta fase — a compra de serviços extras não está disponível.
                </p>
                {offer.availableServices.map((service, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <span>{service.title}</span>
                    <span className="text-muted-foreground">
                      {formatCurrency(Number(service.total_amount), service.total_currency)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

        <Card className="h-fit lg:sticky lg:top-20">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-center gap-3">
              <span
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: offer.owner?.brand_color ?? "#9f3f14" }}
              >
                {offer.owner?.iata_code}
              </span>
              <span className="text-sm font-medium text-foreground">{offer.airline}</span>
            </div>
            <PolicyBadges evaluation={evaluation} />
            <div>
              <p className="text-xs text-muted-foreground">Total para {offer.availableServices ? 1 : 1} passageiro</p>
              <p className="text-2xl font-semibold text-foreground">
                {formatCurrency(offer.totalAmount, offer.currency)}
              </p>
            </div>
            {expiresInMinutes !== null && expiresInMinutes > 0 ? (
              <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                Preço garantido por mais {expiresInMinutes} min
              </p>
            ) : null}
            <Button
              className="w-full bg-brand-gradient hover:bg-brand-gradient-hover"
              disabled={isExpired}
              onClick={handleSelectOffer}
            >
              Selecionar oferta
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run through `/` → `/results` → click "Ver detalhes" on a card → confirm the timeline, conditions, and sticky price card render, and "Selecionar oferta" navigates to `/request/passengers/[id]`.

- [ ] **Step 4: Commit**

```bash
git add src/app/offer/[id]/page.tsx
git commit -m "feat(offer-detail): add /offer/[id] itinerary and conditions screen"
```

---

### Task 22: `/request/passengers/[offerId]` — Passenger data screen

**Files:**
- Create: `src/app/request/passengers/[offerId]/page.tsx`

**Interfaces:**
- Consumes: `duffelPassengersSchema`, `DuffelPassengersFormValues`, `buildEmptyDuffelPassenger`, `toE164` (Task 5); `COUNTRIES` (Task 3); `useTripFlow` (Task 10, for `criteria`/`offers`/`setPassengers`); `WizardStepper` (Task 14); shadcn `Accordion` (Task 12).
- Produces: default export `PassengersPage()`.

- [ ] **Step 1: Create `src/app/request/passengers/[offerId]/page.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleCheck, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import { COUNTRIES } from "@/lib/airports";
import {
  buildEmptyDuffelPassenger,
  duffelPassengersSchema,
  toE164,
  type DuffelPassengerFormValues,
  type DuffelPassengersFormValues,
} from "@/lib/passenger-schema";
import { useTripFlow } from "@/lib/trip-flow-store";
import type { SearchPassengerSpec } from "@/lib/types";

const MOCK_LOGGED_IN_USER = {
  given_name: "Aaron",
  family_name: "Moura",
  born_on: "1998-03-14",
  gender: "m" as const,
  email: "aaron@paggo.com",
  phoneCountry: "55",
  phoneLocalNumber: "41999998888",
};

const TYPE_LABELS: Record<SearchPassengerSpec["type"], string> = {
  adult: "Adulto",
  child: "Criança",
  infant_without_seat: "Bebê",
};

function buildInitialPassengers(
  specs: SearchPassengerSpec[],
  passportRequired: boolean
): DuffelPassengerFormValues[] {
  let adultSeen = false;
  return specs.map((spec, index) => {
    const base = buildEmptyDuffelPassenger(spec.type, `pas-${index + 1}`);
    const withPassport = { ...base, passportRequired };
    if (spec.type === "adult" && !adultSeen) {
      adultSeen = true;
      return { ...withPassport, ...MOCK_LOGGED_IN_USER };
    }
    return withPassport;
  });
}

function isPassengerComplete(passenger: DuffelPassengerFormValues): boolean {
  const baseComplete =
    Boolean(passenger.given_name) &&
    Boolean(passenger.family_name) &&
    Boolean(passenger.born_on) &&
    Boolean(passenger.email) &&
    Boolean(passenger.phoneLocalNumber);
  if (!passenger.passportRequired) return baseComplete;
  return (
    baseComplete &&
    Boolean(passenger.passportNumber) &&
    Boolean(passenger.passportIssuingCountry) &&
    Boolean(passenger.passportExpiresOn)
  );
}

export default function PassengersPage() {
  const { offerId } = useParams<{ offerId: string }>();
  const router = useRouter();
  const { criteria, offers, setPassengers } = useTripFlow();
  const offer = offers.find((o) => o.id === offerId);

  const initialPassengers = useMemo(
    () =>
      criteria
        ? buildInitialPassengers(criteria.passengers, offer?.passengerIdentityDocumentsRequired ?? false)
        : [],
    [criteria, offer]
  );

  const form = useForm<DuffelPassengersFormValues>({
    resolver: zodResolver(duffelPassengersSchema),
    defaultValues: { passengers: initialPassengers },
  });

  const { fields } = useFieldArray({ control: form.control, name: "passengers" });
  const infants = form.watch("passengers").filter((p) => p.type === "infant_without_seat");

  if (!criteria || !offer) {
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          title="Selecione uma oferta primeiro"
          description="Volte aos resultados e escolha uma oferta para continuar."
          button={{ label: "Ver resultados", onClick: () => router.push("/results") }}
        />
      </div>
    );
  }

  function onSubmit(values: DuffelPassengersFormValues) {
    setPassengers(
      values.passengers.map((p) => ({
        id: p.id,
        type: p.type,
        title: p.title,
        given_name: p.given_name,
        family_name: p.family_name,
        born_on: p.born_on,
        gender: p.gender,
        email: p.email,
        phone_number: toE164(p.phoneCountry, p.phoneLocalNumber),
        ...(p.passportRequired
          ? {
              identity_documents: [
                {
                  type: "passport" as const,
                  unique_identifier: p.passportNumber ?? "",
                  issuing_country_code: p.passportIssuingCountry ?? "",
                  expires_on: p.passportExpiresOn ?? "",
                },
              ],
            }
          : {}),
        ...(p.infantResponsibleFor ? { infant_passenger_id: p.infantResponsibleFor } : {}),
      }))
    );
    router.push("/request/review");
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <WizardStepper current="passengers" />
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Dados dos passageiros</h1>
        <p className="text-sm text-muted-foreground">
          Viagem {offer.origin} → {offer.destination} · {offer.airline} · os dados alimentam a emissão do bilhete
          — confira com o documento em mãos.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardContent className="p-2">
              <Accordion type="single" collapsible defaultValue={fields[0]?.id}>
                {fields.map((field, index) => {
                  const passenger = form.watch(`passengers.${index}`);
                  const complete = isPassengerComplete(passenger);
                  return (
                    <AccordionItem key={field.id} value={field.id}>
                      <AccordionTrigger className="px-4">
                        <span className="flex items-center gap-2">
                          Passageiro {index + 1} — {TYPE_LABELS[passenger.type]}
                          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
                          {complete ? <CircleCheck className="h-4 w-4 text-emerald-600" /> : null}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="flex flex-col gap-4 px-4 pb-4">
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.title`}
                            render={({ field: titleField }) => (
                              <FormItem>
                                <FormLabel>Título</FormLabel>
                                <Select value={titleField.value} onValueChange={titleField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="mr">Sr.</SelectItem>
                                    <SelectItem value="mrs">Sra.</SelectItem>
                                    <SelectItem value="ms">Ms.</SelectItem>
                                    <SelectItem value="miss">Srta.</SelectItem>
                                    <SelectItem value="dr">Dr.</SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.given_name`}
                            render={({ field: nameField }) => (
                              <FormItem>
                                <FormLabel>Nome</FormLabel>
                                <FormControl>
                                  <Input {...nameField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.family_name`}
                            render={({ field: lastNameField }) => (
                              <FormItem>
                                <FormLabel>Sobrenome</FormLabel>
                                <FormControl>
                                  <Input {...lastNameField} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                  Sem acentos — as companhias não aceitam acentos no bilhete.
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.born_on`}
                            render={({ field: dobField }) => (
                              <FormItem>
                                <FormLabel>Data de nascimento</FormLabel>
                                <FormControl>
                                  <Input type="date" {...dobField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.gender`}
                            render={({ field: genderField }) => (
                              <FormItem>
                                <FormLabel>Gênero</FormLabel>
                                <Select value={genderField.value} onValueChange={genderField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Selecione..." />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="m">Masculino</SelectItem>
                                    <SelectItem value="f">Feminino</SelectItem>
                                  </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                  As companhias aéreas exigem m/f no bilhete.
                                </p>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.email`}
                            render={({ field: emailField }) => (
                              <FormItem>
                                <FormLabel>E-mail</FormLabel>
                                <FormControl>
                                  <Input type="email" {...emailField} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr]">
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.phoneCountry`}
                            render={({ field: countryField }) => (
                              <FormItem>
                                <FormLabel>Telefone</FormLabel>
                                <Select value={countryField.value} onValueChange={countryField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {COUNTRIES.map((country) => (
                                      <SelectItem key={country.iso2} value={country.dialCode}>
                                        {country.name} (+{country.dialCode})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.phoneLocalNumber`}
                            render={({ field: phoneField }) => (
                              <FormItem>
                                <FormLabel className="opacity-0">Número</FormLabel>
                                <FormControl>
                                  <Input placeholder="41999998888" {...phoneField} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground">
                                  {toE164(form.watch(`passengers.${index}.phoneCountry`), phoneField.value || "")}
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        {passenger.passportRequired ? (
                          <div className="grid grid-cols-1 gap-4 rounded-md border border-border p-4 sm:grid-cols-3">
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportNumber`}
                              render={({ field: passportField }) => (
                                <FormItem>
                                  <FormLabel>Número do passaporte</FormLabel>
                                  <FormControl>
                                    <Input {...passportField} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportIssuingCountry`}
                              render={({ field: issuingField }) => (
                                <FormItem>
                                  <FormLabel>País emissor</FormLabel>
                                  <Select value={issuingField.value} onValueChange={issuingField.onChange}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Selecione..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {COUNTRIES.map((country) => (
                                        <SelectItem key={country.iso2} value={country.iso2}>
                                          {country.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`passengers.${index}.passportExpiresOn`}
                              render={({ field: expiresField }) => (
                                <FormItem>
                                  <FormLabel>Validade</FormLabel>
                                  <FormControl>
                                    <Input type="date" {...expiresField} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                        ) : null}

                        {infants.length > 0 && passenger.type === "adult" ? (
                          <FormField
                            control={form.control}
                            name={`passengers.${index}.infantResponsibleFor`}
                            render={({ field: responsibleField }) => (
                              <FormItem className="max-w-xs">
                                <FormLabel>Responsável por qual bebê?</FormLabel>
                                <Select value={responsibleField.value ?? ""} onValueChange={responsibleField.onChange}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Nenhum" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {infants.map((inf) => (
                                      <SelectItem key={inf.id} value={inf.id}>
                                        Passageiro {form.getValues("passengers").findIndex((p) => p.id === inf.id) + 1}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                        ) : null}
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            </CardContent>
          </Card>

          {form.formState.errors.passengers?.root?.message ? (
            <p className="text-sm text-destructive">{form.formState.errors.passengers.root.message}</p>
          ) : null}

          <div className="flex items-center justify-between">
            <Button type="button" variant="link" onClick={() => router.push(`/offer/${offer.id}`)}>
              Voltar
            </Button>
            <Button type="submit" className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Continuar para revisão
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check**

Run through `/` → `/results` → "Selecionar" on an international offer → confirm the passport block appears, the first passenger is pre-filled with Aaron Moura, the phone E.164 preview updates live, and (if 0 infants were requested) no infant-responsible select renders. Also test a search with 1 infant to confirm the responsible-adult select appears and blocks submit until set.

- [ ] **Step 4: Commit**

```bash
git add "src/app/request/passengers/[offerId]/page.tsx"
git commit -m "feat(passengers): add /request/passengers/[offerId] accordion form"
```

---

### Task 23: `/request/review` — Review & submit screen

**Files:**
- Create: `src/lib/corporate-schema.ts`
- Create: `src/lib/corporate-schema.test.ts`
- Create: `src/app/request/review/page.tsx`

**Interfaces:**
- Produces (`corporate-schema.ts`): `corporateContextSchema`, `CorporateContextFormValues`, `COST_CENTERS: string[]`, `TRIP_PURPOSE_LABELS: Record<TripPurpose, string>`.
- Consumes: `useTripFlow` (`criteria`/`selectedOffer`/`passengers`/`reset`), `useTravelRequests` (`addTravelRequest`, Task 11), `evaluateDuffelOffer` (Task 2), `TravelRequest` type (Task 1).

- [ ] **Step 1: Write the failing test for the new schema**

Create `src/lib/corporate-schema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { corporateContextSchema } from "./corporate-schema";

const valid = {
  trip_purpose: "conference" as const,
  cost_center: "Engenharia",
  project_code: "",
  business_justification: "Conferência anual do setor de pagamentos.",
  isOutOfPolicy: false,
  out_of_policy_justification: "",
};

describe("corporateContextSchema", () => {
  it("accepts a valid compliant submission with no out-of-policy justification", () => {
    expect(corporateContextSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects a business_justification shorter than 20 characters", () => {
    const result = corporateContextSchema.safeParse({ ...valid, business_justification: "Muito curto" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty cost_center", () => {
    const result = corporateContextSchema.safeParse({ ...valid, cost_center: "" });
    expect(result.success).toBe(false);
  });

  it("requires an out_of_policy_justification of at least 50 characters when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification: "Muito curto",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a 50+ character out_of_policy_justification when isOutOfPolicy is true", () => {
    const result = corporateContextSchema.safeParse({
      ...valid,
      isOutOfPolicy: true,
      out_of_policy_justification:
        "Preciso deste voo específico porque é o único com conexão compatível com a agenda do cliente.",
    });
    expect(result.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/corporate-schema.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `src/lib/corporate-schema.ts`**

```ts
import { z } from "zod";

export const corporateContextSchema = z
  .object({
    trip_purpose: z.enum(["client_meeting", "conference", "internal_meeting", "training", "other"], {
      error: "Selecione o motivo da viagem",
    }),
    cost_center: z.string().min(1, "Selecione o centro de custo"),
    project_code: z.string().optional(),
    business_justification: z.string().trim().min(20, "Mínimo 20 caracteres"),
    isOutOfPolicy: z.boolean(),
    out_of_policy_justification: z.string().optional(),
  })
  .refine((d) => !d.isOutOfPolicy || (d.out_of_policy_justification?.trim().length ?? 0) >= 50, {
    message: "Mínimo 50 caracteres explicando por que a oferta fora da política é necessária",
    path: ["out_of_policy_justification"],
  });

export type CorporateContextFormValues = z.infer<typeof corporateContextSchema>;

export const COST_CENTERS = ["Engenharia", "Vendas", "Produto", "Operações", "Diretoria"];

export const TRIP_PURPOSE_LABELS: Record<string, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/corporate-schema.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/app/request/review/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { WizardStepper } from "@/components/trip/wizard-stepper";
import {
  COST_CENTERS,
  TRIP_PURPOSE_LABELS,
  corporateContextSchema,
  type CorporateContextFormValues,
} from "@/lib/corporate-schema";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import { evaluateDuffelOffer } from "@/lib/policy";
import { useTravelRequests } from "@/lib/requests-store";
import { useTripFlow } from "@/lib/trip-flow-store";
import type { TravelRequest } from "@/lib/types";

export default function ReviewPage() {
  const router = useRouter();
  const { criteria, selectedOffer: offer, passengers, corporate, reset } = useTripFlow();
  const { addTravelRequest } = useTravelRequests();
  const evaluation = offer ? evaluateDuffelOffer(offer) : null;

  const form = useForm<CorporateContextFormValues>({
    resolver: zodResolver(corporateContextSchema),
    defaultValues: {
      trip_purpose: corporate?.trip_purpose ?? "client_meeting",
      cost_center: corporate?.cost_center ?? "",
      project_code: corporate?.project_code ?? "",
      business_justification: corporate?.business_justification ?? "",
      isOutOfPolicy: evaluation ? !evaluation.compliant : false,
      out_of_policy_justification: corporate?.out_of_policy_justification ?? "",
    },
  });

  if (!criteria || !offer || !passengers || !evaluation) {
    return (
      <div className="mx-auto max-w-[760px]">
        <EmptyState
          title="Revise as etapas anteriores"
          description="Faltam dados da oferta ou dos passageiros para revisar esta solicitação."
          button={{ label: "Voltar à busca", onClick: () => router.push("/") }}
        />
      </div>
    );
  }

  function onSubmit(values: CorporateContextFormValues) {
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

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <WizardStepper current="review" />
      <h1 className="text-2xl font-semibold text-foreground">Revisar e enviar</h1>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Viagem selecionada</h2>
            <button
              type="button"
              onClick={() => router.push("/results")}
              className="text-sm font-medium text-primary hover:underline"
            >
              trocar oferta
            </button>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium text-foreground">
                {offer.origin} → {offer.destination} {offer.returnAt ? "(ida e volta)" : ""}
              </p>
              <p className="text-muted-foreground">
                {offer.airline} · {formatDate(offer.departureAt)}
                {offer.returnAt ? ` – ${formatDate(offer.returnAt)}` : ""} · {offer.cabinClass}
              </p>
            </div>
            <p className="font-semibold text-foreground">{formatCurrency(offer.totalAmount, offer.currency)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex flex-col gap-3 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Passageiros</h2>
            <button
              type="button"
              onClick={() => router.push(`/request/passengers/${offer.id}`)}
              className="text-sm font-medium text-primary hover:underline"
            >
              editar
            </button>
          </div>
          {passengers.map((passenger) => (
            <div key={passenger.id} className="flex items-center justify-between text-sm">
              <span className="text-foreground">
                {passenger.given_name} {passenger.family_name}{" "}
                <span className="text-muted-foreground">
                  · {passenger.type === "adult" ? "Adulto" : passenger.type === "child" ? "Criança" : "Bebê"}
                </span>
              </span>
              <span className="text-muted-foreground">{formatDate(passenger.born_on)}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6">
          <Card>
            <CardContent className="flex flex-col gap-4 p-6">
              <h2 className="text-base font-semibold text-foreground">Contexto corporativo</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="trip_purpose"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Motivo da viagem</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(TRIP_PURPOSE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cost_center"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Centro de custo</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {COST_CENTERS.map((center) => (
                            <SelectItem key={center} value={center}>
                              {center}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="project_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Código do projeto (opcional)</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: WEBSUMMIT" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="business_justification"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Justificativa corporativa</FormLabel>
                    <FormControl>
                      <Textarea rows={3} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {!evaluation.compliant ? (
                <div className="flex flex-col gap-3 rounded-md border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Esta oferta está fora da política corporativa:
                  </p>
                  <ul className="list-disc pl-4 text-sm text-amber-800 dark:text-amber-300">
                    {evaluation.violations.map((violation) => (
                      <li key={violation.rule_id}>{violation.message}</li>
                    ))}
                  </ul>
                  <FormField
                    control={form.control}
                    name="out_of_policy_justification"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Justificativa fora de política</FormLabel>
                        <FormControl>
                          <Textarea rows={3} placeholder="Descreva por que você precisa dela." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              ) : null}

              <p className="text-xs text-muted-foreground">
                Ao enviar, você declara que os dados dos passageiros estão corretos. A viagem só é confirmada
                após aprovação do Travel Admin. Preços e disponibilidade podem mudar entre a solicitação e a
                reserva final.
              </p>
            </CardContent>
          </Card>

          <div className="flex items-center justify-between">
            <Button type="button" variant="link" onClick={() => router.push(`/request/passengers/${offer.id}`)}>
              Voltar
            </Button>
            <Button type="submit" size="lg" className="bg-brand-gradient hover:bg-brand-gradient-hover">
              Enviar solicitação
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual smoke check**

Run through the full flow end to end with an out-of-policy offer (e.g. a business-class domestic short-haul offer) — confirm the violations banner and the required 50-char textarea appear, submission is blocked until filled, and a compliant offer's review has no such block. After submit, confirm the toast appears and the browser lands on `/requests/[id]`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/corporate-schema.ts src/lib/corporate-schema.test.ts src/app/request/review/page.tsx
git commit -m "feat(review): add /request/review with corporate context and policy violation gate"
```

---

### Task 24: Rebuild `/requests` — My requests list

**Files:**
- Modify (full rewrite): `src/app/requests/page.tsx`

**Interfaces:**
- Consumes: `useTravelRequests` (Task 11), `RequestStatusBadge` (Task 18), `formatCurrency`/`formatDate` (Task 7), `EmptyState`.

- [ ] **Step 1: Replace the full file contents**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plane, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import { useTravelRequests } from "@/lib/requests-store";
import type { TravelRequestStatus } from "@/lib/types";

const STATUS_FILTERS: { value: TravelRequestStatus; label: string }[] = [
  { value: "pending_admin", label: "Aguardando aprovação" },
  { value: "approved", label: "Aprovada" },
  { value: "rejected", label: "Rejeitada" },
  { value: "needs_review", label: "Requer revisão" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
];

export default function RequestsPage() {
  const router = useRouter();
  const { travelRequests } = useTravelRequests();
  const [activeStatuses, setActiveStatuses] = useState<Set<TravelRequestStatus>>(new Set());

  const filtered =
    activeStatuses.size === 0 ? travelRequests : travelRequests.filter((r) => activeStatuses.has(r.status));

  function toggleStatus(status: TravelRequestStatus) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
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

      {travelRequests.length === 0 ? (
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
            const origin = snapshot.slices[0]?.origin ?? "";
            const destination = snapshot.slices.at(-1)?.destination ?? "";
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
                <Button type="button" variant="secondary" size="sm" className="self-start sm:self-auto" asChild>
                  <Link href={`/requests/${request.id}`}>Ver detalhes</Link>
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 3: Manual smoke check at mobile width**

Run: `cd travel-app && npm run dev`, open `/requests` with a few seeded requests, resize the browser to ~375px wide (or use device emulation). Confirm each row stacks into a readable block (route/date on top, passenger count/price/badge/created-date wrapped below, "Ver detalhes" button below that) instead of cramming 6 items onto one squeezed line.

- [ ] **Step 4: Commit**

```bash
git add src/app/requests/page.tsx
git commit -m "feat(requests): rebuild /requests list with status filter chips"
```

---

### Task 25: Rebuild `/requests/[id]` — Request detail screen

**Files:**
- Create: `src/lib/passenger-masking.ts`
- Create: `src/lib/passenger-masking.test.ts`
- Modify (full rewrite): `src/app/requests/[id]/page.tsx`

**Interfaces:**
- Produces (`passenger-masking.ts`): `maskGivenName(givenName: string, familyName: string): string`, `maskEmail(email: string): string`, `maskPhone(phoneNumber: string): string`.
- Consumes: `useTravelRequests` (Task 11), `PolicyBadges` (Task 17), `RequestStatusBadge` (Task 18), `getTravelRequestTimelineLabel` (Task 9), shadcn `Dialog` (existing).

- [ ] **Step 1: Write the failing test**

Create `src/lib/passenger-masking.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { maskEmail, maskGivenName, maskPhone } from "./passenger-masking";

describe("maskGivenName", () => {
  it("keeps the given name and abbreviates the family name to its initial", () => {
    expect(maskGivenName("Aaron", "Moura")).toBe("Aaron M.");
  });
});

describe("maskEmail", () => {
  it("keeps the first two characters of the local part and masks the rest", () => {
    expect(maskEmail("aaron@paggo.com")).toBe("aa***@paggo.com");
  });

  it("returns the input unchanged if there's no @", () => {
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("maskPhone", () => {
  it("shows only the last 4 digits", () => {
    expect(maskPhone("+5541999998888")).toBe("**** 8888");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd travel-app && npx vitest run src/lib/passenger-masking.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Create `src/lib/passenger-masking.ts`**

```ts
export function maskGivenName(givenName: string, familyName: string): string {
  const initial = familyName.trim().charAt(0).toUpperCase();
  return `${givenName} ${initial}.`;
}

export function maskEmail(email: string): string {
  const [user, domain] = email.split("@");
  if (!domain) return email;
  const visible = user.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(user.length - 2, 3))}@${domain}`;
}

export function maskPhone(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `**** ${last4}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd travel-app && npx vitest run src/lib/passenger-masking.test.ts`
Expected: PASS.

- [ ] **Step 5: Replace the full contents of `src/app/requests/[id]/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { EmptyState } from "@/components/ui/empty-state";
import { PolicyBadges } from "@/components/trip/policy-badges";
import { RequestStatusBadge } from "@/components/trip/request-status-badge";
import { getTravelRequestTimelineLabel } from "@/lib/badge-variants";
import { formatCurrency, formatDate } from "@/lib/offer-format";
import { maskEmail, maskGivenName, maskPhone } from "@/lib/passenger-masking";
import { useTravelRequests } from "@/lib/requests-store";

const TRIP_PURPOSE_LABELS: Record<string, string> = {
  client_meeting: "Reunião com cliente",
  conference: "Conferência",
  internal_meeting: "Reunião interna",
  training: "Treinamento",
  other: "Outro",
};

export default function RequestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { travelRequests, cancelTravelRequest } = useTravelRequests();
  const request = travelRequests.find((r) => r.id === id);
  const [showSensitive, setShowSensitive] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  if (!request) {
    return (
      <div className="mx-auto max-w-[1080px]">
        <EmptyState
          title="Solicitação não encontrada"
          description="Ela pode ter sido removida, ou você ainda não recarregou esta lista."
          button={{ label: "Minhas solicitações", onClick: () => router.push("/requests") }}
        />
      </div>
    );
  }

  const snapshot = request.selected_offer_snapshot;
  const rejectionEvent = [...request.events].reverse().find((event) => event.kind === "rejected");

  function handleCancelConfirm() {
    cancelTravelRequest(request.id, new Date().toISOString());
    setCancelOpen(false);
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
          {snapshot.slices[0]?.origin} → {snapshot.slices.at(-1)?.destination}
          {snapshot.slices.length > 1 ? " (ida e volta)" : ""}
        </h1>
        <RequestStatusBadge status={request.status} />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        Criada em{" "}
        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(
          new Date(request.created_at)
        )}
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
                    <p className="text-muted-foreground">
                      {new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeStyle: "short" }).format(
                        new Date(event.at)
                      )}
                    </p>
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
            <Button variant="destructive" onClick={handleCancelConfirm}>
              Cancelar solicitação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck, lint**

Run: `cd travel-app && npx tsc --noEmit && npm run lint`
Expected: no errors.

- [ ] **Step 7: Manual smoke check**

Complete a full submission from `/`, land on `/requests/[id]`, confirm: passenger data is masked by default and toggles correctly, the timeline shows a single "Criada por você" entry, and the "Cancelar solicitação" button appears (status is `pending_admin`) and opens the confirm dialog; confirm cancelling updates the status badge and hides the button.

- [ ] **Step 8: Commit**

```bash
git add src/lib/passenger-masking.ts src/lib/passenger-masking.test.ts "src/app/requests/[id]/page.tsx"
git commit -m "feat(request-detail): rebuild /requests/[id] with masking, timeline, cancel dialog"
```

---

## Phase 3 — Cleanup & verification

### Task 26: Delete obsolete files and run full verification

**Files:**
- Delete: `src/app/search/results/page.tsx`
- Delete: `src/components/trip/flight-request-wizard.tsx`
- Delete: `src/components/trip/flight-criteria-step.tsx`
- Delete: `src/components/trip/passenger-details-step.tsx`
- Delete: `src/components/trip/justification-dialog.tsx`
- Delete: `src/components/layout/top-bar.tsx` (identified in Task 13 as orphaned once `AppSidebar` replaced it in `layout.tsx` — flagged then, deleted now)

**Not deleted, intentionally out of scope** (do not remove these — they were never in the user-confirmed discard list, and removing them would be unrequested scope expansion):
- `src/lib/search-offers.ts` / `src/lib/search-offers.test.ts` — orphaned once `search/results/page.tsx` is gone, but kept since only components were confirmed for removal, not lib modules. If the user wants this cleaned up too, that's a follow-up request.
- `StayOffer`, `MOCK_STAY_OFFERS`, `staySearchSchema`, old `TripRequest`/`requestsReducer`/`RequestsProvider`/`useRequests`, `MOCK_FLIGHT_OFFERS`, `ORGANIZATION_POLICY`, `getPolicyBadge`/`getFlagBadges`/`getStatusBadge` — all still exported and still tested; none of this was asked to be removed, and Global Constraints required every existing test to keep passing.

- [ ] **Step 1: Delete the 6 files**

```bash
cd travel-app
git rm src/app/search/results/page.tsx
git rm src/components/trip/flight-request-wizard.tsx
git rm src/components/trip/flight-criteria-step.tsx
git rm src/components/trip/passenger-details-step.tsx
git rm src/components/trip/justification-dialog.tsx
git rm src/components/layout/top-bar.tsx
```

- [ ] **Step 2: Search for any remaining references to the deleted files**

Run: `cd travel-app && grep -rn "flight-request-wizard\|flight-criteria-step\|passenger-details-step\|justification-dialog\|layout/top-bar" src/ --include="*.tsx" --include="*.ts"`
Expected: no output. If anything is found, fix that import before proceeding (it means a file was deleted before all its consumers were migrated — re-check Tasks 19-25 were fully applied first).

- [ ] **Step 3: Full verification**

Run: `cd travel-app && npx tsc --noEmit && npm run lint && npm test && npm run build`
Expected: all four pass clean. `npm run build` in particular validates every dynamic route (`/offer/[id]`, `/request/passengers/[offerId]`, `/requests/[id]`) compiles and every internal `<Link>`/`router.push` target resolves to a real route.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove obsolete wizard/search components superseded by the redesigned flow"
```

---

### Task 27: Manual visual QA against the 7 reference screenshots

**Files:** none (verification-only task, no code changes).

This task cannot be automated (Global Constraint: no component-rendering test infra in this repo) — it must be done by running the app and looking at it, per `superpowers:verification-before-completion`.

- [ ] **Step 1: Start the dev server**

Run: `cd travel-app && npm run dev` (background), then open `http://localhost:3000/` in a browser.

- [ ] **Step 2: Walk the full happy path and compare each screen to its reference screenshot**

Reference screenshots are at `design_handoff_travel_employee/screenshots/` in the extracted handoff (re-extract `HANDOFF DE DESIGN.zip` if the original scratchpad copy from this session is gone). For each, confirm layout structure, copy strings, and token-mapped colors are a reasonable match (exact pixel match isn't expected — the screenshots render full dark mode per Global Constraints' documented discrepancy, this app renders light-with-dark-sidebar by design decision):

- [ ] `01-search.png` vs `/` — stepper, segmented trip-type control, origin/destination/date row, passenger stepper, cabin/connections selects, preferences accordion.
- [ ] `02-results.png` vs `/results` — header route summary, expiry banner, filters sidebar, offer cards with policy badges and per-slice rows.
- [ ] `03-offer-detail.png` vs `/offer/[id]` — segment timeline, conditions block, sticky price card.
- [ ] `04-passengers.png` vs `/request/passengers/[offerId]` — accordion per passenger, title/name/dob/gender/email/phone fields, conditional passport block on an international offer.
- [ ] `05-review.png` vs `/request/review` — three cards, corporate context form, out-of-policy banner on a non-compliant offer.
- [ ] `06-requests.png` vs `/requests` — status filter chips, list rows with all 6 columns.
- [ ] `07-request-detail.png` vs `/requests/[id]` — masked passenger data with reveal toggle, status sidebar, timeline, rejection reason box (test by manually setting a request's `status` to `"rejected"` and adding a `rejected` event with a `note` via the browser devtools console against `localStorage["travel-app.travel-requests.v1"]`, since there's no admin flow yet to produce a real rejection).

- [ ] **Step 3: Exercise the edge cases named in the handoff**

- [ ] Destination "Abuja (ABV)" produces the results empty state.
- [ ] An offer with 1 infant blocks passenger-step submission until an adult is marked responsible.
- [ ] An out-of-policy offer (e.g. domestic business class) blocks review submission until the 50-character justification is filled.
- [ ] Cancelling a `pending_admin` request updates its status to "Cancelada" and the cancel button disappears.

- [ ] **Step 4: Cross-check the PROMPT doc's Definition of Done (§13)**

Re-read `PROMPT-CLAUDE-DESIGN-EMPLOYEE-VIEW.md` §13 checklist item by item against the running app; every item should now be satisfied by Tasks 1-26. Note any gap found and file it as a follow-up — do not silently patch scope-creep fixes into this verification task.

- [ ] **Step 5: Report results to the user**

Summarize what matched, what's visually approximate (expected per the token-mapping and theme decisions in Global Constraints), and any genuine bug found during the walkthrough — do not claim "done" without having actually driven the app per `superpowers:verification-before-completion`.

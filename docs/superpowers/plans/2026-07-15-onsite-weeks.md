# Semanas Presenciais (Onsite Weeks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Travel Admin pick a sector and a date range and, in one action, generate an already-approved round-trip `request` (home airport → Curitiba → home airport) for every eligible employee in that sector — grouped under a new `onsite_weeks` record that can be reviewed, retried on partial failure, and cancelled as a batch.

**Architecture:** Server Components fetch `onsite_weeks`/`profiles`/`requests` via `createSupabaseServerClient()` (anon key + user session — RLS enforced for real, same pattern as every other admin page in this project). Client Components handle the two-step "organize" wizard (sector+dates form → per-employee review table) and the retry/cancel actions, calling new Route Handlers. Each Route Handler that creates `requests` on an employee's behalf calls `searchFlights()` (existing Duffel client) once per employee — the search itself already returns a combined round-trip offer when given two slices, so this is **one Duffel call per employee**, not two. A small pure-logic module (`src/lib/onsite-weeks.ts`) holds every decision that doesn't require I/O (eligibility checks, search-criteria/passenger/corporate-context builders, cheapest-offer selection, status derivation) so it can be unit-tested; the I/O (Duffel search + Supabase insert) lives in a thin service module reused by both the create and retry routes.

**Tech Stack:** Next.js 14 (App Router, Server Components), TypeScript strict, Supabase (Postgres + RLS, `@supabase/ssr`), Tailwind + shadcn/ui primitives (`Table`, `Checkbox`, `Select`, `Badge`, `Dialog`, `EmptyState` — all already in the repo), Vitest for pure-logic tests, `sonner` for toasts, `@faker-js/faker` for seed data, npm.

## Global Constraints

- Package manager is **npm**. Route Handlers use `createSupabaseServerClient()` (anon key + cookies) — **never** a service-role client; every admin mutation relies on RLS policies to authorize the write (see `supabase/migrations/0002_admin_request_updates.sql` / `0003_profiles_admin_select.sql` for the established pattern). Only one-off **scripts** run outside the request lifecycle (via `tsx`) use a service-role client, because they call `supabase.auth.admin.createUser()` / need to bypass RLS for bulk backfills — see `scripts/seed-sector-demo-employees.ts` for the precedent.
- UI copy (labels, headings, toasts) is in **pt-BR**. Code identifiers (variables, types, files) are in **English**.
- This project has no React render-testing setup (no jsdom/RTL) — only pure-logic modules (`src/lib/*.ts`, no `.tsx`) get Vitest tests. Pages, components, and Route Handlers are verified via `npx tsc --noEmit`, `npm run build`, `npm run lint`, and a manual browser checklist.
- Every commit ends with the trailer `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>`.
- Supabase migrations in this project are plain `.sql` files with no automated runner — they're applied by pasting into the Supabase SQL Editor. Task 1's migration must be applied that way before Task 2 onward can be manually verified end-to-end (the code changes can still be written and type-checked without it).
- Demo profile IDs (from `docs/SchemaGuide.md` section 6): Employee `39557140-a4c1-46cc-803e-021b433332ab` (`employee@demo.com`), Admin `b5c03efb-3a3e-42dd-96f7-45d398d3ac85` (`admin@demo.com`).
- Curitiba's airport IATA code is hardcoded as `CWB` (constant `CURITIBA_IATA`) — not configurable in this phase, per `docs/OnsiteWeeks-Spec.md` section 6.3.
- Cabin class is hardcoded to `"economy"` for every search this feature performs, per spec section 6.4/2.
- This feature never calls Duffel's order-creation endpoint (no real ticket is purchased) — every generated `request` nasce with `status: "approved"` directly, without ever touching `pending_admin`, per spec section 6.4.
- Full spec and product decisions: `docs/OnsiteWeeks-Spec.md` (do not re-litigate scope while implementing — every task below traces back to a section of that document).

---

### Task 1: Migration — `profiles` travel-profile columns, `onsite_weeks` table, `requests.onsite_week_id`, RLS

**Files:**
- Create: `supabase/migrations/0008_onsite_weeks.sql`

**Interfaces:**
- Produces: columns `profiles.origin_airport_code/given_name/family_name/born_on/gender/title/phone_number` (all nullable `text`/`date`); table `onsite_weeks` (`id, organization_id, sector, week_start_date, week_end_date, status, employee_outcomes, created_by, created_at, cancelled_at`) with `unique (organization_id, sector, week_start_date, week_end_date)`; column `requests.onsite_week_id` with partial unique index `(onsite_week_id, employee_id) where onsite_week_id is not null`; RLS policies `onsite_weeks_select_org_member`, `onsite_weeks_insert_org_admin`, `onsite_weeks_update_org_admin`, `requests_insert_admin_onsite_week` — consumed by every task from here on.

- [ ] **Step 1: Write the migration file**

```sql
-- Suporte a "Semanas Presenciais": o Travel Admin escolhe um setor e um
-- período, e o sistema gera automaticamente uma solicitação de viagem
-- (ida + volta, já aprovada) para cada funcionário elegível do setor,
-- da cidade de origem dele até Curitiba. Spec completa em
-- docs/OnsiteWeeks-Spec.md.
--
-- Três blocos:
--
-- 1. profiles: 7 colunas novas ("perfil de viagem" do funcionário). Todas
--    nullable — ao contrário do padrão "default temporário + backfill +
--    drop default" usado em 0004/0005 para cost_center, estas só passam a
--    ser exigidas quando alguém tenta incluir a pessoa numa semana
--    presencial (checado em código, não no banco — ver src/lib/onsite-weeks.ts
--    computeEmployeeEligibility). Um profile sem esses campos continua
--    válido para todo o resto do sistema.
--
-- 2. onsite_weeks: um lote por (setor, data de ida, data de volta) na
--    organização — a unique constraint é a trava de idempotência (spec
--    seção 6, decisão da pergunta 11): uma segunda tentativa com os
--    mesmos parâmetros falha com erro de constraint (código Postgres
--    23505), que o Route Handler traduz numa mensagem amigável.
--    employee_outcomes (jsonb) guarda, por funcionário selecionado nessa
--    rodada, se a solicitação foi criada ou falhou e por quê — sem isso
--    não haveria como a tela de detalhe mostrar falhas parciais nem
--    oferecer "tentar novamente" (funcionários que falham não geram
--    linha em requests).
--
-- 3. requests.onsite_week_id: liga cada solicitação gerada de volta ao
--    lote. O índice único parcial (só quando onsite_week_id não é nulo)
--    impede duas solicitações para o mesmo funcionário no mesmo lote —
--    protege o fluxo de "retry" contra duplicar quem já teve sucesso.
--
-- RLS: reaproveita a função is_org_admin(org_id) já criada em
-- 0003_profiles_admin_select.sql. requests_insert_admin_onsite_week é
-- necessária porque requests_insert_own (0001_init.sql) só permite
-- employee_id = auth.uid() — sem uma policy nova, o admin não consegue
-- inserir solicitações em nome de terceiros. Ela só libera insert quando
-- onsite_week_id não é nulo, ou seja, o admin não pode usar essa policy
-- para criar solicitações avulsas arbitrárias em nome de qualquer um.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table profiles add column if not exists origin_airport_code text;
alter table profiles add column if not exists given_name text;
alter table profiles add column if not exists family_name text;
alter table profiles add column if not exists born_on date;
alter table profiles add column if not exists gender text check (gender in ('m', 'f'));
alter table profiles add column if not exists title text check (title in ('mr', 'mrs', 'ms', 'miss', 'dr'));
alter table profiles add column if not exists phone_number text;

create table if not exists onsite_weeks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id),
  sector text not null check (sector in ('product', 'marketing', 'engineering', 'founders')),
  week_start_date date not null,
  week_end_date date not null,
  status text not null default 'completed' check (status in ('completed', 'partial', 'cancelled')),
  employee_outcomes jsonb not null default '[]'::jsonb,
  created_by uuid not null references profiles (id),
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  unique (organization_id, sector, week_start_date, week_end_date)
);

create index if not exists onsite_weeks_organization_id_idx on onsite_weeks (organization_id);

alter table requests add column if not exists onsite_week_id uuid references onsite_weeks (id);

create unique index if not exists requests_onsite_week_employee_unique
  on requests (onsite_week_id, employee_id)
  where onsite_week_id is not null;

alter table onsite_weeks enable row level security;

create policy "onsite_weeks_select_org_member"
  on onsite_weeks for select
  using (
    exists (
      select 1 from profiles p
      where p.id = auth.uid() and p.organization_id = onsite_weeks.organization_id
    )
  );

create policy "onsite_weeks_insert_org_admin"
  on onsite_weeks for insert
  with check (is_org_admin(onsite_weeks.organization_id));

create policy "onsite_weeks_update_org_admin"
  on onsite_weeks for update
  using (is_org_admin(onsite_weeks.organization_id))
  with check (is_org_admin(onsite_weeks.organization_id));

create policy "requests_insert_admin_onsite_week"
  on requests for insert
  with check (
    onsite_week_id is not null
    and is_org_admin(requests.organization_id)
  );
```

Save as `C:/Users/aaron/bootcamp/travel-app/supabase/migrations/0008_onsite_weeks.sql`.

- [ ] **Step 2: Apply it in the Supabase SQL Editor**

Copy the file's contents, paste into the Supabase project's SQL Editor, click "Run". Expected: no errors.

- [ ] **Step 3: Verify the schema**

```sql
select column_name from information_schema.columns where table_name = 'profiles' and column_name in
  ('origin_airport_code', 'given_name', 'family_name', 'born_on', 'gender', 'title', 'phone_number');
```

Expected: 7 rows.

```sql
select column_name from information_schema.columns where table_name = 'requests' and column_name = 'onsite_week_id';
select policyname from pg_policies where tablename in ('onsite_weeks', 'requests') order by policyname;
```

Expected: 1 row for the first query; the second includes `onsite_weeks_select_org_member`, `onsite_weeks_insert_org_admin`, `onsite_weeks_update_org_admin`, `requests_insert_admin_onsite_week` (plus the pre-existing `requests_*` policies).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_onsite_weeks.sql
git commit -m "$(cat <<'EOF'
feat: add onsite_weeks table, profiles travel-profile columns, RLS

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Seed script — backfill travel-profile fields on existing demo profiles

**Files:**
- Create: `scripts/seed-onsite-week-travel-profiles.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: Task 1's 7 new `profiles` columns.
- Produces: no exported code (a one-off script) — makes the demo org's profiles pass `computeEmployeeEligibility()` (Task 4), which every later manual-verification step in this plan depends on to actually see employees show up as "ok" in the organize flow.

- [ ] **Step 1: Write the script**

```ts
import { createClient } from "@supabase/supabase-js";
import { fakerPT_BR as faker } from "@faker-js/faker";

// Preenche os campos de perfil de viagem (origin_airport_code, given_name,
// family_name, born_on, gender, title, phone_number) adicionados pela
// migração 0008_onsite_weeks.sql, para todo profile que ainda não os tenha
// — necessário porque "Organizar Semana Presencial" (docs/OnsiteWeeks-Spec.md)
// exige esses 7 campos preenchidos por funcionário antes de incluí-lo num
// lote, e nenhum profile existente (nem os 2 demo, nem os 5 criados por
// seed-sector-demo-employees.ts, se esse seed já tiver rodado) os tinha
// antes desta migração.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o seed."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// CWB (Curitiba) está incluído de propósito: dá pra demonstrar a regra de
// "quem já está em Curitiba nasce desmarcado na revisão" sem editar nada
// manualmente depois do seed.
const AIRPORT_POOL = ["GRU", "CGH", "GIG", "SDU", "BSB", "CNF", "POA", "SSA", "REC", "FOR", "CWB"];

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function splitName(fullName: string): { given_name: string; family_name: string } {
  const parts = fullName.trim().split(/\s+/);
  return {
    given_name: parts[0],
    family_name: parts.length > 1 ? parts.slice(1).join(" ") : parts[0],
  };
}

async function main() {
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .is("origin_airport_code", null);

  if (error) {
    throw new Error(`Falha ao buscar profiles: ${error.message}`);
  }
  if (!profiles || profiles.length === 0) {
    console.log("Nenhum profile com dados de viagem faltando. Nada a fazer.");
    return;
  }

  for (const profile of profiles) {
    const { given_name, family_name } = splitName(profile.full_name);
    const isMale = faker.person.sexType() === "male";
    const bornOn = faker.date.birthdate({ min: 24, max: 58, mode: "age" }).toISOString().slice(0, 10);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        origin_airport_code: pick(AIRPORT_POOL),
        given_name,
        family_name,
        born_on: bornOn,
        gender: isMale ? "m" : "f",
        title: isMale ? "mr" : "ms",
        phone_number: faker.phone.number(),
      })
      .eq("id", profile.id);

    if (updateError) {
      throw new Error(`Falha ao atualizar profile ${profile.id}: ${updateError.message}`);
    }
    console.log(`Atualizado: ${profile.full_name}`);
  }

  console.log(`Seed concluído: ${profiles.length} profiles atualizados.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/scripts/seed-onsite-week-travel-profiles.ts`.

- [ ] **Step 2: Add the npm script**

In `package.json`, add to `"scripts"` (next to the existing `"seed:sectors"` line):

```json
    "seed:onsite-profiles": "tsx --env-file=.env.local scripts/seed-onsite-week-travel-profiles.ts",
```

Save `C:/Users/aaron/bootcamp/travel-app/package.json`.

- [ ] **Step 3: Run it (requires Task 1's migration already applied)**

```bash
npm run seed:onsite-profiles
```

Expected: one "Atualizado: ..." line per existing profile, ending with "Seed concluído: N profiles atualizados."

- [ ] **Step 4: Verify in the Supabase SQL Editor**

```sql
select full_name, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number from profiles;
```

Expected: every row has all 7 columns filled in.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-onsite-week-travel-profiles.ts package.json
git commit -m "$(cat <<'EOF'
feat: add seed script to backfill profile travel-profile fields

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `badge-variants.ts` — `OnsiteWeekStatus` badge (TDD)

**Files:**
- Modify: `src/lib/badge-variants.ts`
- Modify: `src/lib/badge-variants.test.ts`

**Interfaces:**
- Produces: `OnsiteWeekStatus` (`"completed" | "partial" | "cancelled"`), `getOnsiteWeekStatusBadge(status: OnsiteWeekStatus): BadgeSpec` — consumed by Task 4 (`deriveOnsiteWeekStatus`'s return type), Task 5 (`OnsiteWeekRow.status`), Task 16/17 (list/detail page badges).

- [ ] **Step 1: Write the failing tests**

Append to the end of `src/lib/badge-variants.test.ts`:

```ts
describe("getOnsiteWeekStatusBadge", () => {
  it.each([
    ["completed", "Concluída", "success"],
    ["partial", "Parcial", "warning"],
    ["cancelled", "Cancelada", "secondary"],
  ] as const)("maps %s to { %s, %s }", (status, label, variant) => {
    expect(getOnsiteWeekStatusBadge(status)).toEqual({ label, variant });
  });
});
```

Add `getOnsiteWeekStatusBadge` to the existing import from `./badge-variants` at the top of the file (alphabetical, between `getFlagBadges` and `getPolicyBadge`).

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/badge-variants.test.ts
```

Expected: FAIL — `getOnsiteWeekStatusBadge` is not exported yet.

- [ ] **Step 3: Add the type and function**

Append to the end of `src/lib/badge-variants.ts`:

```ts
export type OnsiteWeekStatus = "completed" | "partial" | "cancelled";

const ONSITE_WEEK_STATUS_BADGES: Record<OnsiteWeekStatus, BadgeSpec> = {
  completed: { label: "Concluída", variant: "success" },
  partial: { label: "Parcial", variant: "warning" },
  cancelled: { label: "Cancelada", variant: "secondary" },
};

export function getOnsiteWeekStatusBadge(status: OnsiteWeekStatus): BadgeSpec {
  return ONSITE_WEEK_STATUS_BADGES[status];
}
```

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/badge-variants.test.ts
```

Expected: all tests pass (previous ones + 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/badge-variants.ts src/lib/badge-variants.test.ts
git commit -m "$(cat <<'EOF'
feat: add onsite-week status badge helper

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `src/lib/onsite-weeks.ts` — pure business logic (TDD)

**Files:**
- Create: `src/lib/onsite-weeks.ts`
- Create: `src/lib/onsite-weeks.test.ts`

**Interfaces:**
- Consumes: `OnsiteWeekStatus` from `./badge-variants` (Task 3); `Sector` from `./badge-variants`; `CabinClass`, `CorporateContext`, `DuffelPassenger`, `FlightOffer`, `SearchCriteria`, `SelectedOfferSnapshot` from `./types`.
- Produces: `CURITIBA_IATA`, `TravelProfileFields`, `EmployeeEligibility`, `OnsiteWeekEmployeeOutcome`, `OnsiteWeekPreviewEmployee`, `computeEmployeeEligibility`, `isBasedInCuritiba`, `buildOnsiteWeekPreviewEmployee`, `buildOnsiteWeekSearchCriteria`, `buildOnsiteWeekPassenger`, `buildOnsiteWeekCorporateContext`, `buildOnsiteWeekOfferSnapshot`, `pickCheapestOffer`, `deriveOnsiteWeekStatus`, `mergeOnsiteWeekOutcomes` — consumed by Task 5 (`OnsiteWeekRow.employee_outcomes` type), Task 7 (service uses almost everything here), Task 8 (preview route uses eligibility + preview builder), Task 9/10 (create/retry routes use the builders + status/merge functions).

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CURITIBA_IATA,
  buildOnsiteWeekCorporateContext,
  buildOnsiteWeekOfferSnapshot,
  buildOnsiteWeekPassenger,
  buildOnsiteWeekPreviewEmployee,
  buildOnsiteWeekSearchCriteria,
  computeEmployeeEligibility,
  deriveOnsiteWeekStatus,
  isBasedInCuritiba,
  mergeOnsiteWeekOutcomes,
  pickCheapestOffer,
  type OnsiteWeekEmployeeOutcome,
  type TravelProfileFields,
} from "./onsite-weeks";
import type { FlightOffer } from "./types";

const COMPLETE_PROFILE: TravelProfileFields = {
  origin_airport_code: "GRU",
  given_name: "Maria",
  family_name: "Silva",
  born_on: "1990-05-10",
  gender: "f",
  title: "ms",
  phone_number: "+5511999990000",
  email: "maria@demo-paggo.com",
};

const OFFER: FlightOffer = {
  id: "off_1",
  mode: "flight",
  origin: "GRU",
  destination: "CWB",
  destinationCountry: "BR",
  departureAt: "2026-08-10T10:00:00Z",
  returnAt: "2026-08-14T18:00:00Z",
  cabinClass: "economy",
  airline: "LATAM",
  stops: 0,
  refundable: false,
  totalAmount: 1200,
  currency: "BRL",
  rateToBRL: 1,
  expiresAt: "2026-08-01T00:00:00Z",
  owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "", brand_color: "" },
  slices: [
    {
      id: "sl_1",
      origin: "GRU",
      destination: "CWB",
      duration: "PT1H20M",
      fare_brand_name: "Light",
      segments: [
        {
          id: "seg_1",
          origin: { iata_code: "GRU", name: "Guarulhos" },
          destination: { iata_code: "CWB", name: "Afonso Pena" },
          departing_at: "2026-08-10T10:00:00Z",
          arriving_at: "2026-08-10T11:20:00Z",
          duration: "PT1H20M",
          marketing_carrier: { iata_code: "LA", name: "LATAM" },
          operating_carrier: { iata_code: "LA", name: "LATAM" },
          marketing_carrier_flight_number: "3200",
          aircraft: { name: "A320" },
          origin_terminal: null,
          destination_terminal: null,
          baggages: [],
        },
      ],
    },
  ],
  conditions: {
    refund_before_departure: { allowed: false },
    change_before_departure: { allowed: false },
  },
  passengerIdentityDocumentsRequired: false,
};

describe("isBasedInCuritiba", () => {
  it("returns true for CWB", () => {
    expect(isBasedInCuritiba("CWB")).toBe(true);
  });
  it("returns false for other airports", () => {
    expect(isBasedInCuritiba("GRU")).toBe(false);
  });
  it("returns false for null", () => {
    expect(isBasedInCuritiba(null)).toBe(false);
  });
});

describe("computeEmployeeEligibility", () => {
  it("returns ok when every travel-profile field is filled in", () => {
    expect(computeEmployeeEligibility(COMPLETE_PROFILE)).toEqual({ status: "ok" });
  });

  it("lists every missing field by label", () => {
    const incomplete: TravelProfileFields = {
      ...COMPLETE_PROFILE,
      origin_airport_code: null,
      born_on: null,
    };
    expect(computeEmployeeEligibility(incomplete)).toEqual({
      status: "missing_profile_data",
      missingFields: ["Cidade de origem", "Data de nascimento"],
    });
  });
});

describe("buildOnsiteWeekPreviewEmployee", () => {
  it("defaults to checked when eligible and not already based in Curitiba", () => {
    const result = buildOnsiteWeekPreviewEmployee({ id: "emp_1", full_name: "Maria Silva", ...COMPLETE_PROFILE });
    expect(result.eligibility).toEqual({ status: "ok" });
    expect(result.default_checked).toBe(true);
  });

  it("defaults to unchecked when already based in Curitiba", () => {
    const result = buildOnsiteWeekPreviewEmployee({
      id: "emp_1",
      full_name: "Maria Silva",
      ...COMPLETE_PROFILE,
      origin_airport_code: "CWB",
    });
    expect(result.default_checked).toBe(false);
  });

  it("defaults to unchecked when profile data is missing", () => {
    const result = buildOnsiteWeekPreviewEmployee({
      id: "emp_1",
      full_name: "Maria Silva",
      ...COMPLETE_PROFILE,
      phone_number: null,
    });
    expect(result.default_checked).toBe(false);
  });
});

describe("buildOnsiteWeekSearchCriteria", () => {
  it("builds a round trip with economy cabin and one adult", () => {
    const result = buildOnsiteWeekSearchCriteria("GRU", "2026-08-10", "2026-08-14");
    expect(result).toEqual({
      slices: [
        { origin: "GRU", destination: "CWB", departure_date: "2026-08-10" },
        { origin: "CWB", destination: "GRU", departure_date: "2026-08-14" },
      ],
      passengers: [{ type: "adult" }],
      cabin_class: "economy",
    });
  });
});

describe("pickCheapestOffer", () => {
  it("returns null for an empty list", () => {
    expect(pickCheapestOffer([])).toBeNull();
  });

  it("picks the offer with the lowest totalAmount", () => {
    const expensive: FlightOffer = { ...OFFER, id: "off_2", totalAmount: 3000 };
    expect(pickCheapestOffer([expensive, OFFER])).toBe(OFFER);
  });
});

describe("buildOnsiteWeekPassenger", () => {
  it("maps the profile's travel fields into a DuffelPassenger", () => {
    const result = buildOnsiteWeekPassenger(COMPLETE_PROFILE);
    expect(result).toEqual({
      id: "pas-1",
      type: "adult",
      title: "ms",
      given_name: "Maria",
      family_name: "Silva",
      born_on: "1990-05-10",
      gender: "f",
      email: "maria@demo-paggo.com",
      phone_number: "+5511999990000",
    });
  });
});

describe("buildOnsiteWeekCorporateContext", () => {
  it("uses internal_meeting as the trip purpose and mentions the dates", () => {
    const result = buildOnsiteWeekCorporateContext("engineering", "2026-08-10", "2026-08-14");
    expect(result.trip_purpose).toBe("internal_meeting");
    expect(result.cost_center).toBe("engineering");
    expect(result.business_justification).toContain("2026-08-10");
    expect(result.business_justification).toContain("2026-08-14");
  });
});

describe("buildOnsiteWeekOfferSnapshot", () => {
  it("maps a FlightOffer into a SelectedOfferSnapshot", () => {
    const result = buildOnsiteWeekOfferSnapshot(OFFER);
    expect(result.offer_id).toBe("off_1");
    expect(result.total_amount).toBe("1200");
    expect(result.total_currency).toBe("BRL");
    expect(result.owner).toEqual({ iata_code: "LA", name: "LATAM", logo_symbol_url: "" });
    expect(result.slices).toEqual([
      {
        origin: "GRU",
        destination: "CWB",
        departure_datetime: "2026-08-10T10:00:00Z",
        arrival_datetime: "2026-08-10T11:20:00Z",
        duration: "PT1H20M",
        segments_count: 1,
        fare_brand_name: "Light",
      },
    ]);
    expect(result.expires_at).toBe("2026-08-01T00:00:00Z");
  });
});

describe("deriveOnsiteWeekStatus", () => {
  it("returns completed when there are no failures", () => {
    expect(deriveOnsiteWeekStatus(5, 0)).toBe("completed");
  });
  it("returns partial when there is at least one failure", () => {
    expect(deriveOnsiteWeekStatus(3, 2)).toBe("partial");
  });
});

describe("mergeOnsiteWeekOutcomes", () => {
  const base: OnsiteWeekEmployeeOutcome[] = [
    { employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" },
    { employee_id: "e2", employee_name: "Bruno", status: "failed", error_message: "sem oferta" },
  ];

  it("replaces outcomes for employee ids present in the update", () => {
    const updated: OnsiteWeekEmployeeOutcome[] = [
      { employee_id: "e2", employee_name: "Bruno", status: "created", request_id: "req_2" },
    ];
    expect(mergeOnsiteWeekOutcomes(base, updated)).toEqual([
      { employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" },
      { employee_id: "e2", employee_name: "Bruno", status: "created", request_id: "req_2" },
    ]);
  });

  it("appends outcomes for employee ids not previously present", () => {
    const updated: OnsiteWeekEmployeeOutcome[] = [
      { employee_id: "e3", employee_name: "Carla", status: "created", request_id: "req_3" },
    ];
    expect(mergeOnsiteWeekOutcomes(base, updated)).toEqual([...base, updated[0]]);
  });
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/onsite-weeks.test.ts`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/onsite-weeks.test.ts
```

Expected: FAIL — `./onsite-weeks` doesn't exist yet.

- [ ] **Step 3: Write the implementation**

```ts
import type { OnsiteWeekStatus, Sector } from "./badge-variants";
import type {
  CabinClass,
  CorporateContext,
  DuffelPassenger,
  FlightOffer,
  PassengerGender,
  PassengerTitle,
  SearchCriteria,
  SelectedOfferSnapshot,
} from "./types";

export const CURITIBA_IATA = "CWB";

export interface TravelProfileFields {
  origin_airport_code: string | null;
  given_name: string | null;
  family_name: string | null;
  born_on: string | null;
  gender: PassengerGender | null;
  title: PassengerTitle | null;
  phone_number: string | null;
  email: string;
}

const REQUIRED_TRAVEL_PROFILE_FIELDS: Array<{ key: keyof TravelProfileFields; label: string }> = [
  { key: "origin_airport_code", label: "Cidade de origem" },
  { key: "given_name", label: "Nome" },
  { key: "family_name", label: "Sobrenome" },
  { key: "born_on", label: "Data de nascimento" },
  { key: "gender", label: "Gênero" },
  { key: "title", label: "Título" },
  { key: "phone_number", label: "Telefone" },
];

export type EmployeeEligibility =
  | { status: "ok" }
  | { status: "missing_profile_data"; missingFields: string[] };

export function computeEmployeeEligibility(profile: TravelProfileFields): EmployeeEligibility {
  const missingFields = REQUIRED_TRAVEL_PROFILE_FIELDS.filter(({ key }) => !profile[key]).map(
    ({ label }) => label
  );
  if (missingFields.length > 0) {
    return { status: "missing_profile_data", missingFields };
  }
  return { status: "ok" };
}

export function isBasedInCuritiba(originAirportCode: string | null): boolean {
  return originAirportCode === CURITIBA_IATA;
}

export interface OnsiteWeekPreviewEmployee {
  id: string;
  full_name: string;
  origin_airport_code: string | null;
  eligibility: EmployeeEligibility;
  default_checked: boolean;
}

export function buildOnsiteWeekPreviewEmployee(
  profile: { id: string; full_name: string } & TravelProfileFields
): OnsiteWeekPreviewEmployee {
  const eligibility = computeEmployeeEligibility(profile);
  return {
    id: profile.id,
    full_name: profile.full_name,
    origin_airport_code: profile.origin_airport_code,
    eligibility,
    default_checked: eligibility.status === "ok" && !isBasedInCuritiba(profile.origin_airport_code),
  };
}

export function buildOnsiteWeekSearchCriteria(
  originAirportCode: string,
  weekStartDate: string,
  weekEndDate: string
): SearchCriteria {
  return {
    slices: [
      { origin: originAirportCode, destination: CURITIBA_IATA, departure_date: weekStartDate },
      { origin: CURITIBA_IATA, destination: originAirportCode, departure_date: weekEndDate },
    ],
    passengers: [{ type: "adult" }],
    cabin_class: "economy" as CabinClass,
  };
}

export function pickCheapestOffer(offers: FlightOffer[]): FlightOffer | null {
  if (offers.length === 0) return null;
  return offers.reduce((cheapest, offer) => (offer.totalAmount < cheapest.totalAmount ? offer : cheapest));
}

export function buildOnsiteWeekPassenger(profile: TravelProfileFields): DuffelPassenger {
  return {
    id: "pas-1",
    type: "adult",
    title: profile.title as PassengerTitle,
    given_name: profile.given_name as string,
    family_name: profile.family_name as string,
    born_on: profile.born_on as string,
    gender: profile.gender as PassengerGender,
    email: profile.email,
    phone_number: profile.phone_number as string,
  };
}

export function buildOnsiteWeekCorporateContext(
  sector: Sector,
  weekStartDate: string,
  weekEndDate: string
): CorporateContext {
  return {
    trip_purpose: "internal_meeting",
    cost_center: sector,
    business_justification: `Semana presencial — ${sector}, ${weekStartDate} a ${weekEndDate}.`,
  };
}

export function buildOnsiteWeekOfferSnapshot(offer: FlightOffer): SelectedOfferSnapshot {
  const now = new Date().toISOString();
  return {
    offer_id: offer.id,
    total_amount: String(offer.totalAmount),
    total_currency: offer.currency,
    exchange_rate_to_brl: offer.rateToBRL,
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
  };
}

export function deriveOnsiteWeekStatus(successCount: number, failureCount: number): OnsiteWeekStatus {
  return failureCount > 0 ? "partial" : "completed";
}

export interface OnsiteWeekEmployeeOutcome {
  employee_id: string;
  employee_name: string;
  status: "created" | "failed";
  request_id?: string;
  error_message?: string;
}

export function mergeOnsiteWeekOutcomes(
  existing: OnsiteWeekEmployeeOutcome[],
  updates: OnsiteWeekEmployeeOutcome[]
): OnsiteWeekEmployeeOutcome[] {
  const updatesById = new Map(updates.map((outcome) => [outcome.employee_id, outcome]));
  const merged = existing.map((outcome) => updatesById.get(outcome.employee_id) ?? outcome);
  const existingIds = new Set(existing.map((outcome) => outcome.employee_id));
  const appended = updates.filter((outcome) => !existingIds.has(outcome.employee_id));
  return [...merged, ...appended];
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/onsite-weeks.ts`.

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/onsite-weeks.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/onsite-weeks.ts src/lib/onsite-weeks.test.ts
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks pure business logic (eligibility, builders, status)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `src/lib/onsite-weeks-mapper.ts` (TDD)

**Files:**
- Create: `src/lib/onsite-weeks-mapper.ts`
- Create: `src/lib/onsite-weeks-mapper.test.ts`

**Interfaces:**
- Consumes: `OnsiteWeekStatus`, `Sector` from `./badge-variants` (Task 3); `OnsiteWeekEmployeeOutcome` from `./onsite-weeks` (Task 4).
- Produces: `OnsiteWeekRow`, `OnsiteWeek`, `toOnsiteWeek(row: OnsiteWeekRow): OnsiteWeek` — consumed by Task 9 (create route response), Task 10 (retry route response), Task 11 (cancel route response), Task 14 (list page), Task 16 (detail page).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { toOnsiteWeek, type OnsiteWeekRow } from "./onsite-weeks-mapper";

const ROW: OnsiteWeekRow = {
  id: "ow_1",
  organization_id: "org_1",
  sector: "engineering",
  week_start_date: "2026-08-10",
  week_end_date: "2026-08-14",
  status: "completed",
  employee_outcomes: [{ employee_id: "e1", employee_name: "Ana", status: "created", request_id: "req_1" }],
  created_by: "admin_1",
  created_at: "2026-07-15T10:00:00Z",
  cancelled_at: null,
};

describe("toOnsiteWeek", () => {
  it("maps a database row into the OnsiteWeek shape the UI expects", () => {
    const result = toOnsiteWeek(ROW);
    expect(result).toEqual(ROW);
  });
});
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/onsite-weeks-mapper.test.ts`.

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/onsite-weeks-mapper.test.ts
```

Expected: FAIL — `./onsite-weeks-mapper` doesn't exist yet.

- [ ] **Step 3: Write the mapper**

```ts
import type { OnsiteWeekStatus, Sector } from "./badge-variants";
import type { OnsiteWeekEmployeeOutcome } from "./onsite-weeks";

export interface OnsiteWeekRow {
  id: string;
  organization_id: string;
  sector: Sector;
  week_start_date: string;
  week_end_date: string;
  status: OnsiteWeekStatus;
  employee_outcomes: OnsiteWeekEmployeeOutcome[];
  created_by: string;
  created_at: string;
  cancelled_at: string | null;
}

export type OnsiteWeek = OnsiteWeekRow;

export function toOnsiteWeek(row: OnsiteWeekRow): OnsiteWeek {
  return { ...row };
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/onsite-weeks-mapper.ts`.

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/onsite-weeks-mapper.test.ts
```

Expected: 1 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/onsite-weeks-mapper.ts src/lib/onsite-weeks-mapper.test.ts
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks mapper (row -> OnsiteWeek)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `requests-mapper.ts` / `types.ts` — add `onsite_week_id` (TDD)

**Files:**
- Modify: `src/lib/types.ts`
- Modify: `src/lib/requests-mapper.ts`
- Modify: `src/lib/requests-mapper.test.ts`

**Interfaces:**
- Produces: `TravelRequest.onsite_week_id: string | null`, `RequestRow.onsite_week_id: string | null` (now required in every `RequestRow`/`toTravelRequest` caller) — consumed by Task 7 (insert payload), Task 17 (badge on the requests queue).

- [ ] **Step 1: Update the existing test's fixture and add a new assertion**

In `src/lib/requests-mapper.test.ts`, add `onsite_week_id: null` to the `ROW` constant (right after `exchange_rate_to_brl: 1,`):

```ts
  exchange_rate_to_brl: 1,
  onsite_week_id: null,
```

Then add, inside the existing `describe("toTravelRequest", ...)` block, right after the existing `it(...)`:

```ts
  it("passes through onsite_week_id when the request was generated by an onsite week", () => {
    const result = toTravelRequest({ ...ROW, onsite_week_id: "ow_1" });
    expect(result.onsite_week_id).toBe("ow_1");
  });
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
npx vitest run src/lib/requests-mapper.test.ts
```

Expected: FAIL — `RequestRow` doesn't have `onsite_week_id` yet (TypeScript error surfaces as a Vitest transform failure), and the new assertion fails.

- [ ] **Step 3: Add the field**

In `src/lib/types.ts`, add `onsite_week_id: string | null;` to `TravelRequest` (right after `employee_id: string;`):

```ts
export interface TravelRequest {
  id: string;
  organization_id: string;
  employee_id: string;
  onsite_week_id: string | null;
  created_at: string;
  ...
```

In `src/lib/requests-mapper.ts`, add the same field to `RequestRow` (right after `employee_id: string;`) and map it in `toTravelRequest`:

```ts
export interface RequestRow {
  id: string;
  organization_id: string;
  employee_id: string;
  onsite_week_id: string | null;
  status: TravelRequest["status"];
  ...
```

```ts
export function toTravelRequest(row: RequestRow): TravelRequest {
  return {
    id: row.id,
    organization_id: row.organization_id,
    employee_id: row.employee_id,
    onsite_week_id: row.onsite_week_id,
    created_at: row.created_at,
    ...
```

- [ ] **Step 4: Run the tests again and confirm they pass**

```bash
npx vitest run src/lib/requests-mapper.test.ts
```

Expected: all tests pass (previous ones + 1 new one).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors (confirms every other `RequestRow`/`TravelRequest` literal in the codebase — there are none outside tests and mappers — still compiles).

- [ ] **Step 6: Commit**

```bash
git add src/lib/types.ts src/lib/requests-mapper.ts src/lib/requests-mapper.test.ts
git commit -m "$(cat <<'EOF'
feat: add onsite_week_id to TravelRequest/RequestRow

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `src/lib/onsite-weeks-service.ts` — per-employee processing (I/O)

**Files:**
- Create: `src/lib/onsite-weeks-service.ts`

**Interfaces:**
- Consumes: `DuffelSearchError`, `searchFlights` from `./duffel/client`; `DuffelPolicyDefaults`, `evaluateDuffelOffer` from `./policy`; `Sector` from `./badge-variants`; `TravelProfileFields`, `OnsiteWeekEmployeeOutcome`, `buildOnsiteWeekCorporateContext`, `buildOnsiteWeekOfferSnapshot`, `buildOnsiteWeekPassenger`, `buildOnsiteWeekSearchCriteria`, `computeEmployeeEligibility`, `pickCheapestOffer` from `./onsite-weeks` (Task 4).
- Produces: `processOnsiteWeekEmployee(params: ProcessEmployeeParams): Promise<OnsiteWeekEmployeeOutcome>` — consumed by Task 9 (create route) and Task 10 (retry route). This module does real I/O (Duffel search, Supabase insert) — it has no Vitest test, per this project's convention that only pure `src/lib/*.ts` modules get unit tests; it's verified manually in Task 9's checklist.

- [ ] **Step 1: Write the module**

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Sector } from "./badge-variants";
import { DuffelSearchError, searchFlights } from "./duffel/client";
import {
  buildOnsiteWeekCorporateContext,
  buildOnsiteWeekOfferSnapshot,
  buildOnsiteWeekPassenger,
  buildOnsiteWeekSearchCriteria,
  computeEmployeeEligibility,
  pickCheapestOffer,
  type OnsiteWeekEmployeeOutcome,
  type TravelProfileFields,
} from "./onsite-weeks";
import { evaluateDuffelOffer, type DuffelPolicyDefaults } from "./policy";

export interface ProcessEmployeeParams {
  supabase: SupabaseClient;
  organizationId: string;
  onsiteWeekId: string;
  sector: Sector;
  weekStartDate: string;
  weekEndDate: string;
  policyDefaults: DuffelPolicyDefaults;
  adminId: string;
  employee: { id: string; full_name: string } & TravelProfileFields;
}

export async function processOnsiteWeekEmployee(
  params: ProcessEmployeeParams
): Promise<OnsiteWeekEmployeeOutcome> {
  const {
    supabase,
    organizationId,
    onsiteWeekId,
    sector,
    weekStartDate,
    weekEndDate,
    policyDefaults,
    adminId,
    employee,
  } = params;

  const eligibility = computeEmployeeEligibility(employee);
  if (eligibility.status !== "ok") {
    return {
      employee_id: employee.id,
      employee_name: employee.full_name,
      status: "failed",
      error_message: `Perfil incompleto: falta ${eligibility.missingFields.join(", ")}.`,
    };
  }

  try {
    const searchCriteria = buildOnsiteWeekSearchCriteria(
      employee.origin_airport_code as string,
      weekStartDate,
      weekEndDate
    );
    const offers = await searchFlights(searchCriteria);
    const cheapest = pickCheapestOffer(offers);
    if (!cheapest) {
      return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        status: "failed",
        error_message: "Nenhuma oferta de voo disponível para essa rota e essas datas.",
      };
    }

    const evaluation = evaluateDuffelOffer(cheapest, policyDefaults);
    const now = new Date().toISOString();

    const { data: inserted, error } = await supabase
      .from("requests")
      .insert({
        organization_id: organizationId,
        employee_id: employee.id,
        onsite_week_id: onsiteWeekId,
        status: "approved",
        total_amount: cheapest.totalAmount,
        total_currency: cheapest.currency,
        exchange_rate_to_brl: cheapest.rateToBRL ?? null,
        search_criteria: searchCriteria,
        selected_offer_snapshot: buildOnsiteWeekOfferSnapshot(cheapest),
        passengers: [buildOnsiteWeekPassenger(employee)],
        corporate: buildOnsiteWeekCorporateContext(sector, weekStartDate, weekEndDate),
        policy_evaluation: evaluation,
        events: [
          { at: now, kind: "created" },
          {
            at: now,
            kind: "approved",
            actor_id: adminId,
            note: "Aprovada automaticamente ao organizar a semana presencial.",
          },
        ],
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return {
        employee_id: employee.id,
        employee_name: employee.full_name,
        status: "failed",
        error_message: "Não foi possível salvar a solicitação.",
      };
    }

    return {
      employee_id: employee.id,
      employee_name: employee.full_name,
      status: "created",
      request_id: inserted.id,
    };
  } catch (err) {
    const message = err instanceof DuffelSearchError ? err.message : "Erro inesperado ao buscar voos.";
    return { employee_id: employee.id, employee_name: employee.full_name, status: "failed", error_message: message };
  }
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/lib/onsite-weeks-service.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/onsite-weeks-service.ts
git commit -m "$(cat <<'EOF'
feat: add per-employee onsite-week processing service

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Route Handler — `POST /api/admin/onsite-weeks/preview`

**Files:**
- Create: `src/app/api/admin/onsite-weeks/preview/route.ts`

**Interfaces:**
- Consumes: `buildOnsiteWeekPreviewEmployee` from `@/lib/onsite-weeks` (Task 4); `createSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: `POST /api/admin/onsite-weeks/preview` (body `{ sector: Sector }`) → `{ employees: OnsiteWeekPreviewEmployee[] }` — consumed by Task 15's organize-flow UI (step 1 → step 2 transition).

- [ ] **Step 1: Write the Route Handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { buildOnsiteWeekPreviewEmployee } from "@/lib/onsite-weeks";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const previewSchema = z.object({
  sector: z.enum(["product", "marketing", "engineering", "founders"]),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem organizar semanas presenciais." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = previewSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Setor inválido." }, { status: 400 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", parsed.data.sector)
    .eq("status", "active")
    .order("full_name", { ascending: true });

  const employees = (employeeRows ?? []).map(buildOnsiteWeekPreviewEmployee);

  return NextResponse.json({ employees });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/onsite-weeks/preview/route.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification (requires Tasks 1 and 2 already applied/run)**

```bash
npm run dev
```

Log in as `admin@demo.com`. In the browser devtools console:

```js
fetch("/api/admin/onsite-weeks/preview", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ sector: "engineering" }),
}).then((r) => r.json()).then(console.log);
```

Expected: `{ employees: [...] }` with at least the demo employee, `eligibility: { status: "ok" }`, and `default_checked` matching whether their `origin_airport_code` is `CWB`. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/onsite-weeks/preview
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks eligibility preview Route Handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Route Handler — `POST /api/admin/onsite-weeks` (create the batch)

**Files:**
- Create: `src/app/api/admin/onsite-weeks/route.ts`

**Interfaces:**
- Consumes: `toDuffelPolicyDefaults`, `PolicyRuleRow` from `@/lib/policy-rules`; `DUFFEL_POLICY_DEFAULTS` from `@/lib/policy`; `deriveOnsiteWeekStatus`, `TravelProfileFields` from `@/lib/onsite-weeks` (Task 4); `processOnsiteWeekEmployee` from `@/lib/onsite-weeks-service` (Task 7); `toOnsiteWeek`, `OnsiteWeekRow` from `@/lib/onsite-weeks-mapper` (Task 5).
- Produces: `POST /api/admin/onsite-weeks` (body `{ sector, week_start_date, week_end_date, employee_ids }`) → `201 { onsite_week: OnsiteWeek }` on success, `409 { error, existing_onsite_week_id }` on duplicate — consumed by Task 15's organize-flow UI (step 2 confirm).

- [ ] **Step 1: Write the Route Handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import { deriveOnsiteWeekStatus, type TravelProfileFields } from "@/lib/onsite-weeks";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { processOnsiteWeekEmployee, type ProcessEmployeeParams } from "@/lib/onsite-weeks-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const createSchema = z.object({
  sector: z.enum(["product", "marketing", "engineering", "founders"]),
  week_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  employee_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem organizar semanas presenciais." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }
  const { sector, week_start_date, week_end_date, employee_ids } = parsed.data;

  if (week_end_date < week_start_date) {
    return NextResponse.json(
      { error: "A data de volta não pode ser antes da data de ida." },
      { status: 400 }
    );
  }

  // Nasce com status "completed" como placeholder — este é um fluxo síncrono
  // (sem fila em background), então o UPDATE final abaixo, ao fim do
  // processamento de todos os funcionários, roda ainda dentro da mesma
  // requisição HTTP.
  const { data: insertedWeek, error: insertWeekError } = await supabase
    .from("onsite_weeks")
    .insert({
      organization_id: adminProfile.organization_id,
      sector,
      week_start_date,
      week_end_date,
      created_by: user.id,
      status: "completed",
      employee_outcomes: [],
    })
    .select("*")
    .single();

  if (insertWeekError || !insertedWeek) {
    if (insertWeekError?.code === "23505") {
      const { data: existing } = await supabase
        .from("onsite_weeks")
        .select("id")
        .eq("organization_id", adminProfile.organization_id)
        .eq("sector", sector)
        .eq("week_start_date", week_start_date)
        .eq("week_end_date", week_end_date)
        .single();
      return NextResponse.json(
        {
          error: "Já existe uma semana presencial organizada para esse setor nessas datas.",
          existing_onsite_week_id: existing?.id ?? null,
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Não foi possível criar a semana presencial." }, { status: 500 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", sector)
    .eq("status", "active")
    .in("id", employee_ids);

  const { data: ruleRow } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", sector)
    .single();
  const policyDefaults = ruleRow ? toDuffelPolicyDefaults(ruleRow as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  const outcomes = await Promise.all(
    (employeeRows ?? []).map((employee) =>
      processOnsiteWeekEmployee({
        supabase,
        organizationId: adminProfile.organization_id,
        onsiteWeekId: insertedWeek.id,
        sector,
        weekStartDate: week_start_date,
        weekEndDate: week_end_date,
        policyDefaults,
        adminId: user.id,
        employee: employee as TravelProfileFields & { id: string; full_name: string },
      } satisfies ProcessEmployeeParams)
    )
  );

  const successCount = outcomes.filter((o) => o.status === "created").length;
  const finalStatus = deriveOnsiteWeekStatus(successCount, outcomes.length - successCount);

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: finalStatus, employee_outcomes: outcomes })
    .eq("id", insertedWeek.id)
    .select("*")
    .single();

  const finalWeek = updatedWeek ?? { ...insertedWeek, status: finalStatus, employee_outcomes: outcomes };

  return NextResponse.json({ onsite_week: toOnsiteWeek(finalWeek as OnsiteWeekRow) }, { status: 201 });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/onsite-weeks/route.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual verification (requires `DUFFEL_API_KEY` set in `.env.local`, Tasks 1–2 applied/run)**

```bash
npm run dev
```

Log in as `admin@demo.com`. In devtools, first re-run Task 8's preview fetch to get a real employee id, then:

```js
fetch("/api/admin/onsite-weeks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    sector: "engineering",
    week_start_date: "2026-09-07",
    week_end_date: "2026-09-11",
    employee_ids: ["<id from the preview response>"],
  }),
}).then((r) => r.json()).then(console.log);
```

Expected: `201` with `onsite_week.status` `"completed"` (or `"partial"` if the route has no flight availability — check `employee_outcomes[0].error_message`) and `employee_outcomes` containing one entry. Re-run the exact same fetch again: expected `409` with `"Já existe uma semana presencial organizada..."`. In the Supabase SQL Editor, run `select * from requests where onsite_week_id is not null;` — expected one row with `status = 'approved'`. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/onsite-weeks/route.ts
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks batch-creation Route Handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Route Handler — `POST /api/admin/onsite-weeks/[id]/retry`

**Files:**
- Create: `src/app/api/admin/onsite-weeks/[id]/retry/route.ts`

**Interfaces:**
- Consumes: everything Task 9 consumes, plus `mergeOnsiteWeekOutcomes` from `@/lib/onsite-weeks` (Task 4).
- Produces: `POST /api/admin/onsite-weeks/[id]/retry` (body `{ employee_ids }`) → `200 { onsite_week: OnsiteWeek }` — consumed by Task 16's detail page ("Tentar novamente" action).

- [ ] **Step 1: Write the Route Handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { DUFFEL_POLICY_DEFAULTS } from "@/lib/policy";
import { toDuffelPolicyDefaults, type PolicyRuleRow } from "@/lib/policy-rules";
import { deriveOnsiteWeekStatus, mergeOnsiteWeekOutcomes, type TravelProfileFields } from "@/lib/onsite-weeks";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { processOnsiteWeekEmployee, type ProcessEmployeeParams } from "@/lib/onsite-weeks-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const retrySchema = z.object({
  employee_ids: z.array(z.string().uuid()).min(1),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem organizar semanas presenciais." },
      { status: 403 }
    );
  }

  const { data: week } = await supabase
    .from("onsite_weeks")
    .select("*")
    .eq("id", params.id)
    .eq("organization_id", adminProfile.organization_id)
    .single();
  if (!week) {
    return NextResponse.json({ error: "Semana presencial não encontrada." }, { status: 404 });
  }
  if (week.status === "cancelled") {
    return NextResponse.json(
      { error: "Não é possível tentar novamente uma semana presencial cancelada." },
      { status: 409 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
  }

  const { data: employeeRows } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("organization_id", adminProfile.organization_id)
    .eq("cost_center", week.sector)
    .eq("status", "active")
    .in("id", parsed.data.employee_ids);

  const { data: ruleRow } = await supabase
    .from("policy_rules")
    .select("*")
    .eq("organization_id", adminProfile.organization_id)
    .eq("sector", week.sector)
    .single();
  const policyDefaults = ruleRow ? toDuffelPolicyDefaults(ruleRow as PolicyRuleRow) : DUFFEL_POLICY_DEFAULTS;

  const newOutcomes = await Promise.all(
    (employeeRows ?? []).map((employee) =>
      processOnsiteWeekEmployee({
        supabase,
        organizationId: adminProfile.organization_id,
        onsiteWeekId: week.id,
        sector: week.sector,
        weekStartDate: week.week_start_date,
        weekEndDate: week.week_end_date,
        policyDefaults,
        adminId: user.id,
        employee: employee as TravelProfileFields & { id: string; full_name: string },
      } satisfies ProcessEmployeeParams)
    )
  );

  const mergedOutcomes = mergeOnsiteWeekOutcomes(week.employee_outcomes, newOutcomes);
  const successCount = mergedOutcomes.filter((o) => o.status === "created").length;
  const finalStatus = deriveOnsiteWeekStatus(successCount, mergedOutcomes.length - successCount);

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: finalStatus, employee_outcomes: mergedOutcomes })
    .eq("id", week.id)
    .select("*")
    .single();

  return NextResponse.json({
    onsite_week: toOnsiteWeek((updatedWeek ?? { ...week, status: finalStatus, employee_outcomes: mergedOutcomes }) as OnsiteWeekRow),
  });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/onsite-weeks/[id]/retry/route.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/onsite-weeks/[id]/retry"
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks retry Route Handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Manual end-to-end verification of retry happens in Task 16's checklist, once the UI can drive it.)

---

### Task 11: Route Handler — `POST /api/admin/onsite-weeks/[id]/cancel`

**Files:**
- Create: `src/app/api/admin/onsite-weeks/[id]/cancel/route.ts`

**Interfaces:**
- Consumes: `toOnsiteWeek`, `OnsiteWeekRow` from `@/lib/onsite-weeks-mapper` (Task 5); the pre-existing `requests_update_admin` RLS policy (`supabase/migrations/0002_admin_request_updates.sql`) to authorize the per-request cancellation.
- Produces: `POST /api/admin/onsite-weeks/[id]/cancel` → `200 { onsite_week: OnsiteWeek, cancelled_requests: number }` — consumed by Task 16's detail page ("Cancelar semana presencial" action).

- [ ] **Step 1: Write the Route Handler**

```ts
import { NextResponse } from "next/server";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TravelRequestEvent } from "@/lib/types";

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem cancelar uma semana presencial." },
      { status: 403 }
    );
  }

  const { data: week } = await supabase
    .from("onsite_weeks")
    .select("id, status")
    .eq("id", params.id)
    .eq("organization_id", adminProfile.organization_id)
    .single();
  if (!week) {
    return NextResponse.json({ error: "Semana presencial não encontrada." }, { status: 404 });
  }
  if (week.status === "cancelled") {
    return NextResponse.json({ error: "Essa semana presencial já está cancelada." }, { status: 409 });
  }

  const { data: openRequests } = await supabase
    .from("requests")
    .select("id, events")
    .eq("onsite_week_id", params.id)
    .neq("status", "cancelled");

  const now = new Date().toISOString();
  const cancelEvent: TravelRequestEvent = { at: now, kind: "cancelled", actor_id: user.id };

  for (const openRequest of openRequests ?? []) {
    await supabase
      .from("requests")
      .update({ status: "cancelled", events: [...(openRequest.events as TravelRequestEvent[]), cancelEvent] })
      .eq("id", openRequest.id);
  }

  const { data: updatedWeek } = await supabase
    .from("onsite_weeks")
    .update({ status: "cancelled", cancelled_at: now })
    .eq("id", params.id)
    .select("*")
    .single();

  if (!updatedWeek) {
    return NextResponse.json({ error: "Não foi possível cancelar a semana presencial." }, { status: 500 });
  }

  return NextResponse.json({
    onsite_week: toOnsiteWeek(updatedWeek as OnsiteWeekRow),
    cancelled_requests: (openRequests ?? []).length,
  });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/onsite-weeks/[id]/cancel/route.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/onsite-weeks/[id]/cancel"
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks bulk-cancel Route Handler

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Manual end-to-end verification happens in Task 16's checklist.)

---

### Task 12: Route Handler — `PATCH /api/admin/employees/[id]/travel-profile`

**Files:**
- Create: `src/app/api/admin/employees/[id]/travel-profile/route.ts`

**Interfaces:**
- Produces: `PATCH /api/admin/employees/[id]/travel-profile` (body: the 7 travel-profile fields) → `{ employee: EmployeeRow & TravelProfileFields }` — consumed by Task 13's `EmployeeTravelProfileForm`.

- [ ] **Step 1: Write the Route Handler**

```ts
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const travelProfileSchema = z.object({
  origin_airport_code: z.string().length(3),
  given_name: z.string().trim().min(1),
  family_name: z.string().trim().min(1),
  born_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.enum(["m", "f"]),
  title: z.enum(["mr", "mrs", "ms", "miss", "dr"]),
  phone_number: z.string().trim().min(8),
});

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { data: adminProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!adminProfile || adminProfile.role !== "admin") {
    return NextResponse.json(
      { error: "Apenas administradores podem alterar o perfil de viagem de um funcionário." },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = travelProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de perfil de viagem inválidos." }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", params.id)
    .select(
      "id, full_name, email, role, status, cost_center, created_at, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Não foi possível salvar o perfil de viagem." }, { status: 500 });
  }

  return NextResponse.json({ employee: updated });
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/api/admin/employees/[id]/travel-profile/route.ts`.

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/admin/employees/[id]/travel-profile"
git commit -m "$(cat <<'EOF'
feat: add Route Handler to edit an employee's travel profile

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `EmployeeTravelProfileForm` — UI in `/admin/employees/[id]`

**Files:**
- Create: `src/components/admin/employee-travel-profile-form.tsx`
- Modify: `src/app/admin/employees/[id]/page.tsx`
- Modify: `src/lib/employees-mapper.ts`

**Interfaces:**
- Consumes: `PATCH /api/admin/employees/[id]/travel-profile` (Task 12); `TravelProfileFields` from `@/lib/onsite-weeks` (Task 4).
- Produces: `<EmployeeTravelProfileForm employeeId profile={TravelProfileFields} />` — leaf of this task, but `EmployeeRow` grows the 7 fields, which Task 15's/16's server-side queries also select by name (no shared import — each page selects its own columns, matching the existing convention where `employees-mapper.ts`'s `EmployeeRow` is the canonical shape for `/admin/employees/*` pages specifically).

- [ ] **Step 1: Extend `EmployeeRow`**

In `src/lib/employees-mapper.ts`, add the import and extend the interface:

```ts
import type { EmployeeRole, EmployeeStatus, Sector } from "./badge-variants";
import type { TravelProfileFields } from "./onsite-weeks";

export interface EmployeeRow extends TravelProfileFields {
  id: string;
  full_name: string;
  email: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  cost_center: Sector;
  created_at: string;
}

export type Employee = EmployeeRow;

export function toEmployee(row: EmployeeRow): Employee {
  return { ...row };
}
```

(`TravelProfileFields` already declares `email: string`, which duplicates `EmployeeRow`'s own `email` — TypeScript allows this since both declare the same type for the field, so the merge is safe.)

- [ ] **Step 2: Write `EmployeeTravelProfileForm`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { PassengerGender, PassengerTitle } from "@/lib/types";
import type { TravelProfileFields } from "@/lib/onsite-weeks";

const TITLE_LABELS: Record<PassengerTitle, string> = {
  mr: "Sr.",
  mrs: "Sra.",
  ms: "Sra. (Ms)",
  miss: "Srta.",
  dr: "Dr(a).",
};

interface EmployeeTravelProfileFormProps {
  employeeId: string;
  profile: TravelProfileFields;
}

export function EmployeeTravelProfileForm({ employeeId, profile }: EmployeeTravelProfileFormProps) {
  const router = useRouter();
  const [values, setValues] = useState({
    origin_airport_code: profile.origin_airport_code ?? "",
    given_name: profile.given_name ?? "",
    family_name: profile.family_name ?? "",
    born_on: profile.born_on ?? "",
    gender: (profile.gender ?? "f") as PassengerGender,
    title: (profile.title ?? "ms") as PassengerTitle,
    phone_number: profile.phone_number ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/employees/${employeeId}/travel-profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível salvar o perfil de viagem.");
        return;
      }
      toast.success("Perfil de viagem atualizado.");
      router.refresh();
    } catch {
      toast.error("Não foi possível salvar o perfil de viagem.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-foreground">Perfil de viagem</h2>
      <p className="text-xs text-muted-foreground">
        Necessário para incluir este funcionário numa Semana Presencial.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
        <div className="flex flex-col gap-1.5">
          <Label>Telefone</Label>
          <Input
            value={values.phone_number}
            onChange={(e) => setValues((v) => ({ ...v, phone_number: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Nome</Label>
          <Input
            value={values.given_name}
            onChange={(e) => setValues((v) => ({ ...v, given_name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Sobrenome</Label>
          <Input
            value={values.family_name}
            onChange={(e) => setValues((v) => ({ ...v, family_name: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Data de nascimento</Label>
          <Input
            type="date"
            value={values.born_on}
            onChange={(e) => setValues((v) => ({ ...v, born_on: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Título</Label>
          <Select value={values.title} onValueChange={(value) => setValues((v) => ({ ...v, title: value as PassengerTitle }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(TITLE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Gênero</Label>
          <Select value={values.gender} onValueChange={(value) => setValues((v) => ({ ...v, gender: value as PassengerGender }))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="f">Feminino</SelectItem>
              <SelectItem value="m">Masculino</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button size="sm" className="w-fit" disabled={saving} onClick={handleSave}>
        {saving ? "Salvando..." : "Salvar perfil de viagem"}
      </Button>
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/employee-travel-profile-form.tsx`.

- [ ] **Step 3: Wire it into the employee detail page**

In `src/app/admin/employees/[id]/page.tsx`, add the import and update the `select(...)` call and JSX:

```tsx
import { EmployeeTravelProfileForm } from "@/components/admin/employee-travel-profile-form";
```

Change the `profiles` select to include the 7 new columns:

```tsx
  const { data: employeeRow } = await supabase
    .from("profiles")
    .select(
      "id, full_name, email, role, status, cost_center, created_at, origin_airport_code, given_name, family_name, born_on, gender, title, phone_number"
    )
    .eq("id", params.id)
    .single();
```

Add the form right after the existing `<EmployeeActions ... />` block, before the closing `</div>`:

```tsx
      <EmployeeActions
        employeeId={employee.id}
        role={employee.role}
        status={employee.status}
        costCenter={employee.cost_center}
        isSelf={currentProfile?.id === employee.id}
      />

      <EmployeeTravelProfileForm employeeId={employee.id} profile={employee} />
```

- [ ] **Step 4: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 5: Manual verification (requires Tasks 1, 2, 12 already applied/run)**

```bash
npm run dev
```

Log in as `admin@demo.com`, go to `/admin/employees/39557140-a4c1-46cc-803e-021b433332ab` (Funcionário Demo). Expected: a "Perfil de viagem" card pre-filled with the seed data from Task 2. Change the origin airport code, click "Salvar perfil de viagem". Expected: toast "Perfil de viagem atualizado.", value persists after a manual page refresh. Stop the dev server.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/employee-travel-profile-form.tsx src/app/admin/employees/\[id\]/page.tsx src/lib/employees-mapper.ts
git commit -m "$(cat <<'EOF'
feat: add travel-profile editing form to employee detail page

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Sidebar nav item + `/admin/onsite-weeks` list page

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`
- Create: `src/app/admin/onsite-weeks/page.tsx`
- Create: `src/components/admin/onsite-weeks-list.tsx`

**Interfaces:**
- Consumes: `toOnsiteWeek`, `OnsiteWeekRow` from `@/lib/onsite-weeks-mapper` (Task 5); `getOnsiteWeekStatusBadge`, `getSectorBadge`, `SECTOR_LABELS` from `@/lib/badge-variants`; `createSupabaseServerClient` from `@/lib/supabase/server`.
- Produces: the `/admin/onsite-weeks` list page — consumed by Task 15 (its "Organizar nova semana presencial" button links to `/admin/onsite-weeks/new`) and Task 16 (each row links to `/admin/onsite-weeks/[id]`).

- [ ] **Step 1: Add the nav item**

In `src/components/layout/app-sidebar.tsx`, add the import and the nav entry:

```ts
import {
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  FileText,
  LayoutDashboard,
  Plane,
  Settings,
  Users,
} from "lucide-react";
```

```ts
const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Painel", icon: LayoutDashboard },
  { href: "/admin/requests", label: "Solicitações", icon: ClipboardCheck },
  { href: "/admin/onsite-weeks", label: "Semanas Presenciais", icon: CalendarRange },
  { href: "/admin/employees", label: "Funcionários", icon: Users },
  { href: "/admin/reports", label: "Relatórios", icon: FileText },
  { href: "/admin/settings", label: "Configurações", icon: Settings },
] as const;
```

- [ ] **Step 2: Write `OnsiteWeeksList`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnsiteWeekStatusBadge, getSectorBadge, SECTOR_LABELS } from "@/lib/badge-variants";
import { formatDate } from "@/lib/offer-format";
import type { OnsiteWeek } from "@/lib/onsite-weeks-mapper";

export function OnsiteWeeksList({ onsiteWeeks }: { onsiteWeeks: OnsiteWeek[] }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Semanas Presenciais</h1>
        <Button size="sm" onClick={() => router.push("/admin/onsite-weeks/new")}>
          <Plus className="mr-1.5 size-4" />
          Organizar nova semana presencial
        </Button>
      </div>

      {onsiteWeeks.length === 0 ? (
        <EmptyState
          icon={CalendarRange}
          title="Nenhuma semana presencial organizada ainda"
          button={{ label: "Organizar nova semana presencial", onClick: () => router.push("/admin/onsite-weeks/new") }}
        />
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Setor</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Solicitações</TableHead>
              <TableHead>Criada em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {onsiteWeeks.map((week) => {
              const sectorBadge = getSectorBadge(week.sector);
              const statusBadge = getOnsiteWeekStatusBadge(week.status);
              const createdCount = week.employee_outcomes.filter((o) => o.status === "created").length;
              return (
                <TableRow
                  key={week.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/admin/onsite-weeks/${week.id}`)}
                >
                  <TableCell>
                    <Badge variant={sectorBadge.variant}>{SECTOR_LABELS[week.sector]}</Badge>
                  </TableCell>
                  <TableCell className="text-foreground">
                    {formatDate(week.week_start_date)} – {formatDate(week.week_end_date)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {createdCount} de {week.employee_outcomes.length}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(week.created_at)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/onsite-weeks-list.tsx`.

Note: `formatDate` (from `@/lib/offer-format`) parses with `new Date(iso)` — `week_start_date`/`week_end_date` are plain `YYYY-MM-DD` strings from a `date` column, which `Date` parses as UTC midnight, and `formatDate` renders with `timeZone: "UTC"`, so this displays the correct calendar date without a Link import needed here (the `Link` import above is unused — remove it, this component navigates entirely via `router.push`).

- [ ] **Step 3: Remove the unused `Link` import**

In the file written in Step 2, delete the line `import Link from "next/link";` — the component only uses `router.push`, never `<Link>`.

- [ ] **Step 4: Write the page**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { OnsiteWeeksList } from "@/components/admin/onsite-weeks-list";

export default async function AdminOnsiteWeeksPage() {
  const supabase = createSupabaseServerClient();
  const { data: rows } = await supabase
    .from("onsite_weeks")
    .select("*")
    .order("created_at", { ascending: false });

  const onsiteWeeks = ((rows ?? []) as OnsiteWeekRow[]).map(toOnsiteWeek);

  return <OnsiteWeeksList onsiteWeeks={onsiteWeeks} />;
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/admin/onsite-weeks/page.tsx`.

- [ ] **Step 5: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 6: Manual verification**

```bash
npm run dev
```

Log in as `admin@demo.com`. Expected: "Semanas Presenciais" appears in the sidebar between "Solicitações" and "Funcionários". Click it — if Task 9 was manually tested, the row created there appears with the right sector/period/status; otherwise the empty state shows with a working "Organizar nova semana presencial" button (404 for now — built in Task 15). Stop the dev server.

- [ ] **Step 7: Commit**

```bash
git add src/components/layout/app-sidebar.tsx src/app/admin/onsite-weeks/page.tsx src/components/admin/onsite-weeks-list.tsx
git commit -m "$(cat <<'EOF'
feat: add onsite-weeks list page and sidebar nav item

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: `/admin/onsite-weeks/new` — organize flow (sector+dates → review → confirm)

**Files:**
- Create: `src/app/admin/onsite-weeks/new/page.tsx`
- Create: `src/components/admin/organize-onsite-week-flow.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/onsite-weeks/preview` (Task 8), `POST /api/admin/onsite-weeks` (Task 9); `OnsiteWeekPreviewEmployee` from `@/lib/onsite-weeks` (Task 4); `SECTORS`, `SECTOR_LABELS`, `Sector` from `@/lib/badge-variants`.
- Produces: the `/admin/onsite-weeks/new` page — leaf of this task, navigates to `/admin/onsite-weeks/[id]` (Task 16) on success.

- [ ] **Step 1: Write `OrganizeOnsiteWeekFlow`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SECTOR_LABELS, SECTORS, type Sector } from "@/lib/badge-variants";
import type { OnsiteWeekPreviewEmployee } from "@/lib/onsite-weeks";

type Step = "form" | "review";

export function OrganizeOnsiteWeekFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [sector, setSector] = useState<Sector>("engineering");
  const [weekStartDate, setWeekStartDate] = useState("");
  const [weekEndDate, setWeekEndDate] = useState("");
  const [employees, setEmployees] = useState<OnsiteWeekPreviewEmployee[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handlePreview() {
    if (!weekStartDate || !weekEndDate) {
      toast.error("Escolha as datas de ida e de volta.");
      return;
    }
    if (weekEndDate < weekStartDate) {
      toast.error("A data de volta não pode ser antes da data de ida.");
      return;
    }

    setLoadingPreview(true);
    try {
      const response = await fetch("/api/admin/onsite-weeks/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sector }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível carregar os funcionários do setor.");
        return;
      }
      const previewEmployees = body.employees as OnsiteWeekPreviewEmployee[];
      setEmployees(previewEmployees);
      setSelected(
        Object.fromEntries(previewEmployees.map((employee) => [employee.id, employee.default_checked]))
      );
      setStep("review");
    } catch {
      toast.error("Não foi possível carregar os funcionários do setor.");
    } finally {
      setLoadingPreview(false);
    }
  }

  async function handleConfirm() {
    const employeeIds = Object.entries(selected)
      .filter(([, checked]) => checked)
      .map(([id]) => id);

    if (employeeIds.length === 0) {
      toast.error("Selecione ao menos um funcionário.");
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch("/api/admin/onsite-weeks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sector,
          week_start_date: weekStartDate,
          week_end_date: weekEndDate,
          employee_ids: employeeIds,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409 && body?.existing_onsite_week_id) {
          toast.error(body.error);
          router.push(`/admin/onsite-weeks/${body.existing_onsite_week_id}`);
          return;
        }
        toast.error(body?.error ?? "Não foi possível organizar a semana presencial.");
        return;
      }
      toast.success("Semana presencial organizada.");
      router.push(`/admin/onsite-weeks/${body.onsite_week.id}`);
    } catch {
      toast.error("Não foi possível organizar a semana presencial.");
    } finally {
      setConfirming(false);
    }
  }

  if (step === "form") {
    return (
      <div className="mx-auto flex w-full max-w-[560px] flex-col gap-6">
        <h1 className="text-xl font-semibold text-foreground">Organizar semana presencial</h1>
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1.5">
              <Label>Setor</Label>
              <Select value={sector} onValueChange={(value) => setSector(value as Sector)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SECTORS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SECTOR_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label>Data de ida</Label>
                <Input type="date" value={weekStartDate} onChange={(e) => setWeekStartDate(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Data de volta</Label>
                <Input type="date" value={weekEndDate} onChange={(e) => setWeekEndDate(e.target.value)} />
              </div>
            </div>
            <Button disabled={loadingPreview} onClick={handlePreview} className="w-fit">
              {loadingPreview ? "Carregando..." : "Avançar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-6">
      <h1 className="text-xl font-semibold text-foreground">
        Revisar funcionários — {SECTOR_LABELS[sector]}
      </h1>
      <p className="text-sm text-muted-foreground">
        {weekStartDate} a {weekEndDate}. Desmarque quem não deve viajar.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead />
            <TableHead>Funcionário</TableHead>
            <TableHead>Origem</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {employees.map((employee) => {
            const eligible = employee.eligibility.status === "ok";
            return (
              <TableRow key={employee.id}>
                <TableCell>
                  <Checkbox
                    checked={selected[employee.id] ?? false}
                    disabled={!eligible}
                    onCheckedChange={(checked) =>
                      setSelected((prev) => ({ ...prev, [employee.id]: checked === true }))
                    }
                  />
                </TableCell>
                <TableCell className="text-foreground">{employee.full_name}</TableCell>
                <TableCell className="text-muted-foreground">{employee.origin_airport_code ?? "—"}</TableCell>
                <TableCell>
                  {eligible ? (
                    <Badge variant="success">Ok</Badge>
                  ) : (
                    <div className="flex flex-col gap-1">
                      <Badge variant="warning">Perfil incompleto</Badge>
                      <a
                        href={`/admin/employees/${employee.id}`}
                        className="text-xs text-primary hover:underline"
                      >
                        Faltam: {employee.eligibility.missingFields.join(", ")}
                      </a>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <div className="flex items-center justify-between">
        <Button variant="link" onClick={() => setStep("form")}>
          Voltar
        </Button>
        <Button disabled={confirming} onClick={handleConfirm}>
          {confirming ? "Buscando voos e criando solicitações..." : "Confirmar e buscar voos"}
        </Button>
      </div>
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/organize-onsite-week-flow.tsx`.

- [ ] **Step 2: Write the page**

```tsx
import { OrganizeOnsiteWeekFlow } from "@/components/admin/organize-onsite-week-flow";

export default function NewOnsiteWeekPage() {
  return <OrganizeOnsiteWeekFlow />;
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/admin/onsite-weeks/new/page.tsx`.

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Manual verification (requires `DUFFEL_API_KEY` set, Tasks 1–2 applied/run)**

```bash
npm run dev
```

Log in as `admin@demo.com`, go to `/admin/onsite-weeks/new`. Pick "Engenharia", pick two dates a few weeks out, click "Avançar". Expected: review table with at least the demo employee, checkbox pre-checked unless their origin is `CWB` or their profile is incomplete. Uncheck/recheck a row. Click "Confirmar e buscar voos". Expected: redirect to `/admin/onsite-weeks/[id]` with a toast "Semana presencial organizada.". Repeat the exact same sector+dates again from `/admin/onsite-weeks/new`: expected a toast with the duplicate error and a redirect straight to the existing lote's detail page. Stop the dev server.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/onsite-weeks/new src/components/admin/organize-onsite-week-flow.tsx
git commit -m "$(cat <<'EOF'
feat: add organize-onsite-week flow (sector+dates -> review -> confirm)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: `/admin/onsite-weeks/[id]` — detail page (results, retry, cancel)

**Files:**
- Create: `src/app/admin/onsite-weeks/[id]/page.tsx`
- Create: `src/components/admin/onsite-week-detail.tsx`

**Interfaces:**
- Consumes: `POST /api/admin/onsite-weeks/[id]/retry` (Task 10), `POST /api/admin/onsite-weeks/[id]/cancel` (Task 11); `OnsiteWeek` from `@/lib/onsite-weeks-mapper` (Task 5); `getOnsiteWeekStatusBadge`, `getSectorBadge`, `SECTOR_LABELS` from `@/lib/badge-variants`; `NotFoundState` from `@/components/layout/not-found-state` (pre-existing, from the admin-employees-directory feature).
- Produces: the `/admin/onsite-weeks/[id]` page — leaf of this feature.

- [ ] **Step 1: Write `OnsiteWeekDetail`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getOnsiteWeekStatusBadge, getSectorBadge, SECTOR_LABELS } from "@/lib/badge-variants";
import { formatDate } from "@/lib/offer-format";
import type { OnsiteWeek } from "@/lib/onsite-weeks-mapper";

export function OnsiteWeekDetail({ onsiteWeek }: { onsiteWeek: OnsiteWeek }) {
  const router = useRouter();
  const [retrying, setRetrying] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const statusBadge = getOnsiteWeekStatusBadge(onsiteWeek.status);
  const sectorBadge = getSectorBadge(onsiteWeek.sector);
  const failed = onsiteWeek.employee_outcomes.filter((o) => o.status === "failed");

  async function handleRetry() {
    setRetrying(true);
    try {
      const response = await fetch(`/api/admin/onsite-weeks/${onsiteWeek.id}/retry`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employee_ids: failed.map((o) => o.employee_id) }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível tentar novamente.");
        return;
      }
      toast.success("Tentativa concluída.");
      router.refresh();
    } catch {
      toast.error("Não foi possível tentar novamente.");
    } finally {
      setRetrying(false);
    }
  }

  async function handleCancelConfirm() {
    setCancelling(true);
    try {
      const response = await fetch(`/api/admin/onsite-weeks/${onsiteWeek.id}/cancel`, { method: "POST" });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error ?? "Não foi possível cancelar a semana presencial.");
        return;
      }
      toast.success("Semana presencial cancelada.");
      setCancelOpen(false);
      router.refresh();
    } catch {
      toast.error("Não foi possível cancelar a semana presencial.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="w-fit">
        <Link href="/admin/onsite-weeks">← Semanas Presenciais</Link>
      </Button>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-semibold text-foreground">{SECTOR_LABELS[onsiteWeek.sector]}</h1>
          <span className="text-sm text-muted-foreground">
            {formatDate(onsiteWeek.week_start_date)} – {formatDate(onsiteWeek.week_end_date)}
          </span>
        </div>
        <div className="flex gap-2">
          <Badge variant={sectorBadge.variant}>{sectorBadge.label}</Badge>
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Funcionário</TableHead>
            <TableHead>Resultado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {onsiteWeek.employee_outcomes.map((outcome) => (
            <TableRow key={outcome.employee_id}>
              <TableCell className="text-foreground">{outcome.employee_name}</TableCell>
              <TableCell>
                {outcome.status === "created" ? (
                  <Link href={`/admin/requests/${outcome.request_id}`} className="text-primary hover:underline">
                    Solicitação criada
                  </Link>
                ) : (
                  <span className="text-destructive">{outcome.error_message ?? "Falhou"}</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {onsiteWeek.status !== "cancelled" ? (
        <div className="flex items-center gap-2">
          {failed.length > 0 ? (
            <Button variant="secondary" disabled={retrying} onClick={handleRetry}>
              {retrying ? "Tentando novamente..." : `Tentar novamente (${failed.length})`}
            </Button>
          ) : null}
          <Button variant="destructive" onClick={() => setCancelOpen(true)}>
            Cancelar semana presencial
          </Button>
        </div>
      ) : null}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar semana presencial</DialogTitle>
            <DialogDescription>
              Isso cancela todas as solicitações de viagem geradas por este lote. Essa ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCancelOpen(false)}>
              Voltar
            </Button>
            <Button variant="destructive" disabled={cancelling} onClick={handleCancelConfirm}>
              {cancelling ? "Cancelando..." : "Cancelar semana presencial"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/components/admin/onsite-week-detail.tsx`.

- [ ] **Step 2: Write the page**

```tsx
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { toOnsiteWeek, type OnsiteWeekRow } from "@/lib/onsite-weeks-mapper";
import { OnsiteWeekDetail } from "@/components/admin/onsite-week-detail";
import { NotFoundState } from "@/components/layout/not-found-state";

export default async function OnsiteWeekDetailPage({ params }: { params: { id: string } }) {
  const supabase = createSupabaseServerClient();
  const { data: row } = await supabase.from("onsite_weeks").select("*").eq("id", params.id).single();

  if (!row) {
    return (
      <NotFoundState
        title="Semana presencial não encontrada"
        description="Ela pode ter sido removida, ou você não tem acesso a ela."
        backHref="/admin/onsite-weeks"
        backLabel="Semanas Presenciais"
      />
    );
  }

  return <OnsiteWeekDetail onsiteWeek={toOnsiteWeek(row as OnsiteWeekRow)} />;
}
```

Save as `C:/Users/aaron/bootcamp/travel-app/src/app/admin/onsite-weeks/[id]/page.tsx`.

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Manual verification (requires Task 15 already used to create at least one onsite week)**

```bash
npm run dev
```

Log in as `admin@demo.com`, open the onsite week created in Task 15's checklist from `/admin/onsite-weeks`. Expected: sector/period/status badges, a row per employee outcome, a working link to `/admin/requests/[id]` for each `"created"` outcome. If any outcome failed (e.g. no route available), click "Tentar novamente" — expected the row updates after `router.refresh()` (either to "Solicitação criada" or a new/same failure reason). Click "Cancelar semana presencial", confirm in the dialog — expected the status badge becomes "Cancelada", the retry/cancel buttons disappear, and (checking `/admin/requests`) every request from this lote is now `"Cancelada"`. Visit `/admin/onsite-weeks/00000000-0000-0000-0000-000000000000` — expected the "não encontrada" empty state. Stop the dev server.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add "src/app/admin/onsite-weeks/[id]" src/components/admin/onsite-week-detail.tsx
git commit -m "$(cat <<'EOF'
feat: add onsite-week detail page (results, retry, bulk cancel)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Badge for onsite-week-generated requests in `/admin/requests`

**Files:**
- Modify: `src/components/admin/requests-queue.tsx`

**Interfaces:**
- Consumes: `TravelRequest.onsite_week_id` (Task 6).
- Produces: a visible "Semana Presencial" badge on any request row where `onsite_week_id` is set — leaf of this plan (spec section 6.7 / product decision from the grilling session).

- [ ] **Step 1: Add the badge**

In `src/components/admin/requests-queue.tsx`, inside the `.map((request) => { ... })` block, right after the existing:

```tsx
            const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
```

add:

```tsx
            const flagBadges = getDuffelFlagBadges(request.policy_evaluation);
            const isOnsiteWeek = request.onsite_week_id !== null;
```

Then, in the JSX, right after the existing `<RequestStatusBadge status={request.status} />` line:

```tsx
                      <RequestStatusBadge status={request.status} />
                      {isOnsiteWeek ? <Badge variant="info">Semana Presencial</Badge> : null}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 3: Manual verification (requires Task 15 already used to create at least one onsite week)**

```bash
npm run dev
```

Log in as `admin@demo.com`, go to `/admin/requests`, switch to the "Todas" tab. Expected: requests created via the onsite-week flow show a "Semana Presencial" badge next to their status badge; ordinary employee-submitted requests don't. Stop the dev server.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/requests-queue.tsx
git commit -m "$(cat <<'EOF'
feat: badge onsite-week-generated requests in the admin queue

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

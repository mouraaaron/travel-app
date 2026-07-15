# Fix Mock Trip Justification Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Latin lorem-ipsum text currently generated for `business_justification` and `out_of_policy_justification` in mock trip requests with realistic Portuguese corporate-travel phrases, then wipe and regenerate the demo data so the admin Relatórios view reflects the fix immediately.

**Architecture:** Two existing seed scripts (`seed-demo-data.ts`, `seed-sector-demo-employees.ts`) each get a small, self-contained pool of Portuguese justification phrases keyed by `trip_purpose`, plus a pool of "fora de política" phrases, replacing their `faker.lorem.sentence()` calls. A new `reset-demo-data.ts` script deletes the current mock requests and mock employees for the demo org (recording counts first) so the two seed scripts can be re-run cleanly. No shared module is introduced — the two seed scripts already duplicate their constants, and this change follows that existing pattern rather than refactoring it.

**Tech Stack:** TypeScript, `tsx` (script runner), `@supabase/supabase-js` (admin/service-role client), `@faker-js/faker` (kept for names/emails/ids, no longer used for justification text).

## Global Constraints

- Match the existing file style: plain `const` pools + the existing `pick<T>()` helper already defined in each script — no new abstraction layer, no shared module between the two seed files (matches existing duplication pattern).
- `business_justification` must always be set; `out_of_policy_justification` is only set when `compliant` is `false` (unchanged behavior, just a different text source).
- `TripPurpose` values are exactly `"client_meeting" | "conference" | "internal_meeting" | "training" | "other"` (`travel-app/src/lib/types.ts:189-194`) — the phrase pool must have an entry for every one of these five keys.
- There is no automated test suite for `scripts/*.ts` in this repo (only `src/` has `vitest`), and these scripts require a live Supabase connection (`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`) that throws at import time if unset — so verification for every task in this plan is `npx tsc --noEmit` (type safety) plus a manual read-through, not unit tests. Task 4 additionally requires live verification against the actual demo Supabase project.
- Task 4 deletes real rows from the demo Supabase database. It is a destructive, hard-to-reverse action against shared state — **do not run it without the user's explicit go-ahead at execution time**, even though it's written up as a task in this plan.

---

### Task 1: Real justification phrases in `seed-demo-data.ts`

**Files:**
- Modify: `travel-app/scripts/seed-demo-data.ts:22` (add new consts after `TRIP_PURPOSES`), `travel-app/scripts/seed-demo-data.ts:143-148` (`buildRequest`'s `corporate` object)

**Interfaces:**
- Consumes: existing `pick<T>(items: T[]): T` helper (`seed-demo-data.ts:46-48`), existing `TripPurpose` import, existing `purpose`/`compliant` locals inside `buildRequest`.
- Produces: `TRIP_JUSTIFICATIONS: Record<TripPurpose, string[]>` and `OUT_OF_POLICY_JUSTIFICATIONS: string[]`, both scoped to this file (not exported) — Task 2 defines its own identical copies, it does not import these.

- [ ] **Step 1: Add the phrase pool constants**

Insert immediately after the `TRIP_PURPOSES` constant (`travel-app/scripts/seed-demo-data.ts:22`):

```ts
const TRIP_JUSTIFICATIONS: Record<TripPurpose, string[]> = {
  client_meeting: [
    "Reunião presencial com cliente para apresentação de proposta comercial.",
    "Visita técnica ao cliente para acompanhar a implantação do projeto.",
    "Negociação de contrato com cliente estratégico da conta.",
    "Reunião de alinhamento trimestral com cliente-chave.",
  ],
  conference: [
    "Participação em conferência do setor para networking e capacitação.",
    "Palestra em evento do setor representando a empresa.",
    "Participação em feira do setor para prospecção de parceiros.",
    "Apresentação de case da empresa em congresso da área.",
  ],
  internal_meeting: [
    "Reunião de planejamento estratégico com a liderança na matriz.",
    "Alinhamento presencial com equipe de outra unidade.",
    "Kickoff presencial de projeto interno com stakeholders.",
    "Encontro trimestral de lideranças da empresa.",
  ],
  training: [
    "Participação em treinamento técnico oferecido pelo fornecedor.",
    "Capacitação presencial obrigatória para certificação da equipe.",
    "Treinamento de liderança promovido pela empresa.",
    "Workshop de atualização profissional na área de atuação.",
  ],
  other: [
    "Viagem para representar a empresa em evento institucional.",
    "Deslocamento para resolução de demanda operacional pontual.",
    "Viagem de suporte a outra unidade da empresa.",
  ],
};

const OUT_OF_POLICY_JUSTIFICATIONS: string[] = [
  "Não havia voos dentro do teto de política disponíveis para as datas da viagem.",
  "Reunião marcada em cima da hora exigiu compra de passagem com tarifa mais alta.",
  "Único voo compatível com a agenda do cliente excedia o limite de custo da política.",
  "Alta demanda no período, por evento no destino, elevou o preço acima do teto padrão.",
];
```

- [ ] **Step 2: Replace the lorem-ipsum calls in `buildRequest`**

In `travel-app/scripts/seed-demo-data.ts`, find (around line 143-148):

```ts
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: faker.lorem.sentence(),
      ...(compliant ? {} : { out_of_policy_justification: faker.lorem.sentence() }),
    },
```

Replace with:

```ts
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: pick(TRIP_JUSTIFICATIONS[purpose]),
      ...(compliant ? {} : { out_of_policy_justification: pick(OUT_OF_POLICY_JUSTIFICATIONS) }),
    },
```

- [ ] **Step 3: Type-check**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors mentioning `seed-demo-data.ts`.

- [ ] **Step 4: Commit**

```bash
git add travel-app/scripts/seed-demo-data.ts
git commit -m "fix: use real PT-BR justification phrases in seed-demo-data instead of lorem ipsum"
```

---

### Task 2: Real justification phrases in `seed-sector-demo-employees.ts`

**Files:**
- Modify: `travel-app/scripts/seed-sector-demo-employees.ts:30` (add new consts after `TRIP_PURPOSES`), `travel-app/scripts/seed-sector-demo-employees.ts:155-160` (`buildRequest`'s `corporate` object)

**Interfaces:**
- Consumes: existing `pick<T>(items: T[]): T` helper (`seed-sector-demo-employees.ts:55-57`), existing `TripPurpose` import, existing `purpose`/`compliant` locals inside `buildRequest`.
- Produces: its own `TRIP_JUSTIFICATIONS` / `OUT_OF_POLICY_JUSTIFICATIONS` consts, identical content to Task 1's — intentionally duplicated, not imported, matching this file's existing style (it already duplicates `TRIP_PURPOSES`, `CARRIERS`, `ROUTES`, `STATUS_POOL` from `seed-demo-data.ts`).

- [ ] **Step 1: Add the same phrase pool constants**

Insert immediately after the `TRIP_PURPOSES` constant (`travel-app/scripts/seed-sector-demo-employees.ts:30`) — identical block to Task 1 Step 1:

```ts
const TRIP_JUSTIFICATIONS: Record<TripPurpose, string[]> = {
  client_meeting: [
    "Reunião presencial com cliente para apresentação de proposta comercial.",
    "Visita técnica ao cliente para acompanhar a implantação do projeto.",
    "Negociação de contrato com cliente estratégico da conta.",
    "Reunião de alinhamento trimestral com cliente-chave.",
  ],
  conference: [
    "Participação em conferência do setor para networking e capacitação.",
    "Palestra em evento do setor representando a empresa.",
    "Participação em feira do setor para prospecção de parceiros.",
    "Apresentação de case da empresa em congresso da área.",
  ],
  internal_meeting: [
    "Reunião de planejamento estratégico com a liderança na matriz.",
    "Alinhamento presencial com equipe de outra unidade.",
    "Kickoff presencial de projeto interno com stakeholders.",
    "Encontro trimestral de lideranças da empresa.",
  ],
  training: [
    "Participação em treinamento técnico oferecido pelo fornecedor.",
    "Capacitação presencial obrigatória para certificação da equipe.",
    "Treinamento de liderança promovido pela empresa.",
    "Workshop de atualização profissional na área de atuação.",
  ],
  other: [
    "Viagem para representar a empresa em evento institucional.",
    "Deslocamento para resolução de demanda operacional pontual.",
    "Viagem de suporte a outra unidade da empresa.",
  ],
};

const OUT_OF_POLICY_JUSTIFICATIONS: string[] = [
  "Não havia voos dentro do teto de política disponíveis para as datas da viagem.",
  "Reunião marcada em cima da hora exigiu compra de passagem com tarifa mais alta.",
  "Único voo compatível com a agenda do cliente excedia o limite de custo da política.",
  "Alta demanda no período, por evento no destino, elevou o preço acima do teto padrão.",
];
```

- [ ] **Step 2: Replace the lorem-ipsum calls in `buildRequest`**

In `travel-app/scripts/seed-sector-demo-employees.ts`, find (around line 155-160):

```ts
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: faker.lorem.sentence(),
      ...(compliant ? {} : { out_of_policy_justification: faker.lorem.sentence() }),
    },
```

Replace with:

```ts
    corporate: {
      trip_purpose: purpose,
      cost_center: sector,
      business_justification: pick(TRIP_JUSTIFICATIONS[purpose]),
      ...(compliant ? {} : { out_of_policy_justification: pick(OUT_OF_POLICY_JUSTIFICATIONS) }),
    },
```

- [ ] **Step 3: Type-check**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors mentioning `seed-sector-demo-employees.ts`.

- [ ] **Step 4: Commit**

```bash
git add travel-app/scripts/seed-sector-demo-employees.ts
git commit -m "fix: use real PT-BR justification phrases in seed-sector-demo-employees instead of lorem ipsum"
```

---

### Task 3: `reset-demo-data.ts` script + npm aliases

**Files:**
- Create: `travel-app/scripts/reset-demo-data.ts`
- Modify: `travel-app/package.json:5-12` (`scripts` block)

**Interfaces:**
- Consumes: `organizations` table (`name` column), `profiles` table (`id`, `organization_id`, `role` columns), `requests` table (`organization_id` column) — schema per `travel-app/supabase/migrations/0001_init.sql:10-58`. Reuses the same `ORG_NAME = "Paggo (Demo)"` and `DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab"` constants already hardcoded in `seed-demo-data.ts:17-18`.
- Produces: nothing consumed by other tasks — this is a standalone operational script invoked directly in Task 4.
- Relies on `profiles.id references auth.users(id) on delete cascade` (`0001_init.sql:23`): deleting the `auth.users` row for a mock employee automatically deletes their `profiles` row too, so the script never issues a `profiles` delete directly. `requests.employee_id references profiles.id` has no cascade, so `requests` must be deleted before the employees.

- [ ] **Step 1: Write the script**

Create `travel-app/scripts/reset-demo-data.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o reset."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const ORG_NAME = "Paggo (Demo)";
const DEMO_EMPLOYEE_ID = "39557140-a4c1-46cc-803e-021b433332ab";

async function main() {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id")
    .eq("name", ORG_NAME)
    .single();
  if (orgError || !org) {
    throw new Error(`Organização seed "${ORG_NAME}" não encontrada.`);
  }

  const { count: requestsBefore, error: countError } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", org.id);
  if (countError) {
    throw new Error(`Falha ao contar requests: ${countError.message}`);
  }

  const { data: mockEmployees, error: employeesError } = await supabase
    .from("profiles")
    .select("id")
    .eq("organization_id", org.id)
    .eq("role", "employee")
    .neq("id", DEMO_EMPLOYEE_ID);
  if (employeesError) {
    throw new Error(`Falha ao listar employees mock: ${employeesError.message}`);
  }

  console.log(
    `Antes do reset: ${requestsBefore ?? 0} requests, ${mockEmployees.length} employees mock ` +
      `(excluindo o employee demo fixo ${DEMO_EMPLOYEE_ID}). Guarde estes números para conferir depois do reseed.`
  );

  const { error: deleteRequestsError } = await supabase
    .from("requests")
    .delete()
    .eq("organization_id", org.id);
  if (deleteRequestsError) {
    throw new Error(`Falha ao apagar requests: ${deleteRequestsError.message}`);
  }

  for (const employee of mockEmployees) {
    const { error: deleteUserError } = await supabase.auth.admin.deleteUser(employee.id);
    if (deleteUserError) {
      throw new Error(`Falha ao apagar employee ${employee.id}: ${deleteUserError.message}`);
    }
  }

  console.log(
    `Reset concluído: ${requestsBefore ?? 0} requests apagadas e ${mockEmployees.length} employees mock ` +
      `apagados (profiles removidos em cascata via auth.users). Rode "npm run seed" e ` +
      `"npm run seed:sectors" agora, depois confira se o total de requests da org volta a bater com ${requestsBefore ?? 0}.`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script aliases**

In `travel-app/package.json`, the `scripts` block currently has:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "seed": "tsx --env-file=.env.local scripts/seed-demo-data.ts"
  },
```

Replace with:

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "seed": "tsx --env-file=.env.local scripts/seed-demo-data.ts",
    "seed:sectors": "tsx --env-file=.env.local scripts/seed-sector-demo-employees.ts",
    "seed:reset": "tsx --env-file=.env.local scripts/reset-demo-data.ts"
  },
```

- [ ] **Step 3: Type-check**

Run: `cd travel-app && npx tsc --noEmit`
Expected: no errors mentioning `reset-demo-data.ts`.

- [ ] **Step 4: Commit**

```bash
git add travel-app/scripts/reset-demo-data.ts travel-app/package.json
git commit -m "feat: add reset-demo-data script and npm aliases for reseeding demo data"
```

---

### Task 4: Reset and regenerate the demo data (live, destructive — requires explicit go-ahead)

**Files:** none (operational task — runs the scripts built in Tasks 1-3 against the real demo Supabase project)

**Interfaces:**
- Consumes: `npm run seed:reset`, `npm run seed`, `npm run seed:sectors` (all defined in Task 3), and the demo org's `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`).
- Produces: the corrected data the admin Relatórios view will read.

- [ ] **Step 1: Confirm with the user before running anything in this task**

This step deletes real rows in the demo Supabase project. Do not proceed past this point without the user explicitly confirming, at execution time, that it's OK to wipe and regenerate the demo org's requests/employees right now.

- [ ] **Step 2: Run the reset script and record the "before" counts**

Run: `cd travel-app && npm run seed:reset`
Expected output includes a line like `Antes do reset: <N> requests, <M> employees mock ...` — write down `<N>` (target request count to reconcile against).

- [ ] **Step 3: Re-run both seed scripts once each**

Run: `cd travel-app && npm run seed`
Run: `cd travel-app && npm run seed:sectors`
Expected: each prints a `Seed concluído: ...` line with employee/request counts (5 employees × 12 requests = 60 per script, 120 total for both).

- [ ] **Step 4: Reconcile the request count**

Query the current total: in the Supabase SQL editor (or via `supabase.from("requests").select("id", { count: "exact", head: true }).eq("organization_id", org.id)`), compare the new total to `<N>` from Step 2.
- If it matches, done — this means each script had only ever been run once before.
- If it's lower than `<N>`, run `npm run seed` and/or `npm run seed:sectors` again (each additional run adds another 60) until the totals match.
- If it's higher than `<N>`, some rows need to be deleted manually via the Supabase SQL editor to get back to `<N>` — do not guess; ask the user how they want the discrepancy handled, since it means the historical run count wasn't 1-and-1 for these two scripts.

- [ ] **Step 5: Verify the content in the admin UI**

Start the app (`npm run dev`), log in as the demo admin, open **Admin → Relatórios**, and open a handful of trip requests across different `trip_purpose` values. Confirm:
- The "Motivo" text is a coherent Portuguese sentence matching its category (e.g. a `client_meeting` row reads like a client-meeting reason, not a training reason).
- No row still shows Latin/lorem-ipsum text.
- Rows flagged out-of-policy show a coherent Portuguese "fora de política" justification.

No commit for this task — it only touches database rows, not source files.

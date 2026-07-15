# Conversão de moeda (USD → BRL) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** normalizar toda oferta de voo retornada pela Duffel para BRL logo no mapeamento (`map-offer.ts`), com uma cotação cacheada no Supabase (tabela `exchange_rates`) e uma rede de segurança de 3 camadas que garante que a busca de voos nunca falha nem mostra erro por causa da cotação.

**Architecture:** `src/lib/currency/exchange-rate.ts` expõe `getRateToBRL(currency)`, que resolve a cotação (cache do dia → API ao vivo com cache atualizado → cache antigo → constante fixa `5.4`) sem nunca lançar exceção. `src/lib/duffel/client.ts` resolve a taxa por moeda única entre as ofertas de uma busca e passa cada taxa para `mapDuffelOfferToFlightOffer`, que agora converte `totalAmount` e `penalty_amount` para BRL na origem — nenhuma outra camada do app (`policy.ts`, `admin-analytics.ts`) precisa mudar.

**Tech Stack:** Next.js 14 (Route Handlers), Supabase (`@supabase/ssr`), Vitest, AwesomeAPI (`economia.awesomeapi.com.br`, sem autenticação).

## Global Constraints

- A busca de voos nunca pode falhar nem retornar mensagem de erro por causa da cotação de câmbio — `getRateToBRL` sempre resolve para um número.
- Constante de fallback: `FALLBACK_RATE_TO_BRL = 5.4` (única, aplicada a qualquer moeda no pior caso — não é mais um mapa por moeda).
- `currency` e `penalty_currency` de toda oferta mapeada por `mapDuffelOfferToFlightOffer` passam a ser sempre `"BRL"`.
- Nenhuma mudança em `src/lib/policy.ts` ou `src/lib/admin-analytics.ts`.
- Referência: `docs/superpowers/specs/2026-07-14-currency-conversion-design.md`.

---

### Task 1: Migration `exchange_rates`

**Files:**
- Create: `travel-app/supabase/migrations/0006_exchange_rates.sql`

**Interfaces:**
- Produces: tabela `exchange_rates(currency text primary key, rate_to_brl numeric not null, fetched_at timestamptz not null default now())`, usada por `getRateToBRL` (Task 2) via `supabase.from("exchange_rates")`.

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- travel-app/supabase/migrations/0006_exchange_rates.sql
-- Cache global de cotação de moeda estrangeira -> BRL, usado para converter
-- os valores retornados pela Duffel (total_amount/total_currency das
-- ofertas, hoje sempre USD nas buscas observadas). Não pertence a nenhuma
-- organização — é um dado de mercado compartilhado por todo o app.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

create table if not exists exchange_rates (
  currency text primary key,
  rate_to_brl numeric not null,
  fetched_at timestamptz not null default now()
);

alter table exchange_rates enable row level security;

create policy "exchange_rates_select_authenticated"
  on exchange_rates for select
  using (auth.uid() is not null);

create policy "exchange_rates_upsert_authenticated"
  on exchange_rates for insert
  with check (auth.uid() is not null);

create policy "exchange_rates_update_authenticated"
  on exchange_rates for update
  using (auth.uid() is not null)
  with check (auth.uid() is not null);
```

- [ ] **Step 2: Conferir que o arquivo foi criado corretamente**

Run: `cat travel-app/supabase/migrations/0006_exchange_rates.sql`
Expected: o conteúdo acima aparece sem erros de sintaxe visíveis (parênteses balanceados, `;` no fim de cada statement).

- [ ] **Step 3: Aplicar a migration no Supabase**

Copie o conteúdo do arquivo, cole no SQL Editor do projeto Supabase (menu lateral → SQL Editor → New query) e rode. Confirme que a tabela `exchange_rates` aparece em Table Editor com RLS habilitado.

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add supabase/migrations/0006_exchange_rates.sql
git commit -m "feat: add exchange_rates cache table migration"
```

---

### Task 2: Módulo `exchange-rate.ts`

**Files:**
- Create: `travel-app/src/lib/currency/exchange-rate.ts`
- Test: `travel-app/src/lib/currency/exchange-rate.test.ts`

**Interfaces:**
- Consumes: `createSupabaseServerClient` de `travel-app/src/lib/supabase/server.ts` (já existe, sem mudanças — assinatura `(): SupabaseClient`, com `.from(table).select(cols).eq(col, val).maybeSingle()` e `.from(table).upsert(row)`).
- Produces: `getRateToBRL(currency: string): Promise<number>` — usado por `client.ts` (Task 4). Nunca lança exceção; `currency === "BRL"` retorna `1` sem tocar no banco.

- [ ] **Step 1: Escrever os testes (falhando)**

Crie `travel-app/src/lib/currency/exchange-rate.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockMaybeSingle = vi.fn();
const mockUpsert = vi.fn();

vi.mock("../supabase/server", () => ({
  createSupabaseServerClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mockMaybeSingle,
        }),
      }),
      upsert: mockUpsert,
    }),
  }),
}));

import { getRateToBRL } from "./exchange-rate";

describe("getRateToBRL", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockMaybeSingle.mockReset();
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns 1 for BRL without touching the database", async () => {
    const rate = await getRateToBRL("BRL");

    expect(rate).toBe(1);
    expect(mockMaybeSingle).not.toHaveBeenCalled();
  });

  it("returns the cached rate when it was fetched today", async () => {
    const today = new Date().toISOString();
    mockMaybeSingle.mockResolvedValueOnce({ data: { rate_to_brl: 5.2, fetched_at: today } });

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.2);
  });

  it("fetches a live rate and caches it when there is no fresh cache", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ USDBRL: { bid: "5.55" } }),
    }) as unknown as typeof fetch;

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.55);
    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ currency: "USD", rate_to_brl: 5.55 })
    );
  });

  it("falls back to a stale cached rate when the live API fails", async () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    mockMaybeSingle.mockResolvedValueOnce({ data: { rate_to_brl: 5.1, fetched_at: twoDaysAgo } });
    global.fetch = vi.fn().mockResolvedValue({ ok: false }) as unknown as typeof fetch;

    const rate = await getRateToBRL("USD");

    expect(rate).toBe(5.1);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("falls back to the hardcoded safety-net rate when there is no cache and the API fails", async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null });
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const rate = await getRateToBRL("EUR");

    expect(rate).toBe(5.4);
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd travel-app && npx vitest run src/lib/currency/exchange-rate.test.ts`
Expected: FAIL — `Cannot find module './exchange-rate'` (o arquivo de implementação ainda não existe).

- [ ] **Step 3: Implementar `exchange-rate.ts`**

Crie `travel-app/src/lib/currency/exchange-rate.ts`:

```ts
import { createSupabaseServerClient } from "../supabase/server";

// Última rede de segurança: se não houver cache nenhum e a API de câmbio
// estiver fora do ar, usamos esse valor fixo em vez de falhar a busca de
// voos. Calibrado para USD (única moeda observada vinda da Duffel hoje) —
// atualizar periodicamente.
const FALLBACK_RATE_TO_BRL = 5.4;

const AWESOMEAPI_BASE = "https://economia.awesomeapi.com.br/json/last";
const FETCH_TIMEOUT_MS = 3000;

export async function getRateToBRL(currency: string): Promise<number> {
  if (currency === "BRL") return 1;

  const supabase = createSupabaseServerClient();
  const { data: cached } = await supabase
    .from("exchange_rates")
    .select("rate_to_brl, fetched_at")
    .eq("currency", currency)
    .maybeSingle();

  if (cached && isFromToday(cached.fetched_at)) {
    return Number(cached.rate_to_brl);
  }

  const liveRate = await fetchLiveRate(currency);
  if (liveRate !== null) {
    await supabase.from("exchange_rates").upsert({
      currency,
      rate_to_brl: liveRate,
      fetched_at: new Date().toISOString(),
    });
    return liveRate;
  }

  if (cached) {
    return Number(cached.rate_to_brl);
  }

  return FALLBACK_RATE_TO_BRL;
}

function isFromToday(fetchedAt: string): boolean {
  const fetchedDate = new Date(fetchedAt).toISOString().slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  return fetchedDate === today;
}

async function fetchLiveRate(currency: string): Promise<number | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const response = await fetch(`${AWESOMEAPI_BASE}/${currency}-BRL`, {
      signal: controller.signal,
      cache: "no-store",
    });
    clearTimeout(timeout);
    if (!response.ok) return null;

    const json = (await response.json()) as Record<string, { bid?: string }>;
    const bid = json[`${currency}BRL`]?.bid;
    if (!bid) return null;

    const rate = Number(bid);
    return Number.isFinite(rate) ? rate : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd travel-app && npx vitest run src/lib/currency/exchange-rate.test.ts`
Expected: PASS — 5 testes passando.

- [ ] **Step 5: Commit**

```bash
cd travel-app
git add src/lib/currency/exchange-rate.ts src/lib/currency/exchange-rate.test.ts
git commit -m "feat: add getRateToBRL with cache + 3-layer fallback"
```

---

### Task 3: Converter `map-offer.ts` para BRL

**Files:**
- Modify: `travel-app/src/lib/duffel/map-offer.ts:4-11` (`mapConditionDetail`), `travel-app/src/lib/duffel/map-offer.ts:50-102` (`mapDuffelOfferToFlightOffer`)
- Test: `travel-app/src/lib/duffel/map-offer.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência nova de outro módulo — recebe `rateToBRL: number` já resolvido pelo chamador (Task 4).
- Produces: `mapDuffelOfferToFlightOffer(raw: DuffelRawOffer, criteria: SearchCriteria, rateToBRL: number): FlightOffer` — assinatura muda (novo 3º parâmetro obrigatório). `offer.totalAmount` e `offer.conditions.*.penalty_amount` já vêm convertidos para BRL; `offer.currency` e `offer.conditions.*.penalty_currency` são sempre `"BRL"`.

- [ ] **Step 1: Atualizar os testes existentes para passar `rateToBRL` e adicionar o teste de conversão**

Edite `travel-app/src/lib/duffel/map-offer.test.ts`: as três chamadas existentes a `mapDuffelOfferToFlightOffer(RAW_OFFER, CRITERIA)` (linhas 63, 78) e `mapDuffelOfferToFlightOffer(roundTripOffer, roundTripCriteria)` (linha 114) passam a incluir `1` como terceiro argumento (o fixture já usa `total_currency: "BRL"`, então uma taxa de `1` preserva os valores esperados atuais). Adicione um novo `describe` bloco no fim do arquivo, antes do `});` final:

```ts
describe("mapDuffelOfferToFlightOffer currency conversion", () => {
  it("converts totalAmount and penalty_amount using the given exchange rate", () => {
    const usdOffer: DuffelRawOffer = {
      ...RAW_OFFER,
      total_amount: "500.00",
      total_currency: "USD",
      conditions: {
        refund_before_departure: { allowed: false, penalty_amount: null, penalty_currency: null },
        change_before_departure: { allowed: true, penalty_amount: "150.00", penalty_currency: "USD" },
      },
    };

    const offer = mapDuffelOfferToFlightOffer(usdOffer, CRITERIA, 5.5);

    expect(offer.totalAmount).toBe(2750);
    expect(offer.currency).toBe("BRL");
    expect(offer.conditions?.change_before_departure.penalty_amount).toBe("825.00");
    expect(offer.conditions?.change_before_departure.penalty_currency).toBe("BRL");
    expect(offer.conditions?.refund_before_departure.penalty_amount).toBeUndefined();
  });
});
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: FAIL — os testes existentes falham porque `mapDuffelOfferToFlightOffer` ainda não aceita/usa o terceiro argumento (o novo teste falha porque `totalAmount` ainda vem sem conversão).

- [ ] **Step 3: Implementar a conversão em `map-offer.ts`**

Edite `travel-app/src/lib/duffel/map-offer.ts`. Substitua a função `mapConditionDetail` (linhas 4-11):

```ts
function mapConditionDetail(
  raw: DuffelRawConditionDetail | null,
  rateToBRL: number
): OfferConditionDetail {
  if (!raw) return { allowed: false };
  return {
    allowed: raw.allowed,
    penalty_amount: raw.penalty_amount
      ? (Number(raw.penalty_amount) * rateToBRL).toFixed(2)
      : undefined,
    penalty_currency: raw.penalty_amount ? "BRL" : undefined,
  };
}
```

Substitua a assinatura e o corpo de `mapDuffelOfferToFlightOffer` (linhas 50-102): adicione o parâmetro `rateToBRL: number`, troque as duas chamadas a `mapConditionDetail` para passar `rateToBRL`, e troque as linhas de `totalAmount`/`currency`:

```ts
export function mapDuffelOfferToFlightOffer(
  raw: DuffelRawOffer,
  criteria: SearchCriteria,
  rateToBRL: number
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
    totalAmount: Number(raw.total_amount) * rateToBRL,
    currency: "BRL",
    expiresAt: raw.expires_at,
    owner: {
      iata_code: raw.owner.iata_code,
      name: raw.owner.name,
      logo_symbol_url: raw.owner.logo_symbol_url ?? "",
      brand_color: "",
    },
    slices,
    conditions: {
      refund_before_departure: mapConditionDetail(raw.conditions.refund_before_departure, rateToBRL),
      change_before_departure: mapConditionDetail(raw.conditions.change_before_departure, rateToBRL),
    },
    passengerIdentityDocumentsRequired: raw.passenger_identity_documents_required,
    totalEmissionsKg: raw.total_emissions_kg ? Number(raw.total_emissions_kg) : undefined,
    availableServices: [],
    fareBrandName: firstSlice?.fare_brand_name,
    longestSegmentHours,
  };
}
```

- [ ] **Step 4: Rodar os testes e confirmar que passam**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: PASS — todos os testes (existentes + o novo) passando.

- [ ] **Step 5: Commit**

```bash
cd travel-app
git add src/lib/duffel/map-offer.ts src/lib/duffel/map-offer.test.ts
git commit -m "feat: convert offer totalAmount and penalty_amount to BRL"
```

---

### Task 4: Resolver a cotação em `client.ts`

**Files:**
- Modify: `travel-app/src/lib/duffel/client.ts:1-4` (imports), `travel-app/src/lib/duffel/client.ts:42-44` (mapeamento final)

**Interfaces:**
- Consumes: `getRateToBRL(currency: string): Promise<number>` (Task 2); `mapDuffelOfferToFlightOffer(raw, criteria, rateToBRL): FlightOffer` (Task 3).
- Produces: `searchFlights(criteria: SearchCriteria): Promise<FlightOffer[]>` — assinatura pública não muda; o comportamento agora inclui a resolução de câmbio internamente.

Este arquivo não tem teste automatizado hoje (é um wrapper fino sobre `fetch` para uma API externa, sem mocks existentes) — a verificação é rodar a suíte completa (Step 3) e testar a busca de voos manualmente depois do Task 5.

- [ ] **Step 1: Atualizar o import**

Em `travel-app/src/lib/duffel/client.ts`, no topo do arquivo, troque:

```ts
import type { FlightOffer, SearchCriteria } from "../types";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelErrorResponse, DuffelOfferRequestResponse } from "./types";
```

por:

```ts
import type { FlightOffer, SearchCriteria } from "../types";
import { getRateToBRL } from "../currency/exchange-rate";
import { mapDuffelOfferToFlightOffer } from "./map-offer";
import type { DuffelErrorResponse, DuffelOfferRequestResponse } from "./types";
```

- [ ] **Step 2: Resolver a(s) taxa(s) antes de mapear as ofertas**

No mesmo arquivo, troque as duas últimas linhas da função `searchFlights`:

```ts
  const json = (await response.json()) as DuffelOfferRequestResponse;
  return json.data.offers.map((offer) => mapDuffelOfferToFlightOffer(offer, criteria));
}
```

por:

```ts
  const json = (await response.json()) as DuffelOfferRequestResponse;

  const currencies = Array.from(new Set(json.data.offers.map((offer) => offer.total_currency)));
  const rates = new Map<string, number>();
  for (const currency of currencies) {
    rates.set(currency, await getRateToBRL(currency));
  }

  return json.data.offers.map((offer) =>
    mapDuffelOfferToFlightOffer(offer, criteria, rates.get(offer.total_currency) ?? 1)
  );
}
```

- [ ] **Step 3: Rodar a suíte completa de testes**

Run: `cd travel-app && npm run test`
Expected: PASS — todos os testes do projeto passando, incluindo `exchange-rate.test.ts` e `map-offer.test.ts`.

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add src/lib/duffel/client.ts
git commit -m "feat: resolve exchange rate per currency in searchFlights"
```

---

### Task 5: Atualizar o diagrama React Flow do schema

**Files:**
- Modify: `travel-app/src/lib/dev/database-schema.ts:36-126` (`schemaTables`)
- Modify: `travel-app/src/app/dev/schema/page.tsx:19-25` (`positions`)

**Interfaces:**
- Consumes: nenhuma (arquivo estático, descrição manual do schema — ver comentário no topo de `database-schema.ts`).
- Produces: nenhuma (consumido apenas pela página `/dev/schema`).

- [ ] **Step 1: Adicionar `exchange_rates` em `schemaTables`**

Em `travel-app/src/lib/dev/database-schema.ts`, adicione um novo item ao array `schemaTables` (depois do item `policy_rules`, antes do `];` de fechamento na linha 126):

```ts
  {
    id: "exchange_rates",
    name: "exchange_rates",
    rls: true,
    note: "Cache global de cotação de moeda estrangeira → BRL, usado para converter os valores retornados pela Duffel. Não pertence a nenhuma organização.",
    columns: [
      { name: "currency", type: "text", flags: ["pk"], note: "ex.: 'USD'" },
      { name: "rate_to_brl", type: "numeric" },
      { name: "fetched_at", type: "timestamptz", note: "default now()" },
    ],
  },
```

Não adicione nenhuma entrada em `schemaEdges` — é uma tabela standalone, sem foreign key.

- [ ] **Step 2: Adicionar a posição do node**

Em `travel-app/src/app/dev/schema/page.tsx`, no objeto `positions` (linhas 19-25), adicione:

```ts
const positions: Record<string, { x: number; y: number }> = {
  "auth.users": { x: 40, y: 40 },
  organizations: { x: 620, y: 40 },
  profiles: { x: 40, y: 320 },
  requests: { x: 620, y: 340 },
  policy_rules: { x: 1140, y: 340 },
  exchange_rates: { x: 1140, y: 40 },
};
```

- [ ] **Step 3: Verificar visualmente**

Run: `cd travel-app && npm run dev`

Abra `http://localhost:3000/dev/schema` no navegador e confirme que o node `exchange_rates` aparece no canto superior direito, com as 3 colunas (`currency` marcada PK, `rate_to_brl`, `fetched_at`) e sem nenhuma linha de conexão saindo dele. Pare o servidor depois (Ctrl+C).

- [ ] **Step 4: Rodar a suíte completa de testes e o lint como checagem final**

Run: `cd travel-app && npm run test && npm run lint`
Expected: PASS em ambos — nenhuma regressão em nenhum outro arquivo do projeto.

- [ ] **Step 5: Commit**

```bash
cd travel-app
git add src/lib/dev/database-schema.ts src/app/dev/schema/page.tsx
git commit -m "docs: add exchange_rates node to the React Flow schema diagram"
```

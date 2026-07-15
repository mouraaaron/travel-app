# Gravar taxa de conversão no snapshot da solicitação Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** gravar a taxa de câmbio (`rate_to_brl`) usada para converter a oferta selecionada, tanto numa coluna nova em `requests` quanto dentro do JSONB `selected_offer_snapshot`, e fazer o backfill das 9 solicitações reais antigas que ainda estão em USD sem conversão.

**Architecture:** `mapDuffelOfferToFlightOffer` (`map-offer.ts`) já recebe `rateToBRL` como parâmetro — passa a devolvê-lo também no `FlightOffer` retornado. Esse valor viaja pelo mesmo caminho que `totalAmount`/`currency` já percorrem hoje (resultado da busca → seleção → tela de revisão → payload de criação da solicitação em `/api/requests`), sem nenhum canal novo de dados. Um script one-off separado faz o backfill das 9 solicitações antigas em USD usando a cotação atual.

**Tech Stack:** Next.js 14 (Route Handlers), Supabase (`@supabase/ssr` no app, `@supabase/supabase-js` nos scripts), Vitest, tsx (scripts one-off).

## Global Constraints

- Nova coluna `requests.exchange_rate_to_brl numeric`, nullable.
- `SelectedOfferSnapshot.exchange_rate_to_brl` é opcional no tipo — os 61 registros do seed sintético não têm e não vão ganhar esse campo; só solicitações novas e as 9 backfilladas o têm.
- O backfill usa a cotação **atual** (buscada no momento em que o script roda), não a taxa histórica do dia da busca original — essa informação não existe mais.
- Nenhuma mudança em `src/lib/admin-analytics.ts`, nos componentes de dashboard agregados (`stat-cards.tsx`, `employee-ranking-table.tsx`, `spend-breakdown-charts.tsx`, `spend-chart.tsx`, `employee-summary-cards.tsx`) nem em `src/lib/policy.ts`.
- Referência: `docs/superpowers/specs/2026-07-14-requests-exchange-rate-design.md`.

---

### Task 1: Migration `requests.exchange_rate_to_brl`

**Files:**
- Create: `travel-app/supabase/migrations/0007_requests_exchange_rate.sql`

**Interfaces:**
- Produces: coluna `requests.exchange_rate_to_brl numeric` (nullable), usada por `api/requests/route.ts` (Task 5) e pelo script de backfill (Task 6).

- [ ] **Step 1: Criar o arquivo de migration**

```sql
-- travel-app/supabase/migrations/0007_requests_exchange_rate.sql
-- Grava a taxa de câmbio (rate_to_brl) usada para converter a oferta
-- selecionada, no momento em que a solicitação é criada. Complementa
-- exchange_rates (0006), que só guarda a cotação mais recente por moeda —
-- esta coluna guarda qual taxa foi realmente aplicada a cada solicitação
-- específica, para auditoria individual. Nullable porque solicitações
-- antigas (seed sintético em BRL) nunca tiveram uma taxa real associada.
--
-- Como rodar: copie o conteúdo deste arquivo, cole no SQL Editor do
-- Supabase (menu lateral -> SQL Editor -> New query) e clique em "Run".

alter table requests add column if not exists exchange_rate_to_brl numeric;
```

- [ ] **Step 2: Conferir que o arquivo foi criado corretamente**

Run: `cat travel-app/supabase/migrations/0007_requests_exchange_rate.sql`
Expected: o conteúdo acima aparece sem erros de sintaxe visíveis.

- [ ] **Step 3: Aplicar a migration no Supabase**

Copie o conteúdo do arquivo, cole no SQL Editor do projeto Supabase (menu lateral → SQL Editor → New query) e rode. Confirme que a coluna `exchange_rate_to_brl` aparece em Table Editor na tabela `requests`.

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add supabase/migrations/0007_requests_exchange_rate.sql
git commit -m "feat: add exchange_rate_to_brl column to requests"
```

---

### Task 2: `mapDuffelOfferToFlightOffer` devolve a taxa usada

**Files:**
- Modify: `travel-app/src/lib/types.ts` (`FlightOffer`, por volta da linha 5-29)
- Modify: `travel-app/src/lib/duffel/map-offer.ts:73-107` (`mapDuffelOfferToFlightOffer`)
- Test: `travel-app/src/lib/duffel/map-offer.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência nova.
- Produces: `FlightOffer.rateToBRL?: number` — usado por `request/review/page.tsx` (Task 4). Opcional porque `generateOffers`/`MOCK_FLIGHT_OFFERS` em `src/lib/mock-data.ts` constroem `FlightOffer` sem passar por `mapDuffelOfferToFlightOffer` e não têm taxa nenhuma — seguindo o mesmo padrão dos outros campos "Duffel-shaped extension" já opcionais nessa interface (`owner?`, `slices?`, `conditions?`, etc.). Toda oferta que vier de uma busca real (via `mapDuffelOfferToFlightOffer`) sempre tem `rateToBRL` populado.

- [ ] **Step 1: Adicionar o assert que falha ao teste existente**

Edite `travel-app/src/lib/duffel/map-offer.test.ts`. No bloco `describe("mapDuffelOfferToFlightOffer currency conversion", ...)`, dentro do `it("converts totalAmount and penalty_amount using the given exchange rate", ...)`, adicione uma linha logo após `expect(offer.currency).toBe("BRL");`:

```ts
    expect(offer.totalAmount).toBe(2750);
    expect(offer.currency).toBe("BRL");
    expect(offer.rateToBRL).toBe(5.5);
    expect(offer.conditions?.change_before_departure.penalty_amount).toBe("825.00");
```

- [ ] **Step 2: Rodar os testes e confirmar que falham**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: FAIL — `expect(offer.rateToBRL).toBe(5.5)` recebe `undefined`.

- [ ] **Step 3: Adicionar `rateToBRL` ao tipo `FlightOffer`**

Edite `travel-app/src/lib/types.ts`. No fim da interface `FlightOffer` (logo antes do `}` de fechamento, depois de `longestSegmentHours?: number;`), adicione:

```ts
  fareBrandName?: string;
  longestSegmentHours?: number;
  rateToBRL?: number;
}
```

- [ ] **Step 4: Devolver `rateToBRL` no objeto retornado por `mapDuffelOfferToFlightOffer`**

Edite `travel-app/src/lib/duffel/map-offer.ts`. No objeto retornado por `mapDuffelOfferToFlightOffer`, adicione o campo logo após `currency: "BRL",`:

```ts
    totalAmount: Number(raw.total_amount) * rateToBRL,
    currency: "BRL",
    rateToBRL,
    expiresAt: raw.expires_at,
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd travel-app && npx vitest run src/lib/duffel/map-offer.test.ts`
Expected: PASS — todos os testes do arquivo passando.

- [ ] **Step 6: Commit**

```bash
cd travel-app
git add src/lib/types.ts src/lib/duffel/map-offer.ts src/lib/duffel/map-offer.test.ts
git commit -m "feat: return rateToBRL from mapDuffelOfferToFlightOffer"
```

---

### Task 3: Tipos do snapshot e da linha crua de `requests`

**Files:**
- Modify: `travel-app/src/lib/types.ts` (`SelectedOfferSnapshot`, por volta da linha 212-230)
- Modify: `travel-app/src/lib/requests-mapper.ts:4-18` (`RequestRow`)
- Test: `travel-app/src/lib/requests-mapper.test.ts`

**Interfaces:**
- Consumes: nenhuma dependência nova.
- Produces: `SelectedOfferSnapshot.exchange_rate_to_brl?: number` — usado por `request/review/page.tsx` (Task 4) e `api/requests/route.ts` (Task 5). `RequestRow.exchange_rate_to_brl: number | null` — espelha a coluna crua de `requests` (Task 1); não é propagado para `TravelRequest` (que hoje também não expõe `total_amount`/`total_currency` no nível raiz, só dentro do snapshot — mesmo padrão).

- [ ] **Step 1: Atualizar o fixture do teste para incluir o campo novo**

Edite `travel-app/src/lib/requests-mapper.test.ts`. No objeto `ROW`, adicione `exchange_rate_to_brl: 1,` logo após `total_currency: "BRL",` (linha 10):

```ts
  total_amount: 2850,
  total_currency: "BRL",
  exchange_rate_to_brl: 1,
  created_at: "2026-07-10T14:00:00Z",
```

E dentro de `selected_offer_snapshot`, adicione `exchange_rate_to_brl: 1,` logo após `total_currency: "BRL",` (linha 20):

```ts
  selected_offer_snapshot: {
    offer_id: "off_1",
    total_amount: "2850.00",
    total_currency: "BRL",
    exchange_rate_to_brl: 1,
    owner: { iata_code: "LA", name: "LATAM", logo_symbol_url: "" },
```

- [ ] **Step 2: Rodar os testes e confirmar que falham por causa de tipo**

Run: `cd travel-app && npx tsc --noEmit`
Expected: FAIL — erros de tipo em `requests-mapper.test.ts` porque `exchange_rate_to_brl` ainda não existe em `RequestRow` nem em `SelectedOfferSnapshot`.

- [ ] **Step 3: Adicionar o campo a `SelectedOfferSnapshot`**

Edite `travel-app/src/lib/types.ts`. Na interface `SelectedOfferSnapshot`, adicione o campo logo após `total_currency: string;`:

```ts
export interface SelectedOfferSnapshot {
  offer_id: string;
  total_amount: string;
  total_currency: string;
  exchange_rate_to_brl?: number;
  owner: { iata_code: string; name: string; logo_symbol_url: string };
```

- [ ] **Step 4: Adicionar o campo a `RequestRow`**

Edite `travel-app/src/lib/requests-mapper.ts`. Na interface `RequestRow`, adicione o campo logo após `total_currency: string;`:

```ts
export interface RequestRow {
  id: string;
  organization_id: string;
  employee_id: string;
  status: TravelRequest["status"];
  total_amount: number;
  total_currency: string;
  exchange_rate_to_brl: number | null;
  created_at: string;
```

- [ ] **Step 5: Rodar o typecheck e os testes, confirmar que passam**

Run: `cd travel-app && npx tsc --noEmit && npx vitest run src/lib/requests-mapper.test.ts`
Expected: PASS em ambos.

- [ ] **Step 6: Commit**

```bash
cd travel-app
git add src/lib/types.ts src/lib/requests-mapper.ts src/lib/requests-mapper.test.ts
git commit -m "feat: add exchange_rate_to_brl to SelectedOfferSnapshot and RequestRow"
```

---

### Task 4: Incluir a taxa no payload da tela de revisão

**Files:**
- Modify: `travel-app/src/app/(app)/request/review/page.tsx:75-102` (montagem de `selected_offer_snapshot`)

**Interfaces:**
- Consumes: `FlightOffer.rateToBRL` (Task 2), `SelectedOfferSnapshot.exchange_rate_to_brl` (Task 3).
- Produces: nenhuma (consumido só por `api/requests/route.ts`, Task 5).

Este arquivo é um client component sem teste automatizado (é uma page do Next.js com hooks de router/formulário) — a verificação é rodar a suíte completa e o typecheck (Step 2), e testar manualmente depois do Task 5.

- [ ] **Step 1: Incluir `exchange_rate_to_brl` no payload**

Edite `travel-app/src/app/(app)/request/review/page.tsx`. No objeto `selected_offer_snapshot` dentro de `onSubmit`, adicione o campo logo após `total_currency: offer.currency,`:

```ts
      selected_offer_snapshot: {
        offer_id: offer.id,
        total_amount: String(offer.totalAmount),
        total_currency: offer.currency,
        exchange_rate_to_brl: offer.rateToBRL,
        owner: {
```

- [ ] **Step 2: Rodar a suíte completa e o typecheck**

Run: `cd travel-app && npm run test && npx tsc --noEmit`
Expected: PASS em ambos — nenhuma regressão.

- [ ] **Step 3: Commit**

```bash
cd travel-app
git add "src/app/(app)/request/review/page.tsx"
git commit -m "feat: include exchange_rate_to_brl in the request review payload"
```

---

### Task 5: Persistir a taxa em `/api/requests`

**Files:**
- Modify: `travel-app/src/app/api/requests/route.ts:24-34` (schema Zod de `selected_offer_snapshot`)
- Modify: `travel-app/src/app/api/requests/route.ts:78-92` (insert em `requests`)

**Interfaces:**
- Consumes: payload de `request/review/page.tsx` (Task 4); coluna `requests.exchange_rate_to_brl` (Task 1).
- Produces: `POST /api/requests` passa a gravar `exchange_rate_to_brl` na tabela `requests`, dentro do `selected_offer_snapshot` já validado.

Este arquivo não tem teste automatizado hoje — a verificação é rodar a suíte completa e o typecheck (Step 3), e testar manualmente depois (criar uma solicitação de ponta a ponta e conferir a coluna no Supabase).

- [ ] **Step 1: Adicionar o campo ao schema Zod**

Edite `travel-app/src/app/api/requests/route.ts`. Em `requestCreateSchema.selected_offer_snapshot`, adicione o campo logo após `total_currency: z.string(),`:

```ts
  selected_offer_snapshot: z.object({
    offer_id: z.string(),
    total_amount: z.string(),
    total_currency: z.string(),
    exchange_rate_to_brl: z.number().optional(),
    owner: z.object({ iata_code: z.string(), name: z.string(), logo_symbol_url: z.string() }),
```

- [ ] **Step 2: Gravar o campo na coluna nova**

No mesmo arquivo, no insert em `requests`, adicione o campo logo após `total_currency: parsed.data.selected_offer_snapshot.total_currency,`:

```ts
    .insert({
      organization_id: profile.organization_id,
      employee_id: user.id,
      status: "pending_admin",
      total_amount: totalAmount,
      total_currency: parsed.data.selected_offer_snapshot.total_currency,
      exchange_rate_to_brl: parsed.data.selected_offer_snapshot.exchange_rate_to_brl ?? null,
      search_criteria: parsed.data.search_criteria,
```

- [ ] **Step 3: Rodar a suíte completa e o typecheck**

Run: `cd travel-app && npm run test && npx tsc --noEmit`
Expected: PASS em ambos.

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add src/app/api/requests/route.ts
git commit -m "feat: persist exchange_rate_to_brl on request creation"
```

---

### Task 6: Backfill das 9 solicitações antigas em USD

**Files:**
- Create: `travel-app/scripts/backfill-usd-requests-to-brl.ts`
- Modify: `travel-app/package.json` (novo script `backfill-usd-requests`)

**Interfaces:**
- Consumes: coluna `requests.exchange_rate_to_brl` (Task 1) — precisa da migration já aplicada no Supabase antes de rodar.
- Produces: nenhuma (script one-off, não é importado por nenhum outro módulo).

Este script muda dado real no Supabase de produção/demo do projeto. É seguro rodar mais de uma vez (idempotente: só afeta linhas com `total_currency = 'USD'`, e depois da primeira execução não sobra nenhuma).

- [ ] **Step 1: Criar o script**

Crie `travel-app/scripts/backfill-usd-requests-to-brl.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error(
    "Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente (.env.local) antes de rodar o backfill."
  );
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const AWESOMEAPI_BASE = "https://economia.awesomeapi.com.br/json/last";

async function fetchCurrentUsdToBrlRate(): Promise<number> {
  const response = await fetch(`${AWESOMEAPI_BASE}/USD-BRL`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`AwesomeAPI retornou status ${response.status}`);
  }
  const json = (await response.json()) as Record<string, { bid?: string }>;
  const bid = json.USDBRL?.bid;
  const rate = Number(bid);
  if (!bid || !Number.isFinite(rate)) {
    throw new Error("Resposta da AwesomeAPI não trouxe uma cotação USD-BRL válida.");
  }
  return rate;
}

async function main() {
  const { data: rows, error: selectError } = await supabase
    .from("requests")
    .select("id, total_amount, total_currency, selected_offer_snapshot")
    .eq("total_currency", "USD");

  if (selectError) {
    throw new Error(`Falha ao buscar solicitações em USD: ${selectError.message}`);
  }
  if (!rows || rows.length === 0) {
    console.log("Nenhuma solicitação em USD encontrada. Nada para converter.");
    return;
  }

  const rate = await fetchCurrentUsdToBrlRate();
  console.log(`Taxa USD->BRL usada para o backfill: ${rate}`);
  console.log(`Convertendo ${rows.length} solicitação(ões)...`);

  for (const row of rows) {
    const oldAmount = Number(row.total_amount);
    const newAmount = oldAmount * rate;
    const snapshot = row.selected_offer_snapshot as Record<string, unknown>;

    const { error: updateError } = await supabase
      .from("requests")
      .update({
        total_amount: newAmount,
        total_currency: "BRL",
        exchange_rate_to_brl: rate,
        selected_offer_snapshot: {
          ...snapshot,
          total_amount: newAmount.toFixed(2),
          total_currency: "BRL",
          exchange_rate_to_brl: rate,
        },
      })
      .eq("id", row.id);

    if (updateError) {
      throw new Error(`Falha ao atualizar a solicitação ${row.id}: ${updateError.message}`);
    }

    console.log(`  ${row.id}: ${oldAmount} USD -> ${newAmount.toFixed(2)} BRL`);
  }

  console.log("Backfill concluído.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
```

- [ ] **Step 2: Adicionar o script ao `package.json`**

Edite `travel-app/package.json`, no bloco `"scripts"`, adicione logo após `"seed": "tsx --env-file=.env.local scripts/seed-demo-data.ts"`:

```json
    "seed": "tsx --env-file=.env.local scripts/seed-demo-data.ts",
    "backfill-usd-requests": "tsx --env-file=.env.local scripts/backfill-usd-requests-to-brl.ts"
```

- [ ] **Step 3: Confirmar que a migration do Task 1 já foi aplicada**

Antes de rodar o backfill, confirme que a coluna `exchange_rate_to_brl` já existe em `requests` no Supabase (Task 1, Step 3). Se ainda não foi aplicada, pare aqui e aplique primeiro — o backfill vai falhar (coluna inexistente) caso contrário.

- [ ] **Step 4: Rodar o backfill**

Run: `cd travel-app && npm run backfill-usd-requests`
Expected: log mostrando a taxa usada e a lista das solicitações convertidas (esperado: 9 linhas, uma por solicitação), terminando em "Backfill concluído."

- [ ] **Step 5: Confirmar que não sobrou nenhuma solicitação em USD**

Run: `cd travel-app && npm run backfill-usd-requests`
Expected: "Nenhuma solicitação em USD encontrada. Nada para converter." (rodar de novo é seguro e confirma que a primeira execução converteu tudo).

- [ ] **Step 6: Commit**

```bash
cd travel-app
git add scripts/backfill-usd-requests-to-brl.ts package.json
git commit -m "feat: add one-off backfill script for legacy USD requests"
```

---

### Task 7: Atualizar o diagrama React Flow do schema

**Files:**
- Modify: `travel-app/src/lib/dev/database-schema.ts:93-94` (node `requests`, array `columns`)

**Interfaces:**
- Consumes: nenhuma.
- Produces: nenhuma (consumido só pela página `/dev/schema`).

- [ ] **Step 1: Adicionar a coluna nova ao node `requests`**

Edite `travel-app/src/lib/dev/database-schema.ts`. No node `requests`, no array `columns`, adicione a entrada logo após `{ name: "total_currency", type: "text" },`:

```ts
      { name: "total_amount", type: "numeric" },
      { name: "total_currency", type: "text" },
      {
        name: "exchange_rate_to_brl",
        type: "numeric",
        note: "nullable; registros antigos (seed sintético, ou antes desta mudança) ficam null",
      },
      { name: "created_at", type: "timestamptz", note: "default now()" },
```

- [ ] **Step 2: Verificar visualmente**

Run: `cd travel-app && npm run dev`

Abra `http://localhost:3000/dev/schema` no navegador e confirme que o node `requests` mostra a coluna `exchange_rate_to_brl` (numeric) logo depois de `total_currency`. Pare o servidor depois (Ctrl+C).

- [ ] **Step 3: Rodar a suíte completa de testes e o lint como checagem final**

Run: `cd travel-app && npm run test && npm run lint`
Expected: PASS em ambos — nenhuma regressão em nenhum outro arquivo do projeto.

- [ ] **Step 4: Commit**

```bash
cd travel-app
git add src/lib/dev/database-schema.ts
git commit -m "docs: add exchange_rate_to_brl to the requests node in the schema diagram"
```

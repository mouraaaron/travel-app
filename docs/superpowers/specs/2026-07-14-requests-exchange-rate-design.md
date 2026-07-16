# Gravar a taxa de conversão usada no snapshot da oferta — Design Spec

**Contexto:** a feature de conversão USD→BRL (`docs/superpowers/specs/2026-07-14-currency-conversion-design.md`) já converte toda oferta de voo para BRL na origem (`map-offer.ts`), mas descarta a taxa usada depois de aplicá-la — o número final fica salvo, a taxa que gerou esse número não fica registrada em lugar nenhum. Esta spec cobre gravar essa taxa junto com a oferta selecionada, no momento da conversão.

## Objetivo

Toda vez que uma solicitação de viagem é criada, gravar qual taxa de câmbio (`rate_to_brl`) foi usada para converter a oferta escolhida para BRL — tanto dentro do snapshot JSON da oferta quanto numa coluna própria em `requests`, para permitir tanto auditoria por solicitação individual quanto consultas agregadas.

## Estado atual dos dados (investigado, não é suposição)

Consultado diretamente via Supabase REST API:

- **61 `requests`** com `total_currency = 'BRL'`: vêm de `scripts/seed-demo-data.ts`, que gera valores **sintéticos direto em BRL** — nunca passaram por conversão real, não existe taxa nenhuma por trás desses números.
- **9 `requests`** com `total_currency = 'USD'`: buscas reais na Duffel de 2026-07-10, anteriores à feature de conversão — salvas **sem conversão**, ainda em dólar cru.
- Nenhuma taxa (padrão ou real) foi aplicada retroativamente a nenhum desses 70 registros.

**Achado colateral (documentado, fora de escopo de código nesta spec):** `src/lib/admin-analytics.ts:14` (`requestSpend`) soma `total_amount` de todas as `requests` sem checar `total_currency`, e os componentes de dashboard agregados (`stat-cards.tsx`, `employee-ranking-table.tsx`, `spend-breakdown-charts.tsx`, `spend-chart.tsx`, `employee-summary-cards.tsx`) formatam esse total com `formatCurrency(valor, "BRL")` — moeda fixa no código, não lida do dado. Hoje isso mistura os 9 valores USD com os 61 valores BRL na mesma soma, rotulando tudo como R$. Views de detalhe por solicitação individual (`employee-detail.tsx`, `request-detail-view.tsx`, `requests-queue.tsx`) já usam `snapshot.total_currency` corretamente — o problema é só nos agregados.

Decisão: o backfill (ver abaixo) resolve isso para os dados existentes, porque depois dele as 70 solicitações estão genuinamente em BRL — a soma deixa de misturar moedas. Não vamos alterar `admin-analytics.ts` nem os componentes de dashboard nesta spec; só documentamos o achado para não ser esquecido caso o problema reapareça por outro motivo no futuro.

## Mudanças de dados

### 1. Nova coluna em `requests`

```sql
alter table requests add column if not exists exchange_rate_to_brl numeric;
```

Nullable — registros que não passarem pelo backfill (nenhum, depois desta spec) ou que forem criados por algum fluxo futuro que não popule o campo ficam `null`. Migration `supabase/migrations/0007_requests_exchange_rate.sql`, seguindo o padrão de header/instruções das migrations existentes (`0002`–`0006`).

### 2. Novo campo no JSONB `selected_offer_snapshot`

`exchange_rate_to_brl: number`, ao lado de `total_amount`/`total_currency` que já existem ali. Sem migration própria (é JSONB).

As duas gravações guardam o mesmo valor — redundância intencional: a coluna serve para queries agregadas (ex.: "quantas solicitações usaram taxa de fallback"), o campo no snapshot serve para auditoria por solicitação individual junto com o resto do detalhe da oferta.

## Fluxo de código (thread da taxa: map-offer.ts → snapshot)

`mapDuffelOfferToFlightOffer` (`src/lib/duffel/map-offer.ts`) já recebe `rateToBRL: number` como parâmetro — hoje ele só o usa para calcular `totalAmount`/`penalty_amount` e descarta o valor. Muda para devolvê-lo também como campo do objeto retornado, deixando-o "viajar" pelo mesmo caminho que `totalAmount`/`currency` já percorrem (resultado da busca → seleção pelo usuário → tela de revisão → payload de criação da solicitação):

1. **`src/lib/types.ts`** — `FlightOffer` ganha `rateToBRL: number` (sempre populado — toda oferta mapeada por `mapDuffelOfferToFlightOffer` já recebe uma taxa resolvida, nunca `undefined`). `SelectedOfferSnapshot` ganha `exchange_rate_to_brl?: number` (opcional no tipo, porque os 61 registros do seed sintético, já existentes no banco antes desta mudança, não têm e não vão ganhar esse campo — só solicitações novas e as 9 backfilladas o têm).
2. **`src/lib/duffel/map-offer.ts`** — `mapDuffelOfferToFlightOffer` inclui `rateToBRL` no retorno.
3. **`src/app/(app)/request/review/page.tsx`** — ao montar `selected_offer_snapshot` (por volta da linha 77), inclui `exchange_rate_to_brl: offer.rateToBRL`.
4. **`src/app/api/requests/route.ts`** — `requestCreateSchema.selected_offer_snapshot` (zod, por volta da linha 24) ganha `exchange_rate_to_brl: z.number()`; o insert (por volta da linha 84) grava `exchange_rate_to_brl: parsed.data.selected_offer_snapshot.exchange_rate_to_brl` na nova coluna.
5. **`src/lib/requests-mapper.ts`** — `RequestRow` ganha `exchange_rate_to_brl: number | null`, espelhando a coluna crua. Não propaga para `TravelRequest` (que hoje também não expõe `total_amount`/`total_currency` no nível raiz — só dentro do snapshot; seguimos o mesmo padrão).

Nenhuma mudança em `client.ts` ou `exchange-rate.ts` — eles já resolvem e propagam a taxa corretamente; só faltava ela sair de `map-offer.ts` para o resto do app.

## Backfill das 9 solicitações antigas em USD

Script one-off `scripts/backfill-usd-requests-to-brl.ts`, seguindo o padrão dos scripts existentes em `scripts/`:

1. Busca todas as `requests` com `total_currency = 'USD'`.
2. Resolve a taxa **atual** via `getRateToBRL("USD")` — a mesma função de produção, mesma cotação que seria usada numa busca nova hoje. **Decisão explícita:** não é a taxa histórica do dia em que a busca original foi feita (essa informação não existe mais) — é uma aproximação assumida deliberadamente. Os valores resultantes são razoáveis, não exatos.
3. Para cada registro: `total_amount = total_amount_antigo * taxa`, `total_currency = 'BRL'`, `exchange_rate_to_brl = taxa` — atualiza tanto as colunas de topo quanto os campos equivalentes dentro de `selected_offer_snapshot`.
4. Idempotente: filtro `where total_currency = 'USD'` garante que rodar de novo depois de já convertido não faz nada.

Os 61 registros já em BRL (seed sintético) **não são tocados** pelo backfill — continuam com `exchange_rate_to_brl = null`, porque não existe uma taxa real por trás desses valores; forçar um número ali seria inventar dado.

## Diagrama ReactFlow (`/dev/schema`)

Em `src/lib/dev/database-schema.ts`, no node `requests`: adiciona a coluna `exchange_rate_to_brl numeric` (nota: nullable, registros sem backfill ficam null) logo após `total_currency`. Nenhuma posição nova em `src/app/dev/schema/page.tsx` — é só uma coluna a mais num node que já existe.

## Testes

- `map-offer.test.ts`: novo assert de que `rateToBRL` aparece no objeto retornado.
- Novo teste (ou extensão de um existente) em torno de `request/review/page.tsx` / `api/requests/route.ts` confirmando que `exchange_rate_to_brl` chega no payload e é persistido na coluna.
- Script de backfill: testado manualmente contra os 9 registros reais (não é código de produção contínuo, não precisa de suíte automatizada — mas deve imprimir um relatório do que mudou, para conferência antes/depois).

## Fora de escopo (explicitamente)

- Qualquer mudança em `src/lib/admin-analytics.ts` ou nos componentes de dashboard agregados — o achado de mistura de moeda fica documentado acima, resolvido para os dados existentes pelo backfill, sem guarda defensiva de código nesta spec.
- Qualquer mudança em `src/lib/policy.ts`.
- Recuperar a taxa histórica real do dia da busca original para os 9 registros USD — não existe essa informação, não há como reconstruir.

## Follow-up (2026-07-16)

Uma tentativa (externa, baseada numa leitura errada do código) de "corrigir" `requestSpend()` em `admin-analytics.ts` multiplicando `total_amount` por `exchange_rate_to_brl` quase reintroduziu, como código, exatamente a mistura de moeda que esta spec resolveu via backfill de dado. Reconfirmado nesta data, consultando a tabela `requests` ao vivo: 138 registros, todos `total_currency = "BRL"`, zero linhas em USD — o backfill segue válido, `requestSpend()` continua correto sem nenhuma conversão adicional.

Para que esse engano não se repita, foi adicionado um teste de regressão em `src/lib/admin-analytics.test.ts` (`describe("requestSpend currency normalization", ...)`) que usa uma taxa real observada em produção (5.0881) e trava que o total continua igual a `total_amount` bruto — se alguém reaplicar a taxa no futuro, o teste falha. Continua sendo só um teste Vitest, rodado via `npm test`/CI; nada disso executa como parte do app em produção.
